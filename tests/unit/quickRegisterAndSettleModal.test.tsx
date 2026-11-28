import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickRegisterAndSettleModal } from '../../components/checkout/QuickRegisterAndSettleModal';

vi.mock('../../components/ui/Modal', () => ({
  default: ({ isOpen, children, title }: any) => {
    if (!isOpen) return null;
    return <div data-testid="modal" data-title={title}>{children}</div>;
  },
}));

describe('QuickRegisterAndSettleModal: Lançamento + Baixa Simultânea (ADR-059)', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    tenantId: 'tenant-test-1',
    userId: 'staff-heron',
    staffList: [
      { id: 'staff-heron', name: 'Heron Silva', role: 'barber' },
      { id: 'staff-carlos', name: 'Carlos Lima', role: 'barber' },
    ],
    servicesList: [
      { id: 'srv-1', name: 'Corte Degradê', price: 50, duration: 30 },
    ],
    productsList: [
      { id: 'prd-1', name: 'Pomada Matte', price: 45, stock: 10 },
    ],
    clientsList: [
      { id: 'cli-1', name: 'João Cliente', phone: '11999990000' },
    ],
  };

  it('should_render_all_sections_for_manager_including_retroactive_date_and_batch_action', () => {
    const html = renderToStaticMarkup(
      <QuickRegisterAndSettleModal
        {...baseProps}
        userRole="manager"
      />,
    );

    expect(html).toContain('Lançamento + Baixa Rápida');
    expect(html).toContain('Heron Silva');
    expect(html).toContain('Carlos Lima');
    expect(html).toContain('type="date"');
    expect(html).toContain('type="time"');
    expect(html).toContain('Avulso / Balcão');
    expect(html).toContain('+ Novo Rápido');
    expect(html).toContain('Corte Degradê');
    expect(html).toContain('PIX');
    expect(html).toContain('Finalizar e Fechar');
    expect(html).toContain('Finalizar e Lançar Próximo');
  });

  it('should_lock_staff_and_hide_retroactive_date_picker_when_user_is_barber', () => {
    const html = renderToStaticMarkup(
      <QuickRegisterAndSettleModal
        {...baseProps}
        userRole="barber"
      />,
    );

    expect(html).toContain('Heron Silva');
    expect(html).not.toContain('Carlos Lima');
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('aria-label="Desconto Manual"');
    expect(html).toContain('Hoje (');
    expect(html).toContain('Finalizar e Fechar');
  });

  it('should_render_closed_cash_warning_and_pin_input_when_cash_day_is_confirmed', () => {
    const html = renderToStaticMarkup(
      <QuickRegisterAndSettleModal
        {...baseProps}
        userRole="owner"
        initialClosedCashOverride={true}
      />,
    );

    expect(html).toContain('Caixa deste dia já confirmado');
    expect(html).toContain('PIN do Gestor');
  });

  it('should_not_render_when_isOpen_is_false', () => {
    const html = renderToStaticMarkup(
      <QuickRegisterAndSettleModal
        {...baseProps}
        isOpen={false}
        userRole="owner"
      />,
    );

    expect(html).toBe('');
  });
});
