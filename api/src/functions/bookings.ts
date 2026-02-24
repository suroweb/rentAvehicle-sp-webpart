/**
 * HTTP endpoints for employee-facing booking operations.
 *
 * 9 endpoints registered:
 * - GET    vehicles/available           (browse available vehicles with filters)
 * - GET    vehicles/{id}/detail         (vehicle detail with joins)
 * - GET    vehicles/{id}/availability   (7-day availability slots)
 * - GET    vehicles/timeline            (calendar timeline for location + day)
 * - POST   bookings                     (create booking, 409 includes suggestions)
 * - GET    bookings/my                  (list user's bookings, all statuses)
 * - DELETE bookings/{id}               (cancel own booking)
 * - PATCH  bookings/{id}/checkout       (check out vehicle)
 * - PATCH  bookings/{id}/return         (return vehicle)
 *
 * All endpoints require authentication (Employee minimum role).
 * No role check needed beyond authentication -- all authenticated users can use these.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest } from '../middleware/auth.js';
import {
  getAvailableVehicles,
  getVehicleDetail,
  getVehicleAvailability,
  createBooking,
  getMyBookings,
  cancelBooking,
  checkOutBooking,
  checkInBooking,
  getLocationTimeline,
  getBookingSuggestions,
} from '../services/bookingService.js';
import { BookingInputSchema } from '../models/Booking.js';

/**
 * GET /api/vehicles/available
 * Browse available vehicles filtered by location, date/time range, and optional category.
 * Query params: locationId (required), startTime (required), endTime (required), categoryId (optional)
 */
async function browseAvailableVehicles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const locationIdParam = request.query.get('locationId');
    const startTimeParam = request.query.get('startTime');
    const endTimeParam = request.query.get('endTime');
    const categoryIdParam = request.query.get('categoryId');

    if (!locationIdParam || !startTimeParam || !endTimeParam) {
      return {
        status: 400,
        jsonBody: {
          error: 'locationId, startTime, and endTime query parameters are required',
        },
      };
    }

    const locationId = parseInt(locationIdParam, 10);
    if (isNaN(locationId)) {
      return { status: 400, jsonBody: { error: 'Invalid locationId' } };
    }

    const startTime = new Date(startTimeParam);
    const endTime = new Date(endTimeParam);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid startTime or endTime (must be ISO 8601)' },
      };
    }

    const categoryId = categoryIdParam
      ? parseInt(categoryIdParam, 10)
      : undefined;

    const vehicles = await getAvailableVehicles(
      locationId,
      startTime,
      endTime,
      categoryId
    );
    return { jsonBody: vehicles };
  } catch (error) {
    context.error('browseAvailableVehicles failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/vehicles/{id}/detail
 * Get a single vehicle by ID with category/location joins.
 * Employee-facing: returns non-archived vehicles regardless of status.
 */
async function getVehicleDetailEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const vehicle = await getVehicleDetail(id);
    if (!vehicle) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: vehicle };
  } catch (error) {
    context.error('getVehicleDetailEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/vehicles/{id}/availability
 * Get booked time slots for a vehicle over the next N days.
 * Query params: days (optional, default 7)
 */
async function getVehicleAvailabilityEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const daysParam = request.query.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    const slots = await getVehicleAvailability(id, days);
    return { jsonBody: slots };
  } catch (error) {
    context.error('getVehicleAvailabilityEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * POST /api/bookings
 * Create a new booking. Validates body with BookingInputSchema.
 * Returns 409 Conflict if the time slot is already booked.
 */
async function createBookingEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const body = await request.json();
    const parsed = BookingInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const startTimeDate = new Date(parsed.data.startTime);
    const endTimeDate = new Date(parsed.data.endTime);

    const result = await createBooking(
      parsed.data.vehicleId,
      user.userId,
      user.email,
      user.displayName,
      startTimeDate,
      endTimeDate
    );

    if ('conflict' in result) {
      // Get the vehicle's locationId for suggestions query
      const vehicle = await getVehicleDetail(parsed.data.vehicleId);
      const locationId = vehicle ? vehicle.locationId : 0;

      let suggestions: unknown[] = [];
      if (locationId > 0) {
        suggestions = await getBookingSuggestions(
          parsed.data.vehicleId,
          locationId,
          startTimeDate,
          endTimeDate
        );
      }

      return {
        status: 409,
        jsonBody: {
          error: 'This slot was just booked by someone else',
          suggestions,
        },
      };
    }

    return { status: 201, jsonBody: { id: result.id } };
  } catch (error) {
    context.error('createBookingEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/bookings/my
 * List the authenticated user's non-cancelled bookings.
 */
async function getMyBookingsEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const bookings = await getMyBookings(user.userId);
    return { jsonBody: bookings };
  } catch (error) {
    context.error('getMyBookingsEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * DELETE /api/bookings/{id}
 * Cancel an upcoming booking. Only the booking owner can cancel.
 * Cannot cancel bookings that have already started.
 */
async function cancelBookingEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid booking ID' } };
    }

    const result = await cancelBooking(id, user.userId);

    switch (result) {
      case 'cancelled':
        return { jsonBody: { success: true } };
      case 'not_found':
        return { status: 404, jsonBody: { error: 'Booking not found' } };
      case 'not_yours':
        return {
          status: 403,
          jsonBody: { error: 'You can only cancel your own bookings' },
        };
      case 'already_past':
        return {
          status: 400,
          jsonBody: {
            error: 'Cannot cancel a booking that has already started',
          },
        };
    }
  } catch (error) {
    context.error('cancelBookingEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PATCH /api/bookings/{id}/checkout
 * Check out a vehicle for a confirmed booking.
 * Available 30 minutes before the scheduled start time.
 * Transitions booking from Confirmed to Active.
 */
async function checkOutBookingEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid booking ID' } };
    }

    const result = await checkOutBooking(id, user.userId);

    switch (result) {
      case 'checked_out':
        return { jsonBody: { success: true } };
      case 'not_found':
        return { status: 404, jsonBody: { error: 'Booking not found' } };
      case 'not_yours':
        return {
          status: 403,
          jsonBody: { error: 'You can only check out your own bookings' },
        };
      case 'too_early':
        return {
          status: 422,
          jsonBody: {
            error: 'Check out available 30 minutes before start time',
          },
        };
      case 'expired':
        return {
          status: 410,
          jsonBody: {
            error: 'Booking expired (no checkout within 1 hour)',
          },
        };
      case 'wrong_status':
        return {
          status: 409,
          jsonBody: {
            error: 'Booking is not in a valid state for checkout',
          },
        };
    }
  } catch (error) {
    context.error('checkOutBookingEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PATCH /api/bookings/{id}/return
 * Return (check in) a vehicle for an active or overdue booking.
 * Transitions booking from Active/Overdue to Completed.
 */
async function checkInBookingEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid booking ID' } };
    }

    const result = await checkInBooking(id, user.userId);

    switch (result) {
      case 'checked_in':
        return { jsonBody: { success: true } };
      case 'not_found':
        return { status: 404, jsonBody: { error: 'Booking not found' } };
      case 'not_yours':
        return {
          status: 403,
          jsonBody: { error: 'You can only return your own bookings' },
        };
      case 'wrong_status':
        return {
          status: 409,
          jsonBody: {
            error: 'Booking is not in a valid state for return',
          },
        };
    }
  } catch (error) {
    context.error('checkInBookingEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/vehicles/timeline?locationId=N&date=YYYY-MM-DD
 * Get calendar timeline data (vehicles + bookings) for a location on a given day.
 */
async function getTimelineEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const locationIdParam = request.query.get('locationId');
    const dateParam = request.query.get('date');

    if (!locationIdParam || !dateParam) {
      return {
        status: 400,
        jsonBody: {
          error: 'locationId and date query parameters are required',
        },
      };
    }

    const locationId = parseInt(locationIdParam, 10);
    if (isNaN(locationId)) {
      return { status: 400, jsonBody: { error: 'Invalid locationId' } };
    }

    // Validate date format YYYY-MM-DD
    const dateMatch = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format (expected YYYY-MM-DD)' },
      };
    }

    // Compute day boundaries in UTC
    const dayStart = new Date(dateParam + 'T00:00:00.000Z');
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    if (isNaN(dayStart.getTime())) {
      return { status: 400, jsonBody: { error: 'Invalid date' } };
    }

    const timeline = await getLocationTimeline(locationId, dayStart, dayEnd);
    return { jsonBody: timeline };
  } catch (error) {
    context.error('getTimelineEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register all 9 employee-facing booking endpoints
app.http('browseAvailableVehicles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicles/available',
  handler: browseAvailableVehicles,
});

app.http('getVehicleDetailEndpoint', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicles/{id}/detail',
  handler: getVehicleDetailEndpoint,
});

app.http('getVehicleAvailabilityEndpoint', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicles/{id}/availability',
  handler: getVehicleAvailabilityEndpoint,
});

app.http('createBookingEndpoint', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bookings',
  handler: createBookingEndpoint,
});

app.http('getMyBookingsEndpoint', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bookings/my',
  handler: getMyBookingsEndpoint,
});

app.http('cancelBookingEndpoint', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'bookings/{id}',
  handler: cancelBookingEndpoint,
});

app.http('checkOutBookingEndpoint', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'bookings/{id}/checkout',
  handler: checkOutBookingEndpoint,
});

app.http('checkInBookingEndpoint', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'bookings/{id}/return',
  handler: checkInBookingEndpoint,
});

app.http('getTimelineEndpoint', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicles/timeline',
  handler: getTimelineEndpoint,
});
