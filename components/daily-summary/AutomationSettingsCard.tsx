import React from 'react';
import { Cpu, Shield, Clock } from 'lucide-react';
import type { AutomationSettings, DispatchLogItem } from '../../src/types/dailySummary';

interface AutomationSettingsCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  tenantName: string;
  selectedDate: string;
  settings: AutomationSettings;
  dispatchLogs: DispatchLogItem[];
  onSettingChange: (key: keyof AutomationSettings, value: unknown) => void;
}

export const AutomationSettingsCard: React.FC<AutomationSettingsCardProps> = ({
  cardRef,
  tenantName,
  selectedDate,
  settings,
  dispatchLogs,
  onSettingChange,
}) => {
  return (
    <div
      ref={cardRef}
      className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 space-y-5 transition-all shadow-xs"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
            <span>Regras de Automação (Manhã & Noite)</span>
          </h2>
          <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
            Horários de disparo automático no fuso de Brasília
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          {settings.morningEnabled || settings.eveningEnabled ? 'Ativo' : 'Pausado'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="toggle-auto-morning"
              checked={settings.morningEnabled}
              onChange={(e) => onSettingChange('morningEnabled', e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <div>
              <label htmlFor="toggle-auto-morning" className="text-xs sm:text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] cursor-pointer block">
                ☀️ Disparo Briefing da Manhã
              </label>
              <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">Previsão da agenda, janelas livres e contas do dia</span>
            </div>
          </div>
          <input
            type="time"
            aria-label="Horário do Briefing da Manhã"
            value={settings.morningTime}
            onChange={(e) => onSettingChange('morningTime', e.target.value)}
            className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2.5 py-1 text-xs font-mono text-amber-700 dark:text-[#D4A95E] focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="toggle-auto-evening"
              checked={settings.eveningEnabled}
              onChange={(e) => onSettingChange('eveningEnabled', e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <div>
              <label htmlFor="toggle-auto-evening" className="text-xs sm:text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] cursor-pointer block">
                🌙 Disparo Fechamento da Noite
              </label>
              <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">Caixa líquido, comissões e alerta de comandas abertas</span>
            </div>
          </div>
          <input
            type="time"
            aria-label="Horário do Fechamento da Noite"
            value={settings.eveningTime}
            onChange={(e) => onSettingChange('eveningTime', e.target.value)}
            className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2.5 py-1 text-xs font-mono text-amber-700 dark:text-[#D4A95E] focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-[#29241D]">
        <span className="text-xs font-semibold text-[#191611] dark:text-[#F4EFE6] block">
          Destinatários & Privacidade
        </span>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-[#171411] border border-amber-500/40 text-xs text-[#191611] dark:text-white">
            <Shield className="w-3 h-3 text-amber-500" />
            Administradores e Gestores ({tenantName})
          </span>
        </div>

        <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            id="toggle-barber-individual"
            checked={settings.sendIndividualBarber}
            onChange={(e) => onSettingChange('sendIndividualBarber', e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
          />
          <span className="text-xs text-[#6B6252] dark:text-[#A69D8E] leading-snug">
            Enviar resumo individual restrito para cada profissional da equipe (oculta faturamento global da unidade e exibe apenas a própria agenda e comissão).
          </span>
        </label>
      </div>

      <div className="pt-3 border-t border-stone-200 dark:border-[#29241D] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-[#D4A95E] font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Histórico de Envios ({selectedDate})
          </span>
          <span className="text-[11px] font-mono text-[#6B6252] dark:text-stone-400">
            {dispatchLogs.length} registro(s)
          </span>
        </div>

        {dispatchLogs.length === 0 ? (
          <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] py-3 text-center rounded-xl bg-stone-50 dark:bg-[#171411] border border-dashed border-[#E8DFC9] dark:border-[#29241D]">
            Nenhum disparo registrado para {selectedDate}.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {dispatchLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between text-[11px] font-mono"
              >
                <div>
                  <span
                    className={`font-semibold ${
                      log.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    [{log.status === 'SENT' ? 'ENVIADO' : log.status === 'SKIPPED_DUPLICATE' ? 'DUPLICADO' : 'FALHA'}]
                  </span>
                  <span className="text-[#191611] dark:text-white ml-1.5">
                    {log.date} • {log.shift === 'morning' ? 'MANHÃ' : 'NOITE'} • {log.channel}
                  </span>
                </div>
                <span className="text-[#6B6252] dark:text-[#A69D8E]">{log.dispatchedAt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
