# ADR-059: Split Payment no PDV, Rastreabilidade de Parciais (`comanda_payments ↔ transactions`), Transição Automática para Pagamento Pendente e Central de Regras de Negócio

**Status:** Accepted (Aprovado pelo PO em 2026-11-27)
**Date:** 2026-11-27
**Deciders:** Augusto (PO) + Antigravity
**Product Scope:** SMG Barber (produto comercial ativo)
**References:**
- [ADR-001](./ADR-001-Commission-vs-Settlement.md) — Commission vs Settlement
- [ADR-003](./ADR-003-multi-tenant-isolation.md) — Multi-Tenant Isolation
- [ADR-008](./ADR-008-audit-strategy.md) — Audit Strategy
- [ADR-012](./ADR-012-rpc-execute-grants.md) — RPC EXECUTE Grants
- [ADR-014](./ADR-014-transactional-outbox.md) — Transactional Outbox (D7)
- [ADR-017](./ADR-017-financial-vs-operational-cycle.md) — Ciclo Operacional × Ciclo Financeiro
- [ADR-018](./ADR-018-payment-contract.md) — Contrato de Pagamento (`comanda_payments`)
- [ADR-019](./ADR-019-role-authorization.md) — Autorização por Papel
- [ADR-030](./ADR-030-payout-cycles-and-advances.md) — Ciclos de Repasse e Espelhamento Contábil
- [ADR-036](./ADR-036-payment-terminals-and-fee-snapshots.md) — Maquininhas e Snapshot de Taxas
- [ADR-045](./ADR-045-financial-ecosystem-consolidation.md) — Fiados, Ponto Único de Estorno e Fluxo de Caixa
- [ADR-047](./ADR-047-unified-commission-product-and-vales-rules.md) — Unificação das Regras de Comissão
- [ADR-048](./ADR-048-cd-supabase-migrations-gate.md) — Gate Controlado de Migrations em Produção

---

## Context

A auditoria forense do PDV (`pages/Checkout.tsx`), das RPCs financeiras (`register_comanda_payment`, `finance_settle_comanda`) e do módulo de Contas a Receber (`pages/AccountsReceivable.tsx`) identificou gargalos críticos no ciclo de pagamento e inadimplência:

1. **Forma de pagamento única no PDV:** `Checkout.tsx` mantém um único estado `paymentMethod`, impedindo o cliente de pagar uma mesma comanda com múltiplas formas (ex.: parte em Pix + parte em Cartão ou Dinheiro), embora a tabela `public.comanda_payments` (ADR-018) já suporte múltiplos pagamentos por comanda.
2. **Pagamento antecipado/parcial invisível no Fluxo de Caixa:** a RPC `register_comanda_payment` (`20260830030000_m4_p7_register_comanda_payment.sql`) grava apenas em `public.comanda_payments` e **não gera lançamento espelho em `public.transactions`**. Com isso, o valor efetivamente recebido desaparece do Fluxo de Caixa (`Cashflow.tsx`), Recibos (`Receipts.tsx`), Conciliação Bancária (`BankReconciliation.tsx`) e BI (`biCockpitService.ts`).
3. **Distorção de data e forma de pagamento na quitação final:** ao quitar uma comanda com sinal/parcial prévio, `Checkout.tsx` envia `paidAmount = total` (cheio) para `finance_settle_comanda`. A RPC protege `comanda_payments` gravando apenas o saldo restante (`v_remaining_balance`), mas insere em `public.transactions` uma única linha com o **valor cheio na data e no método finais**, quebrando conciliação bancária e fechamento por método de pagamento. Além disso, a validação de troco (`cashTendered < total`) desconsidera valores já pagos, e o lançamento de parcial fica oculto em vendas novas (`checkoutEntryMode !== 'edit_comanda'`).
4. **Limbo de comandas não pagas após a virada do dia:** `comandas.status` possui apenas os 4 estados operacionais (`blocked | open | paid | cancelled` — ADR-017 D-1), e a marcação de fiado (`is_fiado = true` — ADR-045) é estritamente manual. Comandas abertas ou pagas parcialmente que passam do dia do atendimento permanecem eternamente como `status = 'open'` e `is_fiado = false`, invisíveis na fila de cobrança.
5. **Rigidez de regras de negócio por tenant:** políticas comerciais legítimas que variam entre barbearias (como liberar comissão sobre pagamento parcial no dia vs. somente na quitação 100%, prazo padrão de fiado ou bloqueio de novo fiado para devedores) hoje exigem alteração de código.

---

## Problem

1. Como habilitar múltiplas formas de pagamento (Split Payment) no PDV mantendo a agilidade de 1 clique no pagamento único?
2. Como garantir rastreabilidade financeira 100% consistente entre `comanda_payments`, `transactions`, Fluxo de Caixa, Conciliação Bancária, Comissões e Estornos — sem dupla contagem nem buracos negros?
3. Como promover automaticamente comandas não quitadas (ou parciais) na virada do dia para **Pagamento Pendente** sem quebrar o contrato de `comandas.status` (ADR-017 D-1)?
4. Como permitir que o gestor parametrize regras de negócio do seu tenant com segurança, auditoria e sem comprometer invariantes estruturais do SMG?

---

## Decision

### D-1. Espelhamento Contábil Atômico `comanda_payments ↔ transactions`

Seguindo o precedente canônico do ADR-030 §4.1 (espelhamento de vales em `transactions`), todo pagamento real gravado em `public.comanda_payments` (antecipado, parcial, parcela de split ou quitação final) **deve gerar, na mesma transação SQL**, seu espelho exato em `public.transactions`:

| Campo em `public.transactions` | Valor Canônico | Regra |
|---|---|---|
| `tenant_id` | `comanda_payment.tenant_id` | Obrigatório (fail-closed, ADR-003) |
| `type` | `'income'` | Entrada de caixa |
| `category` | `'Receita de Comanda'` | Chave técnica estável |
| `amount` | `comanda_payment.amount` | Estritamente o valor desta parcela (`> 0`) |
| `payment_method` | `comanda_payment.payment_method` | Método efetivo desta parcela |
| `date` | `COALESCE(p_payment_date_real, now())` | Data real do recebimento |
| `status` | `'paid'` | Recebimento efetivado |
| `source_type` | `'comanda_payment'` | Âncora bidirecional para estorno e conciliação |
| `source_id` | `comanda_payment.id` | FK lógica para a parcela |
| `idempotency_key` | `<key>::tx` | Ciclo de idempotência acoplado sem colisão |

**Regra de Quitação Final (`finance_settle_comanda`):**
- Calcula `v_remaining_balance = GREATEST(net_total - SUM(comanda_payments ativos), 0)`.
- Grava em `comanda_payments` e `transactions` **exclusivamente o saldo restante recebido no ato** (ou cada parcela do split que compõe esse saldo), **nunca** o `total` cheio da comanda.
- Se `v_remaining_balance = 0` (parciais prévios já quitam 100%), encerra a comanda (`status = 'paid'`) sem gerar nova linha em `comanda_payments` nem em `transactions`.
- Compatibilidade legado: transações históricas com `source_type = 'comanda'` permanecem válidas e imutáveis.

### D-2. Múltiplas Formas de Pagamento no PDV (Split Payment)

- A RPC de liquidação passa a aceitar uma lista de parcelas `p_payments JSONB` (`[{ amount, payment_method, terminal_id?, fee_percentage?, fee_amount?, net_amount?, estimated_settlement_date?, description? }]`), mantendo compatibilidade retroativa com a assinatura de pagamento único.
- No `Checkout.tsx`:
  - Padrão de 1 clique preservado (1 parcela pré-preenchida com 100% do `remaining`).
  - Ação **`+ Adicionar outra forma de pagamento`** permite dividir o saldo em 2 ou mais métodos (ex.: Pix + Cartão + Dinheiro), cada qual com seu seletor de maquininha/taxa (ADR-036) e validação de troco aplicada estritamente à parcela em dinheiro.
  - Disponível tanto em comandas existentes quanto em vendas novas no PDV (removendo a trava `checkoutEntryMode === 'edit_comanda'` após criação/persistência da comanda).
  - Se `SUM(parcelas) === remaining` → quita a comanda (`status = 'paid'`). Se `SUM(parcelas) < remaining` → registra os parciais com espelho imediato no Caixa e mantém a comanda com saldo em aberto.

### D-3. Estorno Único no Fluxo de Caixa com Recomposição de Saldo (ADR-045)

- Mantém-se estritamente o **Ponto Único de Estorno no Fluxo de Caixa (`/cashflow`)**.
- Ao estornar uma transação com `source_type = 'comanda_payment'`:
  1. Marca `reversed_at = now()` na linha correspondente de `public.comanda_payments` (append-only, sem DELETE — ADR-018).
  2. Registra a reversão financeira em `transactions` conforme o contrato de estorno vigente.
  3. Recalcula o saldo da comanda: se a comanda estava `paid` e o saldo volta a ficar `> 0`, reabre o saldo devedor (com trilha em `audit_logs` e estorno proporcional de comissão D7/D8).

### D-4. Transição Automática para **Pagamento Pendente** na Virada do Dia

Sem alterar o `CHECK` constraint de `comandas.status` (preservando integralmente ADR-017 D-1):

1. **Estado financeiro derivado em tempo real (`payment_state`):** calculado a partir de `balance = net_total - paid` e da data de competência do atendimento em BRT (`America/Sao_Paulo`):
   - `status = 'open'` e `data === hoje` e `paid === 0` → **`Em Aberto`** (atendimento do dia)
   - `status = 'open'` e `data === hoje` e `paid > 0` e `balance > 0` → **`Parcialmente Pago`**
   - `status = 'open'` e `balance > 0` e `data < hoje` (independente de ter tido pagamento parcial ou não) → **`Pagamento Pendente`** (distinto visualmente de *Fiado acordado*, ambos cobráveis no Contas a Receber exibindo *Total*, *Já Pago* e *Saldo Restante*)
2. **Persistência auditável na virada do dia:**
   - Adicionar coluna aditiva `payment_pending_since TIMESTAMPTZ NULL` em `public.comandas`.
   - Job diário via `pg_cron` (00:05 BRT) preenche `payment_pending_since = now()` para comandas `status = 'open'` de dias anteriores com `balance > 0` e `payment_pending_since IS NULL` (quando a regra do tenant `auto_pending_payment` estiver ativa).
3. **Guarda contra limbo de walk-in sem cliente:** comandas em **Pagamento Pendente** sem `client_id` aparecem em bloco dedicado *"Pendências sem Cliente Identificado (Ação do Gestor)"* no Contas a Receber.

### D-5. Central de Regras de Negócio do Gestor (`Configurações → Regras de Negócio`)

- **Localização e Acesso:** nova aba dedicada dentro de `pages/Settings.tsx`, protegida por `ManagerRoute` (`owner` / `admin` / `manager`).
- **Armazenamento:** chave tipada `business_rules` dentro de `public.tenants.settings` (`JSONB` já existente com RLS e gate de gestão, mesmo padrão de `refund_method` em `src/lib/finance/refundConfig.ts`).
- **Defaults seguros e efeito prospectivo:** ausência de chave usa defaults idênticos ao comportamento canônico atual; alterações gravam diff (`Antes → Depois`, `actor_id`, timestamp) em `audit_logs` e aplicam-se **apenas a operações/apurações futuras** (nunca reescrevem histórico fechado).

**Catálogo Inicial de Parâmetros (`tenants.settings.business_rules`):**

| Bloco | Chave | Opções | Default |
|---|---|---|---|
| **1. Comissões** | `partial_payment_commission_policy` | `'proportional_cash'` (libera proporcional ao recebido no dia — ADR-030) · `'only_on_full_settlement'` (libera apenas após quitação 100%) | `'proportional_cash'` |
| | `discount_commission_base` | `'net_after_discount'` · `'respect_discount_bearer'` | `'net_after_discount'` |
| | `default_product_commission_rate` | `0..100` (override por profissional — ADR-047) | `0` |
| **2. PDV & Pagamentos** | `allow_split_payment` | `true` · `false` | `true` |
| | `partial_payment_role_gate` | `'reception_and_management'` · `'management_only'` · `'disabled'` | `'reception_and_management'` |
| | `require_client_for_partial_or_fiado` | `true` · `false` | `true` |
| **3. Virada do Dia & Pendências** | `overdue_open_comanda_policy` | `'auto_pending_payment'` (00:05 BRT) · `'manual'` | `'auto_pending_payment'` |
| | `default_fiado_due_days` | inteiro positivo (`7`, `15`, `30`, custom) | `15` |
| | `overdue_client_new_fiado_policy` | `'warn'` · `'block_with_pin'` · `'off'` | `'warn'` |
| **4. Caixa & Segurança** | `refund_method` *(unifica P8 atual)* | `'internal_credit'` · `'pix'` · `'cash'` · `'card_reversal'` · `'store_credit'` | `'internal_credit'` |
| | `require_manager_pin_rules` | `{ refund, zero_close, discount_above_pct }` *(usa `AuditPinSection`)* | `{ refund: true, zero_close: true, discount_above_pct: 20 }` |

**Invariantes Estruturais (não configuráveis — exibidos com selo informativo):**
- Isolamento multi-tenant via RLS (ADR-003).
- Ponto único de estorno no Fluxo de Caixa (ADR-045).
- Pagamento antecipado não marca atendimento como concluído (`paid_at ≠ attended_at`, ADR-017).
- Separação entre Comissão Teórica e Fechamento de Caixa (ADR-001).

---

## Alternatives Considered

1. **Adicionar valor `'pending_payment'` ao CHECK de `comandas.status`:**
   - *Rejeitada.* Quebra o contrato do ADR-017 D-1, exige alterar todas as queries/RPCs/testes que assumem o conjunto fechado `('blocked','open','paid','cancelled')` e mistura ciclo operacional com financeiro.
2. **Converter automaticamente comanda aberta de ontem em `is_fiado = true`:**
   - *Rejeitada pelo PO (2026-11-27).* Mistura *fiado acordado* com *pagamento esquecido/parcial não concluído*. O estado derivado **Pagamento Pendente** preserva a semântica real para cobrança e auditoria.
3. **Criar tabela separada `tenant_business_rules`:**
   - *Rejeitada.* `public.tenants.settings` (`JSONB`) já existe, já possui RLS e já hospeda parâmetros financeiros por tenant (`refund_method`); usar chave tipada `business_rules` evita tabela redundante e reduz superfície de migration.

---

## Consequences

- **Positivas:**
  - Fim do buraco negro de pagamentos parciais/antecipados no Fluxo de Caixa, Recibos, Conciliação Bancária e BI.
  - Eliminação da distorção de data/método na quitação de comandas com sinal prévio.
  - Suporte nativo a múltiplas formas de pagamento (Split Payment) no PDV sem perder o fluxo de 1 clique.
  - Nenhuma comanda não quitada de dias anteriores fica perdida no limbo (`open` eterno).
  - Autonomia auditada para cada barbearia configurar sua política de comissão parcial, virada do dia e travas de PDV.
- **Riscos e Mitigações:**
  - *Dupla contagem em dados históricos:* mitigado pelo `source_type = 'comanda_payment'` (novo) separado do legado `source_type = 'comanda'`, e pelo cálculo estrito de `v_remaining_balance` na quitação.
  - *Impacto em produção de migrations/RPCs:* toda migration segue o gate do **ADR-048** (aprovação explícita do PO antes de aplicar no banco remoto) e o gate **ADR-026** (`MERGE ≠ DEPLOY PROD`).

---

## Phased Execution Plan (Aguardando Aprovação do PO)

| Fase | Escopo | Dependência / Gate |
|---|---|---|
| **Fase A — Fundação Financeira (Banco & RPCs)** | Migration timestampada: espelhamento atômico `comanda_payments ↔ transactions`, `finance_settle_comanda` com `p_payments` + cobrança estrita de `remaining`, estorno vinculado em `/cashflow`, coluna `payment_pending_since` + job `pg_cron` 00:05 BRT, RPCs `get/upsert_tenant_business_rules` + `audit_logs` + testes unitários/integrados. | Aprovação deste ADR-059 + aprovação explícita de migration em PROD (ADR-048). |
| **Fase B — PDV (Split Payment) & Contas a Receber (Pagamento Pendente)** | UI de múltiplas formas de pagamento e parciais no `Checkout.tsx` (incluindo validação de troco sobre `remaining`) + fila **Pagamento Pendente** no `AccountsReceivable.tsx` (com *Total / Já Pago / Saldo Restante* e alerta de walk-in sem cliente). | Fase A concluída e validada. |
| **Fase C — Central de Regras de Negócio** | Aba `Regras de Negócio` em `Settings.tsx` (4 blocos + diff antes/depois + selo de travas invioláveis) integrada ao `Commissions.tsx`, `Payroll.tsx` e `Checkout.tsx`. | Fase A concluída e validada. |
