import * as React from 'react';
import { AppRole, hasMinRole } from '../../models/IUser';
import { useAuth } from '../../contexts/AuthContext';

export interface IRoleGuardProps {
  minRole: AppRole;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<IRoleGuardProps> = ({ minRole, children }) => {
  const { user } = useAuth();

  if (!user || !hasMinRole(user.role, minRole)) {
    return null;
  }

  return <>{children}</>;
};
