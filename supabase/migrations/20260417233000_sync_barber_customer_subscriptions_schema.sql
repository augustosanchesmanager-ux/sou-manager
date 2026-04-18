BEGIN;

-- ============================================================
-- Garantir paridade minima de barber.customer_subscriptions
-- com a estrutura usada pelo frontend do Chef Club.
--
-- Contexto:
-- - Em alguns ambientes o frontend foi executado com multi-schema
--   habilitado, consultando barber.customer_subscriptions.
-- - A tabela no schema barber pode ficar defasada ou com cache
--   antigo do PostgREST, gerando 400 ao ordenar/consultar colunas
--   esperadas como created_at.
-- - Esta migration e rerrodavel e saneia apenas a tabela de
--   assinaturas, sem mexer nos dados de negocio fora do necessario.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS barber;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'barber'
      AND table_name = 'customer_subscriptions'
  ) THEN
    EXECUTE $create$
      CREATE TABLE barber.customer_subscriptions
      (LIKE public.customer_subscriptions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING INDEXES INCLUDING STORAGE INCLUDING COMMENTS)
    $create$;
  END IF;
END
$$;

ALTER TABLE barber.customer_subscriptions
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS plan_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cycle_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cycle_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE barber.customer_subscriptions
SET
  status = COALESCE(NULLIF(status, ''), 'active'),
  started_at = COALESCE(started_at, created_at, cycle_start, now()),
  cycle_start = COALESCE(cycle_start, started_at, created_at, now()),
  cycle_end = COALESCE(cycle_end, cycle_start + interval '30 days', now() + interval '30 days'),
  next_billing_date = COALESCE(next_billing_date, cycle_end::date, (now() + interval '30 days')::date),
  created_at = COALESCE(created_at, started_at, cycle_start, now()),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE
  status IS NULL
  OR started_at IS NULL
  OR cycle_start IS NULL
  OR cycle_end IS NULL
  OR next_billing_date IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE barber.customer_subscriptions
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN cycle_start SET DEFAULT now(),
  ALTER COLUMN cycle_end SET DEFAULT (now() + interval '30 days'),
  ALTER COLUMN next_billing_date SET DEFAULT ((now() + interval '30 days')::date),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  BEGIN
    ALTER TABLE barber.customer_subscriptions
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN started_at SET NOT NULL,
      ALTER COLUMN cycle_start SET NOT NULL,
      ALTER COLUMN cycle_end SET NOT NULL,
      ALTER COLUMN next_billing_date SET NOT NULL,
      ALTER COLUMN created_at SET NOT NULL,
      ALTER COLUMN updated_at SET NOT NULL;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'barber.customer_subscriptions still allows nulls in some columns; review constraints manually if needed.';
  END;
END
$$;

CREATE INDEX IF NOT EXISTS idx_barber_customer_subscriptions_tenant
  ON barber.customer_subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_barber_customer_subscriptions_client
  ON barber.customer_subscriptions(client_id);

CREATE INDEX IF NOT EXISTS idx_barber_customer_subscriptions_plan
  ON barber.customer_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_barber_customer_subscriptions_status
  ON barber.customer_subscriptions(status);

DROP TRIGGER IF EXISTS trg_customer_subscriptions_updated_at ON barber.customer_subscriptions;
CREATE TRIGGER trg_customer_subscriptions_updated_at
BEFORE UPDATE ON barber.customer_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE barber.customer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_subscriptions_tenant_isolation ON barber.customer_subscriptions;
CREATE POLICY customer_subscriptions_tenant_isolation
ON barber.customer_subscriptions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

NOTIFY pgrst, 'reload schema';

COMMIT;
