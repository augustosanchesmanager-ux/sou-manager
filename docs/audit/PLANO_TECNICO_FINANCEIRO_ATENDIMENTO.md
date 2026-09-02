# Plano Técnico — Evolução Financeira, Atendimento e Pagamentos

**Status:** G1 ✅ (A1 aprovado — M1-M3 implementadas e validadas) · M4 **pendente (A2)** · deploy **pendente (A7)**
**ADRs:** 017, 018, 019, 020 · **Modelo:** `DESIGN_DOMINIO_FINANCEIRO_ATENDIMENTO.md`
**Gates:** G0 ✅ (domínio) → G1 ✅ (M1-M3 implementadas) → **G1.1 (M4 isolada — pendente)** → G2 (RPC/backend) → G3 (RLS) → G4-G10 (testes/build/deploy)

---

## 0. Matriz de aprovação de migrations (OBRIGATÓRIA)

> **G1 = revisão/design de schema (M1-M3). NÃO significa autorização para executar migrations.**
> **M4 é separada e exigirá A2.** Aprovar A1 (M1-M3) **não** autoriza M4 automaticamente.

| Migration | DDL | DML | Produção | Rollback | Aprovação |
|---|---|---|---|---|---|
| M1 | Sim (aditiva) | Não/limitado | baixo | reversível | A1 |
| M2 | Sim (aditiva) | Não/limitado | baixo | reversível | A1 |
| M3 | Sim (aditiva) | Não/limitado | baixo | reversível | A1 |
| M4 | Sim/RPC | Sim/semântica | **alto** | específico | **A2** |
| M5 | Sim (RPC) | Não | médio | revogável (grants) | G2 |
| M6 | Sim (RPC) | Não | médio | revogável (grants) | G2 |
| M7 | Sim (RPC) | Não | médio | revogável (grants) | G2 |
| M8 | Sim (fix) | Não | alto | específico | A2 (grupo segurança) |

**Regra:** M1-M3 e M4 **nunca** são executadas no mesmo ciclo. M4 tem validação própria (A2 + regressão checkout/financeiro).

---

## 1. Plano de Migrations (G1 — implementado M1-M3; M4-M8 pendentes)

**Ordem proposta** (aditiva, sem alterar tabelas existentes sem necessidade):

| # | Migration (arquivo real) | Conteúdo | Status |
|---|---|---|---|
| M1 | `20260829000000_attended_at.sql` | `ALTER TABLE appointments ADD COLUMN attended_at timestamptz NULL, ADD COLUMN attended_at_source text NULL` | ✅ implementada/validada [ADR-020] |
| M2 | `20260829010000_payment_type_enum.sql` | `CREATE TYPE payment_type AS ENUM ('anticipado','no_atendimento','posterior','parcial','final')` | ✅ implementada/validada [ADR-018] |
| M3 | `20260829020000_comanda_payments.sql` | `CREATE TABLE comanda_payments` (+ FK comanda, tenant; UNIQUE(tenant_id, idempotency_key); RLS on; políticas padrão v2, append-only) | ✅ implementada/validada [ADR-018 D-2] |
| M4 | `20260830030000_fix_settle_comanda_semantics.sql` | Remover/mudar marcação de `completed` na `finance_settle_comanda` (deixar de marcar atendimento no pagamento) | ⛔ **A2 pendente (G1.1)** [ADR-017 D-3] |
| M5 | `20260830040000_atendimento_rpc.sql` | RPC `register_attendance` (evento operacional) | G2 |
| M6 | `20260830050000_payment_rpcs.sql` | RPCs de pagamento/estorno (com `payment_type`) | G2 |
| M7 | `20260830060000_desbloqueio_auditado_rpc.sql` | RPC de desbloqueio de comanda com motivo | G2 |
| M8 | `20260830070000_seguranca_rpc_fixes.sql` | Fix de `approve_access_request()` (auth.uid()) + `close_order()` (deprecate) + `bulk_close_comandas_admin` (auth) | A2 (grupo segurança) |

**Regras:**
- Cada migration isolada e idempotente (`CREATE OR REPLACE`/`ADD COLUMN IF NOT EXISTS`).
- Aplicadas via Supabase CLI após aprovação do PO (nenhuma executada nesta etapa).
- M4 exige revisão cuidadosa da `finance_settle_comanda` atual (20260514000001:90-108) para não quebrar fluxo legado.

## 2. Plano de RPCs (G2)

| RPC | Operação | Autorização | Idempotência | Evento |
|---|---|---|---|---|
| `register_attendance(appointment_id)` | define `attended_at`, vira elegibilidade | gestão/barber do próprio [ADR-019] | sim | `AttendanceCompleted` |
| `register_payment(comanda_id, payment_type, amount, method, idempotency_key)` | insere `comanda_payments` | por papel+escopo [ADR-019 D-1/D-2] | `UNIQUE(tenant,idempotency_key)` [I10] | `PaymentRegistered` |
| `reverse_payment(payment_id, motivo)` | marca `reversed_at` — nunca DELETE | gestão | sim | `PaymentReversed` |
| `unlock_comanda(comanda_id, motivo)` | blocked→open | gestão/recepção com motivo | sim | `ComandaUnlocked` |
| `register_attendance_backfill(appointment_id, attended_at, source)` | backfill dirigido | **superadmin somente** | sim | `AttendanceCompleted` (marcado) |

**Regras transversais:**
- Todas com `tenant_id` explícito + RLS (funções `current_tenant_id_from_auth_uid()`).
- `SECURITY DEFINER` confirmado + `search_path` fixo; grants seguem ADR-012.
- Validação de `payment_type` na origem (nunca derivado por data).
- `payment.amount ≤ balance` validado em transação.

## 3. Plano de RLS (G3)

| Tabela | Política | Nota |
|---|---|---|
| `comanda_payments` (nova) | INSERT por operador autorizado do tenant; SELECT por membros do tenant; UPDATE **apenas** `reversed_at` (por RPC de estorno); DELETE: nenhum policy | padrão v2 + superadmin bypass [ADR-018] |
| `appointments` | UPDATE em `attended_at`/source via RPC (RLS permite o UPDATE para o papel autorizado); F9 pendente (política atual de appointments é gap conhecido da auditoria) | P1 |
| `comandas` | desbloqueio via RPC; policies existentes mantidas; conferir `tenant_id` em todas | |

**Checklist G3:** auditar todas as policies de `comanda_payments` no molde `20260723000000_security_fix_rls_critical.sql`; nenhuma policy sem `using` com tenant; superadmin bypass em todas as novas.

## 3.1 Gate G1 formal (critérios de saída — revisão/design, não execução)

> **G1 NÃO é permissão para implementar M1-M8.** A autorização é granular: A1 cobre M1-M3; A2 cobre M4 (isolada). O G1 é **revisão de schema design** com evidência read-only.

Checklist obrigatório antes de qualquer aplicação:

1. Revisão DDL completa de M1-M3 (proposta documentada — `G1_SCHEMA_DESIGN_M1-M3.md`);
2. Confirmação de que M1-M3 são **realmente aditivas** (sem `ALTER` destrutivo, sem DML em massa);
3. Análise de **impacto em produção** (tabelas envolvidas, dependências de código e RPCs existentes);
4. Mapeamento de **dependências** (FKs, schemas, `search_path`, gaps de colunas);
5. **Índices** necessários por query prevista;
6. **Constraints** (CHECK/UNIQUE) e como interagem com as existentes;
7. **RLS** proposta (padrão v2, superadmin bypass, sem políticas abertas);
8. **Rollback** de cada migration (reversível / específico);
9. **Compatibilidade** com o código atual (TypeScript, RPCs, UI);
10. **Estratégia de deploy** (ordem, janela, verificação pós-migração).

### 3.2 Gate G1.1 (revisão isolada da M4)

- M4 (`finance_settle_comanda` corrigir marcação `completed`) **nunca** avança junto com M1-M3.
- Exige: revisão específica, testes de regressão financeiro/checkout/comissão/contas a receber, análise de eventos e saldo, rollback específico.
- Aprovação: **A2** (separada de A1).

### 3.3 Zonas vermelhas (tratamento especial em G1/G2)

1. **M4** — mudança semântica da settle com impacto cascata (checkout, relatórios, comissão, AR, eventos, saldo). Validação própria.
2. **Backfill** — jamais `UPDATE appointments SET attended_at = ...` massivo; origem classificável (`attended_at_source`); não preencher histórico sem evidência.
3. **Eventos** — antes de publicar `AttendanceCompleted`/`PaymentRegistered`: mapear event→subscriber→efeito→idempotência→outbox→retry/replay.
4. **RLS de appointments (F9/A6)** — gap **pré-existente**; tratar como **alteração de segurança independente** com escopo/testes próprios, não "aproveitar para arrumar tudo".
5. **Autorização granular** — nenhum fluxo confia em "frontend esconde botão"; backend/RPC/RLS são a autoridade (ADR-019).

## 4. Matriz de Testes (F9)

| Nível | Caso | Cobre |
|---|---|---|
| Unit | `net_total/paid/balance` derivados; `payment_type` imutável | § invariantes F1-F8 |
| Unit | elegibilidade comissão só com `attended_at` | ADR-017 D-4 |
| Integration | RPC `register_attendance` valida papel + idempotência | ADR-019/020 |
| Integration | RPC `register_payment` C/D/A/B + estorno parcial (reversed_at) | ADR-018 |
| Concurrency | 2 pagamentos simultâneos, 2 baixas, pagamento+estorno (harness estilo `tests/d8/harness`) | I8/I9/I10 |
| E2E | Cenários A-D de ponta a ponta (fixtures Playwright) | Plano seção 31 |
| E2E | Permissões: recepção só antecipado integral; barber não baixa | ADR-019 |
| RLS | Cross-tenant isolation `comanda_payments` | checklist G3 |
| Regressão | fluxo atual de baixa A/B intacto após M4 | compatibilidade §30 |

**Gates: G4 unit → G5 integration/RLS → G6 E2E → G7 build → G8 preview → G9 smoke.**

## 5. Estratégia de Rollout e Backfill (F10/etapa pós-G10)

> Ordem segura (aprovada pelo PO em 29/08/2026): **nunca M1-M8 de uma vez.**

```text
ETAPA 3 ✅ → G0 FECHADO ✅ → A1 (aprovação M1-M3)
  → G1 (schema design — revisão) → implementação M1-M3 → validação estrutural → testes → G1 aprovado
  → A2 (aprovação específica M4) → M4 → testes de regressão financeiro/checkout
  → G2 (RPC + autorização) → ... → G10 (produção)
```

Fases:

1. **Fase 0:** reconhecer schema atual (`supabase db diff`) — F5 P0.
2. **Fase 1:** migrations M1-M3 (aditivas — attended_at, enum, comanda_payments) — **após A1**; sem impacto no fluxo atual; validação estrutural + testes antes de seguir.
3. **Fase 2 (G1.1):** M4 (fix settle) **isolada** — **após A2**; regressão financeiro/checkout em paralelo.
4. **Fase 3:** M5-M7 (RPCs novas) **atrás de feature flag/env consistency**, sem expor na UI ainda.
5. **Fase 4:** F8 UX (Contas a Receber com saldo, pagamento antecipado habilitado a papéis).
6. **Backfill (ADR-020 D-3):** campanha manual dirigida, por lote, com `attended_at_source`; `NULL` por padrão; **nunca** derivado de `paid_at` em massa.

**Rollback:** M1-M3 reversíveis (DROP de coluna/tabela/enum, sem dados). M4 tem rollback específico (restore do corpo da função anterior, mantido em git). RPCs novas revogáveis (grants) sem tocar em tabelas.

## 6. Pontos que exigem aprovação manual do PO antes de tocar no banco

| # | Ponto | Quando |
|---|---|---|
| A1 | Aprovar migrations **M1-M3** (G1 schema design — revisão, não execução) | antes de rodar M1-M3 |
| A2 | Aprovar a **correção semântica da `finance_settle_comanda` (M4)** — revisão ISOLADA, regressão checkout/financeiro | antes da M4 (gate G1.1) |
| A3 | Aprovar implementação do escopo estrito da recepção (DP11 regra) nas RPCs | antes da G2 |
| A4 | Aprovar política de backfill dirigido (lotes, quem, `attended_at_source`) | antes do F10 backfill |
| A5 | Aprovar extensão de eventos (AttendanceCompleted etc.) + mapeamento event→subscriber→outbox | antes da F2 |
| A6 | Aprovar F9 (política RLS de appointments) — alteração de segurança **independente**, escopo próprio | antes da F7 |
| A7 | Deploy em produção + aplicação de migrations no banco remoto | sempre exigência PO |
| A8 | Merge para `main`/`develop` | sempre exigência PO |

> **Importante:** aprovação A1 **não** implica autorização de M4; aprovação do G0 **não** implica autorização de migrations. Gates são independentes.

## 6.1 Auditoria futura (pós-implementação) — "Pagamento ≠ Atendimento ≠ Comissão"

Após a implementação, auditoria específica para provar que **nenhum** relatório/comissão faz implicitamente:

```text
paid_at != null  ↓  serviço realizado
```

Escopo da auditoria futura:

- Provar que `paid_at`/saldo nunca alimenta elegibilidade de comissão sem `attended_at` real ou derivado marcado (ADR-017 D-4 / ADR-020).
- Inventariar relatórios (dashboard, comissão, Contas a Receber, cash closing) verificando a fonte de "serviço realizado".
- Incluir teste automatizado de regressão de fronteira: comanda paga antecipada → sem atendimento → sem comissão.

## 7. Ordem G0→G10 com dependências

```
G0 domínio ✅ → G1 schema (M1-M3, revisão/design) → G1.1 M4 (ISOLADA, A2)
  → F0 reconciliação → F1 segurança (M8) → F2 atendimento (M5)
  → F3 desbloqueio (M7) → F4 comissão (ajuste elegibilidade)
  → F5 pagamentos (M2/M3/M6) → F6 audit → F7 RLS → F8 UX → F9 testes → F10 deploy (aprovado)
```

**Aprovações:** A1 (M1-M3) libera só o G1; M4 exige **A2** (gate G1.1) com regressão checkout/financeiro/comissão. **Nenhuma dessas etapas foi executada nesta sessão.** Todo o conteúdo acima é planejamento documentado.