import React, { useState, useEffect } from 'react';
import { CheckCircle, Award, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatCurrency } from '../../shared/format/currency';

export interface QuickClubSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  description: string;
  amount: number;
  dueDate: string;
  isSubmitting: boolean;
  onConfirm: (params: {
    paymentMethod: string;
    paidAt: string;
    notes: string | null;
  }) => Promise<void>;
}

const PAYMENT_OPTIONS = [
  { key: 'pix', label: 'PIX' },
  { key: 'cash', label: 'Dinheiro' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
];

export const QuickClubSettlementModal: React.FC<QuickClubSettlementModalProps> = ({
  isOpen,
  onClose,
  clientName,
  description,
  amount,
  dueDate,
  isSubmitting,
  onConfirm,
}) => {
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paidAt, setPaidAt] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('pix');
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60000;
      setPaidAt(new Date(now.getTime() - offsetMs).toISOString().slice(0, 10));
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    await onConfirm({
      paymentMethod,
      paidAt: paidAt || new Date().toISOString().slice(0, 10),
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Baixa Rápida — Clube dos Chefes"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Aviso Dourado Obrigatório (P0.2) */}
        <div className="rounded-xl border border-[#B88A44]/50 bg-[#B88A44]/10 p-3.5 flex items-start gap-3">
          <Award className="w-5 h-5 text-[#B88A44] shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-[#F5F5F0] leading-relaxed">
            <strong className="text-[#B88A44]">Liberação automática (P0.2):</strong> Os créditos da assinatura serão liberados automaticamente após confirmar o recebimento.
          </p>
        </div>

        {/* Resumo do Título */}
        <div className="rounded-xl border border-[#2D2A26] bg-[#141210] p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-400">Cliente:</span>
            <span className="font-semibold text-[#F5F5F0]">{clientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Plano / Referência:</span>
            <span className="text-stone-200">{description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Vencimento:</span>
            <span className="text-stone-300">
              {dueDate ? dueDate.split('-').reverse().join('/') : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#2D2A26]">
            <span className="font-semibold text-stone-300">Valor a Receber:</span>
            <span className="text-base font-bold text-emerald-400">
              {formatCurrency(amount)}
            </span>
          </div>
        </div>

        {/* Seleção Rápida de Meio de Pagamento em 1 clique */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
            Forma de Recebimento (1 clique)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const selected = paymentMethod === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPaymentMethod(opt.key)}
                  className={`py-2.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                    selected
                      ? 'bg-[#B88A44] text-[#0E0C0A] border-[#B88A44] shadow-md'
                      : 'bg-[#0E0C0A] text-stone-300 border-[#2D2A26] hover:border-[#B88A44]/50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data da Baixa e Observação opcional */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Data do Recebimento
            </label>
            <input
              type="date"
              required
              disabled={isSubmitting}
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-lg border border-[#2D2A26] bg-[#0E0C0A] px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Observação (opcional)
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Comprovante enviado no WhatsApp"
              className="w-full rounded-lg border border-[#2D2A26] bg-[#0E0C0A] px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2D2A26]">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-300 bg-[#141210] border border-[#2D2A26] hover:bg-[#1E1B18] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-[#B88A44] text-[#0E0C0A] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar Recebimento
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
