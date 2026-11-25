import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('FIN-003 (#396) — Isolamento de MockFiscalProvider fora do bundle de produção', () => {
  it('should_not_lazy_import_or_route_FiscalPage_in_App', () => {
    const appSource = readSource('App.tsx');

    expect(appSource).not.toContain("./pages/Fiscal");
    expect(appSource).not.toContain('FiscalPage');
  });

  it('should_not_expose_active_fiscal_navigation_in_Sidebar', () => {
    const sidebarSource = readSource('components/Sidebar.tsx');

    expect(sidebarSource).not.toMatch(/^\s*\{\s*name:.*path:\s*['"]\/fiscal['"]/m);
  });
});
