import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  week: 'Esta Semana',
  month: 'Este Mês',
};

const StrategicDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>('month');
  const { data, reload } = useStrategicDashboard(period);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleKPIClick = (kpi: string) => {
    navigate(`/business-intelligence?filter=${kpi}&period=${period}`);
  };

  const handleProfessionalClick = (professionalId: string) => {
    if (professionalId === 'all') {
      navigate('/team');
    } else {
      navigate(`/business-intelligence?professional=${professionalId}&period=${period}`);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  if (data.error) {
    return (
      <div className="p-6">
        <Toast 
          message={`Erro ao carregar dados: ${data.error}`} 
          type="error" 
          onClose={() => setToast(null)} 
        />
        <button 
          onClick={reload}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg font-bold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-1">
            {dateStr}
          </p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight display-font">
            Centro de Comando
          </h2>
          <p className="text-slate-500 mt-1">
            Visão geral do seu negócio
          </p>
        </div>

        <div className="flex gap-2">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                period === p
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueEvolutionChart 
          data={data.revenueEvolution}
          title="Evolução de Receita"
        />
        
        <div className="space-y-6">
          <StrategicAlerts 
            alerts={data.alerts}
            onAlertClick={(alert) => {
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
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProfessionalsRanking
          professionals={data.topProfessionals}
          onProfessionalClick={handleProfessionalClick}
          maxItems={5}
        />
        
        <ClubMacroWidget />
      </div>

      {data.loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl">
            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">Carregando dados...</p>
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