# P-AUTO — CLASSIFY / SCOPE MANIFEST

> **Frente:** P-AUTO (dívida change-control: `MERGE ≠ DEPLOY PROD`)  
> **Gate:** `smg-change-control P-AUTO → CLASSIFY`  
> **Data:** 2026-09-24  
> **Decisão do PO (entrada):** arquitetura **A + C** (Production Branch separada + `workflow_dispatch`/Deploy Hook)  
> **Modo:** somente leitura + artefato local untracked (nenhum commit/push/mutação remota).

---

## 1. Estado capturado

| Item | Valor |
|------|-------|
| Branch atual | `docs/h3-h35-ressalva-resolvida` |
| HEAD | `3c0ed61` (docs encerramento H3-5+P1-01 — frente anterior) |
| `origin/main` | `5a28456` (intocado) |
| Relação | `origin/main...HEAD` = 0 `|` 1 (HEAD 1 commit à frente — docs da frente anterior, pushado na branch, **não** em main) |
| Modified (tracked) | **0** |
| Staged | **0** |
| Untracked totais | ~110 (histórico de outras frentes, tooling local, scripts) |
| Untracked que mencionam `P-AUTO`/`P_AUTO` (varredura de conteúdo) | **exatamente 2** |

---

## 2. FRONT → arquivos

### FRONT: `P-AUTO` (A + C — gate de deploy de produção)

**Arquivos existentes (artefatos das fases anteriores):**

| Arquivo | Estado | Papel | Confiança |
|---------|--------|-------|-----------|
| `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` | untracked | Diagnóstico + alternativas A–E + STOP | **alta** (nome + conteúdo P-AUTO) |
| `docs/audit/P_AUTO_DESIGN_VALIDATION_20260924.md` | untracked | Fechamento dos 3 GAPs + validação A+C | **alta** |
| `docs/audit/P_AUTO_CLASSIFY_SCOPE_20260924.md` | untracked (este) | Scope manifest do gate CLASSIFY | **alta** |

**Arquivos previstos (Ainda NÃO existem — criados apenas em ISOLATE/IMPLEMENT, sob autorização):**

| Arquivo previsto | Papel | Confiança |
|------------------|-------|-----------|
| `.github/workflows/<deploy-production>.yml` (nome a confirmar) | **C** — `workflow_dispatch` + environment approval + acionamento do Deploy Hook Vercel | alta (desenho A+C) |
| Secret GitHub do Deploy Hook (repo secret, metadata only) | **C** — credencial do hook | alta |
| Branch `production` (git, remota) + branch protection | **A** — Production Branch separada | alta |
| Setting Vercel `link.productionBranch` → `production` (PATCH, fase implement) | **A** — corta `main → PROD` | alta |
| `docs/adr/ADR-0xx-deploy-gate-merge-neq-deploy.md` (próximo número livre) | Decisão arquitetural formal (exigência AGENTS.md para mudança estrutural) | **média** — propor na ISOLATE; ADR exige aprovação PO |
| Atualizações `ROADMAP.md` / `PROJECT_STATUS.md` / changelog | Encerramento documental (política PO) | alta (só na etapa de documentação) |

**Razão:** todo artefato com rastro `P-AUTO`/`P_AUTO` + os artefatos mínimos exigidos pelo desenho A+C validado no DV.  
**Nenhuma migration, nenhum arquivo de `src/`, nenhum RPC/RLS** pertence a esta frente (gate é infraestrutura de deploy, não código de produto).

---

## 3. EXCLUDED (outros fronts / não-frente)

| Grupo | Exemplos | Front atribuído | Confiança |
|-------|----------|-----------------|-----------|
| Migration untracked | `supabase/migrations/20260924000000_add_comanda_items_staff_id.sql` | **P-MIG** (pendência registrada) | alta |
| Migrations antigas untracked | `20260908120000_fix_grant_...`, `20260911120000_seguranca_...` | frentes M4/segurança anteriores | média (por nome) |
| Bug P-DV | `.github/workflows/deploy-validate.yml` (tracked, **inalterado**) | **P-DV** — paralela, não substitui gate | alta |
| Docs/scripts históricos | `docs/audit/H7_*`, `6.1.4_*`, `M4_*`, `scripts/h7-*`, `scripts/f1-*`, saneamentos SQL | frentes anteriores (H7/F1/6.1.4/M4) | média (por nome) |
| Tooling local | `.agents/`, `.claude/`, `.omo/`, `.opencode/`, `skills-lock.json`, `HANDOFF_CONTEXT.md` | ambiente — nunca commitar | alta |
| Backup local | `.env.local.bak_bom` | ambiente — nunca commitar | alta |
| Testes/scripts untracked diversos | `tests/e2e/validation/*`, `tests/incident/`, `scripts/ops/*` | frentes anteriores | média (por nome) |

**Árvore rastreada:** 0 modified / 0 staged → nenhum arquivo rastreado entra no diff de P-AUTO.

---

## 4. UNRESOLVED

| Questão | Bloqueia CLASSIFY? | Tratamento |
|---------|-------------------|------------|
| Nome da branch de release (`production` vs `release/prod`) | **Não** — default sensato: `production` | Confirmar/default na ISOLATE |
| Nome exato do workflow | **Não** | Definir na ISOLATE |
| ADR obrigatório? (mudança estrutural) | **Não** — flag de escopo | Propor ADR na ISOLATE; aprovação PO |
| Branch de implementação | **Não** | **ISOLATE deve cortar branch nova a partir de `origin/main` (`5a28456`)** — não continuar em `docs/h3-h35-ressalva-resolvida` (mistura frentes) |
| Três migrations untracked no worktree | **Não para P-AUTO** | Excluídas; resolução é frente **P-MIG** separada (não misturar) |

---

## 5. Relação com pendências paralelas

| Pendência | Relação com P-AUTO |
|-----------|-------------------|
| **P-DV** | Paralela — melhora pós-deploy; **não** substitui o gate. Corrigir depois é independente. |
| **P-MIG** | Independente — estado de schema; **jamais** entrar no commit/PR de P-AUTO. |

---

## 6. STATUS

```text
FRONT: P-AUTO (A + C)
  → docs/audit/P_AUTO_AUDIT_READONLY_20260924.md        (untracked, alta)
  → docs/audit/P_AUTO_DESIGN_VALIDATION_20260924.md     (untracked, alta)
  → docs/audit/P_AUTO_CLASSIFY_SCOPE_20260924.md        (untracked, alta)
  → [previstos ISOLATE/IMPLEMENT] workflow C + secret + branch production + PATCH PB + ADR/ROADMAP
EXCLUDED: ~110 untracked (outras frentes/tooling) + 0 tracked modified
UNRESOLVED: nenhum bloqueante (defaults anotados)
STOP conditions: não acionadas — front identificável, sem conflito de fronts nos arquivos do P-AUTO
```

**STATUS: CONTINUE** → elegível para `smg-change-control P-AUTO → ISOLATE`  
**Próximo gate:** ISOLATE (escopo físico: branch nova desde `origin/main`, lista fechada de arquivos a criar/modificar, exclusões explícitas)  
**Mutações:** 0 · **Commits desta frente:** 0 · **`origin/main`:** `5a28456` intacto
