-- ============================================================================
-- Migration: 20261119190000_clients_parent_dependent_relationship.sql
-- Description:
--   Frente A — Estrutura de vínculo Responsável -> Filhos/Dependentes em public.clients:
--   1. Adiciona coluna parent_client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL.
--   2. Adiciona constraint CHECK (parent_client_id IS DISTINCT FROM id).
--   3. Cria índice parcial clients_tenant_parent_client_idx (tenant_id, parent_client_id).
--   4. Trigger BEFORE INSERT OR UPDATE garantindo:
--      a) Isolamento multi-tenant (pai e filho no mesmo tenant_id);
--      b) Profundidade máxima de 1 nível (dependente não pode ter filhos; pai com
--         filhos não pode virar dependente);
--      c) Sincronização segura de phone e is_shared_phone no vínculo e desvínculo
--         sem violar clients_tenant_canon_phone_uidx.
--   5. Trigger AFTER UPDATE OF phone no titular para propagar atualização de
--      telefone aos dependentes que compartilham o telefone do responsável.
-- ============================================================================

BEGIN;

-- 1. Coluna de auto-relacionamento em public.clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id UUID NULL
  REFERENCES public.clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.parent_client_id IS
  'Referência ao cliente responsável (pai/mãe/tutor) dentro do mesmo tenant. NULL quando o cliente é titular.';

-- 2. Constraint impedindo auto-referência direta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'clients_parent_not_self_chk'
       AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_parent_not_self_chk
      CHECK (parent_client_id IS DISTINCT FROM id);
  END IF;
END $$;

-- 3. Índice parcial por tenant + responsável para busca rápida de dependentes
CREATE INDEX IF NOT EXISTS clients_tenant_parent_client_idx
  ON public.clients (tenant_id, parent_client_id)
  WHERE parent_client_id IS NOT NULL;

-- 4. Trigger BEFORE INSERT OR UPDATE: isolamento multi-tenant, limite de 1 nível e sync de telefone compartilhado
CREATE OR REPLACE FUNCTION public.fn_clients_guard_and_sync_dependent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_new_canon_phone TEXT;
  v_parent_canon_phone TEXT;
  v_has_titular_collision BOOLEAN := false;
BEGIN
  IF NEW.parent_client_id IS NOT NULL THEN
    -- a) Impede auto-referência mesmo antes da constraint
    IF NEW.id IS NOT NULL AND NEW.parent_client_id = NEW.id THEN
      RAISE EXCEPTION 'dependent_cannot_reference_self'
        USING ERRCODE = '23514',
              DETAIL = 'Um cliente não pode ser responsável de si mesmo.';
    END IF;

    -- b) Busca dados do responsável
    SELECT id, tenant_id, parent_client_id, phone
      INTO v_parent
      FROM public.clients
     WHERE id = NEW.parent_client_id;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'parent_client_not_found'
        USING ERRCODE = '23503',
              DETAIL = 'Cliente responsável não encontrado.';
    END IF;

    -- c) Isolamento estrito de tenant
    IF v_parent.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'cross_tenant_parent_client_forbidden'
        USING ERRCODE = '23514',
              DETAIL = 'O cliente responsável deve pertencer ao mesmo tenant do dependente.';
    END IF;

    -- d) Trava de 1 nível (responsável escolhido não pode ser dependente de outro)
    IF v_parent.parent_client_id IS NOT NULL THEN
      RAISE EXCEPTION 'dependent_max_depth_exceeded'
        USING ERRCODE = '23514',
              DETAIL = 'Um dependente não pode ser responsável de outro dependente (limite de 1 nível).';
    END IF;

    -- e) Trava de 1 nível reversa (um cliente que já possui dependentes não pode virar dependente)
    IF NEW.id IS NOT NULL AND EXISTS (
      SELECT 1
        FROM public.clients c
       WHERE c.parent_client_id = NEW.id
         AND c.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'parent_with_dependents_cannot_be_dependent'
        USING ERRCODE = '23514',
              DETAIL = 'Um cliente que já possui dependentes vinculados não pode se tornar dependente.';
    END IF;

    -- f) Herança e sincronização segura de telefone compartilhado
    IF NULLIF(BTRIM(COALESCE(NEW.phone, '')), '') IS NULL THEN
      NEW.phone := v_parent.phone;
    END IF;

    v_new_canon_phone := public.normalize_br_phone(NEW.phone);
    v_parent_canon_phone := public.normalize_br_phone(v_parent.phone);

    IF v_new_canon_phone IS NULL
       OR v_new_canon_phone IS NOT DISTINCT FROM v_parent_canon_phone
       OR EXISTS (
         SELECT 1
           FROM public.clients c
          WHERE c.tenant_id = NEW.tenant_id
            AND c.id IS DISTINCT FROM NEW.id
            AND COALESCE(c.is_shared_phone, false) = false
            AND public.normalize_br_phone(c.phone) = v_new_canon_phone
       )
    THEN
      NEW.is_shared_phone := true;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.parent_client_id IS NOT NULL AND NEW.parent_client_id IS NULL THEN
    -- g) Desvínculo seguro (unlinkDependent ou ON DELETE SET NULL do responsável):
    --    Evita violar clients_tenant_canon_phone_uidx se o telefone ainda pertencer a um titular ativo.
    v_new_canon_phone := public.normalize_br_phone(NEW.phone);

    IF v_new_canon_phone IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.clients c
         WHERE c.tenant_id = NEW.tenant_id
           AND c.id IS DISTINCT FROM NEW.id
           AND COALESCE(c.is_shared_phone, false) = false
           AND public.normalize_br_phone(c.phone) = v_new_canon_phone
      ) INTO v_has_titular_collision;

      IF v_has_titular_collision THEN
        NEW.is_shared_phone := true;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clients_guard_and_sync_dependent
  BEFORE INSERT OR UPDATE OF parent_client_id, phone, is_shared_phone, tenant_id
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clients_guard_and_sync_dependent();

-- 5. Trigger AFTER UPDATE OF phone: propaga novo telefone do titular para dependentes que compartilham seu contato
CREATE OR REPLACE FUNCTION public.fn_clients_propagate_parent_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_canon TEXT := public.normalize_br_phone(OLD.phone);
BEGIN
  IF NEW.parent_client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.phone IS NOT DISTINCT FROM NEW.phone THEN
    RETURN NEW;
  END IF;

  UPDATE public.clients c
     SET phone = NEW.phone,
         is_shared_phone = true
   WHERE c.tenant_id = NEW.tenant_id
     AND c.parent_client_id = NEW.id
     AND COALESCE(c.is_shared_phone, false) = true
     AND (
       NULLIF(BTRIM(COALESCE(c.phone, '')), '') IS NULL
       OR public.normalize_br_phone(c.phone) IS NOT DISTINCT FROM v_old_canon
     );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clients_propagate_parent_phone
  AFTER UPDATE OF phone
  ON public.clients
  FOR EACH ROW
  WHEN (OLD.phone IS DISTINCT FROM NEW.phone AND NEW.parent_client_id IS NULL)
  EXECUTE FUNCTION public.fn_clients_propagate_parent_phone();

NOTIFY pgrst, 'reload schema';

COMMIT;
