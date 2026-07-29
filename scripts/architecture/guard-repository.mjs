#!/usr/bin/env node
/**
 * [SMG] Architecture Guard — Repository Guard
 *
 * Checks that no .from('table') calls exist in UI layers.
 * Infrastructure layers (domain, src/lib, services, context, src/modules) are allowed.
 *
 * Usage: node scripts/architecture/guard-repository.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const IGNORE_DIRS = [
  "node_modules", "dist", ".codex", ".codex-release-barber",
  ".codex-clean-access", "tests", "scripts", "supabase",
];

// Layers where .from() is a VIOLATION (UI layer)
const VIOLATION_PATHS = ["application/", "components/", "hooks/", "pages/"];
// Layers where .from() is ALLOWED (infrastructure)
const ALLOWED_PATHS = [
  "domain/", "src/lib/", "services/", "context/",
  "src/context/", "src/hooks/", "src/modules/",
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

const files = getAllFiles(ROOT);
const violations = [];

for (const file of files) {
  const relPath = relative(ROOT, file).replace(/\\/g, "/");

  // Skip infrastructure layers
  if (ALLOWED_PATHS.some((p) => relPath.startsWith(p))) continue;
  // Only check UI layers
  if (!VIOLATION_PATHS.some((p) => relPath.startsWith(p))) continue;

  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\.from\s*\(['"`]/.test(line) && !/Array\.from/.test(line)) {
      violations.push({
        file: relPath,
        line: i + 1,
        content: line.trim().substring(0, 80),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("\n❌ Repository Guard: .from() calls found in UI layers\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.content}\n`);
  }
  console.error(
    `Total: ${violations.length} violation(s). UI layers must use Repositories.\n`
  );
  process.exit(1);
} else {
  console.log("✅ Repository Guard: No .from() in UI layers");
  process.exit(0);
}
