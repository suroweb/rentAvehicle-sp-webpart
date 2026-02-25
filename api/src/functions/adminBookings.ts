/**
 * HTTP endpoints for admin booking management.
 *
 * 2 endpoints registered under backoffice/bookings:
 * - GET    backoffice/bookings           (list all bookings with filters)
 * - DELETE backoffice/bookings/{id}      (admin cancel with required reason)
 *
 * All endpoints require Admin or SuperAdmin role.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  getAllBookings,
  adminCancelBooking,
} from '../services/bookingService.js';
import { AdminCancelInputSchema } from '../models/Booking.js';
import sql from 'mssql';
import { syncBookingToCalendars } from '../services/calendarService.js';
import { sendTeamsActivityNotification } from '../services/notificationService.js';
import { getPool } from '../services/database.js';

const isAuthorized = requireRole('Admin', 'SuperAdmin');

/**
 * GET /api/backoffice/bookings
 * List all bookings with optional filters: locationId, status, dateFrom, dateTo, employeeSearch.
 */
async function listAllBookings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const filters: {
      locationId?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
      employeeSearch?: string;
    } = {};

    const locationIdParam = request.query.get('locationId');
    if (locationIdParam) {
      const locationId = parseInt(locationIdParam, 10);
      if (!isNaN(locationId)) {
        filters.locationId = locationId;
      }
    }

    const statusParam = request.query.get('status');
    if (statusParam) {
      filters.status = statusParam;
    }

    const dateFromParam = request.query.get('dateFrom');
    if (dateFromParam) {
      const dateFrom = new Date(dateFromParam);
      if (!isNaN(dateFrom.getTime())) {
        filters.dateFrom = dateFrom;
      }
    }

    const dateToParam = request.query.get('dateTo');
    if (dateToParam) {
      const dateTo = new Date(dateToParam);
      if (!isNaN(dateTo.getTime())) {
        filters.dateTo = dateTo;
      }
    }

    const employeeSearchParam = request.query.get('employeeSearch');
    if (employeeSearchParam) {
      filters.employeeSearch = employeeSearchParam;
    }

    const bookings = await getAllBookings(filters);
    return { jsonBody: bookings };
  } catch (error) {
    context.error('listAllBookings failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * DELETE /api/backoffice/bookings/{id}
 * Admin cancel a booking with a required reason.
 * Works on Confirmed, Active, and Overdue bookings.
 */
async function adminCancelBookingEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid booking ID' } };
    }

    const body = await request.json();
    const parsed = AdminCancelInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const result = await adminCancelBooking(
      id,
      user.userId,
      parsed.data.cancelReason
    );

    switch (result) {
      case 'cancelled':
        syncBookingToCalendars(id, 'cancelled', parsed.data.cancelReason).catch((error) => {
          context.error('Calendar sync failed for admin-cancelled booking', id, error);
        });

        // Fire-and-forget: notify affected employee of admin cancellation
        (async () => {
          try {
            const pool = await getPool();
            const bookingResult = await pool.request()
              .input('bookingId', sql.Int, id)
              .query('SELECT userId, userEmail, userDisplayName FROM Bookings WHERE id = @bookingId');
            if (bookingResult.recordset.length > 0) {
              const affected = bookingResult.recordset[0];
              await sendTeamsActivityNotification(
                affected.userId,
                'bookingCancelled',
                `Your booking has been cancelled by an administrator. Reason: ${parsed.data.cancelReason}`,
                id
              );
            }
          } catch (error) {
            context.error('Admin cancel notification failed for booking', id, error);
          }
        })();

        return { jsonBody: { success: true } };
      case 'not_found':
        return { status: 404, jsonBody: { error: 'Booking not found' } };
      case 'already_done':
        return {
          status: 409,
          jsonBody: {
            error: 'Booking is already completed or cancelled',
          },
        };
    }
  } catch (error) {
    context.error('adminCancelBookingEndpoint failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register admin booking endpoints
app.http('listAllBookings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/bookings',
  handler: listAllBookings,
});

app.http('adminCancelBookingEndpoint', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'backoffice/bookings/{id}',
  handler: adminCancelBookingEndpoint,
});
