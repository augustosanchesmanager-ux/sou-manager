# M4 — Fase 2: MAPA DO ESTADO ATUAL (checklist de auditoria para implementação P1/P4/P5/P6/P7/P8)

> **Fase:** M4 — Fase 2 (Mapa do Estado Atual) · **Status:** EM ELABORAÇÃO (deliverable da Fase 2)
> **Data:** 29/08/2026 · **Responsável:** OpenCode (Tech Lead)
> **Base normativa:** ADR-016..020 · G1.1 (`G1_1_REVISAO_M4_FINANCE_SETTLE.md`) · G1.2 (`G1_2_DECISOES_DOMINIO_M4.md`) · G1 Schema (`G1_SCHEMA_DESIGN_M1-M3.md`) · D7/D8 (composite + worker) · Ticket M4 (P1/P4/P5/P6/P7/P8)
> **Regra da etapa:** SOMENTE leitura e consolidação de evidências. NENHUMA alteração de código/migration/RPC/RLS/frontend. Único entregável: este documento.
> **Nota de evidência:** todas as linhas citadas referem-se ao conteúdo atual do repositório (ler o arquivo informado para confirmar o contexto).

---

## 1. Objetivo do Mapa

Responder ponto a ponto (A..M, ~25 perguntas) **o que o sistema faz hoje** em cada área que as decisões P1/P4/P5/P6/P7/P8 do PO tocam, com evidência de código/migration. A partir do mapa, o Tech Lead apresenta o **impacto das migrações** (gate obrigatório) e então implementa.

Regras de domínio vinculantes (G1.2 §5, decisões do PO):

1. **Pagamento ≠ atendimento** (ADR-017). Antecipado não é prova de atendimento.
2. **Desbloqueio ≠ atendimento** (P6). `BLOCKED → OPEN` não preenche `attended_at`, não marca `completed`, não gera comissão.
3. **Baixa ≠ atendimento** (P7). Parcial/antecipado não preenche `attended_at`, não gera comissão automática.
4. **Cancelamento com antecipado**: nunca estorno automático; operador escolhe REMARCAR (pagamento permanece válido/aproveitável) ou ESTORNAR (reversão append-only, motivo obrigatório) — P1.
5. **`attended_at`** é preenchido somente por RPC operacional autorizada (M1 COMMENT) — P4/P5.

---

## 2. Resumo executivo dos achados

| Área | Estado atual | Impacto M4 |
|---|---|---|
| **A. Pagamento antecipado** | Lancado via `finance_settle_comanda` (comanda vira `paid`, transaction `income`) | Não existe fluxo M3; `comanda_payments` nunca é escrita |
| **B. Pagamento parcial** | NÃO suportado (nada grava `comanda_payments`) | P7 precisa de RPC gravadora + gating |
| **C. Vínculo comanda↔agendamento** | `comandas.appointment_id`; settle marca appointment `completed`; cancelamento em cascata | **FALHA D3/P1** — settle marca `completed` (linha 374) |
| **D. Persistência do cancelamento** | Campos dedicados em `appointments` e `comandas` + modal com `cancellationType`/reason | Base pronta para P1 |
| **E. Reversão/estorno** | `financial_reversals` append-only + `finance_reverse_transaction(p_refund_method)` | Base pronta para P1-ESTORNAR/P8 |
| **F. Identificação do operador** | `auth.uid()` central; colunas `*_by_user_id` | Pronto; P4/P6 exigem motivo+operador |
| **G. Verificação de papéis** | Gate de roles no settle + `get_auth_access_context` + RLS v2 | P5/P6 exigem matrix explícita |
| **H. Confirmação de atendimento** | **NINGUÉM grava `attended_at`**; `completed` via `changeStatus` sem `attended_at` | P4/P5 criam a RPC que falta |
| **I. Desbloqueio** | **Somente client-side** em `Comandas.tsx:670-717`; sem RPC, sem auditoria, sem motivo | **FALHA P6** — bloqueio é "fantasma" |
| **J. Gatilho de comissão** | Checkout → composite (settle+outbox atômico) → worker D8 → `commission_records` | P7 e P1-ESTORNAR precisam de gates no enqueue/worker |
| **K. RPCs** | Inventário abaixo (§4) | P4/P5/P6/P7/P8 criam RPCs novas |
| **L. RLS** | Padrão v2 (`current_tenant_id_from_auth_uid` + superadmin bypass) | Tábuas novas seguem o padrão |
| **M. Testes** | 56 `.test.ts`; vitest; baseline conhecida | Testes P1/P4/P5/P6/P7/P8 obrigatórios |

---

## 3. Mapa ponto a ponto

### A. Onde o pagamento antecipado é armazenado hoje?

- **A1. Fluxo atual de antecipado:** o frontend `Checkout.tsx` chama `settleCheckoutComandaAndEnqueue` (settlement.ts:72) → RPC `finance_settle_comanda_and_enqueue` (composite, `20260827000000`) → chama a original `finance_settle_comanda` (§4 K1) + `INSERT outbox_items` na MESMA transação. Nada passa por `comanda_payments`.
- **A2. Persistência:** a comanda vira `status='paid'` com `payment_date_real`, `settled_at`, `settled_by_user_id`, `closure_mode='standard'`, `financial_effect=true` (`20260602031543:360-364`). A transaction `income` guarda `metadata` com `comanda_total`, `paid_amount`, `amount_difference`.
- **A3. Consequência M4:** `comanda_payments` (M3) permanece órfã (vazio confirmado em G1.2 §2). O antecipado hoje **aciona o ciclo completo de `completed` + comissão** (viola ADR-017/020).

### B. Existe suporte a pagamento parcial?

- **B1. Banco:** ENUM `payment_type` = `anticipado, no_atendimento, posterior, parcial, final` (M2) **existe mas nada o usa**. Tabela `comanda_payments` (M3) tem `payment_type NOT NULL` mas **nenhuma RPC grava nela** (gap formal G1.2 §2).
- **B2. Frontend:** `Checkout.tsx:750-780` — se comanda `blocked`, toast de erro e **não avança**; se `open`, modal de duplicidade. Não existe opção "parcial".
- **B3. Financeiro:** zero destaque para "valor parcial" — `paid_at`/`settled_at` únicos.
- **B4. Consequência M4:** P7 (opção A) precisará de RPC `register_comanda_payment` que grava em `comanda_payments` com `payment_type='parcial'|'anticipado'`, sem `attended_at`, sem comissão automática, e sem mudar status para `paid` (saldo pendente).

### C. Vínculo comanda ↔ agendamento?

- **C1. Coluna:** `comandas.appointment_id` (FK). Criada junto com a criação de comanda `blocked` para agendamento futuro (`20260506214059`, `v_comanda_status := 'blocked'`).
- **C2. `finance_settle_comanda`** (`20260602031543:373-376`): quando `appointment_id` presente, faz `UPDATE appointments SET status='completed'` — **AQUI ESTÁ A VIOLAÇÃO D3/P1**: antecipado (comanda `blocked`) marca o agendamento como concluído sem que o atendimento tenha ocorrido.
- **C3. Cancelamento de agendamento** (`application/appointment/lifecycle.ts:210-289`): `cancelAppointment` cancela o appointment + comandas `open`/`blocked` (mantém `cancelled`), **não toca pagamentos/transactions** — comportamento correto, mas hoje não diferencia se a comanda tinha antecipado.
- **C4. Consequência M4:** P1 precisa que o cancelamento detecte `comanda_payments` com `reversed_at IS NULL` para oferecer REMARCAR/ESTORNAR; REMARCAR preserva a comanda/pagamento (ex.: muda `start_time`), ESTORNAR reverte via RPC existente (`finance_reverse_transaction`).

### D. Como o cancelamento é persistido?

- **D1. `appointments`:** `cancellation_type`, `hidden_from_schedule`, `cancelled_at`, `cancelled_by_user_id` (`20260501010000`); `cancellation_reason TEXT DEFAULT ''` + status `no_show` (`20260421000000`).
- **D2. `comandas`:** `cancellation_type`, `cancelled_at`, `cancelled_by_user_id`, `hidden_from_financial` (`20260501_add_cancellation_fields_to_comandas`).
- **D3. UI:** `pages/Schedule.tsx:3408+` — modal de cancelamento exige `cancellationType`; quando `other`, exige `cancelReason`; botão desabilitado até escolher tipo. `handleCancelAppointment` (~1060) chama `cancelAppointment({ ..., cancellationType, cancellationReason: cancelReason || 'Não informado', ... })`.
- **D4. Consequência M4:** estrutura de dados pronta; P1 apenas **condiciona o fluxo** (se há antecipado válido → exigir escolha REMARCAR/ESTORNAR).

### E. Estruturas de refund/reversal (append-only)?

- **E1. `financial_reversals`** (`20260515210114`): colunas de reversão com `refund_method`, idempotência UNIQUE `tenant_id × idempotency_key`, append-only. **Já suporta P8.**
- **E2. `finance_reverse_transaction`** (`20260515210804`): parâmetro `p_refund_method`; na reversão total `wrong_settlement`, a comanda volta para `open` (~linha 105). **P1-ESTORNAR (cenário D)**: estorno de antecipado em comanda cancelada NÃO deve devolver para `open` — deve manter `cancelled`.
- **E3. `commission_records`** (`20260820120000`): append-only, `record_type IN ('commission','reversal')`, índice único parcial (1 original por staff+comanda), RPC de reversão com `pg_advisory_xact_lock`.
- **E4. Consequência M4:** P1-ESTORNAR = chamar `finance_reverse_transaction` com `p_refund_method` (config P8) + motivo obrigatório; garantir tratamento do `wrong_settlement` no cenário de comanda cancelada.

### F. Como o sistema identifica o operador?

- **F1. Padrão:** `auth.uid()` em todas as RPCs SECURITY DEFINER (settle, reverse, zero_close). Colunas `settled_by_user_id`, `cancelled_by_user_id`, `actor_id` (M3).
- **F2. `get_auth_access_context`** (`20260308_multitenant_hotfix.sql:31-90`): retorna `tenant_id`, `access_role` (`superadmin|manager|receptionist|barber|unknown`), `profile_status`, `is_super_admin`; manager set = `manager/gerente/owner/admin/adminmanager/admin_manager`.
- **F3. Frontend:** `canRequestFinancialReversal = canAccessSuperAdmin || ['owner','admin','manager','superadmin'].includes(accessRole)` (Receipts.tsx:162, AccountsReceivable.tsx:377, Cashflow.tsx:154).
- **F4. Consequência M4:** operador sempre identificável; `attended_at` exige `confirmação por usuário` (P4/P5) e desbloqueio manual exige `operador` (P6).

### G. Como os papéis são verificados?

- **G1. RPC settle** (`20260602031543:313-317`): exige superadmin OU `access_role IN (owner/admin/manager/gerente/superadmin/super admin)` OU membership autorizada em `user_tenants`. **Barber e receptionist EXCLUÍDOS.**
- **G2. `role_permissions`** (`20260717000000`): tabela com `permission_key`, RLS (manager+superadmin). **Não auditei se algum fluxo de agendamento a consulta** (a confirmar na implementação).
- **G3. Rotas:** `ProtectedRoute` (auth + profileStatus), `ManagerRoute` (bloqueia barber/receptionist em páginas admin/finance), `SuperAdminRoute`.
- **G4. Consequência M4:** P5 (quem confirma atendimento) = barbeiro (próprio), recepção, gestão; gestão corrige retroativamente (P4). Precisa de matriz explícita + RPC com gate.

### H. Quem grava `attended_at` hoje?

- **H1. NINGUÉM.** M1 criou `attended_at` + `attended_at_source` com COMMENT: "Preenchido somente por RPC operacional autorizada (ADR-020 D-1). Nunca pela finance_settle_comanda." Nenhuma RPC atual o escreve.
- **H2. `finance_settle_comanda` NÃO escreve `attended_at`** (verificado em `20260602031543`: apenas `status='completed'` no appointment).
- **H3. Status do appointment** muda via `appointmentApplicationService.changeStatus` (Schedule.tsx `executeAppointmentStatusChange` ~1830, botões Confirmar/Iniciar/Finalizar ~2595-2641) **sem tocar `attended_at`**.
- **H4. Consequência M4:** P5 criará `confirm_appointment_attendance` (RPC transacional: seta `attended_at=now()`, `attended_at_source=NULL`, e `status='completed'`). P4 criará `correct_appointment_attendance` (gestão, motivo obrigatório, `before`/`after`, auditável, sem recalcular comissão retroativa automática).

### I. Como os desbloqueios acontecem?

- **I1. Automático (client-side):** `pages/Comandas.tsx:670-717` — hydrate detecta comanda `blocked` e localmente faz UPDATE para `open` (única ocorrência de "desbloque" no frontend, com `logSupabaseError('[Comandas] Erro ao desbloquear comandas'...)`). **Sem RPC, sem auditoria, sem motivo, sem operador.**
- **I2. Manual:** **NÃO EXISTE** (grep confirmou que não há UI de desbloqueio manual).
- **I3. Consequência M4:** P6 requer desbloqueio híbrido: automático (auditável server-side) + manual (autorizado, com motivo). `BLOCKED → OPEN` não pode preencher `attended_at`/`completed`/comissão. Criar RPC `unblock_comanda` (gate de papel) e reverter o unlock client-side para chamada RPC (ou ao menos auditar).

### J. Quais os gatilhos de comissão?

- **J1. Checkout (único caminho hoje):** `CheckoutApplicationService.settleComanda` (application/checkout.ts:544-629) monta payload `operationType:'create_commission_record'` → `settleCheckoutComandaAndEnqueue` → composite `finance_settle_comanda_and_enqueue` → `outbox_items` (status `pending`).
- **J2. Worker D8** (`supabase/functions/worker-dispatcher/index.ts`): `claim_next_outbox_item` (FOR UPDATE SKIP LOCKED) → `get_financial_operation_context` (só autoriza `create_commission_record`/`reverse_commission`; contexto mínino) → `calculateCommissionRecordsFromContext` (core `_shared/financial-core`) → idempotente insert → `published`/backoff/dead_letter → `recover_stale_processing` → heartbeat.
- **J3. Idempotência:** `commission_records` índice único parcial (1 original staff+comanda); `processed_operations` UNIQUE (tenant × idempotency_key).
- **J4. Gaps M4:** (a) composite enfileira `create_commission_record` **sempre** que o settle é não-idempotente — o `financialEffect` só vai no metadata e **o worker não avalia `financialEffect=false`** (verificar em index.ts antes de P7). (b) `AccountsReceivable` baixa via `settleCheckoutComanda` (settlement.ts:142 — SEM outbox), então **baixa financeira de recebível não enfileira comissão** (comportamento atual; confirmar se desejado).
- **J5. Consequência M4:** P7 (parcial) **não enfileira comissão**; P1-ESTORNAR enfileira `reverse_commission` (ou chama RPC de reversão de `commission_records`); P4/P6 **não** disparam comissão.

### K. RPCs relevantes (inventário)

| RPC | Migration | Observação M4 |
|---|---|---|
| `finance_settle_comanda` | `20260602031543` (atual) / `20260514000001` (1ª) | **LIVE**: aceita `blocked`+`open`; marca appointment `completed`; exclui barber/receptionist; estoque via `apply_inventory_sale_for_comanda`; pg_advisory_xact_lock |
| `finance_settle_comanda_and_enqueue` | `20260827000000` | Wrapper atômico settle+outbox; payload pass-through; sem gate financialEffect no SQL |
| `finance_reverse_transaction` | `20260515210804` | `p_refund_method`; `wrong_settlement` total → comanda `open` |
| `finance_zero_close_comanda` | `20260531161849` | Fechamento zero auditado (frente de AccountsReceivable) |
| `close_zero_amount_comanda` | frontend `src/lib/finance/zeroClose.ts` | `isManagerLikeRole` (linha 67) |
| `generate_club_receivables` | (accounts) | Recebíveis do Clube |
| `get_auth_access_context` | `20260308` | Contexto de acesso |
| `get_financial_operation_context` | `20260827120000` | Worker: só `create_commission_record`/`reverse_commission` |
| `claim_next_outbox_item` / `mark_outbox_item_processed` / `handle_processing_failure` / `recover_stale_processing` / `upsert_worker_heartbeat` | `20260827120000` + `20260828000000` | Superfície D8 |
| `create_appointment_with_comanda` | `20260506214059` | Cria agendamento + comanda `blocked` |
| `tenant_has_feature` | `20260807000000` | Padrão de config por tenant (candidato P8) |
| `approve_access_request` / `close_order` | legacy | Fase 3.3: precisam de auth check (fora do escopo M4) |

### L. RLS

- **L1. Padrão v2:** `current_is_super_admin_from_auth_uid() OR tenant_id = current_tenant_id_from_auth_uid()` (`20260723000000` centralizou; `20260715000000` habilitou RLS em `transactions` e padronizou `comandas`).
- **L2. `comanda_payments` (M3):** RLS v2 + policies SELECT; sem UPDATE/DELETE (append-only).
- **L3. `outbox_items`:** RLS com bypass superadmin + isolamento tenant + INSERT autenticado.
- **L4. Consequência M4:** tabelas novas (audit de correção P4, desbloqueio P6, settings P8) seguem o mesmo padrão; sem exceções de `service_role` no cliente.

### M. Testes existentes (base)

- **M1. Inventário:** 56 arquivos `*.test.ts` (glob). Relevantes: `application/appointment/appointment.test.ts` (grupos A validação / B lifecycle / C movement — cobre cancel/changeStatus/reschedule), `src/lib/finance/settlement.test.ts`, `application/checkout/finish.test.ts`, `domain/events/financialSubscribers.test.ts`, `domain/events/subscribers/commissionOnlyFinanceStrategy.test.ts`, `defaultFinanceStrategy.test.ts`, `domain/events/outbox/providers/*` (financeProvider, reverseCommissionHandler, createCommissionRecordHandler), `tests/d8/equivalence.test.ts`, `domain/commission/calculate.test.ts`, `domain/comanda/repository.test.ts`.
- **M2. Baseline conhecida:** `src/bootstrap/eventInfrastructure.test.ts` (1159/1 failed — pré-existente, não corrigir).
- **M3. Comando base:** `npm run build`, `npx tsc --noEmit --pretty false`, `git diff --check`.

---

## 4. Lacunas confirmadas por decisão do PO

| Decisão | Lacuna no estado atual | O que a implementação deve criar |
|---|---|---|
| **P1** (cancel + antecipado) | Cancelamento hoje ignora pagamentos; settle marca `completed` | Fluxo REMARCAR/ESTORNAR explícito; ajuste do `wrong_settlement` p/ comanda cancelada; nunca auto-refund |
| **P4** (correção retroativa) | Nada grava `attended_at`; sem histórico de correção | RPC `correct_appointment_attendance` (gestão, motivo, before/after, audit) |
| **P5** (confirmação) | `changeStatus` muda status sem `attended_at`; sem matrix de papéis | RPC `confirm_appointment_attendance` (barbeiro-próprio/recepção/gestão); sem auto-confirmação |
| **P6** (desbloqueio) | Auto-unlock client-side sem auditoria; sem manual | RPC `unblock_comanda` híbrido (auto auditável + manual com papel/motivo) |
| **P7** (parcial) | `comanda_payments` órfã; sem RPC gravadora | RPC `register_comanda_payment` (`parcial`/`anticipado`), sem `attended_at`/comissão/`paid` |
| **P8** (refund method config) | `refund_method` existe na reversão mas sem origem configurável | Config por tenant (feature_flags ou settings em `tenants`) + uso em cada estorno |

---

## 5. Pendências de evidência — FECHADAS (29/08/2026)

1. **Worker `financialEffect`** (`worker-dispatcher/index.ts:60-144`): o worker NÃO avalia `financialEffect`. O ciclo é claim → `get_financial_operation_context` → `calculateCommissionRecordsFromContext` (sem gate) → idempotente insert. O payload do outbox (`application/checkout.ts:564-588`) **nem contém** `financialEffect` — só `operationType`, `operationData`, `sourceEvent`, `idempotencyKey`, `metadata`. **Conclusão J4(a) confirmada:** quem decide se há efeito financeiro é o chamador (checkout), não o worker. Para P7 (parcial) e P1-ESTORNAR, a regra é **não enfileirar** `create_commission_record` (ou enfileirar `reverse_commission`), nunca confiar em flag no payload.
2. **`changeStatus`** (`application/appointment/movement.ts:15-35`): sem matrix de transição — só bloqueia `cancelled`/`no_show`; aceita qualquer `newStatus`; não toca `attended_at`. O frontend (`Schedule.tsx executeAppointmentStatusChange` ~1830) passa `newStatus: 'confirmed'|'in_progress'|'completed'`. **Conclusão:** P5 deve criar RPC própria de confirmação (`confirm_appointment_attendance`) que seta `attended_at` + `status='completed'` com gate de papel; o caminho `changeStatus` direto NÃO deve ser o meio de confirmar atendimento.
3. **Auto-unlock** (`pages/Comandas.tsx:670-717`): confirmado — filtra `status='blocked'` com `appointment_id`, desbloqueia via UPDATE direto na tabela quando `appointment.start_time <= hoje` (meia-noite), SEM RPC, SEM auditoria, SEM operador, SEM motivo. **Conclusão:** P6 troca esse UPDATE por RPC `unblock_comanda` (híbrido: automático auditável + manual autorizado).
4. **`detect_no_show_appointments`** (`20260423000002`): marca `pending`/`confirmed` → `no_show` após grace period; **não toca `comandas` nem `attended_at`**. Consequência: comanda `blocked` de um no-show continua `blocked` no banco e será desbloqueada pelo auto-unlock client-side (virando `open`). Para P6, no-show deve continuar sem `attended_at` e o desbloqueio da comanda deve seguir a mesma RPC auditada.
5. **`isManagerLikeRole`** (`src/lib/finance/zeroClose.ts:67-71`): inclui `owner/admin/adminmanager/gerente administrativo/manager/gerente/superadmin/super admin` + `canAccessSuperAdmin` bypass. **Conclusão:** reutilizar essa função (ou espelhar o gate no SQL) nas novas RPCs P4/P5/P6.

---

## 6. Próximo passo

Apresentar ao PO o **impacto das migrações P1/P4/P5/P6/P7/P8** (gate obrigatório): lista de novas migrations, alterações em RPC existentes (ex.: ajuste do `wrong_settlement`), e confirmação de que nenhuma migration antiga será alterada nem aplicada em produção sem aprovação.