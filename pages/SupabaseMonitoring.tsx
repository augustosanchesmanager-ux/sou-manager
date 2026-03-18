import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import { supabaseMonitorMock } from '../components/supabase-monitor/mockData';
import {
  AutomationRule,
  MonitorAlert,
  MonitorRange,
  NotificationChannel,
  ResourceMetric,
  SupabaseMonitorSnapshot,
} from '../components/supabase-monitor/types';
import { supabase } from '../services/supabaseClient';

const rangeOptions: { id: MonitorRange; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
];

const iconMap = {
  database: Database,
  activity: Activity,
  cpu: Cpu,
  wifi: Wifi,
  shield: Shield,
  'hard-drive': HardDrive,
};

const lineColorMap: Record<string, string> = {
  database_size: '#E5A158',
  requests: '#0EA5E9',
  cpu: '#F97316',
  bandwidth: '#10B981',
  auth_users: '#6366F1',
  storage: '#EF4444',
};

const formatNumber = (value: number, unit: string) => {
  if (unit === 'req' || unit === 'users') {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  }

  if (unit === '%') {
    return `${value.toFixed(0)}%`;
  }

  if (unit === 'MB') {
    return `${value.toFixed(0)} MB`;
  }

  return `${value.toFixed(2)} ${unit}`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const getUsagePct = (resource: ResourceMetric) => Math.min(100, (resource.current / resource.limit) * 100);

const getUsageTone = (pct: number) => {
  if (pct >= 85) {
    return {
      badge: 'text-red-600 bg-red-500/10 border-red-500/20',
      progress: 'bg-red-500',
      soft: 'from-red-500/15 via-red-500/5 to-transparent',
      text: 'Crítico',
    };
  }

  if (pct >= 60) {
    return {
      badge: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      progress: 'bg-amber-500',
      soft: 'from-amber-500/15 via-amber-500/5 to-transparent',
      text: 'Atenção',
    };
  }

  return {
    badge: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
    progress: 'bg-emerald-500',
    soft: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    text: 'Saudável',
  };
};

const getTrendLabel = (trend: ResourceMetric['trend']) => {
  if (trend === 'up') return 'Subindo';
  if (trend === 'down') return 'Descendo';
  return 'Estável';
};

const filterHistory = (resource: ResourceMetric, range: MonitorRange) => {
  if (range === 'today') return resource.history.slice(-7);
  if (range === '7d') return resource.history.slice(-7);
  return resource.history.slice(-30);
};

const buildRealtimeSnapshot = (data: SupabaseMonitorSnapshot): SupabaseMonitorSnapshot => ({
  ...data,
  lastUpdatedAt: new Date().toISOString(),
});

const deriveAlertsFromResources = (resources: ResourceMetric[]): MonitorAlert[] => {
  const now = new Date().toISOString();

  return resources
    .map((resource) => {
      const pct = getUsagePct(resource);
      if (pct < 70) return null;

      return {
        id: `derived-${resource.id}`,
        resourceId: resource.id,
        resourceLabel: resource.label,
        message:
          pct >= 90
            ? `${resource.label} ultrapassou 90% e exige acao imediata para evitar bloqueio.`
            : `${resource.label} atingiu ${pct.toFixed(0)}% do limite e entrou em zona de alerta.`,
        level: pct >= 90 ? 'critical' : 'warning',
        usagePct: pct,
        createdAt: now,
        active: true,
      };
    })
    .filter(Boolean) as MonitorAlert[];
};

const SupabaseMonitoring: React.FC = () => {
  const [range, setRange] = useState<MonitorRange>('7d');
  const [snapshot, setSnapshot] = useState<SupabaseMonitorSnapshot>(buildRealtimeSnapshot(supabaseMonitorMock));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const [usageLogsRes, alertsRes, channelsRes] = await Promise.all([
        supabase
          .from('usage_logs')
          .select('resource_type, value, limit_value, unit, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('alerts')
          .select('id, resource_type, message, level, usage_pct, created_at, resolved_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('notification_channels')
          .select('id, channel_type, target, is_enabled, last_triggered_at')
          .order('created_at', { ascending: true }),
      ]);

      if (
        usageLogsRes.error ||
        !usageLogsRes.data ||
        usageLogsRes.data.length === 0 ||
        alertsRes.error ||
        channelsRes.error
      ) {
        setSnapshot(buildRealtimeSnapshot(supabaseMonitorMock));
        return;
      }

      const grouped = usageLogsRes.data.reduce<Record<string, typeof usageLogsRes.data>>((acc, row) => {
        acc[row.resource_type] = acc[row.resource_type] || [];
        acc[row.resource_type].push(row);
        return acc;
      }, {});

      const resources = supabaseMonitorMock.resources.map((resource) => {
        const resourceRows = grouped[resource.id];
        if (!resourceRows?.length) return resource;

        const latest = resourceRows[resourceRows.length - 1];
        const previous = resourceRows[Math.max(0, resourceRows.length - 2)] || latest;

        return {
          ...resource,
          current: Number(latest.value),
          limit: Number(latest.limit_value ?? resource.limit),
          unit: latest.unit || resource.unit,
          history: resourceRows.map((row) => ({
            timestamp: row.created_at,
            value: Number(row.value),
          })),
          trend:
            Number(latest.value) > Number(previous.value)
              ? 'up'
              : Number(latest.value) < Number(previous.value)
                ? 'down'
                : 'stable',
        } as ResourceMetric;
      });

      const alerts = [
        ...deriveAlertsFromResources(resources),
        ...(alertsRes.data || []).map((alert) => ({
          id: alert.id,
          resourceId: alert.resource_type,
          resourceLabel: supabaseMonitorMock.resources.find((resource) => resource.id === alert.resource_type)?.label || alert.resource_type,
          message: alert.message,
          level: alert.level,
          usagePct: Number(alert.usage_pct ?? 0),
          createdAt: alert.created_at,
          active: !alert.resolved_at,
        })),
      ];

      const channels = (channelsRes.data || []).map((channel) => ({
        id: channel.id,
        type: channel.channel_type,
        target: channel.target,
        enabled: channel.is_enabled,
        lastTriggeredAt: channel.last_triggered_at,
      })) as NotificationChannel[];

      setSnapshot({
        lastUpdatedAt: new Date().toISOString(),
        resources,
        alerts,
        channels: channels.length ? channels : supabaseMonitorMock.channels,
        automations: supabaseMonitorMock.automations,
      });
    } catch {
      setSnapshot(buildRealtimeSnapshot(supabaseMonitorMock));
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await loadSnapshot();
      setLoading(false);
    };

    bootstrap();
  }, [loadSnapshot]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
    setToast({ message: 'Dados de monitoramento atualizados.', type: 'success' });
  }, [loadSnapshot]);

  const resources = snapshot.resources;
  const activeAlerts = snapshot.alerts.filter((alert) => alert.active).sort((a, b) => b.usagePct - a.usagePct);
  const alertHistory = snapshot.alerts.filter((alert) => !alert.active).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const overallRisk = useMemo(() => {
    const highestPct = Math.max(...resources.map(getUsagePct));
    const resourcesAbove70 = resources.filter((resource) => getUsagePct(resource) >= 70).length;
    const projectedBreaches = resources.filter((resource) => resource.etaDays !== null && resource.etaDays <= 10).length;
    const score = Math.min(100, highestPct * 0.6 + resourcesAbove70 * 10 + projectedBreaches * 8);
    return Math.round(score);
  }, [resources]);

  const overallStatus = useMemo(() => {
    if (overallRisk >= 85) return 'Crítico';
    if (overallRisk >= 60) return 'Atenção';
    return 'Saudável';
  }, [overallRisk]);

  const statusTone =
    overallStatus === 'Crítico'
      ? 'text-red-600 bg-red-500/10 border-red-500/20'
      : overallStatus === 'Atenção'
        ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
        : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';

  const lineChartData = useMemo(() => {
    const selectedResources = resources.map((resource) => ({
      resource,
      history: filterHistory(resource, range),
    }));

    const longest = Math.max(...selectedResources.map((item) => item.history.length));

    return Array.from({ length: longest }, (_, index) => {
      const row: Record<string, string | number> = {};
      selectedResources.forEach(({ resource, history }) => {
        const point = history[index];
        if (!point) return;
        row.label = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }).format(new Date(point.timestamp));
        row[resource.id] = Number(((point.value / resource.limit) * 100).toFixed(2));
      });
      return row;
    });
  }, [range, resources]);

  const barChartData = useMemo(
    () =>
      resources.map((resource) => ({
        name: resource.label,
        usage: Number(getUsagePct(resource).toFixed(1)),
      })),
    [resources],
  );

  const growthChartData = useMemo(() => {
    const database = resources.find((resource) => resource.id === 'database_size');
    if (!database) return [];

    return filterHistory(database, range).map((point) => ({
      label: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(point.timestamp)),
      size: point.value,
    }));
  }, [range, resources]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(229,161,88,0.22),_transparent_32%),linear-gradient(135deg,#0f172a,_#111827_45%,#1f2937)] p-6 shadow-2xl shadow-slate-950/10 dark:border-white/10 md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.05),transparent)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-primary-light">Infraestrutura SaaS</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white display-font">Monitoramento Supabase</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Controle de consumo, limites e risco de estouro do plano gratuito com foco em decisao rapida.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border px-4 py-3 backdrop-blur ${statusTone}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em]">Status Geral</p>
              <p className="mt-2 text-lg font-black">{overallStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">Ultima Atualizacao</p>
              <p className="mt-2 text-sm font-bold">{formatDateTime(snapshot.lastUpdatedAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">Risco de Estouro</p>
              <p className="mt-2 text-2xl font-black">{overallRisk}%</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-2xl border border-white/10 bg-white/5 p-1">
            {rangeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setRange(option.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  range === option.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            className="rounded-2xl border-white/10 bg-white text-slate-900 hover:bg-slate-100"
            onClick={handleRefresh}
            isLoading={refreshing}
          >
            {!refreshing && <RefreshCw className="h-4 w-4" />}
            Atualizar dados
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resources.map((resource) => {
          const pct = getUsagePct(resource);
          const tone = getUsageTone(pct);
          const Icon = iconMap[resource.icon as keyof typeof iconMap] || Zap;

          return (
            <article key={resource.id} className="card-boutique relative overflow-hidden p-5">
              <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${tone.soft}`} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{resource.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{resource.description}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${tone.badge}`}>
                  {tone.text}
                </span>
              </div>

              <div className="relative mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Uso atual</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white display-font">
                    {formatNumber(resource.current, resource.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Limite free</p>
                  <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    {formatNumber(resource.limit, resource.unit)}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Percentual de uso</span>
                  <span className="text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-white/5">
                  <div className={`h-3 rounded-full ${tone.progress}`} style={{ width: `${Math.max(6, pct)}%` }} />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {resource.trend === 'up' ? <TrendingUp className="h-4 w-4 text-amber-500" /> : null}
                  {resource.trend === 'down' ? <TrendingDown className="h-4 w-4 text-emerald-500" /> : null}
                  {resource.trend === 'stable' ? <Activity className="h-4 w-4 text-slate-400" /> : null}
                  {getTrendLabel(resource.trend)}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Previsao</p>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    {resource.etaDays !== null ? `${resource.etaDays} dias` : 'Sem risco'}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="card-boutique p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Uso ao longo do tempo</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Evolucao dos recursos</h2>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Base percentual por limite
            </div>
          </div>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} contentStyle={{ borderRadius: 16, border: '1px solid rgba(148,163,184,0.15)' }} />
                <Legend />
                {resources.map((resource) => (
                  <Line
                    key={resource.id}
                    type="monotone"
                    dataKey={resource.id}
                    stroke={lineColorMap[resource.id] || '#E5A158'}
                    strokeWidth={2.5}
                    dot={false}
                    name={resource.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-boutique p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Consumo atual</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Comparativo por recurso</h2>
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis type="number" tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="usage" radius={[0, 10, 10, 0]} fill="#E5A158" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card-boutique p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Crescimento do banco</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Database growth</h2>
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChartData}>
                <defs>
                  <linearGradient id="dbGrowthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E5A158" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#E5A158" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `${value} MB`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(0)} MB`} />
                <Area type="monotone" dataKey="size" stroke="#E5A158" fill="url(#dbGrowthFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-boutique p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Previsao</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Risco de bloqueio</h2>
          <div className="mt-5 space-y-4">
            {resources
              .filter((resource) => resource.etaDays !== null)
              .sort((a, b) => (a.etaDays || 999) - (b.etaDays || 999))
              .map((resource) => {
                const pct = getUsagePct(resource);
                const tone = getUsageTone(pct);
                return (
                  <div key={resource.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{resource.label}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Voce atingira o limite em <span className="font-black text-slate-900 dark:text-white">{resource.etaDays} dias</span>
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${tone.badge}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-boutique p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Alertas inteligentes</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Alertas ativos</h2>
            </div>
            <div className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-red-600">
              {activeAlerts.length} ativos
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {activeAlerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                Nenhum alerta ativo no momento.
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-4 ${
                    alert.level === 'critical' ? 'border-red-500/20 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`mt-0.5 h-5 w-5 ${alert.level === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950 dark:text-white">{alert.resourceLabel}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                          alert.level === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {alert.level === 'critical' ? 'Crítico' : 'Warning'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {formatDateTime(alert.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-950 dark:text-white">{alert.usagePct.toFixed(0)}%</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Uso</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-boutique p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Historico</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Alertas anteriores</h2>
          <div className="mt-6 space-y-3">
            {alertHistory.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{alert.message}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {formatDateTime(alert.createdAt)}
                    </p>
                  </div>
                  <span className="text-lg font-black text-slate-950 dark:text-white">{alert.usagePct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card-boutique overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Tabela detalhada</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Detalhamento tecnico</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/80 dark:bg-white/5">
                <tr className="text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-6 py-4">Recurso</th>
                  <th className="px-6 py-4">Uso atual</th>
                  <th className="px-6 py-4">Limite</th>
                  <th className="px-6 py-4">% uso</th>
                  <th className="px-6 py-4">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => {
                  const pct = getUsagePct(resource);
                  return (
                    <tr key={resource.id} className="border-t border-slate-200/70 text-sm dark:border-white/10">
                      <td className="px-6 py-4 font-bold text-slate-950 dark:text-white">{resource.label}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{formatNumber(resource.current, resource.unit)}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{formatNumber(resource.limit, resource.unit)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${getUsageTone(pct).badge}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-950 dark:text-white">{getTrendLabel(resource.trend)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-boutique p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Notificacoes</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white display-font">Canais ativos</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {snapshot.channels.map((channel: NotificationChannel) => (
                <div key={channel.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold capitalize text-slate-950 dark:text-white">{channel.type}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{channel.target}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                      channel.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white'
                    }`}>
                      {channel.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Ultimo disparo: {channel.lastTriggeredAt ? formatDateTime(channel.lastTriggeredAt) : 'Nunca'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-boutique p-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Automacoes</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">Motor preventivo</h2>
            <div className="mt-6 space-y-3">
              {snapshot.automations.map((automation: AutomationRule) => (
                <div key={automation.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{automation.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                      automation.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white'
                    }`}>
                      {automation.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{automation.description}</p>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Execucao: {automation.cadence}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SupabaseMonitoring;
