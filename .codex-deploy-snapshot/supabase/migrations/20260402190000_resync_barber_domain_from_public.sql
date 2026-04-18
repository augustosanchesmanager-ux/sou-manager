BEGIN;

-- ============================================================
-- Ressincronizacao conservadora public -> barber
-- Data: 2026-04-02
-- Objetivo:
--   - Reaplicar a copia de dados de dominio barber a partir de public
--   - Considerar apenas linhas com tenant_id preenchido
--   - Preservar ids existentes
--   - Atualizar o destino com UPSERT sem apagar nada
--   - Ser rerodavel com seguranca
--
-- Motivacao:
--   - A Fase 4A copiou o snapshot inicial com sucesso.
--   - Depois disso, novos dados continuaram sendo gravados em public
--     enquanto o fallback legado permaneceu ativo.
--   - Antes de uma nova tentativa de ativar o schema barber,
--     precisamos reduzir o delta entre public e barber.
-- ============================================================

CREATE TEMP TABLE barber_resync_audit (
  table_name text PRIMARY KEY,
  source_rows bigint NOT NULL DEFAULT 0,
  rows_affected bigint NOT NULL DEFAULT 0,
  notes text
) ON COMMIT DROP;

INSERT INTO barber_resync_audit (table_name, notes) VALUES
  ('appointments', 'Agenda operacional do tenant.'),
  ('clients', 'Cadastro operacional de clientes.'),
  ('comanda_items', 'Itens operacionais das comandas.'),
  ('comandas', 'Checkout e comandas operacionais.'),
  ('customer_credits', 'Creditos operacionais do Chef Club.'),
  ('customer_plans', 'Planos operacionais do Chef Club.'),
  ('customer_subscriptions', 'Assinaturas operacionais do Chef Club.'),
  ('feedback_barber', 'Feedback operacional barber.'),
  ('feedback_shop', 'Feedback operacional shop.'),
  ('kiosk_devices', 'Kiosk barber com dependencia shared.'),
  ('kiosk_sessions', 'Sessoes operacionais do kiosk.'),
  ('products', 'Catalogo operacional e estoque.'),
  ('promotions', 'Promocoes operacionais.'),
  ('purchase_orders', 'Pedidos operacionais de compra.'),
  ('schedule_blocks', 'Bloqueios operacionais da agenda.'),
  ('services', 'Catalogo operacional de servicos.'),
  ('suppliers', 'Fornecedores operacionais.'),
  ('transactions', 'Lancamentos operacionais/financeiros.');

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'appointments',
    'clients',
    'comanda_items',
    'comandas',
    'customer_credits',
    'customer_plans',
    'customer_subscriptions',
    'feedback_barber',
    'feedback_shop',
    'kiosk_devices',
    'kiosk_sessions',
    'products',
    'promotions',
    'purchase_orders',
    'schedule_blocks',
    'services',
    'suppliers',
    'transactions'
  ];
  v_table text;
  v_common_columns text;
  v_update_columns text;
  v_has_pk_id boolean;
  v_rows_affected bigint;
  v_source_rows bigint;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    v_rows_affected := 0;
    v_source_rows := 0;

    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NOT NULL',
      v_table
    )
    INTO v_source_rows;

    SELECT string_agg(format('%I', source_columns.column_name), ', ' ORDER BY source_columns.ordinal_position)
    INTO v_common_columns
    FROM information_schema.columns AS source_columns
    INNER JOIN information_schema.columns AS target_columns
      ON target_columns.table_schema = 'barber'
     AND target_columns.table_name = v_table
     AND target_columns.column_name = source_columns.column_name
    WHERE source_columns.table_schema = 'public'
      AND source_columns.table_name = v_table;

    IF v_common_columns IS NULL THEN
      UPDATE barber_resync_audit
      SET source_rows = v_source_rows,
          notes = concat_ws(' ', notes, 'Nenhuma coluna compativel encontrada; tabela ignorada.')
      WHERE table_name = v_table;

      RAISE NOTICE 'barber resync: no compatible columns for table %', v_table;
      CONTINUE;
    END IF;

    SELECT string_agg(
      format('%1$I = EXCLUDED.%1$I', source_columns.column_name),
      ', '
      ORDER BY source_columns.ordinal_position
    )
    INTO v_update_columns
    FROM information_schema.columns AS source_columns
    INNER JOIN information_schema.columns AS target_columns
      ON target_columns.table_schema = 'barber'
     AND target_columns.table_name = v_table
     AND target_columns.column_name = source_columns.column_name
    WHERE source_columns.table_schema = 'public'
      AND source_columns.table_name = v_table
      AND source_columns.column_name <> 'id';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints AS tc
      INNER JOIN information_schema.key_column_usage AS kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = 'barber'
        AND tc.table_name = v_table
        AND tc.constraint_type = 'PRIMARY KEY'
      GROUP BY tc.constraint_name
      HAVING COUNT(*) = 1
         AND MIN(kcu.column_name) = 'id'
         AND MAX(kcu.column_name) = 'id'
    )
    INTO v_has_pk_id;

    IF v_has_pk_id THEN
      IF COALESCE(v_update_columns, '') = '' THEN
        EXECUTE format(
          'INSERT INTO barber.%1$I (%2$s)
           SELECT %2$s
           FROM public.%1$I
           WHERE tenant_id IS NOT NULL
           ON CONFLICT (id) DO NOTHING',
          v_table,
          v_common_columns
        );
      ELSE
        EXECUTE format(
          'INSERT INTO barber.%1$I (%2$s)
           SELECT %2$s
           FROM public.%1$I
           WHERE tenant_id IS NOT NULL
           ON CONFLICT (id) DO UPDATE SET %3$s',
          v_table,
          v_common_columns,
          v_update_columns
        );
      END IF;
    ELSE
      EXECUTE format(
        'INSERT INTO barber.%1$I (%2$s)
         SELECT %2$s
         FROM public.%1$I AS source_rows
         WHERE source_rows.tenant_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM barber.%1$I AS target_rows
             WHERE target_rows.id = source_rows.id
           )',
        v_table,
        v_common_columns
      );
    END IF;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    UPDATE barber_resync_audit
    SET source_rows = v_source_rows,
        rows_affected = v_rows_affected,
        notes = concat_ws(' ', notes, format('Linhas fonte elegiveis: %s.', v_source_rows), format('Linhas afetadas no destino: %s.', v_rows_affected))
    WHERE table_name = v_table;

    RAISE NOTICE 'barber resync: table %, eligible source rows %, rows affected %',
      v_table,
      v_source_rows,
      v_rows_affected;
  END LOOP;
END
$$;

DO $$
DECLARE
  rec record;
BEGIN
  RAISE NOTICE 'barber resync audit summary start';

  FOR rec IN
    SELECT table_name, source_rows, rows_affected, notes
    FROM barber_resync_audit
    ORDER BY table_name
  LOOP
    RAISE NOTICE '[%] source=% affected=% | %', rec.table_name, rec.source_rows, rec.rows_affected, rec.notes;
  END LOOP;

  RAISE NOTICE 'barber resync audit summary end';
END
$$;

COMMIT;
