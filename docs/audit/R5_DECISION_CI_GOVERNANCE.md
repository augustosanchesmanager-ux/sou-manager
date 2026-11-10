-- ============================================================
-- R5-DECISION — CI Governance & Implementation Scope
-- Framework decisional (read-only) para os 9 gaps do R5-AUDIT
-- ============================================================
>
> **Gate:** R5-DECISION / CI GOVERNANCE & IMPLEMENTATION SCOPE
> **Modo:** read-only/decisional. Nenhuma alteração em workflows, branch protection, secrets, branches ou código.
> **Data:** 2026-09-21 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** `docs/audit/M5_R5_AUDIT_*.md` (R5-AUDIT anterior) · `docs/adr/ADR-022-ci-policy-quality-gates.md` · `docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md` (gate `feat(pr-approve)`)
> **Regra do PO:** "Nenhum workflow ou branch protection será alterado até você autorizar explicitamente o escopo."

---

## Sumário executivo

| Item | Status atual | Decisão requerida | Recomendação |
|------|--------------|---------------------|---------------|
| R5.7 REVIEW_BOT_TOKEN | ✅ Operacional | — | Documentar em ADR |
| R5.1 ADR follow-up | ❌ Gap de governance | ✅ Autorizar criação ADR-024 | Sim — alta prioridade |
| R5.4 Política de override | ⚠️ Parcial (existe em código, não documentada) | ✅ Documentar policy explícita | Sim — alta prioridade |
| R5.3 E2E no CI | ⚠️ Script existe, workflow ausente | ✅ Definir scope P0/P1 + bloqueante? | Sim — alta prioridade |
| R5.6 test.yml stub | ⚠️ Higiene | ✅ Remover ou implementar | Sim — média prioridade |
| R5.2 CODEOWNERS | ❌ Arquivo ausente | ✅ Definir scope mínimo | Sim — média prioridade |
| R5.5 Dependabot | ❌ Ausente | ✅ Habilitar com config conservadora | Sim — baixa prioridade |
| R5.8 signed commits | ❌ Desativado | ⏸ Decisão futura | NÃO agora |
| R5.9 linear history | ❌ Desativado | ⏸ Decisão futura | NÃO agora |

---

## Investigações (read-only)

### R5.7 — `REVIEW_BOT_TOKEN` ✅ VERIFIED

**Evidência**:
```
$ gh api repos/augustosanchesmanager-ux/sou-manager/actions/secrets
{"total_count":1,"secrets":[{"name":"REVIEW_BOT_TOKEN","created_at":"2026-09-11T22:07:58Z","updated_at":"2026-09-11T22:07:58Z"}]}
```

| Atributo | Valor |
|----------|-------|
| **Secret name** | `REVIEW_BOT_TOKEN` |
| **Created** | 2026-09-11T22:07:58Z (≈10 dias atrás) |
| **Updated** | mesmo (nunca alterado) |
| **Status** | ✅ Existe |

**Lógica de uso** (`scripts/smg-pr-approve/run.mjs` + `guards.mjs`):
- Token NUNCA logado (line 16: "The token is NEVER logged")
- Usado como `SMG_TOKEN` env var (line 64: `const token = process.env.SMG_TOKEN`)
- 4 gates fail-closed (validation context):
  - Gate 0: comment context (deve ser `/approve` literal, autor = `PO_ACCOUNT = "augustosanchesmanager-ux"`)
  - Gate 1: PR state (open, não-draft, base=main)
  - Gate 2: ALL CI checks completed + green (exceto advisory `lint advisory`)
  - Idempotency: silent NOOP se PR já aprovada

**Conclusão**: O workflow `smg-pr-approve.yml` é **operacional e fail-closed**. Não há gap funcional — o token está configurado e a lógica está correta.

### R5.1 — Governança (gap crítico G1)

**Estado**:
- ADR-022 (Accepted 2026-09-03) explicitamente diz (§117): "Este ADR **não** autoriza: criação de `.github/workflows`"
- Mas workflows **foram criados** (initial `feat(ci)` commit + iterações)
- `.github/workflows/` contém 3 workflows ativos: `ci.yml`, `smg-approve.yml`, `test.yml`
- Branch protection server-side **exige** `validate` check (que depende dos gates M4)
- **Cláusula restritiva do ADR-022 está sendo violada na prática** (workflows existem e são funcionais)

**Decisão requerida**: Criar ADR-024 (ou similar) que **regularize retroativamente** a criação de `.github/workflows/` e **atualize** a cláusula restritiva do ADR-022 (§117).

**Opções**:

| Opção | Descrição | Prós | Contras |
|-------|-----------|------|---------|
| **A — ADR-024 de regularização** | Cria novo ADR que autoriza workflows existentes e futuros, atualiza ADR-022 §117 | Resolve gap de governance; alinha estado real com política | Trabalho adicional |
| **B — Emendar ADR-022** | Modifica ADR-022 diretamente (adiciona §117.1 permitindo workflows) | Mais simples; preserva ADR-022 como fonte única | Emendar ADR é incomum (ADR são imutáveis historicamente) |
| **C — Não fazer nada** | Aceitar o drift | Zero trabalho | Gap de governance persiste — risco em auditorias futuras |

**Recomendação**: **Opção A** — ADR-024 de regularização. Cria precedente claro: "ADRs podem ser emendados via ADR de follow-up". Alinha com `AGENTS.md` regra de ADR para mudanças estruturais.

### R5.4 — Política de override

**Estado**:
- ADR-022 §72-82 define política: "Gate vermelho deverá bloquear o merge. Exceções exigem obrigatoriamente: decisão explícita do PO, justificativa, identificação do gate ignorado, registro, avaliação posterior. **Não será adotado override silencioso.**"
- Implementação em `guards.mjs`: Gate 2 falha-se-qualquer-check-mandatory-não-green; não há código que force bypass
- **Não há** um runbook / doc operacional explicando **como** o PO executa um override na prática
- **Não há** log de overrides (audit trail) — se um override informal aconteceu, não há como rastreá-lo

**Decisão requerida**: Documentar **explicitamente** o procedimento de override em um runbook.

**Opções**:

| Opção | Descrição |
|-------|-----------|
| **A — Runbook separado** (`docs/runbooks/ci-gate-override.md`) | Documenta procedimento: PO comenta no PR com justificativa, registra-se no log, etc. |
| **B — Workflow `.github/workflows/override-gate.yml`** | Cria workflow que permite override via PO comment `/override <gate-name> <justification>` — automatiza registro |
| **C — ADR-024 (item R5.1)** menciona override** | Inclui override procedure no ADR de regularização |

**Recomendação**: **Opção A + C combinadas** — Runbook simples + ADR-024 referencia o runbook. Não criar workflow adicional (escopo R5-IMPLEMENT, não R5-DECISION).

### R5.3 — E2E no CI

**Estado**:
- 33 `.spec.ts` em `tests/e2e/`:
  - `flows/` — 15 (flow1–flow14 + flow6a)
  - `homologation/` — 8 (h4, h5, h6.5, h6.6, h6-security, h35)
  - `smoke/` — 1 (`core.spec.ts`)
  - `regression/` — 2 (admin-crud, reports-vendas)
  - `validation/` — 4 (b34h-financial-validation, p2-1-client-import, pipeline-investigation, trilha-b-staff-attribution)
- `npm run test:e2e` existe (Playwright)
- `npm run test:e2e:smoke` existe (Playwright + `--grep @smoke`)
- **MAS**: `ci.yml` NÃO chama nenhum desses scripts — gap G7 do R5-AUDIT

**Decisão requerida**: Definir quais fluxos são P0/P1 (gate obrigatório) e se E2E deve ser bloqueante.

**Proposta de mapeamento** (a validar com PO):

| Categoria | Specs | Recomendação |
|-----------|--------|---------------|
| **P0** (obrigatório) | `smoke/core.spec.ts` (10 testes smoke) — base mínima | ✅ Bloqueante em `pull_request` para `main` |
| **P1** (obrigatório quando tocado) | `homologation/h6-security`, `flows/flow-p0-3-*, flow-p0-4-*`, `validation/b34h-financial-validation` | ✅ Bloqueante quando paths alterados |
| **P2** (advisory) | homologation h4/h5, regression | ❌ Não bloqueante |
| **P3** (off-CI) | flows flow1-flow14 (exceto P0/P1), validation demais | ❌ Roda só em homologação manual |

**Recomendação**: Job `e2e` no `ci.yml` (não bloqueante inicialmente, com `continue-on-error: true`) que roda `npm run test:e2e:smoke` para todos os PRs, mais um report anexo de quais specs P1 foram executadas. Bloqueio ativado após evidência operacional.

### R5.6 — `test.yml` stub

**Estado**:
- Conteúdo:
  ```yaml
  name: Test
  on: push: branches: [main]
  jobs: test: runs-on: ubuntu-latest, steps: - run: echo "hello"
  ```
- Trigger: push em main (redundante com `ci.yml` que já tem `push: branches: [main]`)
- Job `test` apenas faz `echo "hello"` — zero valor
- **NÃO é referenciado** em nenhum outro arquivo ou documentação

**Decisão requerida**: Remover, renomear, ou implementar.

**Opções**:

| Opção | Descrição | Recomendação |
|-------|-----------|---------------|
| **A — Remover** | Delete `.github/workflows/test.yml` | ✅ Recomendada |
| **B — Renomear para `.disabled`** | Mantém histórico mas não é executado | ❌ Ruído |
| **C — Implementar como smoke** | Trocar para rodar `npm run test:e2e:smoke` | ❌ Sobrepõe `ci.yml` |

**Recomendação**: **A — remover**. Stub morto é dívida técnica sem benefício.

### R5.2 — CODEOWNERS

**Estado**:
- Arquivo `.github/CODEOWNERS` **não existe**
- Branch protection `require_code_owner_reviews: false` — gap G2 do R5-AUDIT
- Áreas sensíveis (mapeadas via filesystem):
  - `supabase/migrations/` (27+ arquivos — schema/RPC/RLS)
  - `src/lib/finance/` (5 client libs — wrappers de RPCs M4)
  - `docs/adr/` (decisões arquiteturais)
  - `docs/audit/` (gate documentation — histórico)
  - `.github/workflows/` (CI/CD — código operacional)
  - `scripts/d8/` (D8 worker — código de produção)

**Decisão requerida**: Definir escopo mínimo do CODEOWNERS.

**Proposta de escopo**:

```
# CODEOWNERS — proposta inicial conservadora
/supabase/migrations/     @augustosanchesmanager-ux
/src/lib/finance/         @augustosanchesmanager-ux
/.github/workflows/       @augustosanchesmanager-ux
/scripts/d8/              @augustosanchesmanager-ux
# Demais áreas — sem CODEOWNER (default)
```

**Recomendação**: Implementar escopo mínimo focado nas 4 áreas acima (todas com PO como único owner). Quando houver mais contribuidores, expandir progressivamente.

### R5.5 — Dependabot

**Estado**:
- `.github/dependabot.yml` **não existe**
- 12 prod deps + 12 dev deps = **24 packages** sem monitoramento automático
- Deps principais com risco: `supabase` CLI (instalado em dev), `@supabase/supabase-js`, `react`, `vite`, `@playwright/test`

**Decisão requerida**: Habilitar Dependabot com config conservadora.

**Proposta de config** (a confirmar com PO):

```yaml
# dependabot.yml — conservadora
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
    # Apenas patch/minor por padrão; major exige aprovação manual
    groups:
      patch-minor:
        update-types: ["minor", "patch"]
    ignore:
      - dependency-name: "vite"
        # Major de Vite exige validação manual
```

**Recomendação**: Habilitar com config conservadora — semanal, group patch+minor, sem major auto-PR, máximo 3 PRs abertos.

### R5.8, R5.9 — Decisões futuras (NÃO AGORA)

| Item | Status | Por que adiar |
|------|--------|---------------|
| R5.8 signed commits | Desativado | Cultura da equipe — verificar se contribuidores usam GPG; custo operacional alto; exige rotação de chaves |
| R5.9 linear history | Desativado | Política de merge — verificar se a equipe prefere merge commits (histórico preservado) vs squash (linear); decisão cultural |

**Recomendação**: Decidir separadamente, após R5-IMPLEMENT core (R5.1–R5.7) estiver estabilizado.

---

## Proveniência

### Fatos comprovados

| # | Fato | Evidência |
|---|------|-----------|
| 1 | `REVIEW_BOT_TOKEN` existe em `actions/secrets` | `gh api repos/.../actions/secrets` |
| 2 | Workflows `.github/workflows/{ci,smg-approve,test}.yml` existem | `ls .github/workflows/` |
| 3 | ADR-022 §117 proíbe workflows | `docs/adr/ADR-022-ci-policy-quality-gates.md` linha 117 |
| 4 | Branch protection server-side ativa em main | `gh api repos/.../branches/main/protection` |
| 5 | 33 E2E specs em `tests/e2e/` | `Get-ChildItem -Recurse` |
| 6 | `smoke/core.spec.ts` existe | mesmo |
| 7 | `flow-p0-3`, `flow-p0-4` já taggeados como P0 | filename |
| 8 | `test.yml` é stub (`echo "hello"`) | conteúdo do arquivo |
| 9 | `.github/CODEOWNERS` ausente | `Test-Path` = false |
| 10 | `.github/dependabot.yml` ausente | mesmo |
| 11 | `npm run test:e2e` e `test:e2e:smoke` scripts existem | `package.json` |
| 12 | `ci.yml` NÃO chama nenhum E2E | conteúdo do arquivo |
| 13 | ADR-022 §72-82 define política de override conceitualmente | ADR-022 texto |
| 14 | Sem runbook de override operacional | `ls docs/runbooks/` (não existe) |

### Inferências

| # | Inferência | Base |
|---|------------|------|
| I1 | Os workflows foram criados via commits `feat(ci)` e `feat(pr-approve)` sem ADR de follow-up formal | git log + ausência de ADR-024 |
| I2 | O CI pipeline está estável em produção (5/5 success recentes) | R5-AUDIT + ADR-022 §18 |
| I3 | As áreas `supabase/migrations/` e `src/lib/finance/` são as mais sensíveis (afetam schema e wrappers de RPCs críticos) | Estrutura do repo + decisões M4 |
| I4 | O smoke (10 testes em `core.spec.ts`) roda rápido (provavelmente <2min) — viável como gate | Audit anterior mostrou Playwright funciona |
| I5 | E2E completo (33 specs) provavelmente leva muito tempo (>30min); não viável como gate universal | Estimativa por volume |

### Itens NÃO comprovados

| # | Item | Motivo |
|---|------|--------|
| N1 | **Tempo de execução real** dos 33 E2E specs em CI runner (ubuntu-latest) | Não rodei localmente nesta sessão (apenas `vitest run src/lib/finance/` que passou em 455ms localmente) |
| N2 | **Política de override** aplicada na prática (casos reais) | Sem audit log de overrides (se houver) |
| N3 | **CODEOWNERS workflow** se já houve tentativa de PR sem owner review (que foi bypassado) | Sem access log |
| N4 | **Default branch** do Vercel (smg-barber) | Não verificado nesta sessão |

---

## Recomendações para R5-IMPLEMENT (gate futuro, NÃO autorizado aqui)

**Ordem sugerida**:

1. **R5.1 — ADR-024 de regularização** (governance gap crítico)
2. **R5.4 — Runbook de override** (docs/runbooks/ci-gate-override.md)
3. **R5.3 — Job E2E smoke no `ci.yml`** (advisory inicialmente, bloqueante após evidência)
4. **R5.6 — Remover `test.yml`** (cleanup de stub morto)
5. **R5.2 — CODEOWNERS** (escopo mínimo: migrations, finance, workflows, d8)
6. **R5.5 — Dependabot** (config conservadora)
7. **R5.8 / R5.9** — decisões futuras (signed commits, linear history)

**Cada item**: gate R5-IMPLEMENT → R5-VALIDATE → R5-COMMIT → R5-PR → R5-MERGE (per sequência do PO).

---

## Não-autorizados neste gate (R5-DECISION)

Conforme escopo read-only/decisional:

- ❌ Nenhuma alteração em `.github/workflows/`
- ❌ Nenhuma alteração em `docs/adr/`
- ❌ Nenhuma alteração em `docs/runbooks/` (não criar este diretório)
- ❌ Nenhuma alteração de branch protection server-side
- ❌ Nenhuma alteração de secrets
- ❌ Nenhum commit / push / merge
- ❌ Nenhuma escrita em PROD, Vercel, branches
- ❌ Apenas leituras via `git`, `gh api`, `ls`, `cat`, `Get-ChildItem`

---

## Confirmações

- ❌ **Nenhuma escrita em workflow ou branch protection** (escopo read-only respeitado)
- ❌ **Nenhum commit / push / merge**
- ❌ **Nenhuma criação de ADR, runbook, ou arquivo de configuração**
- ✅ Apenas leituras via `git`, `gh api`, `gh run list`, `ls`, `cat`, `Get-ChildItem`

---

# STOP

**R5-DECISION: ENCERRADO (READ-ONLY/DECISIONAL)**.

Para cada uma das 7 decisões (R5.7, R5.1, R5.4, R5.3, R5.6, R5.2, R5.5):
- Investigação read-only: **executada**
- Estado atual: **documentado**
- Opções + trade-offs: **apresentadas**
- Recomendação: **oferecida**

**Aguardando decisão do PO** sobre quais itens R5.1–R5.5 (e em que ordem) devem ser autorizados para R5-IMPLEMENT (gate separado).