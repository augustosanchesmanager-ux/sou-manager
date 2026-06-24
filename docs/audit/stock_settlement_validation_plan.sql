-- Validation plan for auditable stock settlement.
-- Do not run against production without explicit approval.
-- Sections marked READONLY are safe SELECT diagnostics.
-- Sections marked NON_PRODUCTION_TEST create and remove test data and must only
-- run in a disposable/local/staging database.

-- ============================================================
-- READONLY: pre-application diagnostics
-- ============================================================

-- Confirm migration is still absent.
SELECT *
FROM supabase_migrations.schema_migrations
WHERE version = '20260609201132';

-- Confirm required objects and columns exist before applying the migration.
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'products' AND column_name IN ('id', 'tenant_id', 'stock_quantity', 'updated_at'))
    OR (table_name = 'comandas' AND column_name IN ('id', 'tenant_id', 'status', 'total', 'payment_method', 'payment_date_real', 'settled_at', 'settled_by_user_id', 'closed_at'))
    OR (table_name = 'comanda_items' AND column_name IN ('id', 'tenant_id', 'comanda_id', 'product_id', 'service_id', 'quantity', 'unit_price'))
    OR (table_name = 'transactions' AND column_name IN ('id', 'tenant_id', 'source_type', 'source_id', 'idempotency_key', 'metadata'))
  )
ORDER BY table_name, ordinal_position;

-- Product items without tenant_id must be zero.
SELECT COUNT(*) AS product_items_without_tenant_id
FROM public.comanda_items
WHERE product_id IS NOT NULL
  AND tenant_id IS NULL;

-- Product items with tenant divergence must be zero.
SELECT ci.id, ci.comanda_id, ci.product_id, ci.tenant_id AS item_tenant_id, c.tenant_id AS comanda_tenant_id
FROM public.comanda_items ci
JOIN public.comandas c ON c.id = ci.comanda_id
WHERE ci.product_id IS NOT NULL
  AND ci.tenant_id IS DISTINCT FROM c.tenant_id
ORDER BY ci.created_at, ci.id;

-- Service-only legacy items without tenant_id do not participate in stock settlement.
SELECT ci.id, ci.comanda_id, ci.service_id, ci.product_id, ci.tenant_id AS item_tenant_id, c.tenant_id AS comanda_tenant_id, c.status
FROM public.comanda_items ci
LEFT JOIN public.comandas c ON c.id = ci.comanda_id
WHERE ci.tenant_id IS NULL
ORDER BY ci.created_at, ci.id;

-- ============================================================
-- READONLY: post-application object checks
-- ============================================================

SELECT to_regclass('public.inventory_movements') AS inventory_movements_table;
SELECT to_regprocedure('public.apply_inventory_sale_for_comanda(uuid, uuid, text, uuid)') AS apply_inventory_sale_function;
SELECT to_regprocedure('public.finance_settle_comanda(uuid, uuid, text, numeric, timestamp with time zone, text, text, text)') AS finance_settle_function;

-- Confirm authenticated cannot insert directly into the ledger through grants.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'inventory_movements'
ORDER BY grantee, privilege_type;

-- ============================================================
-- NON_PRODUCTION_TEST: controlled setup
-- Replace all placeholder ids with disposable local/staging ids.
-- Never use real production clients, comandas, products, or tenants here.
-- ============================================================

BEGIN;

-- Replace these placeholders before running in a non-production database:
-- :tenant_id
-- :auth_user_id
-- :client_id
-- :staff_id
-- :service_id
-- :product_id

-- 1. Record stock before.
SELECT id, tenant_id, stock_quantity
FROM public.products
WHERE id = :product_id
  AND tenant_id = :tenant_id
FOR SHARE;

-- 2. Create a product comanda in non-production.
INSERT INTO public.comandas (tenant_id, client_id, staff_id, status, total)
VALUES (:tenant_id, :client_id, :staff_id, 'open', 100)
RETURNING id AS test_product_comanda_id;

-- Store the returned id manually as :product_comanda_id.
INSERT INTO public.comanda_items (tenant_id, comanda_id, product_id, product_name, quantity, unit_price)
VALUES (:tenant_id, :product_comanda_id, :product_id, 'Produto teste estoque', 1, 100)
RETURNING id AS test_product_item_id;

-- 3. Settle product comanda once.
SELECT public.finance_settle_comanda(
  :tenant_id,
  :product_comanda_id,
  'Dinheiro',
  100,
  now(),
  'stock-settlement-validation',
  'Teste local/staging de baixa de estoque',
  'stock-validation-product-1'
);

-- 4. Validate stock, transaction and inventory movement.
SELECT id, tenant_id, stock_quantity
FROM public.products
WHERE id = :product_id
  AND tenant_id = :tenant_id;

SELECT *
FROM public.inventory_movements
WHERE tenant_id = :tenant_id
  AND source_type = 'comanda'
  AND source_id = :product_comanda_id
ORDER BY created_at;

SELECT *
FROM public.transactions
WHERE tenant_id = :tenant_id
  AND source_type = 'comanda'
  AND source_id = :product_comanda_id
ORDER BY created_at;

-- 5. Repeat idempotently. This must not create a second inventory movement.
SELECT public.finance_settle_comanda(
  :tenant_id,
  :product_comanda_id,
  'Dinheiro',
  100,
  now(),
  'stock-settlement-validation',
  'Teste local/staging de idempotencia',
  'stock-validation-product-1'
);

SELECT COUNT(*) AS movement_count_after_idempotent_repeat
FROM public.inventory_movements
WHERE tenant_id = :tenant_id
  AND source_type = 'comanda'
  AND source_id = :product_comanda_id;

-- 6. Service-only comanda must settle without inventory movement.
INSERT INTO public.comandas (tenant_id, client_id, staff_id, status, total)
VALUES (:tenant_id, :client_id, :staff_id, 'open', 80)
RETURNING id AS test_service_comanda_id;

-- Store returned id manually as :service_comanda_id.
INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price)
VALUES (:tenant_id, :service_comanda_id, :service_id, 'Servico teste sem estoque', 1, 80)
RETURNING id AS test_service_item_id;

SELECT public.finance_settle_comanda(
  :tenant_id,
  :service_comanda_id,
  'Dinheiro',
  80,
  now(),
  'stock-settlement-validation',
  'Teste local/staging sem produto',
  'stock-validation-service-1'
);

SELECT COUNT(*) AS service_only_inventory_movements
FROM public.inventory_movements
WHERE tenant_id = :tenant_id
  AND source_type = 'comanda'
  AND source_id = :service_comanda_id;

-- 7. Negative-path checks. Each block should raise an exception in non-production.
-- Product item with tenant_id NULL must be blocked.
-- Product item with tenant_id different from p_tenant_id must be blocked.
-- Insufficient stock must abort before comanda update and transaction insert.

-- Keep this transaction rollback-only unless the non-production test harness
-- intentionally commits disposable data for inspection.
ROLLBACK;
