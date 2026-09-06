/**
 * P1.3 — Tipos TypeScript para o RPC get_dashboard_kpis
 *
 * Espelha o envelope JSONB retornado pela função PL/pgSQL.
 * Decisões incorporadas: D-EST-01, D-PERF-01, D-RET-01.
 */

// ─── Período suportado pelo RPC ─────────────────────────────────
export type DashboardKpiPeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

// ─── Seção meta ─────────────────────────────────────────────────
export interface DashboardKpiMeta {
  tenant_id: string;
  period: DashboardKpiPeriod;
  start: string;       // ISO timestamp
  end: string;         // ISO timestamp
  timezone: string;    // 'America/Sao_Paulo'
  generated_at: string;
  result_basis: 'transactional';
  scope_staff_id: string | null;
}

// ─── Seção financial (K1-K5) ────────────────────────────────────
export interface DashboardKpiFinancial {
  revenue: number;       // K1: Σ income(paid) − reversões
  expenses: number;      // K2: Σ expense(paid) − transações de reversão
  result: number;        // K3: revenue − expenses
  reversals: number;     // Σ financial_reversals.amount (originais do período)
  average_ticket: number; // K4: revenue / nº transações income com saldo > 0
  growth: number | null;  // K5: (revenue − revenue_prev) / revenue_prev (NULL se base = 0)
}

// ─── Seção clients (K6-K7, K10) ────────────────────────────────
export interface DashboardKpiClients {
  active_clients: number;   // K7: COUNT(DISTINCT client_id) elegível período atual
  new_clients: number;      // K10: COUNT(*) clients.created_at no período
  base_clients: number;     // K6: COUNT(DISTINCT client_id) elegível período anterior
  returned_clients: number; // K6: base ∩ período atual
  retention: number | null; // K6: returned / base (NULL se base = 0)
}

// ─── Seção operations (K8) ──────────────────────────────────────
export interface DashboardKpiOperations {
  total: number;      // K8: total appointments no período
  completed: number;  // K8: completados
  cancelled: number;  // K8: cancelados
  no_show: number;    // K8: no_show
}

// ─── Seção staff (K9) ───────────────────────────────────────────
export interface DashboardKpiStaffEntry {
  professional_id: string;
  professional_name: string;
  atendimentos: number;      // COUNT(DISTINCT comanda_item_id)
  receita_gerada: number;    // Σ base do participante (percentage/fixed)
}

// ─── Resultado completo do RPC ──────────────────────────────────
export interface DashboardKpiResult {
  meta: DashboardKpiMeta;
  financial: DashboardKpiFinancial;
  clients: DashboardKpiClients;
  operations: DashboardKpiOperations;
  staff: DashboardKpiStaffEntry[];
}

// ─── Mapeamento KPI → seção (para referência / testes) ──────────
export const KPI_SECTIONS = {
  K1: 'financial.revenue',
  K2: 'financial.expenses',
  K3: 'financial.result',
  K4: 'financial.average_ticket',
  K5: 'financial.growth',
  K6: 'clients.retention',
  K7: 'clients.active_clients',
  K8: 'operations.total',
  K9: 'staff',
  K10: 'clients.new_clients',
} as const;
