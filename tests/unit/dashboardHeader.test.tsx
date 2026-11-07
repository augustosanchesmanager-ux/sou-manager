import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import type { DashboardMetrics } from '../../src/modules/dashboard';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { user_metadata: { first_name: 'Carlos' } },
  }),
}));

describe('DashboardHeader: Comparativo de Períodos e Métricas', () => {
  const mockMetrics: DashboardMetrics = {
    revenue: 1500,
    revenuePrevious: 1200,
    revenueGrowth: 25,
    expenses: 300,
    expensesPrevious: 250,
    netRevenue: 1200,
    netRevenuePrevious: 950,
    revenueGoal: 5000,
    activeStaffPercent: 80,
    todayAppointments: 20,
    previousAppointments: 16,
    appointmentsGrowth: 25,
    appointmentsGoal: 100,
    avgTicket: 75,
    avgTicketPrevious: 60,
    avgTicketGrowth: 25,
    retentionRate: 85,
  };

  it('should_render_today_kpis_with_growth_badges', () => {
    const html = renderToStaticMarkup(
      <DashboardHeader
        period="today"
        onPeriodChange={vi.fn()}
        openComandasCount={3}
        pendingAppointmentsCount={2}
        returningClientsCount={5}
        todayKpis={{
          totalToday: 20,
          faturamento: 1500,
          emAtendimento: 2,
          pendentes: 3,
          cancelados: 1,
          concluidos: 14,
        }}
        metrics={mockMetrics}
        onNewAppointment={vi.fn()}
        onOpenCheckout={vi.fn()}
        onOpenComandas={vi.fn()}
        onOpenSmartReturn={vi.fn()}
      />
    );

    expect(html).toContain('Hoje');
    expect(html).toContain('Faturamento');
    expect(html).toContain('vs. ontem');
    expect(html).toContain('25%');
  });

  it('should_render_yesterday_comparative_kpis_when_period_is_yesterday', () => {
    const html = renderToStaticMarkup(
      <DashboardHeader
        period="yesterday"
        onPeriodChange={vi.fn()}
        openComandasCount={0}
        pendingAppointmentsCount={0}
        returningClientsCount={0}
        metrics={mockMetrics}
        onNewAppointment={vi.fn()}
        onOpenCheckout={vi.fn()}
        onOpenComandas={vi.fn()}
        onOpenSmartReturn={vi.fn()}
      />
    );

    expect(html).toContain('Ontem');
    expect(html).toContain('Ticket Médio');
    expect(html).toContain('Receita Líq.');
    expect(html).toContain('vs. dia anterior');
    expect(html).toContain('Retenção');
    expect(html).toContain('Equipe Ativa');
  });
});
