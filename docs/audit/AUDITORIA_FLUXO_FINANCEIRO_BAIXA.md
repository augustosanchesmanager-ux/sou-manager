# Auditoria Técnica do Fluxo Financeiro — Comanda, Contas a Receber e Baixa

> **Produto:** SMG Barber · **Plataforma:** SMG Platform (SMG Core)
> **Data da auditoria:** 2026-08-29
> **Modo:** Read-only. Nenhuma correção, migration, tabela, RPC ou política RLS foi alterada.
> **Branch atual:** `chore/saneamento-comandas-orfas-historicas` · HEAD `ae38faa`

---

## 1. Resumo executivo

Esta auditoria mapeia, com prova documental (arquivo:linha), o fluxo financeiro da SMG Barber:

```
Agenda → Agendamento → Comanda → Atendimento → Não pagamento → Contas a Receber → Pagamento → Baixa
```

O foco solicitado — **por que o botão "Adicionar serviço/produto" no modal "Dar baixa" não funciona** — tem causa raiz confirmada e **intencional**: o botão está codificado como `disabled` permanente, sem `onClick`, com tooltip e texto de apoio que orientam o usuário a ajustar a comanda no **Checkout/Comanda antes da baixa** (`pages/AccountsReceivable.tsx:1404-1415`). Não se trata de bug de handler, RPC ou permissão: é uma decisão de design que torna o modal de baixa **somente leitura** (conferência).

A auditoria adicionalmente provou:

1. **Não existe timestamp de atendimento.** Nenhuma tabela (`comandas`, `appointments`) possui coluna do tipo `attended_at`/`completed_at`/`unlocked_at`. O único momento registrável do "atendimento" é a transição de status do agendamento para `completed`, que acontece **na baixa financeira** (RPC de settlement/zero-close), não quando o serviço é executado.
2. **Não existe modelagem de pagamento parcial reaberto.** A baixa financeira marca a comanda como `paid` de uma única vez (`finance_settle_comanda`); eventual diferença entre valor pago e total é registrada apenas como `amount_difference` no `metadata` da transação — não gera saldo residual nem reabertura.
3. **Desbloqueio de comandas `blocked` é client-side e sem auditoria.** `pages/Comandas.tsx:670-717` executa `UPDATE comandas SET status='open'` diretamente quando `appointment.start_time <= hoje`, sem coluna de quem/quando desbloqueou.
4. **Schema drift relevante:** as colunas `discount`, `subtotal` e `chef_club_*` de `comandas` existem apenas no schema remoto (evidenciado pelo backup de produção e pelo worker D8), **mas nenhuma migration local as declara**. A migration `20260602030500_align_comandas_financial_columns.sql` alinhou 9 colunas, **mas não as três citadas acima**.
5. **RPC `bulk_close_comandas_admin` sem verificação de auth/tenant** dentro da função (`SECURITY DEFINER`, `GRANT EXECUTE TO authenticated`, `p_tenant_id` opcional) — flag de segurança.
6. **Qualidade de engenharia do settlement é alta**: advisory locks, `FOR UPDATE`, idempotência por chave, auditoria em `closure_note` e transação atômica baixa+outbox (`finance_settle_comanda_and_enqueue`) estão presentes e são consistentes com o contrato financeiro.

**Validations pré-existentes (não causadas por esta auditoria):** `npm run build` ✅ · `git diff --check` ✅ · `npx tsc --noEmit` ❌ (~30 erros pré-existentes) · `npm test` ⚠️ 1159 passed / 1 failed (outbox broker, pré-existente).

---

## 2. Objetivo, escopo e limitações

### Objetivo
- Auditar (mapear, **sem implementar**) o fluxo financeiro: Agenda → Agendamento → Comanda → Atendimento → Não pagamento → Contas a Receber → Pagamento → Baixa.
- Provar, com evidência, a **semântica de cada campo de data** do ciclo (o que cada timestamp realmente representa).
- Mapear pagamentos (parciais/múltiplos), descontos, comissão, permissões por operador, trilhas de auditoria e RLS.
- Diagnosticar **por que "Adicionar serviço/produto" no modal "Dar baixa" não funciona**.

### Escopo auditado
- Código-fonte TS/TSX: `pages/AccountsReceivable.tsx`, `pages/Comandas.tsx`, `pages/Checkout.tsx`, `pages/Receipts.tsx`, `pages/Commissions.tsx`, `application/checkout.ts`, `application/commission.ts`, `src/lib/finance/{settlement,zeroClose,reversal}.ts`, `domain/commission/*`.
- Migrations: `20260219183612` (schema inicial), `20260227223434` (RLS central), `20260420110000` (bulk close), `20260421000000` (status appointments), `20260423000002` (no-show), `20260424000000`, `20260501*`, `20260506214059` (create appointment+comanda), `20260510000000` (transactions), `20260514*` (settle RPC), `20260515210114` + `20260515210804` (reversal), `20260531161849` (zero-close RPC), `20260602030500` (align), `20260715000000` + `20260715010000` (RLS transactions/comandas), `20260717000000` (role_permissions), `20260723000000` (security fix RLS critical), `20260820120000` (commission_records), `20260827120000` (D8 worker RPC surface).
- Dump de produção: `docs/backups/backup_pre_migration_20260728_152717.sql`.
- Testes: `npm test`, build, typecheck.

### Limitações
- Auditoria read-only: não foram executados SQL de escrita nem chamadas RPC reais.
- Não é possível provar, por código, o comportamento *runtime* de RLS em todos os papeis sem um ambiente com dados; onde isso importa, a evidência está citada como "policy existente" e "lacuna a validar".
- O dump de produção data de 2026-07-28; o schema remoto pode ter divergido desde então.

---

## 3. Metodologia e fontes de evidência

1. **Leitura direta de código e migrations** (~30 arquivos) com citação `arquivo:linha`.
2. **Busca estrutural** (grep/glob) para colunas de data, idempotência, permissões e drift — nenhum resultado afirmado sem arquivo de origem.
3. **Validações de sanidade**: `npm run build`, `npx tsc --noEmit`, `npm test`, `git diff --check`.
4. **Cruzamento com o dump de produção** para detectar schema drift entre migrations locais e schema remoto.
5. Nenhuma ferramenta de escrita foi usada em código funcional. **Nenhum arquivo funcional foi alterado.**

Nota sobre bastidores: agentes `explore` disparados em paralelo falharam por indisponibilidade de billing e foram cancelados; todo o mapeamento foi concluído por investigação direta da ferramenta principal, com rastreabilidade completa.

---

## 4. Validações pré-existentes (build, typecheck, testes)

| Validação | Resultado | Detalhe |
|---|---|---|
| `npm run build` | ✅ OK (~26.9s) | Produção builda normalmente |
| `git diff --check` | ✅ OK (exit 0) | Sem whitespace errors na árvore rastreada |
| `npx tsc --noEmit` | ❌ ~30 erros | **Pré-existentes**: drift de tipos no outbox (`domain/events/outbox` — `DispatcherProvider`, `OutboxItem`, `DispatchTarget`), `pages/Comandas.tsx`, e `src/lib/supabase/schemas.ts:160` (`Cannot find name 'AppModuleSlug'`) |
| `npm test` | ⚠️ 1159 passed / 1 failed | **Pré-existente**: `domain/events/outbox/broker` — `enqueue` esperava 1 pending, obteve 0 |

**Conclusão:** nenhuma dessas falhas é causada por esta auditoria (nenhuma linha de código funcional foi tocada). Elas devem ser tratadas em fases próprias de manutenção.

---

## 5. Visão geral do fluxo financeiro (Agenda → Baixa)

```
[Agenda] create_appointment_with_comanda  → criação do appointment + comanda (+ itens)
   │                                        RPC 20260506214059
   ▼
[Agendamento] appointments.start_time (data futura) → comanda nasce 'blocked'
   │                   (data <= hoje)               → comanda nasce 'open'
   ▼
[Comanda] pages/Comandas.tsx — desbloqueio client-side quando start_time <= hoje (670-717)
   │        Checkout.tsx — recusa cliente com comanda 'blocked' (757-779)
   ▼
[Atendimento] NÃO EXISTE timestamp próprio (ver seção 21). Appointment vira 'completed'
   │           APENAS na baixa (settle / zero-close / bulk-close)
   ▼
[Não pagamento] comanda permanece 'open'; nenhuma transação financeira é criada.
   │             Comanda 'open' aparece em Contas a Receber.
   ▼
[Contas a Receber] pages/AccountsReceivable.tsx — fetchData (381-560) lista comandas status='open'
   │                 + recebíveis do Clube (pending/overdue) + transações income do mês.
   ▼
[Pagamento/Baixa] Modal "Dar baixa" (visualização read-only; botão "Adicionar serviço/produto"
   │               desabilitado por design, 1404-1411).
   │               Modos: payment | club_credit | house_courtesy | administrative_adjustment.
   │               payment → RPC finance_settle_comanda(_and_enqueue) — marca paid + transaction type=income.
   │               zero/club/courtesy/admin → RPC finance_zero_close_comanda — marca paid sem recebimento novo.
   ▼
[Fim] Comanda 'paid' · transaction 'income' (quando há recebimento) · appointment 'completed'
      · comissão calculada (D8 worker ou comissão de tela) · recebível Clube quando aplicável.
```

**Cadeia de valor oficial (AUD-004, `docs/audit/FINANCIAL_AUDIT_FRAMEWORK_20260817.md`):** a cadeia acima é a que o framework oficial reconhece para o domínio financeiro de comandas do SMG Barber.

---

## 6. Glossário e nomenclatura oficial

| Termo | Significado técnico no código |
|---|---|
| `appointment` | Agendamento (`appointments`) — tem `start_time`/`end_time`, status com ciclo próprio. |
| `comanda` | Comanda de consumo (`comandas`) — agrega itens (`comanda_items`) e participantes (`service_execution_participants`). |
| `blocked` | Status de comanda criada para agendamento futuro (bloqueada para baixa segura). |
| `open` | Comanda em aberto, elegível para baixa. |
| `paid` | Comanda baixada (com ou sem recebimento financeiro). |
| `cancelled` | Comanda cancelada (nunca cria baixa/transação financeira). |
| `transaction` | Lançamento financeiro (`transactions`) — `type='income'` para recebimento de comanda. |
| `financial_reversal` | Estorno de transação (`financial_reversals`) com `reversal_type` tipado. |
| Baixa / Settlement | Operação que move comanda para `paid` e (se houver recebimento) cria `transaction`. |
| Zero-close | Fechamento sem recebimento novo (Clube/Cortesia/Baixa administrativa). |

**Comissão vs Settlement (ADR-001):** comissão é o **provento teórico** derivado da execução; settlement é o **payout efetivo** de caixa. Nunca substituir um cálculo pelo outro.

---

## 7. Mapa de entidades e relacionamentos

| Entidade | Relação | Chave/colunas relevantes |
|---|---|---|
| `appointments` | 1—N (1 comanda típica) | `id`, `tenant_id`, `client_id`, `staff_id`, `barber_id`, `start_time`, `end_time`, `status`, `cancellation_type`, `hidden_from_schedule`, `appointment_at`, `source_system` (dump 5826-5867) |
| `comandas` | N—1 `appointments` via `appointment_id` | `id`, `tenant_id`, `client_id`, `staff_id`, `status`, `total`, `subtotal`, `discount`, `payment_method`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `closed_at`, `closure_mode`, `financial_effect`, `membership_credit_effect`, `closure_note`, `cancellation_type`, `cancelled_at`, `cancelled_by_user_id`, `hidden_from_financial`, `legacy_reference_month` (dump 6060-6091) |
| `comanda_items` | N—1 `comandas` | `comanda_id`, `service_id`/`product_id`, `product_name`, `quantity`, `unit_price`, `staff_id`, `tenant_id` |
| `service_execution_participants` | N—1 `comanda_items` | `comanda_item_id`, `staff_id`, `role` (primary/assistant/co_executor), `payout_type` (percentage/fixed), `payout_value`, `affects_revenue`, `affects_commission` (20260418100000) |
| `transactions` | N—1 `comandas` (via `source_type='comanda'`, `source_id`) | `tenant_id`, `user_id`, `type`, `category`, `amount`, `payment_method`, `date`, `status`, `idempotency_key`, `metadata` (20260510000000) |
| `financial_reversals` | 1—1 `transactions` (referenciada) | `transaction_id`, `reversal_type` CHECK, `created_by_user_id` → `auth.users` (20260515210114) |
| `staff` | N—1 usuário | `id` = `auth.users.id`, `commission_rate` INTEGER DEFAULT 40 (20260219183612) |
| `commission_records` | N—1 `comandas`/`staff` | `record_type` (commission/reversal), gross/discount/net/received/rate/commission_value, `participant_share`, append-only (20260820120000) |
| `cash_closings` | N—1 `tenant` | `business_date`, `status`, UNIQUE(tenant_id, business_date) (20260512000000) |
| `customer_subscriptions` / `customer_credits` | N—1 `clients` | Usadas no zero-close `club_credit` (20260311_chef_club_tables) |

---

## 8. Ciclo de vida da comanda (status e transições)

**Status possíveis (CHECK constraint em produção, dump 6098-6105):** `blocked | open | paid | cancelled` (evolução; a baixa zero preserva `paid`).

Transições observadas no código:

| De | Para | Quem/Como | Evidência |
|---|---|---|---|
| (criação) | `blocked` | RPC `create_appointment_with_comanda` quando `p_start_time::date > current_date` | 20260506214059 |
| (criação) | `open` | Mesma RPC quando `p_start_time::date <= current_date` | 20260506214059 |
| `blocked` | `open` | **Client-side**: `pages/Comandas.tsx:670-717` quando `appointment.start_time <= hoje` | Comandas.tsx 670-717 |
| `open`/`blocked` | `paid` | RPC `finance_settle_comanda` (`FOR UPDATE`, lock) | 20260514000001 |
| `open` | `paid` | RPC `finance_zero_close_comanda` (origens zero) | 20260531161849 |
| `open` | `paid` | RPC `bulk_close_comandas_admin` (lote) | 20260420110000 |
| `open` | `cancelled` | `pages/AccountsReceivable.tsx` `handleConfirmCancel` (868-941) | AccountsReceivable.tsx 868-941 |
| `open`/`blocked`/`paid` | `cancelled` | `pages/Comandas.tsx`/Checkout (cancelamento de agendamento ligado) | branch atual `ae38faa` |
| `paid` | (estorno) | RPC `finance_reverse_transaction` → cria `financial_reversals` | 20260515210804 |

**Ponto crítico:** a transição `blocked → open` é feita pela **UI**, não por RPC/triggers — não há trilha de auditoria de desbloqueio.

---

## 9. Agenda → Agendamento (criação de appointment)

- Criação integrada via **RPC `create_appointment_with_comanda`** (`20260506214059`), que cria `appointment` + `comanda` + itens em uma única operação transacional.
- A comanda nasce `'blocked'` quando o agendamento é para data futura; nasce `'open'` para o dia corrente/passado.
- **Não há desbloqueio automático do backend ao chegar a data** — o desbloqueio depende da UI (seção 8).
- `appointments.status` evoluíram: inicial `('confirmed','pending','completed','cancelled')`; `20260306_smart_schedule` adiciona estados; o CHECK final (`20260421000000`) é `('pending','confirmed','in_progress','completed','cancelled','no_show')` + coluna `cancellation_reason`.
- `detect_no_show_appointments` (`20260423000002`) marca `no_show` após grace de 15 minutos **sem tocar na comanda**.

---

## 10. Criação de comanda

- **Via RPC integrada** (item acima) ou **via Checkout** (`application/checkout.ts` `finish`): quando não há alvo existente, `comandaRepository.insertWithIdempotency(comandaData, idempotencyKey, tenantId)` (`checkout.ts:337-342`).
- `prepareComandaData` (`checkout.ts:238-276`) monta: `client_id`, `staff_id` (único profissional do carrinho, senão `null`), `appointment_id`, `status` (`'open'` quando haverá settlement RPC; `'paid'` caso contrário), `total`, **`discount: req.discountValue`** (coluna remota, ver seção 32), `payment_method`, `closure_mode`, `closure_note` (legacy club), `financial_effect`, `membership_credit_effect`, `legacy_reference_month`, `closed_at`, `tenant_id`.
- Itens: `syncItemsWithCompensation` (`checkout.ts:355-477`) — backup → delete → insert → checkpoint de contagem → rollback de restauração em falha.
- Participantes: `syncParticipants` (`checkout.ts:482-535`) — usa `execution_participants` do carrinho ou cria `primary/percentage/100` padrão quando `item.staff_id` existe.

---

## 11. Atendimento (timestamp de atendimento)

**Achado central: não existe campo de data/hora de atendimento.**

- Busca em todas as migrations por colunas `attended_at`, `attendance_at`, `completed_at`, `unlocked_at`, `served_at` em `comandas`/`appointments` → **nenhum resultado** (o único `completed_at` encontrado pertence a `outbox_items`).
- O agendamento é marcado `completed` **somente na baixa**:
  - `finance_settle_comanda` → `appointments.status='completed'` (20260514000001)
  - `finance_zero_close_comanda` → `appointments.status='completed'` quando `status IN ('pending','in_progress')` (20260531161849:361-367)
  - `bulk_close_comandas_admin` → idem (20260420110000:82-94)
  - Checkout `finish` com `relatedAppointmentId` → mesmo efeito via RPC composta.
- **Consequência para comissão:** a comissão conta `status IN ('open','paid','blocked','cancelled')` (`application/commission.ts:242`) — ou seja, comanda `blocked` (agendamento futuro, serviço ainda não prestado) **já gera comissão teórica**. É um risco de provisão excessiva a validar no negócio.

---

## 12. Não pagamento → Contas a Receber

- Uma comanda `open` **sem** transação `income` associada = "não paga". Não existe tabela de "duplicata" separada: a Contas a Receber deriva de comandas `open` + recebíveis do Clube + transações do mês.
- `fetchData` (`AccountsReceivable.tsx:381-560`):
  1. `comandas` com `eq('status','open')` — seleciona `id, client_id, status, total, discount, created_at, staff_id, payment_method, clients(name, phone)` (410-414).
  2. `rpc('generate_club_receivables', { p_tenant_id })` → `customer_subscription_receivables` `status in ('pending','overdue')` (415-421).
  3. `transactions` `type='income'`, `date` no mês filtrado, `order date desc` (422-429).
  4. Itens da comanda + participantes + staff → monta `OpenComandaDetail` com `grossSubtotal`, `discount`, `netTotal` (458-555).
- Diferença de comportamento: **somente comandas `open`** aparecem como "a receber"; `blocked` **não** aparece (fica fora até virar `open`).

---

## 13. Modal "Dar baixa" — anatomia

Estado definido em `AccountsReceivable.tsx` (337-379):
- `settlementMode`: `'payment' | 'club_credit' | 'house_courtesy' | 'administrative_adjustment'`.
- Campos: `settlementPaidAmount`, `settlementPaymentMethod`, `settlementPaymentDate`, `settlementNotes`, `settlementZeroReason`, `settlementIdempotencyKey`, `settlementClubCredits`.
- Cards de resumo (1375-1395): **Subtotal bruto / Desconto / Valor líquido / Diferença do pago** — a "Diferença do pago" é calculada e exibida em destaque quando `|diferença| > 0.009`.
- Seção "Itens da comanda" (1398-1434): lista read-only para conferência; itens com `typeLabel`, "Compartilhado" (participantes), responsável, valor; texto explícito: *"Para alterar itens, descontos ou profissionais, ajuste a comanda no Checkout antes da baixa financeira."* (1413-1414).

**Validações de confirmação** (`handleConfirmSettlement`, 767-849):
- `payment`: exige `paymentMethod`, `paymentDate`, `paidAmount > 0` (775-778).
- `club_credit`: exige crédito disponível/suficiente (`settlementClubCanCover`, 779-782).
- `administrative_adjustment`: exige `canUseAdministrativeZeroClose` (783-786).
- `house_courtesy`/`administrative_adjustment`: exige `settlementZeroReason` (787-790).
- Lock `settlementLockRef` anti-duplo-clique (792) e idempotência via `settlementIdempotencyKey || createSettlementKey(id)` (814).

---

## 14. Causa raiz: botão "Adicionar serviço/produto"

**Evidência primária (`pages/AccountsReceivable.tsx:1404-1411`):**

```tsx
<button
    type="button"
    disabled                                          // ← hardcoded, SEMPRE desabilitado
    title="Para alterar itens da comanda, use o Checkout/Comanda antes da baixa."
    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-400 opacity-70 dark:border-border-dark"
>
    Adicionar serviço/produto
</button>
```

Acompanhado de texto de apoio (1413-1414): *"Para alterar itens, descontos ou profissionais, ajuste a comanda no Checkout antes da baixa financeira."*

**Diagnóstico definitivo:**
1. `disabled` é **hardcoded** — não depende de estado, permissão, cargo ou condição de dados.
2. **Não existe `onClick`** — o botão não tem handler. Mesmo removendo `disabled`, não haveria ação.
3. O par tooltip+texto de apoio confirma que é **decisão de design**: o modal de baixa é uma **superfície de conferência**; a edição de itens/descontos/profissionais é responsabilidade do **Checkout/Comanda** (`pages/Checkout.tsx`, `pages/Comandas.tsx`).
4. Não há correlação com RLS, RPCs ou permissões: o bloqueio é puramente de camada de apresentação.

**Conclusão:** o botão "não funciona" por design. Para "funcionar" seria necessário (a) remover `disabled`, (b) adicionar `onClick` que navega/abre o fluxo de edição da comanda — ou remover o botão da UI, substituindo por um link explícito para o Checkout. Nenhuma mudança foi aplicada nesta auditoria.

---

## 15. Fluxo de baixa por pagamento (settlement)

**RPC `finance_settle_comanda`** (`20260514000001`) — e sua variante composta **`finance_settle_comanda_and_enqueue`** (usada pelo checkout, `src/lib/finance/settlement.ts:72-138`, para settlement + outbox atômico):

| Aspecto | Prova |
|---|---|
| `SECURITY DEFINER` | migration 20260514000001 |
| `auth.uid()` obrigatório | migration |
| Papeis permitidos | `superadmin` OU `access_role`/membership em `owner, admin, manager, gerente, superadmin, 'super admin'` — **barber/receptionist/cashier NÃO permitidos** |
| Tenant | via `current_tenant_id_from_auth_uid()` (+ superadmin bypass) |
| Concorrência | `pg_advisory_xact_lock(hashtext('finance_settle_comanda:'\|tenant\|':'\|comanda))` |
| Leitura | comanda `FOR UPDATE` |
| Status aceitos | `'open'` ou `'blocked'` |
| Pagamentos | **1 comanda → 1 transação**; valida apenas `paid_amount > 0`; diferença vs total vai só para `metadata.amount_difference` |
| Efeitos na comanda | `status='paid'`, `payment_method`, `closure_mode='standard'`, `financial_effect=true`, `payment_date_real`, `settled_at=now()`, `settled_by_user_id=auth.uid()`, `closed_at=p_payment_date_real` |
| Appointment | `status='completed'` |
| Transaction | `type='income'`, `category='Receita de Comanda'`, `date=v_payment_date_real` |

**Tempo limite:** `settlement.ts` aplica `SETTLEMENT_TIMEOUT_MS = 30000` via `Promise.race` (49-60) — a baixa não roda infinitamente na UI.

**Idempotência:** `idempotency_key` na transação (UNIQUE parcial em `(tenant_id, idempotency_key)` — 20260510000000:37-39; settlement gera `finance-settle-<comandaId>-<random>` — settlement.ts:44-47).

---

## 16. Fluxo de fechamento zero (finance_zero_close_comanda)

**RPC `finance_zero_close_comanda`** (`20260531161849`) — usada no checkout (`closeZeroAmount`, `checkout.ts:635-655`) e em Contas a Receber (`closeZeroAmountComanda`, origem zero).

| Origem (`origin`) | payment_method gravado | closure_mode | Exige motivo | Exige permissão de gestão |
|---|---|---|---|---|
| `club_credit` | `'Clube do Chefe'` | `'standard'` | não | não (apenas tenant access) |
| `house_courtesy` | `'Cortesia'` | `'legacy_membership'` | **sim** | **sim** |
| `administrative_adjustment` | `'Baixa administrativa'` | `'legacy_membership'` | **sim** | **sim** |

- `source` aceito: `checkout` | `financial_admin`.
- Tenant access: superadmin OU `tenant_id` autenticado OU membership (113-116).
- Permissão de gestão (para cortesia/administrativa): superadmin OU access_role/membership em `owner/admin/manager/gerente/superadmin/super admin` (118-121, 127-129).
- Advisory lock `finance_zero_close_comanda:tenant:comanda` (131); `FOR UPDATE` (133-138).
- Idempotência: comanda já `paid` retorna sucesso `idempotent=true` se `closure_note.idempotency_key` confere (152-165); caso contrário `RAISE 'Comanda já está fechada'`.
- `reference_at` = `appointment.start_time` → `comanda.created_at` → `now()` (174-183).
- **`club_credit`:** valida assinatura ativa com ciclos pagos (190-214), itens **somente serviço** (216-223), crédito agregado e por serviço (`service_balance_map`, 225-294), atualiza `customer_credits` (296-304).
- **Auditoria** em `closure_note` JSONB (322-337): `zero_close_origin`, `zero_close_reason`, `authorized_by`, `requested_authorized_by`, `reason`, `user_id`, `created_at`, `source`, `idempotency_key`, `reference_at`, `operational_total`, `credits_consumed`, `financial_effect=false`, `membership_credit_effect`.
- **Efeitos na comanda** (339-353): `status='paid'`, `financial_effect=false`, `membership_credit_effect=(origin='club_credit')`, `closure_mode`, `payment_method`, `payment_date_real=NULL`, `settled_at=now()`, `settled_by_user_id`, `closed_at=now()`.
- Appointment → `completed` quando `pending|in_progress` (361-367).

---

## 17. Baixa administrativa em lote (bulk_close_comandas_admin)

- RPC `bulk_close_comandas_admin(p_comanda_ids, p_tenant_id, p_closure_note, p_legacy_reference_month)` (`20260420110000:44-103`).
- Efeito: `status='paid'`, `closure_mode='legacy_membership'`, `financial_effect=false`, `membership_credit_effect=false`, `closure_note`, `legacy_reference_month`, `closed_at=now()`; appointments → `completed` (83-94).
- **⚠ Achado de segurança:** função `SECURITY DEFINER` com `GRANT EXECUTE TO authenticated` (105) **sem verificação de `auth.uid()`/tenant dentro do corpo** — `p_tenant_id` é opcional e usado apenas como filtro. Qualquer usuário `authenticated` poderia marcar comandas de qualquer tenant como `paid` se conhecer/os IDs. Recomenda-se replicar o padrão de autorização das RPCs `finance_*` (advisory + role check). *(Não implementado.)*

---

## 18. Estorno financeiro (finance_reverse_transaction)

- RPC `finance_reverse_transaction` (`20260515210804`) + tabela `financial_reversals` (`20260515210114`).
- `financial_reversals`: `id`, `transaction_id`, `tenant_id`, `reversal_type` CHECK (`wrong_settlement | full_refund | partial_refund | duplicate_charge | administrative_cancellation | financial_review`), valores, `reason`, `created_by_user_id` → `auth.users`, idempotência.
- A referência para estorno vem de `paidComandaSettlements` (transações do mês com `reversibleAmount > 0` e status `paid`/`Pago` — `AccountsReceivable.tsx:943-949`).
- **Permissão para estornar:** `canRequestFinancialReversal = canAccessSuperAdmin || ['owner','admin','manager','superadmin'].includes(accessRole)` (377-378) — barber/receptionist/cashier não podem.
- `src/lib/finance/reversal.ts` orquestra a chamada; o recibo original/transação é preservado (ver seção 27).

---

## 19. Cancelamento de comanda (com transição de status)

`handleConfirmCancel` (`AccountsReceivable.tsx:868-941`):
- Só comandas `source='comanda'` e `status='open'` (852-853, 874-876).
- Exige `cancelReasonType` (878-881) e nota quando o motivo exige (`requiresNote`, 885-888).
- `hidden_from_financial = ['duplicate','test','operational_error'].includes(cancelReasonType)` (896).
- `UPDATE comandas SET status='cancelled', cancellation_type, closure_note, cancelled_at=now, cancelled_by_user_id=user, hidden_from_financial` com guarda `.eq('status','open')` (901-914); se 0 rows → aviso de concorrência (917-924).
- Mensagem explícita: *"Comanda cancelada com auditoria. Nenhuma baixa financeira foi criada."* (926).

**Cancelamento via agendamento (branch atual, `ae38faa`):** cancelar um appointment que possua comanda `open`/`blocked` ligada também cancela a comanda — comportamento recente de saneamento endereçando comandas órfãs.

---

## 20. Desbloqueio de comandas (client-side, sem auditoria)

`pages/Comandas.tsx:670-717`:
1. Filtra `comandas` com `status==='blocked' && appointment_id` (673).
2. Compara `appointment.start_time` (normalizada para dia) com hoje (676-689).
3. `getScopedClient('barber').from('comandas').update({ status: 'open' }).in('id', commandsToUnblock)` (696-699).
4. Atualiza estado local (706-710).

**Achados:**
- Desbloqueio **não passa por RPC** → sem trigger/auditoria; sem coluna `unlocked_at` ou `unlocked_by_user_id`.
- É disparado por efeito de montagem da página (qualquer pessoa com acesso à página desbloqueia).
- RLS filtra por tenant na escrita (policy `tenant_isolation_comandas`), então o isolamento de tenant é preservado — mas a trilha de auditoria **não existe**.

---

## 21. Banco de datas — semântica de cada campo

| Campo | Evento que representa | Condições/prova |
|---|---|---|
| `comandas.created_at` | **Abertura da comanda** (registro) | default `now()` no DDL remoto (dump 6069) |
| `appointments.start_time` | **Horário agendado** (previsto) | criado na RPC de agendamento; usado para nascer `blocked`/`open` e para desbloqueio |
| `appointments.end_time` | Fim previsto do agendamento | dump 5835 |
| `appointments.created_at` | Registro do agendamento | dump |
| — | **ATENDIMENTO de fato** | **NÃO EXISTE coluna** (seção 11) |
| `appointments.status='completed'` | Conclusão administrativa | alterado **na baixa** (settle/zero-close/bulk), não no atendimento |
| `comandas.payment_date_real` | **Data real do pagamento** (usuario) | setado na baixa com valor do form (`AccountsReceivable`/Checkout) |
| `comandas.settled_at` | **Momento sistema da baixa** | `now()` nas RPCs de settlement |
| `comandas.settled_by_user_id` | Operador que baixou | `auth.uid()` nas RPCs |
| `comandas.closed_at` | Fechamento da comanda | = `payment_date_real` no settle; = `now()` no zero-close/bulk |
| `transactions.date` | Data do lançamento financeiro | = `v_payment_date_real` no settle; default `now()` na tabela |
| `comandas.cancelled_at` / `cancelled_by_user_id` | Cancelamento | setado em `handleConfirmCancel` e no cancelamento via agendamento |
| `cash_closings.business_date` | Data de fechamento de caixa | UNIQUE por tenant |

**Regra de ouro da auditoria:** *nenhum* `created_at`/`updated_at` de comanda ou appointment deve ser usado como proxy de data de pagamento ou de atendimento. A única data confiável de recebimento é `transactions.date` + `payment_date_real`; atendimento não é representável no modelo atual.

---

## 22. Pagamentos parciais e múltiplos

- **Modelo atual: 1 comanda → 1 pagamento.** `finance_settle_comanda` aceita `p_paid_amount` e valida apenas `> 0`; não há `amount_paid`/`paid_amount` como coluna em `comandas` (confirmado também no worker D8, `20260827120000`, que recai sobre `comanda.total`).
- **Diferença pago vs total:** registrada somente em `transactions.metadata.amount_difference`. UI exibe "Diferença do pago" (1390-1394) e permite informar valor diferente do total, com a ressalva registrada na auditoria (`closure_note`).
- **Pagamento múltiplo:** não há modelo de split de pagamento por comanda em migrations. Fracionamento em múltiplas parcelas **não é suportado** no domínio comanda; a única exceção é o zero-close (não gera transação).
- **Estorno parcial:** `financial_reversals.reversal_type='partial_refund'` existe no modelo (20260515210114) — mas a transação original permanece; a reversão gera registros de estorno, não um "segundo pagamento".

---

## 23. Descontos — fluxo, auditoria e drift

**Fluxo no Checkout (`pages/Checkout.tsx`):**
- `discountType` (`DiscountAuditType`, default `'barber_discount'`), `discountReasonType` (`DiscountReasonType`, default `'fidelizacao'`), `discountReasonNote` (357-359).
- `discountValue = parseFloat(discount) || 0`; `total = max(0, subtotal - discountValue)` (403-404).
- `shouldCollectDiscountAudit = discountValue > 0` (425) → exige draft de auditoria.
- `discountAuditDraft` (1206-1213): `{ amount, type, reasonType, reasonNote, responsibleStaffId/Name }` — colocado no `FinishRequest`.

**Validação (release gate)** (`checkout.ts:217-225`): desconto do tipo `barber_discount` exige profissional responsável (`responsibleStaffId`) e observação (`reasonNote`).

**Persistência:** `prepareComandaData` grava `discount: req.discountValue` (**coluna que não existe nas migrations locais** — ver seção 32). Comissão usa `item.discount ?? comanda.discount` (`application/commission.ts:353`).

**Contas a Receber:** `fetchData` seleciona `discount` (412) e o aplica em `OpenComandaDetail.discount` (550); resumo da baixa usa `settlementDiscount`. Cálculo: `grossSubtotal` (soma dos itens) → `discount` → `netTotal = comanda.total` (539-552).

**Sistema de permissão novo:** `role_permissions` (`20260717000000`) e normalização de roles (`20260806000000`) incluem `services.apply_discounts` com default **true** para `Receptionist`/`receptionist` — o desconto na recepção é permitido por política.

---

## 24. Comissão — contrato de cálculo (FIX-001)

`domain/commission/calculate.ts` (regra canônica, também exportada para o worker D8 via `scripts/d8/export-core.mjs`):

```
commissionBase  = receivedValue × participantShare
commission      = commissionBase × commissionRate
```

- `receivedValue` = valor efetivamente recebido (não o bruto) — FIX-001.
- `participantShare` por participante do item (`service_execution_participants`).
- `commissionRate` default de `staff.commission_rate` (INTEGER, DEFAULT 40 — 20260219183612).
- `resolveCommissionBase` (base bruta) existe mas é **deprecated** — não deve ser usada.
- `commission_records` (20260820120000): `record_type` (`commission`/`reversal`), `gross_value`, `discount`, `net_value`, `received_value`, `commission_rate numeric(5,4)`, `commission_value`, `participant_share`; **append-only** (sem UPDATE/DELETE por RLS), idempotência via `(tenant_id, idempotency_key)`.

**Equivalência D8:** `tests/d8/equivalence.test.ts` prova `worker/calculate.ts` == `domain/commission/calculate.ts` (gate obrigatório `npm run d8:verify`).

---

## 25. Comissão — pipeline de aplicação

`application/commission.ts` — 4 fases:
1. **Staff** (profissionais do tenant);
2. **Comandas** com `status IN ('open','paid','blocked','cancelled')` (242) — nota: `blocked` entra na base de comissão;
3. **Itens** por comanda (com `discount` por item ou da comanda, 353);
4. **Participantes** por item → calcula participação e comissão por participante.

- Página `pages/Commissions.tsx` consome o resultado; `discountAmount` aparece em 674.
- O efeito financeiro do pagamento sobre a comissão é derivado do **settlement** (ADR-001), não de um recálculo independente.
- **Custo operacional a validar:** comanda `blocked` (agendamento futuro) conta comissão antes do atendimento — possível provisão prematura (ver seção 11).

---

## 26. Participantes de execução

`service_execution_participants` (`20260418100000`):
- `role` CHECK: `primary | assistant | co_executor`;
- `payout_type` CHECK: `percentage | fixed`;
- `payout_value` (percentual ou valor fixo);
- `affects_revenue`, `affects_commission`;
- `tenant_id` (isolamento).

Criação: pelo checkout (`syncParticipants`, `checkout.ts:482-535`) e pelas RPCs de agendamento integrado. Consulta: Contas a Receber (`fetchData` 470-476), Comissões, CashClosing.

---

## 27. Recibos (ausência de tabela receipts)

- **Não existe tabela `receipts`** em nenhuma migration.
- `pages/Receipts.tsx` (165-192) deriva recibos de:
  1. `transactions` (`type='income'`) com `source_type='comanda'` etc.;
  2. `financial_reversals` (estornos) — que preservam a referência à transação original.
- Recibo "novo" na tela também grava **em `transactions`** (linha 427) — não há entidade separada.
- **Implicação:** o recibo é um *aspecto de apresentação* da transação + eventual estorno; a numeração/cancelamento de recibo depende do modelo de transação.

---

## 28. Permissões e operadores

Legado (acessos lidos de `profiles.role`/`staff.role`/`user_tenants.role`) + novo sistema `role_permissions`:

| Operação | Papeis permitidos | Evidência |
|---|---|---|
| Baixa via pagamento (`finance_settle_comanda`) | superadmin, owner, admin, manager, gerente, 'super admin' (via access_role OU membership) | 20260514000001 |
| Baixa zero cortesia/administrativa | superadmin OU os mesmos papeis de gestão | 20260531161849:118-129 |
| Boa-parte zero `club_credit` | qualquer autenticado com tenant access | idem |
| Estorno (`finance_reverse_transaction`) | `canRequestFinancialReversal` = superadmin ou owner/admin/manager/superadmin | AccountsReceivable.tsx:377-378 |
| Cancelamento de comanda aberta | pela UI (todos com acesso à página) com motivo | AccountsReceivable.tsx:868-941 |
| Baixa administrativa (modal) | `canUseAdministrativeZeroClose` = `isManagerLikeRole(accessRole, canAccessSuperAdmin)` | AccountsReceivable.tsx:379 |
| Desconto na recepção (`services.apply_discounts`) | `Receptionist` default true; normalizado em múltiplas migrations | 20260717000000:264, 20260806000000:301 |

O sistema `role_permissions` (20260717000000) introduz tabelas `role_permissions` + `role_permissions_audit` e uma RPC de bootstrap por tenant; papeis `Barber`/`Receptionist` são os consumidos hoje.

---

## 29. RLS — isolamento por tenant

Evolução documentada:

1. **`20260227223434`** — substituiu subqueries recursivas em policies por helper `get_current_tenant_id()` (SECURITY DEFINER, lê `profiles`) nas 13+ tabelas (profiles, appointments, comandas, comanda_items, clients, services, products, promotions, etc.).
2. **`20260715000000`** — habilitou RLS em `transactions` (criada sem RLS!) e padronizou `comandas`/`comanda_items` para `current_tenant_id_from_auth_uid()` (lê profiles **e staff**), garantindo acesso a funcionários criados por Edge Function; adicionou `profiles.status`.
3. **`20260715010000`** — removeu policies duplicadas em `transactions` e criou `tenant_isolation_transactions_v2` (`FOR ALL ... USING/WITH CHECK superadmin OR tenant`) (324-335).
4. **`20260723000000`** (Fase 3.3) — adicionou superadmin bypass em `cash_closings`, `barber_closings`, `cash_closing_events`; migrou `tenants` e `role_permissions` para os helpers novos; `role_permissions` manage exige `profiles.role IN ('admin','manager')`.

**Padrão final (transações financeiras):**

```sql
current_is_super_admin_from_auth_uid()
OR tenant_id = current_tenant_id_from_auth_uid()
```

Aplicado a: `transactions` (v2), `comandas`, `comanda_items`, `cash_closings`, `barber_closings`, `cash_closing_events`, `processed_operations`, `commission_records`, `event_store` (append-only) — com WHITELIST de políticas auditadas na Fase 3.3.

**Lacuna a validar:** `appointments` ainda tinha policy criada com `get_current_tenant_id()` (profiles-only) em `20260227223434:42-48`; se usuários **staff-only** precisarem ler appointments e passar por esta policy sem membership em `profiles`, podem ser bloqueados. Não foi encontrada migration local que regrave a policy de `appointments` para o helper novo — **recomenda-se validação em ambiente real.**

---

## 30. RPCs — segurança e permissões

**Contratadas (seguras):**
- `finance_settle_comanda` / `finance_settle_comanda_and_enqueue`: auth.uid obrigatório, role check, advisory lock, `FOR UPDATE`, idempotência, grant unicamente a `authenticated`.
- `finance_zero_close_comanda`: auth.uid obrigatório, tenant access + management check, advisory lock, `FOR UPDATE`, idempotência por `closure_note`, grant a `authenticated`.
- `finance_reverse_transaction`: auth.uid, validação de pertencimento da transação ao tenant, registra `financial_reversals`.
- `get_auth_access_context`, `get_tenant_*`, helpers de tenant: SECURITY DEFINER com regras restritas.
- D8 (`20260827120000`): RPCs de claim/context/insert/mark/retry/recover/heartbeat operam sob papel `worker_dispatcher` (NOLOGIN), sem `service_role` no caminho de dados.

**⚠ Não contratadas adequadamente (achados):**
- `bulk_close_comandas_admin` — sem auth/tenant check no corpo (seção 17).
- `approve_access_request()` e `close_order()` — apontadas na auditoria de Fase 3.3 como RPCs legadas **sem verificação de `auth.uid()`** (`docs/security/SECURITY_AUDIT_RPC.md`). Recomenda-se `FOR UPDATE` + `auth.uid()` nas leituras críticas, conforme checklist de produção (Fase 3.3).

---

## 31. Auditoria e eventos (trilhas)

**Trilha por camada:**
1. **Colunas de auditoria em comandas:** `settled_by_user_id`, `settled_at`, `cancelled_at`, `cancelled_by_user_id`, `cancellation_type`, `hidden_from_financial`, `closure_note` (JSONB auditado em zero-close).
2. **`transactions.metadata`:** `amount_difference`, `comanda_total`, operador, origem — montado nas RPCs de settlement.
3. **`financial_reversals`:** motivo tipado + `created_by_user_id` (estornos).
4. **`audit_logs`:** policy de leitura por tenant (20260227223434:51-53); escrita via app para operações administrativas.
5. **Event Store + Outbox (Fase 4):**
   - `CheckoutCompleted` publicado pelo checkout (`checkout.ts:734-756`) com payload financeiro e `correlationId = idempotencyKey`.
   - `finance_settle_comanda_and_enqueue` insere `outbox_items` **na mesma transação** do settlement (atômico).
   - D8 worker (produção certificada, ADR-015/016) consome outbox → calcula comissão → `exists_commission_record()` idempotente → `mark_outbox_item_processed`.
   - `processed_operations` (20260723110000): UNIQUE `(tenant_id, idempotency_key)`, append-only.
6. **Replay Engine (Fase 4.7)** disponível para reconstrução/auditoria de eventos.

**Gap de auditoria:** desbloqueio client-side de comandas `blocked` (seção 20) não gera nenhum registro.

---

## 32. Schema drift (migrations vs. remoto)

| Coluna | Existe em migration local? | Evidência de existência remota |
|---|---|---|
| `comandas.discount` | ❌ **Não** (grep por `ADD COLUMN ... discount` em comandas: zero) | dump 6071 `discount numeric(10,2) DEFAULT 0`; usado em código (`checkout.ts:264`, `AccountsReceivable.tsx:412/550`, `commission.ts:353`); D8 valida como coluna real (posição 27, `20260827120000`) |
| `comandas.subtotal` | ❌ Não | dump 6068 `subtotal numeric` |
| `comandas.chef_club_original_total` / `chef_club_savings_total` / `chef_club_summary` | ❌ Não | dump 6075-6077 |
| `comandas.payment_method`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `closed_at`, `closure_mode`, `financial_effect`, `membership_credit_effect`, `closure_note` | ✅ Sim, **a posteriori** | `20260602030500` (align, com COMMENTs) — migration declara explicitamente que as colunas já existiam no remoto |
| `comandas.cancellation_type`, `hidden_from_financial`, `cancelled_at`, `cancelled_by_user_id` | ✅ Sim | `20260501_add_cancellation_fields_to_comandas.sql` |
| `comandas.legacy_reference_month`, `closure_mode` (constraint) | ✅ Sim | `20260420110000:3-30` |

**Leitura oficial sobre o drift:** a própria migration de alinhamento afirma *"They exist in remote Supabase, but were missing from local migrations"* (`20260602030500:3-6`). No caso de `discount`/`subtotal`/`chef_club_*`, **nenhuma migration local as cria** — risco para rebuilds locais, replicação multi-schema e para a regra "toda mudança passa por migration" da política do projeto.

---

## 33. Achados e riscos consolidados

| # | Severidade | Achado | Evidência | Ação sugerida (NÃO executada) |
|---|---|---|---|---|
| F1 | Baixa (design) | Botão "Adicionar serviço/produto" no modal de baixa está hardcoded `disabled` sem `onClick` | `AccountsReceivable.tsx:1404-1411` | Decidir: remover botão ou ligar a navegação para o Checkout |
| F2 | **Alta** | Não há timestamp de atendimento (comanda/appointment) — "quando o serviço foi prestado" não é representável | grep migrations (seção 11) | ADR + coluna de atendimento com auditoria |
| F3 | **Alta** | Desbloqueio `blocked→open` é client-side, sem auditoria (quem/quando) | `Comandas.tsx:670-717` | RPC de desbloqueio com `unlocked_at/unlocked_by_user_id` + trigger |
| F4 | **Média** | `bulk_close_comandas_admin` sem auth/tenant check (SECURITY DEFINER, grant authenticated) | `20260420110000:44-105` | Replicar padrão de autorização das RPCs `finance_*` |
| F5 | **Média** | Schema drift: `comandas.discount/subtotal/chef_club_*` não existem nas migrations locais | seção 32 | Migration de alinhamento para essas colunas |
| F6 | Média | Comissão conta comanda `blocked` (agendamento futuro) na base — provisão prematura | `application/commission.ts:242` | Revisar critério de elegibilidade (decisão de negócio) |
| F7 | Média | Pagamento parcial não gera saldo residual nem reabertura — diferença só em metadata | `20260514000001` | Confirmar regra de negócio; se parcial é permitido, modelar saldo |
| F8 | Média | RPCs legadas `approve_access_request()`/`close_order()` sem `auth.uid()` | `docs/security/SECURITY_AUDIT_RPC.md` | Corrigir conforme checklist Fase 3.3 |
| F9 | Média | Policy de `appointments` pode ainda usar helper profiles-only (`get_current_tenant_id`) para usuários staff-only | `20260227223434:42-48`; sem regravação local encontrada | Validar em ambiente real; migrar para helper novo se confirmado |
| F10 | Baixa | `tsc` ~30 erros e 1 teste outbox falhando (pré-existentes) | seção 4 | Backlog de manutenção |
| F11 | Baixa | `appointments` pode ser `no_show` sem afetar comanda | `20260423000002` | Regra de negócio para comanda em caso de no-show |

---

## 34. Recomendações (não implementadas)

Prioridade sugerida (sujeita a decisão do PO):

1. **P0 — Segurança:** corrigir autorização de `bulk_close_comandas_admin` e das RPCs legadas (`F4/F8`).
2. **P0 — Auditoria:** RPC de desbloqueio com trilha (`F3`) — envolve ADR por alterar contrato de desbloqueio.
3. **P1 — Modelo:** decidir política de **atendimento** (coluna + quem grava) e de **pagamento parcial** (`F2/F7`).
4. **P1 — Integridade:** migration de alinhamento para `discount`/`subtotal`/`chef_club_*` (`F5`) e validação da policy de `appointments` (`F9`).
5. **P2 — Negócio:** reavaliar inclusão de comanda `blocked` na base de comissão (`F6`).
6. **P2 — UX:** decisão explícita sobre o botão do modal de baixa (`F1`).
7. **P3 — Qualidade:** limpar erro no broker do outbox e os ~30 erros do `tsc` (`F10`).

Nenhuma destas recomendações foi implementada (modo auditoria).

---

## 35. Arquivos alterados

**NENHUM arquivo funcional foi alterado.**

- Código-fonte, migrations, RPCs, políticas RLS, testes e página web: **intocados**.
- Este relatório é o único artefato novo produzido.
- Documentos relacionados já existentes (não modificados por esta auditoria): `docs/audit/H7_1_AUDITORIA_TECNICA.md`, `docs/audit/FINANCIAL_AUDIT_FRAMEWORK_20260817.md`, `docs/audit/H7_2_PLANO_SANEAMENTO_ORFAOS.md`, scripts de saneamento `audit_*.sql` / `saneamento_fase_*.sql` (existentes no working tree, não tocados).

### Arquivos de evidência consultados (leitura)

- `pages/AccountsReceivable.tsx`, `pages/Comandas.tsx`, `pages/Checkout.tsx`, `pages/Receipts.tsx`, `pages/Commissions.tsx`
- `application/checkout.ts`, `application/commission.ts`
- `src/lib/finance/settlement.ts`, `src/lib/finance/zeroClose.ts`, `src/lib/finance/reversal.ts`
- `domain/commission/calculate.ts`, `domain/commission/participants.ts`, `domain/commission/types.ts`
- `supabase/migrations/20260219183612_*.sql` … `20260827120000_*.sql` (lista completa nas seções 2 e 7)
- `docs/backups/backup_pre_migration_20260728_152717.sql`
- `docs/security/SECURITY_AUDIT_RLS.md`, `docs/security/SECURITY_AUDIT_RPC.md`