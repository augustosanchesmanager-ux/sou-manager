/**
 * P1.3 — Teste de Segurança: get_dashboard_kpis
 *
 * Verifica que o RPC rejeita:
 * 1. Usuário não autenticado (auth.uid() = NULL)
 * 2. Tenant não resolvido
 * 3. Papel sem permissão (barber, receptionist)
 * 4. Profissional que não pertence ao tenant
 * 5. Período inválido
 *
 * ⚠ Estes testes documentam os gates de segurança implementados no SQL.
 *   O teste unitário mocka o Supabase client para simular cenários de erro.
 *   Testes de integração com banco real devem ser feitos em staging.
 *
 * Decisões: D-EST-01, D-PERF-01, D-RET-01.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase Client ───────────────────────────────────────
// vi.mock is hoisted — use vi.hoisted to declare mock before hoisting

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

// ─── Import after mock ──────────────────────────────────────────

import { getDashboardKpis } from '../../src/modules/dashboard/rpc';

// ─── Tests ──────────────────────────────────────────────────────

describe('P1.3 Security — get_dashboard_kpis RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GATE 1: Autenticado', () => {
    it('should_throw_when_rpc_returns_auth_error', async () => {
      // Arrange — simulate auth.uid() = NULL
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Usuario autenticado obrigatorio', code: 'PGRST301' },
      });

      // Act & Assert
      await expect(getDashboardKpis('month')).rejects.toThrow('get_dashboard_kpis failed');
    });
  });

  describe('GATE 2: Tenant derivado do contexto', () => {
    it('should_throw_when_tenant_not_resolved', async () => {
      // Arrange — simulate tenant_id = NULL
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Tenant nao resolvido para o usuario autenticado', code: 'PGRST301' },
      });

      // Act & Assert
      await expect(getDashboardKpis('month')).rejects.toThrow('get_dashboard_kpis failed');
    });
  });

  describe('GATE 3: Papel permitido', () => {
    it('should_throw_when_user_has_no_permission', async () => {
      // Arrange — simulate user with 'barber' role
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Usuario sem permissao para KPIs', code: 'PGRST301' },
      });

      // Act & Assert
      await expect(getDashboardKpis('month')).rejects.toThrow('get_dashboard_kpis failed');
    });

    it('should_allow_manager_role', async () => {
      // Arrange — simulate successful call with manager role
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      const result = await getDashboardKpis('month');

      // Assert — should succeed
      expect(result).toBeDefined();
      expect(result.meta.tenant_id).toBe('tenant-1');
    });

    it('should_allow_owner_role', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      const result = await getDashboardKpis('month');

      // Assert
      expect(result).toBeDefined();
    });

    it('should_allow_superadmin_role', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      const result = await getDashboardKpis('month');

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('GATE 4: Escopo de staff', () => {
    it('should_throw_when_staff_does_not_belong_to_tenant', async () => {
      // Arrange — simulate staff not in tenant
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Profissional nao pertence ao tenant', code: 'PGRST301' },
      });

      // Act & Assert
      await expect(getDashboardKpis('month', 'staff-from-other-tenant')).rejects.toThrow('get_dashboard_kpis failed');
    });

    it('should_accept_valid_staff_id', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month', scope_staff_id: 'staff-1' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      const result = await getDashboardKpis('month', 'staff-1');

      // Assert
      expect(result.meta.scope_staff_id).toBe('staff-1');
    });
  });

  describe('GATE 5: Período válido', () => {
    it('should_throw_when_period_is_invalid', async () => {
      // Arrange — simulate invalid period
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Periodo invalido: invalid_period', code: 'PGRST301' },
      });

      // Act & Assert
      await expect(getDashboardKpis('invalid_period' as never)).rejects.toThrow('get_dashboard_kpis failed');
    });

    it('should_accept_all_valid_periods', async () => {
      // Arrange
      const validPeriods = ['today', 'yesterday', 'week', 'month', 'quarter', 'year'];

      for (const period of validPeriods) {
        mockRpc.mockResolvedValue({
          data: {
            meta: { tenant_id: 'tenant-1', period },
            financial: { revenue: 1000, expenses: 500, result: 500 },
          },
          error: null,
        });

        // Act
        const result = await getDashboardKpis(period as never);

        // Assert
        expect(result).toBeDefined();
        expect(result.meta.period).toBe(period);
      }
    });
  });

  describe('RPC Parameters', () => {
    it('should_pass_period_and_staff_id_to_rpc', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'week' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      await getDashboardKpis('week', 'staff-123');

      // Assert
      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_kpis', {
        p_period: 'week',
        p_staff_id: 'staff-123',
      });
    });

    it('should_pass_null_staff_id_when_not_provided', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      await getDashboardKpis('month');

      // Assert
      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_kpis', {
        p_period: 'month',
        p_staff_id: null,
      });
    });

    it('should_default_to_month_when_no_period_provided', async () => {
      // Arrange
      mockRpc.mockResolvedValue({
        data: {
          meta: { tenant_id: 'tenant-1', period: 'month' },
          financial: { revenue: 1000, expenses: 500, result: 500 },
        },
        error: null,
      });

      // Act
      await getDashboardKpis();

      // Assert
      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_kpis', {
        p_period: 'month',
        p_staff_id: null,
      });
    });
  });

  describe('Response Structure', () => {
    it('should_return_full_kpi_envelope', async () => {
      // Arrange
      const mockResult = {
        meta: {
          tenant_id: 'tenant-1',
          period: 'month',
          start: '2026-09-01T00:00:00Z',
          end: '2026-10-01T00:00:00Z',
          timezone: 'America/Sao_Paulo',
          generated_at: new Date().toISOString(),
          result_basis: 'transactional',
          scope_staff_id: null,
        },
        financial: {
          revenue: 6000,
          expenses: 1500,
          result: 4500,
          reversals: 200,
          average_ticket: 200,
          growth: 0.15,
        },
        clients: {
          active_clients: 50,
          new_clients: 10,
          base_clients: 40,
          returned_clients: 30,
          retention: 0.75,
        },
        operations: {
          total: 100,
          completed: 80,
          cancelled: 10,
          no_show: 10,
        },
        staff: [
          {
            professional_id: 'staff-1',
            professional_name: 'Barbeiro 1',
            atendimentos: 20,
            receita_gerada: 2000,
          },
        ],
      };

      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      // Act
      const result = await getDashboardKpis('month');

      // Assert
      expect(result).toEqual(mockResult);
      expect(result.meta).toBeDefined();
      expect(result.financial).toBeDefined();
      expect(result.clients).toBeDefined();
      expect(result.operations).toBeDefined();
      expect(result.staff).toBeDefined();
      expect(Array.isArray(result.staff)).toBe(true);
    });
  });
});
