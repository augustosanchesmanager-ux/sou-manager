# ADR-045: Consolidação do Ecossistema Financeiro — Fiados, Ponto Único de Estorno e Fluxo de Caixa

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Augusto (PO) + Antigravity
**References:**
- [ADR-001](./ADR-001-Commission-vs-Settlement.md) — Commission vs Settlement
- [ADR-003](./ADR-003-multi-tenant-isolation.md) — Multi-Tenant Isolation
- [ADR-012](./ADR-012-rpc-execute-grants.md) — RPC EXECUTE Grants
- [ADR-014](./ADR-014-transactional-outbox.md) — Transactional Outbox (D7)
- [ADR-018](./ADR-018-payment-contract.md) — Payment Contract
- [ADR-037](./ADR-037-bank-reconciliation-ofx.md) — Conciliação Bancária OFX/CSV
- [ADR-039](./ADR-039-auditoria-e-competencia-retroativa-com-pin.md) — Auditoria e Competência Retroativa com PIN

---

## Context

O módulo financeiro acumulou sobreposições operacionais em 10 rotas distintas:
1. O estorno (`reverseFinancialTransaction`) podia ser disparado a partir de 4 telas diferentes (`AccountsReceivable`, `Cashflow`, `Comandas` e `Receipts`), além de fluxos auxiliares em `Schedule`.
2. Comandas não pagas no ato ficavam misturadas entre "comandas abertas sem definição de pagamento", uma tela separada `Conta do Cliente (Fiado)` (`ClientAccount.tsx`), uma sub-aba no `CashLedger` (`Entrada / Saída`) e o `Contas a Receber` (`AccountsReceivable.tsx`).
3. Em `QuickCheckoutModal.tsx` (`executeChargeToAccount`), a opção "Na Conta (Fiado)" liquidava a comanda imediatamente via `settleCheckoutComanda`, gerando receita no caixa e comissão do barbeiro antes do recebimento real.
4. O `CashLedgerRepository` e o `ClientWalletRepository` operavam parcialmente com fallback em memória/`localStorage` por ausência de tabelas dedicadas no schema `public`.

## Decision

Consolidar o ecossistema financeiro sob uma **fonte única da verdade** em regime de caixa real, preservando integralmente o **ADR-001** e o pipeline **D7/D8**:

1. **Comanda Fiado Explícita (Regime de Caixa Real):**
   - Comandas não pagas no momento do atendimento não ficam abertas sem definição; passam a ser formalmente marcadas como **fiado** (`comandas.is_fiado = true`, `fiado_marked_at`, `fiado_marked_by`, `fiado_due_date`, `fiado_note`) com **cliente identificado obrigatório** (`client_id IS NOT NULL`).
   - Enquanto marcada como `fiado`, a comanda permanece `status = 'open'` e **não** gera `transactions`, `comanda_payments` nem comissão para o profissional.
   - A liquidação da comanda `fiado` ocorre exclusivamente no **Contas a Receber** na **data efetiva do recebimento** (`p_payment_date_real`), finalizando a comanda e disparando o pagamento no caixa e a comissão do barbeiro na data em que o valor foi pago.

2. **Separação de Devedores (Fiados) vs Saldos Positivos:**
   - A aba **Fiados** do **Contas a Receber** unificado exibe exclusivamente clientes devedores (comandas `fiado` abertas e/ou saldo negativo).
   - Clientes com saldo positivo (créditos pré-pagos) permanecem segregados em visão própria de Créditos/Carteira, sem poluir a fila de cobrança.

3. **Ponto Único de Baixa e Ponto Único de Estorno:**
   - **Baixa de recebíveis:** concentrada no **Contas a Receber** (`/accounts-receivable`), exceto pagamentos imediatos no ato do atendimento (`Checkout / PDV`).
   - **Baixa de despesas:** concentrada no **Contas a Pagar** (`/expenses`).
   - **Estorno financeiro:** executado exclusivamente no **Fluxo de Caixa** (`/cashflow`). As demais telas (`Comandas`, `Contas a Receber`, `Recibos`) exibem o status e oferecem atalho direto de navegação para a transação no Fluxo de Caixa (`/cashflow?tx=<id>`), sem duplicar o modal/ação de estorno.

4. **Hub Único de Fluxo de Caixa & Conciliação Bancária no Encerramento do Dia:**
   - Consolidar `Visão Geral` (`/financial-overview`) e `Entrada / Saída` (`/entrada-saida`) dentro de **Fluxo de Caixa** (`/cashflow`), removendo seeds fictícios e fallbacks silenciosos em produção.
   - Integrar a **Conciliação Bancária** (`/bank-reconciliation`) ao fechamento do dia, auditando as liquidações registradas em `transactions` (fiado, PIX, cartão e Contas a Pagar).

## Consequences

- **Positivas:** Elimina comissões e receitas prematuras em vendas a prazo; remove ambiguidade operacional no estorno; garante rastreabilidade real entre `comandas`, `client_wallets`, `transactions`, fechamento de caixa e conciliação bancária; reduz duplicação de telas preservando 100% das métricas e relatórios.
- **Cuidados:** Requer migration timestampada (`client_wallets`, `client_wallet_transactions`, colunas `is_fiado` em `comandas` e RPC `mark_comanda_as_fiado`) aprovada pelo PO antes da aplicação em produção e redirecionamento compatível das rotas legadas (`/entrada-saida`, `/client-accounts`, `/financial-overview`).
