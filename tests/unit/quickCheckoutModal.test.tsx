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

  it('should_render_club_credit_button_when_client_is_eligible_and_fully_covered', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        comanda={{
          ...mockComanda,
          client_id: 'cli-vip-001',
        }}
        tenantId="tenant-test-123"
        onSuccess={vi.fn()}
        initialCreditEligibility={{
          isClubMember: true,
          subscriptionId: 'sub-vip-123',
          planName: 'Plano Barba & Cabelo VIP',
          totalAvailableCredits: 4,
          totalUsedCredits: 1,
          isFullyCoveredByCredits: true,
          hasServicesToCover: true,
          serviceBalances: [],
        }}
      />
    );

    expect(html).toContain('Membro VIP • Club dos Chefes');
    expect(html).toContain('Plano Barba &amp; Cabelo VIP');
    expect(html).toContain('4 créditos');
    expect(html).toContain('Baixar com Crédito do Clube (R$ 0,00)');
    expect(html).toContain('loyalty');
  });

  it('should_render_club_warning_message_when_client_is_member_but_not_covered', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        comanda={{
          ...mockComanda,
          client_id: 'cli-vip-002',
        }}
        tenantId="tenant-test-123"
        onSuccess={vi.fn()}
        initialCreditEligibility={{
          isClubMember: true,
          subscriptionId: 'sub-vip-124',
          planName: 'Plano Básico',
          totalAvailableCredits: 0,
          totalUsedCredits: 2,
          isFullyCoveredByCredits: false,
          hasServicesToCover: true,
          serviceBalances: [],
          reason: 'Assinante sem créditos disponíveis no momento.',
        }}
      />
    );

    expect(html).toContain('Membro VIP • Club dos Chefes');
    expect(html).toContain('Plano Básico');
    expect(html).toContain('0 créditos');
    expect(html).toContain('Assinante sem créditos disponíveis no momento.');
    expect(html).not.toContain('Baixar com Crédito do Clube (R$ 0,00)');
  });
});

describe('QuickCheckoutModal - post-sale thank-you view', () => {
  it('should_render_post_sale_success_actions_when_checkout_is_completed_with_phone', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        tenantId="tenant-1"
        onSuccess={vi.fn()}
        comanda={{
          id: '12345678-abcd-efgh',
          total: 90,
          client_name: 'Carlos Silva',
          client_phone: '11999998888',
        }}
        initialSuccessState={{
          comandaId: '12345678-abcd-efgh',
          paymentMethod: 'PIX',
          total: 90,
          clientName: 'Carlos Silva',
          clientPhone: '11999998888',
        }}
      />,
    );

    expect(html).toContain('Sucesso no Atendimento');
    expect(html).toContain('Comanda #12345678 encerrada');
    expect(html).toContain('Enviar Agradecimento (WhatsApp)');
    expect(html).toContain('Fechar');
    expect(html).not.toContain('Cliente sem telefone cadastrado para envio via WhatsApp.');
  });

  it('should_disable_post_sale_whatsapp_button_when_client_phone_is_missing', () => {
    const html = renderToStaticMarkup(
      <QuickCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        tenantId="tenant-1"
        onSuccess={vi.fn()}
        comanda={null}
        initialSuccessState={{
          comandaId: '87654321-abcd-efgh',
          paymentMethod: 'Cartão Crédito',
          total: 55,
          clientName: 'Cliente Sem Telefone',
          clientPhone: null,
        }}
      />,
    );

    expect(html).toContain('Cliente sem telefone cadastrado para envio via WhatsApp.');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Enviar Agradecimento (WhatsApp)');
    expect(html).toContain('Fechar');
  });
});
