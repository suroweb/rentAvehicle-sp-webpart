/**
 * Reporting service with SQL aggregation queries and Graph team lookup.
 *
 * 7 exported functions:
 * 1. getKpiSummary         - Overall KPI metrics for dashboard header
 * 2. getUtilizationByLocation - Utilization rates grouped by location
 * 3. getUtilizationByVehicle  - Utilization rates per vehicle within a location
 * 4. getBookingTrends      - Booking counts/utilization over time (daily/weekly)
 * 5. getRawBookingData     - Anonymized booking records for CSV export
 * 6. getDirectReportIds    - Resolve manager's direct reports via Graph API
 * 7. getTeamBookings       - Current/upcoming bookings for direct reports
 *
 * All SQL queries use parameterized inputs via request.input() to prevent injection.
 * Utilization calculations clamp booking hours to date range bounds (pitfall #2).
 * Raw data export intentionally omits employee PII (locked privacy decision).
 */
import sql from 'mssql';
import { getPool } from './database.js';
import { getGraphClient } from './graphService.js';
import type {
  IUtilizationData,
  IUtilizationVehicleData,
  ITrendData,
  IRawBookingRecord,
  IKpiSummary,
  ITeamBooking,
} from '../models/Report.js';

/**
 * Get top-level KPI summary for the admin dashboard.
 *
 * Returns overall utilization rate, total bookings, active bookings, and overdue count
 * within the specified date range.
 */
export async function getKpiSummary(
  dateFrom: Date,
  dateTo: Date
): Promise<IKpiSummary> {
  const pool = await getPool();

  // Count bookings by status within date range
  const bookingResult = await pool.request()
    .input('dateFrom', sql.DateTime2, dateFrom)
    .input('dateTo', sql.DateTime2, dateTo)
    .query(`
      SELECT
        COUNT(*) AS totalBookings,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeBookings,
        SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) AS overdueCount,
        ISNULL(SUM(
          DATEDIFF(HOUR,
            CASE WHEN startTime < @dateFrom THEN @dateFrom ELSE startTime END,
            CASE WHEN endTime > @dateTo THEN @dateTo ELSE endTime END
          )
        ), 0) AS totalBookingHours
      FROM Bookings
      WHERE status IN ('Confirmed', 'Active', 'Completed', 'Overdue')
        AND startTime < @dateTo
        AND endTime > @dateFrom
    `);

  // Count total non-archived Available vehicles for utilization denominator
  const vehicleResult = await pool.request()
    .query(`
      SELECT COUNT(*) AS vehicleCount
      FROM Vehicles
      WHERE isArchived = 0 AND status = 'Available'
    `);

  const row = bookingResult.recordset[0];
  const vehicleCount = vehicleResult.recordset[0].vehicleCount;
  const totalHoursInRange = Math.max(
    (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60),
    0
  );
  const totalAvailableHours = vehicleCount * totalHoursInRange;

  const utilizationRate = totalAvailableHours > 0
    ? Math.round((row.totalBookingHours / totalAvailableHours) * 100)
    : 0;

  return {
    utilizationRate,
    totalBookings: row.totalBookings,
    activeBookings: row.activeBookings,
    overdueCount: row.overdueCount,
  };
}

/**
 * Get utilization rates aggregated by location.
 *
 * Joins Vehicles and Bookings, groups by location. Clamps booking hours to date range
 * bounds to avoid over-counting bookings that span outside the range (pitfall #2).
 * Only counts non-archived Available vehicles and relevant booking statuses.
 */
export async function getUtilizationByLocation(
  dateFrom: Date,
  dateTo: Date
): Promise<IUtilizationData[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dateFrom', sql.DateTime2, dateFrom)
    .input('dateTo', sql.DateTime2, dateTo)
    .query(`
      SELECT
        l.id AS locationId,
        l.name AS locationName,
        COUNT(DISTINCT v.id) AS vehicleCount,
        ISNULL(SUM(
          DATEDIFF(HOUR,
            CASE WHEN b.startTime < @dateFrom THEN @dateFrom ELSE b.startTime END,
            CASE WHEN b.endTime > @dateTo THEN @dateTo ELSE b.endTime END
          )
        ), 0) AS totalBookingHours,
        COUNT(DISTINCT v.id) * DATEDIFF(HOUR, @dateFrom, @dateTo) AS totalAvailableHours
      FROM Vehicles v
      INNER JOIN Locations l ON v.locationId = l.id
      LEFT JOIN Bookings b ON b.vehicleId = v.id
        AND b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue')
        AND b.startTime < @dateTo
        AND b.endTime > @dateFrom
      WHERE v.isArchived = 0 AND v.status = 'Available'
      GROUP BY l.id, l.name
      ORDER BY l.name
    `);

  return result.recordset.map(row => ({
    locationId: row.locationId,
    locationName: row.locationName,
    vehicleCount: row.vehicleCount,
    totalBookingHours: row.totalBookingHours,
    totalAvailableHours: row.totalAvailableHours,
    utilizationRate: row.totalAvailableHours > 0
      ? Math.round((row.totalBookingHours / row.totalAvailableHours) * 100)
      : 0,
  }));
}

/**
 * Get utilization rates per vehicle within a specific location.
 *
 * Same aggregation pattern as getUtilizationByLocation but grouped by individual vehicle.
 * Returns make, model, licensePlate for each vehicle.
 */
export async function getUtilizationByVehicle(
  dateFrom: Date,
  dateTo: Date,
  locationId: number
): Promise<IUtilizationVehicleData[]> {
  const pool = await getPool();
  const totalHoursInRange = Math.max(
    Math.round((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60)),
    0
  );

  const result = await pool.request()
    .input('dateFrom', sql.DateTime2, dateFrom)
    .input('dateTo', sql.DateTime2, dateTo)
    .input('locationId', sql.Int, locationId)
    .query(`
      SELECT
        v.id AS vehicleId,
        v.make,
        v.model,
        v.licensePlate,
        ISNULL(SUM(
          DATEDIFF(HOUR,
            CASE WHEN b.startTime < @dateFrom THEN @dateFrom ELSE b.startTime END,
            CASE WHEN b.endTime > @dateTo THEN @dateTo ELSE b.endTime END
          )
        ), 0) AS totalBookingHours
      FROM Vehicles v
      LEFT JOIN Bookings b ON b.vehicleId = v.id
        AND b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue')
        AND b.startTime < @dateTo
        AND b.endTime > @dateFrom
      WHERE v.isArchived = 0
        AND v.status = 'Available'
        AND v.locationId = @locationId
      GROUP BY v.id, v.make, v.model, v.licensePlate
      ORDER BY v.make, v.model
    `);

  return result.recordset.map(row => ({
    vehicleId: row.vehicleId,
    make: row.make,
    model: row.model,
    licensePlate: row.licensePlate,
    totalBookingHours: row.totalBookingHours,
    totalAvailableHours: totalHoursInRange,
    utilizationRate: totalHoursInRange > 0
      ? Math.round((row.totalBookingHours / totalHoursInRange) * 100)
      : 0,
  }));
}

/**
 * Get booking trend data grouped by daily or weekly periods.
 *
 * Groups bookings by date period using SQL CONVERT for daily and DATEADD for weekly.
 * Supports optional locationId and categoryId filters using dynamic WHERE clause
 * (follows getAllBookings pattern from Phase 4).
 */
export async function getBookingTrends(
  dateFrom: Date,
  dateTo: Date,
  granularity: 'daily' | 'weekly',
  locationId?: number,
  categoryId?: number
): Promise<ITrendData[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('dateFrom', sql.DateTime2, dateFrom);
  request.input('dateTo', sql.DateTime2, dateTo);

  const dateGroup = granularity === 'daily'
    ? "CONVERT(VARCHAR(10), b.startTime, 23)"
    : "CONVERT(VARCHAR(10), DATEADD(DAY, -(DATEPART(WEEKDAY, b.startTime) - 1), CAST(b.startTime AS DATE)), 23)";

  const conditions: string[] = [
    "b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue')",
    'b.startTime >= @dateFrom',
    'b.startTime < @dateTo',
  ];

  if (locationId) {
    request.input('locationId', sql.Int, locationId);
    conditions.push('v.locationId = @locationId');
  }

  if (categoryId) {
    request.input('categoryId', sql.Int, categoryId);
    conditions.push('v.categoryId = @categoryId');
  }

  const result = await request.query(`
    SELECT
      ${dateGroup} AS period,
      COUNT(*) AS bookingCount
    FROM Bookings b
    INNER JOIN Vehicles v ON b.vehicleId = v.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ${dateGroup}
    ORDER BY period
  `);

  // Calculate utilization per period using total vehicle count and period hours
  const vehicleResult = await pool.request().query(`
    SELECT COUNT(*) AS vehicleCount
    FROM Vehicles
    WHERE isArchived = 0 AND status = 'Available'
  `);

  const vehicleCount = vehicleResult.recordset[0].vehicleCount;
  const periodHours = granularity === 'daily' ? 24 : 168; // 24h per day, 168h per week
  const periodAvailableHours = vehicleCount * periodHours;

  return result.recordset.map(row => ({
    period: row.period,
    bookingCount: row.bookingCount,
    utilizationPct: periodAvailableHours > 0
      ? Math.round((row.bookingCount * periodHours / periodAvailableHours) * 100)
      : 0,
  }));
}

/**
 * Get anonymized raw booking records for CSV export.
 *
 * MUST NOT include userId, userDisplayName, or userEmail.
 * Privacy-first: locked user decision. Reports are about fleet utilization
 * patterns, not tracking individual employee behavior.
 *
 * Includes computed durationHours via DATEDIFF.
 */
export async function getRawBookingData(
  dateFrom: Date,
  dateTo: Date
): Promise<IRawBookingRecord[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dateFrom', sql.DateTime2, dateFrom)
    .input('dateTo', sql.DateTime2, dateTo)
    .query(`
      SELECT
        b.id AS bookingId,
        v.make AS vehicleMake,
        v.model AS vehicleModel,
        v.licensePlate AS vehicleLicensePlate,
        l.name AS locationName,
        l.timezone AS locationTimezone,
        b.startTime,
        b.endTime,
        b.status,
        DATEDIFF(HOUR, b.startTime, b.endTime) AS durationHours
      FROM Bookings b
      INNER JOIN Vehicles v ON b.vehicleId = v.id
      LEFT JOIN Locations l ON v.locationId = l.id
      WHERE b.startTime < @dateTo
        AND b.endTime > @dateFrom
        AND b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue', 'Cancelled')
      ORDER BY b.startTime DESC
    `);

  return result.recordset;
}

/**
 * Resolve a manager's direct reports from Entra ID via Graph API.
 *
 * Uses application permission path /users/{managerId}/directReports
 * (NOT /me/directReports -- backend has no signed-in user context).
 *
 * Returns array of Entra ID object IDs. Handles empty response gracefully.
 */
export async function getDirectReportIds(
  managerId: string
): Promise<string[]> {
  try {
    const client = await getGraphClient();
    const response = await client
      .api(`/users/${managerId}/directReports`)
      .select('id,userPrincipalName')
      .get();

    return (response.value || [])
      .filter((r: { id?: string }) => r.id)
      .map((r: { id: string }) => r.id);
  } catch (error) {
    console.error(`Failed to get direct reports for manager ${managerId}:`, error);
    return [];
  }
}

/**
 * Get current and upcoming bookings for a set of direct report user IDs.
 *
 * Returns empty array if no direct report IDs are provided.
 * Builds parameterized IN clause to prevent SQL injection.
 *
 * Shows only current + upcoming bookings (status IN Confirmed, Active, Overdue
 * where endTime > now). Privacy-first: past bookings excluded for operational
 * oversight scope only.
 *
 * Includes userDisplayName -- managers CAN see names per locked decision.
 */
export async function getTeamBookings(
  directReportIds: string[]
): Promise<ITeamBooking[]> {
  if (directReportIds.length === 0) return [];

  const pool = await getPool();
  const request = pool.request();

  // Build parameterized IN clause
  const idParams = directReportIds.map((id, i) => {
    request.input(`uid${i}`, sql.NVarChar(255), id);
    return `@uid${i}`;
  });

  const result = await request.query(`
    SELECT
      b.id AS bookingId,
      v.make AS vehicleMake,
      v.model AS vehicleModel,
      v.licensePlate AS vehicleLicensePlate,
      l.name AS locationName,
      l.timezone AS locationTimezone,
      b.userDisplayName,
      b.startTime,
      b.endTime,
      b.status
    FROM Bookings b
    INNER JOIN Vehicles v ON b.vehicleId = v.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE b.userId IN (${idParams.join(',')})
      AND b.status IN ('Confirmed', 'Active', 'Overdue')
      AND b.endTime > GETUTCDATE()
    ORDER BY b.startTime ASC
  `);

  return result.recordset;
}
