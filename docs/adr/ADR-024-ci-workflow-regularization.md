# ADR-024: Regularização dos CI Workflows + Política Operacional de Override

**Status:** Proposed (awaiting PO approval via PR)
**Date:** 2026-09-21
**Deciders:** PO (Augusto) + OpenCode
**G0:** FASE 6 — Production Readiness, follow-up do item 6.1 (CI/CD); saneamento de governance drift identificado em R5-AUDIT
**References:** ADR-022 (política original); `docs/audit/M5_R5_AUDIT_*.md` (audit que identificou o gap); `docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md` (contexto da automação de PR approve); `docs/runbooks/ci-gate-override.md` (runbook operacional companheiro); `AGENTS.md` (regra "Sem ADR, nenhuma mudança estrutural poderá ser feita")

---

## Context

ADR-022 foi aceito em **2026-09-03** com cláusula explícita (§117):

> "Este ADR **não** autoriza: criação de `.github/workflows`; alteração de arquivos de CI; configuração de branch protection"

Posteriormente, **três workflows** foram adicionados em `.github/workflows/`:

| Workflow | Trigger | Função |
|----------|---------|--------|
| `ci.yml` | `pull_request`, `push` em `main` | CI pipeline: `typecheck`, `build`, `unit`, `architecture:ci`, `lint` (advisory), `validate` (agregado) |
| `smg-approve.yml` | `issue_comment` (`/approve`) | Automação de aprovação de PR via review executor `review-bot-smg` |
| `test.yml` | `push` em `main` | Stub: `echo "hello"` (dead code) |

Esses workflows estão **funcionais em produção**:
- Branch protection server-side em `main` **exige** o check `validate` (que depende dos gates M4 do `ci.yml`)
- O workflow `smg-pr-approve` é o mecanismo operacional de aprovação do PR approve automation (per `docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md`)
- 5/5 CI runs recentes: success (2026-09-19 a 2026-09-21)

Esses workflows foram criados via commits `feat(ci)` e `feat(pr-approve)` **sem ADR de follow-up formal** autorizando-os.

---

## Problem

Existe **drift de governance**:
- A política oficial (ADR-022 §117) **proíbe** criação de `.github/workflows/`
- O estado operacional **viola** essa proibição (workflows existem e protegem `main`)
- **Remover os workflows** seria uma reação perigosa — quebraria proteção funcional de `main`
- **Não fazer nada** mantém o gap de governance, expondo o projeto a auditorias futuras

A solução não é **reverter** o estado funcional; é **reconciliar formalmente** a política com a realidade operacional.

---

## Decision

O PO aprova:

### 1. Autorização retroativa dos workflows existentes

Os seguintes workflows em `.github/workflows/` ficam **formalmente autorizados** por este ADR:

- **`ci.yml`** — CI pipeline (gates obrigatórios ADR-022 §18: `typecheck` + `build` + `unit` + `architecture:ci`)
- **`smg-approve.yml`** — PR approve automation (review executor `review-bot-smg`)
- **`test.yml`** — stub (decisão separada pendente — R5.6 do preflight)

Esses workflows passam a ser **parte oficial da implementação 6.1** (CI/CD) do projeto.

### 2. Política prospectiva (forward policy)

**Toda criação ou modificação de `.github/workflows/` requer ADR de follow-up explícito** (analogamente à regra do `AGENTS.md` "Sem ADR, nenhuma mudança estrutural poderá ser feita"). O ADR de follow-up deve:

- Especificar qual workflow está sendo criado/alterado
- Justificar a mudança (funcionalidade, gate novo, fix)
- Especificar os gates / triggers / secrets envolvidos
- Referenciar ADRs anteriores (se for extensão) ou justificar greenfield

### 3. Atualização da cláusula ADR-022 §117

A cláusula restritiva original de ADR-022 §117 é **atualizada retroativamente** por este ADR-024 para:

> "Este ADR **não** autoriza — sem ADR de follow-up explícito — criação ou alteração de `.github/workflows/`, alteração de arquivos de CI, configuração de branch protection, alteração de regras do GitHub, alteração de configurações da Vercel, alteração de variáveis de ambiente, alteração de banco, criação ou alteração de migrations, alteração de código de aplicação, alteração da suíte de testes, push de implementação, deploy de qualquer natureza, certificação da 6.1."

A diferença semântica: **gate de ADR explícito** ao invés de **proibição absoluta**.

### 4. Política operacional de override

A política conceitual de override de gates (ADR-022 §72-82) é **operacionalizada** em `docs/runbooks/ci-gate-override.md`, que define:
- Quando pode haver override (apenas falhas de infraestrutura, não de lógica)
- Quem pode autorizar (exclusivamente o PO)
- Como registrar (audit trail)
- Como prevenir bypass informal

---

## Alternatives Considered

| Opção | Descrição | Veredito |
|-------|-----------|----------|
| **A — Remover workflows existentes** | Cumprir literalmente §117, remover `.github/workflows/`, voltar ao "estado pré-ADR" | ❌ **Rejeitado**: quebraria proteção funcional de `main` (branch protection exige `validate`, que depende do `ci.yml`) |
| **B — Emendar ADR-022 diretamente** | Adicionar texto à §117 modificando seu significado | ❌ **Rejeitado**: ADR são imutáveis por convenção (cada ADR registra decisão em momento específico) |
| **C — Criar ADR-024 (este ADR) + runbook** | Autoriza retroativamente + atualiza cláusula + operacionaliza override | ✅ **Aceito** |
| **D — Não fazer nada** | Aceitar o drift de governance | ❌ **Rejeitado**: gap de auditoria persiste |

---

## Consequences

### O que muda

1. ADR-024 (este) **autoriza retroativamente** `.github/workflows/ci.yml`, `.github/workflows/smg-approve.yml`, `.github/workflows/test.yml` (test.yml pendente R5.6).
2. **ADR-022 §117 atualizada** (via ADR-024) passa a permitir workflows **condicionados a ADR de follow-up**.
3. **Política operacional de override** documentada em `docs/runbooks/ci-gate-override.md`.
4. **Precedente estabelecido**: ADRs podem ser emendados/atualizados via ADR de follow-up explícito (princípio de imutabilidade preservado, semântica evoluindo).

### O que NÃO muda

- Nenhuma alteração em código funcional de aplicação
- Nenhuma alteração em migrations / RPCs / RLS / grants
- Nenhuma alteração em branch protection server-side (já configurada; ADR-024 apenas reconcilia documentação)
- Nenhuma criação de workflows novos (apenas autorização retroativa)
- Nenhuma alteração em `docs/adr/README.md` além da adição do link para ADR-024
- Nenhuma escrita em PROD
- Nenhum commit/push/merge (gate R5-PR-1 separado, com `/approve` do PO)

---

## Implementation Plan (sequência)

```
R5-IMPLEMENT-1 (este ADR + runbook)         ✅ autorizado nesta mensagem
   ↓
R5-VALIDATE-1 (gates locais: typecheck, build, vitest finance, architecture:ci)
   ↓
R5-COMMIT-1 (git commit local apenas)
   ↓
R5-PR-1 (gh pr create — sem merge; requer /approve do PO)
   ↓
STOP PO (await /approve explícito)
```

Cada etapa preserva a possibilidade de STOP se for identificado risco não previsto.

---

## Critério de sucesso (gate R5-IMPLEMENT-1)

- ✅ ADR-024 (este) criado em `docs/adr/ADR-024-ci-workflow-regularization.md`
- ✅ `docs/runbooks/ci-gate-override.md` criado
- ✅ `docs/adr/README.md` atualizado com link para ADR-024
- ✅ `git status` mostra apenas 3 novos arquivos (nenhuma alteração em código funcional)
- ✅ CI gates locais (`npm run typecheck`, `npm run build`, `npm run vitest run src/lib/finance/`, `npm run architecture:ci`) passam
- ✅ `git diff --stat` vazio em arquivos tracked (exceto 3 novos)

A certificação da **6.1** permanece **separada** (depende de R5-IMPLEMENT 2-N com E2E, CODEOWNERS, dependabot, etc.).

---

## References

- ADR-022 — Política original (sua §117 é atualizada retroativamente por este ADR)
- `docs/audit/M5_R5_AUDIT_*.md` — audit que identificou o gap de governance
- `docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md` — automação PR approve (PR #37)
- `docs/runbooks/ci-gate-override.md` — runbook operacional de override
- `AGENTS.md` — princípio "Sem ADR, nenhuma mudança estrutural" (base normativa para a forward policy)
- ADR-010 — Architecture Guards (referência para `architecture:ci` gate)
- ADR-021 — RPC Tenant-Scoped Authorization (referência para gates de tenant)
