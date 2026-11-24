import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('UXQ-004 + SEC-003 (#391) Context memoization, pendingRegistration & RouteErrorBoundary', () => {
  it('should_memoize_auth_tenant_loading_and_theme_contexts', () => {
    const authSrc = fs.readFileSync(path.join(ROOT, 'context/AuthContext.tsx'), 'utf8');
    const tenantSrc = fs.readFileSync(path.join(ROOT, 'src/context/TenantContext.tsx'), 'utf8');
    const loadingSrc = fs.readFileSync(path.join(ROOT, 'context/LoadingContext.tsx'), 'utf8');
    const themeSrc = fs.readFileSync(path.join(ROOT, 'context/ThemeContext.tsx'), 'utf8');

    expect(authSrc).toContain('const refreshAccessContext = useCallback(');
    expect(authSrc).toContain('const signOut = useCallback(');
    expect(authSrc).toContain('const authContextValue = useMemo');

    expect(tenantSrc).toContain('const refreshTenant = useCallback(');
    expect(tenantSrc).toContain('[error, loading, memberships, refreshTenant, role, tenant]');

    expect(loadingSrc).toContain('lockedByLoadingRef');
    expect(loadingSrc).toContain('const contextValue = useMemo');

    expect(themeSrc).toContain('const toggleTheme = useCallback(');
    expect(themeSrc).toContain('const contextValue = useMemo');
  });

  it('should_align_pending_registration_and_isolate_outlet_with_error_boundary_and_suspense', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const layoutSrc = fs.readFileSync(path.join(ROOT, 'components/Layout.tsx'), 'utf8');

    expect(appSrc).toContain('Boolean(session.user?.user_metadata?.shop_name) && !tenantId && !tenantError');
    expect(layoutSrc).toContain('<RouteErrorBoundary resetKey={location.pathname}>');
    expect(layoutSrc).toContain('<Suspense');
  });
});
