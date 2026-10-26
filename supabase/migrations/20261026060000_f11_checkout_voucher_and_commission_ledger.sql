-- ============================================================================
-- Migration: 20261026060000_f11_checkout_voucher_and_commission_ledger.sql
-- Frente F-11: Motor Central de Checkout com Vouchers e Ledger de Comissionamento
-- Regra de Comissão sob Desconto: Opção 3 (Flexível: 'house' | 'split' | 'barber')
-- ============================================================================

BEGIN;

-- ── 1. Evolução da Tabela customer_vouchers ────────────────────────────────
-- Garante campos de código de cupom, capacidade de usos e portador do desconto
ALTER TABLE public.customer_vouchers
  ADD COLUMN IF NOT EXISTS discount_bearer TEXT NOT NULL DEFAULT 'split',
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.customer_vouchers
    ADD CONSTRAINT customer_vouchers_discount_bearer_check
    CHECK (discount_bearer IN ('split', 'house', 'barber'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.customer_vouchers
    ADD CONSTRAINT customer_vouchers_max_uses_check
    CHECK (max_uses >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_lookup_code
  ON public.customer_vouchers(tenant_id, voucher_code)
  WHERE status = 'available';

-- ── 2. Evolução da Tabela comandas ──────────────────────────────────────────
-- Vinculação direta com voucher aplicado e auditoria do rateio
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.customer_vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS voucher_discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_bearer TEXT NULL;

DO $$ BEGIN
  ALTER TABLE public.comandas
    ADD CONSTRAINT comandas_discount_bearer_check
    CHECK (discount_bearer IS NULL OR discount_bearer IN ('split', 'house', 'barber'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_comandas_voucher
  ON public.comandas(tenant_id, voucher_id);

-- ── 3. Evolução da Tabela commission_records ───────────────────────────────
-- Rastreabilidade contábil de vouchers no extrato do profissional
ALTER TABLE public.commission_records
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.customer_vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_bearer TEXT NULL;

DO $$ BEGIN
  ALTER TABLE public.commission_records
    ADD CONSTRAINT commission_records_discount_bearer_check
    CHECK (discount_bearer IS NULL OR discount_bearer IN ('split', 'house', 'barber'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. RLS Hardening (Padrão Inviolável SMG) ────────────────────────────────
ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_vouchers_tenant_select" ON public.customer_vouchers;
CREATE POLICY "customer_vouchers_tenant_select" ON public.customer_vouchers
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "customer_vouchers_tenant_insert" ON public.customer_vouchers;
CREATE POLICY "customer_vouchers_tenant_insert" ON public.customer_vouchers
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "customer_vouchers_tenant_update" ON public.customer_vouchers;
CREATE POLICY "customer_vouchers_tenant_update" ON public.customer_vouchers
  FOR UPDATE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  ) WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- ── 5. RPC Transacional fechar_comanda ─────────────────────────────────────
-- Fecha a comanda de forma atômica, valida vouchers e insere os créditos
-- no ledger de comissões (commission_records) com isolamento multi-tenant.
CREATE OR REPLACE FUNCTION public.fechar_comanda(
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'cash'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id        UUID;
  v_comanda          RECORD;
  v_voucher          RECORD;
  v_item             RECORD;
  v_staff            RECORD;
  v_bearer           TEXT;
  v_comanda_total    NUMERIC(12,2);
  v_voucher_discount NUMERIC(12,2) := 0.00;
  v_item_gross       NUMERIC(12,2);
  v_item_discount    NUMERIC(12,2);
  v_item_net         NUMERIC(12,2);
  v_commission_base  NUMERIC(12,2);
  v_commission_rate  NUMERIC(5,4);
  v_commission_val   NUMERIC(12,2);
  v_records_count    INTEGER := 0;
  v_idempotency_key  TEXT;
  v_closed_at        TIMESTAMPTZ := now();
BEGIN
  -- 1. Resolver tenant do usuário autenticado
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: tenant_id não autenticado.';
  END IF;

  -- 2. Lock transacional da comanda
  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_order_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada para este tenant.', p_order_id;
  END IF;

  IF v_comanda.status = 'paid' OR v_comanda.status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_closed', true,
      'comanda_id', p_order_id,
      'status', v_comanda.status
    );
  END IF;

  -- 3. Validação e consumo de voucher (se presente)
  IF v_comanda.voucher_id IS NOT NULL THEN
    SELECT * INTO v_voucher
    FROM public.customer_vouchers
    WHERE id = v_comanda.voucher_id
      AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Voucher vinculado à comanda não foi localizado.';
    END IF;

    IF v_voucher.status <> 'available' THEN
      RAISE EXCEPTION 'Voucher não está disponível para uso (status: %).', v_voucher.status;
    END IF;

    IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < v_closed_at THEN
      RAISE EXCEPTION 'Voucher expirado em %.', v_voucher.expires_at;
    END IF;

    v_voucher_discount := COALESCE(v_comanda.voucher_discount, v_voucher.discount_amount, 0.00);
    v_bearer := COALESCE(v_comanda.discount_bearer, v_voucher.discount_bearer, 'split');

    -- Incrementar uso do voucher
    UPDATE public.customer_vouchers
    SET used_count = used_count + 1,
        status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE 'available' END,
        used_at = v_closed_at,
        used_comanda_id = p_order_id,
        updated_at = v_closed_at
    WHERE id = v_voucher.id;
  ELSE
    v_bearer := COALESCE(v_comanda.discount_bearer, 'split');
    v_voucher_discount := COALESCE(v_comanda.discount, 0.00);
  END IF;

  -- 4. Somatório de itens da comanda
  SELECT COALESCE(SUM(unit_price * quantity), 0.00) INTO v_comanda_total
  FROM public.comanda_items
  WHERE comanda_id = p_order_id;

  -- 5. Processar comissões por item (Ledger contábil)
  FOR v_item IN
    SELECT ci.*, 
           COALESCE(ci.staff_id, v_comanda.staff_id) AS resolved_staff_id
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_order_id
  LOOP
    IF v_item.resolved_staff_id IS NOT NULL THEN
      -- Buscar taxa de comissão do profissional
      SELECT commission_rate INTO v_commission_rate
      FROM public.staff
      WHERE id = v_item.resolved_staff_id
        AND tenant_id = v_tenant_id;

      -- Fallback para taxa padrão de 50% se nula
      v_commission_rate := COALESCE(v_commission_rate, 0.50);

      v_item_gross := v_item.unit_price * v_item.quantity;

      -- Rateio do desconto conforme modelo escolhido ('house' | 'split' | 'barber')
      IF v_bearer = 'house' THEN
        -- Casa absorve: comissão integral sobre o valor bruto de tabela
        v_item_discount := 0.00;
        v_commission_base := v_item_gross;
      ELSIF v_bearer = 'barber' THEN
        -- Profissional absorve integralmente
        v_item_discount := CASE 
          WHEN v_comanda_total > 0 THEN (v_item_gross / v_comanda_total) * v_voucher_discount
          ELSE 0.00
        END;
        v_commission_base := GREATEST(0.00, v_item_gross);
      ELSE
        -- 'split': rateio proporcional sobre o líquido
        v_item_discount := CASE 
          WHEN v_comanda_total > 0 THEN (v_item_gross / v_comanda_total) * v_voucher_discount
          ELSE 0.00
        END;
        v_commission_base := GREATEST(0.00, v_item_gross - v_item_discount);
      END IF;

      v_item_net := GREATEST(0.00, v_item_gross - v_item_discount);

      -- Cálculo final da comissão
      IF v_bearer = 'barber' THEN
        v_commission_val := GREATEST(0.00, (v_commission_base * v_commission_rate) - v_item_discount);
      ELSE
        v_commission_val := ROUND(v_commission_base * v_commission_rate, 2);
      END IF;

      v_idempotency_key := 'checkout:' || p_order_id || ':' || v_item.id || ':' || v_item.resolved_staff_id;

      -- Inserção atômica no extrato/ledger de comissões
      INSERT INTO public.commission_records (
        tenant_id,
        record_type,
        comanda_id,
        comanda_item_id,
        staff_id,
        gross_value,
        discount,
        net_value,
        received_value,
        commission_rate,
        commission_value,
        participant_share,
        payout_type,
        affects_commission,
        voucher_id,
        discount_bearer,
        idempotency_key,
        status,
        created_at
      ) VALUES (
        v_tenant_id,
        'commission',
        p_order_id,
        v_item.id,
        v_item.resolved_staff_id,
        v_item_gross,
        v_item_discount,
        v_item_net,
        v_item_net,
        v_commission_rate,
        v_commission_val,
        1.0,
        'percentage',
        TRUE,
        v_comanda.voucher_id,
        v_bearer,
        v_idempotency_key,
        'active',
        v_closed_at
      )
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

      v_records_count := v_records_count + 1;
    END IF;
  END LOOP;

  -- 6. Atualizar comanda como fechada / paga
  UPDATE public.comandas
  SET status = 'paid',
      payment_method = COALESCE(p_payment_method, payment_method, 'cash'),
      discount = v_voucher_discount,
      discount_bearer = v_bearer,
      closed_at = v_closed_at
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'comanda_id', p_order_id,
    'status', 'paid',
    'voucher_discount', v_voucher_discount,
    'discount_bearer', v_bearer,
    'ledger_records_created', v_records_count,
    'closed_at', v_closed_at
  );
END;
$$;

COMMENT ON FUNCTION public.fechar_comanda(UUID, TEXT)
  IS 'F-11: Fecha a comanda de forma atômica com validação de vouchers e cálculo contábil de comissão (Opção 3 - Flexível: house/split/barber).';

COMMIT;
