import React from 'react';
import {
  Banknote,
  Crown,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  ExternalLink,
  Award,
} from 'lucide-react';
import type { EveningSummaryData } from '../../src/types/dailySummary';
import { formatCurrency } from '../../shared/format/currency';

interface EveningSummaryPanelProps {
  evening: EveningSummaryData;
  onInspectComandas: () => void;
}

export const EveningSummaryPanel: React.FC<EveningSummaryPanelProps> = ({
  evening,
  onInspectComandas,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-emerald-500/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Caixa Realizado</span>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
            {formatCurrency(evening.realizedRevenue)}
          </div>
          <div className="text-[11px] text-emerald-600 font-mono mt-1">
            {evening.paymentBreakdownLabel}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Consumo Clube</span>
            <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-[#D4A95E] tabular-nums">
            {evening.clubCreditsCount} créd.
          </div>
          <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
            R$ 0 impacto caixa
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Concluídos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
            {evening.completedCount}{' '}
            <span className="text-sm font-normal text-[#6B6252] dark:text-stone-400">
              / {evening.totalAppointments}
            </span>
          </div>
          <div className="text-[11px] text-red-500 font-mono mt-1">
            {evening.cancelledCount} Cancelado(s) • {evening.openCount} Aberto(s)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Ticket Médio</span>
            <Receipt className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
            {formatCurrency(evening.ticketMedio)}
          </div>
          <div className="text-[11px] text-emerald-600 font-mono mt-1">
            {evening.ticketMedioDeltaLabel}
          </div>
        </div>
      </div>

      {evening.openComandas.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-emerald-500/40 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6]">
                Nenhuma comanda em aberto nesta data
              </h3>
              <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                Todas as comandas registradas foram devidamente baixadas no caixa.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#12100E] border-2 border-amber-500/70 p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-[#29241D]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#191611] dark:text-[#F4EFE6]">
                    Alerta de Auditoria: {evening.openComandas.length} Comanda(s) em aberto
                  </h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 tabular-nums">
                    {formatCurrency(evening.openComandasTotal)} pendentes
                  </span>
                </div>
                <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] mt-0.5">
                  Estes atendimentos ainda não tiveram o recebimento baixado no PDV.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onInspectComandas}
              className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Inspecionar Comandas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {evening.openComandas.map((cmd) => (
              <div
                key={cmd.id}
                className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {cmd.comandaNumber}
                    </span>
                    <span className="text-xs text-[#191611] dark:text-[#F4EFE6] font-medium">• {cmd.clientName}</span>
                  </div>
                  <span className="text-xs text-[#6B6252] dark:text-[#A69D8E] block mt-0.5">
                    {cmd.serviceDescription} • Prof:{' '}
                    <strong className="text-[#191611] dark:text-[#F4EFE6]">{cmd.staffName}</strong>
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCurrency(cmd.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
              <span>Fechamento & Comissões por Profissional</span>
            </h2>
            <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
              Separação entre serviços pagos em caixa e atendimentos via Clube dos Chefes
            </p>
          </div>
        </div>

        {evening.staffClosing.length === 0 ? (
          <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] py-6 text-center rounded-xl bg-stone-50 dark:bg-[#171411] border border-dashed border-[#E8DFC9] dark:border-[#29241D]">
            Nenhuma movimentação de equipe registrada para esta data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-[#29241D] text-[11px] font-mono uppercase text-[#6B6252] dark:text-stone-400">
                  <th className="py-2.5 pr-3">Profissional</th>
                  <th className="py-2.5 px-3 text-center">Atend.</th>
                  <th className="py-2.5 px-3 text-right">Faturado Caixa</th>
                  <th className="py-2.5 px-3 text-center">Clube Chefes</th>
                  <th className="py-2.5 pl-3 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-[#29241D]/70 text-xs sm:text-sm tabular-nums">
                {evening.staffClosing.map((staff) => (
                  <tr key={staff.staffId}>
                    <td className="py-3.5 pr-3">
                      <span className="font-semibold text-[#191611] dark:text-[#F4EFE6] block">{staff.name}</span>
                      <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">{staff.roleDescription}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-[#191611] dark:text-[#F4EFE6]">
                      {staff.completedCount} concl.
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-[#191611] dark:text-[#F4EFE6]">
                      {formatCurrency(staff.cashRevenue)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-amber-700 dark:text-[#D4A95E]">
                      {staff.clubCredits} créd.
                    </td>
                    <td className="py-3.5 pl-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(staff.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 dark:border-[#29241D] bg-stone-100/60 dark:bg-[#171411]/60 font-mono text-xs">
                  <td className="py-3 px-3 font-semibold text-[#191611] dark:text-[#F4EFE6]">TOTAL CONSOLIDADO</td>
                  <td className="py-3 px-3 text-center font-bold text-[#191611] dark:text-[#F4EFE6]">
                    {evening.completedCount} concl.
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[#191611] dark:text-[#F4EFE6]">
                    {formatCurrency(evening.totalCashRevenue)}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-amber-700 dark:text-[#D4A95E]">
                    {evening.totalClubCredits} créd.
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(evening.totalCommissions)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
