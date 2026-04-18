import type { FC, ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { AppModuleSlug } from '@/src/lib/supabase/schemas';
import type { LayoutRouteGuard } from './types';

export const ManagerRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const { accessRole } = useAuth();

  if (accessRole === 'barber' || accessRole === 'receptionist') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const SuperAdminRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const { canAccessSuperAdmin } = useAuth();

  if (!canAccessSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const TenantEnabledModuleRoute: FC<{ moduleSlug: AppModuleSlug; children: ReactNode }> = ({
  moduleSlug,
  children,
}) => {
  const { isModuleEnabledForTenant } = useAuth();

  if (!isModuleEnabledForTenant(moduleSlug)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const renderGuardedLayoutElement = (
  element: ReactElement,
  guard: LayoutRouteGuard,
  moduleSlug?: AppModuleSlug,
): ReactElement => {
  const moduleGuardedElement = moduleSlug
    ? <TenantEnabledModuleRoute moduleSlug={moduleSlug}>{element}</TenantEnabledModuleRoute>
    : element;

  switch (guard) {
    case 'manager':
      return <ManagerRoute>{moduleGuardedElement}</ManagerRoute>;
    case 'superadmin':
      return <SuperAdminRoute>{moduleGuardedElement}</SuperAdminRoute>;
    default:
      return moduleGuardedElement;
  }
};
