import type React from 'react';
import type {
  GoalContext,
  PerformanceTotals,
  TenantGoal,
} from '../../src/modules/performance/types';

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

const pctLabel = (value: number) =>
  `${value.toFixed(1).replace('.', ',')}%`;

interface GoalBarProps {
  label: string;
  current: number;
  target: number;
  pacePercent: number | null;
  formatter: (value: number) => string;
}

const GoalBar: React.FC<GoalBarProps> = ({
  label,
  current,
  target,
  pacePercent,
  formatter,
}) => {
  const percent = target > 0 ? (current / target) * 100 : 0;
  const fill = Math.min(100, Math.max(0, percent));
  const overflow = Math.max(0, percent - 100);
  const ariaMax = Math.max(100, Math.ceil(percent));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-ink">{label}</span>
        <span className="text-xs font-black tabular-nums text-ink">
          {pctLabel(percent)}
        </span>
      </div>

      <div
        className="relative mt-2 h-2.5 rounded-full bg-line/70"
        role="progressbar"
        aria-label={`${label}: ${pctLabel(percent)} da meta`}
        aria-valuemin={0}
        aria-valuemax={ariaMax}
        aria-valuenow={Math.round(percent)}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${fill}%` }}
        />
        {pacePercent !== null && (
          <span
            aria-hidden="true"
            title={`Ritmo esperado até hoje: ${pctLabel(pacePercent)}`}
            className="absolute -top-1 h-[18px] w-px bg-ink ring-1 ring-card"
            style={{ left: `${Math.min(100, Math.max(0, pacePercent))}%` }}
          />
        )}
        {overflow > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-card"
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-ink-soft">
        <span className="tabular-nums">
          {formatter(current)} de {formatter(target)}
        </span>
        <span className="tabular-nums">
          {overflow > 0
            ? `+${pctLabel(overflow)} acima da meta`
            : pacePercent !== null
              ? `ritmo ${pctLabel(pacePercent)}`
              : null}
        </span>
      </div>
    </div>
  );
};

interface GoalProgressProps {
  goal: TenantGoal | null;
  goalContext: GoalContext;
  totals: PerformanceTotals | null;
  loading: boolean;
  onManageGoals: () => void;
  onUseCurrentMonth: () => void;
}

const unavailableCopy: Record<
  Exclude<GoalContext['reason'], null>,
  { title: string; description: string; action: 'goals' | 'month' }
> = {
  no_goal: {
    title: 'Nenhuma meta ativa',
    description:
      'Defina a meta mensal de faturamento e de atendimentos para acompanhar o ritmo da unidade.',
    action: 'goals',
  },
  partial_range: {
    title: 'Recorte parcial do mês',
    description:
      'A meta é mensal. Comparar uma semana com a meta do mês produziria um percentual sem significado, então o bloco fica oculto.',
    action: 'month',
  },
  multi_month: {
    title: 'Recorte com mais de um mês',
    description:
      'A meta é mensal e não pode ser comparada com um intervalo que atravessa meses. Selecione um mês para acompanhar.',
    action: 'month',
  },
};

const GoalProgress: React.FC<GoalProgressProps> = ({
  goal,
  goalContext,
  totals,
  loading,
  onManageGoals,
  onUseCurrentMonth,
}) => {
  const revenueGoal = goal?.revenue_goal ?? 0;
  const appointmentsGoal = goal?.appointments_goal ?? 0;

  return (
    <section
      aria-labelledby="performance-goal-title"
      className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="performance-goal-title"
            className="font-display text-base font-bold tracking-tight text-ink"
          >
            Meta do mês
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Realizado contra o alvo da unidade.
          </p>
        </div>
        <button
          type="button"
          onClick={onManageGoals}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Gerenciar
          <span aria-hidden="true" className="material-symbols-outlined text-sm">
            arrow_forward
          </span>
        </button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-5" aria-hidden="true">
          <div>
            <div className="h-3 w-28 animate-pulse rounded bg-line/60" />
            <div className="mt-2 h-2.5 w-full animate-pulse rounded-full bg-line/50" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded bg-line/40" />
          </div>
          <div>
            <div className="h-3 w-32 animate-pulse rounded bg-line/60" />
            <div className="mt-2 h-2.5 w-full animate-pulse rounded-full bg-line/50" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded bg-line/40" />
          </div>
        </div>
      ) : !goalContext.applies || !goal ? (
        <div className="mt-6 flex flex-1 flex-col items-start justify-center gap-2 rounded-xl border border-dashed border-line p-4">
          <p className="text-sm font-semibold text-ink">
            {unavailableCopy[goalContext.reason ?? 'no_goal'].title}
          </p>
          <p className="text-xs text-ink-soft">
            {unavailableCopy[goalContext.reason ?? 'no_goal'].description}
          </p>
          <button
            type="button"
            onClick={
              (goalContext.reason ?? 'no_goal') === 'no_goal'
                ? onManageGoals
                : onUseCurrentMonth
            }
            className="mt-1 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-gold-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {(goalContext.reason ?? 'no_goal') === 'no_goal'
              ? 'Definir metas'
              : 'Usar mês atual'}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col justify-center gap-6">
          {revenueGoal > 0 && (
            <GoalBar
              label="Faturamento"
              current={totals?.totalRevenue ?? 0}
              target={revenueGoal}
              pacePercent={goalContext.pacePercent}
              formatter={fmt}
            />
          )}
          {appointmentsGoal > 0 && (
            <GoalBar
              label="Atendimentos"
              current={totals?.totalAttendances ?? 0}
              target={appointmentsGoal}
              pacePercent={goalContext.pacePercent}
              formatter={fmtNumber}
            />
          )}
          <p className="mt-auto text-[11px] text-ink-soft">
            O marcador vertical indica o ritmo esperado até hoje.
          </p>
        </div>
      )}
    </section>
  );
};

export default GoalProgress;
