import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Products } from '../../pages/Products';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    tenantId: 'tenant-stock-123',
    user: { id: 'usr-stock-1', email: 'gerente@barber.com' },
  }),
}));

vi.mock('../../src/context/TenantContext', () => ({
  useTenantOptional: () => ({
    tenant: { id: 'tenant-stock-123', name: 'Barbearia Sanchez' },
  }),
}));

vi.mock('../../domain/stock/stockRepository', () => ({
  stockRepository: {
    listProducts: vi.fn().mockResolvedValue([
      {
        id: 'prod-1',
        tenant_id: 'tenant-stock-123',
        name: 'Pomada Matte Modeladora',
        category: 'Finalizadores',
        brand: 'Barber Premium',
        cost_price: 18.0,
        sale_price: 45.0,
        commission_rate: 10,
        stock_quantity: 15,
        minimum_stock: 5,
        purpose: 'sale',
        active: true,
      },
      {
        id: 'prod-2',
        tenant_id: 'tenant-stock-123',
        name: 'Lâmina Descartável Platinum',
        category: 'Insumos',
        brand: 'Wilkinson',
        cost_price: 30.0,
        sale_price: 0,
        commission_rate: 0,
        stock_quantity: 2,
        minimum_stock: 5,
        purpose: 'internal_use',
        active: true,
      },
    ]),
    saveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    recordPurchaseEntry: vi.fn(),
    recordInternalConsumption: vi.fn(),
    applyInventoryAdjustment: vi.fn(),
    listStockMovements: vi.fn().mockResolvedValue([]),
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

describe('Products: Estoque 360, Consumo Interno de Bancada e Conferência com PIN', () => {
  it('should_render_page_header_and_top_actions', () => {
    const html = renderToStaticMarkup(<Products />);

    expect(html).toContain('Controle de Estoque');
    expect(html).toContain('Visão 360');
    expect(html).toContain('+ Produto');
    expect(html).toContain('Fornecedores');
    expect(html).toContain('Adicionar compra ao estoque');
  });

  it('should_render_4_tabs_and_metric_cards', () => {
    const html = renderToStaticMarkup(<Products />);

    expect(html).toContain('Disponível pra venda');
    expect(html).toContain('Apenas para uso');
    expect(html).toContain('Combos');
    expect(html).toContain('Conferência');

    expect(html).toContain('Total de Produtos');
    expect(html).toContain('Valor do Estoque (Custo)');
    expect(html).toContain('Insumos de Bancada');
    expect(html).toContain('Alerta de Reposição');
  });
});
