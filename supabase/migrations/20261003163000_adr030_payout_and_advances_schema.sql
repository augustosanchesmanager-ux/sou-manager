-- ============================================================================
-- 20261003163000_adr030_payout_and_advances_schema.sql
-- ADR-030: Ciclos de Repasse, Gestão de Vales e Refatoração de Folha
--          (SMG-PAYOUT-SCHEDULES)
--
-- Escopo: DDL das 3 tabelas + constraints + índices + RLS + RPCs atômicas.
-- NÃO APLICADO. Exige preflight e autorização explícita do PO para
-- STAGING e, em separado, para PROD (ADR-026).
--
-- REGIME DE CAIXA PURO (ADR-030 Decisão C): a liquidação apura comissão
-- exclusivamente por comanda_payments.created_at. Não há dependência de
-- attended_at (que só existe em public.appointments).
--
-- ---------------------------------------------------------------------------
-- DESVIOS DOCUMENTADOS vs. a minuta de DDL submetida à auditoria
-- ---------------------------------------------------------------------------
-- Os pontos abaixo corrigem defeitos objetivos da minuta. Cada um foi
-- reportado antes da implementação e está registrado aqui para rastreabilidade.
--
-- [D1] chk_weekday_only_weekly -> chk_weekday_required
--      A minuta exigia payout_weekday IS NULL para toda frequency <> 'weekly'.
--      Isso proibia 'biweekly' de ter dia da semana — e biweekly é o regime
--      da operação descrita no ADR-030 (terça a domingo, acerto na terça).
--      Falha silenciosa: a migration aplicava e o INSERT real era rejeitado.
--
-- [D2] bonuses_added + chk_net_payout_arithmetic
--      A fórmula canônica soma "+ Σ(Bônus / Diárias)", mas a minuta não tinha
--      coluna para gravá-la. net_payout ficava sem lastro reconstituível.
--
-- [D3] RPCs register_barber_advance / link_advance_to_settlement /
--      reverse_barber_advance incluídas nesta migration.
--      A minula declarava que settlement_id e reversed_at só mudam via RPC
--      SECURITY DEFINER, mas não criava as RPCs — a tabela nasceria
--      permanentemente pendente.
--
-- [D4] current_is_manager_from_auth_uid: LANGUAGE sql + SET search_path.
--      Sem SET search_path há risco de search_path hijacking em função
--      SECURITY DEFINER. O padrão do projeto é 20260308_multitenant_hotfix.
--      A função também passa a ser TENANT-SCOPED (ADR-021), e não apenas
--      global por profiles.role.
--
-- [D5] INSERT em barber_advances restrito a gestão.
--      A minuta usava "tenant_id = current_tenant_id", permitindo que
--      qualquer autenticado do tenant lançasse vale em nome de qualquer
--      profissional. O ADR exige "caixa/gestor".
--
-- [D6] CHECKs não-negativos em barber_payout_settlements.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Helper de papel — tenant-scoped (ADR-021)
-- ============================================================================

-- Diferença relevante em relação a uma checagem apenas por profiles.role:
-- o ADR-021 corrigiu o finding em que SECURITY DEFINER RPCs autorizavam por
-- papel GLOBAL sem filtro de tenant. A membership do tenant alvo é a fonte
-- primária; o papel global só é fallback quando o tenant canônico do usuário
-- é o próprio tenant alvo.

CREATE OR REPLACE FUNCTION public.current_is_manager_from_auth_uid(
    p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = p_tenant_id
          AND LOWER(BTRIM(COALESCE(ut.role, ''))) IN
              ('owner', 'admin', 'manager', 'gerente')
    )
    OR (
        public.current_tenant_id_from_auth_uid() = p_tenant_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND LOWER(BTRIM(COALESCE(p.role, ''))) IN
                  ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
        )
    );
$$;

COMMENT ON FUNCTION public.current_is_manager_from_auth_uid(UUID) IS
    'ADR-021/ADR-030:TRUE se o usuario e gestao do tenant informado. Membership (user_tenants) e fonte primaria; papel global so como fallback quando o tenant canonico do usuario e o tenant alvo.';

REVOKE ALL ON FUNCTION public.current_is_manager_from_auth_uid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_manager_from_auth_uid(UUID) TO authenticated;

-- ============================================================================
-- 2. barber_payout_configs — parametrização de ciclo (1:1 por profissional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.barber_payout_configs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id),
    staff_id         UUID NOT NULL REFERENCES public.staff(id),
    frequency        TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    payout_weekday   INTEGER CHECK (payout_weekday BETWEEN 1 AND 7),
    payout_month_day INTEGER CHECK (payout_month_day BETWEEN 1 AND 31),
    allow_advances   BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_barber_payout_config UNIQUE (tenant_id, staff_id),
    -- [D1] weekly E biweekly exigem dia da semana; daily e monthly nao.
    CONSTRAINT chk_weekday_required CHECK (
        (frequency IN ('weekly', 'biweekly') AND payout_weekday IS NOT NULL)
        OR (frequency IN ('daily', 'monthly') AND payout_weekday IS NULL)
    ),
    CONSTRAINT chk_monthday_required CHECK (
        (frequency = 'monthly' AND payout_month_day IS NOT NULL)
        OR (frequency <> 'monthly' AND payout_month_day IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_barber_payout_configs_tenant
    ON public.barber_payout_configs (tenant_id, staff_id);

ALTER TABLE public.barber_payout_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "barber_payout_configs_select" ON public.barber_payout_configs;
CREATE POLICY "barber_payout_configs_select" ON public.barber_payout_configs
    FOR SELECT USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

DROP POLICY IF EXISTS "barber_payout_configs_write" ON public.barber_payout_configs;
CREATE POLICY "barber_payout_configs_write" ON public.barber_payout_configs
    FOR ALL USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    ) WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- ============================================================================
-- 3. barber_advances — append-only (padrão ADR-018 / comanda_payments)
-- ============================================================================

-- Estado é DERIVADO, nunca persistido:
--   pendente  = settlement_id IS NULL     AND reversed_at IS NULL
--   liquidado = settlement_id IS NOT NULL AND reversed_at IS NULL
--   estornado = reversed_at IS NOT NULL
-- Nao existe coluna status: dois fatos nunca ficam inconsistentes entre si.

CREATE TABLE IF NOT EXISTS public.barber_advances (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id),
    staff_id       UUID NOT NULL REFERENCES public.staff(id),
    amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_id UUID REFERENCES public.transactions(id),
    settlement_id  UUID,
    reversed_at    TIMESTAMPTZ NULL,
    reversal_motivo TEXT,
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes          TEXT,
    created_by     UUID NOT NULL REFERENCES public.profiles(id),
    idempotency_key TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_barber_advances_pending
    ON public.barber_advances (tenant_id, staff_id)
    WHERE settlement_id IS NULL AND reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_barber_advances_settlement
    ON public.barber_advances (settlement_id)
    WHERE settlement_id IS NOT NULL;

-- Idempotencia no mesmo padrao de comanda_payments (ADR-018).
CREATE UNIQUE INDEX IF NOT EXISTS idx_barber_advances_idem
    ON public.barber_advances (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.barber_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "barber_advances_select" ON public.barber_advances;
CREATE POLICY "barber_advances_select" ON public.barber_advances
    FOR SELECT USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

-- [D5] INSERT restrito a gestão. O cliente REST nao tem UPDATE nem DELETE:
-- settlement_id e reversed_at mudam apenas via RPC SECURITY DEFINER.
DROP POLICY IF EXISTS "barber_advances_insert" ON public.barber_advances;
CREATE POLICY "barber_advances_insert" ON public.barber_advances
    FOR INSERT WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- ============================================================================
-- 4. barber_payout_settlements — liquidação periódica
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.barber_payout_settlements (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id),
    staff_id           UUID NOT NULL REFERENCES public.staff(id),
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    gross_commission   NUMERIC(12, 2) NOT NULL CHECK (gross_commission >= 0),
    advances_deducted  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (advances_deducted >= 0),
    bonuses_added      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bonuses_added >= 0),
    net_payout         NUMERIC(12, 2) NOT NULL,
    status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
    paid_at            TIMESTAMPTZ NULL,
    payment_method     TEXT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_period CHECK (period_end >= period_start),
    -- [D2] aritmetica reconstituível: a fórmula canônica fecha na tabela.
    CONSTRAINT chk_net_payout_arithmetic CHECK (
        net_payout = gross_commission - advances_deducted + bonuses_added
    ),
    -- [D6] o abatido não pode exceder o que foi apurado no período.
    CONSTRAINT chk_advances_not_over_gross CHECK (
        advances_deducted <= gross_commission + bonuses_added
    ),
    CONSTRAINT chk_paid_has_timestamp CHECK (
        status <> 'paid' OR paid_at IS NOT NULL
    ),
    CONSTRAINT uq_barber_payout_period UNIQUE (tenant_id, staff_id, period_start, period_end)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_paid_period
    ON public.barber_payout_settlements (tenant_id, staff_id, period_start, period_end)
    WHERE status = 'paid';

ALTER TABLE public.barber_payout_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "barber_payout_settlements_select" ON public.barber_payout_settlements;
CREATE POLICY "barber_payout_settlements_select" ON public.barber_payout_settlements
    FOR SELECT USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

DROP POLICY IF EXISTS "barber_payout_settlements_write" ON public.barber_payout_settlements;
CREATE POLICY "barber_payout_settlements_write" ON public.barber_payout_settlements
    FOR ALL USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    ) WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- FK atrasada: settlement_id em advances aponta para a tabela de liquidacoes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_advances_settlement'
    ) THEN
        ALTER TABLE public.barber_advances
            ADD CONSTRAINT fk_advances_settlement
            FOREIGN KEY (settlement_id) REFERENCES public.barber_payout_settlements(id);
    END IF;
END;
$$;

-- ============================================================================
-- 5. RPCs — atomicidade e append-only via SECURITY DEFINER
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 register_barber_advance
--     Insere o vale e espelha a saida no caixa (public.transactions) na mesma
--     transacao. Contrato documental: ADR-030 secao 4.1.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_barber_advance(
    p_tenant_id      UUID,
    p_staff_id       UUID,
    p_amount         NUMERIC,
    p_payment_method TEXT DEFAULT NULL,
    p_notes          TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid     UUID := auth.uid();
    v_is_super     BOOLEAN;
    v_advance_id   UUID;
    v_transaction_id UUID;
    v_staff_name   TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
    IF p_staff_id IS NULL THEN RAISE EXCEPTION 'staff_id obrigatorio'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor do vale deve ser maior que zero';
    END IF;

    SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super;
    IF NOT COALESCE(v_is_super, false)
       AND NOT public.current_is_manager_from_auth_uid(p_tenant_id) THEN
        RAISE EXCEPTION 'Somente gestao do tenant pode lancar vale';
    END IF;

    -- Idempotencia
    IF p_idempotency_key IS NOT NULL THEN
        SELECT a.id INTO v_advance_id
        FROM public.barber_advances a
        WHERE a.tenant_id = p_tenant_id AND a.idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'advance_id', v_advance_id,
                'message', 'Vale ja registrado.'
            );
        END IF;
    END IF;

    -- [D5] Defesa em profundidade: public.staff tem RLS permissiva (USING (true)),
    -- portanto o filtro de tenant no staff e obrigatorio e nao pode ser
    -- delegado a RLS. Ver ADR-030, Diretriz de Governanca item 7.
    SELECT s.name INTO v_staff_name
    FROM public.staff s
    WHERE s.id = p_staff_id AND s.tenant_id = p_tenant_id;

    IF v_staff_name IS NULL THEN
        RAISE EXCEPTION 'Profissional nao encontrado para este tenant';
    END IF;

    INSERT INTO public.barber_advances (
        tenant_id, staff_id, amount, notes, created_by, idempotency_key
    ) VALUES (
        p_tenant_id, p_staff_id, p_amount, p_notes, v_auth_uid, p_idempotency_key
    )
    RETURNING id INTO v_advance_id;

    -- Espelho no caixa: category e chave tecnica estavel (ADR-030 4.1).
    -- 'date' e a data de competencia do caixa; 'created_at' nao substitui.
    INSERT INTO public.transactions (
        tenant_id, type, category, amount, description,
        payment_method, date, source_type, source_id, status
    ) VALUES (
        p_tenant_id,
        'expense',
        'vale_comissao',
        p_amount,
        'Vale / Adiantamento - ' || v_staff_name,
        p_payment_method,
        timezone('utc'::text, now())::date,
        'barber_advance',
        v_advance_id,
        'completed'
    )
    RETURNING id INTO v_transaction_id;

    UPDATE public.barber_advances
    SET transaction_id = v_transaction_id
    WHERE id = v_advance_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'advance_id', v_advance_id,
        'transaction_id', v_transaction_id,
        'amount', p_amount,
        'message', 'Vale registrado.'
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5.2 link_advance_to_settlement
--     Unica porta de entrada para deduction. Fica gravada qual RPC fez a
--     mudanca, porque a coluna e imutavel (append-only).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_advance_to_settlement(
    p_tenant_id     UUID,
    p_advance_id    UUID,
    p_settlement_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_is_super BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
    IF p_advance_id IS NULL THEN RAISE EXCEPTION 'advance_id obrigatorio'; END IF;
    IF p_settlement_id IS NULL THEN RAISE EXCEPTION 'settlement_id obrigatorio'; END IF;

    SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super;
    IF NOT COALESCE(v_is_super, false)
       AND NOT public.current_is_manager_from_auth_uid(p_tenant_id) THEN
        RAISE EXCEPTION 'Somente gestao do tenant pode emitir liquidacao';
    END IF;

    -- O vale precisa existir no tenant, estar pendente e nao estar estornado.
    PERFORM 1 FROM public.barber_advances
    WHERE id = p_advance_id
      AND tenant_id = p_tenant_id
      AND reversed_at IS NULL
      AND settlement_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vale nao encontrado, ja liquidado ou estornado';
    END IF;

    -- A liquidacao precisa ser do mesmo tenant, do mesmo profissional e
    -- ainda nao pode ter sido paga.
    PERFORM 1 FROM public.barber_payout_settlements s
    JOIN public.barber_advances a ON a.id = p_advance_id
    WHERE s.id = p_settlement_id
      AND s.tenant_id = p_tenant_id
      AND s.staff_id = a.staff_id
      AND s.status IN ('draft', 'approved')
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Liquidacao nao encontrada, de outro profissional ou ja paga';
    END IF;

    UPDATE public.barber_advances
    SET settlement_id = p_settlement_id
    WHERE id = p_advance_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'advance_id', p_advance_id,
        'settlement_id', p_settlement_id,
        'message', 'Vale vinculado a liquidacao.'
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5.3 reverse_barber_advance
--     Estorno por marcacao: a linha permanece, reversed_at e gravado e o
--     caixa recebe a devolucao espelhada.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_barber_advance(
    p_tenant_id UUID,
    p_advance_id UUID,
    p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_is_super BOOLEAN;
    v_advance  public.barber_advances%ROWTYPE;
    v_staff_name TEXT;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
    IF p_advance_id IS NULL THEN RAISE EXCEPTION 'advance_id obrigatorio'; END IF;
    IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
        RAISE EXCEPTION 'Motivo obrigatorio para estorno de vale';
    END IF;

    SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super;
    IF NOT COALESCE(v_is_super, false)
       AND NOT public.current_is_manager_from_auth_uid(p_tenant_id) THEN
        RAISE EXCEPTION 'Somente gestao do tenant pode estornar vale';
    END IF;

    SELECT * INTO v_advance
    FROM public.barber_advances
    WHERE id = p_advance_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Vale nao encontrado para este tenant'; END IF;
    IF v_advance.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'Vale ja estornado'; END IF;
    IF v_advance.settlement_id IS NOT NULL THEN
        RAISE EXCEPTION 'Vale ja liquidado: estorne a liquidacao antes';
    END IF;

    UPDATE public.barber_advances
    SET reversed_at = timezone('utc'::text, now()),
        reversal_motivo = p_motivo
    WHERE id = p_advance_id AND tenant_id = p_tenant_id;

    SELECT s.name INTO v_staff_name
    FROM public.staff s WHERE s.id = v_advance.staff_id AND s.tenant_id = p_tenant_id;

    IF v_advance.transaction_id IS NOT NULL THEN
        INSERT INTO public.transactions (
            tenant_id, type, category, amount, description,
            payment_method, date, source_type, source_id, status
        ) VALUES (
            p_tenant_id,
            'income',
            'estorno_vale_comissao',
            v_advance.amount,
            'Estorno de vale - ' || COALESCE(v_staff_name, 'profissional'),
            NULL,
            timezone('utc'::text, now())::date,
            'barber_advance_reversal',
            v_advance.id,
            'completed'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'advance_id', p_advance_id,
        'reversed_at', timezone('utc'::text, now()),
        'message', 'Vale estornado.'
    );
END;
$$;

-- ============================================================================
-- 6. Grants e revogações
-- ============================================================================

REVOKE ALL ON FUNCTION public.register_barber_advance(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_barber_advance(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.link_advance_to_settlement(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_advance_to_settlement(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_barber_advance(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_barber_advance(UUID, UUID, TEXT) TO authenticated;

COMMIT;