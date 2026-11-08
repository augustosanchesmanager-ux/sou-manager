import { describe, it, expect, vi, beforeEach } from 'vitest';
import { determineRfmSegment, fetchSmartReturnData } from './smartReturnService';
import * as supabaseClientModule from '../../../services/supabaseClient';

vi.mock('../../../services/supabaseClient', () => ({
  getClientForTable: vi.fn(),
  getSharedClient: vi.fn(),
  supabase: {},
}));

describe('SmartReturnService', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockQuery = (tableDataMap: Record<string, unknown[]>) => {
    (supabaseClientModule.getClientForTable as any).mockImplementation((tableName: string) => {
      const createChain = (data: unknown[] = []) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: tableName === 'tenant_settings' ? { booking_enabled: true } : null,
            error: null,
          }),
          then: vi.fn((resolve: (val: any) => any) =>
            Promise.resolve({ data, error: null }).then(resolve)
          ),
        };
        return chain;
      };

      return {
        from: vi.fn(() => createChain(tableDataMap[tableName] || [])),
      };
    });
  };

  it('should_return_empty_data_when_tenant_id_is_missing', async () => {
    // Arrange & Act
    const result = await fetchSmartReturnData({ tenantId: '' });

    // Assert
    expect(result.records).toHaveLength(0);
    expect(result.kpis.totalClients).toBe(0);
    expect(result.kpis.attention).toBe(0);
    expect(result.publicBookingUrl).toBeNull();
  });

  it('should_categorize_client_as_up_to_date_when_last_visit_is_recent', async () => {
    // Arrange: Visita realizada há 5 dias
    const recentDate = new Date(Date.now() - 5 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-1',
          name: 'Lucas Ferreira',
          phone: '11987654321',
          email: 'lucas@example.com',
          avatar: null,
          last_visit: recentDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId, tenantSlug: 'barbearia-teste' });

    // Assert
    expect(result.records).toHaveLength(1);
    expect(result.records[0].status).toBe('up_to_date');
    expect(result.records[0].statusLabel).toBe('No Prazo');
    expect(result.kpis.upToDate).toBe(1);
    expect(result.kpis.attention).toBe(0);
  });

  it('should_categorize_client_as_attention_when_last_visit_between_20_and_35_days', async () => {
    // Arrange: Visita realizada há 25 dias (janela ideal de retorno)
    const attentionDate = new Date(Date.now() - 25 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-2',
          name: 'Marcos Souza',
          phone: '11999998888',
          email: null,
          avatar: null,
          last_visit: null,
        },
      ],
      appointments: [
        {
          id: 'apt-1',
          client_id: 'c-2',
          start_time: attentionDate,
          status: 'completed',
          staff: { id: 's-1', name: 'Barbeiro Mestre' },
        },
      ],
      comandas: [],
      customer_subscriptions: [],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId, shopName: 'Barbearia Sanchez' });

    // Assert
    expect(result.records).toHaveLength(1);
    const record = result.records[0];
    expect(record.status).toBe('attention');
    expect(record.statusLabel).toBe('Janela de Retorno');
    expect(record.lastStaffName).toBe('Barbeiro Mestre');
    expect(record.suggestedMessage).toContain('Barbearia Sanchez');
    expect(record.suggestedMessage).toContain('Marcos');
    expect(result.kpis.attention).toBe(1);
  });

  it('should_categorize_client_as_risk_when_last_visit_between_36_and_60_days', async () => {
    // Arrange: Visita realizada há 45 dias
    const riskDate = new Date(Date.now() - 45 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-3',
          name: 'Renato Silva',
          phone: '11977776666',
          email: null,
          avatar: null,
          last_visit: riskDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId });

    // Assert
    expect(result.records[0].status).toBe('risk');
    expect(result.records[0].statusLabel).toBe('Em Risco');
    expect(result.kpis.risk).toBe(1);
  });

  it('should_categorize_client_as_inactive_when_last_visit_exceeds_60_days', async () => {
    // Arrange: Visita realizada há 75 dias
    const inactiveDate = new Date(Date.now() - 75 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-4',
          name: 'Carlos Mendes',
          phone: '11966665555',
          email: null,
          avatar: null,
          last_visit: inactiveDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId });

    // Assert
    expect(result.records[0].status).toBe('inactive');
    expect(result.records[0].statusLabel).toBe('Inativo');
    expect(result.kpis.inactive).toBe(1);
  });

  it('should_identify_club_member_when_active_subscription_exists', async () => {
    // Arrange: Cliente membro do Clube dos Chefes
    const visitDate = new Date(Date.now() - 30 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-5',
          name: 'Guilherme Santos',
          phone: '11955554444',
          email: null,
          avatar: null,
          last_visit: visitDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [
        {
          client_id: 'c-5',
          status: 'active',
          plan: { name: 'Plano VIP Black' },
        },
      ],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId });

    // Assert
    expect(result.records[0].isClubMember).toBe(true);
    expect(result.records[0].clubPlanName).toBe('Plano VIP Black');
  });

  it('should_build_correct_whatsapp_url_when_phone_is_valid', async () => {
    // Arrange: Cliente com telefone válido
    const visitDate = new Date(Date.now() - 25 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-6',
          name: 'Felipe Alcantara',
          phone: '(11) 98888-7777',
          email: null,
          avatar: null,
          last_visit: visitDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [],
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId, tenantSlug: 'barber-vip' });

    // Assert
    const record = result.records[0];
    expect(record.isPhoneValid).toBe(true);
    expect(record.whatsAppUrl).toContain('https://wa.me/5511988887777');
    expect(record.whatsAppUrl).toContain(encodeURIComponent('Felipe'));
  });

  it('should_mark_hasUpcomingAppointment_when_future_appointment_exists', async () => {
    // Arrange: Cliente tem agendamento futuro
    const visitDate = new Date(Date.now() - 25 * 86400000).toISOString();
    setupMockQuery({
      clients: [
        {
          id: 'c-7',
          name: 'Diego Costa',
          phone: '11944443333',
          email: null,
          avatar: null,
          last_visit: visitDate,
        },
      ],
      appointments: [],
      comandas: [],
      customer_subscriptions: [],
    });

    // Injetar agendamento futuro no upcomingRes (segunda chamada de appointments)
    let appointmentsFromCallCount = 0;
    (supabaseClientModule.getClientForTable as any).mockImplementation((tableName: string) => {
      if (tableName === 'appointments') {
        return {
          from: vi.fn(() => {
            appointmentsFromCallCount++;
            const isUpcoming = appointmentsFromCallCount === 2;
            const data = isUpcoming ? [{ client_id: 'c-7', start_time: '2026-10-25T14:00:00' }] : [];
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              then: vi.fn((resolve: (val: any) => any) => Promise.resolve({ data, error: null }).then(resolve)),
            };
          }),
        };
      }
      return {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: vi.fn((resolve: (val: any) => any) =>
            Promise.resolve({
              data: tableName === 'clients' ? [{ id: 'c-7', name: 'Diego Costa', phone: '11944443333' }] : [],
              error: null,
            }).then(resolve)
          ),
        })),
      };
    });

    // Act
    const result = await fetchSmartReturnData({ tenantId });

    // Assert
    expect(result.records[0].hasUpcomingAppointment).toBe(true);
  });

  describe('RFM Segmentation Logic', () => {
    it('should_classify_as_champion_when_high_visits_and_high_spent_and_recent', () => {
      // 10 dias de recência, 6 visitas e R$ 450 gastos
      const res = determineRfmSegment(10, 6, 450);
      expect(res.segment).toBe('champion');
      expect(res.label).toBe('VIP / Campeão');
    });

    it('should_classify_as_at_risk_when_high_visits_and_spent_but_over_35_days', () => {
      // 40 dias de recência, 5 visitas e R$ 300 gastos (VIP em risco)
      const res = determineRfmSegment(40, 5, 300);
      expect(res.segment).toBe('at_risk');
      expect(res.label).toBe('VIP em Risco');
    });

    it('should_classify_as_loyal_when_regular_visits_and_recent', () => {
      // 25 dias de recência, 3 visitas e R$ 120 gastos
      const res = determineRfmSegment(25, 3, 120);
      expect(res.segment).toBe('loyal');
      expect(res.label).toBe('Cliente Leal');
    });

    it('should_classify_as_promising_when_few_visits_and_very_recent', () => {
      // 10 dias de recência, 1 visita
      const res = determineRfmSegment(10, 1, 50);
      expect(res.segment).toBe('promising');
      expect(res.label).toBe('Promissor');
    });

    it('should_classify_as_hibernating_when_over_60_days_without_visit', () => {
      const res = determineRfmSegment(70, 2, 80);
      expect(res.segment).toBe('hibernating');
      expect(res.label).toBe('Hibernando');
    });
  });

  describe('RFM Metrics & At-Risk Revenue KPI Calculation', () => {
    it('should_aggregate_visits_and_spent_and_calculate_atRiskRevenue_correctly', async () => {
      // Arrange:
      // Cliente A (VIP / Campeão): 4 visitas, R$ 280 gastos, visita há 15 dias (No Prazo)
      // Cliente B (Em Risco): 1 visita, R$ 75 gastos, visita há 45 dias (Em Risco)
      const visitDateRecent = new Date(Date.now() - 15 * 86400000).toISOString();
      const visitDateRisk = new Date(Date.now() - 45 * 86400000).toISOString();

      setupMockQuery({
        clients: [
          { id: 'c-vip', name: 'Rodrigo VIP', phone: '11988880001', last_visit: visitDateRecent },
          { id: 'c-risk', name: 'Carlos Risco', phone: '11988880002', last_visit: visitDateRisk },
        ],
        appointments: [
          { id: 'apt-1', client_id: 'c-vip', start_time: visitDateRecent, status: 'completed' },
          { id: 'apt-2', client_id: 'c-vip', start_time: visitDateRecent, status: 'completed' },
          { id: 'apt-3', client_id: 'c-vip', start_time: visitDateRecent, status: 'completed' },
          { id: 'apt-4', client_id: 'c-vip', start_time: visitDateRecent, status: 'completed' },
          { id: 'apt-5', client_id: 'c-risk', start_time: visitDateRisk, status: 'completed' },
        ],
        comandas: [
          { id: 'cmd-1', client_id: 'c-vip', closed_at: visitDateRecent, status: 'paid', total: 140 },
          { id: 'cmd-2', client_id: 'c-vip', closed_at: visitDateRecent, status: 'paid', total: 140 },
          { id: 'cmd-3', client_id: 'c-risk', closed_at: visitDateRisk, status: 'paid', total: 75 },
        ],
        customer_subscriptions: [],
      });

      // Act
      const result = await fetchSmartReturnData({ tenantId });

      // Assert
      expect(result.records).toHaveLength(2);

      const vipRecord = result.records.find((r) => r.id === 'c-vip')!;
      expect(vipRecord.rfmSegment).toBe('champion');
      expect(vipRecord.totalVisits).toBe(4);
      expect(vipRecord.totalSpent).toBe(280);
      expect(vipRecord.avgTicket).toBe(70);

      const riskRecord = result.records.find((r) => r.id === 'c-risk')!;
      expect(riskRecord.status).toBe('risk');
      expect(riskRecord.totalVisits).toBe(1);
      expect(riskRecord.totalSpent).toBe(75);

      // KPIs
      expect(result.kpis.championsCount).toBe(1);
      expect(result.kpis.atRiskRevenue).toBe(75);
    });
  });
});
