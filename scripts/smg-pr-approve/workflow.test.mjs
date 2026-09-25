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
