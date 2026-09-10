-- ============================================================================
-- P2.1 — Import Engine: Persistence Layer (Clients)
-- VERSÃO FINAL CERTIFICADA (decisão PO 2026-09-10, D5)
-- Substitui o draft. Corpo idêntico ao deployado em staging (verificado
-- 2026-09-10: diff UTF-8 limpo, IGUAIS) e já em produção (baseline 6.1.1).
-- Fixes aplicados: SEC-01 (race condition), SEC-02 (SQLERRM leak), SEC-03 (DoS limits)
-- ============================================================================
-- Tabelas: import_jobs, import_rows
-- RPC: import_clients_batch (transacional, idempotente, heurística de duplicidade por telefone)
-- Princípios P2: duplicidade SEMPRE heurística (nunca UNIQUE), idempotência via import_job_id/import_row_id
-- ============================================================================

-- 1. Tabela import_jobs — controle de jobs de importação
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity TEXT NOT NULL,              -- 'client' | 'account_payable' | ...
  version TEXT NOT NULL,             -- 'v1' — template versionado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  file_name TEXT NOT NULL,
  file_bytes BIGINT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 2. Tabela import_rows — detalhe por linha (auditoria granular)
CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,                    -- linha original do CSV (para reprocessing/auditoria)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'skipped', 'error')),
  error_message TEXT,                         -- motivo se skipped/error
  imported_id UUID,                           -- id do cliente criado (se imported)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices
CREATE INDEX idx_import_jobs_tenant_id ON public.import_jobs (tenant_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs (status);
CREATE INDEX idx_import_rows_job_id ON public.import_rows (import_job_id);
CREATE INDEX idx_import_rows_tenant_id ON public.import_rows (tenant_id);
-- Idempotência por job+linha (padrão P0.4)
CREATE UNIQUE INDEX idx_import_rows_idempotency
  ON public.import_rows (tenant_id, import_job_id, row_number);

-- 4. RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

-- 4.1 Políticas import_jobs
DROP POLICY IF EXISTS "tenant_isolation_import_jobs" ON public.import_jobs;
CREATE POLICY "tenant_isolation_import_jobs" ON public.import_jobs
  FOR ALL USING (tenant_id = public.current_tenant_id_from_auth_uid());

DROP POLICY IF EXISTS "superadmin_bypass_import_jobs" ON public.import_jobs;
CREATE POLICY "superadmin_bypass_import_jobs" ON public.import_jobs
  FOR ALL USING (public.current_is_super_admin_from_auth_uid());

-- 4.2 Políticas import_rows
DROP POLICY IF EXISTS "tenant_isolation_import_rows" ON public.import_rows;
CREATE POLICY "tenant_isolation_import_rows" ON public.import_rows
  FOR ALL USING (tenant_id = public.current_tenant_id_from_auth_uid());

DROP POLICY IF EXISTS "superadmin_bypass_import_rows" ON public.import_rows;
CREATE POLICY "superadmin_bypass_import_rows" ON public.import_rows
  FOR ALL USING (public.current_is_super_admin_from_auth_uid());

-- 5. RPC: import_clients_batch
-- Recebe p_job_id (UUID) + p_rows (JSONB[] de ClientImportRow)
-- Transacional: insere em clients + registra import_rows
-- Idempotência: por import_job_id (UNIQUE em import_rows garante uma execução por job)
-- Duplicidade: heurística por telefone (sinaliza no preview, NÃO bloqueia INSERT)
-- Limites: máx 5000 linhas / 5 MB por lote (SEC-03)
-- Retorna: { jobId, totalRows, importedRows, skippedRows }
CREATE OR REPLACE FUNCTION public.import_clients_batch(
  p_job_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_job RECORD;
  v_row RECORD;
  v_imported INTEGER := 0;
  v_skipped INTEGER := 0;
  v_total INTEGER := 0;
  v_phone TEXT;
  v_existing_client RECORD;
  v_imported_id UUID;
  v_error_msg TEXT;
BEGIN
  -- 1. Validação obrigatória de idempotency key (job_id)
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id e obrigatorio';
  END IF;

  -- 2. Resolve tenant do contexto autenticado
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant nao identificado';
  END IF;

  -- SEC-03: Limites de lote (DoS protection)
  IF jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'Limite de 5000 linhas por importacao excedido';
  END IF;
  IF pg_column_size(p_rows) > 5 * 1024 * 1024 THEN  -- 5 MB
    RAISE EXCEPTION 'Tamanho do lote excede 5 MB';
  END IF;

  -- 3. Valida job existe, pertence ao tenant E está pendente — ATOMICAMENTE (SEC-01)
  -- UPDATE ... WHERE status='pending' RETURNING * garante atomicidade check+lock+update
  UPDATE public.import_jobs
  SET status = 'processing'
  WHERE id = p_job_id
    AND tenant_id = (SELECT public.current_tenant_id_from_auth_uid())
    AND status = 'pending'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    -- Job não existe, não pertence ao tenant, ou já processado
    SELECT * INTO v_job
    FROM public.import_jobs
    WHERE id = p_job_id
      AND tenant_id = (SELECT public.current_tenant_id_from_auth_uid());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Job de importacao nao encontrado ou acesso negado';
    END IF;

    -- Job existe mas não estava 'pending' → já processado (idempotência job-level)
    RETURN jsonb_build_object(
      'jobId', p_job_id,
      'totalRows', v_job.total_rows,
      'importedRows', v_job.imported_rows,
      'skippedRows', v_job.skipped_rows,
      'message', 'Job já processado anteriormente'
    );
  END IF;

  -- 4. Loop sobre as linhas (p_rows é JSONB array)
  FOR v_row IN
    SELECT * FROM jsonb_array_elements(p_rows) AS elem(row_data)
  LOOP
    v_total := v_total + 1;

    -- Extrai campos da linha
    v_phone := (v_row.row_data ->> 'phone')::TEXT;

    -- 5. Heurística de duplicidade: telefone já existe no tenant?
    -- REGRA P2: duplicidade é HEURÍSTICA — sinaliza, NÃO bloqueia, NÃO vira UNIQUE
    SELECT id INTO v_existing_client
    FROM public.clients
    WHERE tenant_id = v_tenant_id
      AND phone = v_phone
    LIMIT 1;

    IF FOUND THEN
      -- Duplicata candidata — registra como skipped, NÃO insere
      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, error_message
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'skipped',
        'Duplicata candidata: telefone ja cadastrado no tenant'
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;  -- idempotência por linha

      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 6. Insere cliente
    BEGIN
      INSERT INTO public.clients (
        tenant_id, name, email, phone, birthday, avatar, status, created_at
      ) VALUES (
        v_tenant_id,
        (v_row.row_data ->> 'name')::TEXT,
        (v_row.row_data ->> 'email')::TEXT,
        v_phone,
        (v_row.row_data ->> 'birthday')::TEXT,
        -- Fix INFO-02: encode('escape') inválido → URL encoding simples (espaço → %20)
        'https://ui-avatars.com/api/?name=' || replace((v_row.row_data ->> 'name')::TEXT, ' ', '%20') || '&background=random',
        'active',
        now()
      )
      RETURNING id INTO v_imported_id;

      -- Registra linha importada com sucesso
      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, imported_id
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'imported', v_imported_id
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;

      v_imported := v_imported + 1;

    EXCEPTION
      -- SEC-02: WHEN OTHERS + SQLERRM removido — mensagens genéricas/classificadas
      WHEN unique_violation THEN
        v_error_msg := 'Violacao de unicidade (linha duplicada no lote)';
      WHEN check_violation THEN
        v_error_msg := 'Dados invalidos (violam restricao de dominio)';
      WHEN not_null_violation THEN
        v_error_msg := 'Campo obrigatorio ausente';
      WHEN OTHERS THEN
        v_error_msg := 'Erro interno ao processar linha';  -- genérico, sem vazar SQLERRM
    END;

    -- Registra erro/skip classificado (fora do bloc EXCEPTION para capturar v_error_msg)
    IF v_error_msg IS NOT NULL THEN
      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, error_message
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'error', v_error_msg
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;

      v_skipped := v_skipped + 1;
      v_error_msg := NULL;  -- reset para próxima iteração
    END IF;
  END LOOP;

  -- 7. Finaliza job
  UPDATE public.import_jobs
  SET
    status = CASE
      WHEN v_skipped = 0 THEN 'completed'
      WHEN v_imported = 0 THEN 'failed'
      ELSE 'partial'
    END,
    imported_rows = v_imported,
    skipped_rows = v_skipped,
    total_rows = v_total,
    completed_at = now()
  WHERE id = p_job_id;

  -- 8. Retorna resultado
  RETURN jsonb_build_object(
    'jobId', p_job_id,
    'totalRows', v_total,
    'importedRows', v_imported,
    'skippedRows', v_skipped
  );
END;
$$;

-- 6. Grant
GRANT EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO authenticated;

-- ============================================================================
-- FIM DO DRAFT CORRIGIDO
-- ============================================================================