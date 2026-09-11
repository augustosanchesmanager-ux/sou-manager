#!/usr/bin/env node
/**
 * [SMG] SMG PR Approve — Validation Guards (pure, testable)
 *
 * Fail-closed validation gates for the `/approve` command on pull requests.
 * No I/O here: functions are pure and unit-testable (see guards.test.mjs).
 *
 * Governance reference: docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md
 *
 * The approval is an AUTOMATED EXECUTION of the PO decision, never an
 * autonomous decision by the executor account. The GitHub identity
 * (`review-bot-smg`, type User) only satisfies the technical branch
 * protection requirement (1 approving review); separation of powers is
 * preserved: approval != merge authorization != deploy.
 */

/** PO account allowed to trigger `/approve`. */
export const PO_ACCOUNT = "augustosanchesmanager-ux";

/**
 * Check runs that may legitimately fail without blocking approval.
 * `lint advisory` is the documented pre-existing CI baseline (see ROADMAP 8.50):
 * 33 errors / 213 warnings in 96 TS/TSX files, advisory (continue-on-error),
 * NEVER a mandatory gate.
 */
export const ADVISORY_CHECK_NAMES = ["lint advisory"];

const okResult = () => ({ ok: true, reason: "" });
const failResult = (reason) => ({ ok: false, reason });
/** Idempotency is NOT a failure: documented "silent STOP" — exit 0, no POST. */
const noopResult = (reason) => ({ ok: false, noop: true, reason });

/** `/approve` must be the exact command (trimmed). */
export function isApproveCommand(body) {
  return typeof body === "string" && body.trim() === "/approve";
}

/** Gate-level 0: comment context. */
export function validateComment({ commentAuthor, commentBody, isPullRequest }) {
  if (!isPullRequest) return failResult("comentário não está em um pull request");
  if (commentAuthor !== PO_ACCOUNT) {
    return failResult(`autor não autorizado: "${commentAuthor}" (esperado: ${PO_ACCOUNT})`);
  }
  if (!isApproveCommand(commentBody)) {
    return failResult(`comando inválido: "${commentBody}" (esperado: /approve)`);
  }
  return okResult();
}

/** Gate-level 1: pull request state. */
export function validatePr({ state, draft, baseRef }) {
  if (state !== "open") return failResult(`PR não está aberto (state=${state})`);
  if (draft) return failResult("PR está em draft");
  if (baseRef !== "main") return failResult(`base ref deve ser main (atual: ${baseRef})`);
  return okResult();
}

/** A green conclusion is success/neutral/skipped. */
export function isConclusionGreen(conclusion) {
  return conclusion === "success" || conclusion === "neutral" || conclusion === "skipped";
}

/** Advisory check runs may be red without blocking (explicit allowlist). */
export function isAdvisoryCheck(name) {
  return ADVISORY_CHECK_NAMES.some((advisory) =>
    typeof name === "string" && name.toLowerCase().includes(advisory.toLowerCase()),
  );
}

/**
 * Gate-level 2: required CI.
 * Fail-closed: EVERY check run must be completed AND green, with the single
 * documented exception of advisory checks. Unknown/failed checks block.
 */
export function validateChecks(checkRuns) {
  if (!Array.isArray(checkRuns) || checkRuns.length === 0) {
    return failResult("nenhum check run encontrado para o head SHA");
  }
  const notCompleted = checkRuns.filter((run) => run.status !== "completed");
  if (notCompleted.length > 0) {
    return failResult(`CI incompleto: ${notCompleted.map((r) => r.name).join(", ")}`);
  }
  const failed = checkRuns.filter((run) => !isConclusionGreen(run.conclusion) && !isAdvisoryCheck(run.name));
  if (failed.length > 0) {
    return failResult(
      `CI com falha mandatória: ${failed.map((r) => `${r.name}=${r.conclusion}`).join(", ")}`,
    );
  }
  return okResult();
}

/**
 * Idempotency: an existing APPROVED review means nothing to do.
 * Returns a NOOP result (not a failure): the workflow exits 0 WITHOUT
 * posting a new review — documented G7 "STOP silencioso, exit 0 sem POST".
 */
export function hasExistingApproval(reviews) {
  return Array.isArray(reviews) && reviews.some((review) => review.state === "APPROVED");
}

/**
 * Composite decision: apply all gates in order, fail-closed.
 * Returns { ok: true, noop?: false } to approve,
 *         { ok: false, noop: true, reason } for silent idempotent STOP,
 *         { ok: false, reason } for a hard STOP (exit 1, no approval).
 */
export function buildDecision({ comment, pr, checks, reviews }) {
  const commentGate = validateComment(comment);
  if (!commentGate.ok) return commentGate;
  const prGate = validatePr(pr);
  if (!prGate.ok) return prGate;
  const ciGate = validateChecks(checks);
  if (!ciGate.ok) return ciGate;
  if (hasExistingApproval(reviews)) {
    return noopResult("PR já possui aprovação registrada (idempotência — nada a fazer)");
  }
  return okResult();
}