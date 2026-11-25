import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('UXQ-010 (#400) — Limpeza de arquivos órfãos e mocks mortos', () => {
  it('should_keep_removed_orphan_pages_components_and_mocks_deleted', () => {
    const removed = [
      'pages/Financial.tsx',
      'components/OnboardingChecklist.tsx',
      'components/common/ExportActionsDropdown.tsx',
      'components/financial/mockData.ts',
      'components/superadmin/mockData.ts',
    ];

    for (const relPath of removed) {
      expect(existsSync(resolve(process.cwd(), relPath))).toBe(false);
    }
  });
});
