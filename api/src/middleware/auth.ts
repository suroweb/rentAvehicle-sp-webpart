import { HttpRequest } from '@azure/functions';
import { z } from 'zod';
import { UserContext, AppRole } from '../models/UserContext.js';
import { getGraphClient } from '../services/graphService.js';

/**
 * Zod schema for validating the decoded x-ms-client-principal JSON structure.
 */
const ClientPrincipalClaimSchema = z.object({
  typ: z.string(),
  val: z.string(),
});

const ClientPrincipalSchema = z.object({
  auth_typ: z.string(),
  claims: z.array(ClientPrincipalClaimSchema),
  name_typ: z.string(),
  role_typ: z.string(),
});

type ClientPrincipal = z.infer<typeof ClientPrincipalSchema>;

/**
 * Role hierarchy for determining effective role.
 * Higher number = higher privilege.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  Employee: 0,
  Manager: 1,
  Admin: 2,
  SuperAdmin: 3,
};

/**
 * Determines the effective (highest-privilege) role from a list of roles.
 * Defaults to Employee if no recognized roles are present.
 */
function resolveEffectiveRole(roles: string[]): AppRole {
  if (roles.includes('SuperAdmin')) return 'SuperAdmin';
  if (roles.includes('Admin')) return 'Admin';
  if (roles.includes('Manager')) return 'Manager';
  return 'Employee';
}

/**
 * Parses the Base64-encoded x-ms-client-principal header value into a UserContext.
 *
 * The header is injected by Azure App Service Authentication (Easy Auth) and contains
 * the authenticated user's identity and claims, including app role assignments.
 *
 * @param headerValue - The raw Base64-encoded x-ms-client-principal header value
 * @returns UserContext if parsing succeeds, null if the header is malformed
 */
export function parseClientPrincipal(headerValue: string): UserContext | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    // Validate structure with zod
    const principal: ClientPrincipal = ClientPrincipalSchema.parse(parsed);

    // Helper to get first claim value by type
    const getClaim = (type: string): string =>
      principal.claims.find(c => c.typ === type)?.val ?? '';

    // Extract role claims matching the role_typ field
    const roles = principal.claims
      .filter(c => c.typ === principal.role_typ)
      .map(c => c.val);

    // Extract userId from oid or nameidentifier claim
    const userId =
      getClaim('oid') ||
      getClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier') ||
      '';

    // Extract displayName from name claim
    const displayName = getClaim('name');

    // Extract email from the claim matching name_typ
    const email = getClaim(principal.name_typ);

    return {
      userId,
      displayName,
      email,
      roles,
      effectiveRole: resolveEffectiveRole(roles),
    };
  } catch {
    return null;
  }
}

/**
 * Creates a role-check function that verifies if a user has one of the allowed roles.
 *
 * @param allowedRoles - One or more AppRole values that are permitted
 * @returns A function that takes a UserContext (or null) and returns true if authorized
 */
export function requireRole(...allowedRoles: AppRole[]): (user: UserContext | null) => boolean {
  return (user: UserContext | null): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.effectiveRole);
  };
}

/**
 * Cached Graph user profile for local dev to avoid calling Graph on every request.
 */
let cachedLocalDevUser: UserContext | null = null;
let localDevUserFetched = false;

/**
 * Returns a UserContext for local development when Easy Auth is not available.
 * Only active when LOCAL_DEV environment variable is 'true'.
 *
 * When Graph credentials are configured (AZURE_CLIENT_SECRET set), fetches
 * the real user profile from Entra ID using NOTIFICATION_SENDER_EMAIL.
 * Falls back to env var overrides if Graph lookup fails.
 *
 * Uses environment variables:
 * - NOTIFICATION_SENDER_EMAIL: Email to look up in Graph (primary)
 * - LOCAL_DEV_EMAIL: Fallback email if Graph lookup fails
 * - LOCAL_DEV_NAME: Fallback display name if Graph lookup fails
 * - LOCAL_DEV_ROLE: Role (default: 'Employee')
 */
export async function getLocalDevUser(): Promise<UserContext | null> {
  if (process.env.LOCAL_DEV !== 'true') {
    return null;
  }

  const role = (process.env.LOCAL_DEV_ROLE || 'Employee') as AppRole;
  const validRoles: AppRole[] = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];
  const effectiveRole = validRoles.includes(role) ? role : 'Employee';

  // Try Graph lookup (cached after first call)
  if (!localDevUserFetched && process.env.AZURE_CLIENT_SECRET) {
    localDevUserFetched = true;
    const email = process.env.NOTIFICATION_SENDER_EMAIL || process.env.LOCAL_DEV_EMAIL;
    if (email) {
      try {
        const client = await getGraphClient();
        const user = await client.api(`/users/${email}`)
          .select('id,displayName,mail,userPrincipalName,officeLocation')
          .get();
        cachedLocalDevUser = {
          userId: user.id,
          displayName: user.displayName || email,
          email: user.mail || user.userPrincipalName || email,
          roles: [effectiveRole],
          effectiveRole,
          officeLocation: user.officeLocation || null,
        };
        console.log(`  Local dev user from Graph: ${cachedLocalDevUser.displayName} (${cachedLocalDevUser.email})`);
      } catch (err) {
        console.warn('  Could not fetch user from Graph, using env var fallback:', (err as Error).message);
      }
    }
  }

  if (cachedLocalDevUser) {
    // Apply current role (may change via --role flag between restarts)
    return { ...cachedLocalDevUser, roles: [effectiveRole], effectiveRole };
  }

  return {
    userId: 'local-dev-user-id',
    displayName: process.env.LOCAL_DEV_NAME || 'Local Dev User',
    email: process.env.LOCAL_DEV_EMAIL || 'dev@localhost',
    roles: [effectiveRole],
    effectiveRole,
    officeLocation: process.env.LOCAL_DEV_OFFICE_LOCATION || null,
  };
}

/**
 * Extracts user identity from an HTTP request.
 *
 * First checks for the x-ms-client-principal header (set by Easy Auth in production).
 * If the header is missing and LOCAL_DEV is enabled, falls back to Graph user lookup.
 *
 * @param request - The Azure Functions HttpRequest
 * @returns UserContext if authenticated, null if not
 */
export async function getUserFromRequest(request: HttpRequest): Promise<UserContext | null> {
  const principalHeader = request.headers.get('x-ms-client-principal');

  if (principalHeader) {
    return parseClientPrincipal(principalHeader);
  }

  // Fall back to local dev user (Graph lookup or env var fallback)
  return getLocalDevUser();
}
