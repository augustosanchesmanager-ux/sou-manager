BEGIN;

-- ============================================================
-- Garantir colunas do Chef Club em barber.comanda_items.
--
-- Contexto:
-- - O checkout envia campos chef_club_* para comanda_items.
-- - Em ambientes com multi-schema ativo, a API pode consultar
--   barber.comanda_items.
-- - A estrutura do schema barber pode ficar defasada em relacao
--   ao public, gerando erro PGRST204 no schema cache.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS barber;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'barber'
      AND table_name = 'comanda_items'
  ) THEN
    EXECUTE $create$
      CREATE TABLE barber.comanda_items
      (LIKE public.comanda_items INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING INDEXES INCLUDING STORAGE INCLUDING COMMENTS)
    $create$;
  END IF;
END
$$;

ALTER TABLE barber.comanda_items
  ADD COLUMN IF NOT EXISTS chef_club_benefit_code TEXT,
  ADD COLUMN IF NOT EXISTS chef_club_benefit_label TEXT,
  ADD COLUMN IF NOT EXISTS chef_club_applied_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_original_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_final_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_override_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chef_club_override_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS chef_club_plan_benefit_id UUID,
  ADD COLUMN IF NOT EXISTS is_primary_revenue BOOLEAN DEFAULT true;

UPDATE barber.comanda_items
SET
  chef_club_applied_quantity = COALESCE(chef_club_applied_quantity, 0),
  chef_club_original_unit_price = COALESCE(chef_club_original_unit_price, unit_price, 0),
  chef_club_final_unit_price = COALESCE(chef_club_final_unit_price, unit_price, 0),
  chef_club_override_mode = COALESCE(NULLIF(chef_club_override_mode, ''), 'none'),
  chef_club_override_reason = COALESCE(chef_club_override_reason, ''),
  is_primary_revenue = COALESCE(is_primary_revenue, true)
WHERE
  chef_club_applied_quantity IS NULL
  OR chef_club_original_unit_price IS NULL
  OR chef_club_final_unit_price IS NULL
  OR chef_club_override_mode IS NULL
  OR chef_club_override_reason IS NULL
  OR is_primary_revenue IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
