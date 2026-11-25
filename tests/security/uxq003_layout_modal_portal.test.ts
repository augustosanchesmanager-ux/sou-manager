import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('UXQ-003 (#393) — Layout, Modal ref-count, Portals e z-index', () => {
  it('should_reference_count_modal_open_in_Modal_for_nested_dialogs', () => {
    const source = readSource('components/ui/Modal.tsx');

    expect(source).toContain('let openModalCount = 0');
    expect(source).toContain('openModalCount += 1');
    expect(source).toContain('openModalCount = Math.max(0, openModalCount - 1)');
    expect(source).toContain('if (openModalCount === 0)');
  });

  it('should_render_AuditDrawer_in_portal_with_Escape_handler', () => {
    const source = readSource('components/superadmin/AuditDrawer.tsx');

    expect(source).toContain("import { createPortal } from 'react-dom'");
    expect(source).toContain('createPortal(');
    expect(source).toContain('document.body');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('role="dialog"');
  });

  it('should_render_CommandPalette_in_portal_above_standard_modals', () => {
    const source = readSource('components/CommandPalette.tsx');

    expect(source).toContain("import { createPortal } from 'react-dom'");
    expect(source).toContain('createPortal(');
    expect(source).toContain('z-[110]');
    expect(source).toContain('document.body');
  });

  it('should_not_render_duplicate_Sidebar_inside_PortalAdmin_or_KioskAdmin', () => {
    const portalSource = readSource('pages/portal/PortalAdmin.tsx');
    const kioskSource = readSource('pages/KioskAdmin.tsx');

    expect(portalSource).not.toContain("from '../../components/Sidebar'");
    expect(portalSource).not.toContain('<Sidebar');
    expect(kioskSource).not.toContain("from '../components/Sidebar'");
    expect(kioskSource).not.toContain('<Sidebar');
  });

  it('should_keep_Layout_header_at_z30_above_page_sticky_content', () => {
    const layoutSource = readSource('components/Layout.tsx');
    expect(layoutSource).toContain('sticky top-0 z-30');
  });
});
