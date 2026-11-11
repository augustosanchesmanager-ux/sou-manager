# ADR-047: Unificação E2E das Regras de Comissão (Serviço, Produto, Coexecução), Fiado e Vales

- **Status:** Accepted
- **Date:** 2026-11-11
- **Decision Makers:** Augusto (PO)
- **Scope:** Canonical Domain (`domain/commission/`, `domain/cashLedger/`, `domain/payout/`), Edge Worker (`worker-dispatcher`), Application Services (`application/commission.ts`, `application/cashClosing/`), Modules (`reports/`, `performance/`, `commissions/`), UI (`Checkout.tsx`, `Operations.tsx`, `Commissions.tsx`, `Cashflow.tsx`, `CashLedger.tsx`), Database (`supabase/migrations/20261111161000_adr047_unify_commission_product_and_vales.sql`)

---

## Context

Durante a homologação operacional em 2026-11-11, foram identificadas múltiplas divergências de regra de negócio entre módulos do sistema:

1. **Coexecução com valor fixo (`payout_type = 'fixed'`):** o núcleo canônico D8 (`calculateCommissionValue`) pagava o valor fixo integral sem multiplicar pela taxa do profissional, enquanto `application/commission.ts`, `pages/Commissions.tsx`, `salesReportService.ts`, `performanceService.ts` e o runtime anterior do worker multiplicavam o valor fixo pela taxa (`commission_rate`).
2. **Comissão sobre venda de produtos (`staff.product_commission_rate`):** a flag/alíquota por perfil foi criada (`20261108110500`), mas apenas `barberStatementService.ts` e `Team.tsx` a respeitavam; `createCommissionRecordHandler.ts`, `worker-dispatcher`, `get_financial_operation_context`, `application/cashClosing/`, `Commissions.tsx`, `salesReportService.ts` e `performanceService.ts` aplicavam a taxa de serviços (`commission_rate`) sobre produtos.
3. **Vales / Adiantamentos (`register_barber_advance`):** a RPC gravava `transactions.date = timezone('utc'::text, now())::date` (`00:00:00+00`) e `status = 'completed'`. No fuso BRT (`UTC-3`), `00:00:00+00` ficava anterior ao `getDayRange()` (`03:00:00Z`) do Fechamento de Caixa, aparecia como dia anterior no Fluxo de Caixa, ficava fora dos totais pagos em `CashLedger` (que esperavam `'paid'`), e `application/cashClosing/summary.ts` mantinha `advances: 0` fixo.

---

## Decision

1. **Coexecução (`Valor Fixo` e `Porcentagem`) com alíquota do perfil do profissional:**
   - Na UI de coexecução/apoio (`Checkout.tsx`, `Operations.tsx`), mantém-se tanto `Porcentagem` quanto `Valor Fixo` (ex.: barbeiro principal atribui R$ 20,00 pela aplicação do botox ao colaborador de apoio).
   - Em ambos os modos, o valor atribuído ao participante funciona como **base de participação** e sofre a **alíquota percentual definida no perfil do profissional** (`calculateCommissionValue` = `min(payout_value, receivedValue) × commissionRate` no modo fixo; `receivedValue × share × commissionRate` no modo percentual — ex.: R$ 20,00 × 50% = **R$ 10,00**).
   - `domain/commission/calculate.ts`, `createCommissionRecordHandler.ts`, `worker-dispatcher/calculate.ts`, `application/commission.ts`, `pages/Commissions.tsx`, `salesReportService.ts` e `performanceService.ts` passam a aplicar essa regra única (alinhada ao docstring original de `calculateCommissionValue` e sem `commissionRate = 1.0` forçado para `fixed`).
2. **Alíquota separada de Serviço vs. Produto (`product_commission_rate`):**
   - `domain/commission/calculate.ts` passa a expor os helpers canônicos `isProductComandaItem(item)` e `getEffectiveItemRate(staff, item)` (exportados também para `_shared/financial-core/index.ts` via `npm run d8:build`).
   - Itens de produto (`product_id` presente ou `service_id` ausente com nome preenchido) usam `staff.product_commission_rate` (default `0%` = sem comissão em produtos); itens de serviço usam `staff.commission_rate`.
   - `get_financial_operation_context`, `createCommissionRecordHandler.ts`, `worker-dispatcher/calculate.ts`, `application/commission.ts`, `pages/Commissions.tsx`, `salesReportService.ts`, `performanceService.ts`, `application/cashClosing/` e `domain/payout/payoutRepository.ts` convergem para a mesma regra.
3. **Regime de caixa para Comandas Abertas / Fiados:**
   - Comandas abertas ou marcadas como fiado (`is_fiado = true`, ADR-045) não geram repasse financeiro até a liquidação real em `comanda_payments`.
4. **Competência e visibilidade unificada de Vales:**
   - `public.register_barber_advance` passa a registrar `transactions.date = now()` e `status = 'paid'`, com backfill das transações `barber_advance` que estavam em meia-noite UTC.
   - `CashLedger` trata `'paid'` e `'completed'` de forma equivalente; `Cashflow` formata datas date-only/meia-noite UTC sem recuo de 1 dia; `CashClosing` carrega os vales ativos do dia por profissional em `barberClosingDetails.advances`.

---

## Consequences

- **Consistência ponta a ponta:** Agendamento → Comanda Aberta/Fiado → Checkout → Outbox/Worker → Fechamento de Caixa → Livro Razão → Extrato → Relatórios → Folha aplicam exatamente as mesmas alíquotas e critérios de caixa.
- **Deploy coordenado:** Requer aplicação da migration `20261111161000_adr047_unify_commission_product_and_vales.sql` e redeploy da Edge Function `worker-dispatcher` após aprovação do PO.
