import type {
  FinishRequest,
  CheckoutCartItem,
  CheckoutParticipant,
} from '../../application/checkout';

let _itemIdSeq = 0;

export const resetCheckoutSeq = () => { _itemIdSeq = 0; };

export const makeCartItem = (
  overrides: Partial<CheckoutCartItem> = {},
): CheckoutCartItem => ({
  id: `item-${++_itemIdSeq}`,
  type: 'service',
  name: 'Corte',
  price: 50,
  quantity: 1,
  staff_id: 'staff-1',
  ...overrides,
});

export const makeParticipant = (
  overrides: Partial<CheckoutParticipant> = {},
): CheckoutParticipant => ({
  id: `participant-${++_itemIdSeq}`,
  professional_id: 'prof-1',
  professional_name: 'Barbeiro 1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_revenue: true,
  affects_commission: true,
  ...overrides,
});

export const makeFinishRequest = (
  overrides: Partial<FinishRequest> = {},
): FinishRequest => ({
  tenantId: 'tenant-1',
  appSlug: 'barber',
  schema: 'barber',
  userId: 'user-1',
  cart: [makeCartItem()],
  client: { id: 'client-1', name: 'João' },
  total: 50,
  discountValue: 0,
  paymentStatus: 'paid',
  paymentMethod: 'Dinheiro',
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
  internalSettlementTitle: 'Finalizar Comanda',
  ...overrides,
});

export const makePaidRequest = (total = 50) =>
  makeFinishRequest({ paymentStatus: 'paid', total });

export const makePendingRequest = (total = 50) =>
  makeFinishRequest({ paymentStatus: 'pending', total, shouldApplyFinancialEffects: false });

export const makeLegacyRequest = (overrides: Partial<FinishRequest> = {}) =>
  makeFinishRequest({
    isLegacyClubSettlement: true,
    canCloseWithAdministrativeOrigin: true,
    legacyReferenceMonth: '2026-07',
    closureNote: 'Baixa administrativa',
    paymentStatus: 'paid',
    total: 0,
    ...overrides,
  });

export const makeZeroCloseRequest = (
  origin: 'club_credit' | 'house_courtesy' | 'administrative_adjustment' = 'house_courtesy',
  overrides: Partial<FinishRequest> = {},
) =>
  makeFinishRequest({
    paymentStatus: 'paid',
    total: 0,
    shouldSettleZeroWithAudit: true,
    zeroCloseOrigin: origin,
    zeroCloseReason: 'Motivo',
    shouldApplyFinancialEffects: false,
    ...overrides,
  });

export const makeCreditRequest = (
  overrides: Partial<FinishRequest> = {},
) =>
  makeZeroCloseRequest('club_credit', {
    shouldDeductMembershipCredits: true,
    creditItems: [makeCartItem({ service_id: 'svc-1', name: 'Corte VIP' })],
    chefClubInfo: { id: 'sub-1' },
    ...overrides,
  });
