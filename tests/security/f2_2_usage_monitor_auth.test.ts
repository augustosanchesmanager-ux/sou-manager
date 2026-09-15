/**
 * F2.2 (SEC-AUTHZ-USAGE-MONITOR) — Teste da cadeia de segurança da edge function
 * `supabase-usage-monitor`.
 *
 * Auditoria ISSUE 4 (docs/security-audit/gerar-relatorio.cjs): "Edge function
 * pública sem autenticação alguma: não valida header Authorization nem assina
 * token, e usa a chave service_role para gravar em usage_logs e alerts,
 * contornando a RLS."
 *
 * Correção aprovada (PO, 2026-09-14): validar a cadeia completa
 *   request → autenticação → autorização → validação do payload → operação service_role
 * com autorização restrita a superadmin (espelha `public.is_super_admin()`).
 *
 * Critérios de aceite:
 *   1. Superadmin (role ou user_metadata.role = 'super_admin') é autorizado
 *   2. Autenticado comum (barber/receptionist/manager, role ausente) é NEGADO
 *   3. Payload válido passa na validação rigorosa
 *   4. Payload inválido (resource_type desconhecido, números não finitos/
 *      negativos/zero, unit vazia, metadata não-objeto, lote > max) é REJEITADO
 *   5. A função testada é a MESMA importada pela edge function (fonte única em
 *      supabase/functions/_shared/usage-monitor-auth.ts)
 *
 * As funções testadas são PURAS (sem Deno/supabase-js) — portáveis entre a
 * edge function e o vitest, no padrão da F2.1 (staff-role-hierarchy).
 */

import { describe, it, expect } from 'vitest';
import {
  isSuperAdminUser,
  validateMetricsPayload,
  ALLOWED_RESOURCE_TYPES,
  MAX_METRICS_PER_BATCH,
} from '../../supabase/functions/_shared/usage-monitor-auth';

const makeUser = (overrides: { role?: string | null; user_metadata?: Record<string, unknown> | null } = {}) => ({
  id: 'user-1',
  role: overrides.role ?? null,
  user_metadata: overrides.user_metadata ?? null,
});

const makeValidMetric = () => ({
  resource_type: 'cpu',
  value: 63,
  limit_value: 100,
  unit: '%',
});

describe('F2.2 Security — usage monitor auth chain', () => {
  describe('isSuperAdminUser — aceite 1: superadmin autorizado', () => {
    it('should_be_true_when_jwt_role_is_super_admin', () => {
      // Arrange & Act & Assert
      expect(isSuperAdminUser(makeUser({ role: 'super_admin' }))).toBe(true);
    });

    it('should_be_true_when_user_metadata_role_is_super_admin', () => {
      expect(isSuperAdminUser(makeUser({ user_metadata: { role: 'super_admin' } }))).toBe(true);
    });

    it('should_be_true_when_both_claims_present', () => {
      expect(
        isSuperAdminUser(
          makeUser({ role: 'super_admin', user_metadata: { role: 'super_admin' } }),
        ),
      ).toBe(true);
    });
  });

  describe('isSuperAdminUser — aceite 2: autenticado comum negado', () => {
    it('should_be_false_when_jwt_role_is_authenticated_only', () => {
      expect(isSuperAdminUser(makeUser({ role: 'authenticated' }))).toBe(false);
    });

    it('should_be_false_when_user_metadata_role_is_staff_role', () => {
      expect(isSuperAdminUser(makeUser({ user_metadata: { role: 'manager' } }))).toBe(false);
      expect(isSuperAdminUser(makeUser({ user_metadata: { role: 'barber' } }))).toBe(false);
      expect(isSuperAdminUser(makeUser({ user_metadata: { role: 'receptionist' } }))).toBe(false);
    });

    it('should_be_false_when_no_role_claims', () => {
      expect(isSuperAdminUser(makeUser())).toBe(false);
    });

    it('should_be_false_when_role_is_empty_string', () => {
      expect(isSuperAdminUser(makeUser({ role: '' }))).toBe(false);
    });
  });

  describe('validateMetricsPayload — aceite 3: payload válido aceito', () => {
    it('should_return_metrics_when_payload_is_valid', () => {
      // Arrange
      const body = { metrics: [makeValidMetric()] };

      // Act
      const result = validateMetricsPayload(body);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]).toMatchObject({ resource_type: 'cpu', value: 63, limit_value: 100, unit: '%' });
      }
    });

    it('should_accept_up_to_max_metrics_per_batch', () => {
      // Arrange
      const body = {
        metrics: Array.from({ length: MAX_METRICS_PER_BATCH }, () => makeValidMetric()),
      };

      // Act
      const result = validateMetricsPayload(body);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.metrics).toHaveLength(MAX_METRICS_PER_BATCH);
      }
    });

    it('should_accept_optional_metadata_object', () => {
      // Arrange
      const body = { metrics: [{ ...makeValidMetric(), metadata: { region: 'sa-east-1' } }] };

      // Act
      const result = validateMetricsPayload(body);

      // Assert
      expect(result.ok).toBe(true);
    });

    it('should_accept_all_canonical_resource_types', () => {
      // Arrange
      const metrics = ALLOWED_RESOURCE_TYPES.map((resource_type) => ({
        resource_type,
        value: 1,
        limit_value: 10,
        unit: 'u',
      }));

      // Act
      const result = validateMetricsPayload({ metrics });

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe('validateMetricsPayload — aceite 4: payload inválido rejeitado', () => {
    it('should_reject_when_body_is_not_object', () => {
      expect(validateMetricsPayload(null).ok).toBe(false);
      expect(validateMetricsPayload('nope').ok).toBe(false);
      expect(validateMetricsPayload([]).ok).toBe(false);
    });

    it('should_reject_when_metrics_is_missing_empty_or_not_array', () => {
      expect(validateMetricsPayload({}).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: 'cpu' }).ok).toBe(false);
    });

    it('should_reject_when_metrics_exceeds_max_batch', () => {
      // Arrange
      const body = {
        metrics: Array.from({ length: MAX_METRICS_PER_BATCH + 1 }, () => makeValidMetric()),
      };

      // Act
      const result = validateMetricsPayload(body);

      // Assert
      expect(result.ok).toBe(false);
    });

    it('should_reject_when_resource_type_is_unknown', () => {
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), resource_type: 'quantum_flux' }] }).ok).toBe(false);
    });

    it('should_reject_when_value_is_not_finite_or_negative', () => {
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), value: Number.NaN }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), value: Number.POSITIVE_INFINITY }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), value: -1 }] }).ok).toBe(false);
    });

    it('should_reject_when_limit_value_is_not_finite_or_not_positive', () => {
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), limit_value: 0 }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), limit_value: -5 }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), limit_value: Number.NaN }] }).ok).toBe(false);
    });

    it('should_reject_when_unit_is_missing_or_empty', () => {
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), unit: '' }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), unit: '   ' }] }).ok).toBe(false);
    });

    it('should_reject_when_metadata_is_not_plain_object', () => {
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), metadata: [] }] }).ok).toBe(false);
      expect(validateMetricsPayload({ metrics: [{ ...makeValidMetric(), metadata: 'x' }] }).ok).toBe(false);
    });

    it('should_reject_when_metric_item_is_not_object', () => {
      expect(validateMetricsPayload({ metrics: [42] }).ok).toBe(false);
    });
  });
});