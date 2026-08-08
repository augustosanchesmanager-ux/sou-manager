-- =====================================================
-- FIX: REVOKE EXECUTE FROM anon nas RPCs sem excecao publica
-- Data: 2026-08-08
-- Decisao PO: D-6.0.5.8 (fix de hardening aprovado na Janela Unica de Deploy)
-- Motivo:
--   O Supabase auto-concede EXECUTE a 'anon' em funcoes novas. RPCs historicas
--   (pre-hardening, antes do padrao ADR-012) permaneceram anon-executaveis mesmo
--   com GRANT TO authenticated nas migrations. Debito documentado em
--   docs/security/SECURITY_AUDIT_RPC.md (Fase 6.0.4.2).
--   Aplicado na Janela Unica 2026-08-08; esta migration registra o fix no historico.
-- Excecoes preservadas (intencionalmente publicas): get_invite_by_token, kiosk_get_staff.
-- Idempotente: REVOKE de privilegio inexistente gera NOTICE (sem erro).
-- =====================================================
REVOKE EXECUTE ON FUNCTION apply_plan_credit_to_comanda_item(uuid,uuid,uuid,uuid,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION apply_subscription_transition(uuid,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,boolean,timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION archive_notification(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION audit_role_permissions_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION cancel_customer_subscription(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION cancel_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION change_tenant_plan(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION count_unread_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION create_appointment_with_comanda(uuid,uuid,text,text,uuid,uuid,timestamp with time zone,numeric,text,text,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION create_appointment_with_services(uuid,uuid,text,text,uuid,timestamp with time zone,text,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION create_customer_subscription_with_credits(uuid,uuid,uuid,timestamp with time zone,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION create_internal_notification(uuid,uuid,text,text,text,text,uuid,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION create_invoice(uuid,uuid,numeric,timestamp with time zone,timestamp with time zone,timestamp with time zone,text) FROM anon;
REVOKE EXECUTE ON FUNCTION current_tenant_id_managers() FROM anon;
REVOKE EXECUTE ON FUNCTION finance_reverse_transaction(uuid,uuid,text,numeric,text,text,text,timestamp with time zone,text) FROM anon;
REVOKE EXECUTE ON FUNCTION finance_settle_comanda(uuid,uuid,text,numeric,timestamp with time zone,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION generate_system_notifications(uuid,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION generate_unique_slug(text) FROM anon;
REVOKE EXECUTE ON FUNCTION get_credit_usage_history(uuid,uuid,uuid,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION get_current_subscription_credits(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_customer_plan_status(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_due_subscriptions(timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION get_invoice(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_notification_preferences() FROM anon;
REVOKE EXECUTE ON FUNCTION get_role_permissions(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION get_subscription_by_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION handle_barber_closings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION handle_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION list_internal_notifications(text,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_all_notifications_read() FROM anon;
REVOKE EXECUTE ON FUNCTION mark_invoice_paid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_notification_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION notification_type_catalog() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_comanda_open() FROM anon;
REVOKE EXECUTE ON FUNCTION notify_low_stock_product() FROM anon;
REVOKE EXECUTE ON FUNCTION pause_customer_subscription(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION pick_barber_runtime_schema(boolean,timestamp with time zone,boolean,timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION provision_new_tenant(uuid,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION reactivate_customer_subscription(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION reactivate_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION record_payment_attempt(uuid,uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION renew_subscription_cycle(uuid,uuid,timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION save_onboarding_step(uuid,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION set_notification_preferences(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION set_tenant_first_appointment_at() FROM anon;
REVOKE EXECUTE ON FUNCTION set_tenant_id_from_context() FROM anon;
REVOKE EXECUTE ON FUNCTION set_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION set_updated_at_managers() FROM anon;
REVOKE EXECUTE ON FUNCTION set_updated_at_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION suspend_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION tenant_has_feature(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION touch_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION touch_user_tenants_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION update_cash_closing_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION update_role_permissions_updated_at() FROM anon;
