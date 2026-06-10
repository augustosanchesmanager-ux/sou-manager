-- Rollback reference for auditable stock settlement.
-- Do not execute blindly. Review production state first.

BEGIN;

-- 1. Restore the previous finance_settle_comanda implementation.
--    Use docs/audit/finance_settle_comanda_remote_before_stock.sql as the source
--    of truth captured before the stock-settlement migration.

-- 2. Optional only if no real stock movement has ever been written:
-- DROP FUNCTION IF EXISTS public.apply_inventory_sale_for_comanda(UUID, UUID, TEXT, UUID);

-- 3. Do not drop public.inventory_movements if real movements exist.
--    Keep the ledger for audit and restore only finance_settle_comanda if rollback
--    is needed after live usage.

-- 4. If rollback is required after live usage, audit generated movements:
-- SELECT tenant_id, source_type, source_id, product_id, idempotency_key, COUNT(*)
-- FROM public.inventory_movements
-- GROUP BY tenant_id, source_type, source_id, product_id, idempotency_key
-- ORDER BY COUNT(*) DESC;

-- 5. If and only if the ledger is unused and approved for removal:
-- DROP TABLE IF EXISTS public.inventory_movements;

-- NOTIFY pgrst, 'reload schema';

COMMIT;
