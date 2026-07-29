#!/usr/bin/env node
/**
 * [SMG] Architecture Guard — Forbidden Imports
 *
 * Checks layer boundary violations:
 * - Components must not import from domain/repositories
 * - Components must not import from src/lib/supabase
 * - Domain must not import from components/pages
 * - Domain must not import React
 *
 * Usage: node scripts/architecture/guard-imports.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const IGNORE_DIRS = [
  "node_modules", "dist", ".codex", ".codex-release-barber",
  ".codex-clean-access", "tests", "scripts",
];

const RULES = [
  {
    name: "Components → Domain Repos",
    from: /^(components|src\/components|src\/modules)\//,
    to: /domain\/.*\/repository/,
    severity: "error",
  },
  {
    name: "Components → Supabase",
    from: /^(components|src\/components|src\/modules)\//,
    to: /src\/lib\/supabase/,
    severity: "error",
  },
  {
    name: "Domain → UI",
    from: /^domain\//,
    to: /^(components|pages|src\/components|src\/modules)\//,
    severity: "error",
  },
  {
    name: "Domain → React",
    from: /^domain\//,
    to: /^react$/,
    severity: "error",
  },
];

function getAllFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (IGNORE_DIRS.includes(entry)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.[ts|tsx]$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImports(content) {
  const imports = [];
  const importRegex =
    /(?:import\s+(?:type\s+)?(?:{[^}]+}|[^\s;]+)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"])/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1] || match[2]);
  }
  return imports;
}

const files = getAllFiles(ROOT);
const violations = [];

for (const file of files) {
  const relPath = relative(ROOT, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf-8");
  const imports = extractImports(content);

  for (const imp of imports) {
    for (const rule of RULES) {
      if (rule.from.test(relPath) && rule.to.test(imp)) {
        violations.push({
          rule: rule.name,
          severity: rule.severity,
          file: relPath,
          import: imp,
        });
      }
    }
  }
}

const errors = violations.filter((v) => v.severity === "error");
const warnings = violations.filter((v) => v.severity === "warn");

if (warnings.length > 0) {
  console.log("\n⚠️  Forbidden Imports — Warnings:\n");
  for (const v of warnings) {
    console.log(`  [${v.rule}] ${v.file} → ${v.import}`);
  }
}

if (errors.length > 0) {
  console.error("\n❌ Forbidden Imports — Errors:\n");
  for (const v of errors) {
    console.error(`  [${v.rule}] ${v.file} → ${v.import}`);
  }
  console.error(
    `\nTotal: ${errors.length} error(s), ${warnings.length} warning(s).\n`
  );
  process.exit(1);
} else {
  console.log(
    `✅ Forbidden Imports: 0 errors, ${warnings.length} warning(s)`
  );
  process.exit(0);
}
