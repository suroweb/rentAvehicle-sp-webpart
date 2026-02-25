import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest } from '../middleware/auth.js';

/**
 * GET /api/me - Authenticated user identity endpoint.
 * Returns the current user's identity and effective role.
 * Returns 401 if no authentication is present.
 */
export async function me(
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

  return {
    jsonBody: {
      userId: user.userId,
      displayName: user.displayName,
      email: user.email,
      role: user.effectiveRole,
      officeLocation: user.officeLocation || null,
    },
  };
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: me,
});
