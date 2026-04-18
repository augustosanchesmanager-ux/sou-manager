import { describe, expect, it } from 'vitest';
import {
  applyChefClubBenefitsToCart,
  buildChefClubConsumptionRecords,
  getChefClubCheckoutSummary,
  isChefClubEligibleService,
} from './chefClubIntegration';
import type { ChefClubContext, ChefClubItemInput } from '../contracts/chefClub';

const createContext = (): ChefClubContext => ({
  subscription: {
    id: 'sub-1',
    plan_id: 'plan-1',
    plan_name: 'Plano Premium',
    status: 'active',
    cycle_start: '2026-04-01T00:00:00.000Z',
    cycle_end: '2026-05-01T00:00:00.000Z',
    next_billing_date: '2026-05-01',
  },
  balances: [
    {
      id: 'balance-1',
      subscription_id: 'sub-1',
      benefit_code: 'cut',
      benefit_label: 'Corte',
      available_credits: 1,
      used_credits: 0,
      source_plan_benefit_id: 'plan-benefit-1',
    },
  ],
  planBenefits: [
    {
      id: 'plan-benefit-1',
      plan_id: 'plan-1',
      benefit_code: 'cut',
      benefit_label: 'Corte',
      monthly_quantity: 1,
      eligible_service_categories: ['cabelo'],
      eligible_service_ids: [],
      eligible_service_names: [],
      active: true,
      priority: 10,
    },
  ],
});

describe('chefClubIntegration', () => {
  it('recognizes eligible service items', () => {
    const item: ChefClubItemInput = {
      id: 'item-1',
      type: 'service',
      name: 'Corte Masculino',
      service_id: 'service-1',
      quantity: 1,
      unitPrice: 50,
      category: 'Cabelo',
    };

    const result = isChefClubEligibleService(item, createContext().planBenefits[0]);
    expect(result.eligible).toBe(true);
  });

  it('applies a benefit only once when balance is limited', () => {
    const items: ChefClubItemInput[] = [
      {
        id: 'item-1',
        type: 'service',
        name: 'Corte 1',
        service_id: 'service-1',
        quantity: 1,
        unitPrice: 50,
        category: 'Cabelo',
      },
      {
        id: 'item-2',
        type: 'service',
        name: 'Corte 2',
        service_id: 'service-2',
        quantity: 1,
        unitPrice: 50,
        category: 'Cabelo',
      },
    ];

    const resolved = applyChefClubBenefitsToCart(items, createContext());
    expect(resolved[0].appliedBenefit).toBeTruthy();
    expect(resolved[1].appliedBenefit).toBeNull();
  });

  it('builds the correct checkout summary', () => {
    const resolved = applyChefClubBenefitsToCart(
      [
        {
          id: 'item-1',
          type: 'service',
          name: 'Corte',
          service_id: 'service-1',
          quantity: 1,
          unitPrice: 50,
          category: 'Cabelo',
        },
      ],
      createContext(),
    );

    const summary = getChefClubCheckoutSummary(resolved);
    expect(summary.originalSubtotal).toBe(50);
    expect(summary.savingsTotal).toBe(50);
    expect(summary.finalTotal).toBe(0);
  });

  it('builds consumption records for closed items', () => {
    const resolved = applyChefClubBenefitsToCart(
      [
        {
          id: 'item-1',
          type: 'service',
          name: 'Corte',
          service_id: 'service-1',
          quantity: 1,
          unitPrice: 50,
          category: 'Cabelo',
        },
      ],
      createContext(),
    );

    const records = buildChefClubConsumptionRecords(resolved, {
      subscriptionId: 'sub-1',
      clientId: 'client-1',
      comandaId: 'comanda-1',
    });

    expect(records).toHaveLength(1);
    expect(records[0].benefit_code).toBe('cut');
    expect(records[0].comanda_item_id).toBe('item-1');
  });
});
