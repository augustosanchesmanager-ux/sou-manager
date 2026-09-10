/**
 * P1.1 — Central de Relatórios: mapeamento preset → período canônico
 *
 * Regra arquitetural (Design Gate §2/§5):
 *   - Intervalo livre pode existir para exploração/detalhamento, mas não deve
 *     provocar uma segunda implementação dos KPIs canônicos.
 *   - Presets com correspondência semântica no contrato P1.3 traduzem direto.
 *   - Presets sem equivalente canônico (last_7_days/last_month/custom) ficam
 *     ANCORADOS no último período canônico renderizado — nunca em intervalo
 *     sem fonte RPC.
 */

import type { DashboardKpiPeriod } from '../dashboard/kpiTypes';
import type { DatePreset } from '../../../components/ui/DateRangeFilter';

/** Presets que possuem correspondência semântica direta no contrato P1.3. */
export const PRESET_TO_CANONICAL: Partial<Record<DatePreset, DashboardKpiPeriod>> = {
  today: 'today',
  yesterday: 'yesterday',
  this_month: 'month',
  this_year: 'year',
};

/** Período canônico inicial (anchor default = mês corrente). */
export const INITIAL_CANONICAL_PERIOD: DashboardKpiPeriod = 'month';

export interface CanonicalResolution {
  /** Período efetivo a usar no getDashboardKpis(). */
  period: DashboardKpiPeriod;
  /** Novo valor de anchor (atualizado apenas quando o preset mapeia). */
  anchor: DashboardKpiPeriod;
  /** true quando o preset tem correspondência direta no contrato P1.3. */
  isMapped: boolean;
}

/**
 * Resolve o período canônico a partir do preset ativo.
 *
 * - Presets mapeados atualizam o anchor e retornam o período correspondente.
 * - Presets não mapeados (last_7_days, last_month, custom) mantêm o anchor —
 *   os cards continuam representando o último período canônico renderizado.
 */
export const resolveCanonicalPeriod = (
  preset: DatePreset,
  anchor: DashboardKpiPeriod,
): CanonicalResolution => {
  const mapped = PRESET_TO_CANONICAL[preset];

  if (mapped) {
    return { period: mapped, anchor: mapped, isMapped: true };
  }

  return { period: anchor, anchor, isMapped: false };
};

const CANONICAL_PERIOD_LABELS: Record<DashboardKpiPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta semana',
  month: 'Este mês',
  quarter: 'Este trimestre',
  year: 'Este ano',
};

/** Rótulo pt-BR do período canônico (para o aviso anti-misleading §6). */
export const canonicalPeriodLabel = (period: DashboardKpiPeriod): string =>
  CANONICAL_PERIOD_LABELS[period];