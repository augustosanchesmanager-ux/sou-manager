-- ============================================================================
-- 20260910160000_seguranca_gate_batch_unblock_comandas.sql
-- 6.1.3 — Gate de tenant/chamador em batch_unblock_comandas (decisão PO, D3)
--
-- AUTORIZAÇÃO (PO, verbatim): "batch_unblock_comandas: AUTORIZADA nova
-- migration para correção do gate de tenant/chamador, com validação
-- cross-tenant obrigatória."
--
-- Problema (Evidência A §6): o corpo original NÃO validava auth.uid()/tenant
-- do chamador — apenas exigia p_tenant_id IS NOT NULL. Com SECURITY DEFINER
-- (executa como postgres, ignora RLS), qualquer anônimo/usuário de outro
-- tenant que conhecesse tenant_id + ids desbloqueava comandas alheias.
--
-- Correção (padrão do próprio codebase — unblock_comanda):
--   1. auth.uid() obrigatório
--   2. Validação CROSS-TENANT obrigatória: tenant do chamador == p_tenant_id
--      (exceto superadmin, bypass padrão do codebase)
--   3. Role de gestão exigido (owner/admin/manager/gerente/superadmin) —
--      padrão unblock_comanda manual
-- O corpo funcional (loop de desbloqueio + audit) permanece IDÊNTICO ao
-- deployado — apenas o gate foi adicionado no início.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.batch_unblock_comandas(p_tenant_id uuid, p_comanda_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid        UUID := auth.uid();
  v_caller_tenant   UUID;
  v_is_super_admin  BOOLEAN;
  v_access_role     TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_can_unblock     BOOLEAN := false;
  v_comanda_id      UUID;
  v_unblocked       INTEGER := 0;
  v_skipped         INTEGER := 0;
BEGIN
  -- Gate 1: chamador autenticado
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;

  -- Gate 2: CROSS-TENANT obrigatório — chamador deve pertencer ao tenant
  -- alvo (exceto superadmin, bypass padrão do codebase)
  SELECT public.current_tenant_id_from_auth_uid() INTO v_caller_tenant;
  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) THEN
    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado: chamador nao pertence ao tenant informado';
    END IF;
  END IF;

  -- Gate 3: role de gestão (padrão unblock_comanda manual)
  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    v_can_unblock := true;
  END IF;

  IF NOT v_can_unblock THEN
    RAISE EXCEPTION 'Usuario sem permissao para desbloqueio em lote';
  END IF;

  -- ── Corpo funcional (IDÊNTICO ao deployado) ──
  IF p_comanda_ids IS NULL OR array_length(p_comanda_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'unblocked', 0, 'skipped', 0, 'message', 'Nenhuma comanda para desbloquear.');
  END IF;

  FOREACH v_comanda_id IN ARRAY p_comanda_ids LOOP
    -- Only unblock comandas that are blocked
    UPDATE public.comandas
    SET status = 'open'
    WHERE id = v_comanda_id AND tenant_id = p_tenant_id AND status = 'blocked';

    IF FOUND THEN
      INSERT INTO public.comanda_unblock_audit (
        tenant_id, comanda_id, mode, reason, before_status, after_status
      ) VALUES (
        p_tenant_id, v_comanda_id, 'auto', 'auto-unlock by date', 'blocked', 'open'
      );
      v_unblocked := v_unblocked + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'unblocked', v_unblocked,
    'skipped', v_skipped,
    'message', v_unblocked || ' comanda(s) desbloqueada(s).'
  );
END;
$function$;

COMMIT;

-- ============================================================================
-- Verificação pós-aplicação:
--   SELECT prosrc FROM pg_proc WHERE proname='batch_unblock_comandas';
--   Deve conter: 'Usuario autenticado obrigatorio', 'chamador nao pertence ao
--   tenant informado', 'Usuario sem permissao para desbloqueio em lote'.
-- ============================================================================