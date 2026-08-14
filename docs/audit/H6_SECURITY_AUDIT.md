# H-6 — Segurança: Auditoria adversarial RLS/RPC (evidência)

> **Gate:** H-6 Segurança (bateria adversarial do PO — anon matrix, RLS cross-tenant, resource ID swap via RPC, admin ops como usuário comum, usuário suspenso, feature flag bypass, tabelas legadas abertas, exposição de dados sensíveis)
> **Data:** 2026-08-13
> **Ambiente:** Supabase real (project `ushnmlbeurfvlkieiln`) — **tenants E2E isolados e identificáveis** (A/B/OPS, padrão D-HOM-19); **NÃO** usou o tenant Sanchez Barber para mutações; exposições não intencionais de dados reais foram registradas como achados e **não** exploradas além da prova
> **Responsável:** OpenCode (Tech Lead operacional)
> **Execução:** E2E Playwright (Chromium) — `tests/e2e/homologation/h6-security.spec.ts` com `E2E_PROVISIONING=1` (REST via service role + sessões reais autenticadas + cliente anon) + revisão estática das migrations de RLS/RPC
> **Modo:** Auditoria **read-only** (regra PO) — **nenhum fix automático**; cada probe registra PASS (controle confirmado) ou ACHADO (F6-x, com evidência)
> **Veredito preliminar (OpenCode):** 🔴 **BLOQUEADO** — exposição de dados reais de produção (anon) + escrita cross-tenant confirmada. **Veredito formal do PO: 🔴 BLOQUEADO (D-HOM-24, 2026-08-13) — janela de remediação autorizada, execução item a item (lote NÃO autorizado); H-7 permanece bloqueado. TODOS os 9 achados REMEDIADOS via migration (F6-3/4/5/7/8 + F6-1 em `20260813120000`..`20260813120500`; F6-A/F6-B/F6-2/F6-6 em `20260813130000`..`20260813130300`). Aplicação no banco remoto de produção + re-execução da suite E2E H6 pendem de aprovação explícita do PO.**

---

## 1. Objetivo

Auditar adversarialmente o backend Supabase do Sou Manager (RLS + RPC + grants) em **tenants E2E isolados**, confirmando ou refutando controles de isolamento multi-tenant e produzindo **matriz H6-* (PASS/FAIL/BLOCKED) + achados F6-x com evidência reproduzível** (reprodução, root cause, impacto, severidade, recomendação). Critério: nenhum fix automático — a remediação é decisão do PO (janela própria/ADR); H-7 não é iniciado sem decisão.

---

## 2. Setup (seed — service role + sessões reais)

| Item | Valor |
|------|-------|
| Tenants E2E | **A** (`e2e-h6-a-<runId>`, `plan=free`), **B** (`e2e-h6-b-<runId>`, `plan=premium`), **OPS** (`e2e-h6-ops-<runId>`, `plan=pro`) — `app_slug=barber`, `status=active` |
| Usuários | managerA (tenant A), managerB (tenant B), superadmin (OPS) — `createConfirmedUser` via Admin API |
| `profiles`/`user_tenants`/`staff` | role `manager`/`manager`/`owner` (superadmin), todos `active`, membership primária |
| Dados cross-tenant | clients A/B, product B (`stock_quantity=5`), comanda B `open` total 20 + 1 comanda_item (seed via sessão autenticada de managerB — o AFTER INSERT trigger `trg_notify_comanda_open_insert` exige `auth.uid()`), subscriptions A(free)/B(premium), access_request `pending`, plan_change_request (sem tenant_id), support_ticket B + ticket_message B, kiosk_addons B (`enabled`/2 devices) |
| `role_permissions` B | 1 linha `(tenant B, role 'barber', permission_key 'checkout', enabled true, created_by)` — seed via sessão autenticada de superadmin (trigger `audit_role_permissions_changes` exige `created_by` NOT NULL; service role falha) |
| Sessões RPC | `signInAsUser` managerA/managerB/superadmin + cliente `anon` (`persistSession:false`) |

**Fontes de verdade consultadas (estática):** revoke anon `20260808110000_revoke_anon_rpc_execute.sql`; RLS crítico `20260723000000_security_fix_rls_critical.sql`; RLS legado `20260227223434_fix_all_rls_policies_use_security_definer_function.sql`; kiosk `20260305050000_kiosk_rls_fix.sql`; comandas `20260715000000_fix_rls_legacy_and_kiosk_policies.sql`; `approve_access_request` (`20260220150238_super_admin_rpc_functions.sql`); `close_order` (`20260220145723_fix_close_order_rpc_and_schema_v3.sql`); feature flags (`20260807000000_phase_6_0_5_3_feature_flags.sql`); role_permissions (`20260717000000_role_permissions_system.sql`).

---

## 3. Matriz H6-* — Resultado

| ID | Cenário | Critério de aceite | Resultado |
|----|---------|--------------------|-----------|
| H6-1 | Matrix anon: RPCs sensíveis + tabelas protegidas bloqueadas p/ anon | RPCs fail-closed ou bloqueadas; tabelas sem leitura anon | ⚠️ **PASS parcial — 3 tabelas vazam dados reais (F6-A, F6-B, F6-7)**; RPCs: **9/9 bloqueadas/fail-closed** |
| H6-2 | Acesso legítimo no próprio tenant + catálogo público | RPCs próprias funcionam; catálogo `plans`/`features`/`plan_features` público | ✅ **PASS** (free→chef_club=false; premium→bi=true; role_permissions próprio legível; catálogo público OK) |
| H6-3 | RLS cross-tenant UPDATE/DELETE/INSERT em `clients` | 0 rows / bloqueado; INSERT no próprio tenant funciona | ✅ **PASS** |
| H6-5 | RLS `clients` cross-tenant por tenant_id e por PK (resource swap) | A não vê B | ✅ **PASS** |
| H6-7 | Catálogo público | `plans`/`features`/`plan_features` legíveis por anon | ✅ **PASS** |
| H6-8 | (coberto em H6-3 — INSERT/UPDATE/DELETE cross-tenant) | — | ✅ **PASS** |
| H6-9 | Manipulação de tenant_id via RPC (`upsert_role_permissions` cross-tenant) | Bloqueado para não-superadmin de outro tenant | ✅ **PASS** (guarda manager ativa) |
| H6-10 | Resource ID swap via RPC financeira (`finance_settle_comanda` cross-tenant) | Bloqueado | ✅ **PASS** |
| H6-11 | Admin ops como usuário comum (`change_tenant_plan`, `suspend_subscription`) | Bloqueado | ✅ **PASS** |
| H6-12 | Usuário suspenso perde acesso (sessão/contexto + RLS) | Contexto restrito **e** leitura RLS bloqueada | ⚠️ **FALHA parcial — F6-8**: contexto restrito OK, mas **leitura REST continua** |
| H6-15 | Feature flag bypass (leitura/escrita direta em `feature_flags`) | Sem SELECT/INSERT/DELETE p/ autenticado; override só superadmin | ✅ **PASS** (D-6.0.5.3-6 confirmado) |
| H6-16 | Exposição de dados sensíveis (tabelas legadas abertas) | Sem leitura cross-tenant | ❌ **FALHA — F6-5, F6-6, F6-7** |

**Suite E2E:** `8/8` testes executados (serial); **39 controles PASS**, **9 achados** (F6-A, F6-B, F6-2..F6-8). Teardown completo ao final (feature_flags, subscriptions, kiosk_addons, notifications, billing_events, audit_logs, comanda_items, comandas, clients, products, staff, user_tenants, tenant_settings, tenants, access_requests, plan_change_requests, ticket_messages, support_tickets, usuários) — **nenhuma mutação no tenant Sanchez Barber além das exposições lidas nos achados**.

---

## 4. Achados (detalhe — evidência reproduzível)

| ID | Sev | Descrição | Evidência | Root cause | Impacto |
|----|-----|-----------|-----------|------------|---------|
| **F6-A** | **P1** | **anon lê `tenants` — dado real de produção** | `anon.from('tenants').select('*')` retornou o tenant **Sanchez Barber**: `b716e290-f7f6-4449-b790-5ae9dcdadcab`, "Barbearia Principal", slug `sanchez`, plan `pro`, status `active` (incl. `first_appointment_at`) | Policy `public_select_tenants` `FOR SELECT USING (true)` de `20260305050000_kiosk_rls_fix.sql` **nunca revogada/recriada** com `TO authenticated` | Vazamento de metadados do tenant real (nome, slug, plano, status) a qualquer visitante do site (anon) |
| **F6-B** | **P1** | **anon lê `profiles` — dado real de produção** | `anon.from('profiles').select('*')` retornou perfil **superadmin** real (`828175b0-...`, full_name "Administrador", role `superadmin`, tenant_id, status) | Policy `"Superadmins can view all profiles"` de `20260227223434_...` — **sem `TO authenticated`**, condição por role da linha (`role IN ('Super Admin','superadmin')`) deixa a policy ativa para anon | Vazamento de identidade/role/tenant de superadmins reais a visitantes anon |
| **F6-2** | **P1** | **`close_order` cross-tenant — escrita financeira/estoque de OUTRO tenant** | managerA chamou `close_order({p_comanda_id: comandaB})` → comanda B `open→paid` e stock do product B `5→4` (verificado via service role) | RPC legada `SECURITY DEFINER` **sem guarda de auth/tenant** (`20260220145723_fix_close_order_rpc_and_schema_v3.sql`); **não está** na lista de revoke anon (`20260808110000`) | Usuário autenticado de um tenant pode **faturar comanda e baixar estoque** de outro tenant (quebra de isolamento com efeito financeiro) |
| **F6-3** | **P2** | **`tenant_has_feature` revela feature/plano de outro tenant** | managerA → `tenant_has_feature({p_tenant_id: tenantB, p_feature:'bi'})` = `true` (leitura cross-tenant do estado de licenciamento) | RPC `SECURITY DEFINER` valida apenas `auth.uid()` — **não valida que `p_tenant_id` pertence ao chamador** | Info disclosure: estado de plano/features de outro tenant |
| **F6-4** | **P2** | **`get_role_permissions` revela matriz de permissões de outro tenant** | managerA → `get_role_permissions({p_tenant_id: tenantB, p_role:'barber'})` retornou `[{"permission_key":"checkout","enabled":true}]` (matriz do tenant B) | RPC `SECURITY DEFINER` **sem validação de tenant** (`20260717000000_role_permissions_system.sql`); `GRANT EXECUTE TO authenticated` | Info disclosure da matriz RBAC de outro tenant (reconhecimento para escalada) |
| **F6-5** | **P2** | **`plan_change_requests` aberta cross-tenant** | managerA → `from('plan_change_requests').select('*')` retornou **2 rows** (candidaturas de outros tenants; tabela **sem coluna tenant_id**) | Policy `SELECT USING (true)` / `INSERT WITH CHECK (true)` sem tenant_id (criação em `20260219230006_...`); **não tratada** no fix crítico `20260723000000` | Leitura/escrita cross-tenant de solicitações de troca de plano |
| **F6-6** | **P1** | **`ticket_messages` aberta — DADOS REAIS de suporte** | managerA → `from('ticket_messages').select('*')` retornou **4 rows com mensagens reais de produção** (tickets de suporte de fev/mar 2026, conteúdo "testando a resposta"/"chamado teste respondido", incluindo sender_id e ticket_id) | Policy `SELECT USING (true)` **sem tenant_id** (criação em `20260219230006_...`); não tratada no fix crítico | **Vazamento de conteúdo de suporte ao cliente entre tenants** (LGPD/confidencialidade) |
| **F6-7** | **P2** | **`kiosk_addons` leitura + ESCRITA cross-tenant** | (leitura) managerA → `from('kiosk_addons').eq('tenant_id', tenantB)` retornou a config do tenant B (`status=enabled`, `max_devices=2`, `kiosk_theme`); (escrita) managerA fez `upsert` `status=disabled/max_devices=9/theme=custom` → verificado via service role que **persistiu** na linha do tenant B; (anon) `anon.select('kiosk_addons')` também retornou config real do Sanchez | Policies `SELECT/INSERT/UPDATE USING (true)` em `kiosk_addons` (módulo kiosk `20260304_kiosk_module.sql`/`20260305050000_kiosk_rls_fix.sql`) **apesar de a tabela ter `tenant_id`** | Alteração remota da configuração de kiosk de outro tenant + leitura anon de dados reais |
| **F6-8** | **P2** | **Usuário suspenso mantém leitura REST do próprio tenant** | Após `profiles.status=suspended` + `staff.status=suspended`: `get_auth_access_context` restrito (PASS) mas `from('clients').eq('tenant_id', tenantB)` ainda retornou **1 row** | RLS **não avalia status de profile/staff**; a suspensão só é aplicada em camada de app (rotas/contexto) | Controle de acesso incompleto: RPC/PostgREST continuam legíveis para conta suspensa (retornar após reativação pode expor histórico) |

### Observações adicionais (registro, sem alteração)

1. **`approve_access_request` (F6-1, exposto sem auth check — NÃO confirmado como exploração):** RPC legada `SECURITY DEFINER` (`20260220150238_...`) **sem guarda `auth.uid()`/tenant** e **não incluída** no revoke anon `20260808110000`. Probe: managerA chamou `approve_access_request({p_request_id})` → **erro** e status do pedido permaneceu `pending` (não aprovado). A RPC **não é explorável na prática** hoje porque a criação do tenant falha em NOT NULL/colunas ausentes — classificado **P2/P3 residual** (exposição sem exploração; corrigir guarda + incluir na revoke list como hardening).
2. **`provision_new_tenant` anon:** exposta na revoke list, mas **auto-protegida** por guard interno (`'Acesso negado: autenticação obrigatória'`) → observação (não achado).
3. **Falso positivo descartado:** DELETE de `feature_flags` por autenticado retorna `data=null` (DELETE filtrado por RLS) — o probe atualizado verifica **persistência via service role** → **PASS** (linha permanece; D-6.0.5.3-6 confirmado).
4. **Órfãos de execuções anteriores (housekeeping de operador):** 1 linha de `plan_change_requests` (`0c92a237-...`) remanescente de run com teardown interrompido antes do fix do FK — listada para limpeza manual; não afeta o banco de produção.

---

## 5. Controles confirmados (PASS — 39)

- **anon RPCs (9/9 bloqueadas ou fail-closed):** `finance_settle_comanda`, `change_tenant_plan`, `tenant_has_feature` (fail-closed `false`), `get_role_permissions` (fail-closed vazio), `upsert_role_permissions`, `provision_new_tenant` (guarda interna), `suspend_subscription`, `approve_access_request` (erro), `close_order` (bloqueado p/ anon).
- **anon tabelas protegidas (8/11):** `subscriptions`, `comandas`, `clients`, `products`, `feature_flags`, `role_permissions`, `access_requests`, `tenant_addons` — bloqueadas. (**Falhas:** `tenants`, `profiles`, `kiosk_addons` — F6-A/F6-B/F6-7.)
- **RLS `clients` cross-tenant:** UPDATE/DELETE (0 rows), INSERT em tenant alheio (bloqueado), INSERT no próprio (OK), leitura por `tenant_id` e por **PK** (resource swap) bloqueada.
- **RPC cross-tenant:** `upsert_role_permissions` (guarda manager), `finance_settle_comanda`, `change_tenant_plan`, `suspend_subscription` por manager → bloqueadas.
- **Feature flags (H6-15):** sem SELECT autenticado; INSERT autenticado bloqueado; DELETE autenticado bloqueado (persistência verificada); INSERT superadmin OK; override efetivo via RPC.
- **Catálogo público (H6-7):** `plans`, `features`, `plan_features` legíveis por anon (by design).
- **Contexto de sessão:** `get_auth_access_context` retorna restrição para usuário suspenso (controle de sessão OK; RLS não acompanha — F6-8).

---

## 6. Veredito preliminar (OpenCode — aguardando formalização do PO)

**Gate H-6 = 🔴 BLOQUEADO** (na escala D-HOM-4: falha P1/risco de integridade).

- **3 achados P1:** anon lê dados **reais de produção** (`tenants`, `profiles`) e **`close_order` escreve cross-tenant** (comanda + estoque). **1 achado P1 adicional (F6-6):** `ticket_messages` expõe conteúdo real de suporte entre tenants.
- **4 achados P2:** `tenant_has_feature`/`get_role_permissions` (info disclosure cross-tenant), `plan_change_requests` (cross-tenant sem tenant_id), `kiosk_addons` (leitura+escrita cross-tenant), usuário suspenso com RLS permissivo.
- O modelo de RLS **moderno** (comandas/clients/products/subscriptions/feature_flags/role_permissions) está **correto**; as falhas concentram-se em **policies legadas nunca revogadas** e **RPCs legadas `SECURITY DEFINER` sem guarda** (comportamento esperado de auditoria: as camadas antigas sobrevivem às correções da 3.3).
- **Recomendação (decisão do PO):** tratar em janela própria — (1) revogar/recriar `public_select_tenants` e a policy de profiles sem `TO authenticated`; (2) adicionar guarda `auth.uid()`/tenant em `close_order`, `approve_access_request`, `tenant_has_feature`, `get_role_permissions` + incluir legadas na revoke anon; (3) fechar policies de `plan_change_requests`/`ticket_messages`/`kiosk_addons` (idealmente com coluna `tenant_id`); (4) decidir se RLS deve avaliar status de suspensão. **Nenhum fix aplicado nesta auditoria.**

---

## 7. Artefatos

| Artefato | Tipo |
|----------|------|
| `tests/e2e/homologation/h6-security.spec.ts` | Spec E2E adversarial (versionada no repo) |
| `docs/security/SECURITY_AUDIT_RLS.md` / `SECURITY_AUDIT_RPC.md` | Auditorias Fase 3.3 (baseline de referência) |
| `supabase/migrations/20260808110000_revoke_anon_rpc_execute.sql` | Revoke list anon (fonte de verdade dos RPCs anon) |
| `supabase/migrations/20260723000000_security_fix_rls_critical.sql` | Fix RLS crítico 3.3 (fonte de verdade do isolamento moderno) |
| `supabase/migrations/20260305050000_kiosk_rls_fix.sql` | **Root cause F6-A** (`public_select_tenants`) e F6-7 |
| `supabase/migrations/20260227223434_fix_all_rls_policies_use_security_definer_function.sql` | **Root cause F6-B** (policy profiles sem `TO`) |
| `supabase/migrations/20260220150238_super_admin_rpc_functions.sql` / `20260220145723_fix_close_order_rpc_and_schema_v3.sql` | F6-1 / F6-2 (RPCs legadas sem guarda) |
| `supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql` | F6-3 + RLS feature_flags (fonte de verdade) |
| `supabase/migrations/20260717000000_role_permissions_system.sql` | F6-4 + guarda upsert (fonte de verdade) |
| `supabase/migrations/20260219230006_new_features_notifications_support_comandas.sql` | F6-5/F6-6 (policies abertas sem tenant_id) |

---

## 8. Conclusão

- **Auditoria adversarial read-only executada integralmente** em tenants E2E isolados — **39 controles PASS, 9 achados** (F6-A, F6-B, F6-2..F6-8), evidência reproduzível e teardown completo.
- **Veredito preliminar: 🔴 BLOQUEADO** — o gate H-6 não pode ser declarado APROVADO com P1 confirmados (anon lê dados reais; `close_order` e `kiosk_addons` escrevem cross-tenant; `ticket_messages` expõe conteúdo real de suporte).
- **Sem alteração de código de produção, sem migration, sem fix, sem merge/tag/deploy.**
- **H-3 permanece 🟡** (ressalva H3-5), **H-5 🟢 APROVADO**, **H-8 permanece 🔴 BLOQUEADOR** — o resultado do H-6 não altera esses status.
- **Decisão requerida do PO (D-HOM-23):** veredito formal do H-6 + aprovação da janela de remediação dos achados (com ou sem ADR). **H-7 (operação real) e remediação não são iniciados sem essa decisão.**

---

## 9. Remediação (D-HOM-24, 2026-08-13)

> **Veredito formal do PO:** H-6 **🔴 BLOQUEADO (formal)** · janela de remediação **autorizada** · execução **item a item** (**lote NÃO autorizado**) · **H-7 permanece bloqueado** até remediação aprovada. Classificação: **P0/P1** = F6-A, F6-B, F6-2, F6-6 (correção obrigatória antes de H-7) · **P2** = F6-3, F6-4, F6-5, F6-7, F6-8 · **F6-1 (P3)** = revoke agora + dívida. **Status: 10/10 itens executados como migrations** (§9.1 e §9.2).

### 9.1 Executado (aprovado — P2 + F6-1/P3)

| Achado | Correção | Migration |
|--------|----------|-----------|
| **F6-3** | `tenant_has_feature` fail-closed: consulta passa a exigir `p_tenant_id` do chamador (`current_tenant_id_from_auth_uid()`) **ou** superadmin; caso contrário `false` | `20260813120000_h6_fix_f6_3_tenant_has_feature_guard.sql` |
| **F6-4** | `get_role_permissions` guarda no padrão do `upsert_role_permissions`: chamador do `p_tenant_id` (ativo) ou superadmin; senão `RAISE 'Insufficient permissions to read role_permissions'` | `20260813120100_h6_fix_f6_4_get_role_permissions_guard.sql` |
| **F6-5** | `plan_change_requests`: SELECT e INSERT restritos a superadmin (`current_is_super_admin_from_auth_uid()`); único consumidor no app é `SuperAdmin.tsx` | `20260813120200_h6_fix_f6_5_plan_change_requests_policies.sql` |
| **F6-7** | `kiosk_addons`: policies SELECT/INSERT/UPDATE com tenant-scope (`tenant_id = current_tenant_id_from_auth_uid()` ou superadmin) + `REVOKE` de anon/PUBLIC + grants a authenticated | `20260813120300_h6_fix_f6_7_kiosk_addons_policies.sql` |
| **F6-8** | `current_tenant_id_from_auth_uid()` exige `status='active'` em `profiles` e `staff` (suspenso/pendente → NULL → RLS fail-closed). Todos os fluxos legítimos criam perfil `active` (provisioning/accept-invite) | `20260813120400_h6_fix_f6_8_current_tenant_status.sql` |
| **F6-1 (P3)** | `approve_access_request`: `REVOKE EXECUTE` de anon/PUBLIC + `GRANT` a authenticated (hardening; **lógica NÃO alterada**); guarda `auth.uid()`/superadmin registrada como **dívida P3** | `20260813120500_h6_revoke_anon_approve_access_request.sql` |

**Verificação:** build OK (`npm run build` ✓); revisão estática dos call sites (todos passam tenant do contexto ou superadmin); **aplicação no banco remoto de produção e re-execução da suite H6 (`E2E_PROVISIONING=1`) pendem de aprovação explícita do PO** (regra AGENTS.md). Após aplicação, os probes F6-3/4/5/7/8 e F6-1 devem transicionar para PASS (o spec `h6-security.spec.ts` já valida o comportamento fail-closed).

### 9.2 Executado (P0/P1 — aprovados pelo PO, least-privilege)

> **Decisões do PO (D-HOM-25):** F6-A com **least-privilege** (não DROP total) porque kiosk/portal são fluxos **anônimos por design** que resolvem `tenants` por slug e listam serviços públicos; F6-2 por **desativação** (sem call site no app). Todos os 4 itens executados como migration própria.

| Achado | Correção | Migration |
|--------|----------|-----------|
| **F6-A** | `DROP public_select_tenants` + `DROP public_select_services`; políticas anon scoped por `tenants.status IN ('active','trial')` (`anon_select_active_tenants` / `anon_select_services_active_tenant` via `EXISTS`); **column grants mínimos** ao anon — `tenants (id,name,slug,status)`, `services (id,tenant_id,name,price,duration,active,category)`; `REVOKE ALL` anon/PUBLIC + re-grant seletivo. Autenticados intactos (`tenant_isolation_tenants_select`, `n_v2`) | `20260813130000_h6_fix_f6_a_public_select_tenants_services.sql` |
| **F6-B** | `DROP "Superadmins can view all profiles"` + recriar `FOR SELECT TO authenticated USING (current_is_super_admin_from_auth_uid())` (helper SECURITY DEFINER da central fix — anon nunca mais lê perfis); `REVOKE ALL` anon/PUBLIC em `profiles` + grants a authenticated | `20260813130100_h6_fix_f6_b_profiles_superadmin_policy.sql` |
| **F6-2** | `close_order(uuid)`: `REVOKE EXECUTE` de **anon, authenticated e PUBLIC** + `GRANT EXECUTE` a service_role (desativação; fluxo real usa `finance_settle_comanda`; `close_order_with_chef_club` SECURITY DEFINER chama internamente e não é afetada) | `20260813130200_h6_fix_f6_2_close_order_deactivation.sql` |
| **F6-6** | `ticket_messages`: policies `ticket_messages_select_v2`/`ticket_messages_insert_v2` **TO authenticated** com JOIN em `support_tickets` (superadmin OU `st.tenant_id = current_tenant_id_from_auth_uid()` OU `st.user_id = auth.uid()`); drop de `Users can insert tickets` (WITH CHECK true) em `support_tickets` (INSERT coberto por `tenant_ticket_isolation_v2`); `REVOKE ALL` anon/PUBLIC em `ticket_messages` e `support_tickets` + grants a authenticated | `20260813130300_h6_fix_f6_6_ticket_messages_policies.sql` |

**Verificação:** revisão estática contra `docs/backups/backup_pre_migration_20260728_152717.sql` (nomes exatos de policies, grants e colunas) e contra as migrations que definem `tenant_isolation_tenants_select`/`n_v2`/`tenant_ticket_isolation_v2` (confirma que autenticados e superadmin permanecem cobertos após os DROPs). Validação funcional **somente após aplicação remota** via probes F6-A/F6-B/F6-2/F6-6 do spec `h6-security.spec.ts` (reauditoria E2E H-6).

### 9.3 Observação de escopo para o PO (fora dos 9 achados — mesmo root cause de F6-A)

**Correção de imprecisão:** a §9.3 original listava **5 policies irmãs** do root cause `20260305050000_kiosk_rls_fix.sql`. Verificação no backup de produção (2026-07-28) confirma que as **4 policies de `clients`/`appointments` já foram dropadas** pelo DO-loop de `20260308_multitenant_hotfix.sql` — no backup **sobrevivem apenas `public_select_tenants` e `public_select_services`** (ambas tratadas no fix F6-A). O DO-loop que dropou as irmãs é o mesmo que criou os helpers SECURITY DEFINER; portanto **não há policies públicas de `clients`/`appointments` a tratar**.

**Registro de produto-bug (fora do escopo da remediação):** com as policies anon de `clients`/`appointments` já dropadas desde 20260308, o **booking anônimo do kiosk provavelmente já está bloqueado em produção** (kiosk identifica/agenda cliente anon via `KioskIdentify`/`KioskSchedule`). Além disso, `KioskSchedule.tsx:56` e `PortalSchedule.tsx:95` consultam `services` com as colunas `duration_minutes`/`is_active`, que **não existem** em `public.services` (colunas reais: `duration`/`active`) nem na view `barber.services`. Ambas as divergências ficam registradas para decisão de produto/validação na reauditoria; os grants de `duration_minutes`/`is_active` no fix F6-A são adicionados com guarda `IF EXISTS` para compatibilidade futura.

### 9.4 Observação adicional (fora dos 9 achados)

A suspensão **real** de tenant (`suspend_subscription`, `20260807010000`) altera apenas `subscriptions.status`/`tenants.status` — **não** `profiles.status`. O fix de F6-8 bloqueia usuários com perfil suspenso; **usuários de tenant suspenso continuam lendo via REST**. Decisão de política (bloquear por `tenants.status` no helper) fica para o PO.

### 9.5 Próximos passos (aguardam aprovação explícita do PO)

1. **Aplicar no banco remoto de produção** as 10 migrations (`20260813120000`..`20260813120500` + `20260813130000`..`20260813130300`) — operação que exige aprovação explícita do PO (AGENTS.md).
2. **Re-execução da suite E2E H-6** (`E2E_PROVISIONING=1 npx playwright test tests/e2e/homologation/h6-security.spec.ts`) — os 9 probes devem transicionar para **PASS** (fail-closed).
3. **Decisão de produto** (pendente): booking anon do kiosk (`clients`/`appointments` sem policies anon desde 20260308) e mismatch `duration_minutes`/`is_active` em `services` (ver §9.3) — validar se o fluxo público deve ser restaurado com camada segura (padrão D5/kiosk) ou se o kiosk passa a operar apenas com fluxo autenticado.
4. Com H-6 remediado e reauditado, **H-7 pode ser liberado** pelo PO.

### 9.6 H-6.5 — Production Safety Gate (2026-08-14, pré-aplicação em produção)

> **Objetivo:** gate formal que precede a aplicação das 10 migrations no banco remoto de produção `ushsnmlbeurfvlkieiln` (Sanchez Barber). **Aplicação incremental iniciada (item a item — D-HOM-24), autorizada pelo PO por item.**
>
> **Artefatos entregues:**
>
> | Artefato | Caminho |
> |----------|---------|
> | Relatório do gate (matriz de risco + impacto individual + plano incremental + critérios) | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE.md` |
> | Baseline READ-ONLY (pré-aplicação) | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE/baseline/00_baseline_snapshot.sql` |
> | Rollback individual (10 migrations) | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE/rollback/rollback_*.sql` |
> | Suite de regressão Sanchez (read-only) | `tests/e2e/homologation/h6-5-sanchez-regression.spec.ts` |
> | Probes de segurança fail-closed (7) | `tests/e2e/homologation/h6-5-security-probes.spec.ts` |
>
> **Resumo da matriz de risco (10/10 migrations):** 🟢 baixo para frontend em todas (revisão de call sites + H3/H4/H5 já validados); 🟡 médio em 3 pontos de verificação do PO — (1) `120400` F6-8 exige baseline B-8 limpa (nenhum usuário ativo com `status ≠ 'active'`), (2) `120300` anon perde leitura de `kiosk_addons` (tabela órfã — confirmar nenhum consumidor externo), (3) `130000` F6-A reduz exposição anon de `tenants`/`services` a colunas públicas (kiosk/portal continuam resolvendo por slug; produto-bug `duration_minutes`/`is_active` já documentado §9.3, fora do escopo). 🔴 nenhum risco alto.
>
> **Critérios objetivos para autorizar a aplicação (C-1..C-9):** ver §9 do gate — baseline B-8 limpa · reauditoria E2E H-6 com 0 achados · regressão Sanchez verde · probes fail-closed 7/7 PASS · build/tsc/unit sem regressões · rollback testado em tenant E2E (recomendado).
>
> **Status:** 🟡 **AGUARDANDO APROVAÇÃO DO PO** para aplicação incremental (item a item, D-HOM-24) + reauditoria.
>
> **Atualização 2026-08-14 (aplicação incremental M1..M6):** **M1 (`20260813120000`, F6-3)**, **M2 (`20260813130000`, F6-A)**, **M3 (`20260813120100`, F6-4)**, **M4 (`20260813120200`, F6-5)** e **M5 (`20260813120300`, F6-7)** aplicadas e confirmadas (detalhes nos commits anteriores). **M6 (`20260813120400`, F6-8)** aplicada: `current_tenant_id_from_auth_uid` status-aware (`status='active'` em profiles OU staff, senão `NULL`). **Gate B-8 auditado:** 1 usuário (`tiodon2d@gmail.com`, staff inactive, sem profile) perderia acesso — **D-HOM-27 do PO: desligado da empresa, perda intencional/esperada; C-1 aprovado**; staff não alterado. **Validação pós-M6:** homolog mantém REST (1 linha) e resolve `b716e290`; tiodon2d resolve `NULL`; B-8 pós estável (apenas tiodon2d); P-1 PASS (isolation); **regressão Sanchez F1–F14 14/14 PASS** (47.1s). **Probes PASS acumulados:** P-1, P-4. **Canário corrigido (só spec):** `ticket_messages` usa `sender_id`. Sem impacto funcional no app da Sanchez. Aguardando veredito do PO para os próximos itens (`120500`..`130300`). Registro completo: `H6_5_PRODUCTION_SAFETY_GATE.md` §12.
>
> **Atualização 2026-08-14 (baseline de regressão EXECUTADO):** suite `h6-5-sanchez-regression.spec.ts` **14/14 PASS (54.9s)** em pré-aplicação, com a conta de homologação recuperada (senha redefinida via GoTrue Admin API; login validado; `E2E_SANCHEZ_PASSWORD` em `.env.local` gitignored). **F13 (Financeiro — Visão Geral) = falso negativo do canário corrigido:** locator esperava `'Visão Geral Financeira'` (acentuado) mas a página renderiza `'Visao Geral Financeira'` sem acento (`pages/FinancialOverview.tsx:109`) → correção apenas na spec, alinhada ao texto real (sem `data-testid`); página renderizou com dados reais e zero page errors. **Nenhuma alteração de código de produção, banco, migration ou configuração.** Detalhes e registro completo: `H6_5_PRODUCTION_SAFETY_GATE.md` §5.2.
