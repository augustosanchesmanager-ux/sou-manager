import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FIN-004 (#402) — Alinhamento de [functions.import-export] em supabase/config.toml', () => {
  it('should_declare_import_export_function_with_verify_jwt_true_in_config_toml', () => {
    const configToml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

    expect(configToml).toContain('[functions.import-export]');
    expect(configToml).toMatch(/\[functions\.import-export\][\s\S]*?verify_jwt\s*=\s*true/);
  });
});
