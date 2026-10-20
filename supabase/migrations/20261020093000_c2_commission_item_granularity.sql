-- Migration: 20261020093000_c2_commission_item_granularity.sql
-- Description: [ADR-034] Granularidade por item no ledger de comissoes D7/D8.
--              1. Atualiza o indice unico parcial para incluir comanda_item_id:
--                 (tenant_id, staff_id, comanda_id, comanda_item_id) WHERE record_type = 'commission' AND status = 'active'.
--              2. Atualiza a RPC exists_commission_record para aceitar p_comanda_item_id UUID DEFAULT NULL.

BEGIN;

-- ── 1. Substituir indice unico staff+comanda por staff+comanda+item ───────────
DROP INDEX IF EXISTS public.idx_commission_records_staff_comanda;
DROP INDEX IF EXISTS public.idx_commission_records_staff_item;

CREATE UNIQUE INDEX idx_commission_records_staff_item
  ON public.commission_records(tenant_id, staff_id, comanda_id, comanda_item_id)
  WHERE record_type = 'commission' AND status = 'active';

-- ── 2. Atualizar RPC exists_commission_record para suportar comanda_item_id ───
DROP FUNCTION IF EXISTS public.exists_commission_record(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.exists_commission_record(
  p_staff_id        UUID,
  p_comanda_id      UUID,
  p_tenant_id       UUID,
  p_comanda_item_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n BIGINT;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.commission_records
  WHERE tenant_id = p_tenant_id
    AND staff_id = p_staff_id
    AND comanda_id = p_comanda_id
    AND record_type = 'commission'
    AND status = 'active'
    AND (p_comanda_item_id IS NULL OR comanda_item_id = p_comanda_item_id);
  RETURN v_n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.exists_commission_record(UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exists_commission_record(UUID, UUID, UUID, UUID) TO worker_dispatcher, authenticated, service_role;

COMMENT ON INDEX public.idx_commission_records_staff_item
  IS 'ADR-034: Garante unicidade de comissao ativa por item (permite multiplos servicos do mesmo profissional na comanda).';

COMMENT ON FUNCTION public.exists_commission_record(UUID, UUID, UUID, UUID)
  IS 'ADR-034: Verificacao de idempotencia D8 com granularidade por item (p_comanda_item_id opcional com fallback).';

NOTIFY pgrst, 'reload schema';

COMMIT;
