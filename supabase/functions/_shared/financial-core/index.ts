// shared/numbers/normalize.ts
var normalizePercentage = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};
var normalizeRate = normalizePercentage;
var normalizeParticipantPercentage = normalizePercentage;
var normalizePercentageValue = normalizePercentage;

// domain/commission/calculate.ts
var resolveCommissionBase = (item) => {
  const unitPrice = Number(item.unit_price ?? 0);
  const price = Number(item.price ?? 0);
  const amount = Number(item.amount ?? 0);
  const quantity = Number(item.quantity ?? 1);
  if (unitPrice > 0) {
    return { value: unitPrice, field: "unit_price", reason: "unit_price presente" };
  }
  if (price > 0) {
    return { value: price, field: "price", reason: "fallback para price" };
  }
  if (amount > 0 && quantity > 0) {
    return { value: amount / quantity, field: "amount/quantity", reason: "fallback para amount/quantity" };
  }
  if (amount > 0) {
    return { value: amount, field: "amount", reason: "fallback para amount" };
  }
  return { value: 0, field: "none", reason: "nenhum valor encontrado" };
};
var detectZeroReason = (unitPrice, grossValue, paidAmount, discount, membershipCreditEffect) => {
  if (paidAmount > 0) return null;
  if (unitPrice === 0 && membershipCreditEffect) {
    return "clube_do_chefe";
  }
  if (discount > 0 && discount >= grossValue && grossValue > 0) {
    return "desconto_integral";
  }
  if (unitPrice === 0 && !membershipCreditEffect) {
    return "cortesia";
  }
  if (grossValue > 0 && paidAmount === 0) {
    return "comanda_nao_paga";
  }
  return "outro";
};
var calculateCommissionReversal = (originalCommission, reversedAmount, originalReceivedValue) => {
  if (originalReceivedValue <= 0) return 0;
  if (reversedAmount <= 0) return 0;
  const proportion = Math.min(1, reversedAmount / originalReceivedValue);
  const reversalAmount = originalCommission * proportion;
  return Math.min(reversalAmount, originalCommission);
};
var resolveFinancialBase = (input) => {
  const { item, discount = 0, paidAmount, quantity = 1 } = input;
  const grossChoice = resolveCommissionBase(item);
  const grossValue = grossChoice.value * quantity;
  const itemDiscount = Math.min(discount, grossValue);
  const netValue = Math.max(0, grossValue - itemDiscount);
  const effectivePaid = paidAmount !== void 0 ? Math.max(0, paidAmount) : netValue;
  const receivedValue = Math.min(netValue, effectivePaid);
  const zeroReason = receivedValue <= 0 && grossValue > 0 ? detectZeroReason(grossChoice.value, grossValue, effectivePaid, itemDiscount, false) : null;
  return {
    grossValue,
    discount: itemDiscount,
    netValue,
    receivedValue,
    quantity,
    source: grossChoice.field,
    reason: grossChoice.reason,
    zeroReason
  };
};
var calculateParticipantPayout = (receivedValue, participant) => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === "percentage") {
    return receivedValue * rate;
  }
  return Math.min(participant.payout_value, receivedValue);
};
var calculateParticipantBaseValue = (receivedValue, participant) => {
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === "fixed") {
    return Math.min(participant.payout_value, receivedValue);
  }
  return receivedValue * rate;
};
var calculateTotalPayouts = (receivedValue, participants) => {
  return participants.filter((p) => p.affects_commission).reduce((sum, p) => sum + calculateParticipantPayout(receivedValue, p), 0);
};
var calculateCommissionValue = (receivedValue, participant, commissionRate) => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(commissionRate);
  if (participant.payout_type === "fixed") {
    const base = Math.min(participant.payout_value, receivedValue);
    return base * rate;
  }
  const participantBase = receivedValue * normalizePercentage(participant.payout_value);
  return participantBase * rate;
};
var isCommissionEligible = (staff) => {
  const role = (staff.role || "").toLowerCase();
  if (role === "barber" || role === "seller") return true;
  if (role === "manager") {
    const rate = Number(staff.commission_rate ?? 0);
    return rate > 0;
  }
  return false;
};
var getEffectiveRate = (staff) => {
  if (!isCommissionEligible(staff)) return 0;
  return normalizePercentage(staff.commission_rate ?? 0);
};
var getDefaultRateForRole = (role) => {
  const normalized = (role || "").toLowerCase();
  if (normalized === "barber" || normalized === "seller") return 0.5;
  return 0;
};

// domain/commission/participants.ts
var isSharedExecution = (item, participants) => {
  if (!participants || participants.length === 0) return false;
  if (participants.length > 1) return true;
  const single = participants[0];
  if (!single) return false;
  if (!single.affects_commission) return false;
  const rate = normalizePercentage(single.payout_value);
  return rate < 1;
};
var isSharedServiceItem = isSharedExecution;
var buildSoloParticipant = (comandaItemId, staffId) => ({
  id: `solo-${comandaItemId}`,
  comanda_item_id: comandaItemId,
  staff_id: staffId,
  professional_id: staffId,
  role: "primary",
  payout_type: "percentage",
  payout_value: 100,
  affects_commission: true
});
var hasPartialSavedPayout = (participant, itemValue) => {
  if (!participant.affects_commission) return false;
  const rate = normalizePercentage(participant.payout_value);
  return rate > 0 && rate < 1;
};
var buildInferredPrimaryParticipant = (comandaItemId, savedParticipants, staffById) => {
  const totalPayout = savedParticipants.filter((p) => p.affects_commission).reduce((sum, p) => {
    const rate = normalizePercentage(p.payout_value);
    return sum + (p.payout_type === "fixed" ? p.payout_value : rate);
  }, 0);
  const remaining = 1 - totalPayout;
  if (remaining <= 0.01) return null;
  const savedStaffIds = new Set(savedParticipants.map((p) => p.staff_id || p.professional_id).filter(Boolean));
  for (const [, staff] of staffById) {
    if (savedStaffIds.has(staff.id)) continue;
    if (!isCommissionEligible(staff)) continue;
    return {
      id: `inferred-${comandaItemId}-${staff.id}`,
      comanda_item_id: comandaItemId,
      staff_id: staff.id,
      professional_id: staff.id,
      role: "primary",
      payout_type: "percentage",
      payout_value: remaining * 100,
      affects_commission: true
    };
  }
  return null;
};
var normalizeCommissionParticipants = (item, comanda, rawParticipants, itemValue, staffById) => {
  if (!rawParticipants || rawParticipants.length === 0) {
    const fallbackStaffId = item.staff_id || comanda.staff_id;
    if (!fallbackStaffId) {
      return { participants: [], isShared: false, primaryStaffId: null };
    }
    return {
      participants: [buildSoloParticipant(item.id, fallbackStaffId)],
      isShared: false,
      primaryStaffId: fallbackStaffId
    };
  }
  const byStaffId = /* @__PURE__ */ new Map();
  for (const p of rawParticipants) {
    const sid = p.staff_id || p.professional_id;
    if (!sid) continue;
    const staff = staffById.get(sid);
    if (staff && !isCommissionEligible(staff)) continue;
    const existing = byStaffId.get(sid);
    if (!existing || p.role === "primary") {
      byStaffId.set(sid, p);
    }
  }
  const unique = Array.from(byStaffId.values());
  const hasPrimary = unique.some((p) => p.role === "primary" && p.affects_commission);
  if (!hasPrimary) {
    const inferred = buildInferredPrimaryParticipant(item.id, unique, staffById);
    if (inferred) unique.push(inferred);
  }
  const primaryParticipant = unique.find((p) => p.role === "primary");
  const primaryStaffId = primaryParticipant?.staff_id || primaryParticipant?.professional_id || null;
  const isShared = isSharedExecution(
    { service_id: item.service_id },
    unique.filter((p) => p.affects_commission)
  );
  return { participants: unique, isShared, primaryStaffId };
};
var getPrimaryParticipant = (participants) => participants.find((p) => p.role === "primary" && p.affects_commission);
var getAssistantParticipants = (participants) => participants.filter(
  (p) => (p.role === "assistant" || p.role === "co_executor") && p.affects_commission
);
export {
  buildInferredPrimaryParticipant,
  buildSoloParticipant,
  calculateCommissionReversal,
  calculateCommissionValue,
  calculateParticipantBaseValue,
  calculateParticipantPayout,
  calculateTotalPayouts,
  detectZeroReason,
  getAssistantParticipants,
  getDefaultRateForRole,
  getEffectiveRate,
  getPrimaryParticipant,
  hasPartialSavedPayout,
  isCommissionEligible,
  isSharedExecution,
  isSharedServiceItem,
  normalizeCommissionParticipants,
  normalizeParticipantPercentage,
  normalizePercentage,
  normalizePercentageValue,
  normalizeRate,
  resolveCommissionBase,
  resolveFinancialBase
};
