BEGIN;

DO $$
DECLARE
  v_schema text;
BEGIN
  FOREACH v_schema IN ARRAY ARRAY['public', 'barber'] LOOP
    EXECUTE format('ALTER TABLE %I.clients ADD COLUMN IF NOT EXISTS idempotency_key text', v_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS idempotency_key text', v_schema);
    EXECUTE format('ALTER TABLE %I.comandas ADD COLUMN IF NOT EXISTS idempotency_key text', v_schema);

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_idempotency_key_idx ON %I.clients (tenant_id, idempotency_key) WHERE tenant_id IS NOT NULL AND idempotency_key IS NOT NULL',
      v_schema
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS appointments_tenant_idempotency_key_idx ON %I.appointments (tenant_id, idempotency_key) WHERE tenant_id IS NOT NULL AND idempotency_key IS NOT NULL',
      v_schema
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS comandas_tenant_idempotency_key_idx ON %I.comandas (tenant_id, idempotency_key) WHERE tenant_id IS NOT NULL AND idempotency_key IS NOT NULL',
      v_schema
    );
  END LOOP;
END
$$;

COMMIT;
