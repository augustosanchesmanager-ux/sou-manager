# Correção Auditada / Ajuste Auditado

## Objetivo

Preparar a primeira camada visual e técnica para solicitar correções auditadas em áreas financeiras do SMG sem alterar dados financeiros reais nesta entrega.

Esta fase não aplica migration, não altera schema remoto, não cria RPC e não grava histórico. A aplicação financeira definitiva dependerá de uma RPC transacional futura.

## Pontos de entrada mapeados

- `pages/Comandas.tsx`
  - Ajustes futuros: participação de serviço, estorno de baixa, data/forma de pagamento e revisão.
- `pages/Commissions.tsx`
  - Ajustes futuros: comissão, participação de serviço e revisão.
- `pages/AccountsReceivable.tsx`
  - Ajustes futuros: data real de pagamento, forma de pagamento, estorno, cancelamento de cobrança indevida e revisão.
- `pages/Cashflow.tsx`
  - Ajustes futuros: reclassificação, data/forma de pagamento, ocultar do financeiro com motivo e revisão.
- `pages/Receipts.tsx`
  - Ajustes futuros: cancelamento de cobrança, forma de pagamento, reclassificação e revisão.
- `pages/CashClosingPage.tsx`
  - Ajustes futuros: divergência de caixa, reclassificação, estorno, data/forma de pagamento e revisão.
- Clube do Chefe
  - Apenas mapeado para fase futura. Esta entrega não altera fluxo do Clube.

## Permissões previstas

O botão visual aparece apenas para:

- `owner`
- `admin`
- `manager`
- `superadmin`
- usuários com `canAccessSuperAdmin`

Barbeiro e recepção não solicitam ajuste financeiro nesta camada.

## Estrutura futura sugerida

### `audit_adjustments`

- `id`
- `tenant_id`
- `source_type`
- `source_id`
- `adjustment_type`
- `reason_type`
- `reason_note`
- `before_snapshot`
- `after_snapshot`
- `financial_impact`
- `status`
- `requested_by_user_id`
- `requested_at`
- `approved_by_user_id`
- `approved_at`
- `applied_by_user_id`
- `applied_at`
- `rejected_by_user_id`
- `rejected_at`
- `rejection_reason`

### `financial_events`

- `id`
- `tenant_id`
- `source_type`
- `source_id`
- `event_type`
- `amount`
- `payment_method`
- `event_date`
- `created_by_user_id`
- `audit_adjustment_id`
- `metadata`

### `financial_reversals`

- `id`
- `tenant_id`
- `original_event_id`
- `reversal_event_id`
- `reason_type`
- `reason_note`
- `created_by_user_id`
- `created_at`
- `audit_adjustment_id`

## Regras da RPC futura

- Aplicar ajuste de forma transacional.
- Validar `tenant_id`.
- Validar permissão do usuário.
- Exigir motivo e observação.
- Salvar snapshots antes/depois.
- Nunca apagar o lançamento original.
- Criar evento reverso para estorno/devolução.
- Registrar usuário e data.

## Riscos conhecidos

- A camada atual é apenas visual e não garante persistência.
- Sem RPC transacional, qualquer alteração real poderia ficar parcialmente aplicada.
- `staff.role` legado ainda limita separação fina entre gerente operacional e administrativo.
- Relatórios podem divergir até existir fonte financeira central.
- O Clube do Chefe precisa de fase própria para cancelamento auditável e cliente duplicado.
