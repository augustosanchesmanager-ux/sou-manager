-- =============================================================================
-- Migration: F1 — Enforcement de hierarquia de papéis no banco (staff + profiles)
--
-- Escopo aprovado pelo PO (2026-09-14, pacote F1 completo em migration única):
--   F1-a  staff  UPDATE OF role  — apenas papéis abaixo do chamador
--   F1-b  staff  INSERT          — hierarquia canônica (canAssignStaffRole)
--   F1-c  staff  DELETE          — não excluir igual/superior
--   F1-d  profiles INSERT/UPDATE OF role — nunca autodeclarar admin/superadmin
--
-- REGRA CANÔNICA (fonte: supabase/functions/_shared/staff-role-hierarchy.ts):
--   rank(papel solicitado) < rank(papel do chamador), ambos > 0
--   superadmin(4) -> admin | manager | barber | receptionist
--   admin(3)      -> manager | barber | receptionist
--   manager/owner(2) -> barber | receptionist
--   barber/receptionist(1) -> nenhum
--
-- PRESERVAÇÕES OBRIGATÓRIAS (decisão PO):
--   1. auth.uid() IS NULL (service role / migrations / edge functions) -> ALLOW.
--      Sem isso, admin-create-user (service key), backfills e RPCs SECURITY
--      DEFINER de sistema quebram. RLS continua sendo a porta do anônimo.
--   2. current_is_super_admin_from_auth_uid() -> ALLOW (bypass total).
--   3. Fluxos legítimos de auto-membership:
--        - accept_invite: insere profiles + staff com id = auth.uid(),
--          role barber/receptionist (rank 1).
--        - handle_new_manager_profile (trigger AFTER INSERT on profiles):
--          insere staff com id = gen_random_uuid() e email do auth.users
--          do perfil — fleet F1-b detecta "self" por EMAIL do chamador.
--        - provision_new_tenant: INSERT profiles self com role='manager'
--          (rank 2) e ON CONFLICT (id) DO UPDATE SET role='manager'.
--          profiles.tenant_id é nullable -> o caminho UPDATE (re-provision
--          de perfil sem tenant) exige carve-out: OLD.tenant_id IS NULL.
--   4. No-op de role (NEW.role = OLD.role) -> ALLOW. O Team.tsx envia `role`
--      em TODO update de staff; edição operacional (nome/telefone) de um
--      membro de nível igual/superior não pode ser bloqueada.
--
-- NÃO altera RLS, NÃO altera CHECKs existentes, NÃO toca outras migrations.
-- Re-executável (CREATE OR REPLACE + DROP/CREATE TRIGGER).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. staff_role_rank(p_role) — espelho SQL da fonte canônica (ranks + aliases)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_role_rank(p_role TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(COALESCE(p_role, '')))
    WHEN 'superadmin'              THEN 4
    WHEN 'super admin'             THEN 4
    WHEN 'admin'                   THEN 3
    WHEN 'adminmanager'            THEN 3
    WHEN 'admin_manager'           THEN 3
    WHEN 'gerente administrativo'  THEN 3
    WHEN 'manager'                 THEN 2
    WHEN 'gerente'                 THEN 2
    WHEN 'gerente operacional'     THEN 2
    WHEN 'owner'                   THEN 2
    WHEN 'barber'                  THEN 1
    WHEN 'barbeiro'                THEN 1
    WHEN 'receptionist'            THEN 1
    WHEN 'recepcionista'           THEN 1
    ELSE 0
  END;
$$;

-- -----------------------------------------------------------------------------
-- 2. f1_caller_role() — papel efetivo do chamador (auth.uid()).
--    Precedência idêntica a get_auth_access_context / admin-create-user:
--    profiles.role primeiro, staff.role como fallback.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_caller_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT s.role FROM public.staff    s WHERE s.id = auth.uid() LIMIT 1)
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. F1-a / F1-b / F1-c — trigger de staff (INSERT, UPDATE OF role, DELETE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_enforce_staff_role_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_caller_rank  INTEGER;
  v_new_rank     INTEGER;
  v_old_rank     INTEGER;
  v_caller_email TEXT;
BEGIN
  -- 1. Sistema (service role, migrations, edge functions): sempre permitido.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. Superadmin: bypass total.
  IF public.current_is_super_admin_from_auth_uid() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_caller_role := public.f1_caller_role();
  v_caller_rank := public.staff_role_rank(v_caller_role);

  IF TG_OP = 'INSERT' THEN
    -- F1-b: criação de staff restrita pela hierarquia canônica.
    v_new_rank := public.staff_role_rank(NEW.role);
    IF v_new_rank <= 0 THEN
      RAISE EXCEPTION 'F1-SEC: papel desconhecido "%"', NEW.role;
    END IF;

    -- Auto-membership legítimo (accept_invite / handle_new_manager_profile):
    -- id do chamador OU email igual ao do chamador (auth.users).
    v_caller_email := (SELECT email FROM auth.users WHERE id = auth.uid());
    IF NEW.id = auth.uid()
       OR (NEW.email IS NOT NULL AND v_caller_email IS NOT NULL AND NEW.email = v_caller_email)
    THEN
      IF v_new_rank <= v_caller_rank THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'F1-SEC: auto-atribuição de papel acima do próprio nível';
    END IF;

    -- Criação para terceiros: hierarquia canônica (rank_pedido < rank_chamador).
    IF v_caller_rank > 0 AND v_new_rank < v_caller_rank THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'F1-SEC: hierarquia violada ao criar staff (pedido rank %, chamador rank %)',
      v_new_rank, v_caller_rank;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- F1-a: mudança de role.
    -- No-op (role inalterado — Team.tsx sempre envia role): permitir.
    IF NEW.role = OLD.role THEN
      RETURN NEW;
    END IF;

    v_new_rank := public.staff_role_rank(NEW.role);
    v_old_rank := public.staff_role_rank(OLD.role);
    IF v_new_rank <= 0 OR v_old_rank <= 0 THEN
      RAISE EXCEPTION 'F1-SEC: papel desconhecido';
    END IF;

    -- Auto-edição: sem elevação (r_new <= r_old).
    IF OLD.id = auth.uid() THEN
      IF v_new_rank <= v_old_rank THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'F1-SEC: elevação do próprio papel bloqueada';
    END IF;

    -- Terceiros: alvo E novo papel estritamente abaixo do chamador.
    IF v_caller_rank > 0 AND v_new_rank < v_caller_rank AND v_old_rank < v_caller_rank THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'F1-SEC: hierarquia violada ao alterar papel (novo rank %, antigo rank %, chamador rank %)',
      v_new_rank, v_old_rank, v_caller_rank;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- F1-c: não excluir staff de nível igual ou superior ao do chamador.
    v_old_rank := public.staff_role_rank(OLD.role);
    IF v_caller_rank > 0 AND v_old_rank < v_caller_rank THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'F1-SEC: hierarquia violada ao excluir staff (alvo rank %, chamador rank %)',
      v_old_rank, v_caller_rank;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. F1-d — trigger de profiles (INSERT, UPDATE OF role)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_enforce_profiles_role_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_rank INTEGER;
  v_new_rank    INTEGER;
  v_old_rank    INTEGER;
BEGIN
  -- 1. Sistema (service role, migrations, edge functions): sempre permitido.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. Superadmin: bypass total.
  IF public.current_is_super_admin_from_auth_uid() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_caller_role := public.f1_caller_role();
  v_caller_rank := public.staff_role_rank(v_caller_role);

  IF TG_OP = 'INSERT' THEN
    -- F1-d (INSERT): self-bootstrap legítimo (provision 'manager' / accept
    -- 'barber'|'receptionist') — nunca admin/superadmin.
    v_new_rank := public.staff_role_rank(NEW.role);
    IF v_new_rank <= 0 THEN
      RAISE EXCEPTION 'F1-SEC: papel desconhecido "%"', NEW.role;
    END IF;

    IF NEW.id = auth.uid() THEN
      IF v_new_rank <= 2 THEN
        RETURN NEW;  -- manager | owner | barber | receptionist
      END IF;
      RAISE EXCEPTION 'F1-SEC: autodeclaração de papel "%" bloqueada', NEW.role;
    END IF;

    -- Perfil para terceiros: hierarquia canônica.
    IF v_caller_rank > 0 AND v_new_rank < v_caller_rank THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'F1-SEC: hierarquia violada ao criar perfil (rank %, chamador rank %)',
      v_new_rank, v_caller_rank;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- F1-d (UPDATE OF role).
    IF NEW.role = OLD.role THEN
      RETURN NEW;  -- no-op
    END IF;

    v_new_rank := public.staff_role_rank(NEW.role);
    v_old_rank := public.staff_role_rank(OLD.role);
    IF v_new_rank <= 0 OR v_old_rank <= 0 THEN
      RAISE EXCEPTION 'F1-SEC: papel desconhecido';
    END IF;

    IF OLD.id = auth.uid() THEN
      -- Auto: sem elevação; carve-out do provision (perfil sem tenant pode
      -- ser re-provisionado como manager/owner — provision_new_tenant
      -- ON CONFLICT (id) DO UPDATE SET role='manager').
      IF v_new_rank <= v_old_rank
         OR (OLD.tenant_id IS NULL AND v_new_rank <= 2)
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'F1-SEC: elevação do próprio papel de perfil bloqueada';
    END IF;

    -- Terceiros: alvo E novo papel estritamente abaixo do chamador.
    IF v_caller_rank > 0 AND v_new_rank < v_caller_rank AND v_old_rank < v_caller_rank THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'F1-SEC: hierarquia violada ao alterar papel de outro perfil';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_f1_staff_role_hierarchy ON public.staff;
CREATE TRIGGER trg_f1_staff_role_hierarchy
  BEFORE INSERT OR UPDATE OF role OR DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.f1_enforce_staff_role_hierarchy();

DROP TRIGGER IF EXISTS trg_f1_profiles_role_hierarchy ON public.profiles;
CREATE TRIGGER trg_f1_profiles_role_hierarchy
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.f1_enforce_profiles_role_hierarchy();