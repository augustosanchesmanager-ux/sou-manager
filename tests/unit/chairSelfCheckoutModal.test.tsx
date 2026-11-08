import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChairSelfCheckoutModal } from '../../components/checkout/ChairSelfCheckoutModal';

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('ChairSelfCheckoutModal: Self-Checkout na Cadeira via QR Code PIX', () => {
  const mockComanda = {
    id: 'cmd-chair-87654321',
    total: 85.0,
    client_name: 'Lucas Ferreira',
    staff_name: 'Heron Barbeiro',
  };

  it('should_render_chair_modal_with_qr_code_and_pix_copy_button', () => {
    const html = renderToStaticMarkup(
      <ChairSelfCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        comanda={mockComanda}
        tenantId="tenant-test-123"
        tenantName="Sr. Avante Barber"
        pixKey="11988887777"
        onSuccess={vi.fn()}
      />
    );

    expect(html).toContain('Self-Checkout na Cadeira');
    expect(html).toContain('Lucas Ferreira');
    expect(html).toContain('Copiar Código Copia e Cola');
    expect(html).toContain('Aguardando transferência');
    expect(html).toContain('Confirmar no Caixa');
  });

  it('should_not_render_when_isOpen_is_false', () => {
    const html = renderToStaticMarkup(
      <ChairSelfCheckoutModal
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
