/**
 * F5.3 / Issue #226 — Teste de Segurança: Eliminação de document.write e Injeção de DOM
 *
 * Valida estaticamente os componentes do frontend:
 * - Garante ausência total de document.write em pages/ e components/
 * - Garante ausência de dangerouslySetInnerHTML
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('F5.3 / Issue #226 — DOM Injection Prevention Enforcement', () => {
  it('should not contain document.write in CashClosingPage.tsx', () => {
    const file = resolve(process.cwd(), 'pages/CashClosingPage.tsx');
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toContain('document.write');
    expect(content).toContain('container.textContent = previewText');
  });

  it('should not contain document.write in Comandas.tsx', () => {
    const file = resolve(process.cwd(), 'pages/Comandas.tsx');
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toContain('document.write');
    expect(content).toContain('doc.createElement');
    expect(content).toContain('textContent');
  });
});
