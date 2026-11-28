import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canRoleSelectOtherStaff,
  canRoleUseRetroactiveCompetence,
  checkClosedCashForDate,
  checkQuickPdvContext,
  findOpenComandaForAppointment,
  isBarberOnlyRole,
  quickRegisterAndSettle,
  QuickPdvPartialFailureError,
  settleExistingComandaQuick,
  validateManagerAuditPin,
  type HydratedQuickComanda,
  type QuickPdvCatalogItem,
  type QuickPdvSelectedItem,
  type QuickRegisterAndSettleInput,
  type QuickRegisterAndSettleResult,
  type QuickRegisterRecoveryState,
  type SettleExistingComandaQuickInput,
  type SettleExistingComandaQuickResult,
} from '../../application/checkout/quickPdv';
import type { ClientCreditEligibility, ComandaItemCheckInput } from '../../domain/chefClub/clientCreditCheck';
import type { ChargeToAccountValidation } from '../../domain/clientWallet/walletEngine';
import type { PaymentTerminalWithRates } from '../../domain/paymentTerminal/types';
import { fetchPaymentTerminalsByTenant } from '../../src/hooks/usePaymentTerminals';

export interface UseQuickPdvParams {
  tenantId: string;
  isOpen?: boolean;
  userRole?: string | null;
  isSuperAdmin?: boolean;
}

export interface RefreshQuickPdvContextInput {
  clientId?: string | null;
  items?: ComandaItemCheckInput[];
  total: number;
  competenceDate?: string | null;
  skipCreditCheck?: boolean;
}

export function useQuickPdv({
  tenantId,
  isOpen = true,
  userRole,
  isSuperAdmin = false,
}: UseQuickPdvParams) {
  const [terminals, setTerminals] = useState<PaymentTerminalWithRates[]>([]);
  const [creditEligibility, setCreditEligibility] = useState<ClientCreditEligibility | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [walletValidation, setWalletValidation] = useState<ChargeToAccountValidation | null>(null);
  const [isClosedCashDay, setIsClosedCashDay] = useState(false);
  const [checkingClosedCash, setCheckingClosedCash] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<QuickRegisterRecoveryState | null>(null);

  const [sessionCount, setSessionCount] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const canUseRetroactive = useMemo(
    () => canRoleUseRetroactiveCompetence(userRole, isSuperAdmin),
    [userRole, isSuperAdmin],
  );
  const canSelectStaff = useMemo(
    () => canRoleSelectOtherStaff(userRole, isSuperAdmin),
    [userRole, isSuperAdmin],
  );
  const isBarberRestricted = useMemo(
    () => isBarberOnlyRole(userRole, isSuperAdmin),
    [userRole, isSuperAdmin],
  );

  const defaultTerminal = useMemo(
    () => terminals.find((t) => t.is_default && t.is_active) || terminals[0] || null,
    [terminals],
  );

  // Carrega maquininhas ativas silenciosamente para gravar snapshot ADR-036 no checkout rápido
  useEffect(() => {
    if (!isOpen || !tenantId) {
      setTerminals([]);
      return;
    }

    let isMounted = true;
    fetchPaymentTerminalsByTenant(tenantId)
      .then((list) => {
        if (isMounted) setTerminals(list);
      })
      .catch(() => {
        if (isMounted) setTerminals([]);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId]);

  const refreshContext = useCallback(
    async ({
      clientId,
      items = [],
      total,
      competenceDate,
      skipCreditCheck = false,
    }: RefreshQuickPdvContextInput) => {
      if (!tenantId) {
        setCreditEligibility(null);
        setWalletValidation(null);
        setIsClosedCashDay(false);
        return;
      }

      if (!skipCreditCheck && clientId) {
        setCheckingCredits(true);
      } else {
        setCreditEligibility(null);
      }

      if (competenceDate) {
        setCheckingClosedCash(true);
      }

      try {
        const res = await checkQuickPdvContext({
          tenantId,
          clientId: skipCreditCheck ? null : clientId,
          items,
          total,
          competenceDate,
        });

        if (!skipCreditCheck) {
          setCreditEligibility(clientId ? res.creditEligibility : null);
        }
        setWalletValidation(clientId ? res.walletValidation : null);
        if (competenceDate) {
          setIsClosedCashDay(res.isClosedCashDay);
        }
      } finally {
        setCheckingCredits(false);
        setCheckingClosedCash(false);
      }
    },
    [tenantId],
  );

  const checkDateClosedCash = useCallback(
    async (competenceDate: string): Promise<boolean> => {
      if (!tenantId || !competenceDate) {
        setIsClosedCashDay(false);
        return false;
      }
      setCheckingClosedCash(true);
      try {
        const closed = await checkClosedCashForDate(tenantId, competenceDate);
        setIsClosedCashDay(closed);
        return closed;
      } finally {
        setCheckingClosedCash(false);
      }
    },
    [tenantId],
  );

  const validatePin = useCallback(
    async (pin: string) => {
      if (!tenantId) {
        return { valid: false, errorMessage: 'Tenant inválido para validar PIN.' };
      }
      return validateManagerAuditPin(tenantId, pin);
    },
    [tenantId],
  );

  const settleExisting = useCallback(
    async (
      input: Omit<SettleExistingComandaQuickInput, 'tenantId' | 'terminals'>,
    ): Promise<SettleExistingComandaQuickResult> => {
      setSubmitting(true);
      setError(null);
      try {
        return await settleExistingComandaQuick({
          ...input,
          tenantId,
          terminals,
        });
      } catch (err: any) {
        const message = err?.message || 'Falha ao registrar baixa financeira no balcão.';
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [tenantId, terminals],
  );

  const markComandaAsFiado = useCallback(
    async (
      input: Omit<SettleExistingComandaQuickInput, 'tenantId' | 'terminals' | 'paymentMethod'>,
    ): Promise<SettleExistingComandaQuickResult> => {
      return settleExisting({
        ...input,
        paymentMethod: 'fiado',
      });
    },
    [settleExisting],
  );

  const registerAndSettle = useCallback(
    async (
      input: Omit<QuickRegisterAndSettleInput, 'tenantId' | 'terminals' | 'resumeState'>,
    ): Promise<QuickRegisterAndSettleResult> => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await quickRegisterAndSettle({
          ...input,
          tenantId,
          terminals,
          resumeState: pendingRecovery,
        });

        setPendingRecovery(null);
        setSessionCount((prev) => prev + 1);
        setSessionTotal((prev) => Number((prev + (result.total || 0)).toFixed(2)));
        return result;
      } catch (err: any) {
        if (err instanceof QuickPdvPartialFailureError) {
          setPendingRecovery(err.recovery);
        }
        const message = err?.message || 'Falha ao registrar e liquidar atendimento.';
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [tenantId, terminals, pendingRecovery],
  );

  const clearPendingRecovery = useCallback(() => {
    setPendingRecovery(null);
  }, []);

  const resetSession = useCallback(() => {
    setSessionCount(0);
    setSessionTotal(0);
    setPendingRecovery(null);
    setError(null);
  }, []);

  const hydrateComandaFromAppointment = useCallback(
    async (
      appointmentId: string,
      appSlug = 'barber',
      fallback?: {
        clientId?: string | null;
        clientName?: string | null;
        clientPhone?: string | null;
        staffId?: string | null;
        price?: number;
        serviceName?: string | null;
      },
    ): Promise<{ status: 'open' | 'paid' | 'blocked' | 'none'; comanda: HydratedQuickComanda | null }> => {
      return findOpenComandaForAppointment(tenantId, appointmentId, appSlug, fallback);
    },
    [tenantId],
  );

  return {
    terminals,
    defaultTerminal,
    creditEligibility,
    checkingCredits,
    walletValidation,
    isClosedCashDay,
    checkingClosedCash,
    submitting,
    error,
    setError,
    pendingRecovery,
    clearPendingRecovery,
    sessionCount,
    sessionTotal,
    resetSession,
    canUseRetroactive,
    canSelectStaff,
    isBarberRestricted,
    refreshContext,
    checkDateClosedCash,
    validatePin,
    settleExisting,
    markComandaAsFiado,
    registerAndSettle,
    hydrateComandaFromAppointment,
  };
}

export type {
  HydratedQuickComanda,
  QuickPdvCatalogItem,
  QuickPdvSelectedItem,
  QuickRegisterAndSettleResult,
  QuickRegisterRecoveryState,
};
