#!/usr/bin/env node
/**
 * [SMG] SMG PR Approve — Runtime Executor
 *
 * Runs inside GitHub Actions (issue_comment event) and performs the
 * automated `/approve` execution on behalf of the review executor account
 * (`review-bot-smg`) using the REVIEW_BOT_TOKEN secret.
 *
 * FASE 3A / T15 — two phases (design: docs/audit/T15_CONSUME_FINAL_DESIGN.md):
 *   approve (default) — legacy fail-closed gates + POST review. With the
 *     record flag ON (SMG_GATE_RECORD_REQUIRED=true), additionally loads both
 *     governance stores via API (?ref=), applies the T15 record pipeline
 *     (C1/C2/C3 + record gate + derived state) and appends step outputs
 *     (consumption_required + cross-refs) for the consume job.
 *   consume (SMG_PR_APPROVE_PHASE=consume) — revalidates everything (head,
 *     gates, C1, grant_ref recomputed), then CREATE-only-writes
 *     docs/consumption/<record_id>.json on smg-gate-consumption via
 *     GITHUB_TOKEN. Never POSTs reviews, never touches smg-gate-records.
 *
 * Flag OFF (default) = EXACTLY the legacy behavior (inert implementation).
 *
 * Token split (least privilege — B1 two-store):
 *   SMG_TOKEN    = review-bot-smg fine-grained PAT (Pull requests: write
 *                  only, no contents access) — PR reads + approval POST.
 *   GITHUB_TOKEN = workflow token — governance-store reads (approve phase)
 *                  and the consumption CREATE (consume job, contents: write).
 *
 * Flow (approve):
 *   1. Load event payload (GITHUB_EVENT_PATH) — C2 layer 2 (PR-only)
 *   2. Fetch PR, check runs and existing reviews from the GitHub API
 *   3. Flag ON: load both stores via API (?ref=) — never the PR checkout (P.02)
 *   4. Apply fail-closed guards (scripts/smg-pr-approve/guards.mjs)
 *   5. All gates pass -> POST pull request review APPROVE -> C1 on the response
 *   6. Flag ON -> append step outputs (consumption_required + cross-refs)
 *   7. Any failed gate -> exit 1 (STOP), no approval
 *
 * The token is NEVER logged. Governance reference:
 * docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md
 */
import { appendFileSync, readFileSync } from "node:fs";
import {
  assertConsumptionTarget,
  assertCreateOnly,
  assertPullRequestEvent,
  buildDecision,
  CONSUMPTION_BRANCH,
  CONSUMPTION_DIR,
  PO_ACCOUNT,
  RECORDS_BRANCH,
  RECORDS_DIR,
  resolveConsumptionWriteResult,
  validateApprovalProvenance,
  validateConsumptionSchema,
} from "./guards.mjs";

const API_BASE = "https://api.github.com";
const API_VERSION_HEADER = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

/** T15 record flag — anything other than the exact string "true" is OFF. */
const isFlagEnabled = () => process.env.SMG_GATE_RECORD_REQUIRED === "true";

/** Low-level fetch: never throws on HTTP status — callers decide (fail-closed). */
async function ghFetch(token, method, path, body) {
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

  return { status: response.status, ok: response.ok, json, text };
}

/** Throwing wrapper (legacy semantics preserved byte-for-byte). */
async function ghApi(token, method, path, body) {
  const { status, ok, json, text } = await ghFetch(token, method, path, body);
  if (!ok) {
    throw new Error(`GitHub API ${method} ${path} -> ${status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function loadEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH não definido");
  return JSON.parse(readFileSync(eventPath, "utf8"));
}

/** Append a single-line step output (GITHUB_OUTPUT). Fail-closed on misuse. */
function writeOutput(name, value) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) {
    throw new Error("GITHUB_OUTPUT não definido (flag ON exige outputs) — STOP");
  }
  if (typeof value !== "string" || value === "" || value.includes("\n")) {
    throw new Error(`output inválido para ${name} (vazio/multiline) — STOP`);
  }
  appendFileSync(outPath, `${name}=${value}\n`);
}

/** Decode a contents-API entry to a parsed JSON value (strict). */
function decodeJsonContent(entry, label) {
  if (!entry || typeof entry.content !== "string") {
    throw new Error(`${label}: conteúdo ilegível — STOP`);
  }
  const raw = Buffer.from(entry.content.replace(/\s/g, ""), "base64").toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label}: JSON inválido — STOP`);
  }
}

/** List *.json entries of a directory on a governance branch (404 dir = empty). */
async function listJsonDir({ token, repo, dir, branch }) {
  const res = await ghFetch(token, "GET", `/repos/${repo}/contents/${dir}?ref=${branch}`);
  if (res.status === 404) {
    // Branch exists (checked before); directory not materialized yet = no files.
    return [];
  }
  if (res.status !== 200 || !Array.isArray(res.json)) {
    throw new Error(`listagem de ${dir}@${branch} falhou (HTTP ${res.status}) — STOP`);
  }
  return res.json.filter(
    (entry) => entry && entry.type === "file" && typeof entry.name === "string" && entry.name.endsWith(".json"),
  );
}

/** A governance branch that does not exist = store inaccessible (ADR-028 §14-9). */
async function assertStoreBranch(token, repo, branch) {
  const res = await ghFetch(token, "GET", `/repos/${repo}/branches/${branch}`);
  if (res.status === 404) {
    throw new Error(`branch de governança ausente: ${branch} (store inacessível) — STOP`);
  }
  if (res.status !== 200) {
    throw new Error(`leitura da branch ${branch} falhou (HTTP ${res.status}) — STOP`);
  }
}

/**
 * Load BOTH governance stores via API (?ref=) — never the PR checkout (P.02).
 * Returns the `recordGate` input for buildDecision:
 *   { records, grantRefs, consumption, integrity } or { error } (fail-closed).
 *
 * C3 (grant_ref) is computed here for T15 candidates of the current head only:
 *   commits?path= (exactly 1 materializing commit) + blob sha at head vs at
 *   the emission commit (S_emit == S_head). Emission CONTENT equals head
 *   CONTENT by that byte-proof, so guards' validation of the head content
 *   also proves design §4-C3 step 5c (status=granted + 17 fields at emission).
 */
async function loadRecordGate({ token, repo, prHeadSha }) {
  try {
    await assertStoreBranch(token, repo, RECORDS_BRANCH);
    await assertStoreBranch(token, repo, CONSUMPTION_BRANCH);

    // ── Emission store (smg-gate-records) ────────────────────────────────────
    const recordEntries = await listJsonDir({
      token,
      repo,
      dir: RECORDS_DIR,
      branch: RECORDS_BRANCH,
    });
    const records = [];
    const headBlobShas = new Map();
    for (const entry of recordEntries) {
      const res = await ghFetch(token, "GET", `/repos/${repo}/contents/${entry.path}?ref=${RECORDS_BRANCH}`);
      if (res.status !== 200) {
        throw new Error(`record ilegível: ${entry.path} (HTTP ${res.status}) — STOP`);
      }
      const record = decodeJsonContent(res.json, `record ${entry.path}`);
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error(`record inválido (não é objeto JSON): ${entry.path} — STOP`);
      }
      if (typeof record.record_id !== "string" || record.record_id === "") {
        throw new Error(`record sem record_id: ${entry.path} — STOP`);
      }
      headBlobShas.set(record.record_id, res.json?.sha ?? null);
      records.push(record);
    }

    // ── Consumption store (smg-gate-consumption) — create-only, append-only ──
    const consumptionEntries = await listJsonDir({
      token,
      repo,
      dir: CONSUMPTION_DIR,
      branch: CONSUMPTION_BRANCH,
    });
    const consumption = {};
    for (const entry of consumptionEntries) {
      const res = await ghFetch(token, "GET", `/repos/${repo}/contents/${entry.path}?ref=${CONSUMPTION_BRANCH}`);
      if (res.status !== 200) {
        throw new Error(`consumo ilegível: ${entry.path} (HTTP ${res.status}) — STOP`);
      }
      const event = decodeJsonContent(res.json, `consumo ${entry.path}`);
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new Error(`consumo inválido (não é objeto JSON): ${entry.path} — STOP`);
      }
      const stem = entry.name.slice(0, -".json".length);
      consumption[stem] = event;
    }

    // ── C3: deterministic grant_ref (candidates of the current head only) ────
    const grantRefs = {};
    for (const record of records) {
      if (record.transition !== "T15" || record.artifact_ref !== prHeadSha) continue;
      const path = `${RECORDS_DIR}/${record.record_id}.json`;
      const commitsRes = await ghFetch(
        token,
        "GET",
        `/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${RECORDS_BRANCH}&per_page=100`,
      );
      if (commitsRes.status !== 200 || !Array.isArray(commitsRes.json)) {
        throw new Error(`histórico de emissão ilegível: ${path} (HTTP ${commitsRes.status}) — STOP`);
      }
      const commits = commitsRes.json
        .map((commit) => commit?.sha)
        .filter((sha) => typeof sha === "string");
      let emissionBlobSha = null;
      if (commits.length === 1) {
        const emitRes = await ghFetch(token, "GET", `/repos/${repo}/contents/${path}?ref=${commits[0]}`);
        if (emitRes.status !== 200) {
          throw new Error(
            `conteúdo na emissão ilegível: ${path}@${commits[0]} (HTTP ${emitRes.status}) — STOP`,
          );
        }
        emissionBlobSha = emitRes.json?.sha ?? null;
      }
      grantRefs[record.record_id] = {
        commits,
        headBlobSha: headBlobShas.get(record.record_id) ?? null,
        emissionBlobSha,
      };
    }

    return {
      records,
      grantRefs,
      consumption,
      integrity: {
        recordIds: records.map((record) => record.record_id),
        consumptionIds: Object.keys(consumption),
      },
    };
  } catch (err) {
    return { error: err.message };
  }
}

/** Phase: approve (default) — legacy gates + POST + T15 outputs when flag ON. */
async function runApprove() {
  const token = process.env.SMG_TOKEN;
  if (!token) {
    throw new Error("Secret REVIEW_BOT_TOKEN não configurado (SMG_TOKEN vazio)");
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY não definido");

  const event = loadEvent();

  // C2 (layer 2): only comments ON pull requests reach the guards/POST.
  const c2 = assertPullRequestEvent(event);
  if (!c2.ok) throw new Error(c2.reason);

  const pullNumber = event.issue.number;
  const commentAuthor = event.comment?.user?.login ?? null;
  const commentBody = event.comment?.body ?? null;

  console.log(`[smg-pr-approve] PR #${pullNumber} — autor do comentário: ${commentAuthor} (PO esperado: ${PO_ACCOUNT})`);

  const pr = await ghApi(token, "GET", `/repos/${repo}/pulls/${pullNumber}`);
  if (!pr || pr.state !== "open") {
    throw new Error(`PR #${pullNumber} não está aberto (state=${pr?.state}) — STOP`);
  }

  const headSha = pr.head?.sha;
  const checks = await ghApi(token, "GET", `/repos/${repo}/commits/${headSha}/check-runs?per_page=100`);
  const reviews = await ghApi(token, "GET", `/repos/${repo}/pulls/${pullNumber}/reviews?per_page=100`);

  const recordFlag = isFlagEnabled();
  let recordGate;
  if (recordFlag) {
    const readToken = process.env.GITHUB_TOKEN;
    if (!readToken) {
      throw new Error("GITHUB_TOKEN não disponível para leitura dos stores (flag ON) — STOP");
    }
    // Store reads via API (?ref=) with the workflow token — never PR bytes.
    recordGate = await loadRecordGate({ token: readToken, repo, prHeadSha: headSha });
  }

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
      headSha,
    },
    checks: checks?.check_runs ?? [],
    reviews: reviews ?? [],
    event,
    recordGate,
    flagEnabled: recordFlag,
  });

  if (!decision.ok) {
    if (decision.noop) {
      // Idempotency: already approved/consumed — silent STOP, exit 0, no POST.
      console.log(`[smg-pr-approve] NOOP — ${decision.reason}`);
      return;
    }
    throw new Error(`STOP — ${decision.reason}`);
  }

  // Approve BEFORE consume — a crash between the two is repairable on rerun.
  let approvalRef = decision.approvalRef ?? null;
  if (decision.needsApproval) {
    const review = await ghApi(token, "POST", `/repos/${repo}/pulls/${pullNumber}/reviews`, {
      event: "APPROVE",
      body: "Aprovação automatizada: execução formal do comando /approve autorizado pelo PO. " +
            "review executor automatizado (não é decisão autônoma). Merge/deploy permanecem gates separados.",
    });

    if (recordFlag) {
      // C1 on the POST response — divergence => STOP, no consumption (§5-[9]).
      const c1 = validateApprovalProvenance({ reviews: [review], prHeadSha: decision.prHeadSha });
      if (!c1.ok) {
        throw new Error(`STOP — resposta do POST viola C1: ${c1.reason}`);
      }
      approvalRef = c1.approvalRef;
    }

    console.log(`[smg-pr-approve] APPROVE executado — review id ${review?.id ?? "?"} no PR #${pullNumber}`);
  } else if (recordFlag) {
    console.log(`[smg-pr-approve] aprovação pré-existente validada (C1) — review id ${approvalRef} — sem novo POST`);
  }

  if (recordFlag) {
    // Outputs written ONLY after a successful (or C1-validated) approval.
    writeOutput("consumption_required", "true");
    writeOutput("record_id", decision.recordId);
    writeOutput("grant_ref", decision.grantRef);
    writeOutput("pr_head_sha", decision.prHeadSha);
    writeOutput("target", decision.target);
    writeOutput("approval_ref", String(approvalRef));
    console.log(`[smg-pr-approve] outputs T15 gravados — consumo habilitado (${decision.recordId})`);
  }
}

/** Phase: consume — revalidate, then CREATE-only write on smg-gate-consumption. */
async function runConsume() {
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    throw new Error("GITHUB_TOKEN não configurado (fase consume) — STOP");
  }
  if (!isFlagEnabled()) {
    // Flag OFF: legacy behavior — no consumption write exists at all.
    console.log("[smg-pr-approve] consume: flag SMG_GATE_RECORD_REQUIRED OFF — nada a fazer");
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY não definido");

  const event = loadEvent();
  const c2 = assertPullRequestEvent(event);
  if (!c2.ok) throw new Error(c2.reason);
  const pullNumber = event.issue.number;

  // Cross-refs published by the approve job (all mandatory — fail-closed).
  const expected = {
    record_id: process.env.SMG_CONSUME_RECORD_ID,
    grant_ref: process.env.SMG_CONSUME_GRANT_REF,
    pr_head_sha: process.env.SMG_CONSUME_PR_HEAD_SHA,
    target: process.env.SMG_CONSUME_TARGET,
    approval_ref: process.env.SMG_CONSUME_APPROVAL_REF,
  };
  const missing = Object.entries(expected)
    .filter(([, value]) => typeof value !== "string" || value === "")
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`STOP — outputs do job approve ausentes: ${missing.join(", ")}`);
  }

  console.log(`[smg-pr-approve] consume: PR #${pullNumber} — record ${expected.record_id}`);

  // Full revalidation (design §5): head unchanged, gates, C1, record, C3.
  const pr = await ghApi(ghToken, "GET", `/repos/${repo}/pulls/${pullNumber}`);
  if (!pr || pr.state !== "open") {
    throw new Error(`PR #${pullNumber} não está aberto (state=${pr?.state}) — STOP`);
  }
  const headSha = pr.head?.sha;
  if (headSha !== expected.pr_head_sha) {
    throw new Error(
      `STOP — head do PR mudou entre aprovação e consumo (${headSha} != ${expected.pr_head_sha})`,
    );
  }

  const checks = await ghApi(ghToken, "GET", `/repos/${repo}/commits/${headSha}/check-runs?per_page=100`);
  const reviews = await ghApi(ghToken, "GET", `/repos/${repo}/pulls/${pullNumber}/reviews?per_page=100`);

  const recordGate = await loadRecordGate({ token: ghToken, repo, prHeadSha: headSha });

  const decision = buildDecision({
    comment: {
      commentAuthor: event.comment?.user?.login ?? null,
      commentBody: event.comment?.body ?? null,
      isPullRequest: true,
    },
    pr: {
      state: pr.state,
      draft: Boolean(pr.draft),
      baseRef: pr.base?.ref ?? null,
      headSha,
    },
    checks: checks?.check_runs ?? [],
    reviews: reviews ?? [],
    event,
    recordGate,
    flagEnabled: true,
  });

  if (!decision.ok) {
    if (decision.noop) {
      // Derived state "consumed" (idempotency level 2) — nothing to do.
      console.log(`[smg-pr-approve] consume NOOP — ${decision.reason}`);
      return;
    }
    throw new Error(`STOP — ${decision.reason}`);
  }

  if (decision.needsApproval || !decision.approvalRef) {
    // Approval is a prerequisite; the consume phase NEVER posts reviews.
    throw new Error("STOP — aprovação C1 ausente na fase consume (fase consume não aprova)");
  }

  // grant_ref/head/approval recomputed here must equal what approve published.
  const divergences = [
    ["record_id", decision.recordId, expected.record_id],
    ["grant_ref", decision.grantRef, expected.grant_ref],
    ["pr_head_sha", decision.prHeadSha, expected.pr_head_sha],
    ["target", decision.target, expected.target],
    ["approval_ref", decision.approvalRef, expected.approval_ref],
  ];
  for (const [field, actual, published] of divergences) {
    if (actual !== published) {
      throw new Error(
        `STOP — cross-ref divergente no consume (${field}): recomputado=${actual} publicado=${published}`,
      );
    }
  }

  const path = `${CONSUMPTION_DIR}/${decision.record_id}.json`;
  const targetCheck = assertConsumptionTarget({
    ref: CONSUMPTION_BRANCH,
    path,
    recordId: decision.record_id,
  });
  if (!targetCheck.ok) throw new Error(targetCheck.reason);

  const runId = process.env.GITHUB_RUN_ID;
  if (!runId) throw new Error("GITHUB_RUN_ID ausente (consumed_by) — STOP");

  const payload = {
    record_id: decision.record_id,
    grant_ref: decision.grantRef,
    pr_head_sha: decision.prHeadSha,
    target: decision.target,
    approval_ref: String(decision.approvalRef),
    consumed_at: new Date().toISOString(),
    consumed_by: `smg-approve@${runId}`,
  };
  const schema = validateConsumptionSchema(payload);
  if (!schema.ok) throw new Error(schema.reason);

  const body = {
    message: `gate(smg-gate): consumo T15 ${decision.record_id} — PR #${pullNumber} @ ${decision.prHeadSha.slice(0, 7)}`,
    content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8").toString("base64"),
    branch: CONSUMPTION_BRANCH,
    // CREATE-only: NO `sha` field — UPDATE is structurally forbidden (ADR-028 §5).
  };
  const createCheck = assertCreateOnly(
    Object.prototype.hasOwnProperty.call(body, "sha") ? "UPDATE" : "CREATE",
  );
  if (!createCheck.ok) throw new Error(createCheck.reason);

  const putRes = await ghFetch(ghToken, "PUT", `/repos/${repo}/contents/${path}`, body);

  if (putRes.status >= 200 && putRes.status < 300) {
    console.log(`[smg-pr-approve] consumo criado — ${path} @ ${CONSUMPTION_BRANCH} (PUT ${putRes.status})`);
    return;
  }

  if (putRes.status !== 422) {
    throw new Error(`STOP — escrita de consumo falhou (HTTP ${putRes.status}): ${putRes.text.slice(0, 300)}`);
  }

  // Idempotency level 2: 422 => re-read + FULL cross-ref validation (§9).
  const readRes = await ghFetch(
    ghToken,
    "GET",
    `/repos/${repo}/contents/${path}?ref=${CONSUMPTION_BRANCH}`,
  );
  let existingEvent = null;
  if (readRes.status === 200) {
    try {
      existingEvent = decodeJsonContent(readRes.json, `consumo ${path}`);
    } catch {
      existingEvent = null; // invalid JSON => resolution fails closed (STOP)
    }
  }
  const resolution = resolveConsumptionWriteResult({
    created: false,
    alreadyExists: true,
    existingEvent,
    expected: {
      record_id: expected.record_id,
      grant_ref: expected.grant_ref,
      pr_head_sha: expected.pr_head_sha,
      target: expected.target,
      approval_ref: expected.approval_ref,
    },
  });
  if (resolution.noop) {
    console.log(`[smg-pr-approve] consume NOOP — ${resolution.reason}`);
    return;
  }
  if (!resolution.ok) {
    throw new Error(`STOP — ${resolution.reason}`);
  }
  console.log(`[smg-pr-approve] consumo pré-existente validado — ${path}`);
}

async function main() {
  const phase = process.env.SMG_PR_APPROVE_PHASE === "consume" ? "consume" : "approve";
  if (phase === "consume") {
    await runConsume();
    return;
  }
  await runApprove();
}

main().catch((err) => {
  console.error(`[smg-pr-approve] ${err.message}`);
  process.exitCode = 1;
});
