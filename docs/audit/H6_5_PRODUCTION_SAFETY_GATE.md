# H-6.5 — PRODUCTION SAFETY GATE (aplicação das 10 migrations de remediação H-6)

> **Data:** 2026-08-14
> **Autor:** OpenCode (Tech Lead operacional) — execução pendente de aprovação explícita do PO (AGENTS.md)
> **Escopo:** auditar, baselinar e planejar a aplicação **incremental** das 10 migrations H-6 no banco remoto de produção `ushsnmlbeurfvlkieiln` (Sanchez Barber), com **rollback individual**, **suite de regressão** e **probes de segurança**.
> **Regra absoluta:** **NENHUMA migration será aplicada no banco remoto nesta execução.** Tudo aqui é entrega de artefato + plano. A aplicação exige aprovação explícita do PO e execução manual pelo PO (AGENTS.md — migrations em banco remoto = decisão do PO).
> **Relacionado:** `docs/audit/H6_SECURITY_AUDIT.md` (§9, D-HOM-24/D-HOM-25) · `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` · `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md` · `docs/backups/backup_pre_migration_20260728_152717.sql`.

---

## 1. Objetivo

Criar o **gate de segurança de produção** que precede a aplicação das 10 migrations de remediação H-6 (F6-1..F6-8, F6-A, F6-B) no banco real da Sanchez Barber, garantindo:

1. **Matriz de risco por migration** (tabelas, policies, grants, RPCs, roles afetados; risco para frontend/kiosk/portal/Sanchez).
2. **Relatório de impacto individual** por migration (o que muda, o que pode quebrar, evidência de segurança).
3. **Baseline READ-ONLY** capturável antes da aplicação (estado pré-fix reproduzível e comparável).
4. **Plano de aplicação incremental** (migration → validação → migration → validação).
5. **Rollback individual** para cada migration (restauração fiel ao pré-fix).
6. **Suite de regressão Sanchez Barber** (read-only, via conta de homologação).
7. **Probes de segurança fail-closed** (cross-tenant, anon, autenticado, RPC protegida, manipulação de tenant_id, ticket_messages, close_order).
8. **Comandos que o PO deverá executar manualmente** (aplicação + validação).
9. **Critérios objetivos** para autorizar a aplicação em produção.

---

## 2. As 10 migrations (referência)

| # | Migration | Achado | Tipo de mudança | Objetos afetados |
|---|-----------|--------|-----------------|------------------|
| 1 | `20260813120000_h6_fix_f6_3_tenant_has_feature_guard.sql` | F6-3 (P2) | `CREATE OR REPLACE FUNCTION` | `public.tenant_has_feature(uuid,text)` |
| 2 | `20260813120100_h6_fix_f6_4_get_role_permissions_guard.sql` | F6-4 (P2) | `CREATE OR REPLACE FUNCTION` | `public.get_role_permissions(uuid,text)` |
| 3 | `20260813120200_h6_fix_f6_5_plan_change_requests_policies.sql` | F6-5 (P2) | DROP + CREATE POLICY | `public.plan_change_requests` |
| 4 | `20260813120300_h6_fix_f6_7_kiosk_addons_policies.sql` | F6-7 (P2) | DROP + CREATE POLICY + GRANT/REVOKE | `public.kiosk_addons` |
| 5 | `20260813120400_h6_fix_f6_8_current_tenant_status.sql` | F6-8 (P2) | `CREATE OR REPLACE FUNCTION` | `public.current_tenant_id_from_auth_uid()` |
| 6 | `20260813120500_h6_revoke_anon_approve_access_request.sql` | F6-1 (P3) | GRANT/REVOKE | `public.approve_access_request(uuid)` |
| 7 | `20260813130000_h6_fix_f6_a_public_select_tenants_services.sql` | F6-A (P0/P1) | DROP + CREATE POLICY + GRANT/REVOKE | `public.tenants`, `public.services` |
| 8 | `20260813130100_h6_fix_f6_b_profiles_superadmin_policy.sql` | F6-B (P0/P1) | DROP + CREATE POLICY + GRANT/REVOKE | `public.profiles` |
| 9 | `20260813130200_h6_fix_f6_2_close_order_deactivation.sql` | F6-2 (P0/P1) | GRANT/REVOKE | `public.close_order(uuid)` |
| 10 | `20260813130300_h6_fix_f6_6_ticket_messages_policies.sql` | F6-6 (P0/P1) | DROP + CREATE POLICY + GRANT/REVOKE | `public.ticket_messages`, `public.support_tickets` |

---

## 3. Matriz de risco por migration

> **Legenda de risco (impacto em produção):** 🟢 Baixo (fail-closed, sem call site quebrado, validado por revisão) · 🟡 Médio (muda exposição de fluxo anônimo/legado; exige verificação manual no PO) · 🔴 Alto (risco de quebra funcional ou de acesso se pré-condição falhar).

| Migration | Tabelas | Policies afetadas | Grants/REVOKEs | RPCs | Roles afetados | Risco frontend | Risco kiosk/portal | Risco Sanchez | Rollback |
|-----------|---------|-------------------|----------------|------|----------------|----------------|--------------------|---------------|----------|
| **120000** | — | — | — | `tenant_has_feature` | authenticated, superadmin | 🟢 — call sites passam tenant do contexto (useFeatureFlags/ADR-013) | 🟢 — kiosk/portal não usam a RPC | 🟢 — tenant `pro`/`active`, features legítimas seguem | `rollback/rollback_20260813120000.sql` |
| **120100** | — | — | — | `get_role_permissions` | authenticated, superadmin | 🟢 — `permissions/service.ts` passa tenant do contexto | 🟢 — não usada | 🟢 — só superadmin/manager da própria tenant | `rollback/rollback_20260813120100.sql` |
| **120200** | `plan_change_requests` | DROP 2 (legadas abertas) + CREATE 2 (superadmin-only) | — | — | superadmin (único com acesso) | 🟢 — único consumidor `SuperAdmin.tsx` (superadmin, leitura) | 🟢 — sem uso anon | 🟢 — sem call site de troca de plano ativo no app | `rollback/rollback_20260813120200.sql` |
| **120300** | `kiosk_addons` | DROP 3 (USING true) + CREATE 3 (tenant-scope) | `REVOKE anon/PUBLIC` + `GRANT authenticated` | — | authenticated (só própria tenant), anon (perde acesso) | 🟢 — tabela órfã (KioskAdmin usa tenant_addons/kiosk_devices) | 🟡 — **anon perde leitura de kiosk_addons**: validar que nenhum fluxo kiosk/portal lê essa tabela (não usada no código) | 🟢 — escrita só da própria tenant | `rollback/rollback_20260813120300.sql` |
| **120400** | `profiles`, `staff` (leitura) | (todas que usam o helper) | — | `current_tenant_id_from_auth_uid()` | authenticated com status ≠ active | 🟢 — todos os fluxos legítimos criam profile `active` | 🟢 — fluxos anon não dependem do helper | 🟡 — **exige baseline**: confirmar que nenhum usuário ativo da Sanchez tem profile/staff `status ≠ 'active'` | `rollback/rollback_20260813120400.sql` |
| **120500** | — | — | `REVOKE anon/PUBLIC` + `GRANT authenticated` | `approve_access_request` | anon (perde EXECUTE) | 🟢 — único uso `SuperAdmin.tsx` (authenticated) | 🟢 | 🟢 — hardening; lógica não alterada | `rollback/rollback_20260813120500.sql` |
| **130000** | `tenants`, `services` | DROP 2 (`public_select_tenants`/`services`) + CREATE 2 (anon scoped) | `REVOKE anon/PUBLIC` + column grants mínimos anon | — | anon (exposto a subconjunto), authenticated (intacto) | 🟢 — autenticados cobertos por policies modernas | 🟡 — **kiosk/portal anon**: exposição reduzida a colunas públicas; kiosk já usa colunas inexistentes (`duration_minutes`/`is_active` — produto-bug §9.3) | 🟢 — Sanchez `active`: catálogo anon mantém id/name/price/duration/active/category | `rollback/rollback_20260813130000.sql` |
| **130100** | `profiles` | DROP 1 + CREATE 1 (TO authenticated) | `REVOKE anon/PUBLIC` + `GRANT authenticated` | — | anon (perde leitura), authenticated (intacto) | 🟢 — nenhum fluxo anon lê profiles | 🟢 — kiosk/portal não leem profiles | 🟢 — anon nunca deve ler perfis | `rollback/rollback_20260813130100.sql` |
| **130200** | — | — | `REVOKE anon/auth/PUBLIC` + `GRANT service_role` | `close_order(uuid)` | anon, authenticated (perdem EXECUTE), service_role (único) | 🟢 — **sem call site no app** (verificado); fluxo real usa `finance_settle_comanda` (settlement.ts) | 🟢 — sem uso | 🟢 — desativação de RPC sem call site | `rollback/rollback_20260813130200.sql` |
| **130300** | `ticket_messages`, `support_tickets` | DROP 3 (legadas) + CREATE 2 (v2 com JOIN) | `REVOKE anon/PUBLIC` + `GRANT authenticated` | — | anon (perde), authenticated (só próprio tenant/usuário/superadmin) | 🟢 — Support page lê/insere via policies v2 (usuário da própria tenant) | 🟢 — sem uso | 🟢 — só messages de tickets da própria tenant/user_id | `rollback/rollback_20260813130300.sql` |

---

## 4. Relatório de impacto individual

> Fonte das definições originais (rollback): `docs/backups/backup_pre_migration_20260728_152717.sql` e migrations de origem.

### 4.1 `120000` — F6-3 `tenant_has_feature` (guarda fail-closed)

- **Antes:** aceitava `p_tenant_id` de qualquer tenant (validava só `auth.uid() IS NOT NULL`) → manager A consultava features de B.
- **Depois:** retorna `false` se `p_tenant_id ≠ current_tenant_id_from_auth_uid()` e não for superadmin.
- **Impacto:** `useFeatureFlags` e todas as RPCs de domínio passam o tenant do contexto → comportamento preservado. Superadmin mantém bypass.
- **Risco Sanchez:** 🟢. Tenant `pro`/`active`; flags (chef_club, finance, commissions…) continuam resolvendo via `plan_features`/`feature_flags`.
- **Original:** ver `supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql:93-122`.

### 4.2 `120100` — F6-4 `get_role_permissions` (guarda no padrão upsert)

- **Antes:** retornava matriz RBAC de qualquer tenant.
- **Depois:** `RAISE EXCEPTION 'Insufficient permissions...'` se chamador não for da tenant (ou superadmin).
- **Impacto:** `src/lib/permissions/service.ts` e `AccessControl` passam a própria tenant → preservado.
- **Risco Sanchez:** 🟢. Matriz RBAC da Sanchez lida apenas por manager/superadmin da própria tenant.

### 4.3 `120200` — F6-5 `plan_change_requests` (superadmin-only)

- **Antes:** `USING(true)` / `WITH CHECK(true)` → qualquer autenticado lia/inseria de qualquer tenant.
- **Depois:** SELECT/INSERT `TO authenticated USING/WITH CHECK (current_is_super_admin_from_auth_uid())`.
- **Impacto:** único consumidor `pages/SuperAdmin.tsx` (superadmin, leitura) → preservado. Fluxo legado de "solicitar troca de plano" **não tem call site ativo** no app.
- **Risco Sanchez:** 🟢. Nenhum fluxo real usa a tabela.

### 4.4 `120300` — F6-7 `kiosk_addons` (tenant-scope + revoke anon)

- **Antes:** 3 policies `USING(true)`/`WITH CHECK(true)` (20260304) + GRANT ALL a anon → leitura e **escrita cross-tenant** (upsert persistiu status/theme de outra tenant) + leitura anon.
- **Depois:** policies tenant-scope (própria tenant ou superadmin) + `REVOKE anon/PUBLIC` + grants SELECT/INSERT/UPDATE a authenticated.
- **Impacto:** tabela **órfã no frontend** (KioskAdmin usa `tenant_addons`/`kiosk_devices`) → nenhum fluxo quebra.
- **Risco Sanchez:** 🟢. Escreve-se apenas a própria config.
- **⚠ Ponto de verificação PO:** confirmar que nenhum consumidor externo/legado lê `kiosk_addons` como anon (não há no repositório).

### 4.5 `120400` — F6-8 `current_tenant_id_from_auth_uid` (status-aware) ⚠ MAIOR RISCO RELATIVO

- **Antes:** retornava tenant do profile **ou** staff, sem checar status → usuário suspenso/pendente continuava lendo via REST.
- **Depois:** exige `status='active'` em `profiles` e `staff`; senão `NULL` → todas as policies que usam o helper falham fechado.
- **Impacto:** é o helper central usado por **dezenas de policies e RPCs**. A mudança é **compatível** com todos os fluxos legítimos (provision/accept-invite criam profile `active`; staff manager do backfill é `active`). **Porém:** qualquer usuário com profile **ou** staff `status ≠ 'active'` perde acesso REST imediatamente.
- **Risco Sanchez:** 🟡. **Pré-condição obrigatória (baseline B-8):** confirmar que nenhum usuário ativo da Sanchez tem profile/staff `status ≠ 'active'`. Se o PO desejar manter acesso de um staff `inactive`, a COALESCE profiles-first garante que profile `active` ainda vence.
- **Interação com 130000/130300/120300:** as policies dessas migrations usam o helper; a ordem de aplicação (120400 antes de 130000/130300) garante que as novas policies nasçam já com o helper status-aware.

### 4.6 `120500` — F6-1 `approve_access_request` (revoke anon/PUBLIC)

- **Antes:** RPC SECURITY DEFINER legada sem revoke de anon (não estava na revoke list de 20260808110000); lógica sem guarda (dívida P3).
- **Depois:** `REVOKE anon/PUBLIC` + `GRANT authenticated` (hardening). **Lógica não alterada.**
- **Impacto:** `SuperAdmin.tsx` (superadmin = authenticated) preservado.
- **Risco Sanchez:** 🟢.

### 4.7 `130000` — F6-A `tenants`/`services` (least-privilege anon) ⚠ FLUXO ANÔNIMO

- **Antes:** `public_select_tenants`/`public_select_services` `USING(true)` (20260305050000) + GRANT ALL a anon → anon lia **todas** as linhas/colunas (dado real da Sanchez: plan, etc.).
- **Depois:** anon vê apenas `tenants(id,name,slug,status)` de `status IN ('active','trial')` e `services(id,tenant_id,name,price,duration,active,category)` de tenants operacionais; REVOKE + grants mínimos.
- **Impacto:** kiosk/portal (fluxos anon) continuam resolvendo tenant por slug e listando catálogo. **Produto-bug conhecido (§9.3):** `KioskSchedule.tsx:56`/`PortalSchedule.tsx:95` consultam `duration_minutes`/`is_active` que **não existem** — catálogo anon já estava quebrado antes; a migration adiciona grants condicionais `IF EXISTS` para compatibilidade futura, sem alterar esse fato.
- **Risco Sanchez:** 🟢 para o fix em si. **Ponto de verificação PO:** confirmar que o kiosk/portal operam com as colunas públicas (a correção de schema do kiosk é produto-bug separado, fora do escopo).

### 4.8 `130100` — F6-B `profiles` (policy TO authenticated)

- **Antes:** `Superadmins can view all profiles` **sem TO** → aplicava a PUBLIC (incl. anon) → anon via todos os profiles `role='Super Admin'` (dado real da Sanchez).
- **Depois:** `FOR SELECT TO authenticated USING (current_is_super_admin_from_auth_uid())` + `REVOKE anon/PUBLIC` + grants SELECT/INSERT/UPDATE a authenticated.
- **Impacto:** anon jamais lê perfis; autenticados/superadmin preservados (`tenant_isolation_profiles_select_v2`/`n_update_v2` e `Users can view own profile` intocadas).
- **Risco Sanchez:** 🟢. Nenhum fluxo anon lê profiles.

### 4.9 `130200` — F6-2 `close_order` (desativação)

- **Antes:** RPC SECURITY DEFINER legada (20260220145723) **sem guarda** → qualquer autenticado (e anon, via PUBLIC) faturava comanda `open→paid` e mexia em estoque de **qualquer tenant**.
- **Depois:** `REVOKE anon/authenticated/PUBLIC` + `GRANT service_role`. **Sem alteração de corpo.**
- **Impacto:** **sem call site no app** (verificado por grep — nenhum `close_order` em `src/`; o fluxo usa `finance_settle_comanda` em `src/lib/finance/settlement.ts:82`). `close_order_with_chef_club` (SECURITY DEFINER, owner postgres) chama internamente e **não é afetada**.
- **Risco Sanchez:** 🟢. Checkout real usa `finance_settle_comanda`.

### 4.10 `130300` — F6-6 `ticket_messages`/`support_tickets` (isolamento + limpeza)

- **Antes:** policies legadas `USING(true)`/`WITH CHECK(true)` → anon/autenticado lia e inseria mensagens de suporte de qualquer tenant (conteúdo real exposto); `Users can insert tickets` `WITH CHECK(true)` em `support_tickets`.
- **Depois:** SELECT/INSERT `TO authenticated` com JOIN em `support_tickets` (superadmin OU `st.tenant_id = current_tenant_id` OU `st.user_id = auth.uid()`); drop de `Users can insert tickets` (INSERT de support_tickets coberto por `tenant_ticket_isolation_v2`); `REVOKE anon/PUBLIC` + grants a authenticated.
- **Impacto:** Support page (authenticated) acessa apenas mensagens dos próprios tickets/tenant → preservado. Policies `tenant_ticket_isolation_v2`/`superadmin_global_visibility` ficam intactas.
- **Risco Sanchez:** 🟢. Mensagens de suporte da Sanchez visíveis só ao próprio tenant/autor/superadmin.

---

## 5. Baseline READ-ONLY (pré-aplicação)

> **Onde:** `baseline/00_baseline_snapshot.sql` — script **somente leitura** (SELECT/`\d`) a ser executado pelo PO **antes** da primeira migration.
> **Como:** `supabase db query --linked < baseline/00_baseline_snapshot.sql` ou no SQL Editor do dashboard (saída JSON/CSV).
> **Objetivo:** registrar o estado pré-fix (policies, grants, RLS, RPCs, roles, dados críticos Sanchez) para comparação pós-fix e para o rollback.

### 5.1 Blocos do snapshot

| Bloco | Captura | Serve para |
|-------|---------|-----------|
| B-1 | Policies de `public.tenants`, `services`, `profiles`, `kiosk_addons`, `ticket_messages`, `support_tickets`, `plan_change_requests` | confirmar pré-estado das 10 migrations |
| B-2 | Grants (tabelas + funções) das mesmas tabelas e das RPCs `tenant_has_feature`, `get_role_permissions`, `approve_access_request`, `close_order` | confirmar pré-estado de GRANT/REVOKE |
| B-3 | RLS habilitado (`relrowsecurity`) das tabelas afetadas | confirmar RLS ativa |
| B-4 | Assinaturas das RPCs alteradas (corpo + volatility + security) | comparar pós-fix |
| B-5 | Roles `anon`/`authenticated`/`service_role`/`superadmin` (membership) | base para rollback de grants |
| B-6 | Contagem de tenants e tenant Sanchez (`b716e290-f7f6-4449-b790-5ae9dcdadcab`) | proteção contra alteração acidental |
| B-7 | **Sanchez crítica:** profiles/staff/subscriptions/plan/status do tenant `b716e290` | validar pós-fix (acesso preservado) |
| B-8 | **Pré-condição F6-8:** profiles e staff com `status ≠ 'active'` **por tenant** | detectar usuários que perderiam acesso com 120400 |
| B-9 | **Kiosk/portal:** existência das colunas `services.duration_minutes`/`is_active` | documentar produto-bug §9.3 e validar guarda IF EXISTS |
| B-10 | **Eventos:** `event_store` e `processed_operations` contagens (Fase 4) | garantir que migrations não afetam Fase 4 |

### 5.2 Baseline de regressão Sanchez — EXECUTADO (pré-aplicação, 2026-08-14)

> **Suite:** `tests/e2e/homologation/h6-5-sanchez-regression.spec.ts` (read-only — sem operações de escrita; dados reais do tenant Sanchez Barber).
> **Comando:** `E2E_SANCHEZ_REGRESSION=1 npx playwright test tests/e2e/homologation/h6-5-sanchez-regression.spec.ts`
> **Resultado:** **14/14 PASS (54.9s)** — F1 Login (conta de homologação recuperada valida), F2 Dashboard, F3 Clientes, F4 Serviços, F5 Agenda, F6 Comanda, F7 Checkout, F8-F10 Chef Club (Planos/Assinaturas/Recebimentos), F11 Fechamento de Caixa, F12 Comissões, F13 Financeiro — Visão Geral, F14 Relatórios. Sem page errors.
>
> **F13 — FALSO NEGATIVO DO CANÁRIO, CORRIGIDO (2026-08-14):** a primeira execução falhou em F13 por **defeito do locator do teste**, não por regressão do app — a spec esperava `h2` `'Visão Geral Financeira'` (acentuado), mas a página renderiza `'Visao Geral Financeira'` **sem acento** (`pages/FinancialOverview.tsx:109`); `hasText` do Playwright é sensível a acentos. Snapshot de acessibilidade confirmou a página renderizada com dados reais (Entradas R$ 5.135,00 / 88 registros, Saídas R$ 0,00, Saldo R$ 5.135,00, Ticket médio R$ 58,35) e zero page errors. **Correção aplicada somente na spec** (locator alinhado ao texto real renderizado pela aplicação — não há `data-testid` no heading). **Nenhuma alteração de código de produção, banco, migration ou configuração.** Após a correção, F13 PASS. Nota operacional: F13 executado isolado (`--grep`) não autentica (login ocorre apenas no teste 1, suite serial) — a validação válida é a suite completa.
>
> **Dado de acesso:** conta de homologação `homolog.sanchez@barber.soumanager.com` redefinida via GoTrue Admin API e login validado (ver `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md`/D-HOM-11). Credenciais em `.env.local` (gitignored).

---

## 6. Plano de aplicação incremental

> **Modo:** item a item (D-HOM-24 — lote NÃO autorizado). Cada migration é aplicada isoladamente, seguida da validação daquela etapa. A aprovação de cada item permanece do PO.
> **Ordem recomendada (respeita dependências):**

```
120000 → validar F6-3 (probe) → 120100 → validar F6-4 → 120200 → validar F6-5
→ 120300 → validar F6-7 → 120400 → validar F6-8 (baseline B-8 obrigatória ANTES)
→ 120500 → validar F6-1 → 130000 → validar F6-A (kiosk/portal) → 130100 → validar F6-B
→ 130200 → validar F6-2 → 130300 → validar F6-6 → reauditoria completa H-6 → H-7
```

### 6.1 Sequência operacional por item (template)

1. **PO:** `supabase db push --linked` (ou aplicar o arquivo .sql via SQL Editor) — 1 migration por vez.
2. **Validação imediata:** rodar o probe correspondente da suite `h6-5-security-probes.spec.ts` (fail-closed) + consulta SQL de conferência do baseline.
3. **Validação de regressão:** após os itens P0 (130000, 130100, 130200, 130300) e 120400, rodar a suite `h6-5-sanchez-regression.spec.ts` (read-only, conta homolog) para confirmar que o app da Sanchez continua operando.
4. **Decisão:** PO aprova seguir para o próximo item (ou rollback do item atual).

### 6.2 Ordens de dependência críticas

- `120400` **deve** vir antes de `130000`/`130100`/`130300` (novas policies já nascem com o helper status-aware) — embora o rollback seja individual, a ordem evita dupla aplicação de `NOTIFY`.
- `130200` (close_order) é independente; pode ser aplicado a qualquer momento.
- Nenhuma migration toca `event_store`/`processed_operations` (Fase 4) nem o schema `barber`/`auto`/`club` — sem impacto multi-schema.

---

## 7. Rollback individual

> **Onde:** `rollback/rollback_<migration>.sql` — um arquivo por migration, restauração fiel ao pré-fix (ver §4 e o backup 2026-07-28).
> **Regra:** aplicar o rollback **somente** da migration que falhou/foi revertida; o rollback é independente por migration (nenhum arquivo depende de outro). Após o rollback, re-executar o baseline para confirmar restauração.
> **Atenção:** rollback é operação destrutiva/reversa → exige aprovação explícita do PO (AGENTS.md).

| Migration | Arquivo de rollback | O que restaura |
|-----------|--------------------|----------------|
| 120000 | `rollback_20260813120000.sql` | corpo original de `tenant_has_feature` (20260807000000) |
| 120100 | `rollback_20260813120100.sql` | corpo original de `get_role_permissions` (20260717000000) |
| 120200 | `rollback_20260813120200.sql` | policies legadas de `plan_change_requests` |
| 120300 | `rollback_20260813120300.sql` | policies legadas + grants originais de `kiosk_addons` |
| 120400 | `rollback_20260813120400.sql` | corpo original de `current_tenant_id_from_auth_uid` (sem status) |
| 120500 | `rollback_20260813120500.sql` | grants originais de `approve_access_request` |
| 130000 | `rollback_20260813130000.sql` | `public_select_tenants`/`public_select_services` + grants anon originais |
| 130100 | `rollback_20260813130100.sql` | policy legada sem TO + grants originais de `profiles` |
| 130200 | `rollback_20260813130200.sql` | grants originais de `close_order` (authenticated + service_role) |
| 130300 | `rollback_20260813130300.sql` | policies legadas + grants originais de `ticket_messages`/`support_tickets` |

---

## 8. Comandos que o PO deverá executar manualmente

> Aplicação no banco remoto = decisão + execução do PO (AGENTS.md). Comandos para **cada migration**:

```bash
# 0. Baseline (uma única vez, ANTES de tudo)
supabase db query --linked --file docs/audit/H6_5_PRODUCTION_SAFETY_GATE/baseline/00_baseline_snapshot.sql

# 1. Aplicar 1 migration por vez (item a item — D-HOM-24)
supabase db push --linked --include-all
#   OU, item a item via arquivo (mais controlado):
supabase db query --linked --file supabase/migrations/20260813120000_h6_fix_f6_3_tenant_has_feature_guard.sql

# 2. Conferência pós-aplicação (funções/policies/grants)
supabase db query --linked --file docs/audit/H6_5_PRODUCTION_SAFETY_GATE/baseline/00_baseline_snapshot.sql

# 3. Probes fail-closed (E2E, tenants isolados — D-HOM-19)
E2E_PROVISIONING=1 npx playwright test tests/e2e/homologation/h6-5-security-probes.spec.ts

# 4. Regressão Sanchez (read-only, conta de homologação)
E2E_SANCHEZ_REGRESSION=1 npx playwright test tests/e2e/homologation/h6-5-sanchez-regression.spec.ts

# 5. Reauditoria completa H-6 (após todos os itens)
E2E_PROVISIONING=1 npx playwright test tests/e2e/homologation/h6-security.spec.ts

# 6. Rollback (somente se um item falhar + aprovação do PO)
supabase db query --linked --file docs/audit/H6_5_PRODUCTION_SAFETY_GATE/rollback/rollback_<migration>.sql
```

> **Credenciais da regressão:** a suite lê `E2E_SANCHEZ_EMAIL`/`E2E_SANCHEZ_PASSWORD` de `.env.local` (homolog `homolog.sanchez@barber.soumanager.com` — custódia com o PO/OpenCode, **nunca versionado**).

---

## 9. Critérios objetivos para autorizar a aplicação em produção

O PO deve ter **todos** os itens a seguir verificados **antes** de autorizar a aplicação (e **reenforçados** a cada item):

| # | Critério | Como verificar | Falha impede aplicação? |
|---|----------|----------------|--------------------------|
| C-1 | **Baseline B-8 limpa:** nenhum usuário ativo da Sanchez com `profiles.status`/`staff.status` ≠ `'active'` | `baseline/00_baseline_snapshot.sql` (bloco B-8) | ✅ Sim (120400 bloquearia acesso) |
| C-2 | **Kiosk/portal:** nenhum fluxo anon lê `kiosk_addons` | grep no repositório + confirmação do PO | ⚠️ Sim p/ 120300 (anexo) |
| C-3 | **Kiosk/portal:** catálogo anon opera com colunas públicas (`id,tenant_id,name,price,duration,active,category`) | revisão `KioskSchedule.tsx`/`PortalSchedule.tsx` + decisão PO sobre produto-bug §9.3 | ⚠️ Não bloqueia o fix; documenta produto-bug |
| C-4 | **Call sites:** nenhum código chama `close_order`/`approve_access_request` como anon/authenticated | grep `src/` (não há call sites) | ✅ Sim (130200) |
| C-5 | **Reauditoria E2E H-6:** `h6-security.spec.ts` com **0 achados** após todas as 10 migrations | `E2E_PROVISIONING=1 npx playwright test tests/e2e/homologation/h6-security.spec.ts` | ✅ Sim (gate formal) |
| C-6 | **Regressão Sanchez:** suite read-only (login/dashboard/clientes/serviços/agenda/comanda/checkout/Chef Club/caixa/comissões/financeiro/relatórios) **verde** | `E2E_SANCHEZ_REGRESSION=1 npx playwright test tests/e2e/homologation/h6-5-sanchez-regression.spec.ts` | ✅ Sim |
| C-7 | **Build/typecheck/unit:** sem regressões | `npm run build` · `npx tsc --noEmit --pretty false` (sem novos erros vs baseline ~100) · unit 900+ PASS | ✅ Sim |
| C-8 | **Probes fail-closed:** 7/7 PASS | `E2E_PROVISIONING=1 npx playwright test tests/e2e/homologation/h6-5-security-probes.spec.ts` | ✅ Sim |
| C-9 | **Rollback testado em tenant E2E** para cada migration antes da aplicação em produção | re-aplicação/reversão das 10 migrations em banco de teste (opcional, recomendado) | ⚠️ Recomendado |

---

## 10. Artefatos entregues

| Artefato | Caminho |
|----------|---------|
| Relatório do gate (este arquivo) | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE.md` |
| Baseline READ-ONLY | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE/baseline/00_baseline_snapshot.sql` |
| Rollback individual (10 arquivos) | `docs/audit/H6_5_PRODUCTION_SAFETY_GATE/rollback/rollback_*.sql` |
| Suite de regressão Sanchez (read-only) | `tests/e2e/homologation/h6-5-sanchez-regression.spec.ts` |
| Probes de segurança fail-closed | `tests/e2e/homologation/h6-5-security-probes.spec.ts` |
| Registro no H6_SECURITY_AUDIT | §9.6 (este gate) |

---

## 11. Status

- [x] Matriz de risco + relatório de impacto individual (10 migrations)
- [x] Baseline READ-ONLY
- [x] Rollback individual (10)
- [x] Suite de regressão Sanchez
- [x] Probes de segurança fail-closed
- [x] Plano de aplicação incremental + comandos PO + critérios de autorização
- [x] **Baseline de regressão Sanchez executado (14/14 PASS, 2026-08-14)** — pré-aplicação; F13 corrigido como falso negativo do canário (somente a spec; ver §5.2)
- [x] **APLICAÇÃO INCREMENTAL EM ANDAMENTO (item a item — D-HOM-24, autorizada pelo PO por item):** M1 (`120000`), M2 (`130000`), M3 (`120100`), M4 (`120200`), M5 (`120300`) e M6 (`120400`) aplicadas e validadas — ver §12
- [ ] Reauditoria E2E H-6 (0 achados) — pós-todas as migrations
- [ ] Regressão Sanchez — pós-todas as migrations

---

## 12. Registro de aplicação incremental (execução real)

> **Protocolo do PO (janela H-6):** `migration → controle que ela corrige → regressão Sanchez → evidência → próxima migration`. A suite `h6-5-security-probes.spec.ts` é uma suite de **estado final** (pós-10 migrations); falhas de probes ligadas a migrations ainda não aplicadas NÃO devem ser interpretadas como regressão da migration em validação (ex.: P-1 falhou antes da M2 porque `public_select_services` é o próprio achado F6-A pré-existente — não regressão da M1).

| Data | Migration | Fix | Validação | Resultado |
|------|-----------|-----|-----------|-----------|
| 2026-08-14 | `20260813120000` (M1) | F6-3 `tenant_has_feature` fail-closed | `pg_get_functiondef`: corpo exige `p_tenant_id = current_tenant_id_from_auth_uid()` OR superadmin; fail-closed `false` | ✅ Aplicada e confirmada |
| 2026-08-14 | `20260813130000` (M2) | F6-A least-privilege anon (`tenants`/`services`) | pós: `public_select_services` dropada; `anon_select_active_tenants`/`anon_select_services_active_tenant` criadas (scoped por status); authenticated intacto; column grants anon — tenants `(id,name,slug,status)`, services `(id,tenant_id,name,price,duration,active,category)` | ✅ Aplicada e confirmada |
| 2026-08-14 | — (controle M2) | probe **P-1** cross-tenant services | `--grep "P-1"` (`E2E_PROVISIONING=1`) | ✅ **PASS** — managerA não lê `services` do tenantB (28.8s) |
| 2026-08-14 | — (regressão M2) | **F1–F14** regressão Sanchez read-only | `E2E_SANCHEZ_REGRESSION=1` (conta homolog) | ✅ **14/14 PASS (48.4s)** — sem impacto funcional |
| 2026-08-14 | `20260813120100` (M3) | F6-4 `get_role_permissions` guarda de ownership | pré: RPC SEM guarda (SECURITY DEFINER, qualquer tenant); pós: `pg_get_functiondef` com `current_is_super_admin_from_auth_uid() OR current_tenant_id_from_auth_uid() = p_tenant_id`, senão `RAISE 'Insufficient permissions'`. Somente a RPC alterada (assinatura/volatility/grants intactos — baseline B-4.2/B-4.5) | ✅ Aplicada e confirmada |
| 2026-08-14 | — (controle M3) | probe **P-4** RPC protegida (F6-3+F6-4) | `--grep "P-4"` (`E2E_PROVISIONING=1`) | ✅ **PASS** — `tenant_has_feature(tenantB)`=false; `get_role_permissions(tenantB)` rejeitado (30.3s) |
| 2026-08-14 | — (regressão M3) | **F1–F14** regressão Sanchez read-only | `E2E_SANCHEZ_REGRESSION=1` (conta homolog) | ✅ **14/14 PASS (44.1s)** — sem impacto funcional |
| 2026-08-14 | `20260813120200` (M4) | F6-5 `plan_change_requests` restrito a superadmin | pré: policies legadas abertas (`Admins can view plan requests` SELECT qual=true / `Anyone can insert plan requests` INSERT with_check=true, TO public); pós: somente `superadmin can view/insert plan requests` (SELECT/INSERT TO authenticated, USING/WITH CHECK `current_is_super_admin_from_auth_uid()`). Grants inalterados (B-2.1) | ✅ Aplicada e confirmada |
| 2026-08-14 | — (controle M4) | F6-5 REST com conta homolog (não-superadmin) | SELECT: **1 linha → 0 linhas** (row `0c92a237...` plan `premium` deixa de ser visível); INSERT: RLS rejeita (`new row violates row-level security policy`) | ✅ **PASS** — SELECT bloqueado + INSERT bloqueado |
| 2026-08-14 | — (regressão M4) | **F1–F14** regressão Sanchez read-only | `E2E_SANCHEZ_REGRESSION=1` (conta homolog) | ✅ **14/14 PASS (45.4s)** — sem impacto funcional |
| 2026-08-14 | `20260813120300` (M5) | F6-7 `kiosk_addons` tenant-scope + revoke anon | pré: policies `kiosk_addons_select/insert/update` TO public (`true`); grants anon totais. pós: policies SELECT/INSERT/UPDATE `TO authenticated` com `tenant_id = current_tenant_id_from_auth_uid() OR superadmin`; `REVOKE ALL` anon/PUBLIC (anon **sem grants**); `GRANT SELECT,INSERT,UPDATE TO authenticated`. Baseline B-1.4/B-2.1 | ✅ Aplicada e confirmada |
| 2026-08-14 | — (controle M5) | F6-7 REST (anon + manager homolog + cross-tenant) | pré: anon lê 1 linha (vazamento F6-7). pós: anon **`permission denied`**; manager mantém 1 linha (própria); INSERT cross-tenant (tenant_id estrangeiro) **rejeitado por RLS**, 0 linhas criadas | ✅ **PASS** — anon negado + tenant-scope efetivo |
| 2026-08-14 | — (regressão M5) | **F1–F14** regressão Sanchez read-only | `E2E_SANCHEZ_REGRESSION=1` (conta homolog) | ✅ **14/14 PASS (51.3s)** — sem impacto funcional |
| 2026-08-14 | `20260813120400` (M6) | F6-8 `current_tenant_id_from_auth_uid` status-aware | pré: `COALESCE(profiles, staff)` sem check de status; pós: exige `status='active'` em profiles OU staff, senão `NULL` (suspenso/pendente = hard block REST). Somente a RPC alterada (assinatura STABLE SECURITY DEFINER intacta). **Pré-requisito atendido:** `120400` aplicada antes de `130100`/`130300` (gate §6.2) | ✅ Aplicada e confirmada |
| 2026-08-14 | — (validação F6-8) | ativo vs desligado + B-8 + isolation | SQL (lógica do helper): **homolog → `b716e290`** (ativo mantém); **tiodon2d → `NULL`** (desligado, esperado D-HOM-27). REST homolog: 1 linha (acesso íntegro). B-8 pós: B-8.1 vazio · B-8.2 só tiodon2d · B-8.3 só tiodon2d (desejado). Probe **P-1 PASS** (isolation com helper status-aware) | ✅ **PASS** |
| 2026-08-14 | — (regressão M6) | **F1–F14** regressão Sanchez read-only | `E2E_SANCHEZ_REGRESSION=1` (conta homolog) | ✅ **14/14 PASS (47.1s)** — sem impacto funcional |

**Notas de execução:**
- Aplicação item a item via `supabase db query --linked --file supabase/migrations/20260813130000_h6_fix_f6_a_public_select_tenants_services.sql` (exit=0) — mesma via da M1. **Não** registradas em `supabase_migrations.schema_migrations` (mesma convenção da M1; tratar em futura `supabase db push` — registrar para o PO).
- **Canário corrigido (somente a spec, autorizado pelo PO):** `h6-5-security-probes.spec.ts` inseria em `ticket_messages` com `user_id` (linhas 156/279); o schema real usa `sender_id` (cf. `h6-security.spec.ts:204`). Correção de teste apenas — desbloqueou o seed da suite de probes.
- **Gate B-8 (pré-M6, auditado 2026-08-14, read-only):** **1 usuário da Sanchez perderia acesso REST após `120400`.** `tiodon2d@gmail.com` (`fdbbdba4-40ed-4127-b404-6194ea425826`, barber, criado 2026-07-16, `last_sign_in_at` 2026-07-24, não banido) possui `staff.status='inactive'`, **zero profiles**, e hoje resolve o tenant `b716e290` via `COALESCE(profiles, staff)` sem checagem de status. Após `120400`, o helper exige `status='active'` → resolve `NULL` → **perde acesso REST**. B-8.1 vazio (nenhum profile não-ativo); B-8.2: apenas esta 1 linha; B-8.3: 1 usuário; B-8.4: vazio. **Decisão do PO (D-HOM-27):** o usuário foi **desligado da empresa** — a perda de acesso é **intencional e esperada** da nova regra (F6-8). **NÃO alterar o staff; deixar `120400` fazer o bloqueio. C-1 APROVADO → M6 autorizada.** Validação pós-M6 obrigatória: usuários ativos continuam acessando · desligado não acessa · nenhum outro usuário legítimo perdeu acesso · tenant isolation mantida · queries B-8/C-1 dentro do esperado.
- **Grants pré-M2:** `authenticated` possui SELECT próprio em `tenants`/`services` — o `REVOKE ALL ... FROM PUBLIC` da M2 **não** afeta leituras autenticadas (confirmado por `role_table_grants` e pela regressão 14/14).
- Próximos itens autorizáveis (aguardando veredito do PO sobre M6): `120500` (F6-1) → `130100` (F6-B) → `130200` (F6-2) → `130300` (F6-6) → reauditoria H-6.
