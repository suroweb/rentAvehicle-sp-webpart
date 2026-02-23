/**
 * Effective role type for RentAVehicle RBAC.
 * Hierarchy: Admin > Manager > Employee.
 */
export type AppRole = 'Admin' | 'Manager' | 'Employee';

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
  /** Highest-privilege role: Admin > Manager > Employee */
  effectiveRole: AppRole;
}
