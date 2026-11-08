import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickCheckoutModal } from '../../components/checkout/QuickCheckoutModal';

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('QuickCheckoutModal: Modo Balcão Express', () => {
  const mockComanda = {
    id: 'cmd-express-12345678',
    total: 60.0,
    client_name: 'Arthur Fonseca',
    items: [
      { id: 'item-1', name: 'Corte Clássico', quantity: 1 },
    ],
  };

  it('should_render_modal_with_comanda_total_and_quick_pay_buttons', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        comanda={mockComanda}
        tenantId="tenant-test-123"
        onSuccess={vi.fn()}
        onOpenChairQrCode={vi.fn()}
      />
    );

    expect(html).toContain('Modo Balcão Express');
    expect(html).toContain('Arthur Fonseca');
    expect(html).toContain('PIX Expresso');
    expect(html).toContain('Cartão Débito');
    expect(html).toContain('Cartão Crédito');
    expect(html).toContain('Dinheiro Exato');
    expect(html).toContain('QR Code Cadeira');
  });

  it('should_not_render_when_isOpen_is_false', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={false}
        onClose={vi.fn()}
        comanda={mockComanda}
        tenantId="tenant-test-123"
        onSuccess={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
