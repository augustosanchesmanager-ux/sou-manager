import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('UXQ-009 (#399) — Tipagem estrita em useBusinessInsights (zero any)', () => {
  it('should_have_zero_explicit_any_in_useBusinessInsights', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/hooks/useBusinessInsights.ts'), 'utf8');

    expect(source).not.toMatch(/:\s*any\b/);
    expect(source).not.toMatch(/\bas\s+any\b/);
    expect(source).not.toMatch(/<any>/);
  });
});
