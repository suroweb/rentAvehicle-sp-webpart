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
  status: 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
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
