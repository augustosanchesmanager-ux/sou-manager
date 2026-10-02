#!/usr/bin/env node
/**
 * [SMG] Architecture Guard — Main Runner
 *
 * FAIL-CLOSED (HARDENING-01).
 *
 * Invariants:
 *  1. Um guard que termina com exit != 0 NUNCA pode ser convertido em "0 violações".
 *     Se a contagem não puder ser obtida com segurança, o resultado é FATAL.
 *  2. Regressão acima do baseline é sempre bloqueante — inclusive no modo CI.
 *     Não existe atenuação de erro para warning.
 *  3. Cada guard tem o SEU parser. Não há regex genérica compartilhada: uma
 *     contagem só é aceita se o formato de saída daquele guard for reconhecido.
 *  4. exit 0 é o único caminho que produz PASS sem pasar por parser.
 *
 * Usage:
 *   node scripts/architecture/check.mjs [--ci] [--baseline] [--strict]
 *
 * --ci        Apenas rotula a execução como pipeline (o gate já é fail-closed)
 * --baseline  Compara contra architecture-baseline.json (falha se violações AUMENTAREM)
 * --strict    Falha em QUALQUER violação, mesmo dentro do baseline
 */
import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const isCI = process.argv.includes("--ci");
const useBaseline = process.argv.includes("--baseline");
const isStrict = process.argv.includes("--strict");

const BASELINE_FILE = "architecture-baseline.json";
const GUARD_TIMEOUT_MS = 120000;
const GUARD_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Erro de parsing: significa "não sei quantas violações existem".
 * Nunca é convertido em 0 — sempre escala para FATAL.
 */
class UnparsableGuardOutput extends Error {}

const guards = [
  {
    name: "Repository Guard",
    script: "guard-repository.mjs",
    baselineKey: "repositoryViolations",
    parse(output) {
      // O guard emite summary-first: "Total: 227 violation(s). ..." pode estar
      // no topo OU no rodapé. O flag `m` casa em qualquer linha.
      const m = /Total:[ \t]*(\d+)[ \t]+violation\(s\)/.exec(output);
      if (!m) {
        throw new UnparsableGuardOutput(
          "esperado 'Total: <n> violation(s)' (guard-repository.mjs)",
        );
      }
      return Number(m[1]);
    },
  },
  {
    name: "Forbidden Imports",
    script: "guard-imports.mjs",
    baselineKey: "forbiddenImports",
    parse(output) {
      // guard-imports.mjs:112 -> "Total: 1 error(s), 0 warning(s)."
      const m = /^[ \t]*Total:[ \t]*(\d+)[ \t]+error\(s\)/m.exec(output);
      if (!m) {
        throw new UnparsableGuardOutput(
          "esperado 'Total: <n> error(s), <n> warning(s)' (guard-imports.mjs)",
        );
      }
      return Number(m[1]);
    },
  },
  {
    name: "Circular Imports",
    script: "guard-circular.mjs",
    baselineKey: "circularImports",
    parse(output) {
      // madge -> "× Found 1 circular dependency!" / "× Found 3 circular dependencies!"
      const matches = [
        ...output.matchAll(/Found[ \t]+(\d+)[ \t]+circular[ \t]+dependenc/g),
      ];
      if (matches.length === 0) {
        throw new UnparsableGuardOutput(
          "esperado 'Found <n> circular dependency/dependencies' (madge)",
        );
      }
      return Number(matches[0][1]);
    },
  },
];

// Load baseline
let baseline = null;
let baselineMissing = false;
const baselinePath = join(ROOT, BASELINE_FILE);
if (useBaseline) {
  if (existsSync(baselinePath)) {
    try {
      baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    } catch (err) {
      console.error(`\nFATAL: ${BASELINE_FILE} ilegível — ${err.message}`);
      process.exit(1);
    }
  } else {
    baselineMissing = true;
  }
}

console.log("╔══════════════════════════════════════════╗");
console.log("║   SMG Architecture Verification v2.0    ║");
if (baseline) console.log(`║   Baseline: ${baseline.created}                ║`);
if (isStrict) console.log("║   Mode: STRICT                           ║");
else if (useBaseline) console.log("║   Mode: BASELINE (fail-closed)            ║");
else console.log("║   Mode: STANDARD                         ║");
console.log("╚══════════════════════════════════════════╝\n");

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

/** stdout e stderr são concatenados: guards escrevem violações em stderr. */
const combinedOutput = (r) => `${r.stdout || ""}\n${r.stderr || ""}`.trim();

function truncate(text, maxLines = 5) {
  const lines = String(text).split("\n");
  return {
    head: lines.slice(0, maxLines),
    hidden: Math.max(0, lines.length - maxLines),
  };
}

for (const guard of guards) {
  const scriptPath = join(__dirname, guard.script);
  let stdout = "";
  let stderr = "";
  let status = null;
  let signal = null;
  let thrown = null;

  try {
    // --ci é repassado ao guard para que ele emita o total primeiro e trunque
    // o dump detalhado: um guard que despeja centenas de linhas estoura o pipe
    // do runner e o total nunca chega ao parser.
    stdout = execFileSync(process.execPath, [scriptPath, ...(isCI ? ["--ci"] : [])], {
      encoding: "utf-8",
      cwd: ROOT,
      timeout: GUARD_TIMEOUT_MS,
      maxBuffer: GUARD_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Exit 0: único caminho PASS sem parser (invariant 4).
    results.push({
      name: guard.name,
      status: "✅ PASS",
      violations: 0,
      output: combinedOutput({ stdout, stderr }),
    });
    continue;
  } catch (err) {
    stdout = err.stdout || "";
    stderr = err.stderr || "";
    status = err.status === undefined ? null : err.status;
    signal = err.signal || null;
    thrown = err;
  }

  const output = combinedOutput({ stdout, stderr });
  const exitInfo =
    signal !== null
      ? `sinal ${signal}`
      : `exit ${status === null ? "desconhecido" : status}` +
        (thrown && thrown.code === "ETIMEDOUT" ? " (timeout)" : "");

  // ---- Contagem: parse ESPECÍFICO ou FATAL. Nunca 0 por fallback. ----
  let violations = null;
  let parseError = null;
  try {
    violations = guard.parse(output);
    if (!Number.isInteger(violations) || violations < 0) {
      throw new UnparsableGuardOutput(`contagem inválida: ${violations}`);
    }
    if (violations === 0) {
      throw new UnparsableGuardOutput(
        "guard terminou com " +
          exitInfo +
          " porém reportou 0 violações — inconsistente; recusando tratar como limpo",
      );
    }
  } catch (err) {
    parseError = err instanceof UnparsableGuardOutput ? err.message : String(err && err.message);
  }

  if (parseError) {
    totalErrors++;
    results.push({
      name: guard.name,
      status: "🛑 FATAL",
      violations: null,
      exitInfo,
      reason: `saída não reconhecida (${parseError})`,
      output,
    });
    continue;
  }

  // ---- Baseline: avaliar sem NENHUMA atenuação de erro. ----
  if (baselineMissing) {
    totalErrors++;
    results.push({
      name: guard.name,
      status: "🛑 FATAL",
      violations,
      exitInfo,
      reason: `--baseline solicitado mas ${BASELINE_FILE} não existe`,
      output,
    });
    continue;
  }

  const base = useBaseline ? baseline?.[guard.baselineKey] : undefined;

  if (useBaseline && base === undefined) {
    totalErrors++;
    results.push({
      name: guard.name,
      status: "🛑 FATAL",
      violations,
      exitInfo,
      reason: `chave "${guard.baselineKey}" ausente em ${BASELINE_FILE}`,
      output,
    });
    continue;
  }

  const effectiveBase = useBaseline ? base : 0;
  const overBaseline = violations > effectiveBase;

  if (overBaseline) {
    // Regressão: bloqueante em qualquer modo (invariant 2). Sem decrement.
    totalErrors++;
    results.push({
      name: guard.name,
      status: "❌ FAIL",
      violations,
      baseline: effectiveBase,
      exitInfo,
      reason: `regressão: ${effectiveBase} → ${violations} (+${violations - effectiveBase})`,
      output,
    });
  } else if (isStrict && violations > 0) {
    totalErrors++;
    results.push({
      name: guard.name,
      status: "❌ FAIL",
      violations,
      baseline: effectiveBase,
      exitInfo,
      reason: `modo --strict: ${violations} violação(ões) dentro do baseline`,
      output,
    });
  } else {
    if (violations < effectiveBase) {
      totalWarnings++;
    }
    results.push({
      name: guard.name,
      status: violations > 0 ? "✅ PASS (baseline)" : "✅ PASS",
      violations,
      baseline: useBaseline ? effectiveBase : null,
      exitInfo,
      ratchet:
        useBaseline && violations < effectiveBase
          ? `baseline pode ser reduzido: ${effectiveBase} → ${violations}`
          : null,
      output,
    });
  }
}

console.log("Results:\n");
for (const r of results) {
  console.log(`  ${r.status}  ${r.name}`);
  const detail = [];
  if (r.baseline !== undefined && r.baseline !== null) {
    detail.push(`violations=${r.violations} baseline=${r.baseline}`);
  } else if (r.violations !== null && r.violations !== undefined) {
    detail.push(`violations=${r.violations}`);
  }
  if (r.exitInfo) detail.push(r.exitInfo);
  if (detail.length) console.log(`         ${detail.join("  |  ")}`);
  if (r.reason) console.log(`         ↳ ${r.reason}`);
  if (r.ratchet) console.log(`         ↳ ${r.ratchet}`);

  const isBad = r.status === "❌ FAIL" || r.status === "🛑 FATAL";
  if (isBad && r.output) {
    const { head, hidden } = truncate(r.output);
    for (const line of head) console.log(`         ${line}`);
    if (hidden > 0) console.log(`         ... (${hidden} more lines)`);
  }
}

console.log(`\n  Total: ${totalErrors} error(s), ${totalWarnings} warning(s)\n`);

if (useBaseline) {
  if (baselineMissing) {
    console.log(`  Baseline: ${BASELINE_FILE} AUSENTE — gate fail-closed\n`);
  } else {
    console.log("  Baseline comparison:");
    for (const guard of guards) {
      const r = results.find((x) => x.name === guard.name);
      const base = baseline?.[guard.baselineKey];
      if (base !== undefined && r && r.violations !== null) {
        const diff = r.violations - base;
        const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
        console.log(`    ${guard.baselineKey}: ${base} ${arrow} ${r.violations}`);
      } else if (base !== undefined && r) {
        console.log(`    ${guard.baselineKey}: ${base} ? ${"n/d"} (FATAL)`);
      }
    }
    console.log("");
  }
}

if (totalErrors > 0) {
  console.error(
    isCI
      ? "Architecture verification FAILED (fail-closed, CI mode)"
      : "Architecture verification FAILED",
  );
  process.exit(1);
}

console.log("All architecture guards passed.");
process.exit(0);
