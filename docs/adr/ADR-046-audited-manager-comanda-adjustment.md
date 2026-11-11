# ADR-046: Ajuste Gerencial Auditado de Comanda (Status, Data de Abertura e Data de Pagamento)

**Status:** Accepted
**Date:** 2026-11-10
**Deciders:** Augusto (PO) + Antigravity
**References:**
- [ADR-001](./ADR-001-Commission-vs-Settlement.md) — Commission vs Settlement
- [ADR-003](./ADR-003-multi-tenant-isolation.md) — Multi-Tenant Isolation
- [ADR-008](./ADR-008-audit-strategy.md) — Audit Strategy
- [ADR-012](./ADR-012-rpc-execute-grants.md) — RPC EXECUTE Grants
- [ADR-019](./ADR-019-role-authorization.md) — Role Authorization
- [ADR-021](./ADR-021-rpc-tenant-scoped-authorization.md) — RPC Tenant-Scoped Authorization
- [ADR-035](./ADR-035-appointment-comanda-sync-and-post-checkout-lock.md) — Trava Pós-Checkout
- [ADR-039](./ADR-039-auditoria-e-competencia-retroativa-com-pin.md) — Auditoria e Competência Retroativa com PIN de Gerente

---

## Context

Mesmo com a correção do fuso horário nas RPCs de agendamento e do auto-desbloqueio na abertura de comandas do dia (`20261110224000_fix_comanda_blocked_timezone_and_unblock_gate.sql`), existem cenários operacionais legítimos em que a gestão precisa corrigir metadados de uma comanda já criada ou liquidada:
1. Alternar manualmente o status entre `blocked` e `open` (ex.: liberar comanda futura antecipadamente ou re-bloquear comanda aberta antes do atendimento).
2. Corrigir a data de abertura (`comandas.created_at`) quando uma comanda foi gerada ou lançada em data divergente da operacional.
3. Corrigir a data de pagamento (`payment_date_real`, `settled_at`, `closed_at`) quando um recebimento foi baixado na competência errada, mantendo sincronia entre a comanda, `comanda_payments` e `transactions`.

Hoje não existe uma RPC única, transacional e auditável para esses ajustes administrativos, e editar diretamente `comandas` pelo cliente violaria o isolamento RLS/governança e dessincronizaria o caixa.

---

## Problem

Como permitir que **apenas gerentes/administradores** ajustem status (`open` ↔ `blocked`), data de abertura e data de pagamento de uma comanda sem:
- enfraquecer o [ADR-035](./ADR-035-appointment-comanda-sync-and-post-checkout-lock.md) (comanda paga nunca é reaberta ou editada em valores silenciosamente);
- dessincronizar `comandas`, `comanda_payments`, `transactions` e `cash_closings`;
- burlar a trava de caixa fechado com PIN de gerente ([ADR-039](./ADR-039-auditoria-e-competencia-retroativa-com-pin.md));
- violar o cálculo de comissão D7/D8 ([ADR-001](./ADR-001-Commission-vs-Settlement.md) e Amendment-04).

---

## Decision

Criar uma RPC exclusiva de gestão (`public.admin_adjust_comanda_audit`) respaldada por tabela append-only (`public.comanda_admin_adjustments`), seguindo os contratos abaixo:

### 1. Controle de acesso e escopo de tenant (ADR-012 / ADR-019 / ADR-021)
- `SECURITY DEFINER`, `SET search_path = public, extensions`.
- `REVOKE ALL` de `PUBLIC`, `anon` e `service_role`; `GRANT EXECUTE` apenas para `authenticated`.
- Autorização estritamente **tenant-scoped**: exige `auth.uid()`, pertencimento ao `p_tenant_id` (`user_tenants` primário ou `current_tenant_id_from_auth_uid() = p_tenant_id`) e papel de gestão (`owner`, `admin`, `manager`, `gerente`, `superadmin`, `super admin`).
- **Motivo obrigatório** (`p_reason`) não vazio em 100% das chamadas.
- Lock pessimista com `pg_advisory_xact_lock` e `SELECT ... FOR UPDATE` na comanda alvo.

### 2. Regras por campo ajustável

| Campo | Condição permitida | Regra de negócio e integridade |
|---|---|---|
| **Status (`open` ↔ `blocked`)** | Apenas se o status atual for `'open'` ou `'blocked'` | Comandas `'paid'`, `'closed'`, `'billed'` ou `'cancelled'` são **bloqueadas** (`ADR-035`). Para reabrir comanda paga, permanece obrigatório o estorno auditado (`finance_reverse_transaction` / `reverse_comanda_payment`). |
| **Data de abertura (`created_at`)** | Comanda do tenant (exceto `'cancelled'`) | Não permite data futura no fuso do tenant (`tenant_settings.timezone`, fallback `'America/Sao_Paulo'`). Não altera `idempotency_key` nem dispara eventos de outbox. |
| **Data de pagamento (`payment_date_real`, `settled_at`, `closed_at`)** | Apenas se `status = 'paid'` e houver liquidação financeira associada | Não permite data futura no fuso do tenant. Atualiza **atomicamente na mesma transação**: `comandas.payment_date_real`, `comandas.settled_at`, `comandas.closed_at`, `comanda_payments.created_at` (linhas ativas `reversed_at IS NULL`) e `transactions.date` das receitas vinculadas (`source_type = 'comanda' AND source_id = p_comanda_id`). **Não altera valores** nem recalcula comissões D7/D8 retroativamente. |

### 3. Regra de exigência do PIN gerencial (alinhado ao ADR-039)
- **Status (`open` ↔ `blocked`) e Data de Abertura (`created_at`):** exigem perfil de gestão + motivo obrigatório; **exigem PIN** caso a data original ou a nova data caia em um dia com caixa fechado (`cash_closings.status = 'confirmed'`).
- **Data de Pagamento:** **exige PIN gerencial (`verify_audit_pin`) sempre**, e quando a data original ou a nova data atingir dia com `cash_closings.status = 'confirmed'`, marca `transactions.retroactive_adjustment = true` nas transações vinculadas.

### 4. Trilha de auditoria append-only (`public.comanda_admin_adjustments`)
- Tabela protegida por RLS tenant-scoped (`SELECT` apenas para gestão/superadmin do tenant; `INSERT` apenas via RPC `SECURITY DEFINER`; sem `UPDATE`/`DELETE`).
- Colunas principais:
  - `id` (UUID PK), `tenant_id` (UUID NOT NULL), `comanda_id` (UUID NOT NULL)
  - `operator_id` (UUID NOT NULL → `auth.uid()`), `reason` (TEXT NOT NULL)
  - `adjusted_fields` (TEXT[] NOT NULL — ex.: `{'status'}`, `{'created_at','payment_date'}`)
  - `before_snapshot` (JSONB NOT NULL), `after_snapshot` (JSONB NOT NULL)
  - `pin_authorized` (BOOLEAN NOT NULL DEFAULT false)
  - `retroactive_adjustment` (BOOLEAN NOT NULL DEFAULT false)
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### 5. Exposição na interface (UI)
- Disponibilizar botão **"Ajuste Gerencial Auditado"** apenas para perfis de gestão (`isManagerLikeRole`) no detalhe da comanda ([ComandaSidebar.tsx](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/components/ComandaSidebar.tsx)) em `/comandas`.
- Modal com pré-visualização dos valores atuais, campos editáveis conforme o status da comanda (bloqueando status em comandas pagas/canceladas), campo obrigatório de motivo e campo de PIN gerencial quando exigido pela regra acima.

---

## Alternatives Considered

1. **Permitir `UPDATE` direto via PostgREST para gerentes em `comandas`:** rejeitado — não garante atomicidade entre `comandas` e `transactions`, não impõe PIN nem motivo obrigatório, e quebra a trilha auditável imutável.
2. **Exigir PIN em todas as ações sem exceção (incluindo simples troca `blocked ↔ open`):** rejeitado pelo PO — burocratizaria desbloqueios rotineiros sem impacto em caixa fechado; manter o critério do ADR-039 equilibra segurança e agilidade operacional.
3. **Reabrir comanda paga diretamente por essa função:** rejeitado — violaria o [ADR-035](./ADR-035-appointment-comanda-sync-and-post-checkout-lock.md) e deixaria lançamentos órfãos em `transactions` e no ledger de comissões.

---

## Consequences

- **Positivas:** Centraliza ajustes administrativos sensíveis em um ponto único, atômico, tenant-scoped e auditado; mantém sincronia entre Comanda, Pagamentos, Fluxo de Caixa e Fechamento de Caixa; preserva intactos ADR-001, ADR-035, ADR-039 e D7/D8.
- **Cuidados:** Requer aprovação explícita deste ADR pelo PO antes da implementação da migration, RPC, wrapper TypeScript e modal no frontend, bem como validação em staging antes de qualquer promoção para produção.
