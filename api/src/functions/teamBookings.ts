/**
 * HTTP endpoint for manager team bookings view.
 *
 * 1 endpoint:
 * - GET backoffice/team-bookings (manager's direct reports' current/upcoming bookings)
 *
 * Requires Manager, Admin, or SuperAdmin role.
 * Resolves direct reports via Graph API, then queries their bookings from the database.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  getDirectReportIds,
  getTeamBookings,
} from '../services/reportingService.js';

const isManagerOrHigher = requireRole('Manager', 'Admin', 'SuperAdmin');

/**
 * GET /api/backoffice/team-bookings
 * Returns current and upcoming bookings for the authenticated manager's direct reports.
 * Uses Graph API /users/{userId}/directReports to resolve the team.
 * Returns empty array if the manager has no direct reports.
 */
async function getTeamBookingsEndpoint(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isManagerOrHigher(user)) {
      return { status: 403, jsonBody: { error: 'Manager, Admin, or SuperAdmin role required' } };
    }

    const directReportIds = await getDirectReportIds(user.userId);
    const bookings = await getTeamBookings(directReportIds);
    return { jsonBody: bookings };
  } catch (error) {
    context.error('getTeamBookingsEndpoint failed:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

// Register manager team bookings endpoint
app.http('getTeamBookings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/team-bookings',
  handler: getTeamBookingsEndpoint,
});
