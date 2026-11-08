import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { formatCurrency } from '../../shared/format/currency';
import type { BiCockpitData } from '../../src/modules/bi/biCockpitService';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Users,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Sparkles,
  Scissors,
  ShoppingBag,
  Crown,
} from 'lucide-react';

interface BiExecutiveCockpitProps {
  data: BiCockpitData;
  loading?: boolean;
}

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/95 border border-zinc-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs">
        <p className="font-bold text-stone-200 border-b border-zinc-800 pb-1.5 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-stone-400">
                <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-semibold text-stone-100">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-zinc-900/95 border border-zinc-700/80 p-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.payload.color }} />
          <span className="font-semibold text-stone-200">{entry.name}</span>
        </div>
        <div className="mt-1 text-stone-300 font-bold">
          {formatCurrency(entry.value)} ({entry.payload.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

export const BiExecutiveCockpit: React.FC<BiExecutiveCockpitProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="animate-spin size-8 border-2 border-[#B88A44] border-t-transparent rounded-full" />
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
          Sincronizando inteligência estratégica...
        </span>
      </div>
    );
  }

  const { metrics, timeline, composition, goals, radar } = data;

  return (
    <div className="space-y-6">
      {/* 1. LINHA DE KPIS EXECUTIVOS COM MINI-ESTRUTURA ATELIER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Líquido */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-[#B88A44]/40 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Lucro Líquido Real</span>
            <div className="size-8 rounded-lg bg-[#B88A44]/15 border border-[#B88A44]/30 flex items-center justify-center text-[#B88A44]">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight font-sans">
            {formatCurrency(metrics.netRevenue)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
            <span className="text-stone-400">Margem real:</span>
            <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
              {metrics.netProfitMargin}%
            </span>
          </div>
        </div>

        {/* Card 2: Ticket Médio */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-[#B88A44]/40 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight font-sans">
            {formatCurrency(metrics.averageTicket)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
            <span className="text-stone-400">Por comanda fechada</span>
            <span className="font-bold text-stone-300">{metrics.totalAppointments} atendimentos</span>
          </div>
        </div>

        {/* Card 3: Taxa de Ocupação */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-[#B88A44]/40 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ocupação das Cadeiras</span>
            <div className="size-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
              <Percent size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight font-sans">
            {metrics.occupancyRate}%
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
            <span className="text-stone-400">Ritmo da bancada</span>
            <span
              className={`font-bold ${
                metrics.occupancyRate >= 75
                  ? 'text-emerald-400'
                  : metrics.occupancyRate >= 45
                    ? 'text-[#B88A44]'
                    : 'text-stone-400'
              }`}
            >
              {metrics.occupancyRate >= 75 ? 'Excelente' : metrics.occupancyRate >= 45 ? 'Equilibrado' : 'Ocioso'}
            </span>
          </div>
        </div>

        {/* Card 4: Faturamento Bruto & Crescimento */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-[#B88A44]/40 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Bruto</span>
            <div className="size-8 rounded-lg bg-emerald-950/40 border border-emerald-800/30 flex items-center justify-center text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight font-sans">
            {formatCurrency(metrics.grossRevenue)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
            <span className="text-stone-400">Despesas & Repasses:</span>
            <span className="font-bold text-red-400">
              -{formatCurrency(metrics.totalExpenses + metrics.grossRevenue - metrics.netRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. LINHA PRINCIPAL DE GRÁFICOS: CURVA DE LIQUIDEZ (2/3) + DONUT DE COMPOSIÇÃO (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Curva de Tendência de Liquidez */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#B88A44] animate-pulse" />
                Curva de Liquidez & Faturamento
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Evolução diária de receita bruta, margem líquida e despesas operacionais apuradas.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-stone-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#B88A44]" /> Bruto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" /> Líquido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-400" /> Custos
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B88A44" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#B88A44" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomAreaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="grossRevenue"
                  name="Faturamento Bruto"
                  stroke="#B88A44"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#goldGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="netRevenue"
                  name="Lucro Líquido"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#emeraldGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Despesas"
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#redGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rosca de Composição de Faturamento */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              Composição da Receita
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Participação de serviços, balcão e assinaturas no volume total.
            </p>
          </div>

          <div className="h-[210px] w-full relative flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={composition}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={84}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="#09090b"
                  strokeWidth={2}
                >
                  {composition.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Núcleo Central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-stone-400">Total Faturado</span>
              <span className="text-sm font-extrabold text-stone-100">
                {formatCurrency(composition.reduce((acc, c) => acc + c.value, 0))}
              </span>
            </div>
          </div>

          {/* Legenda Customizada */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            {composition.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-stone-300 font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-200">{formatCurrency(c.value)}</span>
                  <span className="text-[10px] font-bold text-stone-400">({c.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. LINHA INFERIOR: PROGRESSO DE METAS (1/2) + RADAR MULTIDIMENSIONAL DA EQUIPE (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progresso de Metas da Unidade (FlowBoard style) */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Target size={18} className="text-[#B88A44]" />
                Metas Mensais da Sanchez Barber
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Atingimento real e projeção de fechamento (*run-rate*) com base na cadência atual.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {goals.map((goal, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-200">{goal.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400">
                      Realizado:{' '}
                      <strong className="text-stone-200">
                        {goal.unit === 'currency' ? formatCurrency(goal.current) : goal.current}
                      </strong>{' '}
                      /{' '}
                      {goal.unit === 'currency' ? formatCurrency(goal.target) : goal.target}
                    </span>
                    <span
                      className={`font-black text-[11px] px-2 py-0.5 rounded border ${
                        goal.percentage >= 80
                          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                          : goal.percentage >= 50
                            ? 'text-[#B88A44] bg-[#B88A44]/15 border-[#B88A44]/30'
                            : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                      }`}
                    >
                      {goal.percentage}%
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso em Latão */}
                <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800 p-0.5 shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      goal.percentage >= 80
                        ? 'bg-gradient-to-r from-[#B88A44] to-emerald-400'
                        : 'bg-gradient-to-r from-amber-600 to-[#B88A44]'
                    }`}
                    style={{ width: `${goal.percentage}%` }}
                  />
                </div>

                {/* Projeção de Fim de Mês */}
                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-[#B88A44]" />
                    Projeção de fechamento:
                  </span>
                  <span className="font-semibold text-stone-300">
                    {goal.unit === 'currency'
                      ? formatCurrency(goal.projectedMonthEnd)
                      : `${goal.projectedMonthEnd} atendimentos`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar Multidimensional dos Barbeiros (Dark Gold style) */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Scissors size={18} className="text-[#B88A44]" />
                Radar de Eficiência da Equipe
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Mapeamento de 5 dimensões operacionais por profissional ativo.
              </p>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar.points} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" stroke="#a1a1aa" fontSize={11} />
                <PolarRadiusAxis stroke="#3f3f46" fontSize={9} angle={30} domain={[0, 100]} />
                {radar.staffProfiles.map((staff) => (
                  <Radar
                    key={staff.id}
                    name={staff.name}
                    dataKey={staff.name}
                    stroke={staff.color}
                    fill={staff.color}
                    fillOpacity={0.25}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(val) => <span className="text-stone-300 font-semibold">{val}</span>}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-stone-400 text-center border-t border-zinc-800/80 pt-2.5">
            Métricas normalizadas (0 a 100) considerando volume, faturamento, ticket médio, presença e venda de balcão.
          </div>
        </div>
      </div>
    </div>
  );
};
