/**
 * Admin endpoints for calendar provisioning status and backfill migration.
 *
 * 2 endpoints registered under backoffice/calendar:
 * - GET  backoffice/calendar/status   (provisioning status dashboard)
 * - POST backoffice/calendar/backfill (backfill calendar events for existing bookings)
 *
 * The status endpoint requires Admin or SuperAdmin role.
 * The backfill endpoint requires SuperAdmin role (bulk/destructive operation).
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import sql from 'mssql';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import { getPool } from '../services/database.js';
import { syncBookingToCalendars } from '../services/calendarService.js';

const isAdminOrAbove = requireRole('Admin', 'SuperAdmin');
const isSuperAdmin = requireRole('SuperAdmin');

/**
 * GET /api/backoffice/calendar/status
 * Returns provisioning status for all non-archived vehicles.
 * Shows which vehicles have a resource mailbox email configured and which do not.
 */
async function provisioningStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdminOrAbove(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        v.id, v.make, v.model, v.licensePlate, v.resourceMailboxEmail,
        l.name AS locationName
      FROM Vehicles v
      JOIN Locations l ON v.locationId = l.id
      WHERE v.isArchived = 0
      ORDER BY l.name, v.make, v.model
    `);

    const vehicles = result.recordset;
    const provisioned = vehicles.filter(
      (v: { resourceMailboxEmail: string | null }) => v.resourceMailboxEmail != null
    ).length;

    return {
      jsonBody: {
        total: vehicles.length,
        provisioned,
        unprovisioned: vehicles.length - provisioned,
        vehicles,
      },
    };
  } catch (error) {
    context.error('provisioningStatus failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * POST /api/backoffice/calendar/backfill
 * Backfills calendar events for existing bookings that are missing calendar event IDs.
 *
 * Only processes bookings with status IN ('Confirmed', 'Active', 'Overdue') that have
 * no vehicleCalendarEventId AND no employeeCalendarEventId (i.e., bookings created
 * before calendar integration was wired in).
 *
 * Processes in batches of 10 with 2-second delays between batches to respect
 * Graph API rate limits.
 *
 * Requires SuperAdmin role (bulk/destructive operation).
 */
async function backfillCalendarEvents(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isSuperAdmin(user)) {
      return {
        status: 403,
        jsonBody: { error: 'SuperAdmin role required' },
      };
    }

    const pool = await getPool();

    // Find bookings that have no calendar events and are in an active state
    const result = await pool.request().query(`
      SELECT id
      FROM Bookings
      WHERE vehicleCalendarEventId IS NULL
        AND employeeCalendarEventId IS NULL
        AND status IN ('Confirmed', 'Active', 'Overdue')
      ORDER BY id
    `);

    const bookingIds: number[] = result.recordset.map(
      (row: { id: number }) => row.id
    );
    const total = bookingIds.length;
    let synced = 0;
    let failed = 0;
    const errors: Array<{ bookingId: number; error: string }> = [];

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < bookingIds.length; i += batchSize) {
      const batch = bookingIds.slice(i, i + batchSize);

      context.log(`Backfill progress: ${i}/${total}`);

      for (const bookingId of batch) {
        try {
          await syncBookingToCalendars(bookingId, 'created');
          synced++;
        } catch (err) {
          failed++;
          errors.push({
            bookingId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // 2-second delay between batches to respect Graph API rate limits
      if (i + batchSize < bookingIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    context.log(`Backfill complete: ${synced}/${total} synced, ${failed} failed`);

    return {
      jsonBody: {
        total,
        synced,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    context.error('backfillCalendarEvents failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register calendar admin endpoints
app.http('provisioningStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/calendar/status',
  handler: provisioningStatus,
});

app.http('backfillCalendarEvents', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/calendar/backfill',
  handler: backfillCalendarEvents,
});
