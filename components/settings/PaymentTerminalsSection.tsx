import React, { useState } from 'react';
import { usePaymentTerminals } from '../../src/hooks/usePaymentTerminals';
import type { TerminalAcquirer, TerminalRateMethod } from '../../domain/paymentTerminal/types';

const POPULAR_ACQUIRERS: TerminalAcquirer[] = [
  'Stone',
  'PagBank',
  'InfinitePay',
  'Cielo',
  'Rede',
  'Mercado Pago',
  'Ton',
  'SafraPay',
  'Outro',
];

export const PaymentTerminalsSection: React.FC = () => {
  const {
    terminals,
    loading,
    error,
    createTerminal,
    setDefaultTerminal,
    deleteTerminal,
  } = usePaymentTerminals();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [acquirer, setAcquirer] = useState<TerminalAcquirer>('Stone');
  const [isDefault, setIsDefault] = useState(terminals.length === 0);

  // Taxas padrão do formulário
  const [debitRate, setDebitRate] = useState('1.25');
  const [debitDays, setDebitDays] = useState('1');

  const [creditSightRate, setCreditSightRate] = useState('2.89');
  const [creditSightDays, setCreditSightDays] = useState('30');

  const [creditInstallmentRate, setCreditInstallmentRate] = useState('4.49');
  const [creditInstallmentDays, setCreditInstallmentDays] = useState('30');

  const handleOpenModal = () => {
    setName('');
    setAcquirer('Stone');
    setIsDefault(terminals.length === 0);
    setDebitRate('1.25');
    setDebitDays('1');
    setCreditSightRate('2.89');
    setCreditSightDays('30');
    setCreditInstallmentRate('4.49');
    setCreditInstallmentDays('30');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Informe o nome da maquininha.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await createTerminal({
        name: name.trim(),
        acquirer,
        is_default: isDefault,
        rates: [
          {
            method: 'debit',
            installments_min: 1,
            installments_max: 1,
            rate_percentage: parseFloat(debitRate.replace(',', '.')) || 0,
            settlement_days: parseInt(debitDays, 10) || 1,
          },
          {
            method: 'credit_sight',
            installments_min: 1,
            installments_max: 1,
            rate_percentage: parseFloat(creditSightRate.replace(',', '.')) || 0,
            settlement_days: parseInt(creditSightDays, 10) || 30,
          },
          {
            method: 'credit_installment',
            installments_min: 2,
            installments_max: 12,
            rate_percentage: parseFloat(creditInstallmentRate.replace(',', '.')) || 0,
            settlement_days: parseInt(creditInstallmentDays, 10) || 30,
          },
        ],
      });

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar maquininha.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodRate = (terminalRates: any[], method: TerminalRateMethod) => {
    return terminalRates.find((r) => r.method === method);
  };

  return (
    <section className="bg-white dark:bg-card-dark p-8 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden relative">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">point_of_sale</span>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              Maquininhas de Cartão e Taxas (PDV Avançado)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cadastre suas maquininhas e taxas para calcular o valor líquido real e prever o recebimento no banco.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenModal}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Adicionar Maquininha
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : terminals.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 dark:border-border-dark rounded-xl bg-slate-50/50 dark:bg-white/[0.02]">
          <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">credit_card_off</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma maquininha cadastrada</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Ao cadastrar suas maquininhas, o checkout calcula automaticamente o desconto de operadora e registra o líquido previsto de cada venda.
          </p>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Cadastrar Primeira Maquininha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map((terminal) => {
            const debit = getMethodRate(terminal.rates, 'debit');
            const creditSight = getMethodRate(terminal.rates, 'credit_sight');
            const creditInst = getMethodRate(terminal.rates, 'credit_installment');

            return (
              <div
                key={terminal.id}
                className={`p-5 rounded-xl border transition-all ${
                  terminal.is_default
                    ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-500/5'
                    : 'border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        {terminal.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {terminal.acquirer}
                      </span>
                      {terminal.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                          Padrão PDV
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!terminal.is_default && (
                      <button
                        onClick={() => setDefaultTerminal(terminal.id)}
                        title="Tornar maquininha padrão no checkout"
                        className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">star</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Deseja remover a maquininha "${terminal.name}"?`)) {
                          deleteTerminal(terminal.id);
                        }
                      }}
                      title="Excluir maquininha"
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-white/5 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Débito</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {debit ? `${debit.rate_percentage}%` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {debit ? `D+${debit.settlement_days}` : ''}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Crédito à vista</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {creditSight ? `${creditSight.rate_percentage}%` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {creditSight ? `D+${creditSight.settlement_days}` : ''}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Parcelado</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {creditInst ? `${creditInst.rate_percentage}%` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {creditInst ? `D+${creditInst.settlement_days}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Adicionar Maquininha */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-card-dark rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-border-dark relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">point_of_sale</span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Nova Maquininha de Cartão
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nome de Identificação *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Stone Balcão 1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Operadora / Adquirente *</label>
                  <select
                    value={acquirer}
                    onChange={(e) => setAcquirer(e.target.value as TerminalAcquirer)}
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm outline-none"
                  >
                    {POPULAR_ACQUIRERS.map((acq) => (
                      <option key={acq} value={acq}>
                        {acq}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-3">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Taxas Contratadas & Prazos
                </h5>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">Débito (%)</label>
                    <input
                      type="text"
                      placeholder="1.25"
                      value={debitRate}
                      onChange={(e) => setDebitRate(e.target.value)}
                      className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg py-1.5 px-2 text-sm text-center font-bold focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block text-center">Prazo D+1</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">Crédito à Vista (%)</label>
                    <input
                      type="text"
                      placeholder="2.89"
                      value={creditSightRate}
                      onChange={(e) => setCreditSightRate(e.target.value)}
                      className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg py-1.5 px-2 text-sm text-center font-bold focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block text-center">Prazo D+30</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">Crédito Parcelado (%)</label>
                    <input
                      type="text"
                      placeholder="4.49"
                      value={creditInstallmentRate}
                      onChange={(e) => setCreditInstallmentRate(e.target.value)}
                      className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg py-1.5 px-2 text-sm text-center font-bold focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block text-center">Prazo D+30</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_default_check"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="size-4 text-primary rounded border-slate-300 focus:ring-primary"
                />
                <label htmlFor="is_default_check" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Definir esta maquininha como padrão no Checkout (seleção automática em 1 clique)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Cadastrar Maquininha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
