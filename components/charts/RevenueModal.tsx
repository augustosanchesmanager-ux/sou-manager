import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MetricCard } from './MetricCard';
import { SparkLineChart } from './SparkLineChart';

interface RevenueData {
  today: number;
  todayPrevious: number;
  week: number;
  weekPrevious: number;
  month: number;
  monthPrevious: number;
  target: number;
  trendData: number[];
}

interface ServiceData {
  name: string;
  value: number;
  color: string;
}

interface AppointmentData {
  id: string;
  date: string;
  professional: string;
  service: string;
  client: string;
  status: string;
  value: number;
}

interface RevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  revenue: RevenueData;
  services: ServiceData[];
  appointments: AppointmentData[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#A78BFA'];

export const RevenueModal: React.FC<RevenueModalProps> = ({
  isOpen,
  onClose,
  revenue,
  services,
  appointments,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGrowth = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm z-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
        {/* Header */}
        <div className="sticky top-0 z-20 px-6 py-5 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-white text-xl">payments</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Faturamento Detalhado</h2>
                <p className="text-xs text-slate-400">Visão completa de receitas e performance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar max-h-[calc(90vh-100px)] space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hoje</span>
                <span className="material-symbols-outlined text-emerald-500 text-lg">today</span>
              </div>
              <p className="text-2xl font-black text-white mb-1">{formatCurrency(revenue.today)}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${getGrowth(revenue.today, revenue.todayPrevious) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {getGrowth(revenue.today, revenue.todayPrevious) >= 0 ? '+' : ''}{getGrowth(revenue.today, revenue.todayPrevious).toFixed(1)}%
                </span>
                <SparkLineChart 
                  data={revenue.trendData.slice(-7)} 
                  color={getGrowth(revenue.today, revenue.todayPrevious) >= 0 ? '#10B981' : '#EF4444'}
                  width={60}
                  height={20}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Semana</span>
                <span className="material-symbols-outlined text-blue-500 text-lg">date_range</span>
              </div>
              <p className="text-2xl font-black text-white mb-1">{formatCurrency(revenue.week)}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${getGrowth(revenue.week, revenue.weekPrevious) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {getGrowth(revenue.week, revenue.weekPrevious) >= 0 ? '+' : ''}{getGrowth(revenue.week, revenue.weekPrevious).toFixed(1)}%
                </span>
                <SparkLineChart 
                  data={revenue.trendData.slice(-30).filter((_, i) => i % 5 === 0)} 
                  color={getGrowth(revenue.week, revenue.weekPrevious) >= 0 ? '#3B82F6' : '#EF4444'}
                  width={60}
                  height={20}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/20 to-purple-500/10 rounded-2xl p-4 border border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Mês</span>
                <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
              </div>
              <p className="text-2xl font-black text-white mb-1">{formatCurrency(revenue.month)}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${getGrowth(revenue.month, revenue.monthPrevious) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {getGrowth(revenue.month, revenue.monthPrevious) >= 0 ? '+' : ''}{getGrowth(revenue.month, revenue.monthPrevious).toFixed(1)}%
                </span>
                <SparkLineChart 
                  data={revenue.trendData} 
                  color="#3B82F6"
                  width={60}
                  height={20}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-2xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Meta</span>
                <span className="material-symbols-outlined text-amber-500 text-lg">flag</span>
              </div>
              <p className="text-2xl font-black text-white mb-1">{formatCurrency(revenue.target)}</p>
              <div className="mt-2">
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.min((revenue.month / revenue.target) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-amber-400 mt-1">
                  {((revenue.month / revenue.target) * 100).toFixed(0)}% atingido
                </span>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/30">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">show_chart</span>
              Tendência de Faturamento
            </h3>
            <div className="h-40">
              <SparkLineChart 
                data={revenue.trendData}
                color="#10B981"
                width={700}
                height={160}
                showArea
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>30 dias atrás</span>
              <span>Hoje</span>
            </div>
          </div>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Services Distribution */}
            <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/30">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-500">content_cut</span>
                Distribuição por Serviço
              </h3>
              <div className="space-y-3">
                {services.map((service, index) => (
                  <div key={service.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span 
                          className="size-2 rounded-full"
                          style={{ backgroundColor: service.color || COLORS[index % COLORS.length] }}
                        />
                        <span className="text-slate-300">{service.name}</span>
                      </span>
                      <span className="font-semibold text-white">{formatCurrency(service.value)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(service.value / Math.max(...services.map(s => s.value))) * 100}%`,
                          backgroundColor: service.color || COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Appointments */}
            <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/30">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">history</span>
                Últimos Atendimentos
              </h3>
              <div className="space-y-2">
                {appointments.slice(0, 6).map((apt) => (
                  <div 
                    key={apt.id}
                    className={`
                      flex items-center justify-between p-2.5 rounded-xl
                      ${apt.status === 'completed' 
                        ? 'bg-emerald-900/20 border border-emerald-800/30' 
                        : apt.status === 'cancelled'
                          ? 'bg-rose-900/20 border border-rose-800/30'
                          : apt.status === 'no_show'
                            ? 'bg-amber-900/20 border border-amber-800/30'
                            : 'bg-slate-700/30 border border-slate-600/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-xs ${
                        apt.status === 'completed' ? 'text-emerald-500' :
                        apt.status === 'cancelled' ? 'text-rose-500' :
                        apt.status === 'no_show' ? 'text-amber-500' : 'text-slate-500'
                      }`}>
                        {apt.status === 'completed' ? 'task_alt' :
                         apt.status === 'cancelled' ? 'cancel' :
                         apt.status === 'no_show' ? 'person_off' : 'schedule'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">{apt.client}</p>
                        <p className="text-[10px] text-slate-400">{apt.service}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">{formatCurrency(apt.value)}</p>
                      <p className="text-[10px] text-slate-500">{new Date(apt.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default RevenueModal;