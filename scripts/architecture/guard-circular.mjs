#!/usr/bin/env node
/**
 * [SMG] Architecture Guard — Circular Imports
 *
 * Uses madge to detect circular dependencies.
 * Usage: node scripts/architecture/guard-circular.mjs
 */
import { execSync } from "child_process";

try {
  const output = execSync("npx madge --circular --extensions ts,tsx .", {
    encoding: "utf-8",
    cwd: process.cwd(),
    timeout: 60000,
  });

  if (output.includes("✔ No circular dependencies found")) {
    console.log("✅ Circular Imports: No cycles found");
    process.exit(0);
  } else if (output.includes("Found") && output.includes("circular")) {
    console.error("\n❌ Circular Imports detected:\n");
    console.error(output);
    process.exit(1);
  } else {
    console.log("✅ Circular Imports: No cycles found");
    process.exit(0);
  }
} catch (err) {
  const stdout = err.stdout || "";
  const stderr = err.stderr || "";

  if (stdout.includes("circular") || stderr.includes("circular")) {
    console.error("\n❌ Circular Imports detected:\n");
    console.error(stdout || stderr);
    process.exit(1);
  }

  // madge exits with code 1 when cycles found
  if (err.status === 1 && stdout) {
    console.error("\n❌ Circular Imports detected:\n");
    console.error(stdout);
    process.exit(1);
  }

  console.error("⚠️  Circular Imports: madge error —", stderr || stdout);
  process.exit(2);
}
