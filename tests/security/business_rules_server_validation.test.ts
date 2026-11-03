import { describe, it, expect } from 'vitest';
import { checkoutApplicationService, type FinishRequest } from '../../application/checkout';

describe('SEC-02 & SEC-09: Server-side Pricing, Totals and Discount Validation', () => {
  const service = checkoutApplicationService;

  const makeValidRequest = (): FinishRequest => ({
    tenantId: 'tenant-123',
    appSlug: 'barber',
    schema: 'public',
    userId: 'user-1',
    client: { id: 'client-1', name: 'Cliente Teste' },
    cart: [
      { id: 'item-1', name: 'Corte Adulto', type: 'service', price: 50, quantity: 1 },
      { id: 'item-2', name: 'Pomada Efeito Seco', type: 'product', price: 30, quantity: 2 },
    ],
    total: 110, // 50 + (30*2) = 110
    discountValue: 0,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    closureMode: 'standard',
    closureNote: '',
    shouldApplyFinancialEffects: true,
    shouldDeductMembershipCredits: false,
    isLegacyClubSettlement: false,
    canCloseWithAdministrativeOrigin: false,
    shouldSettleZeroWithAudit: false,
    zeroCloseReason: '',
    creditItems: [],
    shouldCollectDiscountAudit: false,
    internalSettlementTitle: 'Baixa de Comanda',
  });

  it('should_pass_validation_when_total_matches_exact_item_sum', () => {
    const req = makeValidRequest();
    const errors = service.validateFinishRequest(req);
    expect(errors).toHaveLength(0);
  });

  it('should_reject_when_client_tampers_total_to_pay_less', () => {
    const req = makeValidRequest();
    req.total = 0.01; // Tentativa de pagar R$ 0.01 por compra de R$ 110

    const errors = service.validateFinishRequest(req);
    expect(errors).toContain('Total inconsistente: esperado R$ 110.00, recebido R$ 0.01.');
  });

  it('should_reject_negative_item_prices', () => {
    const req = makeValidRequest();
    req.cart[0].price = -50; // Tentativa de inverter débito

    const errors = service.validateFinishRequest(req);
    expect(errors.some((e) => e.includes('Preço inválido para o item'))).toBe(true);
  });

  it('should_reject_negative_or_zero_quantities', () => {
    const req = makeValidRequest();
    req.cart[0].quantity = 0;

    const errors = service.validateFinishRequest(req);
    expect(errors.some((e) => e.includes('Quantidade inválida para o item'))).toBe(true);
  });

  it('should_reject_negative_discounts', () => {
    const req = makeValidRequest();
    req.discountValue = -20;

    const errors = service.validateFinishRequest(req);
    expect(errors).toContain('O valor de desconto não pode ser negativo.');
  });

  it('should_reject_negative_voucher_discounts', () => {
    const req = makeValidRequest();
    req.voucherDiscount = -15;

    const errors = service.validateFinishRequest(req);
    expect(errors).toContain('O desconto de voucher não pode ser negativo.');
  });

  it('should_correctly_validate_with_legitimate_discount_and_voucher', () => {
    const req = makeValidRequest();
    req.discountValue = 10;
    req.voucherDiscount = 20;
    req.total = 80; // 110 - 10 - 20 = 80

    const errors = service.validateFinishRequest(req);
    expect(errors).toHaveLength(0);
  });
});
