/**
 * [SMG] SMG PR Approve — Workflow contract tests
 *
 * P.02 trust boundary (docs/audit/P_02_SMG_APPROVE_TRUST_BOUNDARY.md):
 * the checkout MUST run code from the default branch, never from the
 * PR head — run.mjs executes with SMG_TOKEN (REVIEW_BOT_TOKEN) in scope
 * and reads only the GitHub API + GITHUB_EVENT_PATH (no PR bytes), so
 * PR-head code is both unnecessary and untrusted.
 *
 * Historical note: the issue_comment payload exposes `issue.pull_request`
 * as {url, html_url, diff_url, patch_url} only — `...head.sha` is empty
 * (R5.3-GOV-BOOTSTRAP-AUDIT) — hence no sha-based ref here either.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const WORKFLOW_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.github/workflows/smg-approve.yml",
);

describe("smg-approve.yml trust boundary (P.02)", () => {
  const yaml = readFileSync(WORKFLOW_PATH, "utf8");

  test("checkout aponta para a default branch do repositorio", () => {
    expect(yaml).toContain(
      "ref: ${{ github.event.repository.default_branch }}",
    );
  });

  test("nunca da checkout de codigo do PR", () => {
    expect(yaml).not.toContain("refs/pull");
    expect(yaml).not.toContain("pull/${{");
  });

  test("nao usa issue.pull_request.head.sha (vazio no evento issue_comment)", () => {
    expect(yaml).not.toContain("github.event.issue.pull_request.head.sha");
  });

  test("dispara em issue_comment created", () => {
    expect(yaml).toMatch(/on:\s*\n\s*issue_comment:/);
    expect(yaml).toContain("types: [created]");
  });

  test("workflow inteiro opera com permissions contents: read", () => {
    expect(yaml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });
});

describe("smg-approve.yml — FASE 3A / T15 (consumo de Authorization Record)", () => {
  const yaml = readFileSync(WORKFLOW_PATH, "utf8");

  test("concurrency barreira por PR, sem cancelamento em voo (ADR-028 §15)", () => {
    expect(yaml).toMatch(
      /concurrency:\s*\n\s*group:\s*smg-pr-approve-\$\{\{\s*github\.event\.issue\.number\s*\}\}/,
    );
    expect(yaml).toMatch(/cancel-in-progress:\s*false/);
  });

  test("workflow-level permanece contents: read", () => {
    const first = yaml.match(/permissions:\s*\n\s*contents:\s*(\w+)/);
    expect(first).not.toBeNull();
    expect(first[1]).toBe("read");
  });

  test("contents: write existe exatamente UMA vez e somente no job consume", () => {
    const writes = yaml.match(/^\s*contents:\s*write\s*$/gm) ?? [];
    expect(writes.length).toBe(1);
    const consumeIdx = yaml.indexOf("\n  consume:");
    expect(consumeIdx).toBeGreaterThan(-1);
    // yaml.search ignora ocorrências em comentários — só linhas YAML reais.
    const writeIdx = yaml.search(/^\s*contents:\s*write\s*$/m);
    expect(writeIdx).toBeGreaterThan(consumeIdx);
    const approveBlock = yaml.slice(yaml.indexOf("\n  approve:"), consumeIdx);
    expect(approveBlock).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  test("job consume exige approve bem-sucedido com consumption_required == 'true'", () => {
    expect(yaml).toMatch(/needs:\s*approve/);
    expect(yaml).toContain("needs.approve.outputs.consumption_required == 'true'");
  });

  test("flag SMG_GATE_RECORD_REQUIRED via vars — nunca literal", () => {
    expect(yaml).toContain(
      "SMG_GATE_RECORD_REQUIRED: ${{ vars.SMG_GATE_RECORD_REQUIRED == 'true' }}",
    );
    expect(yaml).not.toMatch(/SMG_GATE_RECORD_REQUIRED:\s*'?true'?\s*$/m);
  });

  test("C2 camada 1 — gate estrutural PR-only nos DOIS jobs (§8-1)", () => {
    const gates = yaml.match(/github\.event\.issue\.pull_request != null/g) ?? [];
    expect(gates.length).toBe(2);
  });

  test("§8-18 — invariante P.02: ambos os jobs dão checkout só da default branch", () => {
    const checkouts = yaml.match(/uses:\s*actions\/checkout@v4/g) ?? [];
    expect(checkouts.length).toBe(2);
    const refs =
      yaml.match(/ref:\s*\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}/g) ?? [];
    expect(refs.length).toBe(2);
    expect(yaml).not.toContain("refs/pull");
  });

  test("separação de token — PAT (SMG_TOKEN) só no approve; consume só GITHUB_TOKEN", () => {
    const approveIdx = yaml.indexOf("\n  approve:");
    const consumeIdx = yaml.indexOf("\n  consume:");
    expect(approveIdx).toBeGreaterThan(-1);
    expect(consumeIdx).toBeGreaterThan(approveIdx);
    const patUsages = [...yaml.matchAll(/SMG_TOKEN:/g)].map((m) => m.index);
    expect(patUsages.length).toBeGreaterThan(0);
    for (const idx of patUsages) {
      expect(idx).toBeGreaterThan(approveIdx);
      expect(idx).toBeLessThan(consumeIdx);
    }
    const consumeBlock = yaml.slice(consumeIdx);
    expect(consumeBlock).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(consumeBlock).toContain("SMG_PR_APPROVE_PHASE: consume");
    expect(consumeBlock).not.toContain("SMG_TOKEN");
    expect(consumeBlock).not.toContain("REVIEW_BOT_TOKEN");
  });

  test("outputs do approve publicam consumption_required + 5 cross-refs", () => {
    expect(yaml).toContain("consumption_required: ${{ steps.gate.outputs.consumption_required }}");
    expect(yaml).toContain("record_id: ${{ steps.gate.outputs.record_id }}");
    expect(yaml).toContain("grant_ref: ${{ steps.gate.outputs.grant_ref }}");
    expect(yaml).toContain("pr_head_sha: ${{ steps.gate.outputs.pr_head_sha }}");
    expect(yaml).toContain("target: ${{ steps.gate.outputs.target }}");
    expect(yaml).toContain("approval_ref: ${{ steps.gate.outputs.approval_ref }}");
    expect(yaml).toContain("SMG_CONSUME_APPROVAL_REF: ${{ needs.approve.outputs.approval_ref }}");
  });

  test("step de aprovação tem id gate (fonte dos outputs)", () => {
    expect(yaml).toMatch(/id:\s*gate/);
  });
});
