import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { supabase } from '../../services/supabaseClient';
import { settleCheckoutComanda } from '../../src/lib/finance/settlement';
import { formatBrlCurrency } from '../../src/utils/checkoutQuickPay';
import {
  playCheckoutSuccessChime,
  triggerHapticFeedback,
} from '../../src/utils/feedbackSensory';
import { triggerAsyncFiscalEmission } from '../../domain/fiscal/fiscalTrigger';

export interface QuickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: {
    id: string;
    total: number;
    client_name?: string | null;
    items?: Array<{ id: string; name?: string; service_name?: string; product_name?: string; quantity: number }>;
  } | null;
  tenantId: string;
  onSuccess: (comandaId: string, paymentMethod: string) => void;
  onOpenChairQrCode?: () => void;
}

export const QuickCheckoutModal: React.FC<QuickCheckoutModalProps> = ({
  isOpen,
  onClose,
  comanda,
  tenantId,
  onSuccess,
  onOpenChairQrCode,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!comanda) return null;

  const handleQuickPay = async (method: 'pix' | 'debit' | 'credit' | 'cash') => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await settleCheckoutComanda({
        comandaId: comanda.id,
        tenantId,
        supabase,
        paymentMethod: method,
        paidAmount: comanda.total,
        recordComandaPayment: true,
        source: 'balcao_express',
      });

      // Emissão fiscal desacoplada (se habilitada pelo prestador)
      triggerAsyncFiscalEmission({
        tenantId,
        comandaId: comanda.id,
        valorTotal: comanda.total,
        clientName: comanda.client_name || undefined,
      });

      playCheckoutSuccessChime();
      triggerHapticFeedback([40, 60, 40]);
      onSuccess(comanda.id, method);
      onClose();
    } catch (err: any) {
      console.error('[QuickCheckoutModal] Erro ao registrar baixa express:', err);
      setError(err?.message || 'Falha ao registrar baixa financeira no balcão.');
    } finally {
      setSubmitting(false);
    }
  };

  const clientName = comanda.client_name || 'Cliente Avulso';
  const shortId = comanda.id.slice(0, 8);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ Modo Balcão Express (1 Toque)" size="md">
      <div className="space-y-5 p-1">
        {/* Header com resumo do atendimento */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-200/70 dark:border-border-dark flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Comanda #{shortId}
            </span>
            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {clientName}
            </h4>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-400 block">Total a Receber</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatBrlCurrency(comanda.total)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* 4 Botões Grandes de 1 Toque */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleQuickPay('pix')}
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
            onClick={() => handleQuickPay('debit')}
            className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 text-blue-700 dark:text-blue-300 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">
                payments
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
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
            onClick={() => handleQuickPay('credit')}
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
            onClick={() => handleQuickPay('cash')}
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

        {/* Opção para pagamento direto na cadeira */}
        {onOpenChairQrCode && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              O cliente prefere pagar na própria cadeira?
            </span>
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
              Abrir QR Code Cadeira
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
