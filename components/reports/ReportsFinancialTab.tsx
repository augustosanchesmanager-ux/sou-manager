import React, { useMemo } from 'react';
import {
  Scissors,
  Percent,
  CheckCircle2,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  AlertCircle,
} from 'lucide-react';
import type {
  AllocatedComandaItemDetail,
  BarberAdvanceRecord,
  FinancialTitleRow,
} from '../../src/modules/reports/reportsDataService';
import { roundCurrency } from '../../src/utils/financial/discountAllocation';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d?: string | null) => {
  if (!d) return '-';
  if (d.length === 10) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

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

export type FinancialSubTab = 'commissions' | 'receivables' | 'payables';

interface ReportsFinancialTabProps {
  subTab: FinancialSubTab;
  onChangeSubTab: (tab: FinancialSubTab) => void;
  allocatedItems: AllocatedComandaItemDetail[];
  advances: BarberAdvanceRecord[];
  receivables: FinancialTitleRow[];
  payables: FinancialTitleRow[];
  loading: boolean;
  selectedBarberId: string;
  onSelectBarberId: (barberId: string) => void;
  availableBarbers: Array<{ id: string; name: string }>;
  dateFieldMode: 'due_date' | 'paid_at';
  onChangeDateFieldMode: (mode: 'due_date' | 'paid_at') => void;
}

export const ReportsFinancialTab: React.FC<ReportsFinancialTabProps> = ({
  subTab,
  onChangeSubTab,
  allocatedItems,
  advances,
  receivables,
  payables,
  loading,
  selectedBarberId,
  onSelectBarberId,
  availableBarbers,
  dateFieldMode,
  onChangeDateFieldMode,
}) => {
  // ─── Extrato de Comissões ───────────────────────────────────────────
  const filteredCommissionItems = useMemo(() => {
    return allocatedItems.filter((item) => {
      if (selectedBarberId !== 'all' && item.barber_id !== selectedBarberId) {
        return false;
      }
      return true;
    });
  }, [allocatedItems, selectedBarberId]);

  const filteredAdvances = useMemo(() => {
    return advances.filter((adv) => {
      if (selectedBarberId !== 'all' && adv.staffId !== selectedBarberId) {
        return false;
      }
      return true;
    });
  }, [advances, selectedBarberId]);

  const commissionMetrics = useMemo(() => {
    const grossProduction = roundCurrency(
      filteredCommissionItems.reduce((s, it) => s + it.catalog_price, 0)
    );
    const totalDiscounts = roundCurrency(
      filteredCommissionItems.reduce((s, it) => s + it.total_discount, 0)
    );
    const appliedBase = roundCurrency(
      filteredCommissionItems.reduce((s, it) => s + it.applied_amount, 0)
    );
    const totalCommission = roundCurrency(
      filteredCommissionItems.reduce((s, it) => s + it.commission_amount, 0)
    );
    const totalAdvances = roundCurrency(
      filteredAdvances.reduce((s, adv) => s + adv.amount, 0)
    );
    const netToPay = roundCurrency(Math.max(0, totalCommission - totalAdvances));

    return {
      grossProduction,
      totalDiscounts,
      appliedBase,
      totalCommission,
      totalAdvances,
      netToPay,
    };
  }, [filteredCommissionItems, filteredAdvances]);

  // ─── Contas a Receber & Pagar ───────────────────────────────────────
  const titlesMetrics = useMemo(() => {
    const recPaid = roundCurrency(
      receivables.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
    );
    const recPending = roundCurrency(
      receivables.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.amount, 0)
    );
    const recTotal = roundCurrency(recPaid + recPending);

    const payPaid = roundCurrency(
      payables.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
    );
    const payPending = roundCurrency(
      payables.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)
    );
    const payTotal = roundCurrency(payPaid + payPending);

    const overdueTotal = roundCurrency(
      [...receivables, ...payables]
        .filter((t) => t.status === 'overdue')
        .reduce((s, t) => s + t.amount, 0)
    );

    const projectedBalance = roundCurrency(recTotal - payTotal);

    return {
      recPaid,
      recPending,
      recTotal,
      payPaid,
      payPending,
      payTotal,
      overdueTotal,
      projectedBalance,
    };
  }, [receivables, payables]);

  const renderStatusBadge = (status: FinancialTitleRow['status']) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Liquidado
        </span>
      );
    }
    if (status === 'overdue') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          Em Atraso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Pendente
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-seletor em Pills */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-xl bg-[#141210] border border-[#2D2A26] p-1">
          <button
            type="button"
            onClick={() => onChangeSubTab('commissions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'commissions'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Extrato de Comissões
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab('receivables')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'receivables'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Contas a Receber ({receivables.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab('payables')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'payables'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Contas a Pagar ({payables.length})
          </button>
        </div>

        {/* Filtro contextual */}
        {subTab === 'commissions' ? (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Barbeiro:
            </label>
            <select
              value={selectedBarberId}
              onChange={(e) => onSelectBarberId(e.target.value)}
              className="bg-[#141210] border border-[#2D2A26] rounded-lg px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none min-w-[200px]"
            >
              <option value="all">Todos os barbeiros</option>
              {availableBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Filtrar por data de:
            </label>
            <select
              value={dateFieldMode}
              onChange={(e) => onChangeDateFieldMode(e.target.value as 'due_date' | 'paid_at')}
              className="bg-[#141210] border border-[#2D2A26] rounded-lg px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none"
            >
              <option value="due_date">Vencimento</option>
              <option value="paid_at">Data de Baixa / Pagamento</option>
            </select>
          </div>
        )}
      </div>

      {/* CONTEÚDO SUB-ABA 1: EXTRATO DE COMISSÕES */}
      {subTab === 'commissions' && (
        <div className="space-y-6">
          {/* 4 Cards Executivos do Extrato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Valor de Tabela (Bruto)
                </span>
                <Scissors className="w-4 h-4 text-stone-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
                {fmtBRL(commissionMetrics.grossProduction)}
              </div>
              <div className="mt-1 text-xs text-stone-500">Produção cheia antes de descontos</div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Descontos Rateados
                </span>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3 text-2xl font-bold text-amber-400">
                - {fmtBRL(commissionMetrics.totalDiscounts)}
              </div>
              <div className="mt-1 text-xs text-stone-500">Diretos + Globais da comanda</div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Valor Aplicado (Base Real)
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#B88A44]" />
              </div>
              <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
                {fmtBRL(commissionMetrics.appliedBase)}
              </div>
              <div className="mt-1 text-xs text-stone-500">Base exata de incidência da comissão</div>
            </div>

            <div className="bg-[#141210] border border-[#B88A44]/50 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B88A44]">
                  Comissão & Líquido
                </span>
                <Wallet className="w-4 h-4 text-[#B88A44]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#F5F5F0]">
                {fmtBRL(commissionMetrics.totalCommission)}
              </div>
              <div className="mt-2 pt-2 border-t border-[#2D2A26] flex flex-col gap-0.5 text-[11px]">
                <div className="flex justify-between text-stone-400">
                  <span>Vales / Adiantamentos:</span>
                  <span className="text-amber-400">- {fmtBRL(commissionMetrics.totalAdvances)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-400">
                  <span>Líquido a Repassar:</span>
                  <span>{fmtBRL(commissionMetrics.netToPay)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela Analítica de Comissões (10 Colunas) */}
          <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2D2A26] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#F5F5F0]">
                  Extrato Analítico de Comissões (Rateio Proporcional)
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Comissões calculadas estritamente sobre o Valor Aplicado após rateio de descontos. PDF exporta em formato Paisagem.
                </p>
              </div>
              <span className="text-xs text-stone-400">{filteredCommissionItems.length} item(ns)</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-stone-400">Calculando extrato de comissões...</div>
            ) : filteredCommissionItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                Nenhum item faturado encontrado para o profissional/período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                      <th className="py-3 px-3 font-semibold">Data / Baixa</th>
                      <th className="py-3 px-3 font-semibold">Comanda</th>
                      <th className="py-3 px-3 font-semibold">Cliente</th>
                      <th className="py-3 px-3 font-semibold">Serviço / Produto</th>
                      <th className="py-3 px-3 font-semibold">Meio Pgto</th>
                      <th className="py-3 px-3 font-semibold text-right">Vl. Tabela</th>
                      <th className="py-3 px-3 font-semibold text-right">Desconto</th>
                      <th className="py-3 px-3 font-semibold text-right">Vl. Aplicado</th>
                      <th className="py-3 px-3 font-semibold text-right">% Comis.</th>
                      <th className="py-3 px-3 font-semibold text-right">Comissão (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
                    {filteredCommissionItems.map((it) => (
                      <tr key={`${it.comanda_id}-${it.id}`} className="hover:bg-[#1C1916] transition-colors">
                        <td className="py-2.5 px-3 text-stone-300 whitespace-nowrap">
                          {fmtDateTime(it.closedAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#B88A44]">{it.comandaShortId}</td>
                        <td className="py-2.5 px-3 font-medium truncate max-w-[140px]">
                          {it.clientName}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#F5F5F0]">{it.item_name}</div>
                          {selectedBarberId === 'all' && (
                            <div className="text-[10px] text-stone-400">{it.barber_name}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-stone-300">{it.paymentMethodLabel}</td>
                        <td className="py-2.5 px-3 text-right text-stone-300">
                          {fmtBRL(it.catalog_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-400">
                          {it.total_discount > 0 ? `- ${fmtBRL(it.total_discount)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#F5F5F0]">
                          {fmtBRL(it.applied_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-stone-400">
                          {it.commission_rate}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#B88A44]">
                          {fmtBRL(it.commission_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO SUB-ABAS 2 e 3: CONTAS A RECEBER & CONTAS A PAGAR */}
      {(subTab === 'receivables' || subTab === 'payables') && (
        <div className="space-y-6">
          {/* 4 Cards Executivos Financeiros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Total a Receber
                </span>
                <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
                {fmtBRL(titlesMetrics.recTotal)}
              </div>
              <div className="mt-1 text-xs text-stone-400">
                Liquidado: {fmtBRL(titlesMetrics.recPaid)} | Pendente: {fmtBRL(titlesMetrics.recPending)}
              </div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Total a Pagar
                </span>
                <ArrowUpCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
                {fmtBRL(titlesMetrics.payTotal)}
              </div>
              <div className="mt-1 text-xs text-stone-400">
                Liquidado: {fmtBRL(titlesMetrics.payPaid)} | Pendente: {fmtBRL(titlesMetrics.payPending)}
              </div>
            </div>

            <div className="bg-[#141210] border border-[#B88A44]/50 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B88A44]">
                  Saldo Previsto (Receber - Pagar)
                </span>
                <Scale className="w-4 h-4 text-[#B88A44]" />
              </div>
              <div
                className={`mt-3 text-2xl font-bold ${
                  titlesMetrics.projectedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {fmtBRL(titlesMetrics.projectedBalance)}
              </div>
              <div className="mt-1 text-xs text-stone-400">Resultado líquido dos títulos</div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Inadimplência / Vencidos
                </span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-red-400">
                {fmtBRL(titlesMetrics.overdueTotal)}
              </div>
              <div className="mt-1 text-xs text-stone-500">Títulos com vencimento expirado</div>
            </div>
          </div>

          {/* Tabela de Títulos */}
          {(() => {
            const activeRows = subTab === 'receivables' ? receivables : payables;
            const titleLabel =
              subTab === 'receivables'
                ? 'Contas a Receber (Assinaturas Clube & Fiados)'
                : 'Contas a Pagar (Despesas & Obrigações)';

            return (
              <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2D2A26] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#F5F5F0]">{titleLabel}</h3>
                  <span className="text-xs text-stone-400">{activeRows.length} título(s)</span>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-xs text-stone-400">Carregando títulos...</div>
                ) : activeRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-400">
                    Nenhum título encontrado para o período selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                          <th className="py-3 px-4 font-semibold">Vencimento</th>
                          <th className="py-3 px-4 font-semibold">Tipo</th>
                          <th className="py-3 px-4 font-semibold">Descrição / Origem</th>
                          <th className="py-3 px-4 font-semibold">Cliente / Fornecedor</th>
                          <th className="py-3 px-4 font-semibold">Categoria</th>
                          <th className="py-3 px-4 font-semibold text-right">Valor</th>
                          <th className="py-3 px-4 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
                        {activeRows.map((row) => (
                          <tr key={row.id} className="hover:bg-[#1C1916] transition-colors">
                            <td className="py-3 px-4 text-stone-300 whitespace-nowrap">
                              {fmtDate(row.dueDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-semibold uppercase ${
                                  row.type === 'receivable' ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {row.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium">{row.description}</td>
                            <td className="py-3 px-4 text-stone-300">{row.partyName}</td>
                            <td className="py-3 px-4 text-stone-400">{row.category}</td>
                            <td className="py-3 px-4 text-right font-semibold">
                              {fmtBRL(row.amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {renderStatusBadge(row.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
