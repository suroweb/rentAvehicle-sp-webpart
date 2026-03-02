/**
 * Frontend TypeScript interfaces matching API response shapes for reporting.
 *
 * Includes:
 * - 6 data interfaces matching the API Report.ts model
 * - DatePreset type and IDateRange interface for date range picker
 * - getDateRange utility for computing date ranges from presets
 */

/** Location-level utilization aggregation from /api/backoffice/reports/utilization. */
export interface IUtilizationData {
  locationId: number;
  locationName: string;
  vehicleCount: number;
  totalBookingHours: number;
  totalAvailableHours: number;
  utilizationRate: number;
}

/** Vehicle-level utilization from /api/backoffice/reports/utilization?locationId=N. */
export interface IUtilizationVehicleData {
  vehicleId: number;
  make: string;
  model: string;
  licensePlate: string;
  totalBookingHours: number;
  totalAvailableHours: number;
  utilizationRate: number;
}

/** Booking trend data point from /api/backoffice/reports/trends. */
export interface ITrendData {
  period: string;
  bookingCount: number;
  utilizationPct: number;
}

/**
 * Anonymized raw booking record from /api/backoffice/reports/export?type=raw.
 * No userId, userDisplayName, or userEmail -- privacy first.
 */
export interface IRawBookingRecord {
  bookingId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  locationName: string;
  /** IANA timezone identifier for the booking's location. */
  locationTimezone: string;
  startTime: string;
  endTime: string;
  status: string;
  durationHours: number;
}

/** KPI summary from /api/backoffice/reports/kpi. */
export interface IKpiSummary {
  utilizationRate: number;
  totalBookings: number;
  activeBookings: number;
  overdueCount: number;
}

/** A direct report's booking from /api/backoffice/team-bookings. */
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

// ---------------------------------------------------------------------------
// Date range presets and utility
// ---------------------------------------------------------------------------

/** Preset date range identifiers for the dashboard date picker. */
export type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'thisQuarter';

/** Computed date range with granularity for trend queries. */
export interface IDateRange {
  from: Date;
  to: Date;
  granularity: 'daily' | 'weekly';
}

/**
 * Compute a date range from a preset identifier.
 *
 * Granularity auto-selects based on range:
 * - last7, last30, thisMonth -> daily
 * - thisQuarter -> weekly
 *
 * All dates are computed in UTC to avoid timezone drift.
 */
export function getDateRange(preset: DatePreset): IDateRange {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

  switch (preset) {
    case 'last7': {
      const from7 = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: from7, to: to, granularity: 'daily' };
    }
    case 'last30': {
      const from30 = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: from30, to: to, granularity: 'daily' };
    }
    case 'thisMonth': {
      const fromMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from: fromMonth, to: to, granularity: 'daily' };
    }
    case 'thisQuarter': {
      const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      const fromQuarter = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1));
      return { from: fromQuarter, to: to, granularity: 'weekly' };
    }
  }
}
