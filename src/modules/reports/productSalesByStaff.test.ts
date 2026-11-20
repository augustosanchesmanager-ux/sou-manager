import { describe, expect, it } from 'vitest';
import { buildProductSalesByStaffRows } from './reportsDataService';
import type { AllocatedComandaItemDetail } from './reportsDataService';
import type { ProductGoalTemplate, StaffProductGoal } from '../../../domain/productGoals/types';

describe('buildProductSalesByStaffRows', () => {
  const templates: ProductGoalTemplate[] = [
    {
      id: 'tpl-rec',
      tenantId: 't1',
      name: 'Meta Padrão Recepção',
      targetRole: 'receptionist',
      periodType: 'monthly',
      baseGoalAmount: 1000,
      tiers: [
        {
          id: 't1',
          label: 'Meta 1',
          triggerType: 'amount_brl',
          thresholdValue: 1000,
          rewardType: 'fixed_brl',
          rewardValue: 100,
          percentBase: 'total_sold',
        },
      ],
      active: true,
    },
  ];

  const staffList = [
    { id: 'rec-1', name: 'Ana Recepção', role: 'receptionist', active: true },
    { id: 'barb-1', name: 'Carlos Barbeiro', role: 'barber', active: true },
  ];

  const allocatedItems: AllocatedComandaItemDetail[] = [
    {
      id: 'i1',
      comanda_id: 'c1',
      item_name: 'Pomada Matte',
      item_type: 'product',
      barber_id: 'rec-1',
      barber_name: 'Ana Recepção',
      quantity: 2,
      unit_price: 600,
      catalog_price: 1200,
      direct_discount: 0,
      allocated_order_discount: 0,
      total_discount: 0,
      applied_amount: 1200,
      commission_rate: 0,
      commission_amount: 0,
      closedAt: '2026-11-20T12:00:00Z',
      comandaShortId: '#C1',
      clientName: 'João',
      paymentMethodLabel: 'Pix',
      isClubCredit: false,
    },
    {
      id: 'i2',
      comanda_id: 'c2',
      item_name: 'Óleo para Barba',
      item_type: 'product',
      barber_id: 'barb-1',
      barber_name: 'Carlos Barbeiro',
      quantity: 1,
      unit_price: 500,
      catalog_price: 500,
      direct_discount: 0,
      allocated_order_discount: 0,
      total_discount: 0,
      applied_amount: 500,
      commission_rate: 10,
      commission_amount: 50,
      closedAt: '2026-11-20T13:00:00Z',
      comandaShortId: '#C2',
      clientName: 'Pedro',
      paymentMethodLabel: 'Pix',
      isClubCredit: false,
    },
    {
      id: 'i3',
      comanda_id: 'c2',
      item_name: 'Corte',
      item_type: 'service',
      barber_id: 'barb-1',
      barber_name: 'Carlos Barbeiro',
      quantity: 1,
      unit_price: 80,
      catalog_price: 80,
      direct_discount: 0,
      allocated_order_discount: 0,
      total_discount: 0,
      applied_amount: 80,
      commission_rate: 50,
      commission_amount: 40,
      closedAt: '2026-11-20T13:00:00Z',
      comandaShortId: '#C2',
      clientName: 'Pedro',
      paymentMethodLabel: 'Pix',
      isClubCredit: false,
    },
  ];

  it('should_aggregate_product_sales_by_staff_and_evaluate_receptionist_and_barber_goals', () => {
    const staffGoals: StaffProductGoal[] = [
      {
        id: 'sg-barb',
        tenantId: 't1',
        staffId: 'barb-1',
        periodType: 'monthly',
        baseGoalAmount: 500,
        customTiers: [
          {
            id: 'bt1',
            label: '100% Meta Barbeiro',
            triggerType: 'goal_percent',
            thresholdValue: 100,
            rewardType: 'fixed_brl',
            rewardValue: 75,
            percentBase: 'total_sold',
          },
        ],
        active: true,
      },
    ];

    const rows = buildProductSalesByStaffRows({
      allocatedItems,
      staffList,
      templates,
      staffGoals,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].staffId).toBe('rec-1');
    expect(rows[0].appliedTotal).toBe(1200);
    expect(rows[0].goalEvaluation.bonusAmount).toBe(100);
    expect(rows[0].goalEvaluation.achievedTier?.label).toBe('Meta 1');

    expect(rows[1].staffId).toBe('barb-1');
    expect(rows[1].appliedTotal).toBe(500);
    expect(rows[1].standardCommission).toBe(50);
    expect(rows[1].goalEvaluation.bonusAmount).toBe(75);
  });
});
