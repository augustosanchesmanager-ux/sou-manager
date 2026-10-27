import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
import type { DashboardPeriod } from '../../src/modules/dashboard';
import { getTimeOfDayGreeting, formatDateInSaoPaulo } from '../../src/modules/dashboard/timezone';
import { formatCurrency } from '../../shared/format/currency';

interface DashboardHeaderProps {
  appSlug?: string | null;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  openComandasCount: number;
  pendingAppointmentsCount: number;
  returningClientsCount: number;
  todayKpis?: {
    totalToday: number;
    faturamento: number;
    emAtendimento: number;
    pendentes: number;
    cancelados: number;
    concluidos: number;
  } | null;
  onKpiClick?: (type: string) => void;
  onNewAppointment: () => void;
  onOpenCheckout: () => void;
  onOpenComandas: () => void;
  onOpenSmartReturn: () => void;
  onOpenCash?: () => void;
  onCloseCash?: () => void;
  onOpenActivityTimeline?: () => void;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta semana',
  month: 'Este mês',
};

const PERIOD_HINTS: Record<DashboardPeriod, string> = {
  today: 'vs. ontem',
  yesterday: 'vs. dia anterior',
  week: 'vs. semana anterior',
  month: 'vs. mês anterior',
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  appSlug,
  period,
  onPeriodChange,
  openComandasCount,
  pendingAppointmentsCount,
  returningClientsCount,
  todayKpis,
  onKpiClick,
  onNewAppointment,
  onOpenCheckout,
  onOpenComandas,
  onOpenSmartReturn,
  onOpenCash,
  onCloseCash,
  onOpenActivityTimeline,
}) => {
  const { user } = useAuth();
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isCashMenuOpen, setIsCashMenuOpen] = useState(false);
  const cashMenuRef = useRef<HTMLDivElement>(null);
  const periodMenuRef = useRef<HTMLDivElement>(null);

  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  const greeting = useMemo(() => getTimeOfDayGreeting(), []);
  const todayFormatted = useMemo(() => formatDateInSaoPaulo(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }), []);

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'gestor';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (cashMenuRef.current && !cashMenuRef.current.contains(e.target as Node)) {
        setIsCashMenuOpen(false);
      }
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setIsPeriodOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const focusMetrics = [
    {
      label: isEsteticaApp ? `${labels.orderPlural} abertos` : 'Comandas abertas',
      value: openComandasCount,
      icon: 'receipt_long',
      tone: 'text-primary',
      onClick: onOpenComandas,
      ariaLabel: `Ver ${openComandasCount} comandas abertas`,
    },
    {
      label: isEsteticaApp ? 'Atendimentos pendentes' : 'Agendamentos pendentes',
      value: pendingAppointmentsCount,
      icon: 'pending_actions',
      tone: 'text-amber-400',
      onClick: onNewAppointment,
      ariaLabel: `Ver ${pendingAppointmentsCount} agendamentos pendentes`,
    },
    {
      label: isEsteticaApp ? 'Clientes para retorno' : 'Retornos sugeridos',
      value: returningClientsCount,
      icon: 'person_search',
      tone: 'text-emerald-400',
      onClick: onOpenSmartReturn,
      ariaLabel: `Ver ${returningClientsCount} retornos sugeridos`,
    },
  ];

  return (
    <section className="relative rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-5 sm:p-6 shadow-sm transition-colors">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Identificação e Saudação (Zero Slop) */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <span className="material-symbols-outlined text-base text-primary">{greeting.icon}</span>
            <span>{greeting.text}, {displayName}</span>
            <span>•</span>
            <span className="capitalize">{todayFormatted}</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-ink dark:text-white">
            {isEsteticaApp ? 'Resumo operacional da clínica' : 'Visão geral do movimento e financeiro de hoje.'}
          </h1>

          {/* Ações Rápidas: 1 Primário Dourado + 1 Menu Secundário Consolidado */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onNewAppointment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-xs sm:text-sm font-bold text-night shadow-sm hover:brightness-105 active:scale-[0.98] transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="material-symbols-outlined text-lg">calendar_add_on</span>
              {isEsteticaApp ? 'Novo Atendimento' : 'Novo Agendamento'}
            </button>

            {/* Menu Dropdown Consolidado: Operações de Caixa & PDV */}
            <div className="relative inline-block text-left" ref={cashMenuRef}>
              <button
                type="button"
                onClick={() => setIsCashMenuOpen((prev) => !prev)}
                aria-expanded={isCashMenuOpen}
                aria-haspopup="menu"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-ink dark:text-white hover:border-primary/40 transition-all touch-manipulation active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base text-primary">point_of_sale</span>
                <span>PDV & Caixa</span>
                <span className={`material-symbols-outlined text-sm text-ink-soft transition-transform duration-200 ${isCashMenuOpen ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {isCashMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-1.5 w-52 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-[#1A1610] p-1.5 shadow-2xl z-50 animate-fade-in focus:outline-none"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsCashMenuOpen(false);
                      onOpenCheckout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-base text-primary">point_of_sale</span>
                    {isEsteticaApp ? labels.checkout : 'Abrir PDV / Balcão'}
                  </button>

                  {onOpenCash && (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="dashboard-open-cash-btn"
                      onClick={() => {
                        setIsCashMenuOpen(false);
                        onOpenCash();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-base text-success">payments</span>
                      Abrir Caixa do Dia
                    </button>
                  )}

                  {onCloseCash && (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="dashboard-close-cash-btn"
                      onClick={() => {
                        setIsCashMenuOpen(false);
                        onCloseCash();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-base text-amber-400">lock_clock</span>
                      Fechar Caixa do Dia
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Seletor de Período Compacto */}
            <div className="relative inline-block text-left" ref={periodMenuRef}>
              <button
                type="button"
                onClick={() => setIsPeriodOpen((prev) => !prev)}
                aria-expanded={isPeriodOpen}
                aria-haspopup="listbox"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-3 py-2.5 text-xs font-semibold text-ink-soft hover:text-ink dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">calendar_month</span>
                <span>{PERIOD_LABELS[period]}</span>
                <span className="text-[10px] opacity-70">({PERIOD_HINTS[period]})</span>
                <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${isPeriodOpen ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {isPeriodOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 mt-1.5 w-44 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-[#1A1610] p-1.5 shadow-2xl z-50 animate-fade-in"
                >
                  {(Object.entries(PERIOD_LABELS) as Array<[DashboardPeriod, string]>).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={period === key}
                      onClick={() => {
                        onPeriodChange(key);
                        setIsPeriodOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        period === key
                          ? 'bg-primary/20 text-primary-light font-bold'
                          : 'text-ink-soft hover:bg-gold-pale dark:hover:bg-white/5 hover:text-ink dark:hover:text-white'
                      }`}
                    >
                      {label}
                      {period === key && <span className="material-symbols-outlined text-sm text-primary">check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botão de Histórico de Atividades / Timeline do Sistema */}
            {onOpenActivityTimeline && (
              <button
                type="button"
                onClick={onOpenActivityTimeline}
                title="Histórico de atividades e registros do sistema"
                aria-label="Abrir histórico de atividades"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-3 py-2.5 text-xs font-semibold text-ink-soft hover:text-primary dark:hover:text-primary transition-colors touch-manipulation active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base text-primary">history</span>
                <span className="hidden sm:inline">Atividades</span>
              </button>
            )}
          </div>
        </div>

        {/* Métricas de Operação do Dia — Integradas no Lado Direito da Hero */}
        {todayKpis ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
            {[
              {
                key: 'totalToday',
                label: 'Hoje',
                value: String(todayKpis.totalToday),
                icon: 'event',
                tone: 'text-ink dark:text-white',
              },
              {
                key: 'faturamento',
                label: 'Faturamento',
                value: formatCurrency(todayKpis.faturamento),
                icon: 'payments',
                tone: 'text-primary-dark dark:text-primary-light font-semibold',
              },
              {
                key: 'emAtendimento',
                label: 'Na Cadeira',
                value: String(todayKpis.emAtendimento),
                icon: 'content_cut',
                tone: 'text-amber-500',
              },
              {
                key: 'pendentes',
                label: 'Pendentes',
                value: String(todayKpis.pendentes),
                icon: 'schedule',
                tone: 'text-primary',
              },
              {
                key: 'cancelados',
                label: 'Cancelados',
                value: String(todayKpis.cancelados),
                icon: 'cancel',
                tone: 'text-danger',
              },
              {
                key: 'concluidos',
                label: 'Concluídos',
                value: String(todayKpis.concluidos),
                icon: 'task_alt',
                tone: 'text-success',
              },
            ].map((kpi) => (
              <button
                key={kpi.key}
                type="button"
                onClick={() => onKpiClick?.(kpi.key)}
                className="flex flex-col items-center justify-center rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-3 py-2 min-w-[96px] sm:min-w-[104px] transition-all hover:border-primary/40 active:scale-95 touch-manipulation group text-center"
              >
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-ink-soft group-hover:text-primary transition-colors">
                    {kpi.icon}
                  </span>
                  <span className={`font-sans text-sm sm:text-base font-medium tabular-nums tracking-tight whitespace-nowrap ${kpi.tone}`}>
                    {kpi.value}
                  </span>
                </div>
                <span className="mt-0.5 text-[10px] font-normal text-ink-soft leading-tight truncate max-w-[90px]">
                  {kpi.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          /* Fallback caso KPIs ainda estejam carregando */
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
            {focusMetrics.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                aria-label={item.ariaLabel}
                className="flex flex-col items-center justify-center rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark/60 p-4 min-w-[115px] sm:min-w-[130px] transition-all hover:border-primary/40 active:scale-95 touch-manipulation group text-center"
              >
                <div className="w-full flex items-center justify-end">
                  <span className={`material-symbols-outlined text-base ${item.tone}`}>{item.icon}</span>
                </div>
                <span className="my-1 font-sans text-3xl sm:text-4xl font-normal tabular-nums tracking-tight text-ink dark:text-white">
                  {item.value}
                </span>
                <span className="text-xs font-normal text-ink-soft leading-tight text-center truncate max-w-[110px]">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};

export default DashboardHeader;
