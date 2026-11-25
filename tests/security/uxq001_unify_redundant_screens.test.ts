import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('UXQ-001 (#389) — Unificação de telas redundantes e descontinuação do Portal Legado', () => {
  it('should_redirect_strategic_dashboard_and_legacy_portal_routes_in_App', () => {
    const appSource = readSource('App.tsx');

    expect(appSource).not.toContain("./pages/StrategicDashboard");
    expect(appSource).not.toContain("./pages/portal/PortalAdmin");
    expect(appSource).not.toContain("./pages/portal/PortalLanding");
    expect(appSource).not.toContain("./pages/portal/PortalLogin");
    expect(appSource).not.toContain("./pages/portal/PortalApp");
    expect(appSource).not.toContain("./pages/portal/PortalSchedule");
    expect(appSource).toContain('<Route path="/strategic-dashboard" element={<ManagerRoute><Navigate to="/bi" replace /></ManagerRoute>} />');
    expect(appSource).toContain('<Route path="/portal-admin" element={<ModuleRoute moduleName="portal"><ManagerRoute><Navigate to="/booking-settings" replace /></ManagerRoute></ModuleRoute>} />');
    expect(appSource).toContain('<Route path="/c/:tenantSlug" element={<BookingSlugRedirect />} />');
  });

  it('should_not_duplicate_strategic_dashboard_in_Sidebar_or_PaymentTerminalsSection_in_Settings', () => {
    const sidebarSource = readSource('components/Sidebar.tsx');
    const settingsSource = readSource('pages/Settings.tsx');

    expect(sidebarSource).not.toContain("path: '/strategic-dashboard'");
    expect(settingsSource).not.toContain('<PaymentTerminalsSection');
    expect(settingsSource).toContain('#/payment-terminals');
  });
});
