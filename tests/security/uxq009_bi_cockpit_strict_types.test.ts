import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('UXQ-009 (#399) — Tipagem estrita em biCockpitService (zero any)', () => {
  it('should_have_zero_explicit_any_in_biCockpitService', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/bi/biCockpitService.ts'), 'utf8');

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/\bas\s+any\b/);
  });
});
