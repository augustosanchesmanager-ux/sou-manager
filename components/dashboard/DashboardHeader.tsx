import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { DashboardPeriod } from '../../src/modules/dashboard';

interface DashboardHeaderProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  openComandasCount: number;
  pendingAppointmentsCount: number;
  returningClientsCount: number;
  onNewAppointment: () => void;
  onOpenCheckout: () => void;
  onOpenComandas: () => void;
  onOpenSmartReturn: () => void;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta semana',
  month: 'Este mês',
};

const PERIOD_HINTS: Record<DashboardPeriod, string> = {
  today: 'Comparando com ontem',
  yesterday: 'Comparando com o dia anterior',
  week: 'Comparando com a semana anterior',
  month: 'Comparando com o mês anterior',
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  period,
  onPeriodChange,
  openComandasCount,
  pendingAppointmentsCount,
  returningClientsCount,
  onNewAppointment,
  onOpenCheckout,
  onOpenComandas,
  onOpenSmartReturn,
}) => {
  const { user } = useAuth();
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { icon: 'wb_sunny', text: 'Bom dia' };
    if (hour < 18) return { icon: 'wb_twilight', text: 'Boa tarde' };
    return { icon: 'nights_stay', text: 'Boa noite' };
  }, []);

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'gestor';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const tenantName = user?.user_metadata?.tenant_name || 'sua barbearia';

  const focusItems = [
    {
      label: 'Comandas abertas',
      value: openComandasCount,
      icon: 'receipt_long',
      tone: 'text-amber-200',
      onClick: onOpenComandas,
    },
    {
      label: 'Agendamentos pendentes',
      value: pendingAppointmentsCount,
      icon: 'pending_actions',
      tone: 'text-sky-200',
      onClick: onNewAppointment,
    },
    {
      label: 'Retornos sugeridos',
      value: returningClientsCount,
      icon: 'person_search',
      tone: 'text-emerald-200',
      onClick: onOpenSmartReturn,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-[linear-gradient(135deg,#0A0A0A_0%,#111827_52%,#003366_100%)] p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#00D2FF]/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-96 -translate-x-1/2 bg-[#E5A158]/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#F6D6A7]">
            <span className="h-2 w-2 rounded-full bg-[#E5A158]" />
            Central da barbearia
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <span className="material-symbols-outlined text-[18px] text-[#E5A158]">{greeting.icon}</span>
              {greeting.text}, {displayName}
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-tight text-[#F8FAFC] sm:text-4xl">
              Sua barbearia em tempo real.
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-6 text-slate-300">
              Veja agenda, comandas, retorno de clientes e movimento financeiro da {tenantName} com base no que já foi registrado.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onNewAppointment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5A158] px-4 py-3 text-sm font-black text-slate-950 shadow-[0_14px_32px_rgba(229,161,88,0.24)] transition hover:bg-[#F0B86A] focus:outline-none focus:ring-2 focus:ring-[#E5A158]/50"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
              Novo agendamento
            </button>
            <button
              onClick={onOpenCheckout}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/40"
            >
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
              Abrir PDV
            </button>
          </div>
        </div>

        <div className="w-full max-w-xl space-y-3 xl:max-w-md">
          <div className="relative">
            <button
              onClick={() => setIsPeriodOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/35"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Período</span>
                <span className="mt-1 block text-sm font-black text-white">{PERIOD_LABELS[period]}</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
                {PERIOD_HINTS[period]}
                <span className="material-symbols-outlined text-base">expand_more</span>
              </span>
            </button>

            {isPeriodOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-2xl">
                {(Object.entries(PERIOD_LABELS) as Array<[DashboardPeriod, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onPeriodChange(key);
                      setIsPeriodOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold transition ${
                      period === key
                        ? 'bg-[#E5A158]/14 text-[#F6D6A7]'
                        : 'text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {label}
                    {period === key && <span className="material-symbols-outlined text-base">check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {focusItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="rounded-2xl border border-white/10 bg-white/10 p-2.5 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/30 sm:p-3"
              >
                <span className={`material-symbols-outlined text-[20px] ${item.tone}`}>{item.icon}</span>
                <span className="mt-2 block text-xl font-black text-white sm:text-2xl">{item.value}</span>
                <span className="mt-1 block text-[10px] font-bold leading-3 text-slate-300 sm:text-[11px] sm:leading-4">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardHeader;
