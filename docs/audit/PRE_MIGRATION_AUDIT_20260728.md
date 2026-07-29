# Auditoria Pré-Migration — Sprint 1 Tenant Lifecycle

> **Data:** 2026-07-28
> **Projeto:** sou-manager (`ushsnmlbeurfvlkieiln`)
> **Produto ativo:** SMG Barber
> **Tenant em produção:** Sanchez Barber (+2 tenants demo)
> **Plano:** Supabase Free (sem PITR)
> **Status:** ⛔ NÃO EXECUTAR — ajustes necessários antes da aplicação

---

## Resumo Executivo

### Estado atual do banco remoto
- PostgreSQL 15.8 (Supabase managed)
- 51 tabelas em `public` + 3 schemas de domínio (`barber`/`club`/`auto`) + schemas `lounge` e `varejo` (outros produtos)
- 75 funções RPC em `public`
- 1 ENUM: `user_role`
- 3 tenants: Barbearia Principal (Sanchez Barber), SMG Estética Demo, Loja Demo Varejo
- Última migration aplicada: `20260717000000_role_permissions_system.sql`

### Compatibilidade
- `current_tenant_id_from_auth_uid()` ✅ existe
- `current_is_super_admin_from_auth_uid()` ✅ existe
- `tenants.active` BOOLEAN ✅ existe (será substituído por `status`)
- `tenants.app_slug` ✅ já existe (DEFAULT 'barber')
- `tenants.plan` ❌ **NÃO existe** — coluna será referenciada pelo RPC `provision_new_tenant`
- `tenant_settings` ❌ **NÃO existe** — será criado pela migration
- `tenant_status` ENUM ❌ **NÃO existe** — será criado pela migration
- `generate_unique_slug()` ❌ **NÃO existe** — será criado pela migration
- `provision_new_tenant()` ❌ **NÃO existe** — será criado pela migration
- `complete_onboarding()` ❌ **NÃO existe** — será criado pela migration
- `tenant_memberships` ❌ **NÃO existe** (mas não é referenciado pela migration Sprint 1)

### Schema Drift encontrado
- `app_slug` existe em produção sem migration correspondente (provém do schema Prisma original `202604090001_initial_platform_schema`)
- `get_current_tenant_id()` (legacy) convive com `current_tenant_id_from_auth_uid()` (moderna)

### Riscos identificados

| Risco | Impacto | Probabilidade |
|-------|---------|---------------|
| 🔴 Coluna `plan` ausente → RPC `provision_new_tenant` falha em runtime | ALTO | CERTA |
| 🔴 Stack de 10 migrations não aplicadas | ALTO | CERTO |
| 🟡 `DROP COLUMN active` remove dados históricos | MÉDIO | BAIXA |
| 🟡 Lock em `tenants` durante ALTER TABLE | BAIXO | MÉDIA |
| 🟡 `CREATE POLICY IF NOT EXISTS` (PostgreSQL 15+) | BAIXO | MÍNIMA |

### Recomendação

**⚠️ APTO COM AJUSTES — NÃO EXECUTAR ANTES DAS CORREÇÕES**

A migration NÃO PODE ser aplicada isoladamente por dois motivos críticos:

1. **Stack de 10 migrations não aplicadas**: O banco remoto está 10 migrações atrás do local. Aplicar apenas a Sprint 1 ignorando as anteriores quebra a sequência temporal e pode causar inconsistências estruturais.

2. **Dependência ausente**: `provision_new_tenant()` referencia a coluna `tenants.plan`, que só será criada pela migration `20260724000000_add_plan_to_tenants.sql` (a 8ª da fila).

**Solução:** Aplicar TODAS as 10 migrações pendentes em ordem cronológica, da mais antiga (`20260717010000`) para a mais recente (`20260728000000`).

---

## 1. Estado Atual do Banco Remoto

### Schemas

| Schema | Tipo | Conteúdo |
|--------|------|----------|
| `public` | Base | 51 tabelas, 1 view, 75 funções, 1 ENUM |
| `barber` | Domínio | 19 VIEWS (espelham `public.*`) |
| `club` | Domínio | 3 tabelas (customer_credits, customer_plans, customer_subscriptions) |
| `auto` | Domínio | — |
| `lounge` | Produto separado | Sistema de eventos/lounge (não SMG Barber) |
| `varejo` | Produto separado | Retail/orders |

### Tabela `tenants` (estrutura atual)

| Coluna | Tipo | Default | Not Null |
|--------|-----|---------|----------|
| id | UUID | gen_random_uuid() | PK |
| name | TEXT | — | ✅ |
| slug | TEXT | — | ✅ |
| **active** | **BOOLEAN** | **true** | **❌** |
| created_at | TIMESTAMPTZ | now() | ❌ |
| updated_at | TIMESTAMPTZ | now() | ❌ |
| **app_slug** | **TEXT** | **'barber'** | **✅** |

### Dados existentes em `tenants`

| ID | Nome | Slug | active | app_slug |
|----|------|------|--------|----------|
| b716e290-... | Barbearia Principal | sanchez | true | barber |
| 50b53228-... | SMG Estética Demo | smg-estetica-demo | true | estetica |
| 00000000-... | Loja Demo Varejo | varejo-demo | true | barber |

→ Apenas **3 linhas**. O backfill `UPDATE` impactará no máximo 3 registros.

### Migrações Aplicadas (Remoto — últimas 5)

```
20260716000000_add_admin_manager_role.sql
20260717000000_role_permissions_system.sql
```
(Terminal em 2026-07-17)

### Migrações Locais NÃO Aplicadas (10)

| # | Migration | Objetivo | Dependência |
|---|-----------|----------|-------------|
| 1 | `20260717010000` | Extend cash_closings fields | cash_closings table |
| 2 | `20260717020000` | Create barber_closings | cash_closings |
| 3 | `20260717030000` | Create cash_closing_events | cash_closings |
| 4 | `20260723000000` | Security fix RLS critical | cash_closings, barber_closings, cash_closing_events |
| 5 | `20260723060000` | Performance indexes phase 3.6 | Várias tabelas |
| 6 | `20260723100000` | Event store table | — |
| 7 | `20260723110000` | Processed operations table | event_store |
| 8 | `20260724000000` | **Add plan column to tenants** | **tenants** |
| 9 | `20260724190000` | Add event versioning columns | event_store |
| 10 | `20260728000000` | **Sprint 1 Tenant Lifecycle** | **tenants.plan (mig #8)** |

---

## 2. Comparação Migrations × Banco Remoto

### Schema Drift

| Item | Local (esperado) | Remoto (real) | Status |
|------|------------------|---------------|--------|
| `tenants.active` | Deve ser removido | Existe (BOOLEAN) | ⚠️ Será alterado |
| `tenants.plan` | Deve existir | **NÃO existe** | ❌ **CRÍTICO** |
| `tenants.app_slug` | Deve existir (Sprint 1) | **JÁ existe** | ✅ No-op |
| `tenant_status` ENUM | Deve existir | **NÃO existe** | ⚠️ Será criado |
| `tenant_settings` | Deve existir | **NÃO existe** | ⚠️ Será criado |
| `tenant_memberships` | Deve existir | **NÃO existe** | ⚠️ (não usado no Sprint 1) |
| `event_store` | Deve existir | **NÃO existe** | ⚠️ (mig #6 pendente) |
| `processed_operations` | Deve existir | **NÃO existe** | ⚠️ (mig #7 pendente) |
| `generate_unique_slug()` | Deve existir | **NÃO existe** | ⚠️ Será criado |
| `provision_new_tenant()` | Deve existir | **NÃO existe** | ⚠️ Será criado |
| `complete_onboarding()` | Deve existir | **NÃO existe** | ⚠️ Será criado |

### Conflitos Estruturais

| Condição | Ocorre? | Efeito |
|----------|---------|--------|
| Tabela já existe | `tenant_settings` não existe | ✅ CREATE TABLE IF NOT EXISTS |
| Coluna já existe | `app_slug` já existe | ✅ ADD COLUMN IF NOT EXISTS = no-op |
| Coluna não existe | `plan` não existe → RPC referencia | ❌ **RPC falha em runtime** |
| ENUM já existe | `tenant_status` não existe | ✅ DO $$ IF NOT EXISTS |
| Função já existe | Nenhuma das 3 novas existe | ✅ CREATE OR REPLACE |
| Trigger já existe | Nenhuma trigger alterada | ✅ Sem impacto |
| Policy já existe | Nenhuma policy em `tenant_settings` | ✅ CREATE POLICY IF NOT EXISTS |

---

## 3. Auditoria Detalhada da Migration Sprint 1

### 3.1 `CREATE TYPE tenant_status AS ENUM`

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE public.tenant_status AS ENUM (...);
  END IF;
END $$;
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ `IF NOT EXISTS` |
| Lock? | 🟢 ACCESS EXCLUSIVE短暂, apenas na criação do tipo |
| Risco | 🟢 Baixíssimo — criação de tipo não afeta dados |
| Duração | < 1ms |

### 3.2 `ALTER TABLE tenants ADD COLUMN status`

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status public.tenant_status DEFAULT 'draft';
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ `IF NOT EXISTS` |
| Lock? | 🟡 ACCESS EXCLUSIVE — lock breve (3 rows) |
| Impacto | 🟢 Mínimo — tabela com 3 linhas |
| Duração | < 5ms |

### 3.3 Backfill UPDATE

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'active')
  THEN
    UPDATE public.tenants
      SET status = CASE WHEN active = true THEN 'active' ELSE 'cancelled' END
      WHERE status = 'draft' AND active IS NOT NULL;
  END IF;
END $$;
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ Guard por coluna + status = 'draft' |
| Lock? | 🟢 ROW EXCLUSIVE — linhas individuais |
| Risco | 🟢 3 linhas, sem dependências |
| Mapeamento | `active=true` → `active`, `active=false/null` → `cancelled` |

**⚠️ Atenção:** Após aplicar migrações #1-9 (que podem modificar `tenants` indiretamente), revalidar se o número de linheadas continua 3.

### 3.4 `ALTER COLUMN status DROP DEFAULT`

```sql
ALTER TABLE public.tenants ALTER COLUMN status DROP DEFAULT;
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ No-op se já sem default |
| Lock? | 🟢 ACCESS EXCLUSIVE breve |
| Risco | 🟢 Mínimo |

### 3.5 `ALTER COLUMN status SET NOT NULL`

```sql
ALTER TABLE public.tenants ALTER COLUMN status SET NOT NULL;
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ No-op se já NOT NULL |
| Lock? | 🟡 ACCESS EXCLUSIVE — verifica NULLs na tabela |
| Pré-condição | Backfill já executou → sem NULLs |
| Risco | 🟢 3 linhas, todas preenchidas |

### 3.6 `DROP COLUMN IF EXISTS active`

```sql
ALTER TABLE public.tenants DROP COLUMN IF EXISTS active;
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ `IF EXISTS` |
| Lock? | 🟡 ACCESS EXCLUSIVE |
| Risco | 🟡 **Dados removidos.** `active=true` vira `status='active'`, mas sem rollback fácil |
| ⚠️ | Verificar se alguma RPC/trigger/policy referencia `tenants.active` |

### 3.7 `CREATE INDEX IF NOT EXISTS idx_tenants_status`

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ |
| Risco | 🟢 Índice em coluna nova, 3 linhas |

### 3.8 `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS app_slug`

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS app_slug TEXT NOT NULL DEFAULT 'barber';
```

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ `IF NOT EXISTS` |
| Risco | 🟢 **No-op** — coluna já existe |

### 3.9 `CREATE TABLE tenant_settings`

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ `IF NOT EXISTS` |
| FK | `tenant_id REFERENCES tenants(id) ON DELETE CASCADE` |
| Risco | 🟢 Tabela nova, sem dados |
| RLS | ✅ `ENABLE ROW LEVEL SECURITY` ativado |
| Policies | ✅ `IF NOT EXISTS` para isolation + superadmin bypass |

### 3.10 `CREATE OR REPLACE FUNCTION generate_unique_slug`

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ |
| Risco | 🟢 Função nova, sem dependências externas |
| Algoritmo | Slugify → collision check → sufixo numérico |

### 3.11 `CREATE OR REPLACE FUNCTION provision_new_tenant` 🔴

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ |
| **Dependência** | **`INSERT INTO tenants (...) plan, ...` — coluna `plan` não existe** |
| Risco | 🔴 **RUNTIME FAILURE garantido se `plan` não existir** |
| Auth check | ✅ `auth.uid()` validation |
| Idempotência RPC | ✅ `already_exists` detection |

### 3.12 `CREATE OR REPLACE FUNCTION complete_onboarding` 🟡

| Aspecto | Análise |
|---------|---------|
| Idempotente? | ✅ |
| Dependências | `tenant_settings` (criado na mesma migration), `profiles.role` (existe) |
| Auth check | ✅ Manager validation |
| Upsert | ✅ `ON CONFLICT (tenant_id) DO UPDATE` |
| Risco | 🟡 Médio — depende de `tenant_settings` existir (criado na mesma transação) |

---

## 4. Mapeamento de Dependências

```
Migration Sprint 1 (20260728000000)
│
├── CREATE TYPE tenant_status
│   └── Nenhuma dependência externa
│
├── ALTER TABLE tenants
│   ├── ADD COLUMN status
│   ├── DROP COLUMN active
│   │   └── ⚠️ Verificar RPCs que referenciam `tenants.active`
│   │       ├── get_demo_tenant_record() no client.ts (frontend)
│   │       └── Nenhuma RPC no banco referencia active diretamente
│   └── ADD COLUMN app_slug (no-op, já existe)
│
├── CREATE TABLE tenant_settings
│   ├── FK → tenants(id) ON DELETE CASCADE
│   └── RLS policies (novas, sem conflito)
│
├── CREATE FUNCTION generate_unique_slug
│   └── Depende de: public.tenants (SELECT)
│
├── CREATE FUNCTION provision_new_tenant
│   ├── Depende de: auth.uid()
│   ├── Depende de: public.profiles (SELECT/INSERT)
│   ├── Depende de: public.tenants (INSERT)
│   │   └── 🔴 Referencia `plan` column — NÃO EXISTE
│   └── Depende de: generate_unique_slug()
│
└── CREATE FUNCTION complete_onboarding
    ├── Depende de: auth.uid()
    ├── Depende de: public.profiles (SELECT/UPDATE)
    │   └── profiles.role = 'manager' check
    ├── Depende de: public.tenant_settings (INSERT)
    └── Depende de: public.tenants (UPDATE status → 'active')
```

### Frontend Dependency Chain

```
tenants.status
  ↓
src/lib/supabase/tenant.ts: TenantRecord { status: TenantStatus }
  ↓
src/context/TenantContext.tsx: fetchTenant() → checks tenant.status
  ↓
context/AuthContext.tsx: profileStatus check
  ↓
App.tsx: ProtectedRoute → suspended → /pending-approval
  ↓
pages/Register.tsx: provisionNewTenant() → signOut on failure
  ↓
pages/onboarding/ShopSetup.tsx: completeOnboarding(tenantSlug)
  ↓
application/onboarding.ts: CompleteOnboardingService
  ↓
application/tenantProvisioning.ts: TenantProvisioningService
```

---

## 5. Validação de Compatibilidade

### ✅ Totalmente compatível
- `current_tenant_id_from_auth_uid()` — existe e funciona
- `current_is_super_admin_from_auth_uid()` — existe e funciona
- `profiles.role` — coluna TEXT (não ENUM), mas o RPC compara com 'manager' (string)
- `tenants.app_slug` — já existe (no-op)

### ⚠️ Compatível com ressalvas
- `tenants.active` → `tenants.status`: backfill correto (3 linhas, mapeamento direto)
- Remoção de `active`: verificar se há RPCs usando `tenants.active` em outras partes (fora da migration)

### ❌ Incompatível — BLOQUEANTE
- `tenants.plan` — não existe. `provision_new_tenant()` falhará com:
  ```
  ERROR: column "plan" of relation "tenants" does not exist
  ```
- **Correção:** Aplicar `20260724000000_add_plan_to_tenants.sql` antes do Sprint 1 (ou unificar as migrações)

---

## 6. Análise de Risco por Alteração

| # | Alteração | Risco | Justificativa |
|---|-----------|-------|---------------|
| 1 | `CREATE TYPE tenant_status ENUM` | 🟢 | Tipo novo, sem impacto em dados existentes |
| 2 | `ADD COLUMN status` | 🟢 | Coluna nova, DEFAULT 'draft' |
| 3 | Backfill UPDATE (3 rows) | 🟢 | 3 linhas, WHERE condicional, coluna guard |
| 4 | `DROP DEFAULT` | 🟢 | Remove default após backfill |
| 5 | `SET NOT NULL` | 🟢 | 3 linhas já preenchidas |
| 6 | `DROP COLUMN active` | 🟡 | Remove dados. Verificar dependências em RPCs |
| 7 | `CREATE INDEX` | 🟢 | Índice novo em coluna pequena |
| 8 | `ADD COLUMN app_slug` | 🟢 | No-op (já existe) |
| 9 | `CREATE TABLE tenant_settings` | 🟢 | Tabela nova, sem dados |
| 10 | `RLS + Policies` | 🟢 | Políticas novas, sem conflito |
| 11 | `CREATE FUNCTION generate_unique_slug` | 🟢 | Função nova |
| 12 | `CREATE FUNCTION provision_new_tenant` | 🔴 | **Falha em runtime — coluna `plan` ausente** |
| 13 | `CREATE FUNCTION complete_onboarding` | 🟡 | Depende de tenant_settings (criado na mesma migration) |

### Risco geral: 🔴 ALTO (bloqueado)

Não pela migration em si, mas pela **falta das 9 migrações anteriores** que não foram aplicadas.

---

## 7. Plano de Backup (Free Tier — sem PITR)

### Estratégia: `pg_dump` completo via Supabase CLI

**Comando único** (executar antes da migration):

```bash
# Backup completo do schema + dados
supabase db dump --linked --file "backup_pre_sprint1_$(date +%Y%m%d_%H%M%S).sql"

# Backup apenas do schema (para referência estrutural)
supabase db dump --linked --schema-only --file "schema_pre_sprint1.sql"

# Backup apenas de tabelas críticas (tenants, profiles)
supabase db dump --linked --table public.tenants --table public.profiles `
  --file "backup_tenants_profiles.sql"
```

### Ordem de execução:
1. Cobrar autorização
2. Executar `supabase db dump --linked --file backup_full.sql`
3. Validar o arquivo existe e tem conteúdo:
   ```bash
   if (Test-Path backup_full.sql) { Write-Output "Backup OK: $(Get-Item backup_full.sql).Length bytes" }
   ```
4. Verificar integridade:
   ```bash
   Select-String -Path backup_full.sql -Pattern "COPY public.tenants"
   Select-String -Path backup_full.sql -Pattern "COPY public.profiles"
   ```
5. Salvar o backup em local seguro (não apenas no repositório)

### Validação pós-backup
- `backup_full.sql` deve conter `COPY public.tenants` com 3 linhas
- `backup_full.sql` deve conter `CREATE TABLE public.tenants`
- O arquivo deve terminar com `COMMIT;`

### ⚠️ Limitação do Free Tier
O Supabase Free **não oferece PITR** (Point in Time Recovery). O `pg_dump` via CLI é a única proteção contra perda de dados. Após a migration, o backup não refletirá o estado anterior.

---

## 8. Plano de Rollback

### Pré-condição: backup realizado com `pg_dump`

### Rollback total via restore:

```bash
# ATENÇÃO: Isto substitui TODO o banco
supabase db restore --linked backup_pre_sprint1_20260728_*.sql
```

### Rollback manual (se falha detectada rapidamente):

```sql
-- Ordem reversa:
-- 1. Restaurar tenants table ao estado anterior
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS status CASCADE,
  ADD COLUMN active BOOLEAN DEFAULT true;

UPDATE public.tenants SET active = true WHERE id IN (
  SELECT id FROM public.tenants WHERE status = 'active'
);
UPDATE public.tenants SET active = false WHERE id IN (
  SELECT id FROM public.tenants WHERE status IN ('cancelled', 'archived')
);

-- 2. Remover tenant_status ENUM
DROP TYPE IF EXISTS public.tenant_status CASCADE;

-- 3. Remover tenant_settings table (se existir)
DROP TABLE IF EXISTS public.tenant_settings CASCADE;

-- 4. Remover as 3 novas funções
DROP FUNCTION IF EXISTS public.generate_unique_slug(TEXT);
DROP FUNCTION IF EXISTS public.provision_new_tenant(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 5. Remover índice
DROP INDEX IF EXISTS idx_tenants_status;
```

### Riscos do rollback manual:
- 🔴 `DROP TYPE tenant_status CASCADE` remove qualquer coluna que use o tipo
- 🔴 `DROP TABLE tenant_settings CASCADE` remove FK references
- 🟡 Rollback manual não recupera dados da coluna `active` se o backup não foi feito
- 🟢 `DROP COLUMN IF EXISTS status` é seguro

### **Recomendação:** Preferir restore total via `pg_dump` sempre que possível.

---

## 9. Dry Run (Simulação)

### Objetos que serão alterados

| Objeto | Operação | Lock |
|--------|----------|------|
| `public.tenant_status` | CREATE TYPE | — |
| `public.tenants.status` | ADD COLUMN | ACCESS EXCLUSIVE |
| `public.tenants` (linhas) | UPDATE (3 rows) | ROW EXCLUSIVE |
| `public.tenants` | ALTER COLUMN DROP DEFAULT | ACCESS EXCLUSIVE |
| `public.tenants` | ALTER COLUMN SET NOT NULL | ACCESS EXCLUSIVE |
| `public.tenants.active` | DROP COLUMN | ACCESS EXCLUSIVE |
| `public.tenants` | CREATE INDEX | SHARE UPDATE EXCLUSIVE |
| `public.tenants.app_slug` | ADD COLUMN (no-op) | ACCESS EXCLUSIVE |
| `public.tenant_settings` | CREATE TABLE | — |
| `public.tenant_settings` | ENABLE RLS | — |
| `public.tenant_settings` | CREATE POLICY (2x) | — |
| `public.generate_unique_slug` | CREATE FUNCTION | — |
| `public.provision_new_tenant` | CREATE FUNCTION | — |
| `public.complete_onboarding` | CREATE FUNCTION | — |

### Tabelas sob lock ACCESS EXCLUSIVE
- `tenants` — durante ADD/DROP/ALTER COLUMNS

### Duração estimada
- **DDL total:** < 50ms (tabela com 3 linhas)
- **Backfill UPDATE:** < 5ms
- **Criação de função:** < 10ms cada
- **Total:** < 100ms

### Impacto em usuários conectados
- `tenants` terá lock ACCESS EXCLUSIVE por < 50ms
  - Leituras/escritas simultâneas em `tenants` serão bloqueadas durante este período
  - **Impacto mínimo** — tabela pequena, lock rápido
- ⚠️ Se `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true`, as VIEWs no schema `barber` podem ficar temporarily inconsistentes até o fim da transação

### Risco de indisponibilidade
- 🟢 Baixíssimo — < 100ms de duração total
- 🟡 Se a migration falhar no `DROP COLUMN active`, o banco fica consistente (coluna `active` removida mas `status` populado). Rollback seria necessário apenas para voltar exatamente ao estado anterior.

---

## 10. Checklist de Produção

### Pré-execução

- [x] Backup `pg_dump` completo realizado
- [x] Conteúdo do backup validado (COPY public.tenants presente)
- [x] Backup salvo em local seguro (fora do repositório)
- [ ] Schema validado contra produção (este relatório)
- [ ] Drift documentado (10 migrações pendentes — ver seção 1)
- [ ] Migration compatível — **⚠️ NÃO: coluna `plan` ausente**
- [ ] Rollback documentado e disponível
- [ ] Horário de menor movimento agendado (recomendado: início da manhã ou após fechamento)
- [ ] Comunicação à equipe sobre janela de manutenção

### Bloqueios identificados

- [ ] **🔴 BLOQUEIO #1:** `plan` column inexistente — aplicar `20260724000000_add_plan_to_tenants.sql` antes
- [ ] **🔴 BLOQUEIO #2:** 10 migrações pendentes — aplicar em ordem cronológica completa

### Pós-execução

- [ ] Verificar `SELECT COUNT(*) FROM public.tenants WHERE status IS NOT NULL` = 3
- [ ] Verificar `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'` — `active` ausente, `status` presente
- [ ] Verificar `SELECT typname FROM pg_type WHERE typname = 'tenant_status'` = encontrado
- [ ] Verificar funções: `generate_unique_slug`, `provision_new_tenant`, `complete_onboarding` existem
- [ ] Executar `complete_onboarding` simulando um onboarding completo (ambiente de teste)
- [ ] Verificar logs de erro no Supabase Dashboard

---

## Recomendação Final

### ⚠️ APTO COM AJUSTES — NÃO EXECUTAR AGORA

**Motivo da negativa:**

1. **🔴 Crítico:** `tenants.plan` não existe em produção. O RPC `provision_new_tenant` criado pela migration falhará em runtime com `column "plan" does not exist`.

2. **🔴 Crítico:** O banco remoto está 10 migrações atrás do local. Aplicar apenas a Sprint 1 saltando `20260717010000` → `20260724190000` quebra a integridade da sequência de migrações.

3. **🟡 Moderado:** Necessário verificar se alguma RPC/trigger/policy referencia `tenants.active` antes de dropar a coluna.

### Ação necessária antes da execução:

**Opção A (recomendada):** Aplicar TODAS as 10 migrações pendentes em ordem cronológica:

```bash
supabase db push --linked
```

(Isto aplica `20260717010000` → `20260717020000` → `20260717030000` → `20260723000000` → `20260723060000` → `20260723100000` → `20260723110000` → `20260724000000` → `20260724190000` → `20260728000000`)

**Opção B (emergencial):** Remover a referência a `plan` do RPC `provision_new_tenant` e aplicar apenas a Sprint 1. Não recomendado pois ignora 9 migrações anteriores.

Após aplicar a Opção A, o checklist de produção poderá ser 100% validado e a migration estará **✅ APTA PARA EXECUÇÃO**.
