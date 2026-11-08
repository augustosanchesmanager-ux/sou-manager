import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CashLedger } from '../../pages/CashLedger';

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    tenantId: 'tenant-test-123',
    user: { id: 'usr-1', email: 'admin@barber.com' },
  }),
}));

vi.mock('../../src/context/TenantContext', () => ({
  useTenantOptional: () => ({
    tenant: { id: 'tenant-test-123', name: 'Barbearia Sanchez' },
  }),
}));

vi.mock('../../domain/cashLedger/cashLedgerRepository', () => ({
  cashLedgerRepository: {
    listLedgerEntries: vi.fn().mockResolvedValue([
      {
        id: 'tx-1',
        tenant_id: 'tenant-test-123',
        type: 'income',
        category: 'Serviços',
        description: 'Corte Degradê Navalhado',
        amount: 60.0,
        due_date: '2026-11-08',
        payment_date: '2026-11-08',
        status: 'paid',
        recipient_or_payer: 'Felipe Ramos',
      },
      {
        id: 'tx-2',
        tenant_id: 'tenant-test-123',
        type: 'expense',
        category: 'Aluguel',
        description: 'Aluguel Barbearia',
        amount: 1800.0,
        due_date: '2026-11-10',
        payment_date: null,
        status: 'pending',
        recipient_or_payer: 'Imobiliária Santa Cruz',
      },
    ]),
    listFiadosForReceivables: vi.fn().mockResolvedValue([]),
    createLedgerEntry: vi.fn(),
    batchSettleEntries: vi.fn(),
    registerVale: vi.fn(),
  },
}));

vi.mock('../../domain/staff/repository', () => ({
  staffRepository: {
    list: vi.fn().mockResolvedValue([
      { id: 'st-1', name: 'Carlos Barbeiro', role: 'barber' },
    ]),
  },
}));

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('CashLedger: Central Financeira Unificada (Entrada / Saída, Pagar, Receber, Vales)', () => {
  it('should_render_page_header_and_tabs', () => {
    const html = renderToStaticMarkup(<CashLedger />);

    expect(html).toContain('Entrada / Saída');
    expect(html).toContain('Contas a Pagar');
    expect(html).toContain('Contas a Receber');
    expect(html).toContain('+ Movimentação');
    expect(html).toContain('Baixar Selecionados');
    expect(html).toContain('Vale (Adiantamento)');
  });

  it('should_render_period_filters_and_bottom_summary', () => {
    const html = renderToStaticMarkup(<CashLedger />);

    expect(html).toContain('Hoje');
    expect(html).toContain('Esta Semana');
    expect(html).toContain('Este Mês');
    expect(html).toContain('Resultado Líquido Operacional');
  });
});
