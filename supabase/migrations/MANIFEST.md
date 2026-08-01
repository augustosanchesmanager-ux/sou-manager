# Migration Manifest — SMG Sou.Manager

> Inventário oficial de todas as migrações do banco de dados. Referência para auditorias, deploys e recuperação de incidentes.
>
> **Última atualização da auditoria:** 2026-07-23

---

## Legenda

### Classificação

| Tipo | Cor | Descrição |
|------|-----|-----------|
| Schema | 🔵 | CREATE TABLE, ALTER TABLE, DROP |
| Data | 🟢 | UPDATE, INSERT, DELETE em massa |
| Security | 🔴 | RLS, Policies, Auth |
| Performance | 🟡 | Índices, Queries otimizadas |
| Event | 🟣 | Event Store, Outbox, Subscribers |
| Finance | 🟠 | Transactions, Receivables, Commissions |
| Maintenance | ⚪ | Correções, Hotfixes |
| Diagnostic | ⚫ | Scripts auxiliares, Views temporárias |

### Breaking Change

| Nível | Descrição | Requer Janela? |
|-------|-----------|----------------|
| SAFE | Adição, não quebra nada | Não |
| LOW RISK | Pode causar warnings | Não |
| HIGH RISK | Pode causar erros em código antigo | Sim |
| BREAKING | Remove ou renomeia algo existente | Sim + Comunicação |

### Rollback

| Tipo | Descrição |
|------|-----------|
| Automático | Reversível via SQL inverso |
| Manual | Reversível com script específico |
| Irreversível | Não pode ser desfeito (ex: DELETE massivo) |

---

## Migrations (87 timestamped + 4 diagnostic + 1 utility)

| # | Arquivo | Tipo | Breaking | Rollback | Observação |
|---|---------|------|----------|----------|------------|
| 1 | `20260219183612_create_initial_schema.sql` | 🔵 Schema | SAFE | Automático | Schema inicial: profiles, tenants, staff, clients, services, appointments, comandas |
| 2 | `20260219230006_new_features_notifications_support_comandas.sql` | 🔵 Schema | SAFE | Automático | notifications, plan_change_requests, support_tickets, ticket_messages, comanda_items |
| 3 | `20260220145404_inventory_rpc_functions.sql` | 🔵 Schema | SAFE | Automático | Funções RPC de inventário, check_minimum_stock |
| 4 | `20260220145436_setup_multi_tenant_and_products_v2.sql` | 🔴 Security | LOW RISK | Manual | Multi-tenant setup, products, tenants, profiles, RLS Gen 2 |
| 5 | `20260220145620_add_suppliers_and_link_orders.sql` | 🔵 Schema | SAFE | Automático | suppliers, purchase_orders |
| 6 | `20260220145723_fix_close_order_rpc_and_schema_v3.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix close_order RPC |
| 7 | `20260220150238_super_admin_rpc_functions.sql` | 🔵 Schema | SAFE | Automático | Funções RPC de super admin |
| 8 | `20260220150538_fix_support_tickets_visibility_v4.sql` | 🔴 Security | LOW RISK | Manual | Fix visibilidade de support tickets |
| 9 | `20260221182101_add_tenant_isolation.sql` | 🔴 Security | HIGH RISK | Manual | RLS Gen 2: inline subqueries para tenant_id |
| 10 | `20260221182115_add_onboarding_completed.sql` | 🔵 Schema | SAFE | Automático | Coluna onboarding_completed |
| 11 | `20260221182432_create_promotions.sql` | 🔵 Schema | SAFE | Automático | Tabela promotions |
| 12 | `20260222182115_fix_tenant_id_auto_insert_trigger.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix trigger de tenant_id auto-insert |
| 13 | `20260224040140_fix_rls_user_metadata.sql` | 🔴 Security | LOW RISK | Manual | Fix RLS user metadata |
| 14 | `20260224040213_create_audit_logs_table_and_trigger.sql` | 🔵 Schema | SAFE | Automático | audit_logs table + trigger |
| 15 | `20260224040235_attach_audit_triggers.sql` | 🔵 Schema | SAFE | Automático | Attach audit triggers em mais tabelas |
| 16 | `20260226052507_auto_insert_manager_into_staff.sql` | ⚪ Maintenance | LOW RISK | Manual | Trigger para auto-insert manager (v1) |
| 17 | `20260226052529_auto_insert_manager_into_staff_v2.sql` | ⚪ Maintenance | LOW RISK | Manual | Trigger para auto-insert manager (v2) |
| 18 | `20260226052610_fix_manager_trigger_and_backfill_staff.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix trigger + backfill staff |
| 19 | `20260227222901_fix_comandas_staff_fk_set_null.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix FK comandas→staff ON DELETE SET NULL |
| 20 | `20260227223434_fix_all_rls_policies_use_security_definer_function.sql` | 🔴 Security | HIGH RISK | Manual | **RLS Gen 3**: `get_current_tenant_id()` SECURITY DEFINER |
| 21 | `20260304_kiosk_module.sql` | 🔵 Schema | SAFE | Automático | 5 tabelas kiosk (Gen 1 policies: USING true) |
| 22 | `20260305050000_kiosk_rls_fix.sql` | 🔴 Security | LOW RISK | Manual | Fix RLS kiosk |
| 23 | `20260305100000_unified_addons_and_portal.sql` | 🔵 Schema | SAFE | Automático | unified_addons, portal pages, kiosk_preferences |
| 24 | `20260306_smart_schedule.sql` | 🔵 Schema | SAFE | Automático | Smart schedule features |
| 25 | `20260308_multitenant_hotfix.sql` | ⚪ Maintenance | HIGH RISK | Manual | Hotfix multi-tenant |
| 26 | `20260311_chef_club_tables.sql` | 🔵 Schema | SAFE | Automático | customer_plans, customer_subscriptions, customer_credits (IF NOT EXISTS) |
| 27 | `20260312_schedule_blocks.sql` | 🔵 Schema | SAFE | Automático | schedule_blocks table |
| 28 | `20260316193000_add_notes_to_appointments.sql` | 🔵 Schema | SAFE | Automático | Coluna notes em appointments |
| 29 | `20260317123000_create_supabase_monitoring_module.sql` | 🔵 Schema | SAFE | Automático | usage_logs, alerts, notification_channels |
| 30 | `20260418100000_add_service_execution_participants.sql` | 🔵 Schema | SAFE | Automático | service_execution_participants table |
| 31 | `20260418120000_add_is_walk_in_to_appointments.sql` | 🔵 Schema | SAFE | Automático | Coluna is_walk_in |
| 32 | `20260418193000_chef_club_service_credit_map.sql` | 🔵 Schema | SAFE | Automático | service_credit_map column |
| 33 | `20260420_add_service_credit_map.sql` | 🔵 Schema | SAFE | Automático | **Duplicata** de #32 (service_credit_map) |
| 34 | `20260420010000_bulk_close_normal.sql` | 🟠 Finance | SAFE | Automático | RPC bulk close normal |
| 35 | `20260420110000_bulk_close_comandas_admin.sql` | 🟠 Finance | SAFE | Automático | RPC bulk close admin |
| 36 | `20260420120001_create_appointment_with_comanda_rpc.sql` | 🔵 Schema | SAFE | Automático | RPC create_appointment_with_comanda (v1) |
| 37 | `20260421000000_add_cancellation_reason_and_noshow.sql` | 🔵 Schema | SAFE | Automático | cancellation_reason, is_no_show |
| 38 | `20260421002405_create_chef_club_tables.sql` | — | — | — | **ARQUIVO VAZIO (0 bytes)** |
| 39 | `20260423000000_add_cancellation_audit_fields.sql` | 🔵 Schema | SAFE | Automático | cancelled_at, cancelled_by_user_id |
| 40 | `20260423000001_migrate_scheduled_to_confirmed.sql` | 🟢 Data | SAFE | Manual | Migração de dados: scheduled→confirmed |
| 41 | `20260423000002_detect_no_show_function.sql` | 🔵 Schema | SAFE | Automático | Função detect_no_show |
| 42 | `20260423000003_validate_fix_comandas.sql` | ⚪ Maintenance | LOW RISK | Manual | Validação e fix de comandas |
| 43 | `20260424000000_performance_indexes.sql` | 🟡 Performance | SAFE | Automático | Índices de performance (v1) |
| 44 | `20260425000000_add_blocked_status_to_comandas.sql` | 🔵 Schema | SAFE | Automático | Status blocked em comandas |
| 45 | `20260426000000_site_sanchez_appointments.sql` | 🔵 Schema | SAFE | Automático | Multi-schema ALTER TABLE (374 linhas) |
| 46 | `20260427_update_create_appointment_with_comanda_rpc.sql` | 🔵 Schema | LOW RISK | Manual | Atualiza RPC v1→v2 |
| 47 | `20260428_add_idempotency_key_to_appointments_and_comandas.sql` | 🔵 Schema | SAFE | Automático | Idempotency key columns |
| 48 | `20260428010000_create_tenant_goals_table.sql` | 🔵 Schema | SAFE | Automático | tenant_goals table |
| 49 | `20260428020000_update_rpc_idempotency_key.sql` | 🔵 Schema | LOW RISK | Manual | Atualiza RPCs para usar idempotency_key |
| 50 | `20260501_add_cancellation_fields_to_comandas.sql` | 🔵 Schema | SAFE | Automático | Campos de cancelamento em comandas |
| 51 | `20260501010000_add_cancellation_type_and_hidden_fields.sql` | 🔵 Schema | SAFE | Automático | cancellation_type, is_hidden |
| 52 | `20260502_add_is_overbooked_to_appointments.sql` | 🔵 Schema | SAFE | Automático | is_overbooked column |
| 53 | `20260502010000_update_rpc_is_overbooked.sql` | 🔵 Schema | LOW RISK | Manual | Atualiza RPCs para is_overbooked |
| 54 | `20260506214059_consolidate_create_appointment_with_comanda_rpc.sql` | 🔵 Schema | HIGH RISK | Manual | Consolidação final do RPC (v6+) |
| 55 | `20260506225934_harden_create_appointment_with_services_rpc.sql` | 🔵 Schema | LOW RISK | Manual | Hardening do RPC de appointment |
| 56 | `20260506234034_create_chef_club_subscription_rpc.sql` | 🔵 Schema | SAFE | Automático | RPC subscription + **índices duplicados** |
| 57 | `20260507011552_fix_preview_plan_credit_for_service_rpc.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix preview plan credit |
| 58 | `20260507023024_internal_notifications_center.sql` | 🔵 Schema | SAFE | Automático | Notification center (1010 linhas), redefine check_minimum_stock |
| 59 | `20260510000000_create_transactions_table.sql` | 🟠 Finance | SAFE | Automático | transactions table |
| 60 | `20260510160816_club_receivables_schema.sql` | 🟠 Finance | SAFE | Automático | customer_subscription_receivables |
| 61 | `20260510160817_club_receivables_generation.sql` | 🟠 Finance | SAFE | Automático | RPC geração de receivables |
| 62 | `20260510160818_club_receivables_payment.sql` | 🟠 Finance | SAFE | Automático | RPC pagamento de receivables |
| 63 | `20260510160819_club_subscription_creation_receivable.sql` | 🟠 Finance | SAFE | Automático | RPC criação de receivable na subscription |
| 64 | `20260510160820_club_checkout_paid_cycle.sql` | 🟠 Finance | SAFE | Automático | RPC checkout paid cycle |
| 65 | `20260511103000_fix_club_duplicate_open_subscriptions.sql` | ⚪ Maintenance | LOW RISK | Manual | Fix subscriptions duplicadas |
| 66 | `20260512000000_cash_closings.sql` | 🟠 Finance | SAFE | Automático | cash_closings table |
| 67 | `20260514000000_finance_settle_comanda_schema.sql` | 🟠 Finance | SAFE | Automático | Colunas financeiras em comandas |
| 68 | `20260514000001_finance_settle_comanda_rpc.sql` | 🟠 Finance | SAFE | Automático | RPC settle comanda |
| 69 | `20260515210114_financial_reversals_schema.sql` | 🟠 Finance | SAFE | Automático | financial_reversals table |
| 70 | `20260515210804_finance_reverse_transaction_rpc.sql` | 🟠 Finance | SAFE | Automático | RPC reverse transaction |
| 71 | `20260520171707_customer_vouchers_table.sql` | 🔵 Schema | SAFE | Automático | customer_vouchers table |
| 72 | `20260520171708_customer_vouchers_triggers.sql` | 🔵 Schema | SAFE | Automático | Triggers de vouchers |
| 73 | `20260520171709_customer_vouchers_rls.sql` | 🔴 Security | SAFE | Automático | RLS de vouchers |
| 74 | `20260531161849_finance_zero_close_comanda_rpc.sql` | 🟠 Finance | SAFE | Automático | RPC zero close comanda (389 linhas) |
| 75 | `20260602030000_create_user_tenants_if_missing.sql` | 🔵 Schema | SAFE | Automático | user_tenants table |
| 76 | `20260602030500_align_comandas_financial_columns.sql` | 🟠 Finance | SAFE | Automático | **Duplicata** de #67 (colunas financeiras comandas) |
| 77 | `20260602031543_create_inventory_movements_and_comanda_stock_settlement.sql` | 🔵 Schema | SAFE | Automático | inventory_movements + RPC (404 linhas) |
| 78 | `20260615120000_restore_legacy_table_names.sql` | ⚪ Maintenance | HIGH RISK | Manual | Restaura nomes legacy de tabelas |
| 79 | `20260715000000_fix_rls_transactions_and_standardize_comandas.sql` | 🔴 Security | HIGH RISK | Manual | Fix RLS transactions + standardize comandas |
| 80 | `20260715010000_fix_rls_legacy_and_kiosk_policies.sql` | 🔴 Security | HIGH RISK | Manual | Fix RLS legacy + kiosk (342 linhas) |
| 81 | `20260716000000_add_admin_manager_role.sql` | 🔵 Schema | SAFE | Automático | Role admin_manager |
| 82 | `20260717000000_role_permissions_system.sql` | 🔵 Schema | SAFE | Automático | role_permissions + role_permissions_audit |
| 83 | `20260717010000_extend_cash_closings_operational_fields.sql` | 🟠 Finance | SAFE | Automático | Campos operacionais em cash_closings |
| 84 | `20260717020000_create_barber_closings.sql` | 🟠 Finance | SAFE | Automático | barber_closings table |
| 85 | `20260717030000_create_cash_closing_events.sql` | 🟠 Finance | SAFE | Automático | cash_closing_events table |
| 86 | `20260723000000_security_fix_rls_critical.sql` | 🔴 Security | HIGH RISK | Manual | **RLS Gen 4**: current_tenant_id_from_auth_uid() + superadmin bypass |
| 87 | `20260723060000_performance_indexes_phase_3_6.sql` | 🟡 Performance | SAFE | Automático | **Duplicata** de índices anteriores (CONCURRENTLY) |
| 88 | `20260723100000_event_store.sql` | 🟣 Event | SAFE | Automático | event_store table (append-only, RLS) |
| 89 | `20260723110000_processed_operations.sql` | 🟣 Event | SAFE | Automático | processed_operations table (idempotency) |
| 90 | `20260724000000_add_plan_to_tenants.sql` | 🔵 Schema | SAFE | Automático | Add plan column to tenants (4.7.3 fix) |
| 91 | `20260801000000_phase_6_0_1_provisioning.sql` | 🔵 Schema | SAFE | Automático | Fase 6.0.1: provision_new_tenant cria user_tenants + tenant_settings; colunas timezone/currency |

### Não-Timestamped

| # | Arquivo | Tipo | Observação |
|---|---------|------|------------|
| 90 | `_audit_queries.sql` | ⚫ Diagnostic | Scripts de auditoria |
| 91 | `_diagnostic_all_tables.sql` | ⚫ Diagnostic | Listagem de tabelas |
| 92 | `_diagnostic_check_tables.sql` | ⚫ Diagnostic | Verificação de tabelas |
| 93 | `_diagnostic_comandas_and_auth.sql` | ⚫ Diagnostic | Diagnóstico comandas+auth |
| 94 | `_functional_tests.sql` | ⚫ Diagnostic | Testes funcionais |
| 95 | `bulk_close_comandas_with_credits.sql` | 🟠 Finance | Utility: bulk close |
| 96 | `MANIFEST.md` | 📄 Docs | Este arquivo |

---

## Resumo

| Métrica | Valor |
|---------|-------|
| Migrations timestamped | 90 |
| Arquivos diagnóstico | 5 |
| Utility | 1 |
| **Total de arquivos SQL** | **96** |
| **Total de migrations reais** | **90** |
| Schema | 39 |
| Data | 1 |
| Security | 12 |
| Performance | 2 |
| Event | 2 |
| Finance | 16 |
| Maintenance | 12 |
| Diagnostic | 5 |
| EMPTY (0 bytes) | 1 |
| SAFE | 63 |
| LOW RISK | 18 |
| HIGH RISK | 9 |
| BREAKING | 0 |

---

## Issues Encontrados pela Auditoria

### 🔴 Críticos

| # | Issue | Migração | Descrição |
|---|-------|----------|-----------|
| — | Nenhum issue crítico | — | Banco sobe sem erros em ambiente limpo |

### 🟡 Médios

| # | Issue | Migrações | Descrição | Ação |
|---|-------|-----------|-----------|------|
| 1 | **RLS policy churn** | ~18 tabelas | Políticas recriadas 3-5 vezes entre migrações (Gen 1→2→3→4) | Consolidação em migração única |
| 2 | **Função legada** | `get_current_tenant_id()` | Ainda existe e é chamada por código legado | Deprecar ou remover |
| 3 | **Função redefinida** | `check_minimum_stock()` | Definida 2x (básica→com notificações) | Versão final é superset OK |
| 4 | **Arquivo vazio** | `20260421002405` | 0 bytes, sem conteúdo | Remover ou documentar |

### 🟢 Baixos

| # | Issue | Migrações | Descrição | Ação |
|---|-------|-----------|-----------|------|
| 5 | **service_credit_map duplicado** | `20260418193000` + `20260420` | Mesma coluna adicionada 2x (IF NOT EXISTS) | Nenhuma (seguro) |
| 6 | **Índices duplicados** | 7+ pares | Mesmos índices criados em múltiplas migrações (IF NOT EXISTS) | Nenhuma (seguro) |
| 7 | **Colunas duplicadas** | comandas financial cols | Mesmas colunas adicionadas em `20260514` e `20260602` (IF NOT EXISTS) | Nenhuma (seguro) |
| 8 | **notifications criada 3x** | 3 migrações | DROP+CREATE pattern (sem IF NOT EXISTS) | Nenhuma (resolvido) |

### ℹ️ Informativos

| # | Finding | Descrição |
|---|---------|-----------|
| 9 | **pgcrypto não necessário** | PostgreSQL 13+ tem gen_random_uuid() built-in. 24 tabelas usam sem problema. |
| 10 | **Outbox sem migration** | Outbox é 100% in-memory (TypeScript). Sem persistência no banco. |
| 11 | **Gen 4 RLS completa** | Todas as tabelas críticas usam current_tenant_id_from_auth_uid() após `20260723000000` |

---

## Dependências

| Migração | Depende de | Tipo | Status |
|----------|------------|------|--------|
| `20260220145436` | `20260219183612` (schema inicial) | Tabelas base | ✅ OK |
| `20260227223434` | `20260221182101` (RLS Gen 2) | Substitui Gen 2 | ✅ OK |
| `20260308_multitenant_hotfix` | `20260227223434` (RLS Gen 3) | Hotfix | ✅ OK |
| `20260506214059` | `20260420120001` (RPC v1) | Consolidação | ✅ OK |
| `20260723000000` | `20260227223434` (get_current_tenant_id) | Substitui por Gen 4 | ✅ OK |
| `20260723110000` | PostgreSQL 13+ (gen_random_uuid) | Built-in | ✅ OK |
| `20260801000000` | `20260728000000` (RPC provision_new_tenant) | Fase 6.0.1 | ✅ OK |

---

## Validação

| Data | Ambiente | Resultado | Validado por |
|------|----------|-----------|--------------|
| 2026-07-23 | Análise estática | ✅ Aprovado | Subagent + OpenCode |
| — | Local (db reset) | ⬜ Pendente | — |
| — | Homologação | ⬜ Pendente | — |
| — | Produção | ⬜ Pendente | — |

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-07-23 | 3.0 | Validação estática aprovada, issues documentados, READY FOR DEPLOY |
| 2026-07-23 | 2.0 | Reconstrução completa com nomes reais de migrações (89 timestamped) |
| 2026-07-23 | 1.0 | Versão inicial com nomes fabricados (substituída) |
