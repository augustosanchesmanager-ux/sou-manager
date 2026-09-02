# G1 — Schema Design: M1-M3 (implementadas — A1 aprovado)

**Title:** G1 — M1 (attended_at), M2 (payment_type), M3 (comanda_payments)
**Status:** ✅ **A1 APROVADO (PO, 29/08/2026)** — migrations criadas e validadas em ambiente descartável
**Gates:** G0 ✅ → G1 ✅ (A1) → **implementação M1-M3 FEITA** → validação ✅ → commit/push → **deploy exige A7 (PO)**
**Baseado em:** ADR-017/018/019/020 · `DESIGN_DOMINIO_FINANCEIRO_ATENDIMENTO.md` · DDLs reais do repositório
**Regra:** M4 é ISOLADA (G1.1/A2 — **pendente**). Este documento cobre **somente M1, M2 e M3**.

---

## 1. Fatos verificados do schema atual (evidência read-only)

### 1.1 `public.appointments` — criada em `20260219183612_create_initial_schema.sql`

```sql
CREATE TABLE public.appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id  UUID REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  service_name TEXT DEFAULT '',
  staff_name  TEXT DEFAULT '',
  start_time  TIMESTAMPTZ NOT NULL,
  duration    NUMERIC(3,1) NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('confirmed','pending','completed','cancelled')),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

- RLS habilitada; policies `tenant_isolation_appointments` (SELECT) e `tenant_isolation_appointments_insert` (INSERT) criadas/refeitas em `20260227223434`.
- **`attended_at` não existe** (confirmado por busca em todo `supabase/migrations/`).
- **Não há coluna de classe de evidência** (`attended_at_source`).

### 1.2 `public.comandas` — CHECK de status em `20260425000000_add_blocked_status_to_comandas.sql`

```sql
ALTER TABLE public.comandas ADD CONSTRAINT comandas_status_check
  CHECK (status IN ('blocked', 'open', 'paid', 'cancelled'));
```

- Colunas financeiras alinhadas em `20260602030500_align_comandas_financial_columns.sql`: `payment_method`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `closed_at`, `closure_mode`, `financial_effect`, `membership_credit_effect`, `closure_note`.
- Inserção de comanda `blocked` para agendamento futuro em `20260506214059` (`v_comanda_status := 'blocked'`, linha 162).

### 1.3 `public.transactions` — criada em `20260510000000_create_transactions_table.sql`

```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, user_id UUID,
  type TEXT NOT NULL, category TEXT NOT NULL, amount NUMERIC NOT NULL,
  description TEXT, payment_method TEXT,
  date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  status TEXT DEFAULT 'completed', created_at, updated_at,
  method VARCHAR, notes TEXT, due_day INTEGER,
  source_type TEXT, source_id UUID,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);
```

- **Padrão de idempotência existente:** `CREATE UNIQUE INDEX idx_transactions_tenant_idempotency_key ON (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;` — **M3 seguirá este mesmo padrão.**

### 1.4 Helpers de RLS multi-tenant (padrão v2)

- `current_tenant_id_from_auth_uid()` — SECURITY DEFINER.
- `current_is_super_admin_from_auth_uid()` — SECURITY DEFINER, usado como bypass em `20260723000000_security_fix_rls_critical.sql`.
- **O padrão v2 de policy:** `USING (current_is_super_admin_from_auth_uid() OR tenant_id = current_tenant_id_from_auth_uid())`.

### 1.5 Confirmações diretas

| Checagem | Resultado |
|---|---|
| `attended_at` em migrações | **não existe** |
| `comanda_payments` em migrações | **não existe** |
| ENUM de `payment_type` | **não existe** (métodos via `transactions.payment_method` TEXT) |
| Tipo de `start_time` | TIMESTAMPTZ NOT NULL |
| CHECK de `comandas.status` | `('blocked','open','paid','cancelled')` |

---

## 2. Proposta M1 — `attended_at` + `attended_at_source` (ADR-020)

### Objetivo

Âncora canônica de "quando o atendimento efetivamente ocorreu" — **separada de `paid_at`/`scheduled_at`**.

### DDL implementado — `supabase/migrations/20260829000000_attended_at.sql`

```sql
-- M1: attended_at (20260830000000_attended_at.sql) — ADITIVA
BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS attended_at_source TEXT NULL;

COMMENT ON COLUMN public.appointments.attended_at IS
  'Timestamp do atendimento efetivamente realizado. Preenchido somente por RPC operacional autorizada (ADR-020 D-1). Nunca pela settle.';
COMMENT ON COLUMN public.appointments.attended_at_source IS
  'Classe de evidência: NULL=fluxo real; backfill_evidence=prova real; inferred_from_payment=derivado marcado (somente com revisão humana).';
COMMENT ON CONSTRAINT appointments_status_check ON public.appointments IS
  'status operacional inalterado por esta evolução (ADR-017).';

NOTIFY pgrst, 'reload schema';
COMMIT;
```

### Verificação de aditividade — ✅ ADITIVA

| Critério | Resultado |
|---|---|
| `ALTER ... ADD COLUMN` em tabela existente | sim, `IF NOT EXISTS`, sem reescrita de dados |
| DML em linhas existentes | **nenhum** |
| Alteração de constraints existentes | **nenhuma** (apenas COMMENT) |
| Impacto em código TS atual | nenhum (colunas novas nullable, leituras não quebram) |
| RLS | sem policy nova aqui (o preenchimento é via RPC — M5/G2; RLS de UPDATE tratada no F7) |

### Rollback M1

`ALTER TABLE public.appointments DROP COLUMN IF EXISTS attended_at_source; DROP COLUMN IF EXISTS attended_at;` — reversível sem perda (coloNULL, sem dados).

---

## 3. Proposta M2 — ENUM `payment_type` (ADR-018 D-1)

### Objetivo

Tipo imutável e persistente para classificar o pagamento (antecipado/na data/posterior/parcial/final) — **nunca derivado por datas**.

### DDL implementado — `supabase/migrations/20260829010000_payment_type_enum.sql`

```sql
-- M2: payment_type enum (20260829010000_payment_type_enum.sql) — ADITIVA
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE public.payment_type AS ENUM
      ('anticipado', 'no_atendimento', 'posterior', 'parcial', 'final');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
```

### Verificação de aditividade — ✅ ADITIVA

| Critério | Resultado |
|---|---|
| Novo tipo | sim — nenhum uso existente |
| Tabelas existentes | intocadas (coluna `payment_type` entra na M3) |
| DML | nenhum |
| Compatibilidade | completa (código atual não conhece o tipo) |

### Rollback M2

`DROP TYPE IF EXISTS public.payment_type;` — seguro enquanto nenhuma tabela o referencie (M3 ainda não aplicada ou ambas revertidas em ordem).

---

## 4. Proposta M3 — tabela `comanda_payments` (ADR-018 D-2)

### Objetivo

Modelo explícito e auditável de pagamentos por comanda, seguindo o padrão v2 de RLS e o padrão de idempotência de `transactions`.

### DDL implementado — `supabase/migrations/20260829020000_comanda_payments.sql`

```sql
-- M3: comanda_payments (20260829020000_comanda_payments.sql) — ADITIVA
BEGIN;

CREATE TABLE IF NOT EXISTS public.comanda_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  comanda_id      UUID NOT NULL REFERENCES public.comandas(id),
  payment_type    public.payment_type NOT NULL,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT,
  actor_id        UUID REFERENCES auth.users(id),
  motivo          TEXT,
  reversed_at     TIMESTAMPTZ NULL,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes previstos por consulta (G1 critério 5)
CREATE INDEX IF NOT EXISTS idx_comanda_payments_comanda
  ON public.comanda_payments(comanda_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comanda_payments_tenant
  ON public.comanda_payments(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comanda_payments_tenant_idem
  ON public.comanda_payments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;   -- mesmo padrão de transactions

ALTER TABLE public.comanda_payments ENABLE ROW LEVEL SECURITY;

-- Políticas padrão v2 (superadmin bypass + tenant isolation)
CREATE POLICY "comanda_payments_select_v2" ON public.comanda_payments
  FOR SELECT USING (
    current_is_super_admin_from_auth_uid()
    OR tenant_id = current_tenant_id_from_auth_uid()
  );

CREATE POLICY "comanda_payments_insert_v2" ON public.comanda_payments
  FOR INSERT WITH CHECK (
    current_is_super_admin_from_auth_uid()
    OR tenant_id = current_tenant_id_from_auth_uid()
  );

-- Sem UPDATE geral; reversão via RPC marca reversed_at (authorization em G2).
-- Sem DELETE policy (append-only) — auditoria.

NOTIFY pgrst, 'reload schema';
COMMIT;
```

### Verificação de aditividade — ✅ ADITIVA (nova tabela)

| Critério | Resultado |
|---|---|
| Tabela nova | sim — não toca tabelas existentes |
| DML em dados existentes | nenhum |
| FK para `comandas`/`tenants` | referências existentes (relaciona, não altera) |
| Enum `payment_type` | depende de M2 (ordem: M1 → M2 → M3) |
| RLS | políticas **nova tabela** — sem tocar policies existentes |
| Idempotência | `UNIQUE(tenant_id, idempotency_key)` parcial — igual a `transactions` |

### Dependências (G1 critério 4)

- **M3 depende de M2** (`payment_type`). Ordem segura: **M1 → M2 → M3**.
- Nenhuma dependência de código TS até o G2 (RPCs de pagamento).
- `public.tenants(id)` confirmado existente (FK multi-tenant padrão).

### Rollback M3

`DROP TABLE IF EXISTS public.comanda_payments;` — reversível (sem dados no momento da reversão na Fase 1). Se já houver pagamentos novos, DML dirigido antes do DROP (restrito ao período da feature).

---

## 5. Análise de impacto (G1 critérios 3 e 9)

| Componente | Impacto de M1-M3 |
|---|---|
| `pages/AccountsReceivable.tsx` | **nenhum** (colunas/tabela novas não alteram queries atuais; F8 muda a UI depois) |
| `pages/Comandas.tsx` / `Checkout.tsx` | nenhum (sem tocar RLS/policies existentes) |
| `application/commission.ts` (`commission.ts:242`) | nenhum nesta fase — ajuste de elegibilidade é F4/G2, **não** M1-M3 |
| `finance_settle_comanda` | **intocada** (M4 é separada — G1.1/A2) |
| `status` de comandas/appointments | intocados |
| Relatórios existentes | nenhuma alteração de fonte (tabelas novas ainda vazias na Fase 1) |

**Conclusão:** nenhuma incompatibilidade conhecida com código atual. As colunas são nullable e a tabela é nova — nenhuma query existente é afetada.

## 6. Validações executadas (evidências)

### 6.1 Validações read-only (fase de design)

1. Grep em `supabase/migrations/` por `attended_at|comanda_payments` → **0 resultados** (ausência confirmada).
2. Leitura DDL real de `appointments` (20260219183612), `comandas` (20260219230006 + 20260425000000 + 20260602030500), `transactions` (20260510000000).
3. Verificação do padrão v2 de RLS em `20260723000000_security_fix_rls_critical.sql` (`current_tenant_id_from_auth_uid`/`current_is_super_admin_from_auth_uid`).
4. Padrão de idempotência replicado de `idx_transactions_tenant_idempotency_key`.

### 6.2 Validação de aplicação (pós-A1, ambiente descartável)

Validade em **Postgres 16 descartável (Docker)** com stubs mínimos (`auth.uid`, `tenants`, `comandas`, helpers v2):

| Verificação | Resultado |
|---|---|
| M1 aplicada | ✅ `ALTER TABLE` + comments + `NOTIFY` OK |
| M2 aplicada | ✅ `CREATE TYPE` OK — 5 labels (`anticipado`,`no_atendimento`,`posterior`,`parcial`,`final`) |
| M3 aplicada | ✅ tabela + 3 índices + UNIQUE parcial + 2 policies v2 OK |
| M1 idempotente (re-aplicação) | ✅ `IF NOT EXISTS` — NOTICE de "already exists, skipping" |
| M2 idempotente | ✅ guard `pg_type` |
| M3 idempotente | ✅ `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` antes de `CREATE POLICY` |
| `amount > 0` CHECK | ✅ aprovado em INSERT com valor válido |
| UNIQUE `(tenant_id, idempotency_key)` | ✅ 2º INSERT com `key-1` rejeitado (duplicate key) |
| RLS v2 isolamento | ✅ role `authenticated` **sem** tenant: INSERT fora do tenant rejeitado (`new row violates row-level security policy`) |
| Sem policy de DELETE/UPDATE | ✅ apenas `select_v2` + `insert_v2` (append-only) — histórico de reversão preservado |
| Estrutura final | ✅ `appointments.attended_at`/`attended_at_source` NULL; `comanda_payments` com FKs para `tenants`/`comandas`/`auth.users` |

**Conclusão da validação:** DDL aplica e re-aplica sem erro; constraints e RLS comportam-se conforme o desenho G1. Nenhuma tabela existente foi alterada além do `ADD COLUMN` aditivo de M1. Container descartável removido ao final.

---

## 7. Status de implementação

| Migration | Arquivo | Status |
|---|---|---|
| M1 — `attended_at` | `supabase/migrations/20260829000000_attended_at.sql` | ✅ criada + validada |
| M2 — `payment_type` | `supabase/migrations/20260829010000_payment_type_enum.sql` | ✅ criada + validada |
| M3 — `comanda_payments` | `supabase/migrations/20260829020000_comanda_payments.sql` | ✅ criada + validada |
| M4 — fix `finance_settle_comanda` | — | ⛔ **NÃO autorizada (A2 pendente — G1.1)** |
| M5-M8 | — | ⛔ fora do A1 (G2/segurança) |

**Aplicação em produção:** NÃO executada — exige **A7** (deploy/migrations no banco remoto, decisão do PO). **Backfill:** NÃO executado — exige **A4** (política dirigida por lotes).