# ADR-060: PDV Rápido Dual (Express 1-Toque + Lançamento e Baixa Simultânea) e RBAC Escopado no Settlement

**Status:** Accepted (2026-11-28 — decisão e autorização do PO Augusto)
**Date:** 2026-11-28
**Deciders:** PO (Augusto) + Antigravity
**Amends:** [ADR-019](./ADR-019-role-authorization.md) (autorização por papel na liquidação financeira)
**References:**
- [ADR-001](./ADR-001-Commission-vs-Settlement.md) — Commission vs Settlement
- [ADR-012](./ADR-012-rpc-execute-grants.md) — RPC EXECUTE Grants
- [ADR-014](./ADR-014-transactional-outbox.md) — Transactional Outbox (D7)
- [ADR-016](./ADR-016-dispatcher-server-side.md) — Dispatcher Server-side (D8)
- [ADR-018](./ADR-018-payment-contract.md) — Contrato de Pagamento (`comanda_payments`)
- [ADR-035](./ADR-035-appointment-comanda-sync-and-post-checkout-lock.md) — Trava Pós-Checkout e Sync Agenda × Comanda
- [ADR-036](./ADR-036-payment-terminals-and-fee-snapshots.md) — Maquininhas e Snapshot Contábil de Taxas
- [ADR-039](./ADR-039-auditoria-e-competencia-retroativa-com-pin.md) — Competência Retroativa com PIN de Gerente
- [ADR-045](./ADR-045-financial-ecosystem-consolidation.md) — Fiados, Ponto Único de Estorno e Fluxo de Caixa
- [ADR-047](./ADR-047-unified-commission-product-and-vales-rules.md) — Regras Unificadas de Comissão (Serviço/Produto/Coexecução)
- [ADR-052](./ADR-052-product-sales-by-staff-and-flexible-goals.md) — Venda de Produtos por Profissional (`comanda_items.staff_id`)
- [ADR-056](./ADR-056-application-layer-repository-pattern-migration.md) — Application Layer & Repository Pattern

---

## 1. Context

Na operação diária das barbearias atendidas pelo SMG Barber, foram identificados dois gargalos críticos no uso do PDV:

1. **Dívida técnica e bypass financeiro no `QuickCheckoutModal` (Modo Balcão Express):**
   - O modal de fechamento rápido existente em `components/checkout/QuickCheckoutModal.tsx` era montado apenas na tela de Comandas (`pages/Comandas.tsx`), não estando disponível diretamente na Agenda (`pages/Schedule.tsx`) nem no card operacional da cadeira (`components/schedule/BarberChairQueue.tsx`).
   - Mais grave: ele invocava `settleCheckoutComanda` diretamente (sem `finance_settle_comanda_and_enqueue`), deixando de enfileirar o Outbox D7/D8 para cálculo de comissão, sem gravar `comanda_payments` (`p_record_comanda_payment = true`, ADR-018) e sem registrar o snapshot contábil da maquininha padrão (ADR-036). Além disso, importava `supabase` e repositórios diretamente na camada de componente UI.
2. **Ausência de fluxo único de Lançamento + Baixa para barbeiros sem agenda:**
   - Profissionais que não lançam seus atendimentos na hora obrigavam o gestor/recepção no fim do dia (ou em dias posteriores) a executar dois fluxos separados: criar o agendamento na Agenda e depois abrir/liquidar cada comanda no Checkout.
3. **Bloqueio rígido de papéis na RPC `finance_settle_comanda`:**
   - Pelo ADR-019 original e pela migration `20261010180000`, apenas `owner`, `admin`, `manager`, `gerente` e `superadmin` podiam chamar `finance_settle_comanda` / `finance_settle_comanda_and_enqueue`, impedindo recepção e barbeiros de usar o fechamento rápido mesmo em comandas próprias do dia.

---

## 2. Decision

Fica aprovada a arquitetura de **PDV Rápido Dual** unificada sobre o mesmo motor canônico (`CheckoutApplicationService`), com ampliação escopada e segura do RBAC no banco de dados:

### 2.1. Dois Modais Rápidos, Um Único Motor Canônico

1. **Modal A — Express 1-Toque (`QuickCheckoutModal` saneado):**
   - Destinado ao fechamento rápido (2 cliques) de **comandas já existentes/abertas** diretamente da Agenda (card *Na Cadeira Agora* e menu do agendamento) e de Comandas.
   - Passa obrigatoriamente por `application/checkout/quickPdv.ts` → `CheckoutApplicationService.finish()` (Outbox D7/D8, `comanda_payments` ADR-018, snapshot automático da maquininha padrão ADR-036 e sync de agendamento concluído).
   - Suporta acréscimo rápido opcional de serviços/produtos (`+ Extra Rápido`) com atribuição explícita de `comanda_items.staff_id` (ADR-047/ADR-052), liquidação via créditos do Club dos Chefes, Fiado com PIN gerencial (ADR-045), QR Code PIX na cadeira e botão pós-venda WhatsApp.
   - Mantém link discreto *"Abrir PDV Completo"* para cenários avançados (pagamento misto, desconto discricionário, coexecução complexa).

2. **Modal B — Lançamento & Baixa Simultânea (`QuickRegisterAndSettleModal`):**
   - Destinado a registros rápidos sem agendamento prévio (inclusive em lote no fim do expediente ou dias anteriores).
   - Em **um único modal**:
     - Permite selecionar o profissional (ou trava no próprio usuário para papel `barber`);
     - Permite escolher a **Data de competência** (padrão `Hoje`; dias anteriores liberados apenas para papéis gerenciais; datas futuras sempre proibidas) e um **campo rápido de horário opcional** (padrão `Agora` para hoje e `12:00` local para dias anteriores, evitando troca de dia por fuso horário);
     - Suporta busca de cliente (inclusive dependentes familiares), modo **Avulso / Balcão** ou cadastro rápido inline (Nome + WhatsApp);
     - Lança múltiplos serviços e/ou produtos em 1 toque (via `create_appointment_with_comanda` com `isOverbooked: true` para o serviço principal + sincronização completa de itens/participantes em `CheckoutApplicationService.finish()`);
     - Liquida imediatamente via `finance_settle_comanda_and_enqueue` (PIX, Débito, Crédito, Dinheiro, Club dos Chefes ou Fiado com PIN);
     - Oferece **Modo Lote (`Finalizar e Lançar Próximo`)** mantendo profissional e data fixados;
     - Possui **recuperação idempotente de falha parcial**: se o agendamento/comanda for criado e a baixa financeira falhar por rede/PIN, o hook retém `pendingRecovery` (`appointmentId`, `comandaId`, `idempotencyKey`) para retentar apenas a baixa sem duplicar registros.

### 2.2. Emenda Escopada ao ADR-019 — Matriz de RBAC e Competência no Banco (`SECURITY DEFINER`)

A assinatura de `public.finance_settle_comanda` e `public.finance_settle_comanda_and_enqueue` passa a aceitar `p_audit_pin TEXT DEFAULT NULL` (com remoção dos overloads anteriores sem `p_audit_pin`) e impõe no PostgreSQL as seguintes regras:

| Papel | Modal A (Express 1-Toque) | Modal B (Lançamento + Baixa) | Competência Retroativa | Caixa Confirmado (`cash_closings`) |
|---|---|---|---|---|
| `owner` / `admin` / `manager` / `gerente` / `superadmin` | Qualquer comanda do tenant | Qualquer profissional do tenant | **Permitida** (nunca futura) | **Exige `p_audit_pin` válido** via `verify_audit_pin` + marca `transactions.retroactive_adjustment = true` |
| `receptionist` / `recepcionista` / `cashier` / `caixa` | Comandas abertas do tenant | Qualquer profissional do tenant | **Bloqueada no banco** (somente Hoje) | **Bloqueada no banco** |
| `barber` / `barbeiro` | **Somente próprias comandas** (`comandas.staff_id = auth.uid()` ou item/participante vinculado ao próprio `staff_id`) | **Somente para si mesmo** (profissional travado) | **Bloqueada no banco** (somente Hoje) | **Bloqueada no banco** |

**Isolamento contra vazão de informações na UI e no Banco:**
- `barber` nunca visualiza comandas de outros colegas, caixa consolidado da loja, estornos nem margens líquidas/taxas de maquininha (`fee_amount` / `net_amount` — o snapshot contábil ADR-036 continua sendo gravado silenciosamente em `comanda_payments` sem exposição na UI do barbeiro).
- Descontos livres permanecem bloqueados no PDV Rápido de `barber`; Fiado exige sempre cliente identificado + PIN do gestor; Estornos permanecem exclusivos do Fluxo de Caixa (`/cashflow`, ADR-045).

---

## 3. Alternatives Considered

1. **Manter apenas o `QuickCheckoutModal` antigo com chamada direta a `finance_settle_comanda`:**
   Rejeitado — mantinha bypass crítico de D7/D8 Outbox, `comanda_payments` e ADR-036.
2. **Liberar baixa financeira irrestrita para `barber` sem filtro de propriedade nem trava de data:**
   Rejeitado — permitiria que um barbeiro liquidasse comandas de colegas ou alterasse datas passadas/caixas fechados.
3. **Executar tudo via novo Repository exclusivo em vez de compor `AppointmentApplicationService` + `CheckoutApplicationService`:**
   Rejeitado — arquitetura da Fase 2 congelada; compor os Application Services existentes mantém 100% de consistência sem criar duplicidade de regras financeiras.

---

## 4. Consequences & Rollout

- **Positivas:**
  - Elimina divergência financeira entre PDV completo e PDV rápido (D7/D8, ADR-018, ADR-036, ADR-047, ADR-052).
  - Resolve o fluxo operacional de fim de dia / dias anteriores em lote sem retrabalho de agendar e baixar separado.
  - Preserva os arquivos canônicos imutáveis do core D8 (`npm run d8:verify`).
  - Zero violações de camadas (`components/` sem import direto de Supabase ou Repositories).
- **Cuidados & Rollout:**
  - Migration timestampada: `supabase/migrations/20261128000000_adr059_quick_pdv_scoped_rbac_and_retroactive_pin.sql`.
  - **Não aplicada automaticamente** em Staging/Produção — depende de aprovação explícita do PO conforme [ADR-048](./ADR-048-cd-supabase-migrations-gate.md).
  - Enquanto a migration não for aplicada no banco remoto, baixas retroativas em caixa fechado ou baixas via RPC executadas por `barber`/`receptionist` serão recusadas pela assinatura anterior em produção (gestores continuam operando normalmente).
- **Rollback:**
  - Reverter a migration restaurando as assinaturas de 9 e 14 parâmetros de `20261010180000_fix_finance_settle_comanda_payment_type.sql`.
