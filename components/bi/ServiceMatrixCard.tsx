import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Sparkles, TrendingUp, Repeat, AlertCircle } from 'lucide-react';
import type { TopService } from '../../src/types/business-insights';
import {
  buildServiceMatrix2x2,
  type ServiceMatrixPoint,
  type ServiceQuadrant,
} from '../../src/modules/bi/biAnalyticsHelpers';

interface ServiceMatrixCardProps {
  services: TopService[];
}

const QUADRANT_META: Record<
  ServiceQuadrant,
  {
    label: string;
    color: string;
    badgeClass: string;
    action: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  star: {
    label: 'Estrelas',
    color: '#178A50',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    action: 'Alto volume e alto ticket. Proteja a qualidade e destaque na agenda.',
    Icon: Sparkles,
  },
  opportunity: {
    label: 'Oportunidades',
    color: '#D99A2B',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    action: 'Ticket alto, mas sai pouco. Crie combos, divulgue no WhatsApp ou tráfego pago.',
    Icon: TrendingUp,
  },
  traffic: {
    label: 'Motor de Giro',
    color: '#0F766E',
    badgeClass: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
    action: 'Traz movimento frequente. Use como porta de entrada para upsell na bancada.',
    Icon: Repeat,
  },
  review: {
    label: 'Revisar',
    color: '#8A8378',
    badgeClass: 'bg-stone-500/15 text-ink-soft border-line',
    action: 'Baixo giro e ticket menor. Avalie reajuste, combo ou simplificação do catálogo.',
    Icon: AlertCircle,
  },
};

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const ServiceMatrixCard: React.FC<ServiceMatrixCardProps> = ({ services }) => {
  const matrix = useMemo(() => buildServiceMatrix2x2(services), [services]);

  return (
    <div className="bg-card p-6 rounded-xl border border-line shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-dark dark:text-primary text-base bg-gold-soft p-1.5 rounded-lg">
              grid_view
            </span>
            Matriz Estratégica de Serviços (Volume × Ticket)
          </h3>
          <p className="text-xs text-ink-soft mt-1">
            Cruza quantas vezes cada serviço sai (eixo horizontal) com quanto rende por atendimento (eixo vertical) para separar o que gera lucro real do que só gera volume.
          </p>
        </div>
        {matrix.points.length > 0 && (
          <div className="text-[11px] text-ink-soft bg-cream border border-line rounded-lg px-3 py-1.5 shrink-0">
            Média: <strong className="text-ink">{matrix.avgVolume} atend.</strong> ·{' '}
            <strong className="text-ink">{formatBRL(matrix.avgTicket)}</strong>
          </div>
        )}
      </div>

      {matrix.points.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-cream border border-dashed border-line">
          <p className="text-xs text-ink-soft">
            Sem dados suficientes de serviços concluídos no período para montar a matriz 2×2.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[250px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ScatterChart margin={{ top: 14, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #E8DFC9)" />
                <XAxis
                  type="number"
                  dataKey="count"
                  name="Volume"
                  unit="x"
                  stroke="var(--color-ink-soft, #6B6252)"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="avgTicket"
                  name="Ticket Médio"
                  stroke="var(--color-ink-soft, #6B6252)"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v}`}
                />
                <ZAxis type="number" dataKey="revenue" range={[80, 320]} name="Receita Total" />
                <ReferenceLine
                  x={matrix.avgVolume}
                  stroke="#B88A44"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  y={matrix.avgTicket}
                  stroke="#B88A44"
                  strokeDasharray="4 4"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as ServiceMatrixPoint;
                    const meta = QUADRANT_META[item.quadrant];
                    return (
                      <div className="bg-card border border-line rounded-xl p-3 shadow-lg text-xs space-y-1 max-w-[230px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-ink">{item.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-ink-soft">
                          Volume: <strong className="text-ink">{item.count} atend.</strong> · Ticket:{' '}
                          <strong className="text-ink">{formatBRL(item.avgTicket)}</strong>
                        </p>
                        <p className="text-ink-soft">
                          Receita: <strong className="text-success">{formatBRL(item.revenue)}</strong> ({item.revenueShare}%)
                        </p>
                        <p className="text-[10px] text-ink-soft pt-1 border-t border-line">
                          {meta.action}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter data={matrix.points}>
                  {matrix.points.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={QUADRANT_META[entry.quadrant].color}
                      fillOpacity={0.85}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda explicativa dos 4 quadrantes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(['star', 'opportunity', 'traffic', 'review'] as ServiceQuadrant[]).map((q) => {
              const meta = QUADRANT_META[q];
              const Icon = meta.Icon;
              const items = matrix.points.filter((p) => p.quadrant === q);
              return (
                <div key={q} className="p-3 rounded-xl bg-cream border border-line space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                      <Icon className="w-3 h-3" />
                      {meta.label} ({items.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-soft leading-snug">{meta.action}</p>
                  {items.length > 0 && (
                    <p className="text-[11px] font-semibold text-ink truncate">
                      {items.map((i) => `${i.name} (${i.count}x)`).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
