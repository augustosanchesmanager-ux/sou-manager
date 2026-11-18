import React from 'react';
import {
  MessageSquare,
  Mail,
  Bot,
  CheckCheck,
  Copy,
  Send,
} from 'lucide-react';
import type {
  AutomationSettings,
  DailySummaryPayload,
  PreviewChannel,
  ShiftType,
} from '../../src/types/dailySummary';
import { formatCurrency } from '../../shared/format/currency';

interface DispatchPreviewCardProps {
  tenantName: string;
  selectedDate: string;
  activeShift: ShiftType;
  activeChannel: PreviewChannel;
  settings: AutomationSettings;
  summaryData: DailySummaryPayload | null;
  whatsappText: string;
  onSelectChannel: (channel: PreviewChannel) => void;
  onCopy: () => void;
  onDispatch: () => void;
}

export const DispatchPreviewCard: React.FC<DispatchPreviewCardProps> = ({
  tenantName,
  selectedDate,
  activeShift,
  activeChannel,
  settings,
  summaryData,
  whatsappText,
  onSelectChannel,
  onCopy,
  onDispatch,
}) => {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] overflow-hidden shadow-xl">
      <div className="p-4 bg-stone-50 dark:bg-[#171411] border-b border-[#E8DFC9] dark:border-[#29241D] flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex p-1 rounded-xl bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D]"
          role="tablist"
          aria-label="Canal de visualização"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeChannel === 'WHATSAPP'}
            onClick={() => onSelectChannel('WHATSAPP')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'WHATSAPP'
                ? 'bg-amber-500 text-stone-950'
                : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Preview WhatsApp</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeChannel === 'EMAIL'}
            onClick={() => onSelectChannel('EMAIL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'EMAIL'
                ? 'bg-amber-500 text-stone-950 font-semibold'
                : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Preview E-mail Executivo</span>
          </button>
        </div>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-amber-700 dark:text-[#D4A95E]">
          {activeShift === 'morning' ? `Manhã (${settings.morningTime})` : `Noite (${settings.eveningTime})`}
        </span>
      </div>

      {activeChannel === 'WHATSAPP' && (
        <div className="p-4 bg-[#EFEAE2] dark:bg-[#0E0C0A]">
          <div className="rounded-2xl bg-white dark:bg-[#161310] border border-stone-300 dark:border-amber-500/30 p-4 shadow-lg relative">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-200 dark:border-[#29241D] text-[11px] font-mono text-amber-700 dark:text-[#D4A95E]">
              <span className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                SMG • Assistente Operacional
              </span>
              <span>{activeShift === 'morning' ? settings.morningTime : settings.eveningTime}</span>
            </div>

            <pre className="text-xs font-sans text-stone-900 dark:text-[#F4EFE6] whitespace-pre-wrap leading-relaxed select-all">
              {whatsappText || 'Carregando prévia da mensagem...'}
            </pre>

            <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-[#29241D]/60 flex items-center justify-between text-[11px] text-[#6B6252] dark:text-stone-400 font-mono">
              <span>Destinatários: Gestores de {tenantName}</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Pronto para envio
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onCopy}
              disabled={!whatsappText}
              className="flex-1 h-10 px-3.5 rounded-xl bg-white dark:bg-[#171411] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#191611] dark:text-[#F4EFE6] font-medium text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-amber-600 dark:text-[#D4A95E]" />
              <span>Copiar Texto Formatado</span>
            </button>

            <button
              type="button"
              onClick={onDispatch}
              disabled={!summaryData}
              className="flex-1 h-10 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Registrar Disparo</span>
            </button>
          </div>
        </div>
      )}

      {activeChannel === 'EMAIL' && (
        <div className="p-4 bg-stone-50 dark:bg-[#0B0A09]">
          <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-4 space-y-3">
            <div className="border-b border-stone-200 dark:border-[#29241D] pb-3 space-y-1 text-xs">
              <div className="flex items-center justify-between text-[#6B6252] dark:text-[#A69D8E]">
                <span>
                  De: <strong className="text-[#191611] dark:text-white font-mono">resumos@soumanager.com.br</strong>
                </span>
                <span className="font-mono text-[11px] text-amber-700 dark:text-[#D4A95E]">{selectedDate}</span>
              </div>
              <div className="text-[#6B6252] dark:text-[#A69D8E]">
                Para: <strong className="text-[#191611] dark:text-white">Administradores e Gestores ({tenantName})</strong>
              </div>
              <div className="pt-1">
                <span className="text-stone-400">Assunto: </span>
                <strong className="text-amber-700 dark:text-[#D4A95E] font-semibold">
                  {activeShift === 'morning'
                    ? `[SMG] Briefing da Manhã — ${tenantName} (${selectedDate})`
                    : `[SMG] Fechamento da Noite${
                        (summaryData?.evening.openComandas.length ?? 0) > 0
                          ? ` (${summaryData?.evening.openComandas.length} Comanda(s) Aberta(s))`
                          : ''
                      } — ${tenantName}`}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] text-xs space-y-3">
              {activeShift === 'morning' ? (
                <>
                  <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-2">
                    <span className="font-semibold text-[#191611] dark:text-white">
                      Resumo Previsional ({summaryData?.formattedDate || selectedDate})
                    </span>
                    <span className="font-mono text-amber-700 dark:text-[#D4A95E]">
                      Ocupação: {summaryData?.morning.occupancyRate ?? 0}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
                    <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                      <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">AGENDADOS</span>
                      <strong className="text-sm text-[#191611] dark:text-white">{summaryData?.morning.scheduledCount ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                      <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">PREVISTO CAIXA</span>
                      <strong className="text-sm text-amber-700 dark:text-[#D4A95E]">
                        {formatCurrency(summaryData?.morning.projectedRevenue ?? 0)}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                      <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">CLUBE CHEFES</span>
                      <strong className="text-sm text-[#191611] dark:text-white">
                        {summaryData?.morning.clubSubscribersCount ?? 0} créd.
                      </strong>
                    </div>
                  </div>
                  <p className="text-[#6B6252] dark:text-[#A69D8E] leading-relaxed">
                    <strong className="text-[#191611] dark:text-white">Destaques:</strong>{' '}
                    {summaryData?.morning.staffOccupancy.length
                      ? `${summaryData.morning.staffOccupancy.length} profissional(is) na escala e ${summaryData.morning.financialAlerts.length} vencimento(s) financeiro(s) nesta data.`
                      : 'Nenhum profissional escalado para esta data.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-2">
                    <span className="font-semibold text-[#191611] dark:text-white">Auditoria de Caixa & Comissões</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      Caixa: {formatCurrency(summaryData?.evening.realizedRevenue ?? 0)}
                    </span>
                  </div>
                  {(summaryData?.evening.openComandas.length ?? 0) > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-400 font-mono text-[11px]">
                      ⚠️ ATENÇÃO: {summaryData?.evening.openComandas.length} comanda(s) somando{' '}
                      {formatCurrency(summaryData?.evening.openComandasTotal ?? 0)} em aberto.
                    </div>
                  )}
                  <p className="text-[#6B6252] dark:text-[#A69D8E] leading-relaxed">
                    Foram concluídos{' '}
                    <strong className="text-[#191611] dark:text-white">
                      {summaryData?.evening.completedCount ?? 0} atendimentos
                    </strong>{' '}
                    com ticket médio de{' '}
                    <strong className="text-[#191611] dark:text-white">
                      {formatCurrency(summaryData?.evening.ticketMedio ?? 0)}
                    </strong>
                    , além de {summaryData?.evening.clubCreditsCount ?? 0} atendimento(s) via crédito do Clube dos Chefes. Total de comissões:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(summaryData?.evening.totalCommissions ?? 0)}
                    </strong>
                    .
                  </p>
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={onDispatch}
                disabled={!summaryData}
                className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Registrar Envio de E-mail</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
