import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('UXQ-005 (#392) Operations.tsx bugfixes & ADR-001/030 label alignment', () => {
  it('should_use_minimum_stock_case_insensitive_roles_and_closed_comandas_in_operations', () => {
    const opsSrc = fs.readFileSync(path.join(ROOT, 'pages/Operations.tsx'), 'utf8');

    expect(opsSrc).not.toContain("s.role === 'Barber' || s.role === 'Manager'");
    expect(opsSrc).not.toContain('p.stock_quantity <= 5');
    expect(opsSrc).toContain('Number(p.minimum_stock)');
    expect(opsSrc).toContain("item.status === 'paid' || item.status === 'closed'");
  });

  it('should_align_payroll_label_between_sidebar_and_command_palette', () => {
    const sidebarSrc = fs.readFileSync(path.join(ROOT, 'components/Sidebar.tsx'), 'utf8');
    const paletteSrc = fs.readFileSync(path.join(ROOT, 'components/CommandPalette.tsx'), 'utf8');

    expect(sidebarSrc).toContain("name: 'Repasse de Comissões'");
    expect(paletteSrc).toContain("title: 'Repasse de Comissões'");
  });
});
