import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarberCommissionStatementModal } from '../../components/commissions/BarberCommissionStatementModal';
import { PaymentTerminalsSection } from '../../components/settings/PaymentTerminalsSection';
import {
  calculateCardFeeStatementMetrics,
  type BarberStatementItem,
} from '../../src/utils/barberStatement';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    tenantId: 'tenant-fee-123',
    user: { id: 'usr-manager', email: 'gerente@barber.com' },
  }),
}));

vi.mock('../../src/hooks/usePaymentTerminals', () => ({
  usePaymentTerminals: () => ({
    terminals: [
      {
        id: 'term-1',
        name: 'Stone Principal Balcão',
        acquirer: 'Stone',
        is_default: true,
        is_active: true,
        rates: [
          { method: 'debit', rate_percentage: 1.25, settlement_days: 1 },
          { method: 'credit_sight', rate_percentage: 2.89, settlement_days: 30 },
        ],
      },
    ],
    loading: false,
    error: null,
    createTerminal: vi.fn(),
    setDefaultTerminal: vi.fn(),
    deleteTerminal: vi.fn(),
  }),
}));

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('Frente B: Rateio Inteligente de Taxas de Maquininha nas Comissões', () => {
  describe('calculateCardFeeStatementMetrics', () => {
    it('should_correctly_accumulate_exempt_and_split_card_fee_totals', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'it-1',
          clientName: 'Roberto',
          itemName: 'Corte',
          itemType: 'service',
          grossValue: 100,
          commissionRate: 50,
          commissionValue: 50,
          comandaStatus: 'paid',
          isPaid: true,
          createdAt: '2026-11-08T10:00:00Z',
          cardFeePercentage: 4,
          cardFeeAmount: 4,
          cardFeePolicy: 'gross',
          isFeeExempt: true,
          exemptValue: 2, // Casa absorveu R$ 2,00 do barbeiro
          barberFeeDeduction: 0,
        },
        {
          id: 'it-2',
          clientName: 'Lucas',
          itemName: 'Barba',
          itemType: 'service',
          grossValue: 50,
          commissionRate: 50,
          commissionValue: 25,
          comandaStatus: 'paid',
          isPaid: true,
          createdAt: '2026-11-08T11:00:00Z',
          cardFeePercentage: 4,
          cardFeeAmount: 2,
          cardFeePolicy: 'split',
          isFeeExempt: false,
          exemptValue: 0,
          barberFeeDeduction: 1, // Barbeiro arcou com R$ 1,00
        },
      ];

      const metrics = calculateCardFeeStatementMetrics(items);

      expect(metrics.totalExemptFeeValue).toBe(2);
      expect(metrics.totalBarberFeeDeductions).toBe(1);
      expect(metrics.totalCardFees).toBe(6);
      expect(metrics.exemptItemsCount).toBe(1);
      expect(metrics.splitItemsCount).toBe(1);
    });
  });

  describe('BarberCommissionStatementModal & PaymentTerminalsSection UI', () => {
    it('should_render_statement_modal_shell_with_headers_and_period_pills', () => {
      const html = renderToStaticMarkup(
        <BarberCommissionStatementModal
          isOpen={true}
          onClose={vi.fn()}
          tenantId="tenant-fee-123"
          userRole="manager"
          initialStaffId="staff-barber-1"
        />
      );

      expect(html).toContain('Extrato de Comissões &amp; Produtividade');
      expect(html).toContain('Hoje');
      expect(html).toContain('Esta Semana');
      expect(html).toContain('Este Mês');
    });

    it('should_render_global_card_fee_policy_selector_in_payment_terminals_settings', () => {
      const html = renderToStaticMarkup(<PaymentTerminalsSection />);

      expect(html).toContain('Política Padrão de Rateio de Taxas nas Comissões');
      expect(html).toContain('Bruto (100% Casa)');
      expect(html).toContain('Dividido (Rateio Proporcional)');
      expect(html).toContain('Descontado (Profissional)');
    });
  });
});
