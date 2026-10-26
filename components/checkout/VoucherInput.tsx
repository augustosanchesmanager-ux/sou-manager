import React, { useState } from 'react';
import { Tag, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { validateVoucherByCode } from '../../src/lib/vouchers';
import type { CustomerVoucher, VoucherDiscountBearer } from '../../src/types/vouchers';

interface VoucherInputProps {
  tenantId: string;
  customerId?: string | null;
  subtotal: number;
  appliedVoucher: CustomerVoucher | null;
  onApplyVoucher: (voucher: CustomerVoucher, discountAmount: number, bearer: VoucherDiscountBearer) => void;
  onRemoveVoucher: () => void;
}

export const VoucherInput: React.FC<VoucherInputProps> = ({
  tenantId,
  customerId,
  subtotal,
  appliedVoucher,
  onApplyVoucher,
  onRemoveVoucher,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const handleValidateAndApply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await validateVoucherByCode({
        tenantId,
        code: clean,
        customerId,
        subtotal,
      });

      if (!result.valid || !result.voucher) {
        setFeedback({
          type: 'error',
          message: result.message || 'Cupom inválido ou expirado.',
        });
        return;
      }

      onApplyVoucher(result.voucher, result.calculatedDiscount, result.bearer);
      setFeedback({
        type: 'success',
        message: `Cupom "${result.voucher.title}" aplicado!`,
      });
      setCode('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao validar cupom.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getBearerLabel = (bearer?: VoucherDiscountBearer) => {
    switch (bearer) {
      case 'house':
        return 'Campanha da Casa (Comissão integral)';
      case 'barber':
        return 'Desconto do Profissional';
      case 'split':
      default:
        return 'Rateio Proporcional (Líquido)';
    }
  };

  if (appliedVoucher) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5 text-xs text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={15} />
            <span>Cupom: {appliedVoucher.voucher_code || appliedVoucher.title}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onRemoveVoucher();
              setFeedback(null);
            }}
            className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition"
            title="Remover cupom"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {appliedVoucher.description || appliedVoucher.title}
        </p>

        <div className="inline-block bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-semibold">
          {getBearerLabel(appliedVoucher.discount_bearer)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleValidateAndApply} className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Código do cupom / voucher"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (feedback) setFeedback(null);
            }}
            disabled={loading}
            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold uppercase placeholder:normal-case placeholder:font-normal focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
        </button>
      </form>

      {feedback && (
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md ${
            feedback.type === 'error'
              ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
