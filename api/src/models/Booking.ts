import { z } from 'zod';

/**
 * Zod validation schema for booking creation input.
 *
 * Validates:
 * - vehicleId: positive integer
 * - startTime: ISO 8601 datetime string
 * - endTime: ISO 8601 datetime string, must be after startTime
 * - Hourly precision: both start and end must have minutes === 0
 */
export const BookingInputSchema = z
  .object({
    vehicleId: z.number().int().positive(),
    startTime: z.string().datetime({ message: 'startTime must be a valid ISO 8601 datetime' }),
    endTime: z.string().datetime({ message: 'endTime must be a valid ISO 8601 datetime' }),
  })
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'endTime must be after startTime', path: ['endTime'] }
  )
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return start.getUTCMinutes() === 0 && end.getUTCMinutes() === 0;
    },
    { message: 'Bookings must be on the hour (minutes must be 0)', path: ['startTime'] }
  );

/** Inferred type from BookingInputSchema */
export type BookingInput = z.infer<typeof BookingInputSchema>;

/**
 * Full booking record as returned from the database (with joined vehicle/location fields).
 * Used by getMyBookings and other booking queries that need display-ready data.
 */
export interface IBooking {
  id: number;
  vehicleId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  vehicleCategoryName: string;
  vehicleCapacity: number;
  vehiclePhotoUrl: string | null;
  locationId: number;
  locationName: string;
  locationTimezone: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  startTime: string;
  endTime: string;
  status: 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'Overdue';
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  checkedOutAt: string | null;
  checkedInAt: string | null;
  cancelReason: string | null;
}

/**
 * Vehicle with location/category joins for the availability search results.
 * Includes locationTimezone for display conversion on the frontend.
 */
export interface IAvailableVehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  locationId: number;
  locationName: string;
  locationTimezone: string;
  categoryId: number;
  categoryName: string;
  capacity: number;
  photoUrl: string | null;
  status: string;
}

/**
 * A booked time slot for the 7-day availability strip on the vehicle detail page.
 * Represents an existing confirmed/active booking that blocks the time range.
 */
export interface IVehicleAvailabilitySlot {
  startTime: string;
  endTime: string;
  status: string;
}

/**
 * A booking slot for the calendar timeline day-view.
 * Represents one booking block on the timeline grid.
 */
export interface ITimelineSlot {
  bookingId: number;
  vehicleId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  startTime: string;
  endTime: string;
  status: string;
  userId: string;
  userDisplayName: string | null;
}

/**
 * A suggestion returned when a booking attempt conflicts (409).
 * Can be a time shift (same vehicle, different time) or an alternative vehicle.
 */
export interface IBookingSuggestion {
  type: 'time_shift' | 'alt_vehicle';
  vehicleId: number;
  vehicleName: string;
  startTime: string;
  endTime: string;
  label: string;
}

/**
 * Zod validation schema for admin cancel input.
 * Requires a non-empty reason string (max 500 chars).
 */
export const AdminCancelInputSchema = z.object({
  cancelReason: z.string().min(1).max(500).trim(),
});
