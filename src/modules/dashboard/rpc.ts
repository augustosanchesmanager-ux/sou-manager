/**
 * P1.3 — RPC client para get_dashboard_kpis
 *
 * Chama o RPC server-side SECURITY DEFINER que retorna KPIs canônicos.
 * Decisões: D-EST-01, D-PERF-01, D-RET-01.
 *
 * ⚠ NÃO aplicar migration sem autorização do PO.
 */

import { supabase } from '../../../services/supabaseClient';
import type { DashboardKpiPeriod, DashboardKpiResult } from './kpiTypes';

/**
 * Busca KPIs canônicos via RPC server-side.
 *
 * @param period - Período: today|yesterday|week|month|quarter|year (default: 'month')
 * @param staffId - UUID do profissional (opcional; valida pertencimento ao tenant)
 * @returns DashboardKpiResult com seções meta/financial/clients/operations/staff
 * @throws Error se RPC retornar erro (autenticado, tenant, permissão, período)
 */
export const getDashboardKpis = async (
  period: DashboardKpiPeriod = 'month',
  staffId?: string | null,
): Promise<DashboardKpiResult> => {
  const { data, error } = await supabase.rpc('get_dashboard_kpis' as never, {
    p_period: period,
    p_staff_id: staffId ?? null,
  } as never);

  if (error) {
    throw new Error(`get_dashboard_kpis failed: ${error.message}`);
  }

  return data as DashboardKpiResult;
};
