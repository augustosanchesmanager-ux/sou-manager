# Plano de Implantação — Sprint 1 (v1.0 RC → v1.0)

> **Data:** 2026-07-28
> **Projeto:** sou-manager (`ushsnmlbeurfvlkieiln`)
> **Produto:** SMG Barber
> **Tenant em produção:** Sanchez Barber
> **Plano:** Supabase Free (sem PITR)
> **Status:** ⛔ BLOQUEADO — 2 correções necessárias antes da execução

---

## 1. Validação Individual das 10 Migrações Pendentes

### 🔷 MIG #1 — `20260717010000_extend_cash_closings_operational_fields`

**O que altera:**
- `ALTER TABLE cash_closings ADD COLUMN` (8 colunas): `opening_time`, `closing_time`, `ip_address`, `user_agent`, `total_sangrias`, `total_suprimentos`, `barber_closings_count`, `barber_closings_complete`
- `UPDATE cash_closings SET notes = COALESCE(notes, '')` — normaliza notes vazios
- `CREATE INDEX CONCURRENTLY idx_cash_closings_tenant_date_status`
- `COMMENT ON TABLE` + `COMMENT ON COLUMN` (6 comentários)

**Afetados:**
- Tabelas: `cash_closings`
- Índices: `idx_cash_closings_tenant_date_status`
- Nenhuma função, policy ou trigger alterada

**Já aplicada em produção?** ✅ SIM — todas as 8 colunas existem, o índice existe.
**Comportamento:** No-op seguro (todos `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
**Dependências:** Nenhuma.
**Risco:** 🟢 Baixíssimo.
**Indisponibilidade:** `ALTER TABLE` locks ACCESS EXCLUSIVE por < 50ms (2 linhas).
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #2 — `20260717020000_create_barber_closings`

**O que altera:**
- `CREATE TABLE barber_closings` (26 colunas, incluindo FK para `tenants`, `cash_closings`, `staff`, `profiles`)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY "barber_closings_tenant_isolation"` (tenant isolation, sem superadmin bypass)
- `CREATE INDEX` (3 índices)
- `CREATE FUNCTION handle_barber_closings_updated_at()`
- `CREATE TRIGGER barber_closings_updated_at`
- `COMMENT ON` (10 comentários)

**Afetados:**
- Tabelas: `barber_closings` (nova)
- Funções: `handle_barber_closings_updated_at` (nova)
- Triggers: `barber_closings_updated_at` (novo)
- Índices: `idx_barber_closings_tenant_date`, `idx_barber_closings_cash_closing`, `idx_barber_closings_staff`
- Policies: `barber_closings_tenant_isolation`

**Já aplicada em produção?** ✅ SIM — tabela existe com schema idêntico.
**Comportamento:** No-op seguro (`IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, `CREATE OR REPLACE FUNCTION`).
**Dependências:** `cash_closings` (MIG #1), `staff`, `tenants`, `profiles`.
**Risco:** 🟢 Baixíssimo.
**Indisponibilidade:** Nenhuma (CREATE TABLE não locka tabelas existentes).
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #3 — `20260717030000_create_cash_closing_events`

**O que altera:**
- `CREATE TABLE cash_closing_events` (12 colunas, FKs para `tenants`, `cash_closings`, `barber_closings`, `profiles`)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY "cash_closing_events_tenant_isolation"` (tenant isolation, sem superadmin bypass)
- `CREATE INDEX` (4 índices)
- `COMMENT ON` (4 comentários)

**Afetados:**
- Tabelas: `cash_closing_events` (nova)
- Índices: 4 índices
- Policies: `cash_closing_events_tenant_isolation`

**Já aplicada em produção?** ✅ SIM — tabela existe com schema idêntico.
**Comportamento:** No-op seguro (`IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
**Dependências:** `cash_closings` (MIG #1), `barber_closings` (MIG #2), `tenants`, `profiles`.
**Risco:** 🟢 Baixíssimo.
**Indisponibilidade:** Nenhuma.
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #4 — `20260723000000_security_fix_rls_critical.sql` ⚠️

**O que altera:**

| Item | Operação |
|------|----------|
| `cash_closings` policy | DROP "Users can manage own tenant cash closings" → CREATE "tenant_isolation_cash_closings" (adds superadmin bypass) |
| `barber_closings` policy | DROP "barber_closings_tenant_isolation" → RECREATE (adds superadmin bypass) |
| `cash_closing_events` policy | DROP "cash_closing_events_tenant_isolation" → RECREATE (adds superadmin bypass) |
| `tenants` policy | DROP "Users can view their tenant" → CREATE "tenant_isolation_tenants_select" (uses `current_tenant_id_from_auth_uid`) |
| `role_permissions` policy | DROP "Managers can view role_permissions" → RECREATE (uses `current_tenant_id_from_auth_uid`) |
| `role_permissions` policy | DROP "Managers can manage role_permissions" → **RECREATE COM ERRO** |

**Afetados:**
- Policies: 6 drop + 6 create
- Tabelas: `cash_closings`, `barber_closings`, `cash_closing_events`, `tenants`, `role_permissions`

**NÃO aplicada em produção.** Policies atuais ainda não têm superadmin bypass.

**🔴 BLOQUEADOR — Erro na policy `role_permissions`:**
```sql
WHERE staff.user_id = auth.uid()  ← staff.user_id NÃO EXISTE
```

A coluna `user_id` nunca foi adicionada à tabela `staff` em nenhuma migration. A policy `Managers can manage role_permissions` falhará com:
```
ERROR: column staff.user_id does not exist
```

**Correção necessária:** Substituir `staff.user_id` por referência via `profiles`, ou adicionar `user_id` ao `staff`, ou usar outra abordagem. Sugestão:
```sql
AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND tenant_id = role_permissions.tenant_id
    AND role IN ('admin', 'manager')
)
```

**Risco sem correção:** 🔴 Migration falha no `CREATE POLICY` — banco fica em estado inconsistente (policies anteriores dropadas, novas não criadas para `role_permissions`).

**Indisponibilidade:** Janela entre DROP e CREATE das policies (milissegundos).
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #5 — `20260723060000_performance_indexes_phase_3_6`

**O que altera:**
- `CREATE INDEX CONCURRENTLY IF NOT EXISTS` (7 índices)

| Índice | Tabela | Chave |
|--------|--------|-------|
| `idx_comandas_tenant_created` | comandas | (tenant_id, created_at DESC) |
| `idx_comandas_tenant_appointment` | comandas | (tenant_id, appointment_id) WHERE appointment_id IS NOT NULL |
| `idx_comandas_tenant_staff` | comandas | (tenant_id, staff_id) WHERE staff_id IS NOT NULL |
| `idx_customer_plans_tenant_name` | customer_plans | (tenant_id, name) |
| `idx_customer_subscriptions_client_status` | customer_subscriptions | (client_id, status) |
| `idx_products_tenant_active` | products | (tenant_id, active) WHERE active = true |
| `idx_promotions_tenant_active` | promotions | (tenant_id, active) WHERE active = true |

**Afetados:**
- Índices: 7 novos

**NÃO aplicada em produção.** Índices não existem.

**Comportamento:** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` — seguro, sem lock de escrita.
**Dependências:** Tabelas `comandas`, `customer_plans`, `customer_subscriptions`, `products`, `promotions` (já existem).
**Risco:** 🟢 Baixo.
**Indisponibilidade:** Nenhuma (CONCURRENTLY).
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #6 — `20260723100000_event_store`

**O que altera:**
- `CREATE TABLE event_store` (14 colunas)
- `CREATE INDEX` (6 índices)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY` (3 políticas: superadmin_all, tenant_select, tenant_insert)
- `COMMENT ON` (6 comentários)

**Afetados:**
- Tabelas: `event_store` (nova)
- Índices: 6 novos
- Policies: 3 novas

**NÃO aplicada em produção.** Tabela não existe.

**Comportamento:** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS` — não tem `IF NOT EXISTS` para `CREATE POLICY`. Mas como a tabela é nova, não há conflito. Se reaplicada, as políticas já existiriam — `CREATE POLICY IF NOT EXISTS` é suportado desde PostgreSQL 9.6.

**Dependências:** Nenhuma (tabela isolada).
**Risco:** 🟢 Baixo.
**Indisponibilidade:** Nenhuma.
**Perda de dados:** Nenhuma.

**Observação:** `CREATE POLICY` nesta migration NÃO usa `IF NOT EXISTS`. Como a tabela é nova (nunca foi criada), não há risco. Mas para idempotência total, seria melhor adicionar.

---

### 🔷 MIG #7 — `20260723110000_processed_operations`

**O que altera:**
- `CREATE TABLE processed_operations` (8 colunas)
- `CREATE UNIQUE INDEX` (1) + `CREATE INDEX` (3)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY` (3 políticas: superadmin_all, tenant_select, tenant_insert)
- `COMMENT ON` (5 comentários)

**Afetados:**
- Tabelas: `processed_operations` (nova)
- Índices: 4 novos
- Policies: 3 novas

**NÃO aplicada em produção.** Tabela não existe.

**Comportamento:** Mesmo padrão da MIG #6. Tabela nova, sem risco.
**Dependências:** Nenhuma (tabela isolada).
**Risco:** 🟢 Baixo.
**Indisponibilidade:** Nenhuma.
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #8 — `20260724000000_add_plan_to_tenants`

**O que altera:**
- `ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'elite'))`
- `CREATE INDEX idx_tenants_plan`

**Afetados:**
- Tabelas: `tenants` (+1 coluna)
- Índices: `idx_tenants_plan`

**NÃO aplicada em produção.** Coluna `plan` não existe.

**⚠️ PRÉ-REQUISITO para MIG #10** — o RPC `provision_new_tenant` referencia `plan`.

**Comportamento:** `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
**Dependências:** Nenhuma — apenas adiciona coluna.
**Risco:** 🟢 Baixo.
**Lock:** ACCESS EXCLUSIVE em `tenants` por < 5ms (3 linhas).
**Perda de dados:** Nenhuma — DEFAULT 'free' para registros existentes.

---

### 🔷 MIG #9 — `20260724190000_add_event_versioning_columns`

**O que altera:**
- `ALTER TABLE event_store ADD COLUMN event_type_version INTEGER NOT NULL DEFAULT 1`
- `ALTER TABLE event_store ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1`
- `CREATE INDEX idx_event_store_version`
- `CREATE INDEX idx_event_store_schema`

**Afetados:**
- Tabelas: `event_store` (+2 colunas)
- Índices: 2 novos

**NÃO aplicada em produção** (event_store não existe).

**Comportamento:** `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
**Dependências:** MIG #6 (`event_store` deve existir).
**Risco:** 🟢 Baixo.
**Indisponibilidade:** ACCESS EXCLUSIVE na `event_store` (tabela vazia, < 1ms).
**Perda de dados:** Nenhuma.

---

### 🔷 MIG #10 — `20260728000000_sprint1_tenant_lifecycle` ⚠️

**O que altera:**
- `CREATE TYPE tenant_status AS ENUM`
- `ALTER TABLE tenants ADD COLUMN status tenant_status`
- Backfill UPDATE (3 linhas: active → active/cancelled)
- `ALTER TABLE tenants DROP DEFAULT`, `SET NOT NULL`, `DROP COLUMN active`
- `CREATE INDEX idx_tenants_status`
- `ADD COLUMN app_slug` (no-op — já existe)
- `CREATE TABLE tenant_settings` (+ RLS, 2 policies)
- `CREATE FUNCTION generate_unique_slug()`
- `CREATE FUNCTION provision_new_tenant()`
- `CREATE FUNCTION complete_onboarding()`

**Afetados (resumo):**

| Categoria | Quantidade |
|-----------|-----------|
| ENUM | 1 novo |
| Tabelas alteradas | 1 (`tenants`) |
| Tabelas criadas | 1 (`tenant_settings`) |
| Colunas adicionadas | 1 (`status`) + 1 no-op (`app_slug`) |
| Colunas removidas | 1 (`active`) |
| Índices | 1 novo |
| Funções | 3 novas |
| Policies | 2 novas |

**NÃO aplicada em produção.**

**⚠️ PRÉ-REQUISITO:** MIG #8 (`tenants.plan`) — `provision_new_tenant` referencia `plan`.

**Dependências:** MIG #8, `tenants` (existe), `profiles` (existe), `current_tenant_id_from_auth_uid()` (existe), `current_is_super_admin_from_auth_uid()` (existe).

**Risco geral:** 🟡 Médio.

**Riscos específicos:**
- `DROP COLUMN active` remove dados booleanos. Dados migrados para `status` via backfill.
- `SET NOT NULL` verifica 3 linhas — seguro.
- `CREATE TYPE` e funções — sem efeito colateral.
- `tenant_settings` — tabela nova, sem impacto em dados existentes.

**Indisponibilidade:** `ALTER TABLE tenants` locks ACCESS EXCLUSIVE por ~50ms total.
**Perda de dados:** Apenas `active` (booleano), mapeado para `status`.

---

## 2. Matriz de Dependências

```
MIG #1 (cash_closings cols) ────────────────── already applied ─── no-op
    │
    ├── MIG #2 (barber_closings) ─────────── already applied ─── no-op
    │   │
    │   └── MIG #4 (security: barber_closings policy)
    │
    ├── MIG #3 (cash_closing_events) ─────── already applied ─── no-op
    │   │
    │   └── MIG #4 (security: cash_closing_events policy)
    │
    └── MIG #4 (security: cash_closings policy) ⚠️
        │
        └── BLOQUEIO: staff.user_id não existe ─── precisa correção

MIG #5 (indexes) ─── independente ─── sem dependências

MIG #6 (event_store) ─── independente
    │
    └── MIG #9 (event versioning)

MIG #7 (processed_operations) ─── independente

MIG #8 (plan column) ─── independente
    │
    └── MIG #10 (Sprint 1: RPC provision_new_tenant)

MIG #10 (Sprint 1) ─── depende de MIG #8 (plan)
```

---

## 3. Bloqueios Identificados

### 🔴 Bloqueio #1 — Migration #4: `staff.user_id` não existe

**Arquivo:** `supabase/migrations/20260723000000_security_fix_rls_critical.sql`
**Linhas:** 80, 92
**Problema:** A policy `Managers can manage role_permissions` referencia `staff.user_id` mas a coluna nunca foi criada.

**Causa raiz:** A migration original `20260226052507` usava `staff.id = auth.users.id` (insert do profile UUID no staff). Isso foi removido nas versões posteriores (`v2`, `backfill`) que passaram a usar `staff.id` auto-gerado.

**Impacto:** `CREATE POLICY` falha → migration #4 inteira pode abortar → policies anteriores já foram dropadas.

**Correção sugerida:**
```sql
-- Substituir:
WHERE staff.user_id = auth.uid()
AND staff.tenant_id = role_permissions.tenant_id
AND staff.role IN ('admin', 'manager')

-- Por:
WHERE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND tenant_id = role_permissions.tenant_id
    AND role IN ('admin', 'manager')
)
```

### 🟡 Bloqueio #2 — Policy `CREATE` sem `IF NOT EXISTS` (MIG #6, #7)

**Arquivos:** `20260723100000_event_store.sql`, `20260723110000_processed_operations.sql`
**Problema:** `CREATE POLICY` sem `IF NOT EXISTS`. Tabelas são novas → sem risco agora. Mas para idempotência completa (caso o `db push` precise reaplicar), deveriam usar `IF NOT EXISTS`.

**Impacto:** Baixo — tabelas novas, políticas nunca existiram.

---

## 4. Plano de Execução em Produção

### 4.1 Ordem Cronológica

A aplicação deve seguir a ordem das migrations (por timestamp):

```
1. 20260717010000_extend_cash_closings_operational_fields.sql   (no-op)
2. 20260717020000_create_barber_closings.sql                    (no-op)
3. 20260717030000_create_cash_closing_events.sql                (no-op)
4. 20260723000000_security_fix_rls_critical.sql                 ⚠️ PRECISA CORREÇÃO
5. 20260723060000_performance_indexes_phase_3_6.sql
6. 20260723100000_event_store.sql
7. 20260723110000_processed_operations.sql
8. 20260724000000_add_plan_to_tenants.sql
9. 20260724190000_add_event_versioning_columns.sql
10. 20260728000000_sprint1_tenant_lifecycle.sql
```

Se usar `supabase db push`, o CLI resolve a ordenação automaticamente.

### 4.2 Recomendação: Aplicação Única vs Dividida

**Recomendação: ✅ ÚNICO `db push`** (após corrigir Bloqueio #1)

**Justificativa:**

1. **Atomicidade**: O Supabase CLI agrupa migrations em uma única transação. Se uma falhar, todas revertem. Isso é desejável — evita estado inconsistente.

2. **Migrations 1-3 são no-ops**: Já foram aplicadas. O `db push` detecta que o schema remoto já tem as colunas/tabelas e as marca como "já aplicadas".

3. **Duração total estimada**: < 2 segundos de DDL:
   - MIG #1-3: < 10ms (no-ops)
   - MIG #4: < 50ms (DROP/CREATE policies)
   - MIG #5: < 100ms (CREATE INDEX CONCURRENTLY — sem lock)
   - MIG #6-7: < 50ms (CREATE TABLE)
   - MIG #8: < 5ms (ADD COLUMN, 3 rows)
   - MIG #9: < 5ms (ALTER TABLE vazia)
   - MIG #10: < 100ms (TYPE, ALTER TABLE, CREATE FUNCTION)

4. **Janela de indisponibilidade**: ~60ms de ACCESS EXCLUSIVE locks em `tenants` (MIG #8 + #10) durante a transação. O resto é sem lock ou CONCURRENTLY.

5. **Risco de dividir**: Entre execuções, o banco estaria com algumas migrations aplicadas e outras não → versões diferentes entre local e remoto → dificuldade de debug.

### 4.3 ⚠️ Procedimento ANTES da execução

**Passo 1 — Corrigir o Bloqueio #1**

Editar `20260723000000_security_fix_rls_critical.sql`:
- Substituir `staff.user_id = auth.uid()` por verificação via `profiles`

```sql
-- Linhas 79-82 (e 91-94): Substituir:
            AND EXISTS (
                SELECT 1 FROM public.staff
                WHERE staff.user_id = auth.uid()
                AND staff.tenant_id = role_permissions.tenant_id
                AND staff.role IN ('admin', 'manager')
            )
-- Por:
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.tenant_id = role_permissions.tenant_id
                AND profiles.role IN ('admin', 'manager')
            )
```

**Passo 2 — Backup**

```powershell
# Backup completo
supabase db dump --linked --file "backup_pre_deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Validar backup
$file = Get-ChildItem -Filter "backup_pre_deploy_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (Select-String -Path $file.FullName -Pattern "COPY public.tenants") {
    Write-Output "Backup OK: $($file.Length) bytes"
} else {
    Write-Error "Backup INVALIDO!"
}
```

**Passo 3 — Checklist pré-execução**

- [ ] Migration #4 corrigida (staff.user_id → profiles)
- [ ] Backup `pg_dump` completo realizado e validado
- [ ] Backup salvo em local seguro (fora do repositório)
- [ ] Horário agendado (recomendado: 05:00-06:00, antes da abertura da barbearia)
- [ ] Sanchez Barber comunicado sobre janela de manutenção (~5 minutos)
- [ ] Conexão estável com internet verificada
- [ ] Supabase CLI na versão mais recente (`supabase --version ≥ 2.105.0`)
- [ ] Projeto linked (`supabase link --project-ref ushsnmlbeurfvlkieiln`)
- [ ] Acesso ao Supabase Dashboard para monitoramento
- [ ] Rollback documentado (ver seção 6)

---

## 5. Validação Pós-Execução

### 5.1 Imediatas (após `db push`)

```bash
# Verificar migrations registradas
supabase db query "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260717010000' ORDER BY version;" --linked

# Verificar colunas
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' ORDER BY ordinal_position;" --linked

# Verificar ENUM
supabase db query "SELECT typname FROM pg_type WHERE typname='tenant_status';" --linked

# Verificar funções novas
supabase db query "SELECT proname FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') AND proname IN ('generate_unique_slug','provision_new_tenant','complete_onboarding');" --linked

# Verificar policies novas
supabase db query "SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'tenant_isolation_cash%' OR policyname LIKE 'tenant_isolation_tenants%' OR policyname LIKE 'event_store%' OR policyname LIKE 'processed_operations%' OR policyname LIKE 'tenant_settings%';" --linked

# Verificar plan column
supabase db query "SELECT id, name, slug, plan FROM public.tenants;" --linked
```

### 5.2 Funcionais — Fluxo Completo

**Login e Autenticação:**
- [ ] Login com credenciais existentes (admin/manager)
- [ ] Login com barbeiro
- [ ] Login com recepcionista
- [ ] Verificar que `AuthContext` carrega sem erros
- [ ] Verificar que `TenantContext` carrega com `status` correto

**Agenda (Appointments):**
- [ ] Listar agendamentos do dia
- [ ] Criar novo agendamento
- [ ] Confirmar agendamento
- [ ] Concluir agendamento
- [ ] Cancelar agendamento
- [ ] Verificar que os índices CONCURRENTLY foram criados (`idx_comandas_tenant_created`, etc.)

**Comandas (Checkout):**
- [ ] Abrir comanda para cliente
- [ ] Adicionar serviços à comanda
- [ ] Adicionar produtos à comanda
- [ ] Finalizar comanda (checkout)
- [ ] Reverter comanda (se aplicável)

**Financeiro:**
- [ ] Listar transações do dia
- [ ] Filtrar por período
- [ ] Verificar `transactions` e `financial_reversals`

**Caixa (Cash Closing):**
- [ ] Verificar que `cash_closings` carrega com as novas colunas
- [ ] Abrir caixa do dia
- [ ] Fechar caixa do dia
- [️ ] Verificar `barber_closings` (se aplicável)
- [ ] Verificar timeline de eventos (`cash_closing_events`)

**Dashboard:**
- [ ] Dashboard carrega métricas
- [ ] Gráficos de faturamento
- [ ] Indicadores de performance

**SuperAdmin:**
- [ ] Acessar painel SuperAdmin
- [ ] Listar tenants
- [ ] Verificar coluna `plan` aparece
- [️] Verificar coluna `status` aparece
- [ ] Filtrar por plano

**Event Store (background):**
- [ ] Verificar `event_store` vazia (sem eventos ainda — só será populada após App Services)
- [ ] Verificar `processed_operations` vazia

### 5.3 Sanchez Barber — Validação de Dados

- [ ] Confirmar tenant `Barbearia Principal` (slug: sanchez) com `status = 'active'`
- [ ] Confirmar `plan = 'free'` (default)
- [ ] Confirmar que `active` não existe mais como coluna
- [️] Verificar agendamentos do Sanchez Barber intactos (conferir visualmente no Dashboard)
- [ ] Verificar clientes, serviços, produtos intactos
- [ ] Verificar comandas em aberto (se houver) intactas
- [ ] Verificar histórico financeiro intacto

### 5.4 Performance

- [ ] Verificar query planner usando novos índices:
```sql
EXPLAIN ANALYZE SELECT * FROM comandas WHERE tenant_id = 'b716e290-...' ORDER BY created_at DESC LIMIT 10;
```

---

## 6. Plano de Rollback

### 6.1 Rollback Completo (Recomendado)

```bash
# Usar o backup pré-deploy
supabase db restore --linked "backup_pre_deploy_*.sql"
```

**Tempo estimado:** 2-5 minutos (dependendo do tamanho do backup).
**Risco:** 🟢 Mínimo — o backup contém o estado exato anterior.

### 6.2 Rollback Manual (Se necessário)

```sql
-- Ordem reversa das migrations 10 → 1:

-- MIG #10: Reverter Sprint 1
DROP FUNCTION IF EXISTS public.complete_onboarding;
DROP FUNCTION IF EXISTS public.provision_new_tenant;
DROP FUNCTION IF EXISTS public.generate_unique_slug;
DROP TABLE IF EXISTS public.tenant_settings CASCADE;
DROP INDEX IF EXISTS idx_tenants_status;
ALTER TABLE public.tenants
  ADD COLUMN active BOOLEAN DEFAULT true,
  DROP COLUMN IF EXISTS status CASCADE;
UPDATE public.tenants SET active = true;
DROP TYPE IF EXISTS public.tenant_status CASCADE;

-- MIG #9: Reverter event versioning
ALTER TABLE event_store
  DROP COLUMN IF EXISTS event_type_version,
  DROP COLUMN IF EXISTS schema_version;
DROP INDEX IF EXISTS idx_event_store_version;
DROP INDEX IF EXISTS idx_event_store_schema;

-- MIG #8: Reverter plan column
DROP INDEX IF EXISTS idx_tenants_plan;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS plan;

-- MIG #7: Reverter processed_operations
DROP TABLE IF EXISTS processed_operations CASCADE;

-- MIG #6: Reverter event_store
DROP TABLE IF EXISTS event_store CASCADE;

-- MIG #5: Reverter indexes
DROP INDEX IF EXISTS idx_comandas_tenant_created;
DROP INDEX IF EXISTS idx_comandas_tenant_appointment;
DROP INDEX IF EXISTS idx_comandas_tenant_staff;
DROP INDEX IF EXISTS idx_customer_plans_tenant_name;
DROP INDEX IF EXISTS idx_customer_subscriptions_client_status;
DROP INDEX IF EXISTS idx_products_tenant_active;
DROP INDEX IF EXISTS idx_promotions_tenant_active;

-- MIG #4: Reverter RLS policies
-- cash_closings
DROP POLICY IF EXISTS "tenant_isolation_cash_closings" ON cash_closings;
CREATE POLICY "Users can manage own tenant cash closings" ON cash_closings
  FOR ALL USING (tenant_id = current_tenant_id_from_auth_uid());

-- barber_closings
DROP POLICY IF EXISTS "barber_closings_tenant_isolation" ON barber_closings;
-- A policy original será recriada se necessário

-- cash_closing_events
DROP POLICY IF EXISTS "cash_closing_events_tenant_isolation" ON cash_closing_events;

-- tenants
DROP POLICY IF EXISTS "tenant_isolation_tenants_select" ON tenants;
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (
    id = current_tenant_id_from_auth_uid()
    OR EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = tenants.id)
    OR current_is_super_admin_from_auth_uid()
  );

-- role_permissions
DROP POLICY IF EXISTS "Managers can view role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Managers can manage role_permissions" ON role_permissions;
-- Recriar policies originais se necessário

-- MIG #1-3: Não reverter (já estavam aplicadas antes, são no-ops)
```

**Riscos do rollback manual:**
- `DROP TYPE tenant_status CASCADE` pode propagar para outras colunas se o tipo for reutilizado
- Polices recriadas manualmente podem não ser idênticas às originais
- Não recupera dados da coluna `active` (valores booleanos dos 3 tenants estão mapeados em `status`)
- **Recomendação:** Preferir sempre o restore do `pg_dump`

---

## 7. Responsabilidades

| Papel | Responsável | Tarefa |
|-------|-------------|--------|
| **Autorizar execução** | Augusto (PO) | Aprovar plano, agendar janela, comunicar Sanchez Barber |
| **Corrigir Bloqueio #1** | OpenCode | Aplicar correção em `20260723000000_security_fix_rls_critical.sql` |
| **Aplicar migration** | Augusto (PO) | Executar `supabase db push --linked` |
| **Validar pós-deploy** | OpenCode + Augusto | Executar checklist de validação |
| **Rollback se necessário** | Augusto (PO) | Executar restore do backup |

---

## 8. Recomendação Final

### ⚠️ APTO COM CORREÇÃO — BLOQUEIO #1 DEVE SER RESOLVIDO PRIMEIRO

A stack de 10 migrations está apta para execução **desde que**:

1. **Passo obrigatório:** Corrigir `staff.user_id` → `profiles` em `20260723000000_security_fix_rls_critical.sql`
2. **Passo obrigatório:** Backup `pg_dump` completo antes da execução
3. **Passo recomendado:** Aplicar em **único `supabase db push --linked`**
4. **Passo recomendado:** Agendar em horário de baixo movimento (05:00-06:00)

**Após a correção:** ✅ **APTO PARA EXECUÇÃO**

**Tempo total estimado:** < 5 minutos (incluindo backup + validação)
**Indisponibilidade máxima:** ~60ms (locks ACCESS EXCLUSIVE)
**Risco de perda de dados:** 🟢 Mínimo (com backup validado)
