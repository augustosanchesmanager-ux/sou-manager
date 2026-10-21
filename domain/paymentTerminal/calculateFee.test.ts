import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  calculateTerminalFee,
  findMatchingRate,
} from './calculateFee';
import type { PaymentTerminalRate } from './types';

describe('domain/paymentTerminal/calculateFee', () => {
  describe('addBusinessDays', () => {
    it('adiciona dias úteis pulando final de semana (sexta para segunda com 1 dia)', () => {
      // 2026-10-23 é uma Sexta-feira
      const friday = '2026-10-23T12:00:00Z';
      const result = addBusinessDays(friday, 1);
      // Próximo dia útil é Segunda-feira 2026-10-26
      expect(result).toBe('2026-10-26');
    });

    it('adiciona múltiplos dias úteis corretamente', () => {
      // 2026-10-21 é uma Quarta-feira
      const wednesday = '2026-10-21T10:00:00Z';
      // +3 dias úteis: Qui (22), Sex (23), Seg (26)
      const result = addBusinessDays(wednesday, 3);
      expect(result).toBe('2026-10-26');
    });

    it('retorna a data corrente se dias úteis for 0', () => {
      const date = '2026-10-21T10:00:00Z';
      expect(addBusinessDays(date, 0)).toBe('2026-10-21');
    });
  });

  describe('findMatchingRate', () => {
    const mockRates: PaymentTerminalRate[] = [
      {
        id: 'rate-1',
        tenant_id: 't-1',
        terminal_id: 'term-1',
        method: 'debit',
        installments_min: 1,
        installments_max: 1,
        rate_percentage: 1.25,
        fixed_fee: 0,
        settlement_days: 1,
      },
      {
        id: 'rate-2',
        tenant_id: 't-1',
        terminal_id: 'term-1',
        method: 'credit_sight',
        installments_min: 1,
        installments_max: 1,
        rate_percentage: 2.89,
        fixed_fee: 0,
        settlement_days: 30,
      },
      {
        id: 'rate-3',
        tenant_id: 't-1',
        terminal_id: 'term-1',
        method: 'credit_installment',
        installments_min: 2,
        installments_max: 6,
        rate_percentage: 4.5,
        fixed_fee: 0.5,
        settlement_days: 30,
      },
      {
        id: 'rate-4',
        tenant_id: 't-1',
        terminal_id: 'term-1',
        method: 'credit_installment',
        installments_min: 7,
        installments_max: 12,
        rate_percentage: 6.9,
        fixed_fee: 0.5,
        settlement_days: 30,
      },
    ];

    it('encontra taxa de débito', () => {
      const match = findMatchingRate(mockRates, 'debit');
      expect(match?.id).toBe('rate-1');
      expect(match?.rate_percentage).toBe(1.25);
    });

    it('encontra taxa de crédito parcelado na faixa 2 a 6', () => {
      const match = findMatchingRate(mockRates, 'credit_installment', 3);
      expect(match?.id).toBe('rate-3');
      expect(match?.rate_percentage).toBe(4.5);
    });

    it('encontra taxa de crédito parcelado na faixa 7 a 12', () => {
      const match = findMatchingRate(mockRates, 'credit_installment', 10);
      expect(match?.id).toBe('rate-4');
      expect(match?.rate_percentage).toBe(6.9);
    });

    it('retorna null se não houver taxa para o método', () => {
      const match = findMatchingRate(mockRates, 'pix');
      expect(match).toBeNull();
    });
  });

  describe('calculateTerminalFee', () => {
    it('calcula taxa de débito em R$ 100,00 com 1,25%', () => {
      const result = calculateTerminalFee({
        amount: 100,
        rate: {
          id: 'r1',
          tenant_id: 't1',
          terminal_id: 'term1',
          method: 'debit',
          installments_min: 1,
          installments_max: 1,
          rate_percentage: 1.25,
          fixed_fee: 0,
          settlement_days: 1,
        },
        paymentDate: '2026-10-21T10:00:00Z',
      });

      expect(result.feePercentage).toBe(1.25);
      expect(result.feeAmount).toBe(1.25);
      expect(result.netAmount).toBe(98.75);
      expect(result.settlementDays).toBe(1);
      // Quarta 21 -> Quinta 22
      expect(result.estimatedSettlementDate).toBe('2026-10-22');
    });

    it('calcula taxa com percentual e taxa fixa', () => {
      const result = calculateTerminalFee({
        amount: 200,
        rate: {
          id: 'r2',
          tenant_id: 't1',
          terminal_id: 'term1',
          method: 'credit_installment',
          installments_min: 2,
          installments_max: 6,
          rate_percentage: 4.5,
          fixed_fee: 0.5,
          settlement_days: 2,
        },
        paymentDate: '2026-10-21T10:00:00Z',
      });

      // 200 * 4.5% = 9.00 + 0.50 = 9.50
      expect(result.feeAmount).toBe(9.5);
      expect(result.netAmount).toBe(190.5);
      expect(result.fixedFee).toBe(0.5);
      // Quarta 21 -> Sexta 23
      expect(result.estimatedSettlementDate).toBe('2026-10-23');
    });

    it('retorna fallback limpo com taxa zero quando sem taxa configurada', () => {
      const result = calculateTerminalFee({
        amount: 150,
        rate: null,
      });

      expect(result.feePercentage).toBe(0);
      expect(result.feeAmount).toBe(0);
      expect(result.netAmount).toBe(150);
      expect(result.estimatedSettlementDate).toBeNull();
    });

    it('protege contra valores não finitos ou negativos', () => {
      const result = calculateTerminalFee({
        amount: -50,
        rate: {
          id: 'r1',
          tenant_id: 't1',
          terminal_id: 'term1',
          method: 'debit',
          installments_min: 1,
          installments_max: 1,
          rate_percentage: 2,
          fixed_fee: 0,
          settlement_days: 1,
        },
      });

      expect(result.netAmount).toBe(0);
      expect(result.feeAmount).toBe(0);
    });

    it('evita que taxa exceda o valor bruto total', () => {
      const result = calculateTerminalFee({
        amount: 5,
        rate: {
          id: 'r3',
          tenant_id: 't1',
          terminal_id: 'term1',
          method: 'credit_sight',
          installments_min: 1,
          installments_max: 1,
          rate_percentage: 50,
          fixed_fee: 10, // taxa fixa maior que o valor
          settlement_days: 1,
        },
      });

      // 5 * 50% = 2.5 + 10 = 12.5 -> limitado ao valor bruto de 5
      expect(result.feeAmount).toBe(5);
      expect(result.netAmount).toBe(0);
    });
  });
});
