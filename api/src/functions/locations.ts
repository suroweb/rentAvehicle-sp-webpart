/**
 * HTTP endpoints for location list and sync.
 *
 * 2 endpoints registered under backoffice/locations:
 * - GET  backoffice/locations       (list locations with vehicle counts, lazy-sync)
 * - POST backoffice/locations/sync  (manual sync trigger, SuperAdmin only)
 *
 * GET endpoint triggers lazy-sync (ensureLocationsSynced) to auto-sync
 * locations on first access or when stale (>24h).
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  getLocationsWithVehicleCounts,
  ensureLocationsSynced,
  syncLocations,
} from '../services/locationService.js';
import { getDistinctOfficeLocations } from '../services/graphService.js';

const isAdminOrSuperAdmin = requireRole('Admin', 'SuperAdmin');
const isSuperAdmin = requireRole('SuperAdmin');

/**
 * GET /api/backoffice/locations
 * List locations with vehicle counts.
 * Triggers lazy-sync (ensureLocationsSynced) before returning data.
 * Requires Admin or SuperAdmin role.
 */
async function listLocations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAdminOrSuperAdmin(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    // Lazy-sync: auto-sync if locations have never been synced or are stale (>24h)
    await ensureLocationsSynced();

    const locations = await getLocationsWithVehicleCounts();
    return { jsonBody: locations };
  } catch (error) {
    context.error('listLocations failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * POST /api/backoffice/locations/sync
 * Manual sync trigger for SuperAdmin only.
 * Fetches distinct officeLocation values from Graph API and syncs to database.
 * Returns sync result (added, deactivated, total).
 */
async function syncLocationsTrigger(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isSuperAdmin(user)) {
      return {
        status: 403,
        jsonBody: { error: 'SuperAdmin role required' },
      };
    }

    const officeLocations = await getDistinctOfficeLocations();
    const result = await syncLocations(officeLocations);
    return {
      jsonBody: {
        message: 'Sync complete',
        added: result.added,
        deactivated: result.deactivated,
        total: result.total,
      },
    };
  } catch (error) {
    context.error('syncLocationsTrigger failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Location sync failed' },
    };
  }
}

/**
 * GET /api/locations
 * Public read-only endpoint for all authenticated users.
 * Returns active locations with vehicle counts (no lazy-sync trigger).
 */
async function listLocationsPublic(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const locations = await getLocationsWithVehicleCounts();
    const active = locations.filter((l: { isActive: boolean }) => l.isActive);
    return { jsonBody: active };
  } catch (error) {
    context.error('listLocationsPublic failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register location endpoints
app.http('listLocationsPublic', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'locations',
  handler: listLocationsPublic,
});

app.http('listLocations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/locations',
  handler: listLocations,
});

app.http('syncLocations', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/locations/sync',
  handler: syncLocationsTrigger,
});
