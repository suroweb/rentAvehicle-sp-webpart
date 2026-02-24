/**
 * Booking CRUD operations with SERIALIZABLE transaction-based double-booking prevention.
 *
 * All queries use parameterized inputs via request.input() to prevent SQL injection.
 * createBooking uses SERIALIZABLE isolation level to atomically check-then-insert,
 * preventing double-bookings even under concurrent requests.
 */
import sql from 'mssql';
import { getPool } from './database.js';
import {
  IAvailableVehicle,
  IVehicleAvailabilitySlot,
  IBooking,
  ITimelineSlot,
  IBookingSuggestion,
} from '../models/Booking.js';

/**
 * Auto-expire bookings on access (lazy expiration pattern).
 *
 * 1. Auto-cancel: Confirmed bookings where startTime + 1 hour < now (no checkout within window).
 * 2. Mark overdue: Active bookings where endTime < now (vehicle not returned on time).
 *
 * Called at the start of getMyBookings and getAvailableVehicles to keep statuses fresh.
 * NOT called on browseAvailableVehicles or getVehicleAvailability per research pitfall #4.
 */
export async function autoExpireBookings(): Promise<void> {
  const pool = await getPool();
  const now = new Date();

  // Auto-cancel: Confirmed bookings where startTime + 1 hour < now
  await pool.request()
    .input('expiryCutoff', sql.DateTime2, new Date(now.getTime() - 60 * 60 * 1000))
    .query(`
      UPDATE Bookings
      SET status = 'Cancelled',
          cancelledAt = GETUTCDATE(),
          cancelledBy = 'SYSTEM',
          cancelReason = 'Auto-cancelled: no checkout within 1 hour of start time',
          updatedAt = GETUTCDATE()
      WHERE status = 'Confirmed'
        AND startTime < @expiryCutoff
    `);

  // Mark overdue: Active bookings where endTime < now
  await pool.request()
    .input('now', sql.DateTime2, now)
    .query(`
      UPDATE Bookings
      SET status = 'Overdue',
          updatedAt = GETUTCDATE()
      WHERE status = 'Active'
        AND endTime < @now
    `);
}

/**
 * Get vehicles available at a specific location during a time range.
 * Excludes vehicles with overlapping confirmed/active bookings using NOT EXISTS.
 * Uses half-open interval overlap check (strict < and >, not <= and >=).
 */
export async function getAvailableVehicles(
  locationId: number,
  startTime: Date,
  endTime: Date,
  categoryId?: number
): Promise<IAvailableVehicle[]> {
  await autoExpireBookings();
  const pool = await getPool();
  const request = pool.request();

  request.input('locationId', sql.Int, locationId);
  request.input('startTime', sql.DateTime2, startTime);
  request.input('endTime', sql.DateTime2, endTime);

  let categoryFilter = '';
  if (categoryId) {
    request.input('categoryId', sql.Int, categoryId);
    categoryFilter = 'AND v.categoryId = @categoryId';
  }

  const result = await request.query(`
    SELECT
      v.id, v.make, v.model, v.year, v.licensePlate,
      v.locationId, l.name AS locationName, l.timezone AS locationTimezone,
      v.categoryId, c.name AS categoryName,
      v.capacity, v.photoUrl, v.status
    FROM Vehicles v
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE v.isArchived = 0
      AND v.status = 'Available'
      AND v.locationId = @locationId
      ${categoryFilter}
      AND NOT EXISTS (
        SELECT 1 FROM Bookings b
        WHERE b.vehicleId = v.id
          AND b.status IN ('Confirmed', 'Active')
          AND b.startTime < @endTime
          AND b.endTime > @startTime
      )
    ORDER BY v.make, v.model
  `);

  return result.recordset;
}

/**
 * Get a single vehicle by ID with category/location joins (including timezone).
 * Employee-facing: returns non-archived vehicles regardless of status.
 * Does NOT filter by status='Available' -- employees should see the vehicle detail
 * page even if it becomes unavailable (the booking form will fail gracefully).
 */
export async function getVehicleDetail(
  vehicleId: number
): Promise<IAvailableVehicle | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.Int, vehicleId);

  const result = await request.query(`
    SELECT
      v.id, v.make, v.model, v.year, v.licensePlate,
      v.locationId, l.name AS locationName, l.timezone AS locationTimezone,
      v.categoryId, c.name AS categoryName,
      v.capacity, v.photoUrl, v.status
    FROM Vehicles v
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE v.id = @id AND v.isArchived = 0
  `);

  if (result.recordset.length === 0) {
    return null;
  }

  return result.recordset[0];
}

/**
 * Get booked time slots for a vehicle over the next N days.
 * Returns confirmed/active bookings as availability slots for the
 * 7-day availability strip on the vehicle detail page.
 */
export async function getVehicleAvailability(
  vehicleId: number,
  days: number = 7
): Promise<IVehicleAvailabilitySlot[]> {
  const pool = await getPool();
  const request = pool.request();

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  request.input('vehicleId', sql.Int, vehicleId);
  request.input('rangeStart', sql.DateTime2, now);
  request.input('rangeEnd', sql.DateTime2, rangeEnd);

  const result = await request.query(`
    SELECT startTime, endTime, status
    FROM Bookings
    WHERE vehicleId = @vehicleId
      AND status IN ('Confirmed', 'Active')
      AND startTime < @rangeEnd
      AND endTime > @rangeStart
    ORDER BY startTime
  `);

  return result.recordset;
}

/**
 * Create a new booking with SERIALIZABLE isolation level to prevent double-bookings.
 *
 * CRITICAL: Uses SERIALIZABLE transaction to atomically:
 * 1. Check for overlapping confirmed/active bookings (range-locked)
 * 2. Insert the new booking if no overlap exists
 *
 * SERIALIZABLE acquires range locks that prevent concurrent transactions from
 * inserting rows with key values in the range being read.
 *
 * Handles SQL Server deadlock error 1205 by returning {conflict: true} instead of throwing.
 */
export async function createBooking(
  vehicleId: number,
  userId: string,
  userEmail: string,
  userDisplayName: string,
  startTime: Date,
  endTime: Date
): Promise<{ id: number } | { conflict: true }> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    // SERIALIZABLE prevents phantom reads -- range locks block concurrent inserts
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const checkRequest = new sql.Request(transaction);
    checkRequest.input('vehicleId', sql.Int, vehicleId);
    checkRequest.input('startTime', sql.DateTime2, startTime);
    checkRequest.input('endTime', sql.DateTime2, endTime);

    // Check for overlapping bookings (range-locked by SERIALIZABLE)
    const overlapCheck = await checkRequest.query(`
      SELECT COUNT(*) AS overlapCount
      FROM Bookings
      WHERE vehicleId = @vehicleId
        AND status IN ('Confirmed', 'Active')
        AND startTime < @endTime
        AND endTime > @startTime
    `);

    if (overlapCheck.recordset[0].overlapCount > 0) {
      await transaction.rollback();
      return { conflict: true };
    }

    // No overlap -- insert the booking
    const insertRequest = new sql.Request(transaction);
    insertRequest.input('vehicleId', sql.Int, vehicleId);
    insertRequest.input('userId', sql.NVarChar(255), userId);
    insertRequest.input('userEmail', sql.NVarChar(255), userEmail);
    insertRequest.input('userDisplayName', sql.NVarChar(255), userDisplayName);
    insertRequest.input('startTime', sql.DateTime2, startTime);
    insertRequest.input('endTime', sql.DateTime2, endTime);

    const result = await insertRequest.query(`
      INSERT INTO Bookings (vehicleId, userId, userEmail, userDisplayName, startTime, endTime, status)
      OUTPUT INSERTED.id
      VALUES (@vehicleId, @userId, @userEmail, @userDisplayName, @startTime, @endTime, 'Confirmed')
    `);

    await transaction.commit();
    return { id: result.recordset[0].id };
  } catch (error: unknown) {
    // Rollback if not already rolled back
    try {
      await transaction.rollback();
    } catch {
      /* transaction may already be rolled back by SQL Server */
    }

    // SQL Server deadlock error 1205 -- treat as conflict, not server error
    if (
      error instanceof Error &&
      'number' in error &&
      (error as Error & { number: number }).number === 1205
    ) {
      return { conflict: true };
    }

    throw error;
  }
}

/**
 * Get all bookings for a specific user (all statuses including Cancelled).
 * Joins Vehicles, Categories, and Locations for display-ready data.
 * Returns all fields the frontend needs without additional API calls.
 * Includes cancelled bookings so the frontend can show admin cancel reasons.
 */
export async function getMyBookings(userId: string): Promise<IBooking[]> {
  await autoExpireBookings();
  const pool = await getPool();
  const request = pool.request();
  request.input('userId', sql.NVarChar(255), userId);

  const result = await request.query(`
    SELECT
      b.id,
      b.vehicleId,
      v.make AS vehicleMake,
      v.model AS vehicleModel,
      v.year AS vehicleYear,
      v.licensePlate AS vehicleLicensePlate,
      c.name AS vehicleCategoryName,
      v.capacity AS vehicleCapacity,
      v.photoUrl AS vehiclePhotoUrl,
      v.locationId AS locationId,
      l.name AS locationName,
      l.timezone AS locationTimezone,
      b.userId,
      b.userEmail,
      b.userDisplayName,
      b.startTime,
      b.endTime,
      b.status,
      b.createdAt,
      b.cancelledAt,
      b.cancelledBy,
      b.checkedOutAt,
      b.checkedInAt,
      b.cancelReason
    FROM Bookings b
    LEFT JOIN Vehicles v ON b.vehicleId = v.id
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE b.userId = @userId
    ORDER BY b.startTime DESC
  `);

  return result.recordset;
}

/**
 * Cancel a booking. Only the booking owner can cancel, and only before the booking starts.
 *
 * Returns:
 * - 'cancelled': Successfully cancelled
 * - 'not_found': Booking ID does not exist
 * - 'not_yours': Booking belongs to a different user
 * - 'already_past': Booking has already started or ended (cannot cancel)
 */
export async function cancelBooking(
  bookingId: number,
  userId: string
): Promise<'cancelled' | 'not_found' | 'not_yours' | 'already_past'> {
  const pool = await getPool();
  const request = pool.request();
  request.input('bookingId', sql.Int, bookingId);

  // First fetch the booking to validate ownership and timing
  const selectResult = await request.query(`
    SELECT id, userId, startTime, status
    FROM Bookings
    WHERE id = @bookingId
  `);

  if (selectResult.recordset.length === 0) {
    return 'not_found';
  }

  const booking = selectResult.recordset[0];

  if (booking.userId !== userId) {
    return 'not_yours';
  }

  // Can't cancel a booking that has already started
  if (new Date(booking.startTime) <= new Date()) {
    return 'already_past';
  }

  // Perform the cancellation
  const updateRequest = pool.request();
  updateRequest.input('bookingId', sql.Int, bookingId);
  updateRequest.input('userId', sql.NVarChar(255), userId);

  await updateRequest.query(`
    UPDATE Bookings
    SET status = 'Cancelled',
        cancelledAt = GETUTCDATE(),
        cancelledBy = @userId,
        updatedAt = GETUTCDATE()
    WHERE id = @bookingId
  `);

  return 'cancelled';
}

/**
 * Check out a booking (Confirmed -> Active transition).
 *
 * Validates:
 * - Booking exists
 * - User owns the booking
 * - Status is Confirmed
 * - Current time is within the checkout window (startTime - 30min to startTime + 60min)
 *
 * Uses atomic UPDATE with WHERE status='Confirmed' to prevent race conditions.
 */
export async function checkOutBooking(
  bookingId: number,
  userId: string
): Promise<'checked_out' | 'not_found' | 'not_yours' | 'too_early' | 'expired' | 'wrong_status'> {
  const pool = await getPool();

  // Fetch booking to validate
  const check = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query('SELECT id, userId, startTime, status FROM Bookings WHERE id = @bookingId');

  if (check.recordset.length === 0) return 'not_found';
  const booking = check.recordset[0];
  if (booking.userId !== userId) return 'not_yours';
  if (booking.status !== 'Confirmed') return 'wrong_status';

  const now = new Date();
  const startTime = new Date(booking.startTime);
  const thirtyMinBefore = new Date(startTime.getTime() - 30 * 60 * 1000);
  const oneHourAfter = new Date(startTime.getTime() + 60 * 60 * 1000);

  if (now < thirtyMinBefore) return 'too_early';
  if (now > oneHourAfter) return 'expired';

  // Atomic status transition -- WHERE status='Confirmed' prevents double checkout
  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query(`
      UPDATE Bookings
      SET status = 'Active', checkedOutAt = GETUTCDATE(), updatedAt = GETUTCDATE()
      WHERE id = @bookingId AND status = 'Confirmed'
    `);

  return result.rowsAffected[0] > 0 ? 'checked_out' : 'wrong_status';
}

/**
 * Check in (return) a booking (Active/Overdue -> Completed transition).
 *
 * Validates:
 * - Booking exists
 * - User owns the booking
 * - Status is Active or Overdue
 *
 * Uses atomic UPDATE with WHERE status IN ('Active', 'Overdue').
 */
export async function checkInBooking(
  bookingId: number,
  userId: string
): Promise<'checked_in' | 'not_found' | 'not_yours' | 'wrong_status'> {
  const pool = await getPool();

  // Fetch booking to validate
  const check = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query('SELECT id, userId, status FROM Bookings WHERE id = @bookingId');

  if (check.recordset.length === 0) return 'not_found';
  const booking = check.recordset[0];
  if (booking.userId !== userId) return 'not_yours';

  // Atomic status transition
  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .query(`
      UPDATE Bookings
      SET status = 'Completed', checkedInAt = GETUTCDATE(), updatedAt = GETUTCDATE()
      WHERE id = @bookingId AND status IN ('Active', 'Overdue')
    `);

  return result.rowsAffected[0] > 0 ? 'checked_in' : 'wrong_status';
}

/**
 * Get calendar timeline data for a location on a given day.
 * Returns all non-archived Available vehicles and all overlapping bookings.
 * Used by the day-view calendar timeline component.
 */
export async function getLocationTimeline(
  locationId: number,
  dayStart: Date,
  dayEnd: Date
): Promise<{ vehicles: IAvailableVehicle[]; bookings: ITimelineSlot[] }> {
  const pool = await getPool();

  // Get all non-archived Available vehicles at this location
  const vehiclesResult = await pool.request()
    .input('locationId', sql.Int, locationId)
    .query(`
      SELECT
        v.id, v.make, v.model, v.year, v.licensePlate,
        v.locationId, l.name AS locationName, l.timezone AS locationTimezone,
        v.categoryId, c.name AS categoryName,
        v.capacity, v.photoUrl, v.status
      FROM Vehicles v
      LEFT JOIN Categories c ON v.categoryId = c.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE v.isArchived = 0
        AND v.status = 'Available'
        AND v.locationId = @locationId
      ORDER BY v.make, v.model
    `);

  // Get all bookings overlapping this day for vehicles at this location
  const bookingsResult = await pool.request()
    .input('locationId', sql.Int, locationId)
    .input('dayStart', sql.DateTime2, dayStart)
    .input('dayEnd', sql.DateTime2, dayEnd)
    .query(`
      SELECT
        b.id AS bookingId, b.vehicleId,
        v.make AS vehicleMake, v.model AS vehicleModel,
        v.licensePlate AS vehicleLicensePlate,
        b.startTime, b.endTime, b.status,
        b.userId, b.userDisplayName
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      WHERE v.locationId = @locationId
        AND v.isArchived = 0
        AND b.status IN ('Confirmed', 'Active', 'Overdue')
        AND b.startTime < @dayEnd
        AND b.endTime > @dayStart
      ORDER BY v.make, v.model, b.startTime
    `);

  return {
    vehicles: vehiclesResult.recordset,
    bookings: bookingsResult.recordset,
  };
}

/**
 * Get booking suggestions when a conflict occurs.
 * Returns a mix of time-shifted slots (same vehicle) and alternative vehicles (same time).
 *
 * Time shifts: checks offsets of +1h, -1h, +2h, -2h, +3h, -3h, +4h, -4h.
 * Alt vehicles: finds available vehicles at the same location with no overlapping bookings.
 * Returns up to maxSuggestions total (default 3).
 */
export async function getBookingSuggestions(
  vehicleId: number,
  locationId: number,
  startTime: Date,
  endTime: Date,
  maxSuggestions: number = 3
): Promise<IBookingSuggestion[]> {
  const pool = await getPool();
  const duration = endTime.getTime() - startTime.getTime();
  const suggestions: IBookingSuggestion[] = [];

  // Get vehicle name for time_shift labels
  const vehicleResult = await pool.request()
    .input('vehicleId', sql.Int, vehicleId)
    .query('SELECT make, model FROM Vehicles WHERE id = @vehicleId');
  const vehicleName = vehicleResult.recordset.length > 0
    ? vehicleResult.recordset[0].make + ' ' + vehicleResult.recordset[0].model
    : 'Unknown Vehicle';

  // 1. Time shifts: check offsets for the same vehicle
  const timeShifts = [1, -1, 2, -2, 3, -3, 4, -4];
  for (const shift of timeShifts) {
    if (suggestions.length >= 2) break; // Max 2 time shifts
    const shiftedStart = new Date(startTime.getTime() + shift * 3600000);
    const shiftedEnd = new Date(shiftedStart.getTime() + duration);

    const overlap = await pool.request()
      .input('vehicleId', sql.Int, vehicleId)
      .input('start', sql.DateTime2, shiftedStart)
      .input('end', sql.DateTime2, shiftedEnd)
      .query(`
        SELECT COUNT(*) AS cnt FROM Bookings
        WHERE vehicleId = @vehicleId
          AND status IN ('Confirmed', 'Active', 'Overdue')
          AND startTime < @end AND endTime > @start
      `);

    if (overlap.recordset[0].cnt === 0) {
      suggestions.push({
        type: 'time_shift',
        vehicleId,
        vehicleName,
        startTime: shiftedStart.toISOString(),
        endTime: shiftedEnd.toISOString(),
        label: (shift > 0 ? '+' : '') + shift + 'h from requested time',
      });
    }
  }

  // 2. Alt vehicles at same location for original time
  const remaining = maxSuggestions - suggestions.length;
  if (remaining > 0) {
    const altVehicles = await pool.request()
      .input('locationId', sql.Int, locationId)
      .input('vehicleId', sql.Int, vehicleId)
      .input('start', sql.DateTime2, startTime)
      .input('end', sql.DateTime2, endTime)
      .query(`
        SELECT TOP ${remaining} v.id, v.make, v.model
        FROM Vehicles v
        WHERE v.locationId = @locationId
          AND v.id != @vehicleId
          AND v.isArchived = 0
          AND v.status = 'Available'
          AND NOT EXISTS (
            SELECT 1 FROM Bookings b
            WHERE b.vehicleId = v.id
              AND b.status IN ('Confirmed', 'Active', 'Overdue')
              AND b.startTime < @end AND b.endTime > @start
          )
      `);

    for (const alt of altVehicles.recordset) {
      if (suggestions.length >= maxSuggestions) break;
      suggestions.push({
        type: 'alt_vehicle',
        vehicleId: alt.id,
        vehicleName: alt.make + ' ' + alt.model,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        label: alt.make + ' ' + alt.model + ', same time',
      });
    }
  }

  return suggestions.slice(0, maxSuggestions);
}

/**
 * Get all bookings with optional filters (admin use).
 * Calls autoExpireBookings() first to ensure fresh statuses.
 *
 * Filters: locationId, status, dateFrom, dateTo, employeeSearch (LIKE on userDisplayName).
 * Returns full booking records with vehicle and location display data.
 */
export async function getAllBookings(filters: {
  locationId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  employeeSearch?: string;
}): Promise<IBooking[]> {
  await autoExpireBookings();
  const pool = await getPool();
  const request = pool.request();

  // Build dynamic WHERE conditions
  const conditions: string[] = [];

  if (filters.locationId) {
    request.input('locationId', sql.Int, filters.locationId);
    conditions.push('v.locationId = @locationId');
  }

  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    conditions.push('b.status = @status');
  }

  if (filters.dateFrom) {
    request.input('dateFrom', sql.DateTime2, filters.dateFrom);
    conditions.push('b.startTime >= @dateFrom');
  }

  if (filters.dateTo) {
    request.input('dateTo', sql.DateTime2, filters.dateTo);
    conditions.push('b.endTime <= @dateTo');
  }

  if (filters.employeeSearch) {
    request.input('employeeSearch', sql.NVarChar(255), '%' + filters.employeeSearch + '%');
    conditions.push('b.userDisplayName LIKE @employeeSearch');
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const result = await request.query(`
    SELECT
      b.id,
      b.vehicleId,
      v.make AS vehicleMake,
      v.model AS vehicleModel,
      v.year AS vehicleYear,
      v.licensePlate AS vehicleLicensePlate,
      c.name AS vehicleCategoryName,
      v.capacity AS vehicleCapacity,
      v.photoUrl AS vehiclePhotoUrl,
      v.locationId AS locationId,
      l.name AS locationName,
      l.timezone AS locationTimezone,
      b.userId,
      b.userEmail,
      b.userDisplayName,
      b.startTime,
      b.endTime,
      b.status,
      b.createdAt,
      b.cancelledAt,
      b.cancelledBy,
      b.checkedOutAt,
      b.checkedInAt,
      b.cancelReason
    FROM Bookings b
    LEFT JOIN Vehicles v ON b.vehicleId = v.id
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    ${whereClause}
    ORDER BY b.startTime DESC
  `);

  return result.recordset;
}

/**
 * Admin cancel a booking with a required reason.
 * Works on Confirmed, Active, and Overdue bookings.
 * Returns 'not_found' if booking doesn't exist, 'already_done' if already completed/cancelled.
 */
export async function adminCancelBooking(
  bookingId: number,
  adminUserId: string,
  cancelReason: string
): Promise<'cancelled' | 'not_found' | 'already_done'> {
  const pool = await getPool();

  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .input('adminUserId', sql.NVarChar(255), adminUserId)
    .input('cancelReason', sql.NVarChar(500), cancelReason)
    .query(`
      UPDATE Bookings
      SET status = 'Cancelled',
          cancelledAt = GETUTCDATE(),
          cancelledBy = @adminUserId,
          cancelReason = @cancelReason,
          updatedAt = GETUTCDATE()
      WHERE id = @bookingId
        AND status IN ('Confirmed', 'Active', 'Overdue')
    `);

  if (result.rowsAffected[0] === 0) {
    // Check if booking exists at all
    const check = await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query('SELECT id FROM Bookings WHERE id = @bookingId');
    return check.recordset.length === 0 ? 'not_found' : 'already_done';
  }

  return 'cancelled';
}
