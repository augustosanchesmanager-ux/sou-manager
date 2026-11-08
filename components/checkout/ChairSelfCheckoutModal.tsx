import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { supabase } from '../../services/supabaseClient';
import { generatePixPayload } from '../../src/utils/pixPayload';
import { formatBrlCurrency } from '../../src/utils/checkoutQuickPay';
import { settleCheckoutComanda } from '../../src/lib/finance/settlement';
import {
  playCheckoutSuccessChime,
  triggerHapticFeedback,
} from '../../src/utils/feedbackSensory';

export interface ChairSelfCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: {
    id: string;
    total: number;
    client_name?: string | null;
    staff_name?: string | null;
  } | null;
  tenantId: string;
  tenantName?: string;
  pixKey?: string;
  onSuccess: (comandaId: string) => void;
}

export const ChairSelfCheckoutModal: React.FC<ChairSelfCheckoutModalProps> = ({
  isOpen,
  onClose,
  comanda,
  tenantId,
  tenantName = 'SMG BARBER',
  pixKey = '11999999999',
  onSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [confirmingManual, setConfirmingManual] = useState(false);

  useEffect(() => {
    if (!isOpen || !comanda?.id) return;
    setIsPaid(false);

    // Escuta em tempo real a liquidação da comanda via webhook ou PDV
    const channel = supabase
      .channel(`chair-comanda-${comanda.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comandas',
          filter: `id=eq.${comanda.id}`,
        },
        (payload: any) => {
          if (payload?.new?.status === 'paid') {
            setIsPaid(true);
            playCheckoutSuccessChime();
            triggerHapticFeedback([50, 80, 50]);
            setTimeout(() => {
              onSuccess(comanda.id);
              onClose();
            }, 2500);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, comanda?.id, onSuccess, onClose]);

  if (!comanda) return null;

  const txId = `CMD${comanda.id.replace(/-/g, '').slice(0, 10)}`;
  const pixCode = generatePixPayload({
    pixKey,
    merchantName: tenantName,
    amount: comanda.total,
    txId,
    description: `Comanda ${comanda.id.slice(0, 8)}`,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleManualConfirm = async () => {
    if (confirmingManual) return;
    setConfirmingManual(true);
    try {
      await settleCheckoutComanda({
        comandaId: comanda.id,
        tenantId,
        supabase,
        paymentMethod: 'pix',
        paidAmount: comanda.total,
        recordComandaPayment: true,
        source: 'self_checkout_cadeira',
      });
      setIsPaid(true);
      playCheckoutSuccessChime();
      triggerHapticFeedback([50, 80, 50]);
      setTimeout(() => {
        onSuccess(comanda.id);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('[ChairSelfCheckoutModal] Erro ao confirmar baixa:', err);
    } finally {
      setConfirmingManual(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📱 Self-Checkout na Cadeira" size="md">
      <div className="space-y-5 text-center p-2">
        {isPaid ? (
          <div className="py-8 space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl">check_circle</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Pagamento Confirmado!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                A comanda foi liquidada com sucesso via PIX Dinâmico.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-primary px-2.5 py-1 rounded-full bg-primary/10 inline-block mb-1">
                Display da Bancada / Cadeira
              </span>
              <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Aponte a câmera do celular para pagar
              </h4>
            </div>

            {/* Container do QR Code */}
            <div className="p-4 bg-white rounded-2xl border-2 border-primary/20 shadow-lg inline-block mx-auto">
              <QRCode value={pixCode} size={180} />
            </div>

            {/* Total e Beneficiário */}
            <div>
              <span className="text-xs text-slate-400 block">Valor da Comanda</span>
              <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {formatBrlCurrency(comanda.total)}
              </span>
              {comanda.client_name && (
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  Cliente: <strong className="text-slate-700 dark:text-slate-200">{comanda.client_name}</strong>
                </span>
              )}
            </div>

            {/* Botão Copia e Cola */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-card-dark text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Código Pix Copiado!' : 'Copiar Código Copia e Cola'}</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                  Aguardando transferência...
                </span>
                <button
                  type="button"
                  disabled={confirmingManual}
                  onClick={handleManualConfirm}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  {confirmingManual ? 'Baixando...' : 'Confirmar no Caixa'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
