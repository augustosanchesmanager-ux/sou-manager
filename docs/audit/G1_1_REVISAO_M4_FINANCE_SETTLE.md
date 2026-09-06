# G1.1 — Revisão Isolada da M4: Separação de Pagamento × Atendimento em `finance_settle_comanda`

> **Etapa:** G1.1 (revisão técnica isolada) · **Tipo:** Somente revisão/documentação
> **Data:** 29/08/2026 · **Responsável:** OpenCode (Tech Lead operacional)
> **Status:** CONCLUÍDA — NENHUMA alteração funcional, NENHUMA migration, NENHUM dado alterado
> **Escopo de entrega:** este documento (+ resposta no formato G1.1). Implementação da M4 é etapa posterior, somente após decisão formal do PO.

---

## 1. Resumo Executivo

A RPC **`finance_settle_comanda`** (baixa financeira central) hoje **aceita comandas no status `blocked`** e, sempre que a comanda possui `appointment_id`, **marca o agendamento como `completed` incondicionalmente** — inclusive quando o pagamento é antecipado e o atendimento ainda não ocorreu. Esse comportamento conflita com:

- **ADR-017** (Pagamento ≠ Atendimento — `paid_at` ≠ `attended_at`);
- **ADR-020** (D-1: `attended_at` preenchida somente por RPC operacional autorizada; *"Nunca pela finance_settle_comanda"* — comentário oficial da migration M1);
- **ADR-018** (pagamento é entidade explícita — `comanda_payments` / `payment_type`), e
- **DP1 do PLANO_EVOLUCAO** (comanda `blocked` permanece bloqueada; financeiro é derivado pelo saldo `net_total − paid`).

**Consequência prática (provável, não observada em produção):** um pagamento antecipado registrado via settle em comanda `blocked` produz `appointments.status='completed'` **antes** do atendimento real, corrompendo a fonte de verdade operacional que alimenta agenda, fechamento de caixa (contagem de atendimentos), relatórios e datas de produção de comissão (que derivam de `appointment.start_time`).

**Direção da M4 (proposta conceitual):** a settle deve **registrar o pagamento** (receita + `comanda_payments` com `payment_type`) e **nunca derivar atendimento de pagamento**. A marcação de `attended_at`/`completed` deve passar a ser feita exclusivamente por fluxo/RPC operacional autorizada, com o atendimento confirmado. A M4 exige decisões formais do PO (DP-M4-01..10).

---

## 2. Estado Atual (o que `finance_settle_comanda` faz hoje)

### 2.1 Versão vigente em produção

Migration **`20260602031543_create_inventory_movements_and_comanda_stock_settlement.sql`** (CREATE OR REPLACE da RPC; altera a versão original de `20260514000001`). Características comprovadas (arquivo:linha):

| Aspecto | Evidência | Comportamento |
|---|---|---|
| `SECURITY DEFINER` + `search_path=public` | cabeçalho da migração | RPC roda com privilégios do dono |
| Autenticação obrigatória | linha 293 | `IF v_auth_uid IS NULL THEN RAISE ...` |
| Autorização de papel | linhas 301-317 | exige `owner/admin/manager/gerente/superadmin` (profiles/staff) OU membership autorizada (`owner/admin/manager/gerente/superadmin/super admin`) |
| Tenant (cross-tenant bloqueado) | linhas 299-322, 338-339 | `current_tenant_id_from_auth_uid()`; superadmin bypass; comanda `FOR UPDATE` por tenant |
| Idempotência primária | linhas 324-334 | confere `transactions.idempotency_key`; retorna `idempotent=true` se mesma chave/source |
| Lock de concorrência | linha 336 | `pg_advisory_xact_lock(hashtext('finance_settle_comanda:' \|\| tenant \|\| ':' \|\| comanda))` |
| Comanda já paga | linhas 341-350 | idempotente se mesma chave; senão `RAISE 'Comanda já está baixada'` |
| **Status aceito** | **linha 351** | **`IF v_comanda.status NOT IN ('open', 'blocked')`** → **aceita `open` E `blocked`** |
| Estoque | linhas 353-358 | `apply_inventory_sale_for_comanda` na mesma transação |
| Comanda → `paid` | linhas 360-364 | `status='paid'`, `payment_method`, `closure_mode='standard'`, `financial_effect=true`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `closed_at` |
| Receita | linhas 366-371 | INSERT `transactions` `type='income'`, categoria `'Receita de Comanda'`, `source_type='comanda'`, `source_id`, idempotency_key, metadata com `amount_difference` |
| **Agendamento** | **linhas 373-376** | **`IF v_comanda.appointment_id IS NOT NULL THEN UPDATE public.appointments SET status='completed' WHERE id=... AND tenant_id=... AND status <> 'completed'`** → **marca `completed` INDEPENDENTE de ter atendido** |
| Grants | linhas 381-382 | REVOKE PUBLIC + GRANT EXECUTE TO `authenticated` |

### 2.2 Versão original (mesmo defeito)

Migration **`20260514000001_finance_settle_comanda_rpc.sql`**:
- linha 90: mesma condição `NOT IN ('open', 'blocked')`;
- linhas 105-108: mesmo `UPDATE public.appointments SET status='completed'` incondicional.

### 2.3 Callers da RPC

| Camada | Arquivo:linha | Chamada |
|---|---|---|
| Checkout (front) | `pages/Checkout.tsx:29` | `settleCheckoutComanda` |
| Contas a Receber | `pages/AccountsReceivable.tsx:12, 805` | `settleCheckoutComanda` (modo `payment`) |
| Wrapper D7 | `src/lib/finance/settlement.ts:72-138` | `settleCheckoutComandaAndEnqueue` → `rpc('finance_settle_comanda_and_enqueue')` |
| Wrapper clássico | `src/lib/finance/settlement.ts:142-202` | `settleCheckoutComanda` → `rpc('finance_settle_comanda')` |
| Checkout (app service) | `application/checkout.ts:544-629` | `settleComanda` → `settleCheckoutComandaAndEnqueue` (idempotency `finance-settle-{comandaId}-{idempotencyKey}`) |

---

## 3. Evidência da Falha (prova estática, sem alteração de código)

### 3.1 Defeito 1 — settle aceita `blocked`

- `20260602031543...sql:351` → `IF v_comanda.status NOT IN ('open', 'blocked') THEN RAISE EXCEPTION 'Comanda nao pode ser baixada no status atual: %'`
- **Contraste:** `finance_zero_close_comanda` aceita SOMENTE `open` (`20260531161849...:170`): `IF v_comanda.status IS DISTINCT FROM 'open' THEN RAISE ...`
- **Contraste:** tela de Contas a Receber lista apenas comandas `open` (`pages/AccountsReceivable.tsx:414` `.eq('status', 'open')`)
- **Contraste:** checkout recusa comanda `blocked` (`pages/Checkout.tsx:770-774`) — toast *"comanda bloqueada para este dia"*
- **Contraste:** `application/checkout.ts:281-295` (`verifyComandaOpenStatus`) rejeita qualquer status ≠ `open` no sync de comanda

### 3.2 Defeito 2 — settle marca `appointments.status='completed'` sem confirmar atendimento

- `20260602031543...sql:373-376` e `20260514000001...sql:105-108`: UPDATE incondicional (qualquer status ≠ `completed`).
- Nenhuma verificação de `start_time`, `in_progress`, presença física ou `attended_at`.
- Para uma comanda `blocked` criada por agendamento futuro (`20260506214059_consolidate_create_appointment_with_comanda_rpc.sql:161-163` — `p_start_time::date > current_date → v_comanda_status := 'blocked'`), a settle produziria `appointment='completed'` **no futuro, antes do atendimento**.

### 3.3 Defeito 3 — `attended_at` nunca é preenchida pela settle

- Migration M1 `20260829000000_attended_at.sql:12-16`:
  - *"Timestamp do atendimento efetivamente realizado. Preenchido somente por RPC operacional autorizada (ADR-020 D-1). **Nunca pela finance_settle_comanda.**"*
  - `attended_at_source`: `NULL=fluxo real`; `backfill_evidence`; `inferred_from_payment` (somente com revisão humana e flag explícita).
- A settle (e nenhuma RPC atual) preenche `attended_at`. Consequência: `paid_at` ≠ `attended_at` não é representável hoje no fluxo de baixa — exatamente o que a M4 deve corrigir.

### 3.4 Defeito 4 — cadeia operacional inconsistente (derivação indireta de "atendimento")

- Comissão de linhas de comanda `blocked` entra em bucket **pendente** (`application/commission.ts:242` inclui `blocked`; agrupamento `:446-456` → `paid`=confirmada, `cancelled`=cancelada, senão pendente). Correto.
- Porém a **data de produção** da comissão usa `appointment.start_time` quando existe (`application/commission.ts:193-198`; `pages/Commissions.tsx:215-218`). Se o pagamento antecipado fosse baixado via settle (comanda `blocked` → `paid`), a comissão seria **confirmada na data futura do agendamento**, antes do atendimento.
- D8 worker (`supabase/functions/worker-dispatcher/calculate.ts:150-204`): não consulta `appointments.status` nem `attended_at`; usa `comanda.total` como `paidAmount` por ausência de coluna `paid_amount` (field presence). Ou seja, um item de outbox de comanda antecipada geraria registro de comissão hoje.
- `application/cashClosing/summary.ts:117` e `operations.ts:256`: contagem de `appointments_completed_count` deriva de `appointments.status='completed'` — seria corrompida por atendimentos marcados via pagamento.

### 3.5 Sinalizações operacionais adicionais

- `pages/Comandas.tsx:670-717`: **auto-desbloqueio client-side** de comandas `blocked` quando `appointment.start_time <= hoje` — via `UPDATE comandas SET status='open'` direto no client Supabase (bypass de RPC). Confirma que `blocked` hoje é um *guard* fraco baseado em data, não em confirmação de atendimento.
- `application/appointment/movement.ts:15-35` (`changeStatus`): permite transições manuais `confirmed/in_progress/completed` via agenda — único fluxo operacional atual que confirma atendimento (sem preencher `attended_at`).

---

## 4. Problema Semântico (Pagamento ≠ Atendimento)

O núcleo do problema é **ontológico**, não meramente um bug de condição:

1. `finance_settle_comanda` responde à pergunta **financeira**: "registrar recebimento de X reais desta comanda".
2. A marcação de `appointments.status='completed'` responde à pergunta **operacional**: "o serviço foi efetivamente prestado?".
3. Hoje a settle responde a **ambas** — e a segunda é derivada da primeira sem qualquer evidência de atendimento.

Isso viola a cadeia canônica oficial:
```
Pagamento (comanda_payments/transactions)  ≠  Atendimento (attended_at/appointments.status)  ≠  Comissão (confirmada após atendimento)
```
(ADR-017, ADR-018 D-1/D-2, ADR-020 D-1; DP1/DP3/DP4 do PLANO_EVOLUCAO.)

---

## 5. Comportamento Desejado (base normativa)

| Fonte | Regra |
|---|---|
| ADR-017 R0 | Pagamento antecipado é permitido e deve ser registrado **sem** marcar atendimento. `paid_at` ≠ `attended_at`. |
| ADR-020 D-1 | `attended_at` preenchida **somente** por RPC operacional autorizada; **nunca** pela settle. |
| ADR-018 D-1/D-2 | Pagamento é registrado em `comanda_payments` com `payment_type` explícito (`anticipado`, `no_atendimento`, `posterior`, `parcial`, `final`); `payment_type` nunca derivado por datas. |
| PLANO_EVOLUCAO DP1 | Comanda `blocked` permanece bloqueada após pagamento antecipado; financeiro derivado por saldo (`balance = net_total − paid`). |
| PLANO_EVOLUCAO DP3 (P1) | `no_atendimento` é o caso-padrão futuro. |
| PLANO_EVOLUCAO DP4 | Pagamento parcial é permitido (múltiplos `comanda_payments`). |
| PLANO_EVOLUCAO DP5 | Contas a Receber enquanto saldo > 0. |
| ADR-019 DP11-DP14 | Regras de autorização por papel (recepção ⇒ somente antecipado integral com pagamento; baixa administrativa `isManagerLikeRole`; motivo obrigatório; sem alteração de valor/desconto pós-pagamento). |

**Comportamento-alvo sintético:**
- Settle registra receita + `comanda_payments(payment_type)` e **toca `appointments` SOMENTE quando o atendimento está comprovadamente ocorrendo** (ex.: `appointments.status IN ('in_progress')` no momento da baixa e/ou via parâmetro explícito de confirmação operacional).
- A confirmação de atendimento (preencher `attended_at` e mover para `completed`) passa a ser responsabilidade de fluxo/RPC operacional autorizada (a definir na M4/DP-M4-04).

---

## 6. Mapa da RPC `finance_settle_comanda`

- **Assinatura:** `(p_tenant_id UUID, p_comanda_id UUID, p_payment_method TEXT, p_paid_amount NUMERIC, p_payment_date_real TIMESTAMPTZ DEFAULT now(), p_source TEXT DEFAULT 'checkout', p_notes TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL)`.
- **Defesas existentes:** auth.uid; papel; tenant; advisory lock; `FOR UPDATE`; idempotência primária e de comanda-paga; `amount_difference` no metadata (regista pago ≠ total para rastreio).
- **Gaps:** sem leitura de `appointments.status`; sem `payment_type`; sem escrita em `comanda_payments`; sem `attended_at`; sem parâmetro de confirmação de atendimento; aceita `blocked`.
- **Delegate de estoque:** `apply_inventory_sale_for_comanda` (chamada antes do UPDATE; rollback total da transação em falha).

---

## 7. Mapa de Appointment (`appointments.status`)

**CHECK vigente** (`20260421000000_add_cancellation_reason_and_noshow.sql:7-8`): `('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')`. (A migração `20260306_smart_schedule.sql:26` criou constraint com `scheduled`; foi substituída.)

**Escritas em `appointments.status` (todas as migrations):**

| Migration | Linha | Status | Origem |
|---|---|---|---|
| `20260423000001_migrate_scheduled_to_confirmed.sql` | 5 | `confirmed` | backfill de `scheduled` |
| `20260420110000_bulk_close_comandas_admin.sql` | 82 | (depende) | fechamento em lote admin |
| `20260423000000_add_cancellation_audit_fields.sql` | 30 | `cancelled` | cancelamento |
| `20260423000002_detect_no_show_function.sql` | 21 | `no_show` | RPC `detect_no_show` |
| `20260514000001_finance_settle_comanda_rpc.sql` | 106 | `completed` | **settle (defeito)** |
| `20260531161849_finance_zero_close_comanda_rpc.sql` | 362 | `completed` | zero-close (apenas `pending/in_progress`) |
| `20260602031543_create_inventory_movements_and_comanda_stock_settlement.sql` | 374 | `completed` | **settle (defeito)** |
| `bulk_close_comandas_with_credits.sql` | 128 | (depende) | fechamento em lote com créditos |

**Camada de aplicação:** `application/appointment/movement.ts:15-35` (`changeStatus`) permite transições `confirmed → in_progress → completed` (bloqueia `cancelled/no_show`). `pages/Schedule.tsx:1834-1837` usa esse serviço.

**Conclusão do mapa:** o único caminho *legítimo* para `completed` deveria ser operacional; hoje existem **três** caminhos: agenda manual, zero-close condicional e settle incondicional.

---

## 8. Mapa de `attended_at` (M1)

- Colunas: `attended_at TIMESTAMPTZ NULL`, `attended_at_source TEXT NULL` (`20260829000000_attended_at.sql`).
- **Nenhum código atual escreve `attended_at`** (grep em `*.ts`/tests: 0 resultados; migrations: só a definição M1).
- Semântica documentada no COMMENT da coluna (ADR-020 D-1 — ver §3.3).
- **Gap da M4:** criar o fluxo operacional que preenche estas colunas (check-in / conclusão de atendimento), com `attended_at_source='NULL'` no fluxo real.

---

## 9. Mapa de Comandas (`comandas.status`)

- Status existentes: `open`, `blocked`, `paid`, `cancelled` (pelo comportamento das RPCs/páginas; ver `getCommissionStatus`/`Commissions.tsx:31`).
- **Criação `blocked`:** `20260506214059_consolidate_create_appointment_with_comanda_rpc.sql:161-163` — agendamento futuro ⇒ `v_comanda_status='blocked'`; `:228-230` insere comanda com esse status; `:218` appointment `confirmed`.
- **Cancelamento de comandas `open` E `blocked`:** `application/appointment/lifecycle.ts:229-243` (`cancelAppointment`) — move para `cancelled` com `cancellation_type` etc.
- **Desbloqueio:** `pages/Comandas.tsx:670-717` — client-side, quando `appointment.start_time <= hoje` ⇒ `status='open'` (UPDATE direto, sem RPC, sem auditoria operacional).
- **Baixa:** `finance_settle_comanda` (`open|blocked` → `paid`); `finance_zero_close_comanda` (`open` → `paid`, `financial_effect=false`).
- **Estorno:** `finance_reverse_transaction` (`paid` → `open` na modalidade `wrong_settlement` integral — `20260515210804...sql:104-107`).

---

## 10. Mapa de Financeiro (fechamento/efeito financeiro)

- `finance_settle_comanda`: cria `transactions` income com `financial_effect=true`; comanda `paid`; `payment_date_real` preenchido; `closed_at = payment_date_real`.
- `finance_zero_close_comanda` (`20260531161849...:339-353`): `status='paid'`, `financial_effect=false`, `payment_date_real=NULL`, `settled_at/closed_at=now`, auditoria em `closure_note` (`v_audit` JSONB), **sem transação**.
- **Gap da M4:** pagamento antecipado (comanda permanecendo `blocked` ou aberta com saldo) precisa de receita real em data do pagamento **e** `comanda_payments(payment_type='anticipado')`, sem alterar a data de atendimento.

---

## 11. Mapa de Transactions

- `transactions`: `tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata` (settle `:366-371`).
- Categoria de receita: `'Receita de Comanda'`; `source_type='comanda'`, `source_id=comanda_id`.
- **Estorno:** `finance_reverse_transaction` grava transação `expense` + linha em `financial_reversals` (`20260515210114_financial_reversals_schema.sql` — CHECK `reversal_type`, índice único por `(tenant_id, idempotency_key)`, RLS).
- `cashClosing` lê `transactions` (receitas/despesas) — não observável neste documento.

---

## 12. Mapa de Comanda Payments (M3)

- Tabela `comanda_payments` (`20260829020000_comanda_payments.sql`, ADR-018 D-2):
  - `payment_type public.payment_type NOT NULL` (enum M2: `anticipado|no_atendimento|posterior|parcial|final`);
  - `amount > 0`; `payment_method`; `actor_id`; `motivo`; `reversed_at`; `idempotency_key`;
  - índice único parcial `(tenant_id, idempotency_key)` — **append-only**, sem UPDATE/DELETE policies (reversão via `reversed_at` em G2).
- **Estado atual:** **nenhum código escreve em `comanda_payments`** (tabela criada em A1, aguardando M4/G2).
- **Papel na M4:** fonte de verdade do pagamento; `payment_type` explícito; reversão via `reversed_at`.

---

## 13. Idempotência

| Camada | Mecanismo | Evidência |
|---|---|---|
| Settle | `transactions.idempotency_key` (consulta prévia + INSERT) | `20260602031543...:324-334` |
| Settle (comanda já paga) | busca transação income de mesma chave; retorna idempotente | `:341-350` |
| Composite D7 | skip do outbox quando `idempotent=true`; `ON CONFLICT (event_id) DO NOTHING` | `20260827000000...:75-80, 120` |
| Estoque | `apply_inventory_sale_for_comanda(p_idempotency_key)` | `...:353-358` |
| Zero-close | idempotência por chave + linha de auditoria existente | `20260531161849...:152-168` |
| `comanda_payments` | índice único parcial `(tenant_id, idempotency_key)` | M3 |

**Observação M4:** a idempotência atual da settle por `transactions.idempotency_key` permanece válida; a M4 deve manter a mesma chave ao inserir em `comanda_payments` (chave derivada determinística por pagamento) para evitar duplicidade.

---

## 14. Concorrência

- Advisory lock: `pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || tenant || ':' || comanda))` (`:336`).
- `SELECT ... FOR UPDATE` da comanda antes de qualquer mutação (`:337-338`).
- Check `GET DIAGNOSTICS ROW_COUNT` no zero-close (`:355-359`) para detectar corrida.
- **Gap M4:** adoção em massa de pagamentos parciais (`comanda_payments`) exige decisão sobre concorrência na soma de pagamentos (ex.: `FOR UPDATE` sobre comanda + agregação em `comanda_payments`, ou tabela de saldo derivado). Recomenda-se manter o lock existente.

---

## 15. Comissão

- Domínio: `domain/commission/calculate.ts` (`resolveFinancialBase` — comissão proporcional ao `receivedValue`; `receivedValue=min(netValue, paidAmount)`).
- App: `application/commission.ts:242` inclui `blocked` nas linhas; bucket `pending` para `open/blocked` (`:446-456`).
- Data de produção: `appointment.start_time` se existir (`application/commission.ts:193-198`) — **risco M4 confirmado** se settle confirmar atendimento antecipado.
- D8 worker: `supabase/functions/worker-dispatcher/calculate.ts` — não lê status de atendimento; grava `commission_records` via RPC de persistência (`exists_commission_record` + insert; migrações D8). **Se a M4 separar atendimento de pagamento, o worker precisa de gate de atendimento (DP-M4-02/04).**
- `commission_records` idempotência: deduplicado via chave; fora do escopo desta revisão aprofundar (D8 já certificado).

---

## 16. Outbox (D7 — `finance_settle_comanda_and_enqueue`)

- Migration `20260827000000_transactional_outbox_composite_rpc.sql`:
  - Passo 1: chama `finance_settle_comanda` na mesma transação (`:54-63`);
  - Passos 2-3: valida `success`; se `idempotent` ⇒ retorna sem outbox (`:66-80`);
  - Passo 4: INSERT `outbox_items(event_id, event_type, tenant_id, targets, status='pending', payload, metadata, retry…)` com `ON CONFLICT (event_id) DO NOTHING` (`:93-120`);
  - Grants `authenticated` (`:139-142`).
- Payload gerado (origem checkout): `application/checkout.ts:560-588` — evento `CheckoutCompleted`, operação `create_commission_record`, idempotency `${eventId}_create_commission_record`.
- **Envolvimento na M4:** a mensagem de outbox dispara a criação de comissão (via D8 worker + FinanceProvider). A separação pagamento×atendimento exige que **a enqueue aconteça apenas quando o pagamento for efetivo e o evento carregue informação de atendimento** (ou que o worker aplique a regra de atendimento).

---

## 17. Event Store

- Eventos domínio: `CheckoutCompleted` publicado via `appEventBus.publish` (`application/checkout.ts:734-756`) com `financialEffect`, `paymentStatus`, etc.
- `event_store` (migration `20260723100000_event_store.sql`): append-only, RLS, payload/metadata separados.
- **Gap M4:** necessário evento explícito de "atendimento realizado" (DP-M4-04) para orquestrar `attended_at`/`completed` e reações (lembretes, BI, etc.). Hoje `AppointmentCompleted` está *prepared* mas não publicado.

---

## 18. Estorno (`finance_reverse_transaction`)

- Migration `20260515210804_finance_reverse_transaction_rpc.sql`.
- Modalidade `wrong_settlement` integral: comanda volta a `open` (`:104-107`); despesa + `financial_reversals`.
- **Não toca** em `appointments.status` nem `attended_at`.
- **Gap M4:** estorno de pagamento antecipado precisa definir: (a) reverter `comanda_payments` via `reversed_at` (append-only) e (b) **não** desmarcar atendimento (que não foi marcado). Hoje não há `reversed_at` em uso.

---

## 19. Cancelamento

- `application/appointment/lifecycle.ts:210-289` (`cancelAppointment`): marca appointment `cancelled/no_show` e comandas `open`+`blocked` → `cancelled` (`:229-243`; `:248-258`), com `cancellation_type`, `cancellation_reason`, `cancelled_at`, `cancelled_by_user_id`; evento `AppointmentCancelled`.
- RLS/auditoria: campos de auditoria em `20260423000000_add_cancellation_audit_fields.sql`.
- **Gap M4:** cancelar comanda com pagamento antecipado já registrado deve acionar **estorno automático/guia** (DP-M4-06). Hoje comanda `paid` **não** é cancelada por `cancelAppointment` (só `open|blocked`).

---

## 20. No-show

- RPC de detecção: `20260423000002_detect_no_show_function.sql:21` → `appointments.status='no_show'`.
- `changeStatus` bloqueia transição a partir de `no_show` (`movement.ts:27-31`).
- **Gap M4:** no-show com pagamento antecipado precisa de política (estorno? crédito? regra de negócio — DP-M4-07).

---

## 21. Auditoria

- `transactions.metadata` da settle: `source`, `comanda_id`, `tenant_id`, `comanda_total`, `paid_amount`, `amount_difference`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `notes`, `idempotency_key` (`:370`).
- Zero-close: JSONB audit em `closure_note` com `zero_close_origin`, `financial_effect`, `credits_consumed`, etc.
- `event_store` + `audit_logs` + `financial_reversals` para trilha.
- **Gap M4:** `comanda_payments(actor_id, motivo)` + `reversed_at` para auditoria de pagamentos parciais/antecipados; ausência de RPC operacional para `attended_at` gera lacuna de rastreabilidade de "quando de fato atendeu".

---

## 22. Segurança

- Autenticação/autorização da settle: ver §6 (recusa sem papel/tenant).
- Teste formalizado: `tests/e2e/homologation/h6-security.spec.ts:318-319` (H6-10 cross-tenant bloqueado) e `:220-247` (H6-1 anon bloqueado para `finance_settle_comanda`).
- **A M4 não deve enfraquecer:** manter SECURITY DEFINER com `search_path=public` fixo, `auth.uid()` explícito, verificação de papel/membership e tenant, `FOR UPDATE`, advisory lock e grants apenas para `authenticated`.
- **Recomendação:** adicionar RPC de confirmação de atendimento protegida pelo mesmo padrão (papel operacional, tenant, idempotência) — e **não** permitir que cliente barber/recepcionista marque atendimento de outro tenant.

---

## 23. RLS

- `comanda_payments` M3: SELECT/INSERT com `current_is_super_admin_from_auth_uid() OR tenant_id = current_tenant_id_from_auth_uid()`; **sem** UPDATE/DELETE (append-only) — reversão via `reversed_at`.
- Padrões globais: `20260227223434_fix_all_rls_policies_use_security_definer_function.sql`; superadmin bypass `current_is_super_admin_from_auth_uid()`.
- **Impacto M4:** novas tabelas/colunas (`attended_at` em `appointments`) já cobertas pela RLS existente de `appointments`; nenhuma nova tabela prevista na M4 além do fluxo de confirmação (que pode ser RPC + colunas existentes).

---

## 24. Compatibilidade

| Camada | Compatível com M4? | Obs. |
|---|---|---|
| Checkout atual (sem antecipado) | ✅ | Pagamento no atendimento continua comportando-se igual; UT/E2E existentes preservados |
| Zero-close | ✅ | Não muda (não gera `comanda_payments`, `financial_effect=false`) |
| Contas a Receber | ✅ | `settleCheckoutComanda` continua; passa a escrever `comanda_payments` |
| Estorno | ✅ (com ajuste) | Passa a marcar `reversed_at` em `comanda_payments`; comanda `paid→open` permanece |
| Cancelamento | ✅ (com ajuste) | Política para comanda `paid` com pagamento antecipado (DP-M4-06) |
| No-show | ✅ (com ajuste) | Política para pagamento antecipado (DP-M4-07) |
| D8 worker / outbox | ⚠️ | Gate de atendimento ou enriquecimento do evento (DP-M4-02/04) — **fronteira de integridade D8 intocada**, mudança somente via nova regra aprovada |
| Comissão | ⚠️ | Confirmada com pagamento; data de produção deve usar `attended_at` quando presente |
| Fechamento de caixa / relatórios | ✅ | `appointments_completed_count` passa a refletir atendimento real |
| Frontend (Comandas auto-desbloqueio) | ⚠️ | `pages/Comandas.tsx:670-717` deve ser revisto: desbloqueio por data não é confirmação de atendimento |

---

## 25. Proposta M4 (conceitual — NÃO implementada nesta etapa)

> Direção preliminar para decisão do PO. Nada abaixo foi aplicado.

### 25.1 Princípios
1. **Pagamento ≠ Atendimento** (ADR-017/020). A settle registra receita e `comanda_payments`; **não** altera `appointments` salvo regra explícita aprovada.
2. **`attended_at` por RPC operacional autorizada** (check-in/conclusão de atendimento); `completed` decorre de atendimento, não de pagamento.
3. **`payment_type` explícito** (`anticipado|no_atendimento|posterior|parcial|final`) — nunca derivado por datas (ADR-018).
4. **Idempotência e concorrência preservadas** (mesma chave/`FOR UPDATE`/advisory lock).
5. **Segurança/RLS intactas** (papel, tenant, SECURITY DEFINER fixo, grants `authenticated`).

### 25.2 Esboço de mudanças RPC (M4)
- `finance_settle_comanda`:
  - parâmetro novo opcional, ex.: `p_attendance_confirmed BOOLEAN DEFAULT NULL` (ou leitura de `appointments.status IN ('in_progress')`);
  - INSERT em `comanda_payments` (`payment_type` decido pela regra aprovada; para antecipado ⇒ `'anticipado'`/`'parcial'`);
  - UPDATE de `appointments.status='completed'` **somente** quando atendimento confirmado; caso contrário comanda `blocked` permanece bloqueada (DP1);
  - remoção da aceitação de `blocked` como baixa "completa" (substituída por registro de pagamento + saldo).
- Nova RPC operacional (esboço): `confirm_appointment_attended(p_tenant_id, p_appointment_id, p_idempotency_key, ...)` — preenche `attended_at` (`attended_at_source=NULL`), move `appointments.status='completed'`, publica evento `AppointmentCompleted` (append-only Event Store).
- Ajuste em `comanda_payments`: reversão via `reversed_at` (já prevista — ADR-018), mantendo append-only.
- Ajuste no outbox/evento `CheckoutCompleted`: transportar flag/semântica de atendimento para o D8 worker avaliar gate de comissão (DP-M4-02). **Fronteira de integridade do Financial Core/D8 intocada** — validação de divergência (`npm run d8:verify`) permanece obrigatória para qualquer mudança.

### 25.3 Fora de escopo da M4 (recomendado)
- Backfill de `attended_at` para dados históricos sem prova (ADR-020 — negado até nova decisão).
- Migração de status de comandas órfãs (trabalho separado — branch `chore/saneamento-comandas-orfas-historicas`).

---

## 26. Arquivos Afetados (proposta M4 — estimativa)

> Apenas planejamento. **Nenhum arquivo foi alterado nesta etapa G1.1.**

- Migrations novas: 1 (ajuste `finance_settle_comanda`/novo RPC de confirmação) + opcionalmente ajuste de outbox/worker rule.
- Migrations existentes: **M1-M3 intocadas** (a menos que a revisão revele incompatibilidade crítica — não revelou).
- Frontend: `pages/AccountsReceivable.tsx` (modo antecipado), `pages/Comandas.tsx` (remover auto-desbloqueio por data ou redirecionar para fluxo de atendimento), `pages/Schedule.tsx`/`Checkout.tsx` (UX de pagamento antecipado), `pages/Commissions.tsx` (data de produção por `attended_at`).
- Aplicação: `application/checkout.ts` (parâmetros de antecipado), `application/appointment/*` (confirmação de atendimento), `application/commission.ts` (data de produção).
- Testes: novos (`comanda_payments`, `attended_at`, antecipado integral/parcial, estorno, no-show, cancelamento com pagamento) + ajuste dos existentes que assumem settle que marca `completed`.

---

## 27. Testes (plano para M4 — Given/When/Then)

> Nenhum teste foi escrito/alocado nesta etapa; plano abaixo para decisão do PO.

### Cenários A–H (matriz de regressão obrigatória)

| # | Cenário | Given | When | Then (esperado) |
|---|---|---|---|---|
| A | Pagamento no atendimento (fluxo atual) | comanda `open`, appointment `in_progress` no momento da baixa | settle com pagamento integral | comanda `paid`; `transactions` income; `comanda_payments(no_atendimento)`; `appointments.status='completed'` com `attended_at` preenchido pela RPC de confirmação; comissão confirmada |
| B | Atendimento sem pagamento | appointment atendido em 31/08, comanda `open`, saldo | confirmação de atendimento em 31/08; pagamento em 02/09 | `attended_at='31/08'`; `payment_date_real='02/09'`; comanda `paid`; `comanda_payments(posterior)`; comissão confirmada |
| C | Antecipado integral | comanda `blocked`, appointment futuro | settle com pagamento integral (recepção, ADR-019 DP11) | comanda permanece com saldo=0 (ou `blocked`/paga conforme DP1); **appointment NÃO vira `completed`**; `comanda_payments(anticipado)`; sem comissão antes do atendimento |
| D | Antecipado parcial (R$30 + R$40) | comanda `blocked` (total R$70), appointment futuro | 1º pagamento R$30; depois R$40 | `comanda_payments(parcial R$30)` + `comanda_payments(final R$40)`; saldo=0; appointment NÃO `completed` até atendimento; comissão só após atendimento |
| E | Estorno de antecipado | comanda `paid` (antecipado), appointment ainda `confirmed` | `finance_reverse_transaction` (wrong_settlement) | comanda `open`; `financial_reversals`; `comanda_payments.reversed_at` setado; appointment permanece `confirmed` |
| F | Cancelamento com pagamento antecipado | appointment `confirmed` + comanda com `comanda_payments` | cancelar appointment | política DP-M4-06 aplicada (estorno automático a definir); comanda cancelada; sem `attended_at` |
| G | No-show com pagamento antecipado | appointment `confirmed`, comanda com pagamento | RPC detect_no_show / no-show | política DP-M4-07 aplicada; comanda tratada conforme regra; sem `attended_at` |
| H | Checkout normal sem appointment (walk-in) | comanda `open` sem `appointment_id` | settle | comanda `paid`; `transactions`; `comanda_payments(no_atendimento)`; sem UPDATE de appointment; comissão conforme regra normal |

### Cobertura adicional de testes
- Unit (domain): `calculateCommissionRecordAttendedGate` (DP-M4-02), `resolvePaymentType` (nunca derivar por datas), `reversal comanda_payments.reversed_at`.
- App service: settle com `p_attendance_confirmed`, `confirm_appointment_attended` (idempotente, tenant-safe), cancelamento de comanda `paid` (política), no-show com pagamento.
- RPC/DB (Docker descartável): transacionalidade settle+comanda_payments, idempotência com chave repetida, concorrência com advisory lock, RLS de `comanda_payments`.
- E2E: fluxo antecipado integral (recepção), parcial, estorno, cancelamento, no-show.
- D8: **equivalência** (`equivalence.test.ts`) — qualquer mudança de regra de comissão exige atualização do Financial Core exportado + `npm run d8:verify` + reaprovação (ADR-016).

---

## 28. Matriz de Regressão (áreas afetadas pela M4)

| # | Área | Impacto M4 | Estratégia de mitigação |
|---|---|---|---|
| 1 | Checkout padrão (A) | Baixo | UT `finish.test.ts` + E2E fluxo1 |
| 2 | Checkout antecipado (C/D) | Alto (novo) | Novos testes C/D |
| 3 | Zero-close | Nulo (não usa settle) | UT `cashClosing` existentes |
| 4 | Estorno | Médio | Testes E + `financial_reversals` |
| 5 | Cancelamento | Médio | Testes F + `cancelAppointment` |
| 6 | No-show | Médio | Testes G + `detect_no_show` |
| 7 | Comissão (app) | Médio | `commission.test.ts` + data de produção por `attended_at` |
| 8 | Comissão (D8 worker/outbox) | **Crítico** | Equivalence tests + d8:verify + reaprovação ADR-016 |
| 9 | Contas a Receber | Médio | Testes de baixa parcial/antecipada |
| 10 | Agenda (Schedule) | Médio | `changeStatus` + confirmação de atendimento |
| 11 | Comandas (auto-desbloqueio) | Médio | Revisão do efeito `670-717` |
| 12 | Transações/relatórios financeiros | Baixo | Regressão de relatórios |
| 13 | Fechamento de caixa | Médio | `appointments_completed_count` deriva agora de atendimento real |
| 14 | Dashboard/BI | Baixo | Semana/atendimentos |
| 15 | Estoque (apply_inventory_sale) | Nulo | Settle mantém `apply_inventory_sale_for_comanda` idempotente |
| 16 | Event Store/Event Bus | Médio | Novo evento `AppointmentCompleted` |
| 17 | Auditoria/observabilidade | Médio | Logs de `attended_at` e `comanda_payments` |
| 18 | Segurança/RLS | Nulo | Manter padrão atual (testes h6) |
| 19 | Migrations M1-M3 | Nulo | Intocadas (ADR-018/020 já as preveem) |

---

## 29. Rollback

- **Estratégia:** a M4 deve ser **aditiva**:
  - se necessário reverter, basta: (1) manter `finance_settle_comanda` com o novo parâmetro DEFAULT NULL que preserva comportamento antigo quando ausente; (2) nova RPC de confirmação é isolada — reverter = deixar de chamá-la; (3) `comanda_payments` é append-only e pode ser "esquecida" sem quebra (nenhum consumidor atual depende dela).
- **Rollback de emergência:** `CREATE OR REPLACE` da versão anterior da settle (baseline pré-M4 a ser taggeada antes do apply, conforme política de baselines).
- **Migração destrutiva:** nenhuma prevista (sem DROP, sem ALTER destrutivo, sem backfill).
- **Gate:** aplicação em produção (A7) exige aprovação explícita do PO + baseline certificada (commit semântico + tag + docs).

---

## 30. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Comissão paga antes do atendimento (se D8 consumir antecipado sem gate) | Média | Financeiro | DP-M4-02/04; prorrogar `create_commission_record` até confirmação |
| Duplicidade de `comanda_payments` em replay | Baixa | Dados | Índice único `(tenant_id, idempotency_key)` |
| Quebra de idempotência da settle em retry | Baixa | Dados | Manter idempotência por `transactions.idempotency_key` + mesma chave em `comanda_payments` |
| Corrida entre pagamentos parciais | Média | Financeiro | `FOR UPDATE` + advisory lock existentes; agregação em transação |
| Relatórios/caixa com contagem errada de atendimentos | Alta (hoje) → Baixa (M4) | Operacional | Base operacional única (`attended_at`/`completed`) |
| Auto-desbloqueio client-side desalinhado com M4 | Média | UX/Dados | Revisar `Comandas.tsx:670-717` |
| Divergência Financial Core/D8 após ajuste | Baixa | Integridade | `npm run d8:verify` obrigatório (stop) |
| Escopo inflado (fazer backfill/órfãos na M4) | Média | Projeto | Manter M4 mínima; saneamento em workstream próprio |

---

## 31. Decisões Pendentes para o PO (DP-M4-01..10)

| # | Pergunta | Recomendação (OpenCode) | Status |
|---|---|---|---|
| **DP-M4-01** | Pagamento antecipado deve ser registrado mesmo com appointment no futuro (comanda `blocked`)? | **SIM** — registro financeiro explícito (ADR-017 R0), sem marcar atendimento | Aguarda PO |
| **DP-M4-02** | Pagamento antecipado gera comissão antes do atendimento? | **NÃO** — comissão somente após confirmação de atendimento (gate no D8/outbox, via evento) | Aguarda PO |
| **DP-M4-03** | Cenário de pagamento **parcial** (Cenário D, R$30+R$40) é aceito oficialmente como regra de negócio? | **SIM, se o Cenário D for aceito** — modelar via múltiplos `comanda_payments` (`parcial`+`final`); caso contrário bloquear parcial antecipado | Aguarda PO |
| **DP-M4-04** | Qual evento/processo define oficialmente "atendimento realizado"? (check-in na agenda? RPC de conclusão? flag no settle `p_attendance_confirmed`?) | RPC operacional dedicada (`confirm_appointment_attended`) que preenche `attended_at`, move status e publica `AppointmentCompleted` | Aguarda PO |
| **DP-M4-05** | Fonte de verdade do pagamento para relatórios: `transactions` (atual), `comanda_payments` (nova) ou ambas com regra de reconciliação? | Use `transactions` como financeiro (não quebrar caixa) **e** `comanda_payments` como modelo explícito auditável; reconciliar por `idempotency_key`/`source_id` | Aguarda PO |
| **DP-M4-06** | Cancelamento de agendamento com pagamento antecipado: estorno automático? crédito? regra de tolerância? | Estorno automático guiado com auditoria (nunca silencioso) | Aguarda PO |
| **DP-M4-07** | No-show com pagamento antecipado: estorno automático, crédito em conta ou perda? | Política explícita (recomenda-se estorno integral no 1º no-show; revisão humana) | Aguarda PO |
| **DP-M4-08** | Quem pode registrar pagamento antecipado? (ADR-019 DP11: recepção ⇒ integral com pagamento; quem para parcial? manager para parcial?) | Recepção: somente antecipado integral; parcial/estorno/autorizações especiais exigem `isManagerLikeRole` | Aguarda PO |
| **DP-M4-09** | Estorno de pagamento antecipado afeta `comanda_payments.reversed_at` (append-only) — confirmar padrão? | Confirmar `reversed_at` + `financial_reversals` como único caminho (sem DELETE) | Aguarda PO |
| **DP-M4-10** | Dados históricos: algum backfill de `attended_at` será autorizado? | NÃO por padrão (ADR-020); somente com prova real por comanda e revisão humana | Aguarda PO |

---

## Anexo A — Matriz de Estados (comanda × appointment × financeiro)

| Comanda | Appointment | Financeiro (pago) | Estado consistente hoje? | Efeito settle atual | Ação M4 |
|---|---|---|---|---|---|
| `open` | `confirmed` | não | ✅ | paga e marca `completed` (defeito 2 quando antecipado/adiado) | registrar pagamento; `completed` somente se atendimento confirmado |
| `open` | `in_progress` | não | ✅ | paga e marca `completed` | comportamento alvo do Cenário A |
| `open` | `completed` | não | ⚠️ (atendido sem pagamento) | paga (sem efeito no appointment) | Cenário B |
| `blocked` | `confirmed` (futuro) | não | ✅ | aceita (defeito 1) e marca `completed` (defeito 2) | pagamento registrado; comanda permanece bloqueada; sem `completed` (DP1/Cenário C) |
| `blocked` | `confirmed` (futuro) | parcial | ⚠️ | — | Cenário D |
| `paid` | `confirmed` | sim | ❌ (pagamento sem atendimento) | — | surgiu do defeito; corrigir fluxo e estorno |
| `paid` | `completed` | sim | ✅ | — | Cenário A/E pós-estorno |
| `cancelled` | `cancelled` | (n/a) | ✅ | — | F |
| `cancelled` | `no_show` | (n/a) | ⚠️ | — | G (política) |
| — | (sem appointment / walk-in) | — | ✅ | sem UPDATE de appointment | H |

---

## Anexo B — Checkpoints de validação desta revisão

- [x] `git status --short` ao final: **somente** `docs/audit/G1_1_REVISAO_M4_FINANCE_SETTLE.md` criado/alterado.
- [x] `git diff --check` limpo.
- [x] Nenhuma migration nova criada.
- [x] `finance_settle_comanda` **intacta** (não editada).
- [x] M1-M3 intactas (A1 fechada).
- [x] Nenhum arquivo funcional alterado; nenhum dado alterado; nenhum deploy.

---

*Fim do documento G1.1 — revisão isolada. Implementação da M4 somente após aprovação formal do PO (DP-M4-01..10).*