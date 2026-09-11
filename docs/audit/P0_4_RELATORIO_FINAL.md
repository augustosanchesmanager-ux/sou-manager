# P0.4 — Relatório Final da Frente (Abertura/Preflight + Validação D1–D7)

> **Frente:** P0.4 — Contas a Pagar + Contas Recorrentes (idempotência A7/A8)
> **Status:** 🟢 ABERTURA/PREFLIGHT + VALIDAÇÃO CONCLUÍDAS (D1–D7 executados) · 🔴 **STOP antes do merge mantido**
> **Data:** 2026-09-11 · **Responsável:** OpenCode (Tech Lead operacional) + Augusto (PO)
> **Base normativa:** 6.1.4-B (classificação B3) · STOP GATE `docs/audit/6.1.4_P0_4_STOP_GATE.md` · Evidência B3 `docs/audit/6.1.4_P0_4_DRIFT_EVIDENCIA_B3.md`
> **Regra da etapa:** Evidência B3 primeiro → validações (ACL, unit, typecheck, build, E2E) → documentação → commit/push/PR → **STOP antes do merge**.

---

## 1. Objetivo

Executar a frente P0.4 conforme as decisões **D1–D7** do PO (2026-09-11): validar/promover o **estado existente** de P0.4 (objetos já em PROD e STAGING, código em `main`) **sem reaplicar migrations** e **sem alterar o corpo do RPC** divergente — registrando o drift de `create_accounts_payable_from_recurring` como **evidência B3** antes de qualquer validação.

## 2. Decisões do PO (D1–D7) — resumo executivo

| # | Decisão | Execução |
|---|---|---|
| **D1** | Autorizar execução da frente (validar/promover estado existente, não reaplicar migrations) | ✅ Executada — escopo restrito a validação + documentação |
| **D2** | Drift de `create_accounts_payable_from_recurring` em PROD → **catalogar como evidência B3**, sem overwrite/DROP/CREATE/migration repair | ✅ Executada — evidência criada; **zero alteração de corpo** |
| **D3** | E2E `flow-p0-4-accounts-payable` (18 testes) em STAGING (alinhado ao repo, `7292cf8b`) | ✅ **18/18 PASS** (runId `1789110611512`) |
| **D4** | Ledger PROD (0/3): **NÃO registrar/repairar** | ✅ **Nenhum INSERT/repair executado** — B3 segue investigação da proveniência |
| **D5** | Validar explicitamente a ACL contra o estado esperado | ✅ **5/5 sane e idênticas** PROD = STAGING |
| **D6** | Commit/push/PR + **STOP antes do merge** (merge só com nova autorização + reviewer) | ✅ Executada — **STOP mantido** |
| **D7** | Cobertura prevista no gate (13 unit + 18 E2E), sem expandir escopo | ✅ **13/13 unit PASS** + typecheck + build limpos |

Verbatim completo em `docs/audit/6.1.4_P0_4_STOP_GATE.md` §5.

## 3. Evidências por decisão

### D2 — Drift `create_accounts_payable_from_recurring` (evidência B3)

| Dimensão | Repo / STAGING | PROD |
|---|---|---|
| Corpo `prosrc` | len **1282** / md5 `7292cf8b…` (acentos + comentários) | len **1053** / md5 `5c87853c…` (**ASCII-normalizado**, sem comentários) |
| SQL lógico | — | Funcionalmente equivalente |
| Proveniência | Migration `20260905044639` — criada em commit `e9761e5` (2026-09-05), **nunca modificada** (git log seguido, worktree limpo) | Aplicação fora do migration runner (SQL editor com normalização de encoding) — ledger PROD vazio (0/3) |

**Conclusão B3:** divergência de proveniência (não de comportamento). STAGING == repo **byte-for-byte** (5/5 funções corp-idênticas). PROD preservado como evidência — **nenhuma escrita**.

### D5 — ACL (validação explícita)

As 5 funções P0.4 em **PROD e STAGING**: `security_definer=true`, `anon_exec=false`, `authenticated_exec=true`, `service_role_exec=false`, `proacl={postgres=X/postgres, authenticated=X/postgres}` → **5/5 sane, idênticas, sem divergência**. Confirma a sanidade já aplicada em D2 da rodada 6.1.3 (ROADMAP 8.50).

### D7 — Cobertura (sem expandir escopo)

- Vitest `domain/accountsPayable/domain.test.ts`: **13/13 PASS**
- `npm run typecheck`: **limpo (exit 0)**
- `npm run build`: **limpo (exit 0)**

### D3 — E2E STAGING

- Spec: `tests/e2e/flows/flow-p0-4-accounts-payable.spec.ts` — **18 testes**
- Alvo: STAGING (`tjcvuhynckocmvtqykxp` — último bloco `.env.local` vence)
- Resultado: **18/18 PASS** · runId `1789110611512` · tenant seed `e2e-suite-1789110611512`
- Teardown: tenant órfão deixado para limpeza do operador (padrão conhecido da cadeia — seed documenta; não é falha de teste)
- **Sem smoke em PROD** (não autorizado)

## 4. Critérios de Entrada

- [x] STOP GATE P0.4 emitido (preflight read-only PROD + STAGING, achado de drift §3.3)
- [x] PO respondeu D1–D7 (verbatim registrado no gate) — execução autorizada dentro do escopo
- [x] Evidência B3 do drift criada **antes** de qualquer validação (D2/condição vinculante 1)

## 5. Critérios de Saída

- [x] Drift catalogado como evidência B3 — `docs/audit/6.1.4_P0_4_DRIFT_EVIDENCIA_B3.md`
- [x] Nenhuma alteração de corpo de RPC em PROD/STAGING (D2)
- [x] Nenhum INSERT/repair no ledger PROD (D4)
- [x] E2E executado **somente** em STAGING, 18/18 PASS (D3)
- [x] ACL validada 5/5 sane, sem divergência (D5)
- [x] Cobertura 13/13 unit + typecheck + build (D7)
- [x] Docs atualizados (ROADMAP 8.55 / PROJECT_STATUS 7.16) + relatório final
- [x] **STOP antes do merge (D6)** — merge não executado

## 6. Arquivos Alterados nesta Frente

| Arquivo | Natureza |
|---|---|
| `docs/audit/6.1.4_P0_4_STOP_GATE.md` | Atualizado — D1–D7 verbatim + condições vinculantes + histórico de revisões |
| `docs/audit/6.1.4_P0_4_DRIFT_EVIDENCIA_B3.md` | **Novo** — evidência B3 do drift |
| `docs/audit/P0_4_RELATORIO_FINAL.md` | **Novo** — presente relatório |
| `ROADMAP.md` | Entrada 8.55 |
| `PROJECT_STATUS.md` | Entrada 7.16 |

**Zero código, zero SQL/migration, zero alteração de banco** nesta frente (frente documental + validações read-only).

## 7. STOP e Pendências

- ⛔ **Merge do PR da frente NÃO executado** (D6) — aguarda **nova autorização explícita do PO** + **reviewer independente** (branch protection de `main`: 1 approving review; dono não aprova PR próprio).
- ⏳ **B3 segue na investigação da proveniência do drift PROD** (autoria/data/mecanismo da aplicação fora do runner — GAP G1 da evidência B3). Nenhuma regularização do ledger autorizada (D4).
- ⏳ Demais frentes (M4/P0.3/P2.1) permanecem conforme 6.1.4-B (aguardando B3).
- ⏳ Rota de tratamento do drift (normalizar PROD ao corpo canônico ou aceitar o estado) = **decisão futura do PO**, baseada na evidência B3 preservada.

## 8. Histórico de Revisões

| Data | Revisão |
|---|---|
| 2026-09-11 | Execução D1–D7 concluída (evidência B3, ACL 5/5, 13/13 unit, typecheck, build, E2E STAGING 18/18); docs atualizados; **STOP mantido antes do merge** |