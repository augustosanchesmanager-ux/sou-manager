import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as supabaseClientModule from '../../services/supabaseClient';
import * as zeroCloseModule from '../../src/lib/finance/zeroClose';
import {
  checkClientCreditEligibility,
  settleComandaWithClubCredits,
} from './clientCreditCheck';

vi.mock('../../services/supabaseClient', () => ({
  getClientForTable: vi.fn(),
  getSharedClient: vi.fn(),
  supabase: {},
}));

vi.mock('../../src/lib/finance/zeroClose', () => ({
  closeZeroAmountComanda: vi.fn(),
}));

describe('clientCreditCheck (Eixo C - Baixa Automática Clube dos Chefes)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const clientId = 'c-100';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockSupabase = ({
    subscriptionData = null,
    creditData = null,
  }: {
    subscriptionData?: any;
    creditData?: any;
  }) => {
    (supabaseClientModule.getClientForTable as any).mockImplementation((tableName: string) => {
      if (tableName === 'customer_subscriptions') {
        return {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: subscriptionData, error: null }),
          })),
        };
      }
      if (tableName === 'customer_credits') {
        return {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: creditData, error: null }),
          })),
        };
      }
      return { from: vi.fn() };
    });
  };

  it('should_return_not_member_when_no_active_subscription_exists', async () => {
    setupMockSupabase({ subscriptionData: null });

    const result = await checkClientCreditEligibility(tenantId, clientId, []);

    expect(result.isClubMember).toBe(false);
    expect(result.isFullyCoveredByCredits).toBe(false);
    expect(result.totalAvailableCredits).toBe(0);
  });

  it('should_detect_fully_covered_when_client_has_credits_and_only_services_in_comanda', async () => {
    setupMockSupabase({
      subscriptionData: {
        id: 'sub-1',
        plan_id: 'plan-1',
        status: 'active',
        plan: { name: 'VIP Gold' },
      },
      creditData: {
        available_credits: 4,
        used_credits: 1,
        service_balance_map: [
          { service_id: 'srv-corte', service_name: 'Corte Tradicional', available: 2, used: 1 },
        ],
      },
    });

    const comandaItems = [
      { id: 'item-1', service_id: 'srv-corte', name: 'Corte Tradicional', quantity: 1 },
    ];

    const result = await checkClientCreditEligibility(tenantId, clientId, comandaItems);

    expect(result.isClubMember).toBe(true);
    expect(result.planName).toBe('VIP Gold');
    expect(result.totalAvailableCredits).toBe(4);
    expect(result.isFullyCoveredByCredits).toBe(true);
  });

  it('should_not_be_fully_covered_when_comanda_contains_physical_products', async () => {
    setupMockSupabase({
      subscriptionData: {
        id: 'sub-1',
        plan_id: 'plan-1',
        status: 'active',
        plan: { name: 'VIP Gold' },
      },
      creditData: {
        available_credits: 4,
        used_credits: 0,
        service_balance_map: [],
      },
    });

    // Comanda tem corte + pomada modeladora (produto físico)
    const comandaItems = [
      { id: 'item-1', service_id: 'srv-corte', name: 'Corte Tradicional', quantity: 1 },
      { id: 'item-2', product_id: 'prod-pomada', name: 'Pomada Matte', quantity: 1 },
    ];

    const result = await checkClientCreditEligibility(tenantId, clientId, comandaItems);

    expect(result.isClubMember).toBe(true);
    expect(result.isFullyCoveredByCredits).toBe(false);
  });

  it('should_settle_comanda_with_club_credits_calling_closeZeroAmountComanda', async () => {
    (zeroCloseModule.closeZeroAmountComanda as any).mockResolvedValue({
      success: true,
      comandaId: 'cmd-999',
      updatedCount: 1,
      origin: 'club_credit',
      message: 'Comanda fechada com origem zero: Crédito do Club dos Chefes.',
    });

    const mockSupabase = {};
    const res = await settleComandaWithClubCredits(mockSupabase, tenantId, 'cmd-999', 'user-admin');

    expect(res.success).toBe(true);
    expect(zeroCloseModule.closeZeroAmountComanda).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        comandaId: 'cmd-999',
        origin: 'club_credit',
        source: 'checkout',
      }),
    );
  });
});
