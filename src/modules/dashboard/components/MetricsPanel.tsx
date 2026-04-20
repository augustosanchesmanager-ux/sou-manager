import React from 'react';
import type { DashboardMetrics } from '../types';

type MetricType = 'revenue' | 'clients' | 'appointments' | 'avg_ticket' | 'growth' | 'retention' | 'team' | 'custom';

interface DashboardMetric {
  id: string;
  type: MetricType;
  label: string;
  icon: string;
  color: string;
  goal?: number;
  unit?: 'currency' | 'percent' | 'number';
  visible: boolean;
}

const DEFAULT_METRICS: DashboardMetric[] = [
  { id: 'm1', type: 'revenue', label: 'Faturamento do Mes', icon: 'payments', color: 'emerald', goal: 10000, unit: 'currency', visible: true },
  { id: 'm2', type: 'clients', label: 'Total de Clientes', icon: 'group', color: 'blue', goal: 200, unit: 'number', visible: true },
  { id: 'm3', type: 'appointments', label: 'Agendamentos Hoje', icon: 'calendar_month', color: 'primary', goal: 20, unit: 'number', visible: true },
  { id: 'm4', type: 'avg_ticket', label: 'Ticket Medio', icon: 'receipt_long', color: 'amber', goal: 80, unit: 'currency', visible: true },
  { id: 'm5', type: 'growth', label: 'Crescimento Mensal', icon: 'trending_up', color: 'violet', goal: 20, unit: 'percent', visible: false },
  { id: 'm6', type: 'retention', label: 'Taxa de Retorno', icon: 'psychology', color: 'red', goal: 70, unit: 'percent', visible: false },
  { id: 'm7', type: 'team', label: 'Equipe Ativa', icon: 'badge', color: 'indigo', goal: 100, unit: 'percent', visible: false },
];

const METRIC_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
  primary: 'bg-primary/10 text-primary border-primary/20',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30',
};

const STORAGE_KEY = 'sou_manager_metrics_v1';

const getColumnsClass = (visibleCount: number): string => {
  if (visibleCount <= 1) return 'lg:grid-cols-1';
  if (visibleCount === 2) return 'lg:grid-cols-2';
  if (visibleCount === 3) return 'lg:grid-cols-3';
  return 'lg:grid-cols-4';
};

export const MetricsPanel: React.FC<{
  metrics: DashboardMetrics;
  clientsCount: number;
}> = ({ metrics, clientsCount }) => {
  const [items, setItems] = React.useState<DashboardMetric[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_METRICS;
    } catch {
      return DEFAULT_METRICS;
    }
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [editGoal, setEditGoal] = React.useState<Record<string, string>>({});
  const [customLabel, setCustomLabel] = React.useState('');

  const resolveValue = (type: MetricType): number => {
    const values: Record<MetricType, number> = {
      revenue: metrics.revenue,
      clients: clientsCount,
      appointments: metrics.todayAppointments,
      avg_ticket: metrics.avgTicket,
      growth: metrics.growth,
      retention: 68,
      team: metrics.activeStaffPercent,
      custom: 0,
    };
    return values[type] ?? 0;
  };

  const formatValue = (value: number, unit?: DashboardMetric['unit']) => {
    if (unit === 'currency') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    if (unit === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return String(Math.round(value));
  };

  const saveItems = (nextItems: DashboardMetric[]) => {
    setItems(nextItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  };

  const toggleVisibility = (id: string) => {
    saveItems(items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)));
  };

  const updateGoal = (id: string, goal: number) => {
    saveItems(items.map((item) => (item.id === id ? { ...item, goal } : item)));
  };

  const addCustomMetric = () => {
    if (!customLabel.trim()) return;

    saveItems([
      ...items,
      {
        id: `c_${Date.now()}`,
        type: 'custom',
        label: customLabel,
        icon: 'star',
        color: 'amber',
        goal: 100,
        unit: 'number',
        visible: true,
      },
    ]);
    setCustomLabel('');
  };

  const visibleItems = items.filter((item) => item.visible);

  return (
    <div className="space-y-3">
      {visibleItems.length > 0 && (
        <div className={`grid gap-4 grid-cols-2 ${getColumnsClass(visibleItems.length)}`}>
          {visibleItems.map((item) => {
            const value = resolveValue(item.type);
            const progress = item.goal ? Math.min(100, Math.round((value / item.goal) * 100)) : null;
            const colorClass = METRIC_COLORS[item.color] || METRIC_COLORS.primary;

            return (
              <div key={item.id} className="card-boutique p-5 relative overflow-hidden hover:scale-[1.01] transition-transform duration-200">
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${colorClass.split(' ')[0]}`} />
                <div className={`size-10 rounded-xl border flex items-center justify-center mb-3 ${colorClass}`}>
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{item.label}</p>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{formatValue(value, item.unit)}</p>
                {progress !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                      <span>Meta: {formatValue(item.goal || 0, item.unit)}</span>
                      <span className="font-black">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          progress >= 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            isEditing
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-sm">{isEditing ? 'check' : 'tune'}</span>
          {isEditing ? 'Concluir' : 'Personalizar Metricas'}
        </button>
      </div>

      {isEditing && (
        <div className="card-boutique p-5 border-primary/20 animate-fade-in">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">tune</span>
            Configurar Painel de Metricas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.visible
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                }`}
              >
                <button
                  onClick={() => toggleVisibility(item.id)}
                  className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.visible ? 'bg-primary border-primary' : 'border-slate-300 dark:border-white/20'
                  }`}
                >
                  {item.visible && (
                    <span className="material-symbols-outlined text-white" style={{ fontSize: '10px' }}>
                      check
                    </span>
                  )}
                </button>
                <span className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${METRIC_COLORS[item.color]}`}>
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-white flex-1 truncate">{item.label}</span>
                {item.visible && (
                  <input
                    type="number"
                    title={`Meta de ${item.label}`}
                    placeholder="Meta"
                    value={editGoal[item.id] ?? item.goal ?? ''}
                    onChange={(event) => setEditGoal({ ...editGoal, [item.id]: event.target.value })}
                    onBlur={() => {
                      if (editGoal[item.id]) {
                        updateGoal(item.id, Number(editGoal[item.id]));
                      }
                    }}
                    className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] text-right font-bold outline-none text-slate-900 dark:text-white"
                  />
                )}
                {item.type === 'custom' && (
                  <button onClick={() => saveItems(items.filter((current) => current.id !== item.id))} className="text-red-400 hover:text-red-600 shrink-0">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
            <input
              type="text"
              placeholder="Nova metrica personalizada..."
              title="Nome da nova metrica"
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addCustomMetric()}
              className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={addCustomMetric}
              disabled={!customLabel.trim()}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Adicionar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Ajuste a meta ao lado de cada metrica. A barra de progresso e atualizada em tempo real.</p>
        </div>
      )}
    </div>
  );
};

