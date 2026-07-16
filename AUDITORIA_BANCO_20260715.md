# RELATÓRIO DE AUDITORIA COMPLETA — PÓS-MIGRATION 2026-07-15

> **Data:** 2026-07-15
> **Migration aplicada:** `20260715000000_fix_rls_transactions_and_standardize_comandas.sql`
> **Escopo:** Schema completo, RLS, policies, funções, triggers, FKs, índices, Edge Functions

---

## ÍNDICE

1. [Resumo Executivo](#1-resumo-executivo)
2. [Migration Aplicada — O que foi corrigido](#2-migration-aplicada)
3. [Matriz RLS Completa (42 tabelas)](#3-matriz-rls-completa)
4. [Funções SQL de RLS](#4-funções-sql-de-rls)
5. [Triggers Ativos](#5-triggers-ativos)
6. [Foreign Keys](#6-foreign-keys)
7. [Índices](#7-índices)
8. [Bugs Encontrados — Edge Function admin-create-user](#8-bugs-encontrados)
9. [Divergências de Tenant](#9-divergências-de-tenant)
10. [Ações Recomendadas](#10-ações-recomendadas)
11. [Scripts de Validação](#11-scripts-de-validação)

---

## 1. RESUMO EXECUTIVO

### Antes da Migration
- `transactions` criada **sem RLS** → qualquer authenticated lia/escrevia cross-tenant
- `comandas`/`comanda_items` usavam `get_current_tenant_id()` → funcionários criados via Edge Function (existentes apenas em `staff`) não conseguiam ler comandas
- `profiles.status` referenciada no código mas **coluna inexistente**

### Depois da Migration
- ✅ `transactions` com RLS habilitado + política de isolamento
- ✅ `comandas`/`comanda_items` padronizadas para `current_tenant_id_from_auth_uid()`
- ✅ `profiles.status` criada com DEFAULT 'active'

### Status Geral

| Métrica | Valor |
|---|---|
| Total de tabelas `public` | ~45 |
| Tabelas com RLS habilitado | 42 |
| Tabelas **sem RLS** | ~3 (user_tenants, apps — não verificadas) |
| Total de policies | ~120 |
| Policies usando função correta (`current_tenant_id_from_auth_uid`) | 13 |
| Policies ainda com função **legada** (`get_current_tenant_id`) | ~12 |
| Policies com **`USING (true)`** (sem isolamento) | 5 |
| Policies com **`current_setting()`** (broken) | 1 |
| Funções SQL de RLS | 6 |
| Triggers ativos | ~12 |
| Foreign Keys | ~35 |
| Índices | ~50 |

---

## 2. MIGRATION APLICADA

**Arquivo:** `supabase/migrations/20260715000000_fix_rls_transactions_and_standardize_comandas.sql`

### O que foi feito:

| # | Ação | Status |
|---|---|---|
| 1 | `ALTER TABLE transactions ENABLE ROW LEVEL SECURITY` | ✅ |
| 2 | Criada policy `tenant_isolation_transactions` USING `current_tenant_id_from_auth_uid()` | ✅ |
| 3 | Recriada policy `tenant_isolation_comandas` — de `get_current_tenant_id()` para `current_tenant_id_from_auth_uid()` | ✅ |
| 4 | Recriada policy `tenant_isolation_comanda_items` — de `get_current_tenant_id()` para `current_tenant_id_from_auth_uid()` | ✅ |
| 5 | `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'` | ✅ |
| 6 | `NOTIFY pgrst, 'reload schema'` | ✅ |

### Efeito esperado:
- Funcionários criados via `admin-create-user` (que existem em `staff` mas não necessariamente em `profiles`) agora conseguem ler comandas
- `transactions` agora tem isolamento por tenant (antes era访问ável por todos)
- `profiles.status` existe para uso por `get_auth_access_context`

---

## 3. MATRIZ RLS COMPLETA

### 3.1 Tabelas com RLS Correto (✅ MODERNO)

| Tabela | Policies | Função | Super Admin Bypass | WITH CHECK |
|---|---|---|---|---|
| `staff` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `notifications` | SELECT/INSERT/UPDATE | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `comandas` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `comanda_items` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `transactions` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | implicit |
| `appointments` | ALL + public | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `clients` | ALL + public | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `schedule_blocks` | ALL + public | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `customer_plans` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `customer_subscriptions` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `customer_credits` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `customer_subscription_receivables` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |
| `customer_vouchers` | ALL | `current_tenant_id_from_auth_uid()` | ✅ | ✅ |

### 3.2 Tabelas com Função Legada (⚠️ LEGADO)

| Tabela | Função Usada | Problema |
|---|---|---|
| `profiles` | `get_current_tenant_id()` | Só verifica `profiles`, sem superadmin bypass |
| `tenants` | `get_current_tenant_id()` | SELECT only, sem superadmin bypass |
| `audit_logs` | `get_current_tenant_id()` | SELECT only, sem superadmin bypass |
| `support_tickets` | `get_current_tenant_id()` | Tem superadmin separado, mas função legada |
| `products` | `get_current_tenant_id()` | Sem superadmin bypass |
| `promotions` | `get_current_tenant_id()` | Sem superadmin bypass |
| `purchase_orders` | `get_current_tenant_id()` | Sem superadmin bypass |
| `services` | `get_current_tenant_id()` | Sem superadmin bypass |
| `suppliers` | `get_current_tenant_id()` | Sem superadmin bypass |

### 3.3 Tabelas com RLS Aberto (🔴 SEM ISOLAMENTO)

| Tabela | Policy | Risco |
|---|---|---|
| `kiosk_devices` | `FOR ALL USING (true)` | Cross-tenant: qualquer usuário lê/escreve dispositivos de outros tenants |
| `kiosk_sessions` | `FOR ALL USING (true)` | Cross-tenant: sessões de kiosk expostas |
| `feedback_barber` | `FOR ALL USING (true)` | Cross-tenant: feedback de barbeiros exposto |
| `feedback_shop` | `FOR ALL USING (true)` | Cross-tenant: feedback da loja exposto |
| `kiosk_addons` | `FOR ALL USING (true)` | Cross-tenant: addons expostos |

### 3.4 Tabelas com Função Broken (🔴 BROKEN)

| Tabela | Policy | Problema |
|---|---|---|
| `service_execution_participants` | `USING (current_setting('app.current_tenant_id', true)::uuid)` | `current_setting` retorna `NULL` em queries client-side → isolamento completamente quebrado |

### 3.5 Tabelas com Função JWT-Monitoring (🔵 DIFERENTE)

| Tabela | Função |
|---|---|
| `usage_logs` | `is_super_admin()` (via JWT) |
| `alerts` | `is_super_admin()` (via JWT) |
| `notification_channels` | `is_super_admin()` (via JWT) |

### 3.6 Tabelas com Políticas Públicas (por design)

| Tabela | Política Pública | Motivo |
|---|---|---|
| `tenants` | `SELECT (true)` | Portal/kiosk precisa ver nomes |
| `staff` | `SELECT (true)` | Portal/kiosk precisa ver barbeiros |
| `services` | `SELECT (true)` | Portal/kiosk precisa ver serviços |
| `clients` | `INSERT/SELECT (true)` | Kiosk cria clientes |
| `appointments` | `INSERT/SELECT (true)` | Kiosk cria agendamentos |
| `schedule_blocks` | `SELECT (active)` | Portal mostra horários |

---

## 4. FUNÇÕES SQL DE RLS

| Função | SECURITY DEFINER | Descrição |
|---|---|---|
| `current_tenant_id_from_auth_uid()` | ✅ | Verifica `profiles` + `staff` para obter `tenant_id` |
| `current_is_super_admin_from_auth_uid()` | ✅ | Verifica se o usuário é superadmin |
| `get_current_tenant_id()` | ✅ | **LEGADO** — só verifica `profiles` |
| `is_super_admin()` | ✅ | Verifica JWT metadata (diferente da outra) |
| `get_auth_access_context()` | ✅ | RPC que retorna access role + tenant |
| `set_tenant_id_from_profile()` | ✅ | Trigger: seta `tenant_id` em INSERT |
| `handle_new_manager_profile()` | ✅ | Trigger: insere manager em `staff` |

---

## 5. TRIGGERS ATIVOS

| Trigger | Tabela | Evento | Função |
|---|---|---|---|
| `set_tenant_id_on_insert` | domínio (appointments, clients, etc.) | BEFORE INSERT | `set_tenant_id_from_profile()` |
| `on_profile_created` | `profiles` | AFTER INSERT | `handle_new_manager_profile()` |
| `audit_log_trigger` | diversas tabelas | AFTER INSERT/UPDATE/DELETE | `log_audit_change()` |

---

## 6. FOREIGN KEYS PRINCIPAIS

| Tabela | Coluna → Tabela.Coluna | ON DELETE |
|---|---|---|
| `comandas` | `client_id → clients.id` | SET NULL |
| `comandas` | `staff_id → staff.id` | SET NULL |
| `comanda_items` | `comanda_id → comandas.id` | CASCADE |
| `comanda_items` | `service_id → services.id` | SET NULL |
| `appointments` | `client_id → clients.id` | SET NULL |
| `appointments` | `staff_id → staff.id` | SET NULL |
| `staff` | `id → auth.users.id` | CASCADE |
| `profiles` | `id → auth.users.id` | CASCADE |
| `transactions` | `tenant_id → tenants.id` | — |
| `customer_subscriptions` | `client_id → clients.id` | CASCADE |
| `customer_credits` | `subscription_id → customer_subscriptions.id` | CASCADE |

---

## 7. ÍNDICES DE PERFORMANCE

| Tabela | Índice | Colunas |
|---|---|---|
| `appointments` | `idx_appointments_tenant_start` | `tenant_id, start_time` |
| `appointments` | `idx_appointments_staff_date` | `staff_id, start_time` |
| `appointments` | `idx_appointments_client` | `client_id` |
| `comandas` | `idx_comandas_tenant_status` | `tenant_id, status` |
| `comandas` | `idx_comandas_staff` | `staff_id` |
| `comanda_items` | `idx_comanda_items_comanda` | `comanda_id` |
| `clients` | `idx_clients_tenant` | `tenant_id` |
| `clients` | `idx_clients_email` | `email` |
| `transactions` | `idx_transactions_tenant_date` | `tenant_id, date` |
| `transactions` | `idx_transactions_type` | `type` |
| `schedule_blocks` | `idx_schedule_blocks_tenant` | `tenant_id` |
| `customer_subscriptions` | `idx_subscriptions_client` | `client_id` |
| `customer_credits` | `idx_credits_subscription` | `subscription_id` |

---

## 8. BUGS ENCONTRADOS — EDGE FUNCTION admin-create-user

### 🔴 BUG CRÍTICO: Staff upsert failure invisível ao usuário

**Localização:** `supabase/functions/admin-create-user/index.ts:196-212` + `pages/Team.tsx:172`

**Fluxo:**
1. Edge Function cria auth user com sucesso
2. Staff upsert falha
3. Edge Function retorna HTTP **200** com `{ user, warning, staff_error }`
4. `supabase.functions.invoke` retorna `{ data: body, error: null }` (2xx)
5. Team.tsx verifica `if (edgeError || edgeData?.error)` → **FALSO** (não há erro nem campo `error`)
6. Código cai na linha 222: `if (edgeData?.user?.id)` → **VERDADEIRO**
7. Toast mostra **"Colaborador cadastrado com sucesso!"**

**Resultado:** O usuário vê sucesso quando o registro staff falhou. O auth user existe mas o staff não.

### 🟠 BUG HIGH: `staff_error.code` perdido no parsing

**Localização:** `pages/Team.tsx:195-197`

Quando `staff_error` vem no body parseado (não no `edgeData`), o `code` não é capturado — só o `message` vai para `details`.

### 🟠 BUG HIGH: Update pós-criação ignora erros

**Localização:** `pages/Team.tsx:222-231`

```ts
await supabase
    .from('staff')
    .update({ phone: form.phone, commission_rate: ... })
    .eq('id', edgeData.user.id)
    .eq('tenant_id', tenantId);
// Sem .then()/.catch() — erros silenciados
```

### 🟡 BUG MEDIUM: Paths A-F sem campos estruturados

Paths de validação (auth, role, campos obrigatórios) retornam só `{ error: "..." }` sem `code`/`details`/`hint`.

### 🟡 BUG MEDIUM: `edgeData?.message` pode shadowar `error`

**Localização:** `pages/Team.tsx:174`

`edgeData?.message` é checado antes de `edgeError?.message` — se o SDK injetar um campo `message`, ele shadowa o erro real.

### ℹ️ BUG LOW: Erro em inglês no toast

Path I (usuário duplicado + listUsers falha) mistura mensagem em inglês no toast em português.

---

## 9. DIVERGÊNCIAS DE TENANT

### 9.1 Tabelas com `tenant_id` mas sem RLS

| Tabela | Status |
|---|---|
| `user_tenants` | ❓ RLS não verificada em migrations |
| `apps` | ❓ RLS não verificada em migrations |

### 9.2 Tabelas no código (`schemas.ts`) mas não no classification

| Tabela | DOMAIN_TABLES? | RLS OK? |
|---|---|---|
| `cash_closings` | ❌ | ✅ (falta superadmin bypass) |
| `tenant_goals` | ❌ | ✅ |
| `notification_preferences` | ❌ | ✅ |
| `inventory_movements` | ❌ | ✅ (SELECT only) |

### 9.3 Políticas públicas sem `tenant_id` check

Tabelas com `USING (true)` permitem que **anon** crie registros **sem `tenant_id` válido**, já que o trigger `set_tenant_id_from_profile()` depende de `auth.uid()` que é `NULL` para anon.

---

## 10. AÇÕES RECOMENDADAS

### 🔴 URGENTE (antes do próximo deploy)

| # | Ação | Arquivo |
|---|---|---|
| 1 | **Fix staff upsert invisível** — retornar HTTP 400 ou incluir `error` field quando staff falhar | `admin-create-user/index.ts` |
| 2 | **Fix `service_execution_participants`** — substituir `current_setting()` por `current_tenant_id_from_auth_uid()` | Nova migration |
| 3 | **Fix kiosk tables** — substituir `USING (true)` por policies com `tenant_id` | Nova migration |

### 🟠 ALTA (próximas 2 semanas)

| # | Ação | Arquivo |
|---|---|---|
| 4 | Migrar `products`, `services`, `promotions`, `purchase_orders`, `suppliers` de `get_current_tenant_id()` para `current_tenant_id_from_auth_uid()` | Nova migration |
| 5 | Adicionar superadmin bypass em `cash_closings` | Nova migration |
| 6 | Adicionar tabelas faltantes ao `DOMAIN_TABLES` em `schemas.ts` | `src/lib/supabase/schemas.ts` |
| 7 | Adicionar campos `code`/`details`/`hint` nos paths de validação da Edge Function | `admin-create-user/index.ts` |

### 🟡 MÉDIA (próximo sprint)

| # | Ação | Arquivo |
|---|---|---|
| 8 | Fix `staff_error.code` perdido no parsing de Team.tsx | `pages/Team.tsx` |
| 9 | Adicionar error handling no update pós-criação | `pages/Team.tsx` |
| 10 | Migrar monitoring tables para `current_is_super_admin_from_auth_uid()` | Nova migration |
| 11 | Verificar RLS de `user_tenants` e `apps` no banco ao vivo | SQL Editor |

---

## 11. SCRIPTS DE VALIDAÇÃO

Dois scripts SQL foram criados para validação manual:

### `supabase/migrations/_audit_queries.sql`
15 queries de auditoria que mapeiam:
- Todas as tabelas com status de RLS
- Todas as policies por tabela e operação
- Classificação de cada policy (MODERNO/LEGADO/BROKEN/ABERTO)
- Funções SQL com código-fonte
- Triggers e trigger functions
- Foreign keys
- Índices
- Colunas `tenant_id` sem RLS

**Como rodar:** Copiar para Supabase SQL Editor → Execute → Salvar resultado

### `supabase/migrations/_functional_tests.sql`
12 testes automatizados que verificam:
- RLS habilitado em `transactions`
- Policy de `transactions` usa função correta
- Policies de `comandas`/`comanda_items` usam `current_tenant_id_from_auth_uid()`
- Coluna `profiles.status` existe
- Funções de RLS existem
- Tabelas vulneráveis (sem RLS + tenant_id)
- Policies abertas (USING true)
- Policies broken (current_setting)
- Resumo executivo

**Como rodar:** Copiar para Supabase SQL Editor → Execute → Verificar coluna `status` (✅/❌/🔴)

---

## ANEXO: Build Status

```
✅ npm run build — SUCESSO (2652 modules, 8.97s)
```

Nenhum erro de compilação. Todos os imports resolvidos corretamente.
