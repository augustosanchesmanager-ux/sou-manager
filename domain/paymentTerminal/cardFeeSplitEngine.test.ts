import { describe, it, expect } from 'vitest';
import {
  calculateCardFeeSplit,
  resolveCardFeePolicyForStaff,
  EXEMPTION_BADGE_TEXT,
} from './cardFeeSplitEngine';

describe('CardFeeSplitEngine: Rateio Inteligente de Taxas de Maquininha nas Comissões', () => {
  describe('resolveCardFeePolicyForStaff', () => {
    it('should_use_staff_policy_when_explicitly_configured', () => {
      expect(resolveCardFeePolicyForStaff('split', 'gross')).toBe('split');
      expect(resolveCardFeePolicyForStaff('deducted', 'gross')).toBe('deducted');
      expect(resolveCardFeePolicyForStaff('gross', 'split')).toBe('gross');
    });

    it('should_fallback_to_tenant_policy_when_staff_is_default_or_missing', () => {
      expect(resolveCardFeePolicyForStaff(undefined, 'split')).toBe('split');
      expect(resolveCardFeePolicyForStaff(null, 'deducted')).toBe('deducted');
      expect(resolveCardFeePolicyForStaff('default', 'split')).toBe('split');
    });

    it('should_fallback_to_gross_as_safe_default_when_no_policy_exists', () => {
      expect(resolveCardFeePolicyForStaff(null, null)).toBe('gross');
      expect(resolveCardFeePolicyForStaff(undefined, undefined)).toBe('gross');
      expect(resolveCardFeePolicyForStaff('invalid_policy', 'invalid_tenant')).toBe('gross');
    });
  });

  describe('calculateCardFeeSplit — Cenário 1: Taxa Zerada (Dinheiro, PIX ou Taxa 0%)', () => {
    it('should_mark_as_exempt_with_zero_fee_when_fee_is_0', () => {
      const result = calculateCardFeeSplit({
        grossAmount: 100,
        commissionRate: 50,
        feePercentage: 0,
        policy: 'split',
      });

      expect(result.grossAmount).toBe(100);
      expect(result.baseCommission).toBe(50);
      expect(result.feeAmount).toBe(0);
      expect(result.barberFeeDeduction).toBe(0);
      expect(result.shopFeeAbsorption).toBe(0);
      expect(result.netCommission).toBe(50);
      expect(result.isFeeExempt).toBe(true);
      expect(result.exemptValue).toBe(0);
      expect(result.exemptionBadgeText).toBe(EXEMPTION_BADGE_TEXT);
    });
  });

  describe('calculateCardFeeSplit — Cenário 2: Política "gross" (Barbearia Absorve 100% da Taxa)', () => {
    it('should_absorb_100_percent_of_fee_and_display_exempt_value_saved', () => {
      // Serviço R$ 100, Comissão 50% (R$ 50), Taxa da máquina 4% (R$ 4)
      const result = calculateCardFeeSplit({
        grossAmount: 100,
        commissionRate: 50,
        feePercentage: 4,
        policy: 'gross',
      });

      expect(result.grossAmount).toBe(100);
      expect(result.baseCommission).toBe(50);
      expect(result.feeAmount).toBe(4);
      expect(result.barberFeeDeduction).toBe(0); // Barbeiro não paga nada
      expect(result.shopFeeAbsorption).toBe(4); // Barbearia absorve tudo
      expect(result.netCommission).toBe(50); // Recebe R$ 50 integral
      expect(result.isFeeExempt).toBe(true);
      expect(result.exemptValue).toBe(2); // Economizou R$ 2,00 (50% de R$ 4,00)
      expect(result.exemptionBadgeText).toBe(EXEMPTION_BADGE_TEXT);
    });
  });

  describe('calculateCardFeeSplit — Cenário 3: Política "split" (Rateio Proporcional à Comissão)', () => {
    it('should_split_fee_proportionally_between_barber_and_shop', () => {
      // Serviço R$ 100, Comissão 50% (R$ 50), Taxa da máquina 4% (R$ 4)
      const result = calculateCardFeeSplit({
        grossAmount: 100,
        commissionRate: 50,
        feePercentage: 4,
        policy: 'split',
      });

      expect(result.grossAmount).toBe(100);
      expect(result.baseCommission).toBe(50);
      expect(result.feeAmount).toBe(4);
      expect(result.barberFeeDeduction).toBe(2); // 50% da taxa de R$ 4,00
      expect(result.shopFeeAbsorption).toBe(2); // 50% da taxa de R$ 4,00
      expect(result.netCommission).toBe(48); // R$ 50 - R$ 2 = R$ 48
      expect(result.isFeeExempt).toBe(false);
      expect(result.exemptValue).toBe(0);
      expect(result.exemptionBadgeText).toBeNull();
    });

    it('should_split_correctly_with_different_commission_rates', () => {
      // Serviço R$ 200, Comissão 40% (R$ 80), Taxa crédito parcelado 6% (R$ 12)
      const result = calculateCardFeeSplit({
        grossAmount: 200,
        commissionRate: 40,
        feePercentage: 6,
        policy: 'split',
      });

      expect(result.baseCommission).toBe(80);
      expect(result.feeAmount).toBe(12);
      expect(result.barberFeeDeduction).toBe(4.8); // 40% de R$ 12,00
      expect(result.shopFeeAbsorption).toBe(7.2); // 60% de R$ 12,00
      expect(result.netCommission).toBe(75.2); // R$ 80 - R$ 4,80
      expect(result.isFeeExempt).toBe(false);
    });
  });

  describe('calculateCardFeeSplit — Cenário 4: Política "deducted" (Taxa Deduzida do Barbeiro)', () => {
    it('should_deduct_full_fee_from_barber_commission', () => {
      // Serviço R$ 100, Comissão 50% (R$ 50), Taxa da máquina 3% (R$ 3)
      const result = calculateCardFeeSplit({
        grossAmount: 100,
        commissionRate: 50,
        feePercentage: 3,
        policy: 'deducted',
      });

      expect(result.grossAmount).toBe(100);
      expect(result.baseCommission).toBe(50);
      expect(result.feeAmount).toBe(3);
      expect(result.barberFeeDeduction).toBe(3); // Barbeiro arca com a taxa total
      expect(result.shopFeeAbsorption).toBe(0);
      expect(result.netCommission).toBe(47); // R$ 50 - R$ 3 = R$ 47
      expect(result.isFeeExempt).toBe(false);
      expect(result.exemptionBadgeText).toBeNull();
    });

    it('should_not_allow_negative_commission_if_fee_exceeds_commission', () => {
      // Se a comissão for R$ 5,00 e a taxa for R$ 8,00, a dedução não pode deixar comissão negativa
      const result = calculateCardFeeSplit({
        grossAmount: 10,
        commissionRate: 50, // Base: R$ 5
        feePercentage: 80, // Taxa: R$ 8
        policy: 'deducted',
      });

      expect(result.baseCommission).toBe(5);
      expect(result.feeAmount).toBe(8);
      expect(result.barberFeeDeduction).toBe(5);
      expect(result.shopFeeAbsorption).toBe(3);
      expect(result.netCommission).toBe(0);
    });
  });

  describe('calculateCardFeeSplit — Cenário 5: Taxa Fixa Adicional da Operadora', () => {
    it('should_include_fixed_fee_in_total_fee_calculation', () => {
      // Serviço R$ 50, Comissão 50%, Taxa percentual 2% (R$ 1) + Taxa fixa R$ 0,50 = R$ 1,50
      const result = calculateCardFeeSplit({
        grossAmount: 50,
        commissionRate: 50,
        feePercentage: 2,
        fixedFee: 0.5,
        policy: 'split',
      });

      expect(result.feeAmount).toBe(1.5);
      expect(result.barberFeeDeduction).toBe(0.75); // 50% de 1.50
      expect(result.shopFeeAbsorption).toBe(0.75);
      expect(result.netCommission).toBe(24.25); // 25 - 0.75
    });
  });
});
