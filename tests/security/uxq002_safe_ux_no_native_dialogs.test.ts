import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const collectTsxFiles = (dir: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
};

describe('UXQ-002 (#390) — UX segura sem alert()/confirm() nativos e sem falso sucesso em Team', () => {
  it('should_have_zero_native_alert_or_confirm_calls_in_pages_and_components', () => {
    const dirs = [resolve(process.cwd(), 'pages'), resolve(process.cwd(), 'components')];
    const offending: string[] = [];
    const nativeDialogPattern = /\b(?:window\.)?(?:alert|confirm)\s*\(/;

    for (const dir of dirs) {
      for (const file of collectTsxFiles(dir)) {
        if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
        const content = readFileSync(file, 'utf8');
        if (nativeDialogPattern.test(content)) {
          offending.push(file);
        }
      }
    }

    expect(offending).toEqual([]);
  });

  it('should_provide_reusable_ConfirmDialog_built_on_Modal_without_banned_colors', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/ui/ConfirmDialog.tsx'), 'utf8');

    expect(source).toContain("import Modal from './Modal'");
    expect(source).toContain("import Button from './Button'");
    expect(source).not.toMatch(/\b(text|bg|border)-(purple|violet|indigo)-\d+/);
  });

  it('should_not_emit_false_success_toast_when_supplementary_staff_update_fails_in_Team', () => {
    const source = readFileSync(resolve(process.cwd(), 'pages/Team.tsx'), 'utf8');

    expect(source).toContain('não foi possível salvar telefone/comissão');
  });
});
