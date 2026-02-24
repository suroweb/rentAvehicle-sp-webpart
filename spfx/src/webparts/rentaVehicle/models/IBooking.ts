/**
 * Full booking record as returned from the API (with joined vehicle/location/user fields).
 * Used by getMyBookings and booking detail displays.
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
  checkedOutAt?: string;
  checkedInAt?: string;
  cancelReason?: string;
}

/**
 * Vehicle with location/category joins for availability search results.
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
 * Input payload for creating a new booking.
 * Times must be ISO 8601 UTC strings with hourly precision (minutes = 0).
 */
export interface IBookingInput {
  vehicleId: number;
  startTime: string;
  endTime: string;
}

/**
 * A suggestion returned by the API on 409 booking conflict.
 * Either a time shift (same vehicle, different time) or an alternative vehicle (same time, different vehicle).
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
 * A booking entry for the day-view calendar timeline.
 * Includes own-booking detection for color coding.
 */
export interface ITimelineBooking {
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
  isOwnBooking: boolean;
}

/**
 * Timeline data for a location on a given date.
 * Contains vehicles at the location and their bookings for the day.
 */
export interface ITimelineData {
  vehicles: IAvailableVehicle[];
  bookings: ITimelineBooking[];
}

/**
 * Structured conflict response from postWithConflict on 409.
 */
export interface IConflictResponse {
  conflict: true;
  message: string;
  suggestions: IBookingSuggestion[];
}
