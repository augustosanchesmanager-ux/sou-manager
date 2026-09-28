# CI FINDING-01/02 — Cobertura de lint incompleta e máscara de guards em `architecture:ci`

**Data:** 2026-09-28
**Frente:** `DOC-AGENTS-01` (refatoração do `AGENTS.md`)
**Origem:** achados de auditoria produzidos durante a redução do `AGENTS.md` (915 → 221 linhas)
**Decisões do PO (2026-09-28):** A1 (não restaurar subscribers financeiros) + **B1 (registrar estes findings em `docs/audit/`)**
**Classificação:** achado de auditoria de CI — **correção NÃO autorizada nesta frente**

---

## FINDING-CI-01 — Cobertura de lint incompleta

**EVIDENCE:**

- `package.json` → `"lint": "biome check src/ --no-errors-on-unmatched"` — escopo restrito a `src/`.
- `biome.json` → `"formatter": { "enabled": false }` (nenhum formatter ativo).
- Árvores de código fora de `src/` e **não lintadas**: `domain/`, `application/`, `components/`, `pages/`, `hooks/`, `services/` (raiz).
- `.github/workflows/ci.yml` → job `lint` é **advisory** (`continue-on-error: true`).

**INTERPRETATION:**

O gate advisory de lint não cobre a maior parte do código do repositório. Resultado verde de `npm run lint` **não** significa repo limpo — significa apenas que `src/` passou.

**GAP:**

- Não foi medida a magnitude (quantos problemas existiriam hoje fora de `src/`).
- Não foi decidido se o alargamento do escopo é desejado (eco de regras de estilo vs. ruído em código legado).

**DECISION:** registrar (PO, 2026-09-28). Correção pendente de decisão PO — qualquer alteração de lint/CI segue a regra de mudança estrutural (ADR).

**STATUS:** STOP (para a frente `DOC-AGENTS-01`)

---

## FINDING-CI-02 — `architecture:ci` mascara falhas dos guards

**EVIDENCE (reprod. 2026-09-28, Windows):**

| Comando | Exit code | Saída relevante |
|---|---|---|
| `node scripts/architecture/check.mjs --ci --baseline` | **0** | `All architecture guards passed.` · `Total: 0 error(s), 2 warning(s)` · baseline `repositoryViolations: 233 ↓ 227`, `forbiddenImports: 0 = 0`, `circularImports: 0 = 0` |
| `node scripts/architecture/guard-imports.mjs` | **1** | `[Components → Supabase] components/billing/StatusBanner.tsx → ../../src/lib/supabase/tenant` · `Total: 1 error(s), 0 warning(s).` |
| `node scripts/architecture/guard-circular.mjs` | **1** | `Found 1 circular dependency!` · `1) domain/billing/repository.ts > domain/billing/supabaseBillingRepository.ts` · `Processed 621 files` |

- `scripts/architecture/check.mjs` (`countViolations`) casa apenas o padrão `Total:\s*(\d+)\s*violation`.
- Os dois guards acima reportam `Total: N error(s)` / `Found N circular dependency` → a contagem resulta em **0** → no modo baseline, `0 <= baseline(0)` → **PASS**.

**INTERPRETATION:**

O gate **bloqueador** `architecture:ci` (ADR-022) pode estar verde com violações reais. Hoje existem, ao mesmo tempo: **1 forbidden import** e **1 circular dependency** detectados pelos guards individuais, e o gate agregado retorna 0. Risco: regressões de arquitetura idênticas passariam despercebidas pelo CI.

**GAP:**

- Quando a máscara foi introduzida (não bisectado).
- Se outros guards/formatos de saída são afetados (apenas os três do runner foram inspecionados).

**DECISION (PO, 2026-09-28):** corrigir o runner é **mudança de CI → exige PO + ADR** (regra ADR-022/024; ADR-024 está *Proposed*). **Não corrigido nesta frente.**

**STATUS:** STOP (para a frente `DOC-AGENTS-01`)

---

## Encaminhamento

- Correção dos dois findings = **frente futura separada**, com decisão PO + ADR (não misturar com `DOC-AGENTS-01`).
- Contexto: `AGENTS.md` §5 "Armadilhas de verificação" (registro operacional imediato para agentes), `docs/adr/ADR-022-ci-policy-quality-gates.md`, `docs/adr/ADR-024-ci-workflow-regularization.md` (*Proposed*), `docs/runbooks/ci-gate-override.md`.
- Os dois findings **não** são defeitos introduzidos pela refatoração do `AGENTS.md`; são lacunas pré-existentes descobertas durante ela.
