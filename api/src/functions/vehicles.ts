/**
 * HTTP endpoints for vehicle management.
 *
 * 6 endpoints registered under backoffice/vehicles:
 * - GET    backoffice/vehicles           (list with filters, location-scoped for Admin)
 * - GET    backoffice/vehicles/{id}      (get single vehicle)
 * - POST   backoffice/vehicles           (create vehicle)
 * - PUT    backoffice/vehicles/{id}      (update vehicle)
 * - DELETE backoffice/vehicles/{id}      (soft delete / archive)
 * - PATCH  backoffice/vehicles/{id}/status (change status)
 *
 * All endpoints require Admin or SuperAdmin role.
 * Admin users are location-scoped: they only see vehicles at their officeLocation.
 * SuperAdmin users can view/manage vehicles at any location.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  resolveLocationIdForAdmin,
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  archiveVehicle,
  updateVehicleStatus,
  updateVehicleMailbox,
} from '../services/vehicleService.js';
import { VehicleInputSchema, VehicleStatusSchema, VehicleMailboxSchema } from '../models/Vehicle.js';

const isAuthorized = requireRole('Admin', 'SuperAdmin');

/**
 * GET /api/backoffice/vehicles
 * List vehicles with optional query filters: status, categoryId, search, locationId (SuperAdmin only).
 * Admin users are auto-filtered to their officeLocation -- no query param override accepted.
 */
async function listVehicles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      categoryId?: number;
      search?: string;
    } = {
      status: request.query.get('status') || undefined,
      categoryId: request.query.get('categoryId')
        ? parseInt(request.query.get('categoryId')!, 10)
        : undefined,
      search: request.query.get('search') || undefined,
    };

    // Location scoping: Admin sees only their location's vehicles
    if (user.effectiveRole === 'Admin') {
      if (!user.officeLocation) {
        return {
          status: 403,
          jsonBody: {
            error:
              'Your office location is not configured or not synced. Contact a Super Admin.',
          },
        };
      }
      const locationId = await resolveLocationIdForAdmin(user.officeLocation);
      if (locationId === null) {
        return {
          status: 403,
          jsonBody: {
            error:
              'Your office location is not configured or not synced. Contact a Super Admin.',
          },
        };
      }
      filters.locationId = locationId;
    } else {
      // SuperAdmin can optionally filter by locationId
      const locationIdParam = request.query.get('locationId');
      if (locationIdParam) {
        filters.locationId = parseInt(locationIdParam, 10);
      }
    }

    const vehicles = await getVehicles(filters);
    return { jsonBody: vehicles };
  } catch (error) {
    context.error('listVehicles failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/backoffice/vehicles/{id}
 * Get a single vehicle by ID. Returns 404 if not found.
 */
async function getVehicle(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: vehicle };
  } catch (error) {
    context.error('getVehicle failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * POST /api/backoffice/vehicles
 * Create a new vehicle. Validates body with VehicleInputSchema.
 * Returns 201 with the new vehicle's ID.
 */
async function addVehicle(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const body = await request.json();
    const parsed = VehicleInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const id = await createVehicle(parsed.data, user.email);
    return { status: 201, jsonBody: { id } };
  } catch (error) {
    context.error('addVehicle failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PUT /api/backoffice/vehicles/{id}
 * Update an existing vehicle. Validates body with VehicleInputSchema.
 * Returns 200 on success, 404 if not found.
 */
async function editVehicle(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const body = await request.json();
    const parsed = VehicleInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const updated = await updateVehicle(id, parsed.data, user.email);
    if (!updated) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('editVehicle failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * DELETE /api/backoffice/vehicles/{id}
 * Soft delete (archive) a vehicle. Sets isArchived=1 instead of deleting.
 * Returns 200 on success, 404 if not found.
 */
async function removeVehicle(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const archived = await archiveVehicle(id, user.email);
    if (!archived) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('removeVehicle failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PATCH /api/backoffice/vehicles/{id}/status
 * Change a vehicle's status. Validates body with VehicleStatusSchema.
 * Does not allow status change on archived vehicles.
 * Returns 200 on success, 404 if not found.
 */
async function changeVehicleStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const body = await request.json();
    const parsed = VehicleStatusSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const updated = await updateVehicleStatus(id, parsed.data.status, user.email);
    if (!updated) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('changeVehicleStatus failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PATCH /api/backoffice/vehicles/{id}/mailbox
 * Set a vehicle's resource mailbox email after Exchange provisioning.
 * Requires Admin or SuperAdmin role.
 * Returns 200 on success, 404 if not found.
 */
async function setVehicleMailbox(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
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
      return { status: 400, jsonBody: { error: 'Invalid vehicle ID' } };
    }

    const body = await request.json();
    const parsed = VehicleMailboxSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const updated = await updateVehicleMailbox(id, parsed.data.resourceMailboxEmail);
    if (!updated) {
      return { status: 404, jsonBody: { error: 'Vehicle not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('setVehicleMailbox failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register all 7 vehicle endpoints
app.http('listVehicles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles',
  handler: listVehicles,
});

app.http('getVehicle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles/{id}',
  handler: getVehicle,
});

app.http('addVehicle', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles',
  handler: addVehicle,
});

app.http('editVehicle', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles/{id}',
  handler: editVehicle,
});

app.http('removeVehicle', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles/{id}',
  handler: removeVehicle,
});

app.http('changeVehicleStatus', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles/{id}/status',
  handler: changeVehicleStatus,
});

app.http('setVehicleMailbox', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'backoffice/vehicles/{id}/mailbox',
  handler: setVehicleMailbox,
});
