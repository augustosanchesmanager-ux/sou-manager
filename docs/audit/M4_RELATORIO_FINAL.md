# M4 — Relatório Final de Implementação (P1/P4/P5/P6/P7/P8)

> **Fase:** M4 — Implementação pós-G1.3 · **Status:** CONCLUÍDA (backend+banco) / CONCLUÍDA (frontend P7 — 11/09/2026) / PARCIAL (frontend P4/P5)
> **Data:** 30/08/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** ADR-016..020 · G1.1/G1.2 (29/08/2026) · M4_FASE2_MAPA_ESTADO_ATUAL.md (aprovado pelo PO)
> **Regra da etapa:** Implementação → Testes → Build → Typecheck → Auditoria → Documentação. Nenhuma migration antiga alterada; nenhuma migration aplicada em produção (aguarda PO).

---

## 1. Objetivo

Implementar as seis decisões da M4 (P1/P4/P5/P6/P7/P8) que separam **pagamento ≠ atendimento ≠ desbloqueio ≠ baixa**: cancelamento com antecipado exige decisão REMARCAR/ESTORNAR (P1), correção retroativa de `attended_at` auditável (P4), confirmação de atendimento por RPC com matrix de papéis (P5), desbloqueio de comanda auditável server-side (P6), registro de pagamento parcial/antecipado sem efeito financeiro automático (P7), e configuração do método de reembolso por tenant (P8).

## 2. Escopo

| Escopo | Conteúdo |
|---|---|
| **Banco** | 5 migrations novas (P1, P4/P5, P6, P7, P8) — RPCs SECURITY DEFINER, padrão RLS v2, idempotência, append-only |
| **Backend TS** | `application/appointment/lifecycle.ts` (cancelAppointment com `paymentDecision`) + `types.ts`; 5 client libs em `src/lib/finance/` |
| **Frontend** | `pages/Schedule.tsx` (modal decisão P1), `pages/Comandas.tsx` (unblock via RPC P6), `pages/Settings.tsx` (config P8) |
| **Testes** | 5 suítes novas de client lib (54 testes) + 3 casos P1 no lifecycle (60 testes appointment) |
| **Fora do escopo** | Aplicação das migrations em produção (PO); `finance_settle_comanda` LIVE (intocada); worker D8; correção de erros tsc pré-existentes; UI de correção retroativa P4 / confirmação P5 / registro parcial P7 (ver §8) |

## 3. Critérios de Entrada

- [x] G1.1 e G1.2 CONCLUÍDOS e aprovados pelo PO (decisões D1..D8, cenário canônico)
- [x] Mapa do Estado Atual (M4_FASE2_MAPA_ESTADO_ATUAL.md) aprovado pelo PO
- [x] Migrations M1/M2/M3 (schema: `attended_at`, ENUM `payment_type`, `comanda_payments`) aplicadas (A1)
- [x] Pendências de evidência §5 do Mapa fechadas (worker não avalia `financialEffect`; `changeStatus`; auto-unlock; no-show; `isManagerLikeRole`)
- [x] Baseline: `npm run build` OK, `npx tsc --noEmit` sem erros novos, `git diff --check` OK

## 4. Critérios de Saída

- [x] 5 migrations criadas seguindo convenção de timestamp 14 dígitos, `BEGIN/COMMIT`, `REVOKE/GRANT authenticated`, `NOTIFY pgrst`
- [x] Cancelamento com pagamento detectado exige decisão (lança `PAYMENT_DECISION_REQUIRED`) — nunca estorno automático
- [x] `comanda_payments` escrita por RPC operacional (P7) e revertida por RPC append-only (P1)
- [x] `attended_at` gravado somente por RPC de confirmação/correção (P4/P5), nunca por settle
- [x] Desbloqueio `BLOCKED→OPEN` via RPC auditada (P6), sem `attended_at`/`completed`/comissão
- [x] Refund method configurável por tenant com default `internal_credit` (P8)
- [x] Testes obrigatórios P1 (3 casos)/P4/P5/P6/P7/P8 passando
- [x] Build/typecheck/diff check OK; zero erros novos (65 erros tsc = baseline pré-existente; 1 falha suite = `eventInfrastructure.test.ts` pré-existente, provado via `git stash`)

## 5. Dependências

| Dependência | Status |
|---|---|
| Migrations M1/M2/M3 (G1.1, A1) | ✔ aplicadas |
| ADR-016..020 (base normativa) | ✔ aprovadas |
| M4_FASE2_MAPA_ESTADO_ATUAL.md | ✔ aprovado |
| `finance_settle_comanda` LIVE (`20260602031543`) | ⛔ intocada (não alterada, não re-criada) |
| Worker D8 (`worker-dispatcher`) | ⛔ intocado — `npm run d8:verify` obrigatório antes de qualquer deploy |

## 6. Arquivos Alterados

### Migrations novas (5)

| Migration | Conteúdo |
|---|---|
| `20260830000000_m4_p1_reverse_comanda_payment.sql` | RPC `reverse_comanda_payment` (append-only `reversed_at`, motivo+`refund_method` obrigatórios, management gate, **não** altera status da comanda) + `check_comanda_has_valid_payments` |
| `20260830010000_m4_p4_p5_attendance_rpcs.sql` | Tabela `appointment_attendance_corrections` (before/after/motivo/actor) + `confirm_appointment_attendance` (barbeiro-próprio/recepção/gestão, seta `attended_at=now()` + `status='completed'`, nunca auto) + `correct_appointment_attendance` (gestão, motivo obrigatório) |
| `20260830020000_m4_p6_unblock_comanda.sql` | Tabela `comanda_unblock_audit` + `unblock_comanda` (híbrido `auto`/`manual`; manual exige papel+motivo; `BLOCKED→OPEN` sem `attended_at`) + `batch_unblock_comandas` |
| `20260830030000_m4_p7_register_comanda_payment.sql` | `register_comanda_payment` (`anticipado`/`parcial`/`total`, gate recepção+gestão, soma ≤ `net_total`, idempotência UNIQUE) + `get_comanda_payment_summary` |
| `20260830040000_m4_p8_tenant_refund_method.sql` | `ALTER TABLE tenants ADD COLUMN settings JSONB DEFAULT '{}'` + `get_tenant_refund_method` + `upsert_tenant_refund_method` (gestão; valores: `internal_credit, pix, cash, card_reversal, store_credit`) |

### Backend TS (modificados)

| Arquivo | Mudança |
|---|---|
| `application/appointment/types.ts` | `CancelAppointmentParams.paymentDecision?: 'remarcar' \| 'estornar'` |
| `application/appointment/lifecycle.ts` | `cancelAppointment`: detecta pagamento por comanda (`check_comanda_has_valid_payments`); sem decisão → `AppointmentError('PAYMENT_DECISION_REQUIRED')`; `remarcar` preserva comandas com pagamento (open/blocked); `estornar` reverte (`get_comanda_payment_summary` + `reverse_comanda_payment`, motivo=cancellationReason, `internal_credit`) antes de cancelar; evento `AppointmentCancelled` com `comandaCancelFailed` |

### Client libs novas (5)

| Arquivo | Conteúdo |
|---|---|
| `src/lib/finance/paymentDecision.ts` | `reverseComandaPayment`, `checkComandaHasValidPayments` |
| `src/lib/finance/attendance.ts` | `confirmAppointmentAttendance`, `correctAppointmentAttendance` |
| `src/lib/finance/unblock.ts` | `unblockComanda` (auto/manual), `batchUnblockComandas` |
| `src/lib/finance/payment.ts` | `registerComandaPayment`, `getComandaPaymentSummary` (normaliza payments p/ camelCase) |
| `src/lib/finance/refundConfig.ts` | `REFUND_METHODS`, `DEFAULT_REFUND_METHOD='internal_credit'`, `getTenantRefundMethod`, `upsertTenantRefundMethod` |

### Frontend (modificados)

| Arquivo | Mudança |
|---|---|
| `pages/Schedule.tsx` | Estado `showPaymentDecisionModal`; `handleCancelAppointment(id, paymentDecision?)` captura `PAYMENT_DECISION_REQUIRED` e abre modal (Voltar / Estornar / Remarcar-manter-pagamento); `confirmCancelAppointment(paymentDecision?)` |
| `pages/Comandas.tsx` | Auto-unlock client-side (`UPDATE` direto) substituído por RPC `batch_unblock_comandas` + update otimista local (linhas ~670-725) |
| `pages/Settings.tsx` | Seção "Configuração de Reembolso" (P8): `getTenantRefundMethod`/`upsertTenantRefundMethod`, gate `isManagement` (`manager`/`superadmin`), estado/loading/message |

### Testes novos (5 + modificações)

| Arquivo | Qtd |
|---|---|
| `src/lib/finance/paymentDecision.test.ts` | 8 testes |
| `src/lib/finance/attendance.test.ts` | 8 testes |
| `src/lib/finance/unblock.test.ts` | 8 testes |
| `src/lib/finance/payment.test.ts` | 9 testes |
| `src/lib/finance/refundConfig.test.ts` | 8 testes |
| `application/appointment/appointment.test.ts` | +3 casos P1 (throw `PAYMENT_DECISION_REQUIRED`, `remarcar` preserva, `estornar` reverte+cancela) → 60 testes |

## 7. Testes

| Suíte | Resultado |
|---|---|
| `npx vitest run src/lib/finance/` | **54/54 PASS** (6 arquivos) |
| `npx vitest run application/appointment/appointment.test.ts` | **60/60 PASS** (57 baseline + 3 P1) |
| Suíte completa `npx vitest run` | **1294 PASS / 5 skipped / 0 FAIL** (67 arquivos, 11/09/2026 pós-UI P7) — falha pré-existente `eventInfrastructure.test.ts` não mais presente |
| `npm run build` | ✔ built in 15.32s (11/09/2026, pós-UI P7) |
| `npx tsc --noEmit` | ✔ **exit 0 — ZERO erros** (11/09/2026; baseline de 65 erros pré-existentes não mais presente após merges) |
| `npm run d8:verify` | ✔ D8:VERIFY OK — canonical Core == worker artifact (byte-identical) |
| `git diff --check` | ✔ OK (sem whitespace errors) |

## 8. Riscos e Pendências

| # | Item | Status | Ação |
|---|---|---|---|
| 1 | **Aplicação das migrations em produção** | 🔴 BLOQUEADO (PO) | Exige aprovação explícita; `npm run d8:verify` antes de qualquer deploy |
| 2 | **UI de correção retroativa P4** (gestão ajustar `attended_at` com motivo) | 🟡 PARCIAL — RPC+lib+testes prontos; **sem tela** | Persistir RPC; UI em subfase seguinte |
| 3 | **UI de confirmação P5** (barbeiro/recepção confirmar atendimento) | 🟡 PARCIAL — RPC+lib+testes prontos; Schedule ainda usa `changeStatus` | Substituir caminho de confirmação pela RPC |
| 4 | **UI de registro de pagamento parcial P7** (recepção registrar `anticipado`/`parcial`) | ✅ CONCLUÍDA (11/09/2026) — card de pagamentos registrados + modal de registro no Checkout (`pages/Checkout.tsx`), gate por papel espelha o RPC (recepção/gestão) | UI no Checkout integrada à P4/P5 |
| 5 | `eventInfrastructure.test.ts` (1 falha) | ⚪ resolvida — **não mais presente** na suíte completa (1294/0, 11/09/2026) | Baseline antiga; removida pelo estado atual da suíte |
| 6 | 65 erros tsc pré-existentes | ⚪ resolvida — `npx tsc --noEmit` **exit 0** (11/09/2026) | Baseline antiga; não mais reprodutível após merges |
| 7 | Delegação a subagentes falhou (model timeout `bg_63e7a183`, model not found `bg_dfb85837`) | ⚪ processo | Implementação executada diretamente pelo Tech Lead |
| 8 | **UI P7 entregue — merge/PR e E2E pendentes** | 🟡 execução | Commit + push + PR abertos; E2E da suíte completa na etapa de baseline (14/09/2026, previsto) |

## 9. Responsável

- **OpenCode (Tech Lead):** arquitetura, migrations, backend TS, frontend, testes, validações, documentação.
- **Augusto (PO):** aprovação das migrations em produção, decisões de negócio pendentes (UI P4/P5/P7), bloqueio/deploy.

## 10. Próxima Etapa

1. **Apresentar ao PO** este relatório + impacto das migrations (gate obrigatório §6 do Mapa).
2. **PO aprovar aplicação** das 5 migrations novas em produção (nunca automática). *(P7 e saneamento ACL M4 já autorizados e aplicados em 11/09/2026 — ver `6.1.4_A1` e `20260911120000`.)*
3. Implementar **UI pendentes**: P4 (correção retroativa em gestão), P5 (confirmação de atendimento via RPC no Schedule).
4. **P7 UI entregue (11/09/2026):** `npx tsc --noEmit` exit 0 · suíte completa 1294/0 · `npm run d8:verify` OK · build ✔ — pendente apenas **E2E da suíte completa** (smoke < 3min) na etapa de baseline.
5. Registrar baseline/tag somente após commit semântico + push da branch + push da tag (política oficial ROADMAP).