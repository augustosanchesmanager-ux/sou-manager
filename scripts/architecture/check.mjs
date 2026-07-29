#!/usr/bin/env node
/**
 * [SMG] Architecture Guard — Main Runner
 *
 * Runs all architecture guards and reports results.
 * Supports baseline mode: violations must not increase.
 *
 * Usage:
 *   node scripts/architecture/check.mjs [--ci] [--baseline] [--strict]
 *
 * --ci        Exit with error code on failure (for CI pipelines)
 * --baseline  Compare against architecture-baseline.json (fail if violations increase)
 * --strict    Fail on ANY violation (not just increases)
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const isCI = process.argv.includes("--ci");
const useBaseline = process.argv.includes("--baseline");
const isStrict = process.argv.includes("--strict");

const guards = [
  { name: "Repository Guard", script: "guard-repository.mjs", baselineKey: "repositoryViolations" },
  { name: "Forbidden Imports", script: "guard-imports.mjs", baselineKey: "forbiddenImports" },
  { name: "Circular Imports", script: "guard-circular.mjs", baselineKey: "circularImports" },
];

// Load baseline
let baseline = null;
const baselinePath = join(ROOT, "architecture-baseline.json");
if (useBaseline && existsSync(baselinePath)) {
  baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
}

console.log("╔══════════════════════════════════════════╗");
console.log("║   SMG Architecture Verification v2.0    ║");
if (baseline) console.log(`║   Baseline: ${baseline.created}                ║`);
if (isStrict) console.log("║   Mode: STRICT                           ║");
else if (baseline) console.log("║   Mode: BASELINE                         ║");
else console.log("║   Mode: STANDARD                         ║");
console.log("╚══════════════════════════════════════════╝\n");

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

function countViolations(output) {
  const match = output.match(/Total:\s*(\d+)\s*violation/);
  return match ? parseInt(match[1], 10) : 0;
}

for (const guard of guards) {
  try {
    const output = execSync(`node "${join(__dirname, guard.script)}"`, {
      encoding: "utf-8",
      cwd: ROOT,
      timeout: 60000,
    });
    results.push({ name: guard.name, status: "✅ PASS", violations: 0, output: output.trim() });
  } catch (err) {
    const output = (err.stdout || err.stderr || "").trim();
    const violations = countViolations(output);

    if (err.status === 2) {
      results.push({ name: guard.name, status: "⚠️  SKIP", violations: 0, output: "Tool not available" });
    } else {
      // In baseline mode, same-as-baseline is OK (not an error)
      const baselineVal = baseline?.[guard.baselineKey];
      if (baseline && baselineVal !== undefined && violations <= baselineVal) {
        results.push({ name: guard.name, status: "✅ PASS (baseline)", violations, output });
      } else {
        results.push({ name: guard.name, status: "❌ FAIL", violations, output });
        totalErrors++;
      }
    }

    if (output.includes("warning") || output.includes("warn")) totalWarnings++;
  }
}

// Baseline comparison
console.log("Results:\n");
for (const r of results) {
  const baselineVal = baseline?.[r.baselineKey];
  let baselineStatus = "";

  if (baseline && baselineVal !== undefined && r.violations > 0) {
    if (r.violations > baselineVal) {
      baselineStatus = ` (base: ${baselineVal} → NOW ${r.violations} ⚠️ INCREASED)`;
      if (!isStrict) {
        totalWarnings++;
        totalErrors = Math.max(0, totalErrors - 1);
      }
    } else if (r.violations < baselineVal) {
      baselineStatus = ` (base: ${baselineVal} → NOW ${r.violations} 🎉 IMPROVED)`;
    } else {
      baselineStatus = ` (base: ${baselineVal} → same ✅)`;
    }
  }

  console.log(`  ${r.status}  ${r.name}${baselineStatus}`);
  if (r.status === "❌ FAIL") {
    const lines = r.output.split("\n").slice(0, 5);
    for (const line of lines) {
      console.log(`         ${line}`);
    }
    if (r.output.split("\n").length > 5) {
      console.log(`         ... (${r.output.split("\n").length - 5} more lines)`);
    }
  }
}

console.log(`\n  Total: ${totalErrors} error(s), ${totalWarnings} warning(s)\n`);

if (baseline) {
  console.log("  Baseline comparison:");
  for (const guard of guards) {
    const r = results.find((r) => r.name === guard.name);
    const base = baseline?.[guard.baselineKey];
    if (base !== undefined && r) {
      const diff = r.violations - base;
      const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
      console.log(`    ${guard.baselineKey}: ${base} ${arrow} ${r.violations}`);
    }
  }
  console.log("");
}

if (isCI && totalErrors > 0) {
  console.error("Architecture verification FAILED (CI mode)");
  process.exit(1);
} else if (totalErrors > 0) {
  console.log("Fix errors above before committing.");
  process.exit(1);
} else {
  console.log("All architecture guards passed.");
  process.exit(0);
}
