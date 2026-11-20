import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../../services/supabaseClient', () => ({
  getScopedClient: () => ({
    from: mockFrom,
  }),
  getSharedClient: () => ({
    from: mockFrom,
  }),
}));

import { fetchProductsReport } from './reportsDataService';

describe('fetchProductsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
  });

  it('should_query_canonical_product_columns_without_legacy_min_stock_or_supplier_name', async () => {
    // Arrange
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'prod-1',
          name: 'Gel Fixador',
          category: null,
          price: '0.00',
          sale_price: '20',
          cost_price: '10',
          stock_quantity: 2,
          minimum_stock: 2,
          min_stock_alert: 0,
          active: true,
        },
        {
          id: 'prod-2',
          name: 'Pomada Matte',
          category: 'Finalizadores',
          price: '45.00',
          sale_price: null,
          cost_price: '15.00',
          stock_quantity: 8,
          minimum_stock: null,
          min_stock_alert: 3,
          active: true,
        },
      ],
      error: null,
    });

    // Act
    const result = await fetchProductsReport('tenant-123', []);

    // Assert
    expect(mockFrom).toHaveBeenCalledWith('products');
    const selectedCols = String(mockSelect.mock.calls[0]?.[0] || '');
    expect(selectedCols).toContain('minimum_stock');
    expect(selectedCols).toContain('min_stock_alert');
    expect(selectedCols).toContain('sale_price');
    expect(selectedCols).not.toMatch(/\bmin_stock\b/);
    expect(selectedCols).not.toContain('supplier_name');

    expect(result.catalogItems).toHaveLength(2);
    expect(result.catalogItems[0]).toMatchObject({
      id: 'prod-1',
      name: 'Gel Fixador',
      category: 'Geral',
      price: 20,
      costPrice: 10,
      stockQuantity: 2,
      minStock: 2,
      isCriticalStock: true,
      supplierName: '-',
    });
    expect(result.catalogItems[1]).toMatchObject({
      id: 'prod-2',
      name: 'Pomada Matte',
      category: 'Finalizadores',
      price: 45,
      costPrice: 15,
      stockQuantity: 8,
      minStock: 3,
      isCriticalStock: false,
      supplierName: '-',
    });
  });
});
