import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('GTM-003 (#386) cleanup simulated /automations module', () => {
  it('should_remove_simulated_automations_files_from_repository', () => {
    expect(fs.existsSync(path.join(ROOT, 'pages/Automations.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'services/automationHubService.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/types/automations.ts'))).toBe(false);
  });

  it('should_have_no_automations_route_or_sidebar_entry_in_production_routing', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const sidebarSource = fs.readFileSync(path.join(ROOT, 'components/Sidebar.tsx'), 'utf8');

    expect(appSource).not.toContain('./pages/Automations');
    expect(appSource).not.toContain('/automations');
    expect(sidebarSource).not.toContain('/automations');
    expect(sidebarSource).not.toContain('Central de Automações');
  });
});
