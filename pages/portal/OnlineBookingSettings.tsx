import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const OnlineBookingSettings: React.FC = () => {
  const { tenantSlug } = useAuth();
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(20);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Link público canônico do agendamento direto (sem login)
  const publicBookingUrl = `https://barber.soumanager.com/#/agendar/${tenantSlug || 'sua-barbearia'}`;

  // Opções de horários de 06:00 até 23:00
  const hourOptions = Array.from({ length: 18 }, (_, i) => i + 6);

  const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicBookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback manual para clipboard
      const input = document.getElementById('public-link-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (startHour >= endHour) {
      alert('O horário de abertura deve ser anterior ao horário de fechamento.');
      return;
    }
    // Estado local simulado (backend será conectado na próxima etapa)
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-fade-in p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-border-dark pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Configurações do Agendamento Online
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie a vitrine digital da sua barbearia, canais de agendamento e horários de atendimento web.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Vitrine Online Ativa
        </div>
      </header>

      {/* SEÇÃO 1: Links de Divulgação */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">link</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Link de Agendamento Direto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compartilhe na bio do Instagram, WhatsApp ou anúncios. O cliente agenda sem necessidade de senha.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              public
            </span>
            <input
              id="public-link-input"
              type="text"
              readOnly
              value={publicBookingUrl}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-mono text-slate-700 dark:text-slate-200 select-all outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
            </button>

            <a
              href={publicBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary transition-all flex items-center justify-center"
              title="Abrir página de agendamento em nova aba"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: Horários de Funcionamento Online */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Horários de Funcionamento Online
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Limite os horários disponíveis na vitrine pública. Atendimentos fora dessa janela não aparecerão para clientes.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Abertura */}
            <div className="space-y-2">
              <label htmlFor="start-hour" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Abertura da Agenda (Início)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  wb_sunny
                </span>
                <select
                  id="start-hour"
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-colors"
                >
                  {hourOptions.map((h) => (
                    <option key={`start-${h}`} value={h}>
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                  expand_more
                </span>
              </div>
            </div>

            {/* Fechamento */}
            <div className="space-y-2">
              <label htmlFor="end-hour" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Fechamento da Agenda (Término)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  bedtime
                </span>
                <select
                  id="end-hour"
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-colors"
                >
                  {hourOptions.map((h) => (
                    <option key={`end-${h}`} value={h}>
                      {formatHourLabel(h)}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Resumo da Faixa */}
          <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">info</span>
              <span>
                Janela diária configurada:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatHourLabel(startHour)} às {formatHourLabel(endHour)}
                </strong>{' '}
                ({Math.max(0, endHour - startHour)} horas de atendimento disponíveis ao público).
              </span>
            </div>

            {saveSuccess && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Configurações salvas localmente!
              </span>
            )}
          </div>

          {/* Botão de Salvar */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto px-7 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              <span>Salvar Configurações</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default OnlineBookingSettings;
