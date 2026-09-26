/**
 * Config vitest dedicada ao harness de homologação H2-8 (execução sob demanda).
 *
 * Motivo: vite.config.ts exclui tests/homologation/** do escaneamento (commit
 * e89da5a, 2026-09-09 — regularização CI). Este config existe para que o
 * harness canônico seja executável sob demanda.
 *
 * CI atual inalterado: vite.config.ts permanece intocado e nenhum workflow
 * passa a rodar este config — o harness só executa por invocação explícita.
 *
 * USO: npx vitest run --config vitest.h2-8.config.ts tests/homologation/h2-8/h2-8-staging-chain.spec.ts
 */
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/homologation/**/*.spec.ts'],
    exclude: ['node_modules/**', '.opencode/**', 'tests/e2e/**'],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
