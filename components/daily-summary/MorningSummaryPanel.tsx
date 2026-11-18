import React from 'react';
import {
  CalendarCheck,
  TrendingUp,
  Percent,
  Crown,
  Users,
  BellRing,
} from 'lucide-react';
import type { MorningSummaryData } from '../../src/types/dailySummary';
import { formatCurrency } from '../../shared/format/currency';

interface MorningSummaryPanelProps {
  morning: MorningSummaryData;
}

export const MorningSummaryPanel: React.FC<MorningSummaryPanelProps> = ({ morning }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Agendados</span>
            <CalendarCheck className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
            {morning.scheduledCount}
          </div>
          <div className="text-[11px] text-emerald-600 font-mono mt-1">
            {morning.scheduledDeltaLabel}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Receita Prevista</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
            {formatCurrency(morning.projectedRevenue)}
          </div>
          <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
            {morning.projectedBreakdownLabel}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Taxa Ocupação</span>
            <Percent className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-[#D4A95E] tabular-nums">
            {morning.occupancyRate}%
          </div>
          <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
            {morning.freeSlotsLabel}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
            <span>Clube dos Chefes</span>
            <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
          </div>
          <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
            {morning.clubSubscribersCount}
          </div>
          <div className="text-[11px] text-amber-700 dark:text-[#D4A95E] font-mono mt-1">
            Assinantes na agenda
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
              <span>Ocupação & Previsão por Profissional</span>
            </h2>
            <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
              Distribuição da agenda e janelas disponíveis para encaixe rápido
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E]">
            {morning.staffOccupancy.length} cadeiras ativas
          </span>
        </div>

        <div className="space-y-4">
          {morning.staffOccupancy.length === 0 ? (
            <div className="p-6 rounded-xl bg-stone-50 dark:bg-[#171411] border border-dashed border-[#E8DFC9] dark:border-[#29241D] text-center text-xs text-[#6B6252] dark:text-[#A69D8E]">
              Nenhum profissional ativo na agenda para esta data.
            </div>
          ) : (
            morning.staffOccupancy.map((staff) => (
              <div
                key={staff.staffId}
                className="p-4 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-[#D4A95E] font-bold text-xs">
                      {staff.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6]">{staff.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-[#D4A95E] border border-amber-500/30">
                          {staff.roleBadge}
                        </span>
                      </div>
                      <span className="text-xs text-[#6B6252] dark:text-[#A69D8E]">{staff.timeRangeDescription}</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">{staff.scheduledCount} agendados</span>
                    <span className="text-xs text-stone-400 mx-1">•</span>
                    <span className="text-sm font-semibold text-amber-700 dark:text-[#D4A95E]">
                      {formatCurrency(staff.projectedRevenue)} prev.
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-[#0B0A09] overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${
                      staff.occupancyPercentage >= 85
                        ? 'bg-emerald-500'
                        : staff.occupancyPercentage >= 70
                        ? 'bg-amber-500'
                        : 'bg-amber-600'
                    }`}
                    style={{ width: `${staff.occupancyPercentage}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {staff.occupancyPercentage}% Ocupação
                  </span>
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">
                    Janelas livres: <strong className="font-mono text-[#191611] dark:text-[#F4EFE6]">{staff.freeWindows}</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
              <span>Clube dos Chefes ({morning.clubClients.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-amber-700 dark:text-[#D4A95E] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              Consumo Crédito
            </span>
          </div>
          {morning.clubClients.length === 0 ? (
            <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] py-4 text-center">
              Nenhum assinante do Clube agendado para esta data.
            </p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {morning.clubClients.map((cc, idx) => (
                <li key={idx} className="flex items-center justify-between py-1.5 border-b border-stone-200 dark:border-[#29241D]/70 last:border-b-0">
                  <div>
                    <span className="font-medium text-[#191611] dark:text-[#F4EFE6] block">
                      {cc.time} • {cc.clientName}
                    </span>
                    <span className="text-[#6B6252] dark:text-stone-400">{cc.serviceDescription}</span>
                  </div>
                  <span
                    className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                      cc.status === 'Renova Hoje'
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {cc.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500" />
              <span>Vencimentos Financeiros ({morning.financialAlerts.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              Atenção Caixa
            </span>
          </div>
          {morning.financialAlerts.length === 0 ? (
            <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] py-4 text-center">
              Nenhum vencimento financeiro registrado para esta data.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              {morning.financialAlerts.map((fa) => (
                <div
                  key={fa.id}
                  className={`p-3 rounded-xl bg-stone-50 dark:bg-[#171411] border flex items-center justify-between ${
                    fa.amount < 0
                      ? 'border-red-500/30 text-red-600 dark:text-red-400'
                      : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-[#191611] dark:text-[#F4EFE6] block">{fa.title}</span>
                    <span className="text-[#6B6252] dark:text-[#A69D8E]">{fa.subtitle}</span>
                  </div>
                  <span className="font-mono font-bold tabular-nums">
                    {fa.amount < 0 ? `- ${formatCurrency(Math.abs(fa.amount))}` : `+ ${formatCurrency(fa.amount)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
