#!/usr/bin/env node
/**
 * [SMG] SMG PR Approve — Runtime Executor
 *
 * Runs inside GitHub Actions (issue_comment event) and performs the
 * automated `/approve` execution on behalf of the review executor account
 * (`review-bot-smg`) using the REVIEW_BOT_TOKEN secret.
 *
 * Flow:
 *   1. Load event payload (GITHUB_EVENT_PATH)
 *   2. Fetch PR, check runs and existing reviews from the GitHub API
 *   3. Apply fail-closed guards (scripts/smg-pr-approve/guards.mjs)
 *   4. If all gates pass -> POST pull request review APPROVE
 *   5. Any failed gate -> exit 1 (STOP), no approval
 *
 * The token is NEVER logged. Only `SMG_TOKEN` (secret) is used to call the
 * API on behalf of the executor account.
 *
 * Governance reference: docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md
 */
import { readFileSync } from "node:fs";
import { buildDecision, PO_ACCOUNT } from "./guards.mjs";

const API_BASE = "https://api.github.com";
const API_VERSION_HEADER = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

async function ghApi(token, method, path, body) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: API_VERSION_HEADER,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "smg-pr-approve",
  };
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} -> ${response.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function loadEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH não definido");
  return JSON.parse(readFileSync(eventPath, "utf8"));
}

async function main() {
  const token = process.env.SMG_TOKEN;
  if (!token) {
    throw new Error("Secret REVIEW_BOT_TOKEN não configurado (SMG_TOKEN vazio)");
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY não definido");

  const event = loadEvent();

  // Only issue_comment events on pull requests are valid here.
  if (!event.issue || !event.issue.pull_request) {
    throw new Error("Evento não é comentário em pull request — STOP");
  }

  const pullNumber = event.issue.number;
  const commentAuthor = event.comment?.user?.login ?? null;
  const commentBody = event.comment?.body ?? null;

  console.log(`[smg-pr-approve] PR #${pullNumber} — autor do comentário: ${commentAuthor} (PO esperado: ${PO_ACCOUNT})`);

  // Fetch PR, check runs and existing reviews.
  const pr = await ghApi(token, "GET", `/repos/${repo}/pulls/${pullNumber}`);
  if (!pr || pr.state !== "open") {
    throw new Error(`PR #${pullNumber} não está aberto (state=${pr?.state}) — STOP`);
  }

  const headSha = pr.head?.sha;
  const checks = await ghApi(token, "GET", `/repos/${repo}/commits/${headSha}/check-runs?per_page=100`);
  const reviews = await ghApi(token, "GET", `/repos/${repo}/pulls/${pullNumber}/reviews?per_page=100`);

  const decision = buildDecision({
    comment: {
      commentAuthor,
      commentBody,
      isPullRequest: Boolean(event.issue.pull_request),
    },
    pr: {
      state: pr.state,
      draft: Boolean(pr.draft),
      baseRef: pr.base?.ref ?? null,
    },
    checks: checks?.check_runs ?? [],
    reviews: reviews ?? [],
  });

  if (!decision.ok) {
    if (decision.noop) {
      // Idempotency: already approved — silent STOP, exit 0, no POST (documented G7).
      console.log(`[smg-pr-approve] NOOP — ${decision.reason}`);
      return;
    }
    throw new Error(`STOP — ${decision.reason}`);
  }

  // All gates passed: execute the approval on behalf of the executor account.
  const review = await ghApi(token, "POST", `/repos/${repo}/pulls/${pullNumber}/reviews`, {
    event: "APPROVE",
    body: "Aprovação automatizada: execução formal do comando /approve autorizado pelo PO. " +
          "review executor automatizado (não é decisão autônoma). Merge/deploy permanecem gates separados.",
  });

  console.log(`[smg-pr-approve] APPROVE executado — review id ${review?.id ?? "?"} no PR #${pullNumber}`);
}

main().catch((err) => {
  console.error(`[smg-pr-approve] ${err.message}`);
  process.exitCode = 1;
});