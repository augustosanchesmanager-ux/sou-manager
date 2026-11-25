import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UXQ-006 (#394) & SEC-005 (#395): CI Governance, Biome Root Lint, and Pre-Attribution Deploy Gate', () => {
  it('should_mark_ADR_024_as_Accepted', () => {
    const adr024 = readFileSync(resolve(process.cwd(), 'docs/adr/ADR-024-ci-workflow-regularization.md'), 'utf8');

    expect(adr024).toContain('**Status:** Accepted');
    expect(adr024).not.toContain('**Status:** Proposed');
  });

  it('should_align_biome_schema_to_installed_version_and_expose_root_lint_scripts', () => {
    const biomeConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'biome.json'), 'utf8')) as {
      $schema?: string;
    };
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(biomeConfig.$schema).toContain('/2.6.8/schema.json');
    expect(pkg.scripts?.lint).toContain('biome check src/');
    expect(pkg.scripts?.['lint:root']).toContain('pages/');
    expect(pkg.scripts?.['lint:root']).toContain('domain/');
    expect(pkg.scripts?.['lint:root']).toContain('application/');
    expect(pkg.scripts?.['lint:changed']).toContain('--changed');
    expect(pkg.scripts?.['lint:changed']).toContain('--since=origin/main');
  });

  it('should_run_incremental_lint_in_ci_workflow_for_pull_requests', () => {
    const ciWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

    expect(ciWorkflow).toContain('fetch-depth: 0');
    expect(ciWorkflow).toContain('npm run lint');
    expect(ciWorkflow).toContain('npm run lint:changed');
  });

  it('should_enforce_pre_validate_before_promote_in_deploy_production_workflow', () => {
    const deployWorkflow = readFileSync(
      resolve(process.cwd(), '.github/workflows/deploy-production.yml'),
      'utf8'
    );

    expect(deployWorkflow).toContain('pre-validate:');
    expect(deployWorkflow).toContain('needs: [resolve-validate, pre-validate]');
  });
});
