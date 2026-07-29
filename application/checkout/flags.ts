/**
 * [SMG][APPLICATION][CHECKOUT] flags
 *
 * Flags derivadas do fluxo de checkout.
 * Função pura: recebe estado, retorna flags.
 * Não conhece ChefClub — apenas verifica se membership existe.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface CheckoutFlagsParams {
    paymentStatus: string;
    total: number;
    creditItemCount: number;
    isClubMember: boolean;
    closureMode: string;
    zeroCloseOrigin: string;
    canCloseWithAdministrativeOrigin: boolean;
}

export interface CheckoutFlags {
    isZeroPaidCheckout: boolean;
    canCloseWithClubCredit: boolean;
    isLegacyClubSettlement: boolean;
    isZeroAuditSettlement: boolean;
    shouldSettleZeroWithAudit: boolean;
    shouldApplyFinancialEffects: boolean;
    shouldDeductMembershipCredits: boolean;
    shouldShowPaymentMethod: boolean;
}

// ─── Pure Function ───────────────────────────────────────────────

export const computeCheckoutFlags = (params: CheckoutFlagsParams): CheckoutFlags => {
    const {
        paymentStatus,
        total,
        creditItemCount,
        isClubMember,
        closureMode,
        zeroCloseOrigin,
    } = params;

    const isZeroPaidCheckout = paymentStatus === 'paid' && total <= 0;
    const canCloseWithClubCredit = isZeroPaidCheckout && creditItemCount > 0 && isClubMember;
    const isLegacyClubSettlement = paymentStatus === 'paid' && closureMode === 'legacy_membership';

    const isZeroAuditSettlement = isZeroPaidCheckout && (
        zeroCloseOrigin === 'club_credit'
            ? canCloseWithClubCredit
            : zeroCloseOrigin === 'house_courtesy' || zeroCloseOrigin === 'administrative_adjustment'
    );

    const shouldSettleZeroWithAudit = isZeroAuditSettlement && !isLegacyClubSettlement;
    const shouldApplyFinancialEffects = paymentStatus === 'paid' && !isLegacyClubSettlement && !shouldSettleZeroWithAudit;
    const shouldDeductMembershipCredits = paymentStatus === 'paid' && !isLegacyClubSettlement && !shouldSettleZeroWithAudit;
    const shouldShowPaymentMethod = paymentStatus === 'paid' && !isZeroPaidCheckout;

    return {
        isZeroPaidCheckout,
        canCloseWithClubCredit,
        isLegacyClubSettlement,
        isZeroAuditSettlement,
        shouldSettleZeroWithAudit,
        shouldApplyFinancialEffects,
        shouldDeductMembershipCredits,
        shouldShowPaymentMethod,
    };
};
