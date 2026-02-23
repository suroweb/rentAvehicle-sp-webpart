export type AppRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Employee';

export interface IUser {
  userId: string;
  displayName: string;
  email: string;
  role: AppRole;
}

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  Employee: 0,
  Manager: 1,
  Admin: 2,
  SuperAdmin: 3,
};

export function hasMinRole(userRole: AppRole, minRole: AppRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}
