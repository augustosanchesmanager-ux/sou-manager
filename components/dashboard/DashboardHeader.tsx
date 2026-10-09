import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
import type { DashboardPeriod } from '../../src/modules/dashboard';
import { getTimeOfDayGreeting, formatDateInSaoPaulo } from '../../src/modules/dashboard/timezone';

interface DashboardHeaderProps {
  appSlug?: string | null;
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
  appSlug,
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
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  const greeting = useMemo(() => getTimeOfDayGreeting(), []);
  const todayFormatted = useMemo(() => formatDateInSaoPaulo(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }), []);

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'gestor';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const tenantName = user?.user_metadata?.tenant_name || (isEsteticaApp ? 'sua clínica' : 'sua barbearia');

  const focusItems = [
    {
      label: isEsteticaApp ? `${labels.orderPlural} abertos` : 'Comandas abertas',
      value: openComandasCount,
      icon: 'receipt_long',
      tone: 'text-primary-dark',
      onClick: onOpenComandas,
    },
    {
      label: isEsteticaApp ? 'Atendimentos pendentes' : 'Agendamentos pendentes',
      value: pendingAppointmentsCount,
      icon: 'pending_actions',
      tone: 'text-primary-dark',
      onClick: onNewAppointment,
    },
    {
      label: isEsteticaApp ? 'Clientes para retorno' : 'Retornos sugeridos',
      value: returningClientsCount,
      icon: 'person_search',
      tone: 'text-primary-dark',
      onClick: onOpenSmartReturn,
    },
  ];

  const heroClassName = 'relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-cream via-card to-gold-pale p-5 text-ink shadow-smg-shell sm:p-6';
  const badgeClassName = 'inline-flex items-center gap-2 rounded-full border border-primary-light/50 bg-gold-soft px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary-dark';
  const greetingClassName = 'flex items-center gap-2 text-sm font-bold text-ink-soft';
  const titleClassName = 'max-w-2xl text-3xl font-black leading-tight text-ink sm:text-4xl';
  const bodyClassName = 'max-w-2xl text-sm font-medium leading-6 text-ink-soft';
  const primaryActionClassName = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-black text-night shadow-smg-glow transition hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/40';
  const secondaryActionClassName = 'inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm font-black text-ink transition hover:bg-gold-pale focus:outline-none focus:ring-2 focus:ring-primary/30';
  const periodButtonClassName = 'flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left transition hover:bg-gold-pale focus:outline-none focus:ring-2 focus:ring-primary/30';
  const focusButtonClassName = 'rounded-2xl border border-line bg-card p-2.5 text-left transition hover:border-primary-light hover:bg-gold-soft focus:outline-none focus:ring-2 focus:ring-primary/30 sm:p-3';

  return (
    <section className={heroClassName}>
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full blur-3xl bg-primary/10" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-96 -translate-x-1/2 blur-3xl bg-primary/5" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className={badgeClassName}>
            <span className="h-2 w-2 rounded-full bg-primary-dark" />
            {isEsteticaApp ? 'Central da estética' : 'Central da barbearia'}
          </div>

          <div className="space-y-2">
            <div className={greetingClassName}>
              <span className="material-symbols-outlined text-[18px] text-primary-dark">{greeting.icon}</span>
              {greeting.text}, {displayName}
            </div>
            <p className={`text-xs font-medium ${isEsteticaApp ? 'text-[#6F6758]' : 'text-slate-400'}`}>
              {todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}
            </p>
            <h1 className={titleClassName}>
              {isEsteticaApp ? 'Resumo da operação de hoje.' : 'Sua barbearia em tempo real.'}
            </h1>
            <p className={bodyClassName}>
              {isEsteticaApp
                ? `Acompanhe agenda, atendimentos e retornos da ${tenantName} com base no que já foi registrado.`
                : `Veja agenda, comandas, retorno de clientes e movimento financeiro da ${tenantName} com base no que já foi registrado.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onNewAppointment}
              className={primaryActionClassName}
            >
              <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
              {isEsteticaApp ? 'Novo atendimento' : 'Novo agendamento'}
            </button>
            <button
              onClick={onOpenCheckout}
              className={secondaryActionClassName}
            >
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
              {isEsteticaApp ? labels.checkout : 'Abrir PDV'}
            </button>
          </div>
        </div>

        <div className="w-full max-w-xl space-y-3 xl:max-w-md">
          <div className="relative">
            <button
              onClick={() => setIsPeriodOpen((current) => !current)}
              className={periodButtonClassName}
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-ink-soft">Período</span>
                <span className="mt-1 block text-sm font-black text-ink">{PERIOD_LABELS[period]}</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                {PERIOD_HINTS[period]}
                <span className="material-symbols-outlined text-base">expand_more</span>
              </span>
            </button>

            {isPeriodOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
                {(Object.entries(PERIOD_LABELS) as Array<[DashboardPeriod, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onPeriodChange(key);
                      setIsPeriodOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold transition ${
                      period === key
                        ? 'bg-gold-soft text-primary-dark'
                        : 'text-ink-soft hover:bg-gold-pale'
                    }`}
                  >
                    {label}
                    {period === key && <span className="material-symbols-outlined text-base text-primary-dark">check</span>}
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
                className={focusButtonClassName}
              >
                <span className={`material-symbols-outlined text-[20px] ${item.tone}`}>{item.icon}</span>
                <span className="mt-2 block text-xl font-black sm:text-2xl text-ink">{item.value}</span>
                <span className="mt-1 block text-[10px] font-bold leading-3 sm:text-[11px] sm:leading-4 text-ink-soft">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardHeader;