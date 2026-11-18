import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, Check, Lock } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { CashCloseValidation } from '../cashCloseUtils';

interface PhysicalConferenceProps {
  validation: CashCloseValidation;
  totalExpected: number;
  paymentMethodBreakdown?: [string, { entradas: number; saidas: number; count: number }][];
  observations?: string;
  onObservationsChange?: (value: string) => void;
  onCountedCashChange: (value: number) => void;
  onHasInvalidSangriaChange?: (invalid: boolean) => void;
  loading: boolean;
}

type MethodKey = 'cash' | 'pix' | 'debit' | 'credit';

interface MethodConfig {
  key: MethodKey;
  label: string;
  isDigital: boolean;
}

const METHODS: MethodConfig[] = [
  { key: 'cash', label: 'Dinheiro em Espécie', isDigital: false },
  { key: 'pix', label: 'PIX', isDigital: true },
  { key: 'debit', label: 'Cartão de Débito', isDigital: true },
  { key: 'credit', label: 'Cartão de Crédito', isDigital: true },
];

const normalizeMethodKey = (rawMethod: string): MethodKey | null => {
  const m = String(rawMethod || '').toLowerCase().trim();
  if (m.includes('dinheiro') || m === 'cash') return 'cash';
  if (m.includes('pix')) return 'pix';
  if (m.includes('débito') || m.includes('debito') || m === 'debit') return 'debit';
  if (m.includes('crédito') || m.includes('credito') || m === 'credit') return 'credit';
  return null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const PhysicalConference: React.FC<PhysicalConferenceProps> = ({
  totalExpected,
  paymentMethodBreakdown = [],
  observations = '',
  onObservationsChange,
  onCountedCashChange,
  onHasInvalidSangriaChange,
  loading,
}) => {
  const [countedByMethod, setCountedByMethod] = useState<Record<MethodKey, string>>({
    cash: '',
    pix: '',
    debit: '',
    credit: '',
  });
  const [finalSangria, setFinalSangria] = useState<string>('0');

  const expectedByMethod = useMemo(() => {
    const map: Record<MethodKey, number> = {
      cash: 0,
      pix: 0,
      debit: 0,
      credit: 0,
    };

    for (const [rawMethod, data] of paymentMethodBreakdown) {
      const key = normalizeMethodKey(rawMethod);
      if (key) {
        map[key] = round2(map[key] + (Number(data.entradas || 0) - Number(data.saidas || 0)));
      }
    }

    // Caso não haja detalhamento por meio mas exista totalExpected, atribui ao Dinheiro para não zerar a conferência
    const sumMapped = round2(map.cash + map.pix + map.debit + map.credit);
    if (sumMapped === 0 && totalExpected > 0) {
      map.cash = round2(totalExpected);
    }

    return map;
  }, [paymentMethodBreakdown, totalExpected]);

  const parsedCounted = useMemo(() => {
    return {
      cash: parseFloat(countedByMethod.cash.replace(',', '.')) || 0,
      pix: parseFloat(countedByMethod.pix.replace(',', '.')) || 0,
      debit: parseFloat(countedByMethod.debit.replace(',', '.')) || 0,
      credit: parseFloat(countedByMethod.credit.replace(',', '.')) || 0,
    };
  }, [countedByMethod]);

  const hasAnyInformed = useMemo(() => {
    return Object.values(countedByMethod).some((v) => String(v).trim() !== '');
  }, [countedByMethod]);

  const totalCounted = useMemo(() => {
    return round2(parsedCounted.cash + parsedCounted.pix + parsedCounted.debit + parsedCounted.credit);
  }, [parsedCounted]);

  const totalExpectedSum = useMemo(() => {
    return round2(
      expectedByMethod.cash + expectedByMethod.pix + expectedByMethod.debit + expectedByMethod.credit
    );
  }, [expectedByMethod]);

  const totalDifference = round2(totalCounted - totalExpectedSum);
  const hasAnyMethodDiff = METHODS.some((m) => {
    const diff = round2(parsedCounted[m.key] - expectedByMethod[m.key]);
    return String(countedByMethod[m.key]).trim() !== '' && Math.abs(diff) > 0.01;
  });
  const hasDivergence = hasAnyInformed && (Math.abs(totalDifference) > 0.01 || hasAnyMethodDiff);

  // Destinação da Gaveta Física
  const parsedSangria = parseFloat(finalSangria.replace(',', '.')) || 0;
  const trocoNextDay = round2(parsedCounted.cash - parsedSangria);
  const invalidSangria = parsedSangria > parsedCounted.cash || parsedSangria < 0;

  useEffect(() => {
    onHasInvalidSangriaChange?.(invalidSangria);
  }, [invalidSangria, onHasInvalidSangriaChange]);

  const handleMethodChange = (key: MethodKey, rawVal: string) => {
    const next = { ...countedByMethod, [key]: rawVal };
    setCountedByMethod(next);

    const nextTotal = round2(
      (parseFloat(next.cash.replace(',', '.')) || 0) +
        (parseFloat(next.pix.replace(',', '.')) || 0) +
        (parseFloat(next.debit.replace(',', '.')) || 0) +
        (parseFloat(next.credit.replace(',', '.')) || 0)
    );
    onCountedCashChange(nextTotal);
  };

  const handleConfirmExpected = (key: MethodKey) => {
    handleMethodChange(key, expectedByMethod[key].toFixed(2));
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-[#2D2A26] bg-[#141210] p-5 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D2A26] pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B88A44]">
            Conferência Guiada de Turno
          </span>
          <h3 className="text-base font-bold text-[#F5F5F0] mt-0.5">
            Lado a Lado por Meio de Pagamento
          </h3>
        </div>
        {hasAnyInformed && !hasDivergence ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            <CheckCircle size={14} /> Conciliado (R$ 0,00)
          </span>
        ) : hasDivergence ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
            <AlertTriangle size={14} /> Divergência Detectada ({formatCurrency(totalDifference)})
          </span>
        ) : (
          <span className="text-xs text-stone-400">Informe ou confirme os valores do turno</span>
        )}
      </div>

      {/* Tabela Lado a Lado */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
              <th className="py-3 px-4 font-semibold">Meio de Pagamento</th>
              <th className="py-3 px-4 font-semibold text-right">Esperado pelo Sistema</th>
              <th className="py-3 px-4 font-semibold">Valor Contado / Conferido</th>
              <th className="py-3 px-4 font-semibold text-right">Diferença / Quebra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
            {METHODS.map((m) => {
              const expected = expectedByMethod[m.key];
              const rawVal = countedByMethod[m.key];
              const isFilled = String(rawVal).trim() !== '';
              const counted = parsedCounted[m.key];
              const diff = round2(counted - expected);
              const isMatched = isFilled && Math.abs(diff) <= 0.01;
              const isSurplus = isFilled && diff > 0.01;
              const isShortage = isFilled && diff < -0.01;

              return (
                <tr key={m.key} className="hover:bg-[#1C1916] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#F5F5F0]">{m.label}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-stone-300">
                    {formatCurrency(expected)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 max-w-[160px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={rawVal}
                          onChange={(e) => handleMethodChange(m.key, e.target.value)}
                          className="w-full rounded-lg border border-[#2D2A26] bg-[#0E0C0A] pl-8 pr-2.5 py-1.5 text-xs font-bold text-[#F5F5F0] outline-none focus:border-[#B88A44]"
                        />
                      </div>
                      {m.isDigital && (
                        <button
                          type="button"
                          onClick={() => handleConfirmExpected(m.key)}
                          title="Copiar valor esperado pelo sistema"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#0E0C0A] border border-[#B88A44]/40 text-[#B88A44] hover:bg-[#B88A44] hover:text-[#0E0C0A] transition-colors whitespace-nowrap"
                        >
                          <Check size={12} /> Confirmar Valor
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {!isFilled ? (
                      <span className="text-stone-500">-</span>
                    ) : isMatched ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Conciliado (R$ 0,00)
                      </span>
                    ) : isSurplus ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#B88A44]/20 text-[#B88A44] border border-[#B88A44]/40">
                        Sobra (+{formatCurrency(diff)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        Falta ({formatCurrency(diff)})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Destinação da Gaveta Física (Sangria Final e Troco) */}
      <div className="rounded-xl border border-[#2D2A26] bg-[#0E0C0A] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#B88A44]">
            Destinação da Gaveta Física (Dinheiro em Espécie)
          </h4>
          {invalidSangria && (
            <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
              <Lock size={12} /> A retirada não pode superar o dinheiro contado!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="rounded-lg border border-[#2D2A26] bg-[#141210] p-3">
            <span className="text-[10px] uppercase tracking-wider text-stone-400">
              Dinheiro Contado na Gaveta
            </span>
            <p className="mt-1 text-lg font-bold text-[#F5F5F0]">
              {formatCurrency(parsedCounted.cash)}
            </p>
          </div>

          <div className="rounded-lg border border-[#2D2A26] bg-[#141210] p-3">
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">
              (-) Sangria de Fechamento / Retirada
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={finalSangria}
                onChange={(e) => setFinalSangria(e.target.value)}
                className={`w-full rounded-lg border bg-[#0E0C0A] pl-8 pr-3 py-1.5 text-sm font-bold text-[#F5F5F0] outline-none ${
                  invalidSangria
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[#2D2A26] focus:border-[#B88A44]'
                }`}
              />
            </div>
          </div>

          <div
            className={`rounded-lg border p-3 ${
              invalidSangria
                ? 'border-red-500/40 bg-red-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider text-stone-300">
              (=) Fundo de Troco para Amanhã
            </span>
            <p
              className={`mt-1 text-lg font-bold ${
                invalidSangria ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {formatCurrency(trocoNextDay)}
            </p>
          </div>
        </div>
      </div>

      {/* Justificativa Obrigatória se houver divergência != 0 */}
      {hasDivergence && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-amber-300">
              Justificativa Obrigatória da Divergência ({formatCurrency(totalDifference)})
            </span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            Para habilitar o fechamento do turno com diferença nos valores contados, preencha o motivo abaixo:
          </p>
          <textarea
            rows={2}
            maxLength={300}
            required
            placeholder="Descreva o motivo da sobra ou falta de caixa..."
            value={observations}
            onChange={(e) => onObservationsChange?.(e.target.value)}
            className="w-full rounded-lg border border-amber-500/40 bg-[#0E0C0A] px-3 py-2 text-xs text-[#F5F5F0] outline-none focus:border-[#B88A44] resize-none"
          />
        </div>
      )}
    </div>
  );
};

export default PhysicalConference;
