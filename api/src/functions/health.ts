import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';

/**
 * GET /api/health - Public health check endpoint.
 * No authentication required. Returns service status and timestamp.
 */
export async function health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  return {
    jsonBody: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: health,
});

/**
 * GET /api/backoffice/health - Admin-only health check endpoint.
 * Requires Admin role. Returns 401 if not authenticated, 403 if not Admin.
 *
 * Note: Route uses 'backoffice' instead of 'admin' because Azure Functions
 * reserves the '/admin' route prefix for built-in management APIs.
 */
export async function adminHealth(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return {
      status: 401,
      jsonBody: { error: 'Not authenticated' },
    };
  }

  if (!requireRole('Admin')(user)) {
    return {
      status: 403,
      jsonBody: { error: 'Forbidden: Admin role required' },
    };
  }

  return {
    jsonBody: {
      status: 'healthy',
      role: user.effectiveRole,
      timestamp: new Date().toISOString(),
    },
  };
}

app.http('healthAdmin', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/health',
  handler: adminHealth,
});
