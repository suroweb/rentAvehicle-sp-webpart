/**
 * TypeScript interfaces for reporting data shapes.
 *
 * 6 interfaces covering:
 * - Location-level utilization (IUtilizationData)
 * - Vehicle-level utilization (IUtilizationVehicleData)
 * - Booking trend periods (ITrendData)
 * - Anonymized raw booking records for CSV export (IRawBookingRecord)
 * - KPI summary metrics (IKpiSummary)
 * - Manager team bookings (ITeamBooking)
 *
 * Privacy: IRawBookingRecord intentionally excludes userId, userDisplayName,
 * and userEmail. This is a locked decision -- reports are about fleet utilization
 * patterns, not tracking individual employee behavior.
 *
 * ITeamBooking includes userDisplayName because managers already receive named
 * notifications about their direct reports' bookings (locked decision).
 */

/** Location-level utilization aggregation. */
export interface IUtilizationData {
  locationId: number;
  locationName: string;
  vehicleCount: number;
  totalBookingHours: number;
  totalAvailableHours: number;
  /** Utilization rate as a percentage (0-100). */
  utilizationRate: number;
}

/** Vehicle-level utilization within a specific location. */
export interface IUtilizationVehicleData {
  vehicleId: number;
  make: string;
  model: string;
  licensePlate: string;
  totalBookingHours: number;
  totalAvailableHours: number;
  /** Utilization rate as a percentage (0-100). */
  utilizationRate: number;
}

/** Booking trend data grouped by time period. */
export interface ITrendData {
  /** Date string: YYYY-MM-DD for daily, week start YYYY-MM-DD for weekly. */
  period: string;
  bookingCount: number;
  utilizationPct: number;
}

/**
 * Anonymized raw booking record for CSV export.
 *
 * MUST NOT include userId, userDisplayName, or userEmail.
 * Privacy-first: locked user decision.
 */
export interface IRawBookingRecord {
  bookingId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  locationName: string;
  startTime: string;
  endTime: string;
  status: string;
  durationHours: number;
}

/** Top-level KPI summary for the admin dashboard. */
export interface IKpiSummary {
  /** Overall fleet utilization rate as a percentage (0-100). */
  utilizationRate: number;
  totalBookings: number;
  activeBookings: number;
  overdueCount: number;
}

/**
 * A direct report's booking visible to their manager.
 *
 * Includes userDisplayName -- managers CAN see names per locked decision
 * (they already receive named notifications about these bookings).
 */
export interface ITeamBooking {
  bookingId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  locationName: string;
  locationTimezone: string;
  userDisplayName: string;
  startTime: string;
  endTime: string;
  status: string;
}
