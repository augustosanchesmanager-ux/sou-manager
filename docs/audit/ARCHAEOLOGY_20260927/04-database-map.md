# Mapa de Banco de Dados

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. `sou-manager` — SoT (PostgreSQL + Supabase)

### 1.1 Visão Geral

| Dimensão | Valor | Evidência |
|---|---|---|
| Migrations | 163 arquivos SQL | `supabase/migrations/` |
| Tabelas inventariadas | 47 | `docs/security/SECURITY_AUDIT_RLS.md` |
| Com RLS | 37 | Idem |
| RLS helpers | `current_tenant_id_from_auth_uid()`, `current_is_super_admin_from_auth_uid()` | Ambos SECURITY DEFINER |
| RPCs auditadas | 20+ | `docs/security/SECURITY_AUDIT_RPC.md` |
| Schemas | `public` + `barber`, `auto`, `club`, `estetica` | `schemas.ts` |
| Multi-schema | Opcional via `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | `schemas.ts:97-98` |

### 1.2 Tabelas Core (`public`)

| Tabela | Propósito | RLS |
|---|---|---|
| `tenants` | Cadastro de tenants | ✅ |
| `profiles` | Perfis de usuário | ✅ |
| `staff` | Equipe | ✅ |
| `apps` | Registro de apps | ✅ |
| `audit_logs` | Logs de auditoria | ✅ |
| `user_tenants` | Associação usuário-tenant | ✅ |
| `tenant_addons` | Addons | ✅ |
| `notifications` | Notificações | ✅ |
| `portal_sessions` | Sessões portal | ✅ |
| `service_execution_participants` | Participantes | ✅ |
| `support_tickets` | Tickets | ✅ |
| `financial_reversals` | Reversões | ✅ |
| `ticket_messages` | Mensagens | ✅ |
| `otp_requests` | OTP | ✅ |

### 1.3 Tabelas Domain (`barber` schema quando multi-schema)

| Tabela | Propósito |
|---|---|
| `appointments` | Agendamentos |
| `clients` | Clientes |
| `comandas` | Comandas |
| `comanda_items` | Itens da comanda |
| `services` | Catálogo de serviços |
| `products` | Produtos |
| `transactions` | Transações financeiras |
| `customer_subscriptions` | Club dos Chefes |
| `customer_credits` | Créditos |
| `schedule_blocks` | Blocos de agenda |
| `purchase_orders` | Ordens de compra |
| `suppliers` | Fornecedores |
| `feedback_barber` / `feedback_shop` | Feedback |
| `kiosk_devices` / `kiosk_sessions` | Kiosk |
| `promotions` | Promoções |

### 1.4 RLS Policies (Padrão SoT)

```sql
-- Padrão: SECURITY DEFINER + tenant_id
CREATE POLICY "Tenant isolation" ON barber.appointments
  FOR ALL USING (tenant_id = current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = current_tenant_id_from_auth_uid());

-- Superadmin bypass
CREATE POLICY "Superadmin bypass" ON public.profiles
  FOR ALL USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());
```

### 1.5 Event Store (Fase 4)

Tabela `event_store` (migration `20260723100000_event_store.sql`):
- Append-only (sem UPDATE/DELETE policies)
- RLS habilitado (superadmin bypass + tenant isolation)
- 6 índices (aggregate, correlation, tenant, type, time, source)
- `payload` (JSONB) e `metadata` (JSONB) separados

### 1.6 Outbox + Processed Operations

- `outbox` table: status lifecycle `pending → processing → published → pending(backoff) → dead_letter`
- `processed_operations` table: UNIQUE `(tenant_id, idempotency_key)`, append-only

---

## 2. `sanchez-barber-iastudio` — Shadow DB

### 2.1 Schema

| Tabela | Colunas | `tenant_id` | RLS |
|---|---|---|---|
| `profiles` | 7 colunas | ❌ | ✅ Enabled |
| `appointments` | 19 colunas | ❌ | ✅ Enabled |
| `admin_emails` | 1 coluna | ❌ | ✅ Enabled |

### 2.2 Problemas

| # | Problema | Evidência |
|---|---|---|
| 1 | Zero `tenant_id` em qualquer tabela | `schema.sql` — 196 linhas verificadas |
| 2 | RLS permissiva (`OR` de 3 condições) | `schema.sql:169-177` |
| 3 | `is_admin()` por allowlist de email | `schema.sql:122-132` |
| 4 | Colunas legado `date`/`month`/`time` coexistem com `appointment_at` | `schema.sql:76-96` |
| 5 | Zero migrations — um `schema.sql` monolítico | README:19 |
| 6 | `user_email` spoofing via `auth.uid() = user_id OR` | `schema.sql:169` |
| 7 | `service_id`/`barber_id` são TEXT, não UUID | `schema.sql:27-28` |

### 2.3 RLS Policy (Perniciosa)

```sql
create policy "users can insert own appointments" on public.appointments
for insert with check (
  auth.uid() = user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(user_email)
  or public.is_admin()
);
```

**Exploração:** Um usuário autenticado com `auth.uid() = user_id` pode inserir `user_email` de terceiro → quando a vítima usa o site, o atacante injeta agendamento falso na agenda SMG.

---

## 3. `SMG_LOUGE` — Split-Brain

### 3.1 Schema `lounge.*` (Real)

27 tabelas em `database/migrations/001`–`028`:
- `events`, `spaces`, `promoters`, `reservations`, `payments`, `bracelets`, `access_lists`, `check_ins`, `products`, `stock_movements`, `orders`, `order_items`, `initial_consumption`, `financial_closings`, `audit_logs`, `promoter_commissions`, `executive_dashboard`

### 3.2 Schema `public.*` (Legacy)

8 tabelas em `database/schema.sql` + `database/phase1_migration.sql`:
- `events`, `lounges`, `promoters`, `reservations`, `sessions`, `orders`, `order_items`, `profiles`

**Problema:** `database/schema.sql` explicitamente **desabilita RLS** em `public.events`, `public.lounges`, `public.promoters`, `public.reservations`, `public.sessions`, `public.orders` e os adiciona a `supabase_realtime`.

### 3.3 Inconsistências de Colunas

| Tabela | `public.*` | `lounge.*` |
|---|---|---|
| `reservations` | `check_in_count` | `checkin_count` |
| `promoters` | `comission_rate` (typo) | `commission_rate` |
| `promoters` | `comission_rate` | `commission_rate` |

### 3.4 RLS Gaps

| # | Problema | Evidência |
|---|---|---|
| 1 | `public.*` RLS desabilitado | `schema.sql` |
| 2 | `SupabaseSync` sem tenant filter | `SupabaseSync.tsx` |
| 3 | `log_audit_action` usa `current_setting('app.tenant_id')` sem `set_config` | `013_audit_logs.sql` |
| 4 | RPCs `approve_promoter_commission`, `mark_promoter_commission_paid` sem auth check | `026_promoter_commissions.sql` |
| 5 | `get_event_dashboard_snapshot(p_tenant_id, p_event_id)` — tenant_id como parâmetro | `025_event_executive_dashboard_rpc.sql` |
| 6 | Política recursiva em `public.profiles` | `019_tenant_hardening.sql` |

---

## 4. `gerador_orcamentos` — Supabase (Inseguro)

### 4.1 Migrations (11 arquivos)

| Migration | Tabelas | RLS |
|---|---|---|
| `001` | `tenants` | ❌ Nunca tocado |
| `002` | `budgets` | ⚠️ `USING(true) WITH CHECK(true)` |
| `009` | `budget_items` | ❌ Não existe em migrations |
| `011` | `customers` | ❌ **RLS explicitamente DESABILITADO** |

### 4.2 Problemas

| # | Problema | Evidência |
|---|---|---|
| 1 | `budgets` RLS `USING(true)` = totalmente aberto | `009_budgets.sql` |
| 2 | `customers` RLS desabilitado | `011_customers.sql` |
| 3 | `budgets.status` coluna não existe em migrations | `api/budgets.ts:106` |
| 4 | `budget_items` tabela não existe em migrations | `api/budgets.ts:143` |
| 5 | `users`/`user_profiles` referenciadas mas não criadas | Código |
| 6 | `password` em plaintext | `api/register.ts:43` |
| 7 | `x-tenant-id` confiado sem validação | `api/*.ts` |
| 8 | Login fake (base64 JSON, não JWT) | `api/login.ts` |
| 9 | `exec_sql` RPC (SQL arbitrário) | Código |
| 10 | `service_role` JWT no bundle | `index.html` |

---

## 5. `smg-core` — Dois Bancos

### 5.1 `platform` (Prisma + PostgreSQL)

14 tabelas, **ZERO RLS**:

| Tabela | Propósito |
|---|---|
| `platform_tenants` | Tenants com plano |
| `platform_users` | Usuários com bcrypt |
| `platform_roles` | Roles |
| `platform_permissions` | Permissions granular |
| `platform_user_tenants` | Associação |
| `platform_plans` | Planos |
| `platform_feature_flags` | Feature flags |
| `platform_integrations` | Integrações |
| `platform_jobs` | Jobs |
| `platform_api_logs` | Logs de API |
| `platform_error_logs` | Logs de erro |
| `platform_audit_logs` | Audit logs |
| `platform_security_events` | Eventos de segurança |
| `platform_invoices` | Faturamento (draft) |

### 5.2 `control` (Supabase)

8 tabelas com RLS + SECURITY DEFINER:

| Tabela | Propósito |
|---|---|
| `smg_client_apps` | Client→app→tenant→schema mapping |
| `admin_profiles` | Perfis de admin (FK auth.users) |
| `app_health_checks` | Health checks |
| `app_incidents` | Incidentes |
| `integration_logs` | Logs de integração |

### 5.3 Problemas

| # | Problema | Evidência |
|---|---|---|
| 1 | Zero RLS no `platform` | `migration.sql` |
| 2 | `is_admin()` inclui viewer/finance/support | `harden migration` |
| 3 | Escalão privilege escalation | `admin_profiles` policy `FOR ALL` |
| 4 | `x-tenant-id` confiado | `tenant-context.middleware.ts` |
| 5 | Billing draft não aplicado | `control-schema-draft.sql` |
| 6 | `smg_invoices`/`billing_events` só no draft | Não em migrations |

---

## 6. `SMG_AUTOCONTROL` — Sem Banco

**Zero** tabelas, migrations, RLS, triggers, enums, índices.

As "entidades" são 7 interfaces TypeScript em `src/types/index.ts` — 100% órfão.

Se alguém criar schema a partir dele sem `tenant_id NOT NULL` + RLS, o resultado será **isolamento multi-tenant quebrado**.

---

## 7. `SMG_LADINGPAGE` — Sem Banco

**Zero** banco de dados. Apenas HTML/CSS/JS estático.

---

## 8. Matriz Comparativa de RLS

| Repositório | RLS Ativo? | Cobertura | Tenant Isolation | Severidade |
|---|---|---|---|---|
| `sou-manager` | ✅ | 37/47 tabelas | ✅ `current_tenant_id_from_auth_uid()` | ✅ Seguro |
| `sanchez` | ⚠️ | Habilitada mas permissiva | ❌ Zero `tenant_id` | 🔴 Crítico |
| `LOUGE` | ⚠️ | Gaps + split-brain | ⚠️ Parcial | 🟠 Alto |
| `gerador` | ❌ | `USING(true)` + desabilitado | ❌ Header confiado | 🔴 Crítico |
| `smg-core` | ❌ | Zero no `platform` | ❌ Header confiado | 🔴 Crítico |
| `AUTOCONTROL` | ❌ | Não existe | ❌ Não existe | 🟡 Médio |
| `LADINGPAGE` | ❌ | Não existe | ❌ Não existe | 🟢 Baixo |
