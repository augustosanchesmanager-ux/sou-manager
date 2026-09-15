/**
 * F2.2 (SEC-AUTHZ-USAGE-MONITOR) — Autenticação/autorização e validação de
 * payload da edge function `supabase-usage-monitor`.
 *
 * Auditoria ISSUE 4 (docs/security-audit/gerar-relatorio.cjs, cat '2' sev 'media'):
 * "Edge function pública sem autenticação alguma: não valida header Authorization
 * nem assina token, e usa a chave service_role para gravar em usage_logs e alerts,
 * contornando a RLS."
 *
 * Correção aprovada (PO, gate de CLASSIFY): validar a cadeia completa
 *   request → autenticação → autorização → validação do payload → operação service_role
 * com autorização restrita a superadmin, espelhando a intenção de segurança de
 * `public.is_super_admin()` (policies das tabelas `usage_logs`/`alerts`:
 * `USING (public.is_super_admin())`).
 *
 * SEM imports externos (puro) para funcionar em Deno (edge function) e vitest.
 * Importada pela edge function (via `../_shared/usage-monitor-auth.ts`) e pelos
 * testes de segurança (`tests/security/f2_2_usage_monitor_auth.test.ts`).
 */

/** Tipos de recurso aceitos — espelham os ids canônicos do dashboard
 *  (`components/supabase-monitor/mockData.ts`). Qualquer outro recurso é rejeitado
 *  para impedir escrita de ruído/forjada no monitoramento. */
export const ALLOWED_RESOURCE_TYPES = [
  'database_size',
  'requests',
  'cpu',
  'bandwidth',
  'auth_users',
  'storage',
] as const;

export type AllowedResourceType = (typeof ALLOWED_RESOURCE_TYPES)[number];

export const MAX_METRICS_PER_BATCH = 100;

export interface UsageMetric {
  resource_type: AllowedResourceType;
  value: number;
  limit_value: number;
  unit: string;
  metadata?: Record<string, unknown>;
}

export type MetricsValidationResult =
  | { ok: true; metrics: UsageMetric[] }
  | { ok: false; error: string };

/**
 * Autorização de nível superadmin, espelhando `public.is_super_admin()`:
 *
 *   SELECT COALESCE((auth.jwt() ->> 'role') = 'super_admin', FALSE)
 *       OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', FALSE);
 *
 * A comparação é EXATA (case-sensitive), como no banco. `user.role` corresponde à
 * claim `role` do JWT; `user.user_metadata` corresponde à claim `user_metadata`.
 */
export const isSuperAdminUser = (user: {
  role?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): boolean => {
  if (user.role === 'super_admin') return true;
  return user.user_metadata?.role === 'super_admin';
};

/**
 * Validação rigorosa do payload `{ "metrics": [...] }`.
 * Regras:
 *   - `metrics` deve ser array não vazio, com no máximo MAX_METRICS_PER_BATCH itens;
 *   - cada item deve ter `resource_type` ∈ ALLOWED_RESOURCE_TYPES;
 *   - `value` numérica finita >= 0; `limit_value` numérica finita > 0;
 *   - `unit` string não vazia; `metadata` (opcional) objeto plano (não array).
 */
export const validateMetricsPayload = (body: unknown): MetricsValidationResult => {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body deve ser um objeto JSON.' };
  }

  const record = body as Record<string, unknown>;

  if (!Array.isArray(record.metrics) || record.metrics.length === 0) {
    return { ok: false, error: 'metrics deve ser um array não vazio.' };
  }

  if (record.metrics.length > MAX_METRICS_PER_BATCH) {
    return { ok: false, error: `metrics excede o lote máximo de ${MAX_METRICS_PER_BATCH} itens.` };
  }

  const metrics: UsageMetric[] = [];

  for (const raw of record.metrics) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Cada item de metrics deve ser um objeto.' };
    }

    const item = raw as Record<string, unknown>;

    const resourceType = item.resource_type;
    if (
      typeof resourceType !== 'string' ||
      !(ALLOWED_RESOURCE_TYPES as readonly string[]).includes(resourceType)
    ) {
      return { ok: false, error: `resource_type desconhecido: ${String(resourceType)}.` };
    }

    if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0) {
      return { ok: false, error: `value de '${resourceType}' deve ser número finito >= 0.` };
    }

    if (typeof item.limit_value !== 'number' || !Number.isFinite(item.limit_value) || item.limit_value <= 0) {
      return { ok: false, error: `limit_value de '${resourceType}' deve ser número finito > 0.` };
    }

    if (typeof item.unit !== 'string' || item.unit.trim() === '') {
      return { ok: false, error: `unit de '${resourceType}' deve ser string não vazia.` };
    }

    if (
      item.metadata !== undefined &&
      (typeof item.metadata !== 'object' || item.metadata === null || Array.isArray(item.metadata))
    ) {
      return { ok: false, error: `metadata de '${resourceType}' deve ser objeto plano.` };
    }

    metrics.push({
      resource_type: resourceType as AllowedResourceType,
      value: item.value,
      limit_value: item.limit_value,
      unit: item.unit.trim(),
      metadata: item.metadata !== undefined ? (item.metadata as Record<string, unknown>) : undefined,
    });
  }

  return { ok: true, metrics };
};