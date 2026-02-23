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
} from '../models/Booking.js';

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
 * Get all bookings for a specific user (non-cancelled).
 * Joins Vehicles, Categories, and Locations for display-ready data.
 * Returns all fields the frontend needs without additional API calls.
 */
export async function getMyBookings(userId: string): Promise<IBooking[]> {
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
      b.cancelledBy
    FROM Bookings b
    LEFT JOIN Vehicles v ON b.vehicleId = v.id
    LEFT JOIN Categories c ON v.categoryId = c.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE b.userId = @userId
      AND b.status != 'Cancelled'
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
