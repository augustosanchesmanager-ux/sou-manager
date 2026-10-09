import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategicDashboard } from '../hooks/useStrategicDashboard';
import { StrategicKPICards } from '../components/strategic/StrategicKPICards';
import { RevenueEvolutionChart } from '../components/strategic/RevenueEvolutionChart';
import { TopProfessionalsRanking } from '../components/strategic/TopProfessionalsRanking';
import { StrategicAlerts, type StrategicAlert } from '../components/strategic/StrategicAlerts';
import { ClubMacroWidget } from '../src/components/club/ClubMacroWidget';
import MetricCard, { type MetricTone } from '../components/ui/MetricCard';
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

  const operationalPulse: Array<{
    label: string;
    value: string;
    helper: string;
    icon: string;
    tone: MetricTone;
  }> = [
    {
      label: 'Agenda',
      value: String(data.appointmentCount),
      helper: 'atendimentos no período',
      icon: 'event_available',
      tone: 'info',
    },
    {
      label: 'Ocupação',
      value: `${data.occupationRate.toFixed(0)}%`,
      helper: 'uso das cadeiras',
      icon: 'chair',
      tone: 'info',
    },
    {
      label: 'Clube',
      value: String(data.clubActiveSubscriptions),
      helper: 'assinantes ativos',
      icon: 'workspace_premium',
      tone: 'brass',
    },
    {
      label: 'Alertas',
      value: String(data.alerts.length),
      helper: data.alerts.length > 0 ? 'pontos para revisar' : 'sem urgência',
      icon: data.alerts.length > 0 ? 'notifications_active' : 'done_all',
      tone: data.alerts.length > 0 ? 'negative' : 'positive',
    },
  ];

  if (data.error) {
    return (
      <div className="animate-fade-in pb-20">
        <div className="rounded-3xl border border-danger/30 bg-danger/10 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-danger text-white">
                <span className="material-symbols-outlined">error</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-danger">Painel estratégico</p>
                <h2 className="mt-1 text-2xl font-black text-danger">Não foi possível carregar os dados</h2>
                <p className="mt-1 text-sm font-semibold text-danger">{data.error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 text-sm font-bold text-white transition hover:bg-danger/90"
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
      <section className="rounded-3xl border border-line bg-card shadow-smg-shell">
        <div className="p-5 sm:p-6">
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-gold-soft px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-dark">
                  <span className="material-symbols-outlined text-sm">memory</span>
                  SMG Barber Intelligence
                </span>
                <span className="rounded-full border border-line bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  {periodDescriptions[period]}
                </span>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">{dateStr}</p>
              <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">
                Cockpit do dono
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-ink-soft">
                Agenda, financeiro, equipe e recorrência em uma leitura rápida para decidir o próximo movimento da barbearia.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:items-end">
              <div className="flex rounded-2xl border border-line bg-cream p-1">
                {(['today', 'week', 'month'] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition sm:px-4 ${
                      period === p
                        ? 'bg-primary text-night shadow-smg-glow'
                        : 'text-ink-soft hover:bg-gold-pale hover:text-ink'
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
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink transition hover:bg-gold-pale"
                >
                  <span className="material-symbols-outlined text-base text-primary">event</span>
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/accounts-receivable')}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink transition hover:bg-gold-pale"
                >
                  <span className="material-symbols-outlined text-base text-primary">payments</span>
                  Recebíveis
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/chef-club-receivables')}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-gold-soft px-3 py-2 text-xs font-bold text-primary-dark transition hover:bg-gold-pale"
                >
                  <span className="material-symbols-outlined text-base text-primary">workspace_premium</span>
                  Clube
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {operationalPulse.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
            density="compact"
          />
        ))}
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/30 p-4">
          <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-smg-shell">
            <div className="mx-auto size-9 animate-spin rounded-full border-4 border-gold-soft border-t-primary" />
            <p className="mt-3 text-sm font-bold text-ink">Carregando dados reais...</p>
            <p className="mt-1 text-xs text-ink-soft">Financeiro, agenda, equipe e Club dos Chefes.</p>
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
