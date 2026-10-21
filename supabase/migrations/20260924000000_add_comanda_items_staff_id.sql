-- Migration: 20260924000000_add_comanda_items_staff_id
-- P1-01 / H-7 — Auditoria H-7/P1-01: registro canônico de comanda_items.staff_id
-- Autorização PO (2026-09-24): PREPARAÇÃO apenas — NÃO aplicar em PROD nesta etapa.
--   • staff_id é contrato canônico do PROD (auditoria H-7/P1-01 read-only);
--   • ausência no STAGING é drift de schema (erro PostgreSQL 42703);
--   • escopo estrito: SOMENTE public.comanda_items.staff_id;
--   • sem backfill, sem INSERT/UPDATE/DELETE de dados, sem RLS, sem triggers,
--     sem as outras 15 colunas divergentes, sem view barber.
-- Padrão: Opção A de 20260906000000 (ADD COLUMN IF NOT EXISTS — drift por
-- alteração fora do fluxo de migrations, decisão PO 2026-09-06).
-- Idempotente: no-op no PROD (coluna já existe com o contrato); cria no STAGING.
-- Verificação explícita em seguida: falha alto se a definição existente divergir
-- (não mascarar diferenças silenciosamente).

-- 1) Coluna canônica: uuid, nullable, default NULL, FK → public.staff(id) ON DELETE SET NULL
ALTER TABLE public.comanda_items
  ADD COLUMN IF NOT EXISTS staff_id UUID DEFAULT NULL
  REFERENCES public.staff(id) ON DELETE SET NULL;

-- 2) Guarda anti-mascaramento: valida o contrato quando a coluna já existia
--    (cobre re-execução no PROD e qualquer estado divergente inesperado).
DO $$
DECLARE
  v_type     text;
  v_nullable text;
  v_default  text;
  v_deltype  text;
BEGIN
  SELECT data_type, is_nullable, column_default
    INTO v_type, v_nullable, v_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'comanda_items'
     AND column_name  = 'staff_id';

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'P1-01: public.comanda_items.staff_id ausente após ALTER TABLE';
  END IF;
  IF v_type <> 'uuid' THEN
    RAISE EXCEPTION 'P1-01: staff_id com tipo divergente (%, esperado uuid)', v_type;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION 'P1-01: staff_id não nullable (is_nullable=%, esperado YES)', v_nullable;
  END IF;
  -- Default ausente, NULL ou NULL::uuid são equivalentes e conformes;
  -- qualquer outro default (ex.: gen_random_uuid()) falha alto.
  IF v_default IS NOT NULL AND lower(v_default) NOT IN ('null', 'null::uuid') THEN
    RAISE EXCEPTION 'P1-01: staff_id com default divergente (%, esperado NULL)', v_default;
  END IF;

  SELECT c.confdeltype::text
    INTO v_deltype
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid  = 'public.comanda_items'::regclass
     AND c.contype   = 'f'
     AND c.confrelid = 'public.staff'::regclass
     AND a.attname   = 'staff_id'
   LIMIT 1;

  IF v_deltype IS NULL THEN
    RAISE EXCEPTION 'P1-01: FK de comanda_items.staff_id para public.staff(id) ausente';
  END IF;
  IF v_deltype <> 'n' THEN
    RAISE EXCEPTION 'P1-01: FK staff_id com ON DELETE divergente (confdeltype=%, esperado n = SET NULL)', v_deltype;
  END IF;
END $$;
