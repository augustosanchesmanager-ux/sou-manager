/**
 * [SMG] SMG PR Approve — Workflow contract tests
 *
 * Locks the issue_comment checkout ref. GitHub's issue_comment payload
 * exposes `issue.pull_request` as {url, html_url, diff_url, patch_url} only —
 * `github.event.issue.pull_request.head.sha` is empty, so checkout falls
 * back to main and the PR's guards.mjs never run (R5.3-GOV-BOOTSTRAP-AUDIT).
 *
 * The durable pointer on this event is refs/pull/<number>/head.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const WORKFLOW_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.github/workflows/smg-approve.yml",
);

describe("smg-approve.yml checkout ref (issue_comment)", () => {
  const yaml = readFileSync(WORKFLOW_PATH, "utf8");

  test("checkout aponta para refs/pull/<issue.number>/head", () => {
    expect(yaml).toContain("refs/pull/${{ github.event.issue.number }}/head");
  });

  test("não usa issue.pull_request.head.sha (vazio no evento issue_comment)", () => {
    expect(yaml).not.toContain("github.event.issue.pull_request.head.sha");
  });

  test("dispara em issue_comment created", () => {
    expect(yaml).toMatch(/on:\s*\n\s*issue_comment:/);
    expect(yaml).toContain("types: [created]");
  });
});
