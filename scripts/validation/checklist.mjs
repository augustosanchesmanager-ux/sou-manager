#!/usr/bin/env node
/**
 * Master Verification Runner - SMG Platform (Node.js Native)
 * =========================================================
 * Replaces legacy python scripts with strict, zero-false-pass verification.
 * 
 * Gates (aligned with ADR-022 and AGENTS.md):
 *   1. Typecheck (tsc --noEmit) [BLOCKING]
 *   2. Architecture Guard (scripts/architecture/check.mjs) [BLOCKING]
 *   3. Core Unit Tests (vitest) [BLOCKING]
 *   4. Secrets Audit (strict zero-credential scan) [BLOCKING]
 *   5. Migration Security (RLS disable / bypass detection) [BLOCKING]
 *   6. Linter & Syntax (biome check src/) [ADVISORY as per ADR-022]
 * 
 * Exit Code:
 *   0 = ALL blocking checks passed
 *   1 = ANY blocking check failed (STRICT FAIL-FAST POLICY)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import process from 'node:process';

const ROOT_DIR = resolve('.');
const IS_WINDOWS = process.platform === 'win32';

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function logHeader(text) {
  console.log(`\n${colors.bold}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
}

function logStep(text) {
  console.log(`${colors.bold}${colors.blue}▶ ${text}${colors.reset}`);
}

function logPass(text) {
  console.log(`${colors.green}✔ PASS:${colors.reset} ${text}`);
}

function logWarn(text, details = '') {
  console.log(`${colors.yellow}⚠ WARN (ADVISORY):${colors.reset} ${text}`);
  if (details) {
    console.log(`${colors.yellow}${details.slice(0, 500)}${colors.reset}`);
  }
}

function logFail(text, details = '') {
  console.error(`${colors.red}✖ FAIL:${colors.reset} ${text}`);
  if (details) {
    console.error(`${colors.yellow}${details.slice(0, 1000)}${colors.reset}`);
  }
}

function runCommand(name, cmd, args = [], isBlocking = true) {
  logStep(`Running ${name}...`);
  const fullCmd = IS_WINDOWS && (cmd === 'npm' || cmd === 'npx') ? `${cmd}.cmd` : cmd;
  const result = spawnSync(fullCmd, args, {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    shell: IS_WINDOWS,
    stdio: 'pipe',
  });

  if (result.status === 0) {
    logPass(name);
    return { passed: true, blocking: isBlocking };
  } else {
    const errorMsg = (result.stderr || result.stdout || 'Command failed with exit code ' + result.status).trim();
    if (isBlocking) {
      logFail(name, errorMsg);
      return { passed: false, blocking: true, error: errorMsg };
    } else {
      logWarn(`${name} reported issues (Advisory Gate)`, errorMsg);
      return { passed: true, blocking: false, advisoryWarning: true };
    }
  }
}

/**
 * Audit tracked and local files for accidental secrets
 */
function auditSecrets() {
  logStep('Auditing for Hardcoded Secrets...');

  const SECRET_PATTERNS = [
    { name: 'Private Key', regex: /-----BEGIN\s+(RSA|EC|OPENSSH|PRIVATE)\s+KEY-----/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'AWS Secret Key', regex: /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["'][A-Za-z0-9/+=]{40}["']/i },
    { name: 'Hardcoded Bearer Token', regex: /bearer\s+eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/i },
    { name: 'Supabase Service Role Key (Hardcoded)', regex: /service_role\s*[:=]\s*["']eyJ[A-Za-z0-9-_]+/i },
  ];

  const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'coverage', '.turbo', '.next', 'test-results', 'playwright-report'
  ]);

  const IGNORED_FILES = new Set([
    'package-lock.json', 'pnpm-lock.yaml', 'checklist.mjs'
  ]);

  const findings = [];

  function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue;
        const ext = extname(entry.name).toLowerCase();
        if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.env', '.sql'].includes(ext)) {
          continue;
        }

        try {
          const content = readFileSync(fullPath, 'utf-8');
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(content)) {
              findings.push({ file: fullPath, pattern: pattern.name });
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  scanDir(ROOT_DIR);

  if (findings.length > 0) {
    logFail('Secrets Audit found dangerous patterns in source code:');
    for (const f of findings) {
      console.error(`  - [${f.pattern}] in ${f.file}`);
    }
    return { passed: false, blocking: true };
  }

  logPass('Secrets Audit (0 hardcoded credentials detected)');
  return { passed: true, blocking: true };
}

/**
 * Audit database migrations for RLS disable or unsafe security regressions
 */
function auditDatabaseMigrations() {
  logStep('Auditing Supabase PostgreSQL Migrations for RLS Safety...');

  const migrationsDir = join(ROOT_DIR, 'supabase', 'migrations');
  if (!existsSync(migrationsDir)) {
    logPass('No migrations directory found. Skipping migration audit.');
    return { passed: true, blocking: true };
  }

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const issues = [];

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check for explicit DISABLE ROW LEVEL SECURITY (Critical multi-tenant violation)
    if (/ALTER\s+TABLE\s+[\s\S]*?\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(content)) {
      issues.push({ file, issue: 'Explicit DISABLE ROW LEVEL SECURITY detected' });
    }

    // Check for DROP POLICY without re-creation or migration safety note
    if (/DROP\s+POLICY\s+/i.test(content) && !/CREATE\s+POLICY\s+/i.test(content)) {
      // Allowed only if explicitly documented as security fix or drop legacy
      if (!file.includes('drop_legacy') && !file.includes('security_fix')) {
        issues.push({ file, issue: 'DROP POLICY without re-creation or documented security waiver' });
      }
    }
  }

  if (issues.length > 0) {
    logFail('Migration Audit found critical security violations:');
    for (const iss of issues) {
      console.error(`  - ${iss.file}: ${iss.issue}`);
    }
    return { passed: false, blocking: true };
  }

  logPass(`Migration Security Audit (${files.length} SQL migrations inspected, no RLS disable/regressions)`);
  return { passed: true, blocking: true };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  logHeader('SMG PLATFORM - MASTER VERIFICATION RUNNER');

  const results = [];

  // Phase 1: Typecheck [BLOCKING]
  results.push({ name: 'Typecheck (tsc)', ...runCommand('Typecheck', 'npx', ['tsc', '--noEmit'], true) });

  // Phase 2: Architecture CI Guard [BLOCKING]
  results.push({ name: 'Architecture Guard', ...runCommand('Architecture Guard', 'node', ['scripts/architecture/check.mjs', '--ci', '--baseline'], true) });

  // Phase 3: Core Unit Tests [BLOCKING]
  results.push({ name: 'Unit Tests', ...runCommand('Unit Tests', 'npx', ['vitest', 'run', 'application/appointment/comandaSync.test.ts'], true) });

  // Phase 4: Secrets Audit [BLOCKING]
  results.push({ name: 'Secrets Audit', ...auditSecrets() });

  // Phase 5: Migration Security Audit [BLOCKING]
  results.push({ name: 'Migration Security', ...auditDatabaseMigrations() });

  // Phase 6: Linter [ADVISORY - ADR-022]
  results.push({ name: 'Linter (biome)', ...runCommand('Linter', 'npx', ['biome', 'check', 'src/', '--no-errors-on-unmatched'], false) });

  // Summary
  logHeader('VERIFICATION SUMMARY');

  let failedBlockingCount = 0;
  for (const r of results) {
    if (r.passed && !r.advisoryWarning) {
      console.log(`  ${colors.green}✔ PASS:${colors.reset} ${r.name}`);
    } else if (r.advisoryWarning) {
      console.log(`  ${colors.yellow}⚠ WARN:${colors.reset} ${r.name} (Advisory - non-blocking)`);
    } else {
      console.log(`  ${colors.red}✖ FAIL:${colors.reset} ${r.name} (Blocking)`);
      failedBlockingCount++;
    }
  }

  console.log(`\nTotal Checks: ${results.length}`);
  console.log(`Blocking Failures: ${failedBlockingCount}`);

  if (failedBlockingCount > 0) {
    console.error(`\n${colors.bold}${colors.red}VERIFICATION FAILED: ${failedBlockingCount} blocking gate(s) did not satisfy quality standards.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}ALL BLOCKING GATES PASSED (Exit Code: 0)${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
