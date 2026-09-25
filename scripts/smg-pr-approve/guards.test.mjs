/**
 * [SMG] SMG PR Approve — Validation Guards Tests
 *
 * Vitest suite (repo convention). Run: `npm test` (or npx vitest run).
 *
 * Covers all fail-closed paths of the `/approve` guard chain:
 *   - command parsing
 *   - PO authority
 *   - PR state (open / non-draft / base main)
 *   - required CI (green, advisory-exempt, mandatory-failure, in-progress)
 *   - idempotency (existing APPROVED review)
 *   - composite decision
 */
import { describe, test, expect } from "vitest";
import {
  PO_ACCOUNT,
  isApproveCommand,
  validateComment,
  validatePr,
  validateChecks,
  hasExistingApproval,
  buildDecision,
  // FASE 3A / T15 — Authorization Record consumption guards
  assertPullRequestEvent,
  validateApprovalProvenance,
  validateRecordSchema,
  validateConsumptionSchema,
  computeGrantRef,
  assertGrantImmutability,
  validateAuthorizationRecord,
  assertConsumptionTarget,
  assertCreateOnly,
  assertCrossReferences,
  validateStoreIntegrity,
  resolveConsumptionWriteResult,
} from "./guards.mjs";

const PO = PO_ACCOUNT;

describe("isApproveCommand", () => {
  test("aceita '/approve' exato", () => {
    expect(isApproveCommand("/approve")).toBe(true);
  });

  test("aceita com espaços ao redor", () => {
    expect(isApproveCommand("  /approve  ")).toBe(true);
  });

  test("rejeita comandos diferentes", () => {
    expect(isApproveCommand("/merge")).toBe(false);
    expect(isApproveCommand("/approve please")).toBe(false);
    expect(isApproveCommand("approve")).toBe(false);
    expect(isApproveCommand("")).toBe(false);
    expect(isApproveCommand(null)).toBe(false);
    expect(isApproveCommand(undefined)).toBe(false);
  });
});

describe("validateComment", () => {
  test("PO com /approve em PR -> ok", () => {
    const result = validateComment({
      commentAuthor: PO,
      commentBody: "/approve",
      isPullRequest: true,
    });
    expect(result.ok).toBe(true);
  });

  test("autor diferente do PO -> STOP", () => {
    const result = validateComment({
      commentAuthor: "someone-else",
      commentBody: "/approve",
      isPullRequest: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/autor não autorizado/);
  });

  test("não é pull request -> STOP", () => {
    const result = validateComment({
      commentAuthor: PO,
      commentBody: "/approve",
      isPullRequest: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/não está em um pull request/);
  });

  test("comando inválido -> STOP", () => {
    const result = validateComment({
      commentAuthor: PO,
      commentBody: "/merge",
      isPullRequest: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/comando inválido/);
  });

  test("gate de autoridade tem precedência sobre comando", () => {
    const result = validateComment({
      commentAuthor: "someone-else",
      commentBody: "/merge",
      isPullRequest: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/autor não autorizado/);
  });
});

describe("validatePr", () => {
  test("aberto, não-draft, base main -> ok", () => {
    expect(validatePr({ state: "open", draft: false, baseRef: "main" }).ok).toBe(true);
  });

  test("PR fechado -> STOP", () => {
    const result = validatePr({ state: "closed", draft: false, baseRef: "main" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/não está aberto/);
  });

  test("PR draft -> STOP", () => {
    const result = validatePr({ state: "open", draft: true, baseRef: "main" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/draft/);
  });

  test("base diferente de main -> STOP", () => {
    const result = validatePr({ state: "open", draft: false, baseRef: "develop" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/base ref/);
  });
});

describe("validateChecks", () => {
  const GREEN_CHECKS = [
    { name: "typecheck", status: "completed", conclusion: "success" },
    { name: "build", status: "completed", conclusion: "success" },
    { name: "unit", status: "completed", conclusion: "success" },
    { name: "architecture:ci", status: "completed", conclusion: "success" },
    { name: "validate", status: "completed", conclusion: "success" },
  ];

  test("todos verdes -> ok", () => {
    expect(validateChecks(GREEN_CHECKS).ok).toBe(true);
  });

  test("lint advisory falho (baseline) não bloqueia", () => {
    const checks = [
      ...GREEN_CHECKS,
      { name: "lint advisory", status: "completed", conclusion: "failure" },
    ];
    expect(validateChecks(checks).ok).toBe(true);
  });

  test("e2e smoke advisory falho não bloqueia", () => {
    const checks = [
      ...GREEN_CHECKS,
      { name: "e2e smoke advisory", status: "completed", conclusion: "failure" },
    ];
    expect(validateChecks(checks).ok).toBe(true);
  });

  test("lint advisory + e2e smoke advisory falhos juntos não bloqueiam", () => {
    const checks = [
      ...GREEN_CHECKS,
      { name: "lint advisory", status: "completed", conclusion: "failure" },
      { name: "e2e smoke advisory", status: "completed", conclusion: "failure" },
    ];
    expect(validateChecks(checks).ok).toBe(true);
  });

  test("check obrigatório falho -> STOP", () => {
    const checks = GREEN_CHECKS.map((c) =>
      c.name === "build" ? { ...c, conclusion: "failure" } : c,
    );
    const result = validateChecks(checks);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/build=failure/);
  });

  test("check em execução (não completado) -> STOP", () => {
    const checks = [...GREEN_CHECKS, { name: "e2e", status: "in_progress", conclusion: null }];
    const result = validateChecks(checks);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/CI incompleto/);
  });

  test("sem check runs -> STOP (fail-closed)", () => {
    expect(validateChecks([]).ok).toBe(false);
  });
});

describe("hasExistingApproval", () => {
  test("sem reviews -> false", () => {
    const reviews = [
      { user: { login: "someone" }, state: "COMMENTED" },
      { user: { login: "someone" }, state: "CHANGES_REQUESTED" },
    ];
    expect(hasExistingApproval(reviews)).toBe(false);
  });

  test("já existe APPROVED -> true", () => {
    const reviews = [{ user: { login: "review-bot-smg" }, state: "APPROVED" }];
    expect(hasExistingApproval(reviews)).toBe(true);
  });
});

describe("buildDecision (composição fail-closed)", () => {
  const GOOD_CONTEXT = {
    comment: { commentAuthor: PO, commentBody: "/approve", isPullRequest: true },
    pr: { state: "open", draft: false, baseRef: "main" },
    checks: [
      { name: "typecheck", status: "completed", conclusion: "success" },
      { name: "build", status: "completed", conclusion: "success" },
      { name: "unit", status: "completed", conclusion: "success" },
      { name: "architecture:ci", status: "completed", conclusion: "success" },
      { name: "validate", status: "completed", conclusion: "success" },
    ],
    reviews: [],
  };

  test("tudo verde -> ok", () => {
    expect(buildDecision(GOOD_CONTEXT).ok).toBe(true);
  });

  test("qualquer gate vermelho -> STOP", () => {
    const cases = [
      {
        label: "autor errado",
        overrides: {
          comment: { commentAuthor: "hacker", commentBody: "/approve", isPullRequest: true },
        },
      },
      {
        label: "draft",
        overrides: { pr: { state: "open", draft: true, baseRef: "main" } },
      },
      {
        label: "CI falho",
        overrides: {
          checks: GOOD_CONTEXT.checks.map((c) =>
            c.name === "unit" ? { ...c, conclusion: "failure" } : c,
          ),
        },
      },
    ];
    for (const { label, overrides } of cases) {
      const decision = buildDecision({ ...GOOD_CONTEXT, ...overrides });
      expect(decision.ok, label).toBe(false);
      expect(decision.noop, label).not.toBe(true);
    }
  });

  test("já aprovado -> NOOP idempotente (sem POST, exit 0)", () => {
    const decision = buildDecision({
      ...GOOD_CONTEXT,
      reviews: [{ user: { login: "review-bot-smg" }, state: "APPROVED" }],
    });
    expect(decision.ok).toBe(false);
    expect(decision.noop).toBe(true);
    expect(decision.reason).toMatch(/idempotência/);
  });

  test("lint advisory vermelho NÃO bloqueia (baseline documentada)", () => {
    const context = {
      ...GOOD_CONTEXT,
      checks: [
        ...GOOD_CONTEXT.checks,
        { name: "lint advisory", status: "completed", conclusion: "failure" },
      ],
    };
    expect(buildDecision(context).ok).toBe(true);
  });

  test("e2e smoke advisory vermelho NÃO bloqueia (PR #70 / R5.3)", () => {
    const context = {
      ...GOOD_CONTEXT,
      checks: [
        ...GOOD_CONTEXT.checks,
        { name: "e2e smoke advisory", status: "completed", conclusion: "failure" },
      ],
    };
    expect(buildDecision(context).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3A / T15 — Authorization Record consumption guards
// Design: docs/audit/T15_CONSUME_FINAL_DESIGN.md (PR #83, aprovado 2026-09-25)
// C1 = aprovação vinculada a bot + mesmo SHA · C2 = PR-only (dupla camada) ·
// C3 = grant_ref determinístico (unicidade de commit + prova de blob sha).
// Fecha a matriz das 18 condições STOP do design §8.
// ─────────────────────────────────────────────────────────────────────────────

const HEAD_SHA = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";
const GRANT_SHA = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c";
const BOT = "review-bot-smg";
const NOW = "2026-09-25T12:00:00.000Z";
const RECORD_ID = "ar-20260925-001-merge";

const BOT_APPROVAL = {
  id: 424242,
  state: "APPROVED",
  user: { login: BOT },
  commit_id: HEAD_SHA,
};

const EXPECTED_CROSS_REFS = {
  record_id: RECORD_ID,
  grant_ref: GRANT_SHA,
  pr_head_sha: HEAD_SHA,
  target: "main",
  approval_ref: "424242",
};

const GREEN_CHECKS_T15 = [
  { name: "typecheck", status: "completed", conclusion: "success" },
  { name: "build", status: "completed", conclusion: "success" },
  { name: "unit", status: "completed", conclusion: "success" },
  { name: "architecture:ci", status: "completed", conclusion: "success" },
  { name: "validate", status: "completed", conclusion: "success" },
];

function makeRecord(overrides = {}) {
  return {
    record_id: RECORD_ID,
    front_id: "F-15",
    transition: "T15",
    scope_id: "sou-manager",
    environment: "n/a",
    target: "main",
    artifact_ref: HEAD_SHA,
    expires_at: null,
    status: "granted",
    authorized_by: PO,
    authorized_at: "2026-09-25T00:00:00.000Z",
    consumed_at: null,
    consumed_ref: null,
    revoked_at: null,
    revoked_by: null,
    reason: null,
    evidence_refs: ["docs/audit/T15_CONSUME_FINAL_DESIGN.md"],
    ...overrides,
  };
}

function makeConsumption(overrides = {}) {
  return {
    record_id: RECORD_ID,
    grant_ref: GRANT_SHA,
    pr_head_sha: HEAD_SHA,
    target: "main",
    approval_ref: "424242",
    consumed_at: "2026-09-25T12:00:00.000Z",
    consumed_by: "smg-approve@123456789",
    ...overrides,
  };
}

function makeGate(record = makeRecord(), overrides = {}) {
  return {
    records: [record],
    grantRefs: {
      [record.record_id]: {
        commits: [GRANT_SHA],
        headBlobSha: "blob-head-identical",
        emissionBlobSha: "blob-head-identical",
      },
    },
    consumption: {},
    integrity: { recordIds: [record.record_id], consumptionIds: [] },
    ...overrides,
  };
}

function makeGateWithConsumption(event) {
  return makeGate(makeRecord(), {
    consumption: { [RECORD_ID]: event },
    integrity: { recordIds: [RECORD_ID], consumptionIds: [RECORD_ID] },
  });
}

function makeOnContext(overrides = {}) {
  return {
    comment: { commentAuthor: PO, commentBody: "/approve", isPullRequest: true },
    pr: { state: "open", draft: false, baseRef: "main", headSha: HEAD_SHA },
    checks: GREEN_CHECKS_T15,
    reviews: [],
    flagEnabled: true,
    ...overrides,
  };
}

describe("C2 — assertPullRequestEvent (camada 2)", () => {
  test("evento nulo → STOP", () => {
    expect(assertPullRequestEvent(null).ok).toBe(false);
  });

  test("evento sem issue → STOP", () => {
    expect(assertPullRequestEvent({}).ok).toBe(false);
  });

  test("comentário em Issue comum (issue sem pull_request) → STOP", () => {
    const result = assertPullRequestEvent({ issue: { number: 7 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pull request \(C2\)/);
  });

  test("comentário em PR (issue.pull_request presente) → ok", () => {
    expect(
      assertPullRequestEvent({ issue: { number: 7, pull_request: { url: "u" } } }).ok,
    ).toBe(true);
  });
});

describe("C1 — validateApprovalProvenance", () => {
  test("APPROVED + bot + SHA atual → ok com approval_ref = id exato", () => {
    const result = validateApprovalProvenance({ reviews: [BOT_APPROVAL], prHeadSha: HEAD_SHA });
    expect(result.ok).toBe(true);
    expect(result.approvalRef).toBe("424242");
  });

  test("sem reviews → STOP", () => {
    expect(validateApprovalProvenance({ reviews: [], prHeadSha: HEAD_SHA }).ok).toBe(false);
  });

  test("prHeadSha ausente → STOP", () => {
    const result = validateApprovalProvenance({ reviews: [BOT_APPROVAL], prHeadSha: "" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pr_head_sha/);
  });

  test("somente CHANGES_REQUESTED → STOP", () => {
    const result = validateApprovalProvenance({
      reviews: [{ id: 1, state: "CHANGES_REQUESTED", user: { login: BOT }, commit_id: HEAD_SHA }],
      prHeadSha: HEAD_SHA,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/aprovação C1 ausente/);
  });

  test("aprovação humana (login ≠ bot) → STOP", () => {
    const result = validateApprovalProvenance({
      reviews: [{ id: 2, state: "APPROVED", user: { login: PO }, commit_id: HEAD_SHA }],
      prHeadSha: HEAD_SHA,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/aprovação C1 ausente/);
  });

  test("bot aprovou SHA antigo → STOP", () => {
    const result = validateApprovalProvenance({
      reviews: [{ ...BOT_APPROVAL, commit_id: "0000000000000000000000000000000000000000" }],
      prHeadSha: HEAD_SHA,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/aprovação C1 ausente/);
  });

  test("bot match encontra a review correta entre reviews misturadas", () => {
    const result = validateApprovalProvenance({
      reviews: [
        { id: 1, state: "COMMENTED", user: { login: "someone" }, commit_id: HEAD_SHA },
        BOT_APPROVAL,
        { id: 3, state: "CHANGES_REQUESTED", user: { login: BOT }, commit_id: HEAD_SHA },
      ],
      prHeadSha: HEAD_SHA,
    });
    expect(result.ok).toBe(true);
    expect(result.approvalRef).toBe("424242");
  });

  test("review válida sem id → STOP (approval_ref nunca vazio)", () => {
    const result = validateApprovalProvenance({
      reviews: [{ state: "APPROVED", user: { login: BOT }, commit_id: HEAD_SHA }],
      prHeadSha: HEAD_SHA,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sem id utilizável/);
  });
});

describe("Schema estrito — record (17 campos) e consumo (7 campos)", () => {
  test("record com exatamente os 17 campos → ok", () => {
    expect(validateRecordSchema(makeRecord()).ok).toBe(true);
  });

  test("campo extra (18) → STOP", () => {
    const result = validateRecordSchema({ ...makeRecord(), extra: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/17 campos/);
  });

  test("campo faltando (16) → STOP", () => {
    const { expires_at: _omit, ...rest } = makeRecord();
    const result = validateRecordSchema(rest);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/17 campos/);
  });

  test("record não-objeto (null / array / string) → STOP", () => {
    expect(validateRecordSchema(null).ok).toBe(false);
    expect(validateRecordSchema([]).ok).toBe(false);
    expect(validateRecordSchema("record").ok).toBe(false);
  });

  test("campo obrigatório vazio → STOP", () => {
    const result = validateRecordSchema(makeRecord({ artifact_ref: "" }));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/artifact_ref/);
  });

  test("evidence_refs não-array → STOP", () => {
    const result = validateRecordSchema(makeRecord({ evidence_refs: "docs/audit" }));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/evidence_refs/);
  });

  test("consumo com exatamente os 7 campos → ok", () => {
    expect(validateConsumptionSchema(makeConsumption()).ok).toBe(true);
  });

  test("consumo com campo extra → STOP", () => {
    const result = validateConsumptionSchema({ ...makeConsumption(), extra: "x" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/campos extras\/faltantes/);
  });

  test("consumo com campo faltando → STOP", () => {
    const { approval_ref: _omit, ...rest } = makeConsumption();
    const result = validateConsumptionSchema(rest);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/campos extras\/faltantes/);
  });

  test("consumo com valor não-string → STOP", () => {
    const result = validateConsumptionSchema({ ...makeConsumption(), consumed_at: 123 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/campo do consumo inválido: consumed_at/);
  });
});

describe("C3 — computeGrantRef + assertGrantImmutability", () => {
  test("exatamente 1 commit de emissão → grant_ref", () => {
    const result = computeGrantRef({ commits: [GRANT_SHA] });
    expect(result.ok).toBe(true);
    expect(result.grantRef).toBe(GRANT_SHA);
  });

  test("0 commits (sem histórico) → STOP", () => {
    const result = computeGrantRef({ commits: [] });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/nenhum commit/);
  });

  test("lista não-array → STOP", () => {
    expect(computeGrantRef({ commits: null }).ok).toBe(false);
  });

  test("N > 1 commits (histórico ambíguo) → STOP", () => {
    const result = computeGrantRef({ commits: [GRANT_SHA, GRANT_SHA] });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ambíguo/);
  });

  test("SHA inválido → STOP", () => {
    const result = computeGrantRef({ commits: ["not-a-sha!"] });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/inválido/);
  });

  test("blob shas idênticos (S_emit == S_head) → imutabilidade provada", () => {
    expect(
      assertGrantImmutability({ headBlobSha: "blob-x", emissionBlobSha: "blob-x" }).ok,
    ).toBe(true);
  });

  test("blob shas divergentes → STOP", () => {
    const result = assertGrantImmutability({ headBlobSha: "blob-a", emissionBlobSha: "blob-b" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/S_emit != S_head/);
  });

  test("blob sha ausente em qualquer lado → STOP", () => {
    expect(
      assertGrantImmutability({ headBlobSha: null, emissionBlobSha: "blob-x" }).ok,
    ).toBe(false);
    expect(
      assertGrantImmutability({ headBlobSha: "blob-x", emissionBlobSha: null }).ok,
    ).toBe(false);
  });
});

describe("Gate de record — validateAuthorizationRecord", () => {
  test("único candidato válido granted → ok com record", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord()],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.record.record_id).toBe(RECORD_ID);
  });

  test("records vazio → STOP (§8-4)", () => {
    expect(
      validateAuthorizationRecord({ records: [], prHeadSha: HEAD_SHA, now: NOW }).ok,
    ).toBe(false);
  });

  test("store não-array → STOP", () => {
    expect(
      validateAuthorizationRecord({ records: null, prHeadSha: HEAD_SHA, now: NOW }).ok,
    ).toBe(false);
  });

  test("artifact_ref ≠ pr_head_sha → STOP (§8-7)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ artifact_ref: "ffffffffffffffffffffffffffffffffffffffff" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/nenhum record T15 candidato/);
  });

  test("transition ≠ T15 → STOP (§8-9)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ transition: "T14" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/nenhum record T15 candidato/);
  });

  test("múltiplos candidatos → STOP (§8-5)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord(), makeRecord({ record_id: "ar-20260925-002-merge" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/múltiplos records T15/);
  });

  test("target ≠ main → STOP (§8-8)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ target: "develop" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/target deve ser main/);
  });

  test("environment ≠ n/a → STOP (§8-8)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ environment: "staging" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/environment deve ser n\/a/);
  });

  test("status ≠ granted → STOP (§8-6)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ status: "revoked" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/não é granted/);
  });

  test("front_id ausente → STOP (§8-10)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ front_id: "" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/front_id/);
  });

  test("record expirado (now > expires_at) → STOP (§8-11)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ expires_at: "2026-01-01T00:00:00.000Z" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expirado/);
  });

  test("expires_at inválido → STOP (§8-11)", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ expires_at: "not-a-date" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expirado/);
  });

  test("expires_at futuro → ok", () => {
    const result = validateAuthorizationRecord({
      records: [makeRecord({ expires_at: "2026-12-31T00:00:00.000Z" })],
      prHeadSha: HEAD_SHA,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  test("expires_at null (sem expiração) → ok", () => {
    expect(
      validateAuthorizationRecord({ records: [makeRecord()], prHeadSha: HEAD_SHA, now: NOW }).ok,
    ).toBe(true);
  });
});

describe("Consumo — target / CREATE-only / cross-refs / integridade / 422", () => {
  test("target exato (branch + path determinístico) → ok", () => {
    const result = assertConsumptionTarget({
      ref: "smg-gate-consumption",
      path: `docs/consumption/${RECORD_ID}.json`,
      recordId: RECORD_ID,
    });
    expect(result.ok).toBe(true);
  });

  test("branch errada (além do privilégio concedido) → STOP", () => {
    const result = assertConsumptionTarget({
      ref: "smg-gate-records",
      path: `docs/consumption/${RECORD_ID}.json`,
      recordId: RECORD_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ref de consumo inválido/);
  });

  test("path errado (fora do determinístico) → STOP", () => {
    const result = assertConsumptionTarget({
      ref: "smg-gate-consumption",
      path: "docs/consumption/other.json",
      recordId: RECORD_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/path de consumo inválido/);
  });

  test("CREATE → ok; UPDATE/DELETE → STOP", () => {
    expect(assertCreateOnly("CREATE").ok).toBe(true);
    expect(assertCreateOnly("UPDATE").ok).toBe(false);
    expect(assertCreateOnly("DELETE").ok).toBe(false);
  });

  test("cross-refs completos → ok", () => {
    expect(
      assertCrossReferences({ event: makeConsumption(), expected: EXPECTED_CROSS_REFS }).ok,
    ).toBe(true);
  });

  test("qualquer cross-ref divergente → STOP (§8-15)", () => {
    for (const field of Object.keys(EXPECTED_CROSS_REFS)) {
      const expected = { ...EXPECTED_CROSS_REFS, [field]: "divergente" };
      const result = assertCrossReferences({ event: makeConsumption(), expected });
      expect(result.ok, field).toBe(false);
      expect(result.reason, field).toContain(`cross-ref divergente em ${field}`);
    }
  });

  test("evento malformado → STOP (schema)", () => {
    const result = assertCrossReferences({
      event: { record_id: RECORD_ID },
      expected: EXPECTED_CROSS_REFS,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/schema do evento de consumo inválido/);
  });

  test("integridade: consumo sem grant (órfão) → STOP (§8-16)", () => {
    const result = validateStoreIntegrity({
      recordIds: [RECORD_ID],
      consumptionIds: [RECORD_ID, "ghost"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/órfão/);
  });

  test("integridade: todo consumo tem grant → ok", () => {
    expect(
      validateStoreIntegrity({ recordIds: [RECORD_ID], consumptionIds: [RECORD_ID] }).ok,
    ).toBe(true);
    expect(validateStoreIntegrity({ recordIds: [], consumptionIds: [] }).ok).toBe(true);
  });

  test("created → ok", () => {
    expect(
      resolveConsumptionWriteResult({
        created: true,
        alreadyExists: false,
        existingEvent: null,
        expected: EXPECTED_CROSS_REFS,
      }).ok,
    ).toBe(true);
  });

  test("escrita falhou sem 422 → STOP", () => {
    const result = resolveConsumptionWriteResult({
      created: false,
      alreadyExists: false,
      existingEvent: null,
      expected: EXPECTED_CROSS_REFS,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sem 422/);
  });

  test("422 sem re-read legível → STOP", () => {
    const result = resolveConsumptionWriteResult({
      created: false,
      alreadyExists: true,
      existingEvent: null,
      expected: EXPECTED_CROSS_REFS,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/re-read/);
  });

  test("422 + re-read com cross-refs completos → NOOP nível 2 (2º consumo)", () => {
    const result = resolveConsumptionWriteResult({
      created: false,
      alreadyExists: true,
      existingEvent: makeConsumption(),
      expected: EXPECTED_CROSS_REFS,
    });
    expect(result.ok).toBe(false);
    expect(result.noop).toBe(true);
    expect(result.reason).toMatch(/idempotência nível 2/);
  });

  test("422 + re-read divergente → STOP (anomalia, nunca NOOP)", () => {
    const result = resolveConsumptionWriteResult({
      created: false,
      alreadyExists: true,
      existingEvent: makeConsumption({
        grant_ref: "ffffffffffffffffffffffffffffffffffffffff",
      }),
      expected: EXPECTED_CROSS_REFS,
    });
    expect(result.ok).toBe(false);
    expect(result.noop).not.toBe(true);
    expect(result.reason).toMatch(/divergentes/);
  });
});

describe("buildDecision flag ON — máquina de estados T15 (§7)", () => {
  test("granted sem aprovação → ok, needsApproval true, cross-refs completos", () => {
    const decision = buildDecision(makeOnContext({ recordGate: makeGate() }));
    expect(decision.ok).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.approvalRef).toBeNull();
    expect(decision).toMatchObject({
      recordId: RECORD_ID,
      grantRef: GRANT_SHA,
      prHeadSha: HEAD_SHA,
      target: "main",
    });
  });

  test("granted + aprovação C1 válida → ok, SEM novo POST (needsApproval false)", () => {
    const decision = buildDecision(
      makeOnContext({ reviews: [BOT_APPROVAL], recordGate: makeGate() }),
    );
    expect(decision.ok).toBe(true);
    expect(decision.needsApproval).toBe(false);
    expect(decision.approvalRef).toBe("424242");
  });

  test("aprovação existente divergente (humano) → STOP duro, nunca NOOP", () => {
    const decision = buildDecision(
      makeOnContext({
        reviews: [{ id: 1, state: "APPROVED", user: { login: PO }, commit_id: HEAD_SHA }],
        recordGate: makeGate(),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).not.toBe(true);
    expect(decision.reason).toMatch(/idempotência C1/);
  });

  test("aprovação bot em SHA antigo → STOP duro, nunca NOOP", () => {
    const decision = buildDecision(
      makeOnContext({
        reviews: [
          { ...BOT_APPROVAL, commit_id: "0000000000000000000000000000000000000000" },
        ],
        recordGate: makeGate(),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).not.toBe(true);
    expect(decision.reason).toMatch(/idempotência C1/);
  });

  test("head SHA ausente no modo record → STOP", () => {
    const decision = buildDecision(
      makeOnContext({
        pr: { state: "open", draft: false, baseRef: "main" },
        recordGate: makeGate(),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/head SHA ausente/);
  });

  test("recordGate ausente com flag ON → STOP", () => {
    const decision = buildDecision(makeOnContext());
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/record gate não avaliado/);
  });

  test("store inacessível (recordGate.error) → STOP (§8-14)", () => {
    const decision = buildDecision(makeOnContext({ recordGate: { error: "HTTP 500" } }));
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/store inacessível/);
  });

  test("consumo órfão no store → STOP (§8-16)", () => {
    const decision = buildDecision(
      makeOnContext({
        recordGate: makeGate(makeRecord(), {
          integrity: { recordIds: [RECORD_ID], consumptionIds: ["ghost"] },
        }),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/órfão/);
  });

  test("estado consumed (consumo + cross-refs ok + C1) → NOOP nível 2", () => {
    const decision = buildDecision(
      makeOnContext({
        reviews: [BOT_APPROVAL],
        recordGate: makeGateWithConsumption(makeConsumption()),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).toBe(true);
    expect(decision.reason).toMatch(/já consumido/);
  });

  test("consumo existente sem aprovação revalidável → STOP anomalia (§8-3)", () => {
    const decision = buildDecision(
      makeOnContext({ recordGate: makeGateWithConsumption(makeConsumption()) }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).not.toBe(true);
    expect(decision.reason).toMatch(/anomalia/);
    expect(decision.reason).toMatch(/approval_ref/);
  });

  test("consumo existente com grant_ref divergente → STOP anomalia (§8-13)", () => {
    const decision = buildDecision(
      makeOnContext({
        reviews: [BOT_APPROVAL],
        recordGate: makeGateWithConsumption(
          makeConsumption({
            grant_ref: "ffffffffffffffffffffffffffffffffffffffff",
          }),
        ),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).not.toBe(true);
    expect(decision.reason).toMatch(/anomalia/);
    expect(decision.reason).toMatch(/grant_ref/);
  });

  test("consumo existente com target divergente → STOP anomalia (§8-15)", () => {
    const decision = buildDecision(
      makeOnContext({
        reviews: [BOT_APPROVAL],
        recordGate: makeGateWithConsumption(makeConsumption({ target: "staging" })),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/anomalia/);
    expect(decision.reason).toMatch(/target/);
  });

  test("imutabilidade violada (S_emit ≠ S_head) → STOP (§8-12)", () => {
    const decision = buildDecision(
      makeOnContext({
        recordGate: makeGate(makeRecord(), {
          grantRefs: {
            [RECORD_ID]: {
              commits: [GRANT_SHA],
              headBlobSha: "blob-a",
              emissionBlobSha: "blob-b",
            },
          },
        }),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/S_emit != S_head/);
  });

  test("grant_ref ambíguo (N > 1 commits) → STOP (§8-12)", () => {
    const decision = buildDecision(
      makeOnContext({
        recordGate: makeGate(makeRecord(), {
          grantRefs: {
            [RECORD_ID]: {
              commits: [GRANT_SHA, GRANT_SHA],
              headBlobSha: "blob-x",
              emissionBlobSha: "blob-x",
            },
          },
        }),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/ambíguo/);
  });

  test("gates legados continuam STOP com flag ON (autor ≠ PO) (§8-17)", () => {
    const decision = buildDecision(
      makeOnContext({
        comment: { commentAuthor: "hacker", commentBody: "/approve", isPullRequest: true },
        recordGate: makeGate(),
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/autor não autorizado/);
  });

  test("flag OFF — implementação inerte: ignora stores e usa caminho legado", () => {
    const decision = buildDecision(makeOnContext({ flagEnabled: false }));
    expect(decision.ok).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.recordId).toBeUndefined();
  });

  test("flag OFF + aprovação existente → NOOP legado (inalterado)", () => {
    const decision = buildDecision(
      makeOnContext({
        flagEnabled: false,
        reviews: [{ user: { login: BOT }, state: "APPROVED" }],
      }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.noop).toBe(true);
  });
});

describe("Matriz STOP consolidada (design §8 — 18 condições)", () => {
  // §8-18 (invariante P.02) é verificada em workflow.test.mjs.
  test("§8-1..§8-17 — toda condição STOP produz falha fail-closed (nunca NOOP)", () => {
    const cases = [
      ["1 evento não-PR", () => assertPullRequestEvent({ issue: {} })],
      [
        "2 C1 divergente (SHA antigo)",
        () =>
          validateApprovalProvenance({
            reviews: [{ state: "APPROVED", user: { login: BOT }, commit_id: "stale" }],
            prHeadSha: HEAD_SHA,
          }),
      ],
      [
        "3 approval_ref ≠ review validada",
        () =>
          assertCrossReferences({
            event: makeConsumption({ approval_ref: "9" }),
            expected: EXPECTED_CROSS_REFS,
          }),
      ],
      ["4 zero records candidatos", () => validateAuthorizationRecord({ records: [], prHeadSha: HEAD_SHA, now: NOW })],
      [
        "5 múltiplos records candidatos",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord(), makeRecord({ record_id: "ar-002" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "6 estado ≠ granted",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ status: "revoked" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "7 artifact_ref ≠ pr_head_sha",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ artifact_ref: "f".repeat(40) })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "8 target ≠ main",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ target: "develop" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "8b environment ≠ n/a",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ environment: "prod" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "9 transition ≠ T15",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ transition: "T16" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "10 front_id ausente",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ front_id: "" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      [
        "11 now > expires_at",
        () =>
          validateAuthorizationRecord({
            records: [makeRecord({ expires_at: "2020-01-01T00:00:00.000Z" })],
            prHeadSha: HEAD_SHA,
            now: NOW,
          }),
      ],
      ["12 grant_ref ambíguo (N>1)", () => computeGrantRef({ commits: [GRANT_SHA, GRANT_SHA] })],
      [
        "13 grant_ref gravado ≠ recomputado",
        () =>
          assertCrossReferences({
            event: makeConsumption({ grant_ref: "f".repeat(40) }),
            expected: EXPECTED_CROSS_REFS,
          }),
      ],
      ["14 store inacessível", () => buildDecision(makeOnContext({ recordGate: { error: "x" } }))],
      [
        "15 consumo presente com cross-refs inválidos",
        () =>
          assertCrossReferences({
            event: makeConsumption({ target: "staging" }),
            expected: EXPECTED_CROSS_REFS,
          }),
      ],
      [
        "16 consumo órfão (presente sem grant)",
        () => validateStoreIntegrity({ recordIds: [], consumptionIds: ["ghost"] }),
      ],
      [
        "17 demais gates legados (PO/checks)",
        () =>
          buildDecision(
            makeOnContext({
              comment: { commentAuthor: "intruso", commentBody: "/approve", isPullRequest: true },
              recordGate: makeGate(),
            }),
          ),
      ],
    ];
    for (const [label, run] of cases) {
      const result = run();
      expect(result.ok, label).toBe(false);
      expect(result.noop, label).not.toBe(true);
      expect(result.reason, label).toBeTruthy();
    }
  });
});
