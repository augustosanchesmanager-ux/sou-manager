import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { formatBrlCurrency } from '../../src/utils/checkoutQuickPay';
import {
  searchClientsWithDependents,
  type FamilyEnrichedClient,
  type SearchableFamilyClient,
} from '../../src/utils/clientFamilySearch';
import {
  isAuditPinFormatValid,
  normalizeAuditPin,
  toLocalDateInput,
} from '../../src/lib/audit/competence';
import {
  playCheckoutSuccessChime,
  triggerHapticFeedback,
} from '../../src/utils/feedbackSensory';
import { PostSaleWhatsAppButton } from '../../src/components/whatsapp/PostSaleWhatsAppButton';
import { isValidWhatsAppPhone } from '../../src/utils/whatsappHub';
import {
  useQuickPdv,
  type QuickPdvCatalogItem,
  type QuickPdvSelectedItem,
  type QuickRegisterAndSettleResult,
} from '../../hooks/checkout/useQuickPdv';
import {
  calculateQuickPdvTotals,
  type QuickPayMethod,
} from '../../application/checkout/quickPdv';
import { VoucherInput } from './VoucherInput';
import type { CustomerVoucher, VoucherDiscountBearer } from '../../src/types/vouchers';

type ClientInputMode = 'search' | 'avulso' | 'new';
type CatalogTab = 'service' | 'product';

function computeVoucherAmount(voucher: CustomerVoucher | null, gross: number): number {
  if (!voucher || gross <= 0) return 0;
  let discount = 0;
  if (voucher.benefit_type === 'discount_fixed' && voucher.discount_amount) {
    discount = Math.min(gross, Number(voucher.discount_amount) || 0);
  } else if (voucher.benefit_type === 'discount_percentage' && voucher.discount_percentage) {
    discount = Math.min(gross, (gross * (Number(voucher.discount_percentage) || 0)) / 100);
  } else if (voucher.benefit_type === 'free_service') {
    discount = gross;
  }
  return Math.max(0, Math.round(discount * 100) / 100);
}

export interface QuickRegisterAndSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  userId?: string | null;
  userRole?: string | null;
  isSuperAdmin?: boolean;
  appSlug?: string;
  schema?: string;
  staffList: Array<{ id: string; name: string; role?: string }>;
  servicesList: Array<{ id: string; name: string; price: number; duration?: number }>;
  productsList?: Array<{ id: string; name: string; price: number; stock?: number }>;
  clientsList: SearchableFamilyClient[];
  defaultStaffId?: string;
  initialClient?: { id?: string | null; name: string; phone?: string | null } | null;
  initialClosedCashOverride?: boolean;
  onSuccess?: (result: QuickRegisterAndSettleResult) => void;
  onClientCreated?: (client: { id: string; name: string; phone: string }) => void;
}

const PAID_METHODS: Array<{ id: Exclude<QuickPayMethod, 'club_credit' | 'fiado'>; label: string; icon: string }> = [
  { id: 'pix', label: 'PIX', icon: 'qr_code_2' },
  { id: 'debit', label: 'Débito', icon: 'payments' },
  { id: 'credit', label: 'Crédito', icon: 'credit_card' },
  { id: 'cash', label: 'Dinheiro', icon: 'attach_money' },
];

export const QuickRegisterAndSettleModal: React.FC<QuickRegisterAndSettleModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  userId = null,
  userRole = null,
  isSuperAdmin = false,
  appSlug = 'barber',
  schema = 'barber',
  staffList,
  servicesList,
  productsList = [],
  clientsList,
  defaultStaffId,
  initialClient = null,
  initialClosedCashOverride,
  onSuccess,
  onClientCreated,
}) => {
  const {
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
    isBarberRestricted,
    refreshContext,
    registerAndSettle,
  } = useQuickPdv({
    tenantId,
    isOpen,
    userRole,
    isSuperAdmin,
  });

  const todayStr = useMemo(() => toLocalDateInput(new Date()), []);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // 1. Profissional, Data & Horário opcional
  const resolvedInitialStaffId = useMemo(() => {
    if (isBarberRestricted && userId) {
      return staffList.find((s) => s.id === userId)?.id || userId;
    }
    return defaultStaffId || staffList[0]?.id || '';
  }, [isBarberRestricted, userId, defaultStaffId, staffList]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>(resolvedInitialStaffId);
  const [competenceDate, setCompetenceDate] = useState<string>(todayStr);
  const [optionalTime, setOptionalTime] = useState<string>('');

  // 2. Cliente (Busca | Avulso | Novo Rápido)
  const [clientMode, setClientMode] = useState<ClientInputMode>('search');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    phone?: string;
  } | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // 3. Serviços, Produtos & Descontos / Vouchers
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('service');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<QuickPdvSelectedItem[]>([]);
  const [showDiscountSection, setShowDiscountSection] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<CustomerVoucher | null>(null);
  const [manualDiscountMode, setManualDiscountMode] = useState<'fixed' | 'percent'>('fixed');
  const [manualDiscountInput, setManualDiscountInput] = useState('');
  const [discountBearer, setDiscountBearer] = useState<VoucherDiscountBearer>('split');
  const [discountReasonNote, setDiscountReasonNote] = useState('');

  // 4. Pagamento & PIN
  const [paymentMethod, setPaymentMethod] = useState<QuickPayMethod>('pix');
  const [managerPin, setManagerPin] = useState('');

  // Feedback de lote / pós-venda
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<QuickRegisterAndSettleResult | null>(null);

  const effectiveClosedCash =
    initialClosedCashOverride !== undefined ? initialClosedCashOverride : isClosedCashDay;

  // Reset inicial quando modal abre
  useEffect(() => {
    if (!isOpen) return;
    resetSession();
    setSelectedStaffId(resolvedInitialStaffId);
    setCompetenceDate(todayStr);
    setOptionalTime('');
    setSelectedItems([]);
    setCatalogTab('service');
    setItemSearch('');
    setShowDiscountSection(false);
    setAppliedVoucher(null);
    setManualDiscountMode('fixed');
    setManualDiscountInput('');
    setDiscountBearer('split');
    setDiscountReasonNote('');
    setPaymentMethod('pix');
    setManagerPin('');
    setBatchFeedback(null);
    setCompletedResult(null);

    if (initialClient?.id) {
      setClientMode('search');
      setSelectedClient({
        id: initialClient.id,
        name: initialClient.name,
        phone: initialClient.phone || undefined,
      });
      setClientSearch('');
    } else {
      setClientMode('search');
      setSelectedClient(null);
      setClientSearch('');
    }
    setNewClientName('');
    setNewClientPhone('');
  }, [isOpen, resolvedInitialStaffId, todayStr, initialClient, resetSession]);

  const grossSubtotal = useMemo(
    () =>
      Number(
        selectedItems
          .reduce((acc, entry) => acc + entry.item.price * entry.quantity, 0)
          .toFixed(2),
      ),
    [selectedItems],
  );

  const voucherDiscountAmount = useMemo(
    () => computeVoucherAmount(appliedVoucher, grossSubtotal),
    [appliedVoucher, grossSubtotal],
  );

  const rawManualDiscount = useMemo(() => {
    if (isBarberRestricted) return 0;
    const parsed = parseFloat(manualDiscountInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    if (manualDiscountMode === 'percent') {
      return Number(((grossSubtotal * Math.min(100, parsed)) / 100).toFixed(2));
    }
    return parsed;
  }, [isBarberRestricted, manualDiscountInput, manualDiscountMode, grossSubtotal]);

  const {
    grossTotal,
    voucherDiscount,
    manualDiscount,
    totalDiscount,
    netTotal,
  } = useMemo(
    () => calculateQuickPdvTotals(grossSubtotal, rawManualDiscount, voucherDiscountAmount),
    [grossSubtotal, rawManualDiscount, voucherDiscountAmount],
  );

  // Atualiza elegibilidade do Clube, limite de Fiado e status de Caixa Fechado
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const clientIdForContext = clientMode === 'search' ? selectedClient?.id || null : null;
    const creditInputs = selectedItems.map((entry, idx) => ({
      id: `${entry.item.id}-${idx}`,
      service_id: entry.item.type === 'service' ? entry.item.id : undefined,
      product_id: entry.item.type === 'product' ? entry.item.id : undefined,
      name: entry.item.name,
      quantity: entry.quantity,
    }));

    void refreshContext({
      clientId: clientIdForContext,
      items: creditInputs,
      total: netTotal,
      competenceDate,
    });
  }, [
    isOpen,
    tenantId,
    clientMode,
    selectedClient?.id,
    selectedItems,
    netTotal,
    competenceDate,
    refreshContext,
  ]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim();
    if (!term || selectedClient || clientMode !== 'search') return [];
    return searchClientsWithDependents(clientsList, term, { limit: 8 });
  }, [clientSearch, clientsList, selectedClient, clientMode]);

  const activeCatalog = useMemo<QuickPdvCatalogItem[]>(() => {
    const base: QuickPdvCatalogItem[] =
      catalogTab === 'service'
        ? servicesList.map((s) => ({
            id: s.id,
            type: 'service',
            name: s.name,
            price: Number(s.price) || 0,
            duration: s.duration,
          }))
        : productsList.map((p) => ({
            id: p.id,
            type: 'product',
            name: p.name,
            price: Number(p.price) || 0,
          }));

    const term = itemSearch.trim().toLowerCase();
    if (!term) return base;
    return base.filter((it) => it.name.toLowerCase().includes(term));
  }, [catalogTab, servicesList, productsList, itemSearch]);

  const handleSelectClient = (client: FamilyEnrichedClient) => {
    setSelectedClient({
      id: client.id,
      name: client.name,
      phone: client.effectivePhone || client.phone || undefined,
    });
    setAppliedVoucher((prev) =>
      prev?.customer_id && prev.customer_id !== client.id ? null : prev,
    );
    setClientSearch('');
    setError(null);
  };

  const handleAddItem = (catalogItem: QuickPdvCatalogItem) => {
    setSelectedItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.item.id === catalogItem.id && p.item.type === catalogItem.type,
      );
      if (idx >= 0) {
        return prev.map((entry, i) =>
          i === idx ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [
        ...prev,
        {
          item: catalogItem,
          quantity: 1,
          staffId: selectedStaffId || null,
        },
      ];
    });
    setError(null);
  };

  const handleQtyChange = (itemId: string, itemType: 'service' | 'product', delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((entry) => {
          if (entry.item.id !== itemId || entry.item.type !== itemType) return entry;
          const next = entry.quantity + delta;
          return next > 0 ? { ...entry, quantity: next } : null;
        })
        .filter(Boolean) as QuickPdvSelectedItem[],
    );
  };

  const handleRemoveItem = (itemId: string, itemType: 'service' | 'product') => {
    setSelectedItems((prev) =>
      prev.filter((entry) => !(entry.item.id === itemId && entry.item.type === itemType)),
    );
  };

  const isZeroNetNonClub =
    selectedItems.length > 0 && netTotal <= 0 && paymentMethod !== 'club_credit';
  const requiresPin = effectiveClosedCash || paymentMethod === 'fiado' || isZeroNetNonClub;
  const canUseFiado =
    clientMode === 'new' || (clientMode === 'search' && Boolean(selectedClient?.id));

  const isFiadoBlockedByLimit =
    paymentMethod === 'fiado' &&
    clientMode === 'search' &&
    Boolean(selectedClient?.id) &&
    walletValidation !== null &&
    walletValidation.allowed === false;

  const prepareNextBatchEntry = (lastResult: QuickRegisterAndSettleResult) => {
    setClientMode('search');
    setSelectedClient(null);
    setClientSearch('');
    setNewClientName('');
    setNewClientPhone('');
    setSelectedItems([]);
    setItemSearch('');
    setShowDiscountSection(false);
    setAppliedVoucher(null);
    setManualDiscountMode('fixed');
    setManualDiscountInput('');
    setDiscountBearer('split');
    setDiscountReasonNote('');
    setPaymentMethod('pix');
    setManagerPin('');
    setOptionalTime('');
    setBatchFeedback(
      `Lançado: ${lastResult.clientName} • ${formatBrlCurrency(lastResult.total)} (${lastResult.paymentLabel})`,
    );
    setTimeout(() => clientInputRef.current?.focus(), 60);
  };

  const handleSubmit = async (keepOpenForNext: boolean, overrideMethod?: QuickPayMethod) => {
    if (submitting) return;
    const methodToUse = overrideMethod || paymentMethod;
    const isZeroNetSubmit = selectedItems.length > 0 && netTotal <= 0 && methodToUse !== 'club_credit';
    setBatchFeedback(null);
    setError(null);

    if (!selectedStaffId) {
      setError('Selecione o profissional responsável pelo atendimento.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Adicione pelo menos um serviço ou produto.');
      return;
    }
    if (clientMode === 'search' && !selectedClient) {
      setError('Selecione um cliente, escolha Avulso ou use + Novo Rápido.');
      return;
    }
    if (clientMode === 'new' && !newClientName.trim()) {
      setError('Informe o nome do cliente para o cadastro rápido.');
      return;
    }
    if (methodToUse === 'fiado' && !canUseFiado) {
      setError('Fiado exige um cliente identificado.');
      return;
    }
    if (isFiadoBlockedByLimit) {
      setError('Limite de Fiado excedido ou conta bloqueada para este cliente.');
      return;
    }
    if (isZeroNetSubmit && !canUseRetroactive) {
      setError('Valor líquido R$ 0,00 exige fechamento como cortesia por um gestor com PIN.');
      return;
    }
    if ((effectiveClosedCash || methodToUse === 'fiado' || isZeroNetSubmit) && !isAuditPinFormatValid(managerPin)) {
      setError('Informe o PIN do gestor (6 a 8 dígitos) para concluir.');
      return;
    }

    try {
      const result = await registerAndSettle({
        appSlug,
        schema,
        actorUserId: userId,
        actorRole: userRole,
        isSuperAdmin,
        staffId: selectedStaffId,
        clientId: clientMode === 'search' ? selectedClient?.id || null : null,
        clientName:
          clientMode === 'avulso'
            ? 'Consumidor Final / Balcão'
            : clientMode === 'new'
              ? newClientName.trim()
              : selectedClient?.name,
        clientPhone:
          clientMode === 'new'
            ? newClientPhone.trim() || null
            : selectedClient?.phone || null,
        inlineNewClient:
          clientMode === 'new'
            ? {
                name: newClientName.trim(),
                phone: newClientPhone.trim(),
              }
            : null,
        competenceDate,
        optionalTime: optionalTime.trim() || null,
        items: selectedItems,
        paymentMethod: methodToUse,
        discountValue: manualDiscount,
        discountBearer: totalDiscount > 0 ? discountBearer : null,
        discountReasonNote: discountReasonNote.trim() || null,
        voucherId: appliedVoucher?.id || null,
        voucherCode: appliedVoucher?.voucher_code || null,
        voucherDiscount,
        auditPin: requiresPin ? managerPin : null,
      });

      playCheckoutSuccessChime();
      triggerHapticFeedback([40, 60, 40]);

      if (result.createdClient && onClientCreated) {
        onClientCreated(result.createdClient);
      }
      if (onSuccess) {
        onSuccess(result);
      }

      if (keepOpenForNext) {
        prepareNextBatchEntry(result);
      } else {
        setCompletedResult(result);
      }
    } catch {
      // Erro e estado de recuperação já tratados no hook useQuickPdv
    }
  };

  if (completedResult) {
    const hasValidPhone = isValidWhatsAppPhone(completedResult.clientPhone);
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Atendimento Registrado e Liquidado"
        maxWidth="md"
      >
        <div className="space-y-5 rounded-2xl bg-[#141414] border border-[#262626] p-5 text-[#F5F2EB]">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-full bg-[#B88A44]/15 border border-[#B88A44]/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#B88A44]">
                check_circle
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B88A44]">
                Agenda + Comanda + Baixa Concluídos
              </span>
              <h3 className="text-xl font-black text-[#F5F2EB] mt-1">
                Comanda #{completedResult.comandaId.slice(0, 8)} encerrada
              </h3>
              <p className="text-xs text-[#F5F2EB]/70 mt-1">
                {completedResult.clientName} • {completedResult.paymentLabel} •{' '}
                <span className="font-bold text-[#F5F2EB]">
                  {formatBrlCurrency(completedResult.total)}
                </span>
              </p>
              {(completedResult.discountValue || 0) + (completedResult.voucherDiscount || 0) > 0 && (
                <p className="text-[11px] text-[#F5F2EB]/60 mt-1 tabular-nums">
                  Bruto {formatBrlCurrency(completedResult.grossTotal ?? completedResult.total)} •{' '}
                  Descontos -{formatBrlCurrency((completedResult.discountValue || 0) + (completedResult.voucherDiscount || 0))} •{' '}
                  Líquido {formatBrlCurrency(completedResult.total)}
                </p>
              )}
            </div>
          </div>

          {!hasValidPhone && (
            <div className="rounded-xl bg-[#1C1A17] border border-[#262626] px-3.5 py-2.5 text-xs text-[#F5F2EB]/70 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#B88A44]">
                phone_disabled
              </span>
              <span>Cliente sem telefone cadastrado para envio via WhatsApp.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <PostSaleWhatsAppButton
              clientName={completedResult.clientName}
              clientPhone={completedResult.clientPhone}
              tenantId={tenantId}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => {
                setCompletedResult(null);
                prepareNextBatchEntry(completedResult);
              }}
              className="px-4 py-3.5 rounded-xl font-bold text-sm bg-[#B88A44] hover:brightness-105 text-[#141414] transition-all cursor-pointer"
            >
              Lançar Próximo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 rounded-xl font-bold text-sm bg-[#1E1E1E] hover:bg-[#2A2A2A] text-[#F5F2EB] border border-[#262626] transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="⚡ Lançamento + Baixa Rápida"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Status de Lote da Sessão */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark px-3.5 py-2 text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            Cria agendamento, comanda e registra o pagamento em um só fluxo.
          </span>
          {sessionCount > 0 && (
            <span className="rounded-full bg-[#B88A44]/20 border border-[#B88A44]/40 px-2.5 py-0.5 text-[11px] font-black text-[#B88A44] tabular-nums">
              Modo Lote: {sessionCount} {sessionCount === 1 ? 'lançado' : 'lançados'} •{' '}
              {formatBrlCurrency(sessionTotal)}
            </span>
          )}
        </div>

        {batchFeedback && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{batchFeedback}</span>
          </div>
        )}

        {/* 1. PROFISSIONAL, DATA & HORÁRIO OPCIONAL */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 rounded-2xl border border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-surface-dark p-3.5">
          <div className="sm:col-span-5">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Profissional
            </label>
            {isBarberRestricted ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-background-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="truncate">
                  {staffList.find((s) => s.id === selectedStaffId)?.name || 'Sua Cadeira'}
                </span>
                <span className="material-symbols-outlined text-sm text-[#B88A44]">lock</span>
              </div>
            ) : (
              <select
                value={selectedStaffId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedStaffId(nextId);
                  setSelectedItems((prev) =>
                    prev.map((entry) => ({ ...entry, staffId: nextId || null })),
                  );
                }}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
              >
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Data do Atendimento
            </label>
            {canUseRetroactive ? (
              <input
                type="date"
                max={todayStr}
                value={competenceDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val <= todayStr) {
                    setCompetenceDate(val);
                    setError(null);
                  }
                }}
                disabled={submitting || Boolean(pendingRecovery)}
                aria-label="Data do Atendimento"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
              />
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-background-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Hoje ({new Date().toLocaleDateString('pt-BR')})</span>
                <span className="material-symbols-outlined text-sm text-slate-400">today</span>
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Horário (Opc.)
              </label>
              {optionalTime && (
                <button
                  type="button"
                  onClick={() => setOptionalTime('')}
                  className="text-[10px] font-bold text-[#B88A44] hover:underline cursor-pointer"
                >
                  Auto
                </button>
              )}
            </div>
            <input
              type="time"
              value={optionalTime}
              onChange={(e) => setOptionalTime(e.target.value)}
              disabled={submitting || Boolean(pendingRecovery)}
              aria-label="Horário Opcional"
              placeholder="Auto"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
            />
          </div>
        </div>

        {/* Aviso de Caixa Fechado (ADR-039) */}
        {(effectiveClosedCash || checkingClosedCash) && (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-500">
              {checkingClosedCash ? 'sync' : 'verified_user'}
            </span>
            <span>
              {checkingClosedCash
                ? 'Verificando fechamento de caixa desta data...'
                : 'Caixa deste dia já confirmado — será obrigatório validar o PIN do Gestor (ADR-039).'}
            </span>
          </div>
        )}

        {/* 2. CLIENTE (Buscar | Avulso | + Novo Rápido) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cliente
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setClientMode('search');
                  setError(null);
                }}
                disabled={submitting}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  clientMode === 'search'
                    ? 'bg-primary text-night border-primary'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientMode('avulso');
                  setSelectedClient(null);
                  setAppliedVoucher((prev) => (prev?.customer_id ? null : prev));
                  setClientSearch('');
                  if (paymentMethod === 'fiado' || paymentMethod === 'club_credit') {
                    setPaymentMethod('pix');
                  }
                  setError(null);
                }}
                disabled={submitting}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                  clientMode === 'avulso'
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-xs">bolt</span>
                <span>Avulso / Balcão</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientMode('new');
                  setSelectedClient(null);
                  setAppliedVoucher((prev) => (prev?.customer_id ? null : prev));
                  setClientSearch('');
                  if (paymentMethod === 'club_credit') setPaymentMethod('pix');
                  setError(null);
                }}
                disabled={submitting}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                  clientMode === 'new'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-xs">person_add</span>
                <span>+ Novo Rápido</span>
              </button>
            </div>
          </div>

          {clientMode === 'search' && (
            <div>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-emerald-500">person</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {selectedClient.name}
                    </span>
                    {selectedClient.phone && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedClient.phone}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setAppliedVoucher((prev) => (prev?.customer_id ? null : prev));
                    }}
                    className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                    title="Trocar cliente"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    ref={clientInputRef}
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente por nome ou telefone..."
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background-dark pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                  />

                  {filteredClients.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-30 divide-y divide-slate-100 dark:divide-white/5">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                            client.isDependent && client.matchedViaParent
                              ? 'pl-6 bg-slate-50/60 dark:bg-white/[0.02]'
                              : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {client.name}
                            </span>
                            {client.isDependent && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 text-[10px] font-bold">
                                Filho(a) de {client.parentName || 'Responsável'}
                              </span>
                            )}
                          </div>
                          {(client.effectivePhone || client.phone) && (
                            <span className="text-[11px] text-slate-400">
                              {client.effectivePhone || client.phone}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {clientMode === 'new' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nome completo do cliente *"
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background-dark px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
              <input
                type="tel"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="WhatsApp (opcional)"
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background-dark px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {/* 3. SERVIÇOS & PRODUTOS (1 TOQUE) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCatalogTab('service')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  catalogTab === 'service'
                    ? 'bg-primary text-night shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                }`}
              >
                Serviços ({servicesList.length})
              </button>
              {productsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatalogTab('product')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    catalogTab === 'product'
                      ? 'bg-primary text-night shadow-xs'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Produtos ({productsList.length})
                </button>
              )}
            </div>

            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder={`Filtrar ${catalogTab === 'service' ? 'serviço' : 'produto'}...`}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background-dark px-2.5 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-[#B88A44] w-48"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
            {activeCatalog.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                disabled={submitting}
                onClick={() => handleAddItem(item)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-amber-50 dark:bg-white/5 dark:hover:bg-[#B88A44]/10 hover:border-[#B88A44]/50 transition-all text-left flex flex-col justify-between active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#B88A44]">
                    {item.type === 'service' ? 'content_cut' : 'package_2'}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {item.name}
                  </span>
                </div>
                <span className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatBrlCurrency(item.price)}
                </span>
              </button>
            ))}
          </div>

          {/* Cesta de Itens Selecionados */}
          {selectedItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] p-3 space-y-1.5">
              {selectedItems.map((entry) => (
                <div
                  key={`${entry.item.type}-${entry.item.id}`}
                  className="flex items-center justify-between text-xs gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {entry.item.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {entry.item.type === 'service' ? 'Serviço' : 'Produto'} •{' '}
                      {formatBrlCurrency(entry.item.price)} cada
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-background-dark">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(entry.item.id, entry.item.type, -1)}
                        className="px-2 py-0.5 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      >
                        -
                      </button>
                      <span className="px-2 font-black text-slate-800 dark:text-slate-200">
                        {entry.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(entry.item.id, entry.item.type, 1)}
                        className="px-2 py-0.5 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-black text-emerald-600 dark:text-emerald-400 w-16 text-right tabular-nums">
                      {formatBrlCurrency(entry.item.price * entry.quantity)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(entry.item.id, entry.item.type)}
                      className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Toggle Desconto / Voucher + Breakdown Bruto e Líquido */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-2.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowDiscountSection((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      showDiscountSection || totalDiscount > 0
                        ? 'border-[#B88A44]/50 bg-[#B88A44]/15 text-[#B88A44]'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark text-slate-600 dark:text-slate-300 hover:border-[#B88A44]/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showDiscountSection ? 'expand_less' : 'loyalty'}
                    </span>
                    <span>
                      {totalDiscount > 0 ? 'Desconto / Voucher aplicado' : '+ Desconto / Voucher'}
                    </span>
                    {totalDiscount > 0 && (
                      <span className="rounded-full bg-[#B88A44] px-1.5 py-0.5 text-[10px] font-black text-[#141414] tabular-nums">
                        -{formatBrlCurrency(totalDiscount)}
                      </span>
                    )}
                  </button>
                </div>

                {showDiscountSection && (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark p-3 space-y-3">
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Voucher / Cupom
                      </span>
                      <VoucherInput
                        tenantId={tenantId}
                        customerId={clientMode === 'search' ? selectedClient?.id || null : null}
                        subtotal={grossTotal}
                        appliedVoucher={appliedVoucher}
                        onApplyVoucher={(voucher, _amount, bearer) => {
                          setAppliedVoucher(voucher);
                          setDiscountBearer(bearer);
                          setError(null);
                        }}
                        onRemoveVoucher={() => {
                          setAppliedVoucher(null);
                          setError(null);
                        }}
                      />
                    </div>

                    {!isBarberRestricted && (
                      <div className="border-t border-slate-100 dark:border-white/10 pt-2.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Desconto Manual
                          </span>
                          <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setManualDiscountMode('fixed');
                                setManualDiscountInput('');
                              }}
                              className={`px-2 py-0.5 cursor-pointer ${
                                manualDiscountMode === 'fixed'
                                  ? 'bg-[#B88A44] text-[#141414]'
                                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              R$
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setManualDiscountMode('percent');
                                setManualDiscountInput('');
                              }}
                              className={`px-2 py-0.5 cursor-pointer ${
                                manualDiscountMode === 'percent'
                                  ? 'bg-[#B88A44] text-[#141414]'
                                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              %
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-4 relative">
                            <input
                              type="number"
                              min="0"
                              max={manualDiscountMode === 'percent' ? '100' : undefined}
                              step="0.01"
                              value={manualDiscountInput}
                              onChange={(e) => {
                                setManualDiscountInput(e.target.value);
                                setError(null);
                              }}
                              disabled={submitting}
                              aria-label="Desconto Manual"
                              placeholder={manualDiscountMode === 'percent' ? '0%' : '0,00'}
                              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-dark px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                            />
                          </div>

                          <div className="sm:col-span-8 flex flex-wrap items-center gap-1">
                            {([
                              { id: 'split', label: 'Rateio' },
                              { id: 'house', label: 'Casa' },
                              { id: 'barber', label: 'Profissional' },
                            ] as const).map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={submitting}
                                onClick={() => setDiscountBearer(option.id)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                                  discountBearer === option.id
                                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={discountReasonNote}
                          onChange={(e) => setDiscountReasonNote(e.target.value)}
                          disabled={submitting}
                          placeholder="Motivo (opcional — ex.: fidelidade, ajuste comercial...)"
                          aria-label="Motivo do desconto"
                          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-dark px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Valor Bruto</span>
                    <span className="font-bold tabular-nums">{formatBrlCurrency(grossTotal)}</span>
                  </div>

                  {voucherDiscount > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>
                        Voucher ({appliedVoucher?.voucher_code || appliedVoucher?.title || 'Cupom'})
                      </span>
                      <span className="font-bold tabular-nums">
                        -{formatBrlCurrency(voucherDiscount)}
                      </span>
                    </div>
                  )}

                  {manualDiscount > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                      <span>Desconto Manual</span>
                      <span className="font-bold tabular-nums">
                        -{formatBrlCurrency(manualDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-white/10 pt-1.5 flex items-center justify-between font-black text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      Total Líquido (a Liquidar)
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-lg tabular-nums">
                      {formatBrlCurrency(paymentMethod === 'club_credit' ? 0 : netTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. PAGAMENTO + PIN GERENCIAL QUANDO EXIGIDO */}
        <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-surface-dark p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Forma de Pagamento
            </span>
            {checkingCredits && (
              <span className="text-[11px] text-amber-500 font-semibold">
                Checando Clube...
              </span>
            )}
          </div>

          {creditEligibility?.isClubMember && creditEligibility.isFullyCoveredByCredits && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setPaymentMethod('club_credit')}
              className={`w-full p-2.5 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                paymentMethod === 'club_credit'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">loyalty</span>
                <span>Crédito Club dos Chefes ({creditEligibility.planName})</span>
              </span>
              <span className="font-black">R$ 0,00</span>
            </button>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PAID_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setPaymentMethod(m.id);
                  setError(null);
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === m.id
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-card-dark border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-[#B88A44]/50'
                }`}
              >
                <span className="material-symbols-outlined text-base">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}

            <button
              type="button"
              disabled={submitting || !canUseFiado}
              onClick={() => {
                setPaymentMethod('fiado');
                setError(null);
              }}
              title={
                canUseFiado
                  ? 'Lançar na Conta do Cliente (Fiado — exige PIN)'
                  : 'Selecione ou cadastre um cliente para habilitar Fiado'
              }
              className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                paymentMethod === 'fiado'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-white dark:bg-card-dark border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-amber-500/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">lock</span>
              <span>Fiado</span>
            </button>
          </div>

          {isFiadoBlockedByLimit && (
            <p className="text-[11px] font-bold text-red-500">
              {walletValidation?.reason || 'Limite insuficiente na carteira do cliente para Fiado.'}
            </p>
          )}

          {requiresPin && (
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                  PIN do Gestor (6 a 8 dígitos) —{' '}
                  {effectiveClosedCash
                    ? 'Caixa Confirmado'
                    : isZeroNetNonClub
                      ? 'Fechamento R$ 0,00 (Cortesia/Voucher)'
                      : 'Autorização Fiado'}
                </label>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={managerPin}
                onChange={(e) => {
                  setManagerPin(normalizeAuditPin(e.target.value));
                  setError(null);
                }}
                placeholder="••••••"
                aria-label="PIN do Gestor"
                className="sm:w-44 rounded-xl border border-amber-500/40 bg-white dark:bg-background-dark px-3 py-2 text-center font-mono text-sm font-black tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Recovery de Falha Parcial */}
        {pendingRecovery?.comandaId && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
            <span>
              Agendamento e Comanda #{pendingRecovery.comandaId.slice(0, 8)} já foram registrados.
              Clique para retentar apenas a baixa sem duplicar.
            </span>
            <button
              type="button"
              onClick={clearPendingRecovery}
              className="text-[11px] font-bold underline shrink-0 cursor-pointer"
            >
              Descartar
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* 5. AÇÕES DO RODAPÉ */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit(false)}
            disabled={submitting || selectedItems.length === 0 || isFiadoBlockedByLimit}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>
              {submitting
                ? 'Processando...'
                : pendingRecovery?.comandaId
                  ? 'Retentar Baixa e Fechar'
                  : 'Finalizar e Fechar'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit(true)}
            disabled={submitting || selectedItems.length === 0 || isFiadoBlockedByLimit}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md shadow-amber-400/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span>
              {submitting ? 'Processando...' : 'Finalizar e Lançar Próximo'}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickRegisterAndSettleModal;
