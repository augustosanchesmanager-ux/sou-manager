import Login from '@/pages/Login';
import Register from '@/pages/Register';
import RegisterSuccess from '@/pages/RegisterSuccess';
import ResetPassword from '@/pages/ResetPassword';
import PendingApproval from '@/pages/PendingApproval';
import type { AppStandaloneRouteDefinition } from './types';

const definePlatformPublicRoute = (
  path: string,
  feature: string,
  element: AppStandaloneRouteDefinition['element'],
): AppStandaloneRouteDefinition => ({
  path,
  feature,
  ownership: 'shared-entry',
  element,
});

export const platformPublicRoutes: readonly AppStandaloneRouteDefinition[] = [
  definePlatformPublicRoute('/login', 'Login', <Login />),
  definePlatformPublicRoute('/register', 'Register', <Register />),
  definePlatformPublicRoute('/register-success', 'Register Success', <RegisterSuccess />),
  definePlatformPublicRoute('/reset-password', 'Reset Password', <ResetPassword />),
  definePlatformPublicRoute('/pending-approval', 'Pending Approval', <PendingApproval />),
] as const;
