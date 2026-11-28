import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatBrlCurrency } from '../../src/utils/checkoutQuickPay';
import {
  playCheckoutSuccessChime,
  triggerHapticFeedback,
} from '../../src/utils/feedbackSensory';
import type { ClientCreditEligibility } from '../../domain/chefClub/clientCreditCheck';
import {
  isAuditPinFormatValid,
  normalizeAuditPin,
} from '../../src/lib/audit/competence';
import { useTenantCommunicationConfig } from '../../src/hooks/useTenantCommunicationConfig';
import { isValidWhatsAppPhone } from '../../src/utils/whatsappHub';
import { PostSaleWhatsAppButton } from '../../src/components/whatsapp/PostSaleWhatsAppButton';
import {
  useQuickPdv,
  type QuickPdvCatalogItem,
  type QuickPdvSelectedItem,
} from '../../hooks/checkout/useQuickPdv';

export interface QuickCheckoutCompletedState {
  comandaId: string;
  paymentMethod: string;
  total: number;
  clientName: string;
  clientPhone?: string | null;
}

export interface QuickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: {
    id: string;
    total: number;
    staff_id?: string | null;
    appointment_id?: string | null;
    client_id?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    items?: Array<{
      id: string;
      name?: string;
      service_name?: string;
      product_name?: string;
      service_id?: string | null;
      product_id?: string | null;
      quantity: number;
      unit_price?: number;
      staff_id?: string | null;
    }>;
  } | null;
  tenantId: string;
  userId?: string | null;
  userRole?: string | null;
  isSuperAdmin?: boolean;
  appSlug?: string;
  schema?: string;
  catalogItems?: QuickPdvCatalogItem[];
  onSuccess: (comandaId: string, paymentMethod: string) => void;
  onOpenChairQrCode?: () => void;
  onOpenFullPdv?: (comandaId: string) => void;
  initialCreditEligibility?: ClientCreditEligibility | null;
  initialSuccessState?: QuickCheckoutCompletedState | null;
}

export const QuickCheckoutModal: React.FC<QuickCheckoutModalProps> = ({
  isOpen,
  onClose,
  comanda,
  tenantId,
  userId = null,
  userRole = null,
  isSuperAdmin = false,
  appSlug = 'barber',
  schema = 'barber',
  catalogItems = [],
  onSuccess,
  onOpenChairQrCode,
  onOpenFullPdv,
  initialCreditEligibility,
  initialSuccessState = null,
}) => {
  const {
    creditEligibility: loadedCreditEligibility,
    checkingCredits,
    walletValidation,
    submitting,
    error,
    setError,
    refreshContext,
    validatePin,
    settleExisting,
    markComandaAsFiado,
  } = useQuickPdv({
    tenantId,
    isOpen,
    userRole,
    isSuperAdmin,
  });

  // Extras rápidos adicionados no balcão/cadeira antes da baixa
  const [showAddExtras, setShowAddExtras] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [addedItems, setAddedItems] = useState<QuickPdvSelectedItem[]>([]);

  // Autorização Gerencial com PIN para Fechamento na Conta (Fiado)
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [validatingPin, setValidatingPin] = useState(false);

  const [completedCheckout, setCompletedCheckout] = useState<QuickCheckoutCompletedState | null>(
    initialSuccessState,
  );
  const { googleReviewUrl } = useTenantCommunicationConfig(tenantId);

  const effectiveCreditEligibility =
    initialCreditEligibility !== undefined ? initialCreditEligibility : loadedCreditEligibility;

  const extrasTotal = useMemo(
    () => addedItems.reduce((acc, entry) => acc + entry.item.price * entry.quantity, 0),
    [addedItems],
  );

  const effectiveTotal = useMemo(
    () => Math.max(0, Number(((comanda?.total || 0) + extrasTotal).toFixed(2))),
    [comanda?.total, extrasTotal],
  );

  const filteredCatalog = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return [];
    const term = extraSearch.trim().toLowerCase();
    const list = term
      ? catalogItems.filter((it) => it.name.toLowerCase().includes(term))
      : catalogItems;
    return list.slice(0, 8);
  }, [catalogItems, extraSearch]);

  useEffect(() => {
    if (!isOpen) {
      setCompletedCheckout(initialSuccessState);
      setAddedItems([]);
      setShowAddExtras(false);
      setExtraSearch('');
      setError(null);
      return;
    }

    if (!comanda?.id || !tenantId) return;

    const combinedItemsForCreditCheck = [
      ...(comanda.items || []).map((it) => ({
        id: it.id,
        service_id: it.service_id ?? undefined,
        product_id: it.product_id ?? undefined,
        name: it.service_name || it.product_name || it.name,
        quantity: it.quantity,
      })),
      ...addedItems.map((entry, idx) => ({
        id: `extra-${entry.item.id}-${idx}`,
        service_id: entry.item.type === 'service' ? entry.item.id : undefined,
        product_id: entry.item.type === 'product' ? entry.item.id : undefined,
        name: entry.item.name,
        quantity: entry.quantity,
      })),
    ];

    void refreshContext({
      clientId: comanda.client_id,
      items: combinedItemsForCreditCheck,
      total: effectiveTotal,
      skipCreditCheck: initialCreditEligibility !== undefined,
    });
  }, [
    isOpen,
    comanda?.id,
    comanda?.client_id,
    comanda?.items,
    tenantId,
    effectiveTotal,
    addedItems,
    initialCreditEligibility,
    initialSuccessState,
    refreshContext,
    setError,
  ]);

  useEffect(() => {
    setCompletedCheckout(initialSuccessState);
    setAddedItems([]);
    setShowAddExtras(false);
    setExtraSearch('');
  }, [comanda?.id, initialSuccessState]);

  const handleCloseModal = useCallback(() => {
    setCompletedCheckout(null);
    setAddedItems([]);
    setShowAddExtras(false);
    setError(null);
    onClose();
  }, [onClose, setError]);

  const handleAddExtraItem = (catalogItem: QuickPdvCatalogItem) => {
    setAddedItems((prev) => {
      const idx = prev.findIndex((p) => p.item.id === catalogItem.id && p.item.type === catalogItem.type);
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
          staffId: comanda?.staff_id || userId || null,
        },
      ];
    });
  };

  const handleChangeExtraQty = (itemId: string, delta: number) => {
    setAddedItems((prev) =>
      prev
        .map((entry) => {
          if (entry.item.id !== itemId) return entry;
          const nextQty = entry.quantity + delta;
          return nextQty > 0 ? { ...entry, quantity: nextQty } : null;
        })
        .filter(Boolean) as QuickPdvSelectedItem[],
    );
  };

  if (!comanda && !completedCheckout) return null;

  const handleQuickPay = async (method: 'pix' | 'debit' | 'credit' | 'cash') => {
    if (submitting || !comanda) return;

    try {
      const res = await settleExisting({
        appSlug,
        schema,
        userId,
        actorRole: userRole,
        isSuperAdmin,
        comanda,
        addedItems,
        paymentMethod: method,
      });

      playCheckoutSuccessChime();
      triggerHapticFeedback([40, 60, 40]);
      setCompletedCheckout({
        comandaId: res.comandaId,
        paymentMethod: res.paymentLabel,
        total: res.total,
        clientName: res.clientName,
        clientPhone: res.clientPhone,
      });
      onSuccess(res.comandaId, method);
    } catch {
      // erro tratado no hook useQuickPdv
    }
  };

  const handleClubCreditPay = async () => {
    if (submitting || !comanda) return;

    try {
      const res = await settleExisting({
        appSlug,
        schema,
        userId,
        actorRole: userRole,
        isSuperAdmin,
        comanda,
        addedItems,
        paymentMethod: 'club_credit',
      });

      playCheckoutSuccessChime();
      triggerHapticFeedback([60, 100, 60]);
      setCompletedCheckout({
        comandaId: res.comandaId,
        paymentMethod: res.paymentLabel,
        total: 0,
        clientName: res.clientName,
        clientPhone: res.clientPhone,
      });
      onSuccess(res.comandaId, 'Club dos Chefes');
    } catch {
      // erro tratado no hook useQuickPdv
    }
  };

  const executeChargeToAccount = async () => {
    if (!comanda?.client_id) return;
    const res = await markComandaAsFiado({
      appSlug,
      schema,
      userId,
      actorRole: userRole,
      isSuperAdmin,
      comanda,
      addedItems,
      auditPin: managerPin,
    });

    playCheckoutSuccessChime();
    triggerHapticFeedback([40, 60, 40]);
    onSuccess(res.comandaId, res.paymentLabel);
    onClose();
  };

  const handleConfirmPinAndCharge = async () => {
    if (!comanda?.client_id || validatingPin || submitting) return;

    if (!isAuditPinFormatValid(managerPin)) {
      setPinError('O PIN do gestor deve conter de 6 a 8 dígitos numéricos.');
      return;
    }

    setValidatingPin(true);
    setPinError(null);

    try {
      const pinCheck = await validatePin(managerPin);
      if (!pinCheck.valid) {
        setPinError(pinCheck.errorMessage || 'PIN do gestor incorreto. Autorização negada.');
        return;
      }

      setIsPinPromptOpen(false);
      await executeChargeToAccount();
    } catch (err: any) {
      setPinError(err?.message || 'Falha ao processar débito na conta do cliente.');
    } finally {
      setValidatingPin(false);
    }
  };

  if (completedCheckout) {
    const hasValidPhone = isValidWhatsAppPhone(completedCheckout.clientPhone);

    return (
      <Modal
        isOpen={isOpen}
        onClose={handleCloseModal}
        title="Comanda Finalizada"
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
                Sucesso no Atendimento
              </span>
              <h3 className="text-xl font-black text-[#F5F2EB] mt-1">
                Comanda #{completedCheckout.comandaId.slice(0, 8)} encerrada
              </h3>
              <p className="text-xs text-[#F5F2EB]/70 mt-1">
                {completedCheckout.clientName} • {completedCheckout.paymentMethod} •{' '}
                <span className="font-bold text-[#F5F2EB]">
                  {formatBrlCurrency(completedCheckout.total)}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#1C1A17] border border-[#262626] p-3.5 text-xs text-[#F5F2EB]/80 leading-relaxed">
            {googleReviewUrl ? (
              <p>
                Envie o agradecimento no WhatsApp com o link direto para avaliação no Google e o
                portal de agendamento da barbearia.
              </p>
            ) : (
              <p>
                Envie o agradecimento no WhatsApp com o link do portal para os próximos agendamentos
                do cliente.
              </p>
            )}
          </div>

          {!hasValidPhone && (
            <div
              role="status"
              className="rounded-xl bg-[#1C1A17] border border-[#262626] px-3.5 py-2.5 text-xs text-[#F5F2EB]/70 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-[#B88A44]">
                phone_disabled
              </span>
              <span>Cliente sem telefone cadastrado para envio via WhatsApp.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <PostSaleWhatsAppButton
              clientName={completedCheckout.clientName}
              clientPhone={completedCheckout.clientPhone}
              tenantId={tenantId}
              className="flex-1"
            />
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-5 py-3.5 rounded-xl font-bold text-sm bg-[#1E1E1E] hover:bg-[#2A2A2A] text-[#F5F2EB] border border-[#262626] transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!comanda) return null;

  const clientName = comanda.client_name || 'Cliente Avulso';
  const shortId = comanda.id.slice(0, 8);

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleCloseModal} title="⚡ Modo Balcão Express (1 Toque)" maxWidth="md">
        <div className="space-y-4 p-1">
          {/* Header com resumo do atendimento */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-200/70 dark:border-border-dark flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Comanda #{shortId}
              </span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {clientName}
              </h4>
              {comanda.items && comanda.items.length > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {comanda.items
                    .map((it) => `${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.service_name || it.product_name || it.name || 'Item'}`)
                    .join(' • ')}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 block">Total a Receber</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBrlCurrency(effectiveTotal)}
              </span>
            </div>
          </div>

          {/* + Extra Rápido (serviço/produto adicional na hora) */}
          {catalogItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAddExtras((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B88A44] hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showAddExtras ? 'expand_less' : 'add_circle'}
                  </span>
                  <span>
                    {showAddExtras
                      ? 'Ocultar catálogo extra'
                      : '+ Adicionar extra rápido (serviço ou produto)'}
                  </span>
                </button>
                {addedItems.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatBrlCurrency(extrasTotal)} extra
                  </span>
                )}
              </div>

              {addedItems.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-surface-dark p-2.5 space-y-1.5">
                  {addedItems.map((entry) => (
                    <div key={entry.item.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {entry.item.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleChangeExtraQty(entry.item.id, -1)}
                            className="px-2 py-0.5 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10"
                          >
                            -
                          </button>
                          <span className="px-2 font-black text-slate-900 dark:text-white">
                            {entry.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleChangeExtraQty(entry.item.id, 1)}
                            className="px-2 py-0.5 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums w-16 text-right">
                          {formatBrlCurrency(entry.item.price * entry.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddExtras && (
                <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50/60 dark:bg-surface-dark p-3 space-y-2">
                  <input
                    type="text"
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    placeholder="Buscar serviço ou produto extra..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-background-dark px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                  />
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                    {filteredCatalog.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => handleAddExtraItem(item)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark hover:border-[#B88A44]/60 text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                          <span className="material-symbols-outlined text-xs text-[#B88A44]">
                            {item.type === 'service' ? 'content_cut' : 'package_2'}
                          </span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                          {formatBrlCurrency(item.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Validação e Baixa Automática de Créditos do Club dos Chefes */}
          {checkingCredits && (
            <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 animate-pulse">
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
              <span className="font-medium">Consultando assinatura e créditos do Club dos Chefes...</span>
            </div>
          )}

          {effectiveCreditEligibility?.isClubMember && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#D99A2B]/10 to-amber-600/15 border border-[#D99A2B]/40 text-slate-900 dark:text-slate-100 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">
                    workspace_premium
                  </span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                      Membro VIP • Club dos Chefes
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {effectiveCreditEligibility.planName || 'Assinatura Ativa'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {effectiveCreditEligibility.totalAvailableCredits}{' '}
                  {effectiveCreditEligibility.totalAvailableCredits === 1 ? 'crédito' : 'créditos'}
                </span>
              </div>

              {effectiveCreditEligibility.isFullyCoveredByCredits ? (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleClubCreditPay()}
                    className="w-full p-3.5 rounded-xl bg-gradient-to-r from-[#D99A2B] to-amber-600 hover:from-[#c28723] hover:to-amber-700 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-xl">loyalty</span>
                    <span>Baixar com Crédito do Clube (R$ 0,00)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Baixa imediata em 1 toque sem cobrança financeira • Abate automático no saldo do plano
                  </p>
                </div>
              ) : (
                <div className="text-[11px] p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-sm shrink-0">info</span>
                  <span>{effectiveCreditEligibility.reason || 'Créditos insuficientes ou itens não cobertos pelo plano.'}</span>
                </div>
              )}
            </div>
          )}

          {/* 4 Botões Grandes de 1 Toque */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleQuickPay('pix')}
              className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-2xl text-emerald-600 dark:text-emerald-400">
                  qr_code_2
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  1 toque
                </span>
              </div>
              <div className="mt-3">
                <span className="text-sm font-bold block">PIX Expresso</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Baixa instantânea</span>
              </div>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleQuickPay('debit')}
              className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/15 text-sky-700 dark:text-sky-300 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-2xl text-sky-600 dark:text-sky-400">
                  payments
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  1 toque
                </span>
              </div>
              <div className="mt-3">
                <span className="text-sm font-bold block">Cartão Débito</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">POS / Maquininha</span>
              </div>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleQuickPay('credit')}
              className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-2xl text-amber-600 dark:text-amber-400">
                  credit_card
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  1 toque
                </span>
              </div>
              <div className="mt-3">
                <span className="text-sm font-bold block">Cartão Crédito</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">À vista balcão</span>
              </div>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleQuickPay('cash')}
              className="p-4 rounded-2xl border border-slate-300 dark:border-border-dark bg-slate-50 dark:bg-card-dark hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-slate-300">
                  attach_money
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  1 toque
                </span>
              </div>
              <div className="mt-3">
                <span className="text-sm font-bold block">Dinheiro Exato</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Sem troco</span>
              </div>
            </button>
          </div>

          {/* Opção Conta do Cliente (Fiado / A Prazo) */}
          {walletValidation?.allowed && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setIsPinPromptOpen(true);
                setManagerPin('');
                setPinError(null);
              }}
              className="w-full p-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-600/10 hover:bg-amber-500/20 text-slate-900 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer shadow-sm hover:scale-[1.01] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">
                  account_balance_wallet
                </span>
                <div className="text-left">
                  <span className="text-xs font-black block text-slate-900 dark:text-white">
                    Lançar na Conta do Cliente (A Prazo / Fiado)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Exige PIN do Gestor • Limite disponível: R$ {walletValidation.availableLimit.toFixed(2)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">lock</span>
                <span>PIN</span>
              </span>
            </button>
          )}

          {/* Opção para pagamento direto na cadeira e atalho PDV Completo */}
          {(onOpenChairQrCode || onOpenFullPdv) && (
            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              {onOpenChairQrCode ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon="smartphone"
                  onClick={() => {
                    onClose();
                    onOpenChairQrCode();
                  }}
                  className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  QR Code Cadeira
                </Button>
              ) : (
                <span />
              )}

              {onOpenFullPdv && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullPdv(comanda.id);
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-[#B88A44] transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir PDV Completo</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de PIN Gerencial para Autorização de Fiado */}
      <Modal
        isOpen={isPinPromptOpen}
        onClose={() => {
          if (!validatingPin && !submitting) {
            setIsPinPromptOpen(false);
            setPinError(null);
            setManagerPin('');
          }
        }}
        title="🔒 Autorização do Gestor (PIN)"
        maxWidth="sm"
      >
        <div className="space-y-4 p-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200">
            <span className="font-bold block mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-base">
                verified_user
              </span>
              <span>Autorização Obrigatória de Fiado</span>
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Para lançar o valor de <strong>{formatBrlCurrency(effectiveTotal)}</strong> na conta de{' '}
              <strong>{clientName}</strong>, é necessária a validação do PIN do gestor:
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              PIN do Gestor (6 a 8 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={managerPin}
              onChange={(e) => {
                setManagerPin(normalizeAuditPin(e.target.value));
                setPinError(null);
              }}
              placeholder="••••••"
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white font-mono text-center tracking-widest text-lg font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {pinError && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              <span>{pinError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={validatingPin || submitting}
              onClick={() => {
                setIsPinPromptOpen(false);
                setPinError(null);
                setManagerPin('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={validatingPin || submitting || managerPin.length < 6}
              onClick={() => void handleConfirmPinAndCharge()}
            >
              {validatingPin || submitting ? 'Validando PIN...' : 'Autorizar e Lançar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
