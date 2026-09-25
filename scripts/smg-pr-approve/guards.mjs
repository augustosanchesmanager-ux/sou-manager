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
 *
 * `e2e smoke advisory` is the smoke E2E job added in PR #70 (R5.3). It runs
 * Playwright against `tests/e2e/smoke/` and is intentionally advisory
 * (continue-on-error: true) while E2E infrastructure is being formalized
 * (R5.3 limitation: missing VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in CI
 * — pending separate gate). When this check fails, the failure is expected
 * and must NOT block the PO's /approve gate.
 */
export const ADVISORY_CHECK_NAMES = [
  "lint advisory",
  "e2e smoke advisory",
];

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

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3A / T15 — Authorization Record consumption guards (all pure)
// Design: docs/audit/T15_CONSUME_FINAL_DESIGN.md (PR #83, aprovado 2026-09-25)
// ADR-028 §8/§13 · Contrato V1.0/r2 §5/§14/§15.
// Mandatory corrections implemented here:
//   C1 — approval provenance: state=APPROVED + user=review-bot-smg + commit_id=pr_head_sha
//   C2 — structural PR-only gate (layer 2; layer 1 lives in the workflow `if`)
//   C3 — deterministic grant_ref: single materializing commit + blob-sha proof
// Everything fails closed: any ambiguity → STOP (never heuristic choice).
// ─────────────────────────────────────────────────────────────────────────────

/** Bot login that constitutes a valid approval provenance (C1). */
export const BOT_LOGIN = "review-bot-smg";

/** Governance branches (B1 two-store — ADR-028 §5). */
export const RECORDS_BRANCH = "smg-gate-records";
export const CONSUMPTION_BRANCH = "smg-gate-consumption";
export const RECORDS_DIR = "docs/records";
export const CONSUMPTION_DIR = "docs/consumption";

/** The 17 contract fields (contrato §5) — record schema is strict: no extras. */
export const RECORD_SCHEMA_FIELDS = [
  "record_id",
  "front_id",
  "transition",
  "scope_id",
  "environment",
  "target",
  "artifact_ref",
  "expires_at",
  "status",
  "authorized_by",
  "authorized_at",
  "consumed_at",
  "consumed_ref",
  "revoked_at",
  "revoked_by",
  "reason",
  "evidence_refs",
];

/** Consumption event schema (design §6.2) — strict: no extras. */
export const CONSUMPTION_SCHEMA_FIELDS = [
  "record_id",
  "grant_ref",
  "pr_head_sha",
  "target",
  "approval_ref",
  "consumed_at",
  "consumed_by",
];

/**
 * C2 (layer 2): structural PR-only gate — `issue_comment` also fires for
 * plain Issues; consumption is only defined for PR events (design §4-C2).
 */
export function assertPullRequestEvent(event) {
  if (!event || !event.issue || !event.issue.pull_request) {
    return failResult("evento não é comentário em pull request (C2) — STOP");
  }
  return okResult();
}

/**
 * C1: approval provenance (design §4-C1 — PO correction #1).
 * A valid approval is EXACTLY: state=APPROVED + user.login=review-bot-smg +
 * commit_id=pr_head_sha. Returns `approval_ref` = the exact review id.
 * Human approvals and bot approvals on stale SHAs do NOT satisfy C1.
 */
export function validateApprovalProvenance({ reviews, prHeadSha, botLogin = BOT_LOGIN }) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return failResult("nenhuma review para validar (C1) — STOP");
  }
  if (typeof prHeadSha !== "string" || !prHeadSha) {
    return failResult("pr_head_sha ausente para validação C1 — STOP");
  }
  const match = reviews.find(
    (r) =>
      r?.state === "APPROVED" &&
      r?.user?.login === botLogin &&
      r?.commit_id === prHeadSha,
  );
  if (!match) {
    return failResult("aprovação C1 ausente (APPROVED + review-bot-smg + head SHA atual) — STOP");
  }
  const approvalRef = String(match.id ?? "");
  if (approvalRef === "") {
    // approval_ref é o id EXATO da review (C1); id ausente = proveniência
    // não-comprovável → fail-closed, nunca gravar approval_ref vazio.
    return failResult("review C1 válida sem id utilizável (approval_ref) — STOP");
  }
  return { ok: true, reason: "", approvalRef };
}

/**
 * Strict record schema: exactly the 17 contract fields, no extras, no
 * missing (ADR-028 §23 test strategy item 3).
 */
export function validateRecordSchema(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return failResult("record não é um objeto JSON — STOP");
  }
  const keys = Object.keys(record).sort();
  const expected = [...RECORD_SCHEMA_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    return failResult(
      `schema do record inválido: esperados exatamente 17 campos (${expected.join(", ")}) — STOP`,
    );
  }
  for (const field of ["record_id", "front_id", "transition", "scope_id", "environment", "target", "artifact_ref", "status", "authorized_by", "authorized_at"]) {
    if (typeof record[field] !== "string" || record[field] === "") {
      return failResult(`campo obrigatório inválido: ${field} — STOP`);
    }
  }
  if (!Array.isArray(record.evidence_refs)) {
    return failResult("campo obrigatório inválido: evidence_refs (deve ser array) — STOP");
  }
  return okResult();
}

/** Strict consumption event schema (design §6.2). */
export function validateConsumptionSchema(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return failResult("evento de consumo não é um objeto JSON — STOP");
  }
  const keys = Object.keys(event).sort();
  const expected = [...CONSUMPTION_SCHEMA_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    return failResult("schema do evento de consumo inválido (campos extras/faltantes) — STOP");
  }
  for (const field of expected) {
    if (typeof event[field] !== "string" || event[field] === "") {
      return failResult(`campo do consumo inválido: ${field} — STOP`);
    }
  }
  return okResult();
}

/**
 * C3: deterministic grant_ref (design §4-C3 — PO correction #3).
 * `commits` = ordered list of commit SHAs that touched the grant path
 * (API `commits?path=`). Exactly ONE materializing commit is acceptable:
 * transições são somente para frente (I10), então um grant ainda `granted`
 * com histórico multi-commit = mutação proibida / ambiguidade → STOP.
 */
export function computeGrantRef({ commits }) {
  if (!Array.isArray(commits) || commits.length === 0) {
    return failResult("grant_ref: nenhum commit de emissão encontrado (C3) — STOP");
  }
  if (commits.length > 1) {
    return failResult(
      `grant_ref ambíguo: ${commits.length} commits no path do grant (C3) — STOP`,
    );
  }
  const sha = commits[0];
  if (typeof sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return failResult("grant_ref: SHA de emissão inválido (C3) — STOP");
  }
  return { ok: true, reason: "", grantRef: sha };
}

/**
 * C3 immutability proof: blob at the materializing commit must equal the
 * blob at branch head (S_emit == S_head) — comprovado, não presumido.
 */
export function assertGrantImmutability({ headBlobSha, emissionBlobSha }) {
  if (!headBlobSha || !emissionBlobSha) {
    return failResult("imutabilidade do grant não comprovada (blob sha ausente) — STOP");
  }
  if (headBlobSha !== emissionBlobSha) {
    return failResult("grant alterado desde a emissão (S_emit != S_head) — STOP");
  }
  return okResult();
}

/**
 * Record gate (ADR-028 §7–§12, §14 conditions 1–8): exactly ONE candidate
 * (transition=T15 + artifact_ref == pr_head_sha), fully valid, else STOP.
 */
export function validateAuthorizationRecord({ records, prHeadSha, now }) {
  if (!Array.isArray(records)) {
    return failResult("store de records ilegível — STOP");
  }
  const candidates = records.filter(
    (r) => r && r.transition === "T15" && r.artifact_ref === prHeadSha,
  );
  if (candidates.length === 0) {
    return failResult("nenhum record T15 candidato para o head SHA (sem record, sem transição) — STOP");
  }
  if (candidates.length > 1) {
    return failResult(`múltiplos records T15 para o head SHA: ${candidates.length} (ambiguidade = I7) — STOP`);
  }
  const record = candidates[0];
  const schema = validateRecordSchema(record);
  if (!schema.ok) return schema;
  if (!record.front_id || typeof record.front_id !== "string") {
    return failResult("front_id ausente/vazio (I5) — STOP");
  }
  if (record.target !== "main") {
    return failResult(`target deve ser main (atual: ${record.target}) — STOP`);
  }
  if (record.environment !== "n/a") {
    return failResult(`environment deve ser n/a (atual: ${record.environment}) — STOP`);
  }
  if (record.status !== "granted") {
    return failResult(`status não é granted (atual: ${record.status}) — sem consumo — STOP`);
  }
  if (record.expires_at !== null && record.expires_at !== undefined) {
    const expiresAt = Date.parse(record.expires_at);
    const currentTime = Date.parse(now);
    if (Number.isNaN(expiresAt) || Number.isNaN(currentTime) || currentTime > expiresAt) {
      return failResult(`record expirado/inválido (expires_at=${record.expires_at}) — STOP`);
    }
  }
  return { ok: true, reason: "", record };
}

/**
 * Consumption target: EXACTLY branch `smg-gate-consumption` + deterministic
 * path `docs/consumption/<record_id>.json` (design §10 — consumo estreito).
 */
export function assertConsumptionTarget({ ref, path, recordId }) {
  if (ref !== CONSUMPTION_BRANCH) {
    return failResult(`ref de consumo inválido: ${ref} (esperado ${CONSUMPTION_BRANCH}) — STOP`);
  }
  const expectedPath = `${CONSUMPTION_DIR}/${recordId}.json`;
  if (path !== expectedPath) {
    return failResult(`path de consumo inválido: ${path} (esperado ${expectedPath}) — STOP`);
  }
  return okResult();
}

/** Consumption write is CREATE-only — UPDATE/DELETE are structurally forbidden. */
export function assertCreateOnly(operation) {
  if (operation !== "CREATE") {
    return failResult(`operação de consumo não é CREATE: ${operation} — STOP`);
  }
  return okResult();
}

/**
 * Cross-refs between a consumption event and the expected identity
 * (ADR-028 §14-11, §19): record_id, grant_ref, pr_head_sha, target, approval_ref.
 */
export function assertCrossReferences({ event, expected }) {
  const schema = validateConsumptionSchema(event);
  if (!schema.ok) return schema;
  for (const field of ["record_id", "grant_ref", "pr_head_sha", "target", "approval_ref"]) {
    if (event[field] !== expected[field]) {
      return failResult(
        `cross-ref divergente em ${field}: consumo=${event[field]} esperado=${expected[field]} — STOP`,
      );
    }
  }
  return okResult();
}

/**
 * Store integrity: no orphan consumption — every consumption event must
 * have a corresponding grant (ADR-028 §14-12).
 */
export function validateStoreIntegrity({ recordIds, consumptionIds } = {}) {
  const grants = new Set((recordIds || []).filter(Boolean));
  const orphans = (consumptionIds || []).filter((id) => !grants.has(id));
  if (orphans.length > 0) {
    return failResult(`consumo órfão sem grant correspondente: ${orphans.join(", ")} — STOP`);
  }
  return okResult();
}

/**
 * Idempotency level 2 — 422 resolution (ADR-028 §15): a create-only PUT that
 * returns 422 means the file already exists; re-read it and validate the FULL
 * cross-refs: match → NOOP (legitimate prior consumption), divergence → STOP
 * (anomalia — never assume consumed by guesswork).
 */
export function resolveConsumptionWriteResult({ created, alreadyExists, existingEvent, expected }) {
  if (created) {
    return { ok: true, reason: "consumo criado" };
  }
  if (!alreadyExists) {
    return failResult("escrita de consumo falhou sem 422 — STOP");
  }
  if (!existingEvent) {
    return failResult("422 recebido mas o re-read do consumo existente falhou — STOP");
  }
  const crossRefs = assertCrossReferences({ event: existingEvent, expected });
  if (!crossRefs.ok) {
    return failResult(`422 com cross-refs divergentes (anomalia): ${crossRefs.reason}`);
  }
  return noopResult("consumo prévio legítimo (idempotência nível 2 — nada a fazer)");
}

/**
 * Composite decision: apply all gates in order, fail-closed.
 * Returns { ok: true, noop?: false } to approve,
 *         { ok: false, noop: true, reason } for silent idempotent STOP,
 *         { ok: false, reason } for a hard STOP (exit 1, no approval).
 *
 * flagEnabled=false (default — SMG_GATE_RECORD_REQUIRED OFF): EXACTLY the
 * legacy behavior above (inert implementation, design §13).
 * flagEnabled=true: full T15 record pipeline — C1 idempotency, record gate,
 * C3 grant_ref, consumption state derivation (design §5 steps [3]–[8]).
 */
export function buildDecision({
  comment,
  pr,
  checks,
  reviews,
  event,
  recordGate,
  flagEnabled = false,
  now = new Date().toISOString(),
}) {
  const commentGate = validateComment(comment);
  if (!commentGate.ok) return commentGate;
  const prGate = validatePr(pr);
  if (!prGate.ok) return prGate;
  const ciGate = validateChecks(checks);
  if (!ciGate.ok) return ciGate;

  // C2 (layer 2): structural PR-only — event-derived, with fallback to the
  // normalized comment context so legacy callers keep working.
  const prEvent =
    event !== undefined && event !== null
      ? event
      : { issue: comment?.isPullRequest ? { pull_request: { url: "derived-from-comment" } } : {} };
  const c2 = assertPullRequestEvent(prEvent);
  if (!c2.ok) return c2;

  if (!flagEnabled) {
    // Flag OFF: legacy behavior, byte-for-byte (inert implementation).
    if (hasExistingApproval(reviews)) {
      return noopResult("PR já possui aprovação registrada (idempotência — nada a fazer)");
    }
    return { ...okResult(), needsApproval: true };
  }

  // ── Flag ON: T15 record pipeline (design §5) ──────────────────────────────
  const prHeadSha = pr?.headSha;
  if (typeof prHeadSha !== "string" || !prHeadSha) {
    return failResult("head SHA ausente (modo record exige pr.headSha) — STOP");
  }

  // Idempotency level 1 + C1 (design §5 step [4]):
  const approvedReviews = Array.isArray(reviews)
    ? reviews.filter((r) => r?.state === "APPROVED")
    : [];
  let approvalRef = null;
  if (approvedReviews.length > 0) {
    const c1 = validateApprovalProvenance({ reviews: approvedReviews, prHeadSha });
    if (!c1.ok) {
      return failResult(`idempotência C1: aprovação existente diverge — ${c1.reason}`);
    }
    approvalRef = c1.approvalRef;
    // NOOP do POST apenas; o consumo continua sendo avaliado abaixo.
  }

  // Record gate inputs (I/O fetched by run.mjs; any fetch failure lands in
  // recordGate.error → fail-closed, ADR-028 §14 conditions 9/13).
  if (!recordGate) {
    return failResult("record gate não avaliado com flag ON — STOP");
  }
  if (recordGate.error) {
    return failResult(`store inacessível/falha de leitura: ${recordGate.error} — STOP`);
  }

  const integrity = validateStoreIntegrity(recordGate.integrity);
  if (!integrity.ok) return integrity;

  const recordResult = validateAuthorizationRecord({
    records: recordGate.records,
    prHeadSha,
    now,
  });
  if (!recordResult.ok) return recordResult;
  const record = recordResult.record;

  // C3: deterministic grant_ref + immutability proof for this record.
  const grantRefs = recordGate.grantRefs?.[record.record_id];
  const grant = computeGrantRef({ commits: grantRefs?.commits });
  if (!grant.ok) return grant;
  const immutability = assertGrantImmutability({
    headBlobSha: grantRefs?.headBlobSha,
    emissionBlobSha: grantRefs?.emissionBlobSha,
  });
  if (!immutability.ok) return immutability;

  // Logical state derivation (ADR-028 §13): consumption present?
  const consumptionEvent = recordGate.consumption?.[record.record_id] ?? null;
  if (consumptionEvent !== null && consumptionEvent !== undefined) {
    const crossRefs = assertCrossReferences({
      event: consumptionEvent,
      expected: {
        record_id: record.record_id,
        grant_ref: grant.grantRef,
        pr_head_sha: prHeadSha,
        target: record.target,
        approval_ref: approvalRef,
      },
    });
    if (!crossRefs.ok) {
      return failResult(`consumo existente inválido (anomalia): ${crossRefs.reason}`);
    }
    return noopResult(
      `record ${record.record_id} já consumido (estado lógico consumed — idempotência nível 2)`,
    );
  }

  // State = granted: approval (if needed) + consumption are both enabled.
  return {
    ...okResult(),
    needsApproval: approvalRef === null,
    approvalRef,
    recordId: record.record_id,
    grantRef: grant.grantRef,
    prHeadSha,
    target: record.target,
  };
}