BEGIN;

-- ============================================================
-- Fase 4A - Preparacao conservadora do schema barber
-- Data: 2026-03-25
-- Objetivo:
--   - Criar o schema barber se necessario
--   - Criar tabelas de dominio barber a partir do public sem apagar nada
--   - Copiar dados de forma conservadora, preservando id e tenant_id
--   - Nao adaptar RPCs nesta migration
--
-- Classificacao revisada nesta migration:
--
-- Migra para barber:
--   appointments
--   clients
--   comanda_items
--   comandas
--   customer_credits
--   customer_plans
--   customer_subscriptions
--   feedback_barber
--   feedback_shop
--   kiosk_devices
--   kiosk_sessions
--   products
--   promotions
--   purchase_orders
--   schedule_blocks
--   services
--   suppliers
--
-- Permanece em public:
--   access_requests
--   audit_logs
--   notifications
--   otp_requests
--   plan_change_requests
--   profiles
--   portal_sessions
--   staff
--   support_tickets
--   tenant_addons
--   tenants
--   ticket_messages
--   usage_logs
--   alerts
--   notification_channels
--   user_tenants
--   funcoes shared/core
--
-- Pendente/manual:
--   transactions
--     - tabela critica e usada no dominio barber
--     - DDL nao esta versionada localmente
--     - sera copiada apenas se public.transactions existir no banco
--   kiosk_addons
--     - legado/substituido por tenant_addons
--     - permanece em public
--
-- Tabelas com dependencia shared documentada:
--   kiosk_devices
--     - dominio barber com dependencia shared de tenant_addons/tenants
--   appointments/comandas/customer_* e similares
--     - continuam dependentes de perfis, tenants e eventualmente staff em public
--
-- Registro esperado desta migration:
--   - tabelas copiadas com sucesso sao emitidas via NOTICE em tempo de execucao
--   - tabelas pendentes/manual tambem sao emitidas via NOTICE
--   - esta secao de comentario documenta, de forma revisavel, a intencao
-- ============================================================

CREATE SCHEMA IF NOT EXISTS barber;

CREATE TEMP TABLE barber_migration_audit (
  table_name text PRIMARY KEY,
  classification text NOT NULL,
  runtime_status text NOT NULL DEFAULT 'pending',
  notes text
) ON COMMIT DROP;

INSERT INTO barber_migration_audit (table_name, classification, notes) VALUES
  ('appointments', 'migrate to barber', 'Dominio operacional de agenda da barbearia.'),
  ('clients', 'migrate to barber', 'Cadastro operacional de clientes.'),
  ('comanda_items', 'migrate to barber', 'Itens de comandas; dependente de tenant_id.'),
  ('comandas', 'migrate to barber', 'Comandas operacionais e checkout.'),
  ('customer_credits', 'migrate to barber', 'Saldo operacional do Clube do Chefe.'),
  ('customer_plans', 'migrate to barber', 'Planos operacionais do Clube do Chefe.'),
  ('customer_subscriptions', 'migrate to barber', 'Assinaturas operacionais do Clube do Chefe.'),
  ('feedback_barber', 'migrate to barber', 'Feedback operacional do kiosk/app.'),
  ('feedback_shop', 'migrate to barber', 'Feedback operacional do kiosk/app.'),
  ('kiosk_devices', 'migrate to barber', 'Dominio barber com dependencia shared de addons/tenants.'),
  ('kiosk_sessions', 'migrate to barber', 'Sessoes operacionais do kiosk/QR.'),
  ('products', 'migrate to barber', 'Catalogo operacional e estoque.'),
  ('promotions', 'migrate to barber', 'Promocoes operacionais por tenant.'),
  ('purchase_orders', 'migrate to barber', 'Pedidos operacionais de compra/reposicao.'),
  ('schedule_blocks', 'migrate to barber', 'Bloqueios operacionais de agenda.'),
  ('services', 'migrate to barber', 'Catalogo operacional de servicos.'),
  ('suppliers', 'migrate to barber', 'Fornecedores operacionais.'),
  ('transactions', 'pending/manual', 'Copia condicional: DDL nao versionada localmente.'),
  ('staff', 'remains in public', 'Mantido em public por dependencia de auth/perfil/contexto compartilhado.'),
  ('tenant_addons', 'remains in public', 'Add-ons da plataforma permanecem shared.'),
  ('notifications', 'remains in public', 'Tabela shared/core; nao migra nesta fase.'),
  ('profiles', 'remains in public', 'Perfil/autenticacao compartilhados.'),
  ('tenants', 'remains in public', 'Cadastro core compartilhado de tenants.'),
  ('user_tenants', 'remains in public', 'Vinculo core entre usuarios e tenants.'),
  ('kiosk_addons', 'pending/manual', 'Legado; substituido por tenant_addons e mantido em public.');

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
  v_source_exists boolean;
  v_target_exists boolean;
  v_source_has_tenant boolean;
  v_target_has_tenant boolean;
  v_source_has_id boolean;
  v_target_has_id boolean;
  v_has_pk_id boolean;
  v_common_columns text;
  v_update_columns text;
  v_target_created boolean;
  v_rows_affected bigint;
  v_source_total bigint;
  v_source_with_tenant bigint;
  v_source_without_tenant bigint;
  v_note text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    v_target_created := false;
    v_rows_affected := 0;
    v_source_total := 0;
    v_source_with_tenant := 0;
    v_source_without_tenant := 0;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_table
    )
    INTO v_source_exists;

    IF NOT v_source_exists THEN
      UPDATE barber_migration_audit
      SET runtime_status = 'pending/manual',
          notes = concat_ws(' ', notes, 'Fonte public.', v_table, 'nao encontrada; nenhuma copia executada.')
      WHERE table_name = v_table;

      RAISE NOTICE 'barber migration: source table public.% not found; skipping', v_table;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_source_total;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'barber'
        AND table_name = v_table
    )
    INTO v_target_exists;

    IF NOT v_target_exists THEN
      EXECUTE format(
        'CREATE TABLE barber.%I (LIKE public.%I INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING INDEXES INCLUDING STORAGE INCLUDING COMMENTS)',
        v_table,
        v_table
      );
      v_target_created := true;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'tenant_id'
    )
    INTO v_source_has_tenant;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'barber'
        AND table_name = v_table
        AND column_name = 'tenant_id'
    )
    INTO v_target_has_tenant;

    IF NOT v_source_has_tenant OR NOT v_target_has_tenant THEN
      UPDATE barber_migration_audit
      SET runtime_status = 'pending/manual',
          notes = concat_ws(
            ' ',
            notes,
            CASE WHEN v_target_created THEN 'Tabela barber criada via LIKE.' ELSE 'Tabela barber ja existia.' END,
            format('Linhas de origem: %s.', v_source_total),
            'tenant_id ausente em origem ou destino; copia nao executada.'
          )
      WHERE table_name = v_table;

      RAISE NOTICE 'barber migration: tenant_id missing on public.% or barber.%; manual review required', v_table, v_table;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id IS NOT NULL', v_table) INTO v_source_with_tenant;
    v_source_without_tenant := v_source_total - v_source_with_tenant;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'id'
    )
    INTO v_source_has_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'barber'
        AND table_name = v_table
        AND column_name = 'id'
    )
    INTO v_target_has_id;

    IF NOT v_source_has_id OR NOT v_target_has_id THEN
      UPDATE barber_migration_audit
      SET runtime_status = 'pending/manual',
          notes = concat_ws(
            ' ',
            notes,
            CASE WHEN v_target_created THEN 'Tabela barber criada via LIKE.' ELSE 'Tabela barber ja existia.' END,
            'Coluna id ausente em origem ou destino; copia nao executada.'
          )
      WHERE table_name = v_table;

      RAISE NOTICE 'barber migration: id column missing on public.% or barber.%; manual review required', v_table, v_table;
      CONTINUE;
    END IF;

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
      UPDATE barber_migration_audit
      SET runtime_status = 'pending/manual',
          notes = concat_ws(
            ' ',
            notes,
            CASE WHEN v_target_created THEN 'Tabela barber criada via LIKE.' ELSE 'Tabela barber ja existia.' END,
            'Nenhuma coluna compativel encontrada entre public e barber.'
          )
      WHERE table_name = v_table;

      RAISE NOTICE 'barber migration: no compatible columns for table %; manual review required', v_table;
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

    v_note := concat_ws(
      ' ',
      CASE WHEN v_target_created THEN 'Tabela barber criada via LIKE.' ELSE 'Tabela barber ja existia.' END,
      format('Linhas de origem: %s.', v_source_total),
      format('Linhas copiadas elegiveis com tenant_id: %s.', v_source_with_tenant),
      CASE
        WHEN v_source_without_tenant > 0 THEN format('Linhas sem tenant_id mantidas apenas em public: %s.', v_source_without_tenant)
        ELSE null
      END,
      format('Linhas afetadas no destino: %s.', v_rows_affected),
      CASE
        WHEN v_table = 'transactions' THEN 'Copia condicional de transactions executada somente porque a tabela de origem existe neste banco.'
        ELSE null
      END
    );

    UPDATE barber_migration_audit
    SET runtime_status = 'copied',
        notes = concat_ws(' ', notes, v_note)
    WHERE table_name = v_table;

    RAISE NOTICE 'barber migration: table %, source rows %, eligible rows %, rows affected %',
      v_table,
      v_source_total,
      v_source_with_tenant,
      v_rows_affected;
  END LOOP;
END
$$;

DO $$
DECLARE
  rec record;
BEGIN
  RAISE NOTICE 'barber migration audit summary start';

  FOR rec IN
    SELECT table_name, classification, runtime_status, notes
    FROM barber_migration_audit
    ORDER BY
      CASE runtime_status
        WHEN 'copied' THEN 1
        WHEN 'pending/manual' THEN 2
        ELSE 3
      END,
      table_name
  LOOP
    RAISE NOTICE '[%] % => % | %', rec.classification, rec.table_name, rec.runtime_status, rec.notes;
  END LOOP;

  RAISE NOTICE 'barber migration audit summary end';
END
$$;

COMMIT;
