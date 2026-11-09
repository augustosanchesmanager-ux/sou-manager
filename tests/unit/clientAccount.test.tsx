import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientAccount } from '../../pages/ClientAccount';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentTenant: { id: 'tenant-test-123', name: 'Barbearia Sanchez' },
    user: { id: 'usr-1', email: 'admin@barber.com' },
  }),
}));

vi.mock('../../domain/clientWallet/walletRepository', () => ({
  clientWalletRepository: {
    listWallets: vi.fn().mockResolvedValue([
      {
        client_id: 'c-1',
        tenant_id: 'tenant-test-123',
        client_name: 'Arthur Fonseca',
        client_phone: '11988887777',
        balance: -120.0,
        credit_limit: 200.0,
      },
      {
        client_id: 'c-2',
        tenant_id: 'tenant-test-123',
        client_name: 'Marcos Vinicius',
        client_phone: '11977776666',
        balance: 50.0,
        credit_limit: 0,
      },
    ]),
    getWallet: vi.fn(),
    updateCreditLimit: vi.fn(),
    recordTransaction: vi.fn(),
    getTransactions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('ClientAccount: Página de Conta do Cliente (Fiado e Carteira)', () => {
  it('should_render_page_title_and_kpis', () => {
    const html = renderToStaticMarkup(<ClientAccount />);

    expect(html).toContain('Conta do Cliente (Fiado &amp; Carteira)');
    expect(html).toContain('Total em Débito (Fiado a Receber)');
    expect(html).toContain('Total com Crédito (Pré-Pago)');
    expect(html).toContain('Saldo Líquido da Barbearia');
    expect(html).toContain('Buscar por nome ou telefone...');
  });

  it('should_render_open_comandas_tab_selector', () => {
    const html = renderToStaticMarkup(<ClientAccount />);

    expect(html).toContain('Comandas em Aberto');
    expect(html).toContain('Carteira &amp; Fiados');
  });
});
