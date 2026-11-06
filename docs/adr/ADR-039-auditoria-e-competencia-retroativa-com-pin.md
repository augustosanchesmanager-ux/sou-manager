# ADR-039: Auditoria e Competência Retroativa com PIN de Gerente

**Status:** Proposed — decisão aprovada pelo PO; promoção para Accepted após certificação em produção

**Date:** 2026-11-05

**Revisão:** 2026-11-05 — R-04 revisado pelo PO: o PIN passa a ser cadastrado e trocado pelo próprio gestor em Configurações (seção **PIN Gerencial**).

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

### 6. Autoatendimento do PIN em Configurações (R-04 revisado)

O PO revisou o R-04 em 2026-11-05: o gestor cadastra e troca o próprio PIN em **Configurações → PIN Gerencial**, sem depender de SQL manual. O provisionamento pelo PO continua possível apenas como reset operacional.

RPCs da migration `20261105190000_add_audit_pin_management.sql`:

| RPC | Acesso | Contrato |
|---|---|---|
| `can_manage_audit_pin(user_id, tenant_id)` | interna | Helper `SECURITY DEFINER` sem `EXECUTE` para `anon`/`authenticated`. Espelha a autorização de `finance_reverse_transaction` (perfil, staff ou vínculo em `user_tenants`). |
| `get_audit_pin_status(tenant_id)` | `authenticated` | Retorna somente `{ configured, updated_at }` do próprio `auth.uid()`. Nunca lê nem devolve `pin_hash`. |
| `set_audit_pin(tenant_id, new_pin, current_pin)` | `authenticated` | Grava o PIN do próprio `auth.uid()`. Não aceita `p_user_id`. Exige `current_pin` quando já existe PIN. Hash bcrypt com custo 12. |

Regras de operação:

- PIN novo precisa casar com `^[0-9]{6,8}$`; o frontend normaliza para dígitos antes de enviar.
- Quando já existe PIN, o PIN atual é obrigatório e verificado na mesma transação; erro aplica `pg_sleep(0.25)`.
- `manager_pins` permanece **deny-all** para a API: a tabela continua sem policy e sem `GRANT` para `anon`/`authenticated`.
- O alvo é sempre `auth.uid()`: um gestor não consegue sobrescrever o PIN de outro usuário.
- A auditoria é gravada pela própria RPC em `audit_logs` (`table_name = 'manager_pins'`, `action = INSERT` na criação e `UPDATE` na troca), com apenas `{ configured, changed_by_user_id }`. O trigger genérico **não** é anexado a `manager_pins`, porque `to_jsonb(NEW)` gravaria o `pin_hash`.
- O PIN em claro nunca é persistido, retornado por API ou exibido após o salvamento.

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
| Provisionamento manual do PIN pelo PO (R-04 original) | Atrito operacional alto: todo gestor dependia de SQL para reabrir comanda. O PO revisou para autoatendimento em Configurações em 2026-11-05. |

---

## Consequences

**Positivas**

- Correção contábil no dia correto, sem distorcer o caixa corrente.
- Hash de PIN inacessível via API, inclusive para colegas do mesmo tenant.
- Gestor cadastra e troca o próprio PIN em Configurações, sem depender de SQL manual.
- Enforcement do PIN no banco, não contornável por chamada direta à RPC.
- Ajuste retroativo em caixa fechado é permitido, mas sempre sinalizado e auditável.
- Nenhuma alteração no cálculo de comissão (`domain/commission/`) nem no core D8.

**Negativas / Cuidados**

- Sem recuperação de PIN esquecido na UI: o reset continua operacional, feito pelo PO no banco.
- Sem lockout: um atacante com sessão autenticada pode tentar PINs com throttle de 250 ms por tentativa.
- Fluxos que não passam por Comandas continuam podendo estornar sem PIN quando a competência é hoje (decisão consciente de compatibilidade).
- `manager_pins` permanece negada por completo à API: toda leitura/escrita passa exclusivamente pelas RPCs `get_audit_pin_status` e `set_audit_pin`.

---

## Invariantes

1. Comanda paga só muda via estorno/reabertura (ADR-035).
2. `manager_pins.pin_hash` nunca é retornado por API.
3. Competência em caixa `confirmed` exige PIN válido, sempre.
4. `retroactive_adjustment = true` é obrigatório quando a competência cai em caixa confirmado.
5. Nenhuma tabela de auditoria paralela a `audit_logs`.
6. Toda operação permanece isolada por `tenant_id`.
7. O gestor só altera o próprio PIN: `set_audit_pin` não aceita `p_user_id`.

---

## Rollout

- Migration `supabase/migrations/20261105120000_add_audit_pin_and_retroactive_adjustment.sql` (competência e enforcement do PIN).
- Migration `supabase/migrations/20261105190000_add_audit_pin_management.sql` (autoatendimento do PIN em Configurações).
- **Aplicadas apenas em staging** em 2026-11-05, sob autorização do PO.
- **Produção: não aplicadas.** Promoção exige novo gate e autorização explícita (`MERGE ≠ DEPLOY PROD`, ADR-026).
- Rollback: `DROP FUNCTION` das RPCs novas (`can_manage_audit_pin`, `get_audit_pin_status`, `set_audit_pin`, `validate_audit_pin`, `verify_audit_pin`), `DROP TABLE public.manager_pins`, `DROP COLUMN transactions.retroactive_adjustment` e restauração da assinatura anterior de `finance_reverse_transaction` (`20260515210804_finance_reverse_transaction_rpc.sql`).

---

## GAPs conhecidos

| ID | GAP | Encaminhamento |
|---|---|---|
| G-01 | Sem lockout persistente de tentativas de PIN | Frente futura, fora deste escopo (decisão do PO). |
| G-02 | Sem recuperação de PIN esquecido na UI | Reset operacional pelo PO no banco (decisão de escopo). O autoatendimento cobre cadastro e troca. |
| G-03 | E2E real depende de credenciais de staging | Validado manualmente pelo PO no gate. |
| G-04 | Fluxos fora de Comandas não enviam PIN | Mantido por compatibilidade; PIN obrigatório apenas em competência retroativa. |
