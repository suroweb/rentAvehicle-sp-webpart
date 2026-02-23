/**
 * Effective role type for RentAVehicle RBAC.
 * Hierarchy: SuperAdmin > Admin > Manager > Employee.
 */
export type AppRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Employee';

/**
 * Parsed user identity from x-ms-client-principal header.
 * Represents the authenticated user's identity and effective role.
 */
export interface UserContext {
  /** User's object ID (oid claim from token) */
  userId: string;
  /** User's display name (name claim) */
  displayName: string;
  /** User's email address (name_typ claim value) */
  email: string;
  /** All role claim values from the token */
  roles: string[];
  /** Highest-privilege role: SuperAdmin > Admin > Manager > Employee */
  effectiveRole: AppRole;
  /** User's office location from Entra ID (for location-scoped access) */
  officeLocation?: string | null;
}
