# ADR-039: Auditoria e Competência Retroativa com PIN de Gerente

**Status:** Proposed — decisão aprovada pelo PO; promoção para Accepted após certificação em produção

**Date:** 2026-11-05

**Deciders:** PO (Augusto) + OpenCode

**References:** ADR-001 (Commission vs Settlement), ADR-008 (Audit Strategy), ADR-012 (RPC EXECUTE grants), ADR-019 (Role Authorization), ADR-021 (RPC Tenant-Scoped Authorization), ADR-035 (Trava Pós-Checkout), frente `AUDIT-PIN-COMPETENCE`

---

## Context

O ADR-035 determina que uma comanda paga só pode ser alterada por estorno/reabertura auditada — nunca por edição silenciosa de valores. Esse contrato permanece válido e **não é alterado por este ADR**.

Na operação real, porém, surgiram duas necessidades que o fluxo de estorno existente não cobria:

1. **Competência do estorno.** `finance_reverse_transaction` sempre gravava a saída reversa em `now()`. Quando a baixa indevida aconteceu em outro dia, o estorno caía no caixa errado, distorcendo o fechamento do dia corrente e deixando o dia original com um valor que nunca existiu.
2. **Autorização verificável do gestor.** O estorno era protegido apenas por papel (`owner/admin/manager`). Não havia segundo fator que comprovasse que a pessoa que executa o estorno é de fato o gestor autorizado, nem registro de que essa autorização existiu.

A primeira tentativa de solução guardava o hash do PIN em `profiles.audit_pin`. Isso foi rejeitado: a policy de `SELECT` de `profiles` permite leitura por pares do mesmo tenant, o que exporia o hash a colegas de trabalho. Um PIN numérico de 6 a 8 dígitos, mesmo com bcrypt, é quebrável offline em tempo viável quando o atacante tem o hash em mãos.

---

## Problem

Como permitir a correção auditada de uma comanda paga, lançando o estorno na data de competência correta, sem:

- reintroduzir edição silenciosa de valores (violação do ADR-035);
- expor o hash do PIN gerencial a qualquer usuário autenticado;
- permitir que um cliente contorne o PIN chamando a RPC diretamente;
- alterar caixas já confirmados sem deixar rastro contábil explícito.

---

## Decision

### 1. ADR-035 permanece integralmente válido

Nenhum valor de comanda paga é alterado diretamente. A única via continua sendo **estornar a baixa** (`wrong_settlement`) e **reabrir** a comanda. O novo fluxo apenas acrescenta competência e autorização ao estorno existente.

### 2. Data de Competência do estorno

- A competência é uma **data de calendário** (`DATE`) no fuso do tenant (`tenant_settings.timezone`, default `America/Sao_Paulo`), não um instante.
- Ela define `transactions.date` do lançamento reverso e é registrada em `metadata.competence_date` tanto em `transactions` quanto em `financial_reversals`.
- Data futura é rejeitada no banco (`Data de competencia nao pode ser futura`).
- O modal de estorno usa **hoje** como padrão, preservando o comportamento anterior; a data original da baixa é exibida como referência e pode ser escolhida manualmente.
- O frontend converte a data local para ISO ao meio-dia local (`12:00`), evitando troca de dia em qualquer fuso ±12h.

### 3. PIN gerencial em `public.manager_pins`

```sql
public.manager_pins (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pin_hash   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
)
```

Controles de acesso:

- `ENABLE ROW LEVEL SECURITY` **sem nenhuma policy** — por definição, todo `SELECT`/`INSERT`/`UPDATE`/`DELETE` via PostgREST é negado.
- `REVOKE ALL` de `PUBLIC`, `anon` e `authenticated` — remove os default privileges do schema `public`.
- O hash é lido **somente** por `public.verify_audit_pin(p_user_id, p_tenant_id, p_pin)`, `SECURITY DEFINER`, sem `EXECUTE` para `anon`/`authenticated`.
- `public.validate_audit_pin(p_pin, p_tenant_id)` é a única RPC exposta ao `authenticated`; retorna apenas `{ valid, reason }` e valida que o chamador pertence ao tenant informado.

### 4. Enforcement no banco (R-02)

`finance_reverse_transaction` calcula a competência e verifica `cash_closings.status = 'confirmed'` **antes de qualquer escrita**. Se o dia estiver confirmado:

- `p_audit_pin` nulo → `RAISE EXCEPTION 'Ajuste retroativo em caixa fechado exige PIN de gerente'`;
- `p_audit_pin` inválido → `RAISE EXCEPTION 'PIN de autorizacao invalido'`;
- `p_audit_pin` válido → o lançamento é gravado com `transactions.retroactive_adjustment = true`, sufixo `(ajuste retroativo em caixa fechado)` na descrição e `pin_authorized = true` nos metadados.

A validação do PIN ocorre na mesma transação da escrita. Não existe caminho alternativo: chamar a RPC diretamente sem PIN em data confirmada falha.

### 5. Throttle, não lockout (R-03)

`validate_audit_pin` aplica `pg_sleep(0.25)` em falha de PIN. Lockout persistente (tabela de tentativas, janela, bloqueio temporal) fica registrado como evolução futura e **não** faz parte desta frente.

### 6. Sem provisionamento pela UI (R-04)

Não existe RPC `set_audit_pin` nem tela de cadastro nesta frente. O provisionamento é operacional, feito pelo PO diretamente no banco:

```sql
INSERT INTO public.manager_pins (user_id, tenant_id, pin_hash)
VALUES ('<user_uuid>', '<tenant_uuid>', crypt('<pin_de_6_a_8_digitos>', gen_salt('bf', 12)))
ON CONFLICT (user_id, tenant_id)
DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now();
```

O PIN em claro nunca é persistido nem retornado por API.

### 7. Auditoria reutiliza a infraestrutura existente

`audit_logs` e o trigger `audit_trigger_row_comandas` já cobrem `comandas`. Nenhuma tabela de auditoria paralela foi criada. A rastreabilidade do estorno vem de:

- `financial_reversals` (registro contábil da reversão);
- `transactions.metadata` (competência, tipo de motivo, flag retroativa, `pin_authorized`);
- `audit_logs` (trigger existente sobre `comandas`).

---

## Alternatives Considered

| Alternativa | Motivo da rejeição |
|---|---|
| Manter `profiles.audit_pin` | Policy de `SELECT` de `profiles` expõe o hash a pares do tenant; PIN curto + bcrypt vazado é quebrável offline. |
| Coluna `audit_pin` com RLS de coluna | Postgres não tem RLS por coluna; exigiria views/grants frágeis e difíceis de auditar. |
| Tabela `manager_pins` com policy de leitura para o próprio usuário | Mesmo o próprio usuário não precisa ler o hash; negar tudo é mais simples e mais seguro. |
| Exigir PIN em todos os fluxos de estorno | Quebraria Cashflow/Receipts/AccountsReceivable sem decisão de produto. O PIN é obrigatório onde há risco retroativo. |
| Bloquear estorno em caixa confirmado | Impede correção legítima de erro operacional; a decisão do PO foi permitir com PIN e marcação explícita. |
| Criar tabela de auditoria dedicada | Duplicaria `audit_logs`, violando a decisão de reutilizar a infraestrutura existente. |
| Lockout persistente já nesta frente | Aumenta escopo e superfície de mudança; o PO optou por manter apenas o throttle de 250 ms. |

---

## Consequences

**Positivas**

- Correção contábil no dia correto, sem distorcer o caixa corrente.
- Hash de PIN inacessível via API, inclusive para colegas do mesmo tenant.
- Enforcement do PIN no banco, não contornável por chamada direta à RPC.
- Ajuste retroativo em caixa fechado é permitido, mas sempre sinalizado e auditável.
- Nenhuma alteração no cálculo de comissão (`domain/commission/`) nem no core D8.

**Negativas / Cuidados**

- Provisionamento de PIN é manual até existir uma frente de autoatendimento.
- Sem lockout: um atacante com sessão autenticada pode tentar PINs com throttle de 250 ms por tentativa.
- Fluxos que não passam por Comandas continuam podendo estornar sem PIN quando a competência é hoje (decisão consciente de compatibilidade).
- `manager_pins` é negada por completo à API: qualquer funcionalidade futura de "meu PIN" exigirá RPC dedicada.

---

## Invariantes

1. Comanda paga só muda via estorno/reabertura (ADR-035).
2. `manager_pins.pin_hash` nunca é retornado por API.
3. Competência em caixa `confirmed` exige PIN válido, sempre.
4. `retroactive_adjustment = true` é obrigatório quando a competência cai em caixa confirmado.
5. Nenhuma tabela de auditoria paralela a `audit_logs`.
6. Toda operação permanece isolada por `tenant_id`.

---

## Rollout

- Migration `supabase/migrations/20261105120000_add_audit_pin_and_retroactive_adjustment.sql`.
- **Aplicada apenas em staging** em 2026-11-05, sob autorização do PO.
- **Produção: não aplicada.** Promoção exige novo gate e autorização explícita (`MERGE ≠ DEPLOY PROD`, ADR-026).
- Rollback: `DROP FUNCTION` das três funções novas, `DROP TABLE public.manager_pins`, `DROP COLUMN transactions.retroactive_adjustment` e restauração da assinatura anterior de `finance_reverse_transaction` (`20260515210804_finance_reverse_transaction_rpc.sql`).

---

## GAPs conhecidos

| ID | GAP | Encaminhamento |
|---|---|---|
| G-01 | Sem lockout persistente de tentativas de PIN | Frente futura, fora deste escopo (decisão do PO). |
| G-02 | Sem tela/RPC de provisionamento de PIN | Operação manual pelo PO até nova frente. |
| G-03 | E2E real depende de credenciais de staging | Validado manualmente pelo PO no gate. |
| G-04 | Fluxos fora de Comandas não enviam PIN | Mantido por compatibilidade; PIN obrigatório apenas em competência retroativa. |
