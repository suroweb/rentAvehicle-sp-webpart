import { HttpRequest } from '@azure/functions';
import { z } from 'zod';
import { UserContext, AppRole } from '../models/UserContext.js';

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
 * Returns a UserContext for local development from LOCAL_DEV_* environment variables.
 * Only active when LOCAL_DEV=true.
 *
 * Uses environment variables:
 * - LOCAL_DEV_NAME: Display name (default: 'Local Dev User')
 * - LOCAL_DEV_EMAIL: Email address (default: 'dev@localhost')
 * - LOCAL_DEV_ROLE: Role (default: 'Employee')
 * - LOCAL_DEV_OFFICE_LOCATION: Office location (optional)
 */
export async function getLocalDevUser(): Promise<UserContext | null> {
  if (process.env.LOCAL_DEV !== 'true') {
    return null;
  }

  const role = (process.env.LOCAL_DEV_ROLE || 'Employee') as AppRole;
  const validRoles: AppRole[] = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];
  const effectiveRole = validRoles.includes(role) ? role : 'Employee';
  const displayName = process.env.LOCAL_DEV_NAME || 'Local Dev User';
  const email = process.env.LOCAL_DEV_EMAIL || 'dev@localhost';

  console.log(`  Local dev user: ${displayName} (${email}) [${effectiveRole}]`);

  return {
    userId: 'local-dev-user-id',
    displayName,
    email,
    roles: [effectiveRole],
    effectiveRole,
    officeLocation: process.env.LOCAL_DEV_OFFICE_LOCATION || null,
  };
}

/**
 * Extracts user identity from an HTTP request.
 *
 * First checks for the x-ms-client-principal header (set by Easy Auth in production).
 * If the header is missing and LOCAL_DEV is enabled, falls back to env var identity.
 *
 * @param request - The Azure Functions HttpRequest
 * @returns UserContext if authenticated, null if not
 */
export async function getUserFromRequest(request: HttpRequest): Promise<UserContext | null> {
  const principalHeader = request.headers.get('x-ms-client-principal');

  if (principalHeader) {
    return parseClientPrincipal(principalHeader);
  }

  // Fall back to local dev user (env var identity)
  return getLocalDevUser();
}
