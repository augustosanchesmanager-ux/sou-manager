import { describe, expect, it } from 'vitest';
import {
  evaluateProductGoalTiers,
  resolveEffectiveProductGoal,
} from './evaluateProductGoalTiers';
import type { ProductGoalTemplate, ProductGoalTier, StaffProductGoal } from './types';

describe('evaluateProductGoalTiers', () => {
  const receptionistTiers: ProductGoalTier[] = [
    {
      id: 't1',
      label: 'Meta 1 - Bronze',
      triggerType: 'amount_brl',
      thresholdValue: 1000,
      rewardType: 'fixed_brl',
      rewardValue: 80,
      percentBase: 'total_sold',
    },
    {
      id: 't2',
      label: 'Meta 2 - Prata',
      triggerType: 'amount_brl',
      thresholdValue: 2000,
      rewardType: 'percent',
      rewardValue: 5,
      percentBase: 'total_sold',
    },
    {
      id: 't3',
      label: 'Meta 3 - Ouro',
      triggerType: 'amount_brl',
      thresholdValue: 3000,
      rewardType: 'percent',
      rewardValue: 10,
      percentBase: 'tier_target',
    },
  ];

  it('should_return_zero_bonus_when_sold_below_first_tier', () => {
    const result = evaluateProductGoalTiers({
      soldAmount: 750,
      baseGoalAmount: 1000,
      tiers: receptionistTiers,
    });

    expect(result.hasGoal).toBe(true);
    expect(result.achievedTier).toBeNull();
    expect(result.nextTier?.id).toBe('t1');
    expect(result.missingToNextTier).toBe(250);
    expect(result.progressPct).toBe(75);
    expect(result.bonusAmount).toBe(0);
  });

  it('should_apply_highest_achieved_tier_fixed_brl', () => {
    const result = evaluateProductGoalTiers({
      soldAmount: 1500,
      baseGoalAmount: 1000,
      tiers: receptionistTiers,
    });

    expect(result.achievedTier?.id).toBe('t1');
    expect(result.nextTier?.id).toBe('t2');
    expect(result.missingToNextTier).toBe(500);
    expect(result.bonusAmount).toBe(80);
  });

  it('should_calculate_percent_reward_over_total_sold', () => {
    const result = evaluateProductGoalTiers({
      soldAmount: 2400,
      baseGoalAmount: 1000,
      tiers: receptionistTiers,
    });

    expect(result.achievedTier?.id).toBe('t2');
    expect(result.bonusAmount).toBe(120); // 5% of 2400
  });

  it('should_calculate_percent_reward_over_tier_target', () => {
    const result = evaluateProductGoalTiers({
      soldAmount: 3500,
      baseGoalAmount: 1000,
      tiers: receptionistTiers,
    });

    expect(result.achievedTier?.id).toBe('t3');
    expect(result.nextTier).toBeNull();
    expect(result.missingToNextTier).toBe(0);
    expect(result.bonusAmount).toBe(300); // 10% of 3000
  });

  it('should_evaluate_goal_percent_trigger_for_barber_additional_bonus', () => {
    const barberTiers: ProductGoalTier[] = [
      {
        id: 'b1',
        label: '100% da Meta',
        triggerType: 'goal_percent',
        thresholdValue: 100,
        rewardType: 'fixed_brl',
        rewardValue: 150,
        percentBase: 'total_sold',
      },
      {
        id: 'b2',
        label: '150% da Meta',
        triggerType: 'goal_percent',
        thresholdValue: 150,
        rewardType: 'fixed_brl',
        rewardValue: 300,
        percentBase: 'total_sold',
      },
    ];

    const result = evaluateProductGoalTiers({
      soldAmount: 1600,
      baseGoalAmount: 1000,
      tiers: barberTiers,
    });

    expect(result.achievedTier?.id).toBe('b2');
    expect(result.achievedTier?.effectiveThresholdBrl).toBe(1500);
    expect(result.bonusAmount).toBe(300);
  });
});

describe('resolveEffectiveProductGoal', () => {
  const templates: ProductGoalTemplate[] = [
    {
      id: 'tpl-rec',
      tenantId: 't1',
      name: 'Meta Padrão Recepção',
      targetRole: 'receptionist',
      periodType: 'monthly',
      baseGoalAmount: 1500,
      tiers: [
        {
          id: 'r1',
          label: 'Meta 1',
          triggerType: 'amount_brl',
          thresholdValue: 1500,
          rewardType: 'fixed_brl',
          rewardValue: 100,
          percentBase: 'total_sold',
        },
      ],
      active: true,
    },
  ];

  it('should_fallback_to_role_template_when_no_individual_goal', () => {
    const resolved = resolveEffectiveProductGoal({
      staffId: 's1',
      staffRole: 'receptionist',
      staffGoals: [],
      templates,
    });

    expect(resolved?.source).toBe('role_template');
    expect(resolved?.templateName).toBe('Meta Padrão Recepção');
  });

  it('should_prefer_individual_custom_tiers_over_role_template', () => {
    const staffGoals: StaffProductGoal[] = [
      {
        id: 'sg-1',
        tenantId: 't1',
        staffId: 's1',
        periodType: 'weekly',
        baseGoalAmount: 500,
        customTiers: [
          {
            id: 'c1',
            label: 'Semanal',
            triggerType: 'amount_brl',
            thresholdValue: 500,
            rewardType: 'fixed_brl',
            rewardValue: 50,
            percentBase: 'total_sold',
          },
        ],
        active: true,
      },
    ];

    const resolved = resolveEffectiveProductGoal({
      staffId: 's1',
      staffRole: 'receptionist',
      staffGoals,
      templates,
    });

    expect(resolved?.source).toBe('individual');
    expect(resolved?.periodType).toBe('weekly');
    expect(resolved?.tiers[0].id).toBe('c1');
  });
});
