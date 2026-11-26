import React, { useMemo } from 'react';
import { DollarSign, Percent, TrendingUp, Receipt, CreditCard, Banknote, Smartphone, Award } from 'lucide-react';
import type { PaidComandaDetail, PaymentCategoryKey } from '../../src/modules/reports/reportsDataService';
import { roundCurrency } from '../../src/utils/financial/discountAllocation';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

interface ReportsSalesTabProps {
  comandas: PaidComandaDetail[];
  loading: boolean;
  selectedStaff: string;
  onSelectStaff: (staff: string) => void;
  selectedPayment: 'all' | PaymentCategoryKey;
  onSelectPayment: (method: 'all' | PaymentCategoryKey) => void;
  availableStaff: string[];
}

export const ReportsSalesTab: React.FC<ReportsSalesTabProps> = ({
  comandas,
  loading,
  selectedStaff,
  onSelectStaff,
  selectedPayment,
  onSelectPayment,
  availableStaff,
}) => {
  const filteredComandas = useMemo(() => {
    return comandas.filter((c) => {
      if (selectedStaff !== 'all' && !c.staffNames.includes(selectedStaff)) {
        return false;
      }
      if (selectedPayment !== 'all') {
        if (selectedPayment === 'club' && c.paymentBreakdown.club <= 0 && c.primaryPaymentCategory !== 'club') {
          return false;
        }
        if (selectedPayment !== 'club' && c.paymentBreakdown[selectedPayment] <= 0 && c.primaryPaymentCategory !== selectedPayment) {
          return false;
        }
      }
      return true;
    });
  }, [comandas, selectedStaff, selectedPayment]);

  const metrics = useMemo(() => {
    const grossTotal = roundCurrency(filteredComandas.reduce((s, c) => s + c.catalogTotal, 0));
    const discountTotal = roundCurrency(filteredComandas.reduce((s, c) => s + c.discountTotal, 0));
    const netTotal = roundCurrency(filteredComandas.reduce((s, c) => s + c.appliedTotal, 0));
    const avgTicket = filteredComandas.length > 0 ? roundCurrency(netTotal / filteredComandas.length) : 0;

    const payments = {
      pix: roundCurrency(filteredComandas.reduce((s, c) => s + c.paymentBreakdown.pix, 0)),
      credit: roundCurrency(filteredComandas.reduce((s, c) => s + c.paymentBreakdown.credit, 0)),
      debit: roundCurrency(filteredComandas.reduce((s, c) => s + c.paymentBreakdown.debit, 0)),
      cash: roundCurrency(filteredComandas.reduce((s, c) => s + c.paymentBreakdown.cash, 0)),
      clubCount: filteredComandas.filter((c) => c.primaryPaymentCategory === 'club' || c.paymentBreakdown.club > 0).length,
    };

    return { grossTotal, discountTotal, netTotal, avgTicket, payments };
  }, [filteredComandas]);

  return (
    <div className="space-y-6">
      {/* Filtros da Aba Vendas */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-line rounded-xl p-4">
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
            Profissional / Barbeiro
          </label>
          <select
            value={selectedStaff}
            onChange={(e) => onSelectStaff(e.target.value)}
            className="bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os profissionais</option>
            {availableStaff.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
            Forma de Pagamento
          </label>
          <select
            value={selectedPayment}
            onChange={(e) => onSelectPayment(e.target.value as 'all' | PaymentCategoryKey)}
            className="bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">Todas as formas</option>
            <option value="pix">PIX</option>
            <option value="credit">Cartão de Crédito</option>
            <option value="debit">Cartão de Débito</option>
            <option value="cash">Dinheiro</option>
            <option value="club">Crédito Clube</option>
          </select>
        </div>

        <div className="ml-auto text-right">
          <span className="text-[11px] text-ink-soft">
            Exibindo exclusivamente comandas com ciclo financeiro concluído (<strong className="text-primary-dark dark:text-primary">pagas/fechadas</strong>).
          </span>
        </div>
      </div>

      {/* 4 Cards Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Faturamento Bruto (Tabela)
            </span>
            <DollarSign className="w-4 h-4 text-primary-dark dark:text-primary" />
          </div>
          <div className="mt-3 text-2xl font-bold text-ink">{fmtBRL(metrics.grossTotal)}</div>
          <div className="mt-1 text-xs text-ink-soft">Soma do preço cheio dos itens</div>
        </div>

        <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Descontos Concedidos
            </span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-400">- {fmtBRL(metrics.discountTotal)}</div>
          <div className="mt-1 text-xs text-ink-soft">Diretos + Globais rateados</div>
        </div>

        <div className="bg-card border border-primary/50 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-dark dark:text-primary">
              Faturamento Líquido (Aplicado)
            </span>
            <TrendingUp className="w-4 h-4 text-primary-dark dark:text-primary" />
          </div>
          <div className="mt-3 text-2xl font-bold text-ink">{fmtBRL(metrics.netTotal)}</div>
          <div className="mt-1 text-xs text-ink-soft">{filteredComandas.length} comandas faturadas</div>
        </div>

        <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Ticket Médio Real
            </span>
            <Receipt className="w-4 h-4 text-primary-dark dark:text-primary" />
          </div>
          <div className="mt-3 text-2xl font-bold text-ink">{fmtBRL(metrics.avgTicket)}</div>
          <div className="mt-1 text-xs text-ink-soft">Líquido / Comandas pagas</div>
        </div>
      </div>

      {/* Bloco de Resumo por Meio de Pagamento */}
      <div className="bg-card border border-line rounded-xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-dark dark:text-primary mb-3">
          Resumo por Meio de Pagamento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-cream border border-line rounded-lg p-3 flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase text-ink-soft">PIX</div>
              <div className="text-sm font-semibold text-ink">{fmtBRL(metrics.payments.pix)}</div>
            </div>
          </div>
          <div className="bg-cream border border-line rounded-lg p-3 flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-primary-dark dark:text-primary shrink-0" />
            <div>
              <div className="text-[10px] uppercase text-ink-soft">Cartão Crédito</div>
              <div className="text-sm font-semibold text-ink">{fmtBRL(metrics.payments.credit)}</div>
            </div>
          </div>
          <div className="bg-cream border border-line rounded-lg p-3 flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-ink shrink-0" />
            <div>
              <div className="text-[10px] uppercase text-ink-soft">Cartão Débito</div>
              <div className="text-sm font-semibold text-ink">{fmtBRL(metrics.payments.debit)}</div>
            </div>
          </div>
          <div className="bg-cream border border-line rounded-lg p-3 flex items-center gap-3">
            <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="text-[10px] uppercase text-ink-soft">Dinheiro</div>
              <div className="text-sm font-semibold text-ink">{fmtBRL(metrics.payments.cash)}</div>
            </div>
          </div>
          <div className="bg-cream border border-line rounded-lg p-3 flex items-center gap-3">
            <Award className="w-4 h-4 text-primary-dark dark:text-primary shrink-0" />
            <div>
              <div className="text-[10px] uppercase text-ink-soft">Créditos Clube</div>
              <div className="text-sm font-semibold text-ink">
                {metrics.payments.clubCount} {metrics.payments.clubCount === 1 ? 'atend.' : 'atends.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Comandas Faturadas */}
      <div className="bg-card border border-line rounded-xl overflow-hidden" data-testid="reports-comandas-table">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Comandas Faturadas no Período
          </h3>
          <span className="text-xs text-ink-soft">{filteredComandas.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-ink-soft">Carregando comandas faturadas...</div>
        ) : filteredComandas.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-soft">
            Nenhuma comanda paga encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-cream text-[10px] uppercase tracking-wider text-primary-dark dark:text-primary">
                  <th className="py-3 px-4 font-semibold">Nº Comanda</th>
                  <th className="py-3 px-4 font-semibold">Data / Fechamento</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Profissional</th>
                  <th className="py-3 px-4 font-semibold">Meio Pgto</th>
                  <th className="py-3 px-4 font-semibold text-right">Vl. Tabela</th>
                  <th className="py-3 px-4 font-semibold text-right">Desconto</th>
                  <th className="py-3 px-4 font-semibold text-right">Vl. Aplicado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-xs text-ink">
                {filteredComandas.map((c) => (
                  <tr key={c.id} className="hover:bg-cream/80 dark:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-primary-dark dark:text-primary">{c.shortId}</td>
                    <td className="py-3 px-4 text-ink">{fmtDateTime(c.closedAt)}</td>
                    <td className="py-3 px-4 font-medium">{c.clientName}</td>
                    <td className="py-3 px-4 text-ink">
                      {c.staffNames.length > 0 ? c.staffNames.join(', ') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.paymentMethodLabels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-cream border border-line text-ink"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-ink">{fmtBRL(c.catalogTotal)}</td>
                    <td className="py-3 px-4 text-right text-amber-400">
                      {c.discountTotal > 0 ? `- ${fmtBRL(c.discountTotal)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-ink">
                      {fmtBRL(c.appliedTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
