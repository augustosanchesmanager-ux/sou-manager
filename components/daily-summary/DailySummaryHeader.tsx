import React from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Copy,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import type { AutomationSettings, ShiftType } from '../../src/types/dailySummary';

interface DailySummaryHeaderProps {
  tenantName: string;
  formattedDate: string;
  selectedDate: string;
  todayIso: string;
  yesterdayIso: string;
  tomorrowIso: string;
  activeShift: ShiftType;
  settings: AutomationSettings;
  openComandasCount: number;
  headerCopyLabel: string;
  canCopy: boolean;
  loading: boolean;
  onSelectDate: (date: string) => void;
  onShiftDate: (deltaDays: number) => void;
  onSelectShift: (shift: ShiftType) => void;
  onCopy: () => void;
  onFocusAutomation: () => void;
  onRefresh: () => void;
}

export const DailySummaryHeader: React.FC<DailySummaryHeaderProps> = ({
  tenantName,
  formattedDate,
  selectedDate,
  todayIso,
  yesterdayIso,
  tomorrowIso,
  activeShift,
  settings,
  openComandasCount,
  headerCopyLabel,
  canCopy,
  loading,
  onSelectDate,
  onShiftDate,
  onSelectShift,
  onCopy,
  onFocusAutomation,
  onRefresh,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DFC9] dark:border-[#29241D] bg-[#FAF6EE]/95 dark:bg-[#0B0A09]/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-[#D4A95E] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-[#D4A95E] font-semibold">
                  {tenantName}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E]"
                  title="Data calculada no fuso horário de Brasília (America/Sao_Paulo)"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  America/Sao_Paulo • UTC-3
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h1 className="text-base sm:text-lg font-bold text-[#191611] dark:text-[#F4EFE6]">
                  Central de Resumo Diário & Automações
                </h1>
                <span className="text-stone-400 hidden sm:inline">•</span>
                <span className="text-xs sm:text-sm text-[#6B6252] dark:text-[#A69D8E] flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-[#D4A95E]" />
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
            <div
              className="inline-flex p-1 rounded-xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D]"
              role="tablist"
              aria-label="Turno do resumo"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeShift === 'morning'}
                onClick={() => onSelectShift('morning')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeShift === 'morning'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4 stroke-[2.2]" />
                <span>Briefing da Manhã</span>
                <span className="text-[11px] font-mono opacity-80 hidden md:inline">({settings.morningTime})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeShift === 'evening'}
                onClick={() => onSelectShift('evening')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  activeShift === 'evening'
                    ? 'bg-amber-500 text-stone-950 shadow-sm font-semibold'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Fechamento da Noite</span>
                <span className="text-[11px] font-mono opacity-75 hidden md:inline">({settings.eveningTime})</span>
                {openComandasCount > 0 && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                    title={`${openComandasCount} comandas abertas detectadas`}
                  />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onCopy}
                disabled={!canCopy}
                className="h-10 px-4 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-amber-500/50 hover:border-amber-500 text-amber-700 dark:text-[#D4A95E] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Copy className="w-4 h-4" />
                <span>{headerCopyLabel}</span>
              </button>

              <button
                type="button"
                onClick={onFocusAutomation}
                className="h-10 px-4 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#191611] dark:text-[#F4EFE6] font-medium text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                <span className="hidden sm:inline">Configurar Automação</span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                title="Atualizar dados do resumo diário"
                aria-label="Atualizar dados do resumo diário"
                className="h-10 w-10 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E] flex items-center justify-center transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8DFC9]/70 dark:border-[#29241D]/70">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShiftDate(-1)}
              title="Dia anterior"
              aria-label="Dia anterior"
              className="h-8 w-8 rounded-lg bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-center text-[#6B6252] dark:text-[#A69D8E] cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              aria-label="Selecionar data do resumo"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-xs font-mono text-[#191611] dark:text-[#F4EFE6] focus:outline-none focus:border-amber-500"
            />

            <button
              type="button"
              onClick={() => onShiftDate(1)}
              title="Próximo dia"
              aria-label="Próximo dia"
              className="h-8 w-8 rounded-lg bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-center text-[#6B6252] dark:text-[#A69D8E] cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { label: 'Ontem', value: yesterdayIso },
              { label: 'Hoje', value: todayIso },
              { label: 'Amanhã', value: tomorrowIso },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onSelectDate(preset.value)}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  selectedDate === preset.value
                    ? 'bg-amber-500 text-stone-950 border-amber-500 font-semibold'
                    : 'bg-white dark:bg-[#12100E] text-[#6B6252] dark:text-[#A69D8E] border-[#E8DFC9] dark:border-[#29241D] hover:text-[#191611] dark:hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
