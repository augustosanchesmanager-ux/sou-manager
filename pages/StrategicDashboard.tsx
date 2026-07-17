import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategicDashboard } from '../hooks/useStrategicDashboard';
import { StrategicKPICards } from '../components/strategic/StrategicKPICards';
import { RevenueEvolutionChart } from '../components/strategic/RevenueEvolutionChart';
import { TopProfessionalsRanking } from '../components/strategic/TopProfessionalsRanking';
import { StrategicAlerts, type StrategicAlert } from '../components/strategic/StrategicAlerts';
import { ClubMacroWidget } from '../src/components/club/ClubMacroWidget';
import Toast from '../components/Toast';

type Period = 'today' | 'week' | 'month';

const periodLabels: Record<Period, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
};

const periodDescriptions: Record<Period, string> = {
  today: 'Operação do dia',
  week: 'Rotina da semana',
  month: 'Visão do mês',
};

const StrategicDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('month');
  const { data, reload } = useStrategicDashboard(period);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleKPIClick = (kpi: string) => {
    navigate(`/bi?filter=${kpi}&period=${period}`);
  };

  const handleProfessionalClick = (professionalId: string) => {
    if (professionalId === 'all') {
      navigate('/team');
    } else {
      navigate(`/bi?professional=${professionalId}&period=${period}`);
    }
  };

  const handleAlertClick = (alert: StrategicAlert) => {
    switch (alert.type) {
      case 'stock':
        navigate('/products');
        break;
      case 'inadimplence':
        navigate('/chef-club-subscriptions?status=past_due');
        break;
      case 'occupation':
        navigate('/schedule');
        break;
      default:
        break;
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const operationalPulse = [
    {
      label: 'Agenda',
      value: String(data.appointmentCount),
      helper: 'atendimentos no período',
      icon: 'event_available',
      tone: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-500/10 border-sky-500/20',
    },
    {
      label: 'Ocupação',
      value: `${data.occupationRate.toFixed(0)}%`,
      helper: 'uso das cadeiras',
      icon: 'chair',
      tone: 'text-[#007BFF] dark:text-[#00D2FF]',
      bg: 'bg-[#EAF7FF] border-[#BDEFFF] dark:bg-[#0D2238] dark:border-[#14304A]',
    },
    {
      label: 'Clube',
      value: String(data.clubActiveSubscriptions),
      helper: 'assinantes ativos',
      icon: 'workspace_premium',
      tone: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Alertas',
      value: String(data.alerts.length),
      helper: data.alerts.length > 0 ? 'pontos para revisar' : 'sem urgência',
      icon: data.alerts.length > 0 ? 'notifications_active' : 'done_all',
      tone: data.alerts.length > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300',
      bg: data.alerts.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  if (data.error) {
    return (
      <div className="animate-fade-in pb-20">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-500/30 dark:bg-red-500/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-red-500 text-white">
                <span className="material-symbols-outlined">error</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-300">Painel estratégico</p>
                <h2 className="mt-1 text-2xl font-black text-red-900 dark:text-red-100">Não foi possível carregar os dados</h2>
                <p className="mt-1 text-sm font-semibold text-red-700 dark:text-red-200">{data.error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <section className="overflow-hidden rounded-3xl border border-[#14304A] bg-[#06111F] shadow-[0_24px_60px_rgba(0,51,102,0.16)]">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-5 top-5 hidden size-24 rounded-full bg-[#00D2FF]/10 blur-3xl sm:block" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00D2FF]/25 bg-[#00D2FF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#AEEFFF]">
                  <span className="material-symbols-outlined text-sm">memory</span>
                  SMG Barber Intelligence
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  {periodDescriptions[period]}
                </span>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-[#00D2FF]">{dateStr}</p>
              <h2 className="mt-2 text-3xl font-black text-[#F5FBFF] sm:text-4xl">
                Cockpit do dono
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                Agenda, financeiro, equipe e recorrência em uma leitura rápida para decidir o próximo movimento da barbearia.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:items-end">
              <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
                {(['today', 'week', 'month'] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition sm:px-4 ${
                      period === p
                        ? 'bg-[#00D2FF] text-[#003366] shadow-[0_0_28px_rgba(0,210,255,0.22)]'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/schedule')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  <span className="material-symbols-outlined text-base">event</span>
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/accounts-receivable')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  Recebíveis
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/chef-club-receivables')}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#00D2FF]/25 bg-[#00D2FF]/10 px-3 py-2 text-xs font-bold text-[#CFF6FF] transition hover:bg-[#00D2FF]/20"
                >
                  <span className="material-symbols-outlined text-base">workspace_premium</span>
                  Clube
                </button>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {operationalPulse.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-xl border ${item.bg}`}>
                    <span className={`material-symbols-outlined text-lg ${item.tone}`}>{item.icon}</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 sm:text-[10px]">{item.label}</span>
                </div>
                <p className="text-xl font-black text-white sm:text-2xl">{item.value}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 sm:text-xs">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StrategicKPICards
        revenue={data.revenue}
        revenueGrowth={data.revenueGrowth}
        avgTicket={data.avgTicket}
        avgTicketGrowth={data.avgTicketGrowth}
        totalClients={data.totalClients}
        newClients={data.newClients}
        occupationRate={data.occupationRate}
        appointmentCount={data.appointmentCount}
        onKpiClick={handleKPIClick}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <RevenueEvolutionChart
          data={data.revenueEvolution}
          title="Evolução de receita"
        />

        <StrategicAlerts
          alerts={data.alerts}
          onAlertClick={handleAlertClick}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TopProfessionalsRanking
          professionals={data.topProfessionals}
          onProfessionalClick={handleProfessionalClick}
          maxItems={5}
        />

        <ClubMacroWidget />
      </div>

      {data.loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06111F]/30 p-4">
          <div className="rounded-2xl border border-[#D9EAF5] bg-white p-6 text-center shadow-2xl dark:border-[#14304A] dark:bg-card-dark">
            <div className="mx-auto size-9 animate-spin rounded-full border-4 border-[#00D2FF]/30 border-t-[#007BFF]" />
            <p className="mt-3 text-sm font-bold text-[#003366] dark:text-white">Carregando dados reais...</p>
            <p className="mt-1 text-xs text-slate-500">Financeiro, agenda, equipe e Clube do Chefe.</p>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default StrategicDashboard;
