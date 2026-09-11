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
      {
        label: "já aprovado",
        overrides: { reviews: [{ user: { login: "review-bot-smg" }, state: "APPROVED" }] },
      },
    ];
    for (const { label, overrides } of cases) {
      expect(buildDecision({ ...GOOD_CONTEXT, ...overrides }).ok, label).toBe(false);
    }
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
});