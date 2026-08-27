import React, { useState, useEffect, useCallback } from 'react';
import { metrics } from '../src/lib/observability/metrics';
import { alerts } from '../src/lib/observability/alerts';
import { logger } from '../src/lib/observability/logger';
import type { MetricSummary, DashboardMetrics } from '../src/lib/observability/metrics';
import type { Alert, AlertRule } from '../src/lib/observability/alerts';
import type { LogEntry } from '../src/lib/observability/logger';

// ─── Types ──────────────────────────────────────────────────────

type DomainTab = 'overview' | 'checkout' | 'cashClosing' | 'appointments' | 'commission' | 'chefClub' | 'pipeline' | 'alerts' | 'logs';

interface DomainMetrics {
  operations: { success: number; error: number; total: number };
  latency: MetricSummary;
  recentLogs: LogEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────

const formatMs = (ms: number): string => {
  if (ms === 0) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatNumber = (n: number): string => {
  if (n === 0) return '—';
  return n.toLocaleString('pt-BR');
};

const severityColor = (s: string): string => {
  switch (s) {
    case 'critical': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
    case 'warning': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30';
    case 'info': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30';
    default: return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800';
  }
};

const levelColor = (l: string): string => {
  switch (l) {
    case 'error': return 'text-red-600 dark:text-red-400';
    case 'warn': return 'text-amber-600 dark:text-amber-400';
    case 'debug': return 'text-slate-400 dark:text-slate-500';
    default: return 'text-slate-600 dark:text-slate-300';
  }
};

// ─── Metric Card ────────────────────────────────────────────────

const MetricCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color?: string;
}> = ({ label, value, sub, icon, color = 'text-primary' }) => (
  <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${color}`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  </div>
);

// ─── Latency Bar ────────────────────────────────────────────────

const LatencyBar: React.FC<{ label: string; summary: MetricSummary }> = ({ label, summary }) => (
  <div className="flex items-center gap-3 py-2">
    <span className="text-xs text-slate-500 dark:text-slate-400 w-24 truncate">{label}</span>
    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary/60 rounded-full transition-all"
        style={{ width: `${Math.min(100, (summary.avg / 10000) * 100)}%` }}
      />
    </div>
    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 w-20 text-right">
      {formatMs(summary.avg)}
    </span>
    <span className="text-xs text-slate-400 dark:text-slate-500 w-16 text-right">
      p95 {formatMs(summary.p95)}
    </span>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────

const Observability: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DomainTab>('overview');
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setDashboardMetrics(metrics.getDashboardMetrics());
    setActiveAlerts(alerts.getActive());
    setAlertHistory(alerts.getHistory(20));
    setAlertRules(alerts.getAllRules());
    setRecentLogs(logger.getLogs({}).slice(-50).reverse());
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const getDomainMetrics = (prefix: string): DomainMetrics => {
    const success = metrics.getCounter(`${prefix}_success`);
    const error = metrics.getCounter(`${prefix}_error`);
    const latency = metrics.getSummary(`${prefix}_duration_ms`);
    const logs = recentLogs.filter(l => l.event.includes(prefix.replace('_', '.')));
    return {
      operations: { success, error, total: success + error },
      latency,
      recentLogs: logs.slice(0, 10),
    };
  };

  const checkoutMetrics = getDomainMetrics('Checkout.finish');
  const cashClosingMetrics = getDomainMetrics('CashClosing.close');
  const appointmentMetrics = getDomainMetrics('Appointment.create');
  const commissionMetrics = getDomainMetrics('Commission.loadLines');
  const chefClubMetrics = getDomainMetrics('ChefClub.deductCredits');

  const totalOps = checkoutMetrics.operations.total + cashClosingMetrics.operations.total +
    appointmentMetrics.operations.total + commissionMetrics.operations.total + chefClubMetrics.operations.total;
  const totalErrors = checkoutMetrics.operations.error + cashClosingMetrics.operations.error +
    appointmentMetrics.operations.error + commissionMetrics.operations.error + chefClubMetrics.operations.error;

  const tabs: { key: DomainTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Visão Geral', icon: 'dashboard' },
    { key: 'checkout', label: 'Checkout', icon: 'point_of_sale' },
    { key: 'cashClosing', label: 'Fechamento', icon: 'account_balance' },
    { key: 'appointments', label: 'Agendamentos', icon: 'calendar_month' },
    { key: 'commission', label: 'Comissões', icon: 'paid' },
    { key: 'chefClub', label: 'Club dos Chefes', icon: 'card_membership' },
    { key: 'pipeline', label: 'Pipeline', icon: 'cable' },
    { key: 'alerts', label: `Alertas${activeAlerts.length > 0 ? ` (${activeAlerts.length})` : ''}`, icon: 'notifications' },
    { key: 'logs', label: 'Logs', icon: 'receipt_long' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Observabilidade
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Métricas, alertas e logs em tempo real
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && dashboardMetrics && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Operações Totais" value={formatNumber(totalOps)} icon="play_circle" />
            <MetricCard
              label="Taxa de Sucesso"
              value={totalOps > 0 ? `${((1 - totalErrors / totalOps) * 100).toFixed(1)}%` : '—'}
              icon="check_circle"
              color="text-emerald-600"
            />
            <MetricCard
              label="Erros"
              value={formatNumber(totalErrors)}
              icon="error"
              color={totalErrors > 0 ? 'text-red-600' : 'text-slate-400'}
            />
            <MetricCard
              label="Alertas Ativos"
              value={formatNumber(activeAlerts.length)}
              icon="notifications_active"
              color={activeAlerts.length > 0 ? 'text-amber-600' : 'text-slate-400'}
            />
          </div>

          {/* Latency Overview */}
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Latência por Domínio</h3>
            <div className="space-y-1">
              <LatencyBar label="Checkout" summary={checkoutMetrics.latency} />
              <LatencyBar label="Fechamento" summary={cashClosingMetrics.latency} />
              <LatencyBar label="Agendamento" summary={appointmentMetrics.latency} />
              <LatencyBar label="Comissão" summary={commissionMetrics.latency} />
              <LatencyBar label="Club dos Chefes" summary={chefClubMetrics.latency} />
            </div>
          </div>

          {/* Business Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Checkouts" value={formatNumber(dashboardMetrics.business.checkoutsToday)} icon="point_of_sale" />
            <MetricCard label Ticket Médio={`R$ ${dashboardMetrics.business.averageTicket.toFixed(2)}`} value="" icon="attach_money" />
            <MetricCard label="Serviços" value={formatNumber(dashboardMetrics.business.servicesPerformed)} icon="content_cut" />
            <MetricCard label="Créditos Club dos Chefes" value={formatNumber(dashboardMetrics.business.creditsUsed)} icon="card_membership" />
            <MetricCard label="Comissão Diária" value={`R$ ${dashboardMetrics.business.dailyCommission.toFixed(2)}`} icon="paid" />
          </div>
        </div>
      )}

      {activeTab === 'checkout' && (
        <DomainPanel
          title="Checkout"
          icon="point_of_sale"
          metrics={checkoutMetrics}
          logs={recentLogs.filter(l => l.event.includes('Checkout'))}
        />
      )}

      {activeTab === 'cashClosing' && (
        <DomainPanel
          title="Fechamento de Caixa"
          icon="account_balance"
          metrics={cashClosingMetrics}
          logs={recentLogs.filter(l => l.event.includes('CashClosing'))}
        />
      )}

      {activeTab === 'appointments' && (
        <DomainPanel
          title="Agendamentos"
          icon="calendar_month"
          metrics={appointmentMetrics}
          logs={recentLogs.filter(l => l.event.includes('Appointment'))}
        />
      )}

      {activeTab === 'commission' && (
        <DomainPanel
          title="Comissões"
          icon="paid"
          metrics={commissionMetrics}
          logs={recentLogs.filter(l => l.event.includes('Commission'))}
        />
      )}

      {activeTab === 'chefClub' && (
        <DomainPanel
          title="Club dos Chefes"
          icon="card_membership"
          metrics={chefClubMetrics}
          logs={recentLogs.filter(l => l.event.includes('ChefClub'))}
        />
      )}

      {activeTab === 'pipeline' && (
        <PipelinePanel refreshKey={refreshKey} />
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Active Alerts */}
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Alertas Ativos ({activeAlerts.length})
            </h3>
            {activeAlerts.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum alerta ativo</p>
            ) : (
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <div key={alert.rule.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${severityColor(alert.rule.severity)}`}>
                        {alert.rule.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-200">{alert.rule.message}</span>
                    </div>
                    <button
                      onClick={() => alerts.resolve(alert.rule.name)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Resolver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert Rules */}
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Regras de Alerta ({alertRules.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 text-slate-500 dark:text-slate-400">Nome</th>
                    <th className="text-left py-2 text-slate-500 dark:text-slate-400">Métrica</th>
                    <th className="text-left py-2 text-slate-500 dark:text-slate-400">Condição</th>
                    <th className="text-left py-2 text-slate-500 dark:text-slate-400">Severidade</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRules.map(rule => (
                    <tr key={rule.name} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 text-slate-700 dark:text-slate-200 font-medium">{rule.name}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400 font-mono">{rule.metric}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{rule.operator} {rule.threshold}</td>
                      <td className="py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${severityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alert History */}
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Histórico ({alertHistory.length})</h3>
            {alertHistory.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum alerta registrado</p>
            ) : (
              <div className="space-y-2">
                {alertHistory.reverse().map((alert, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1.5">
                    <span className={`font-bold px-1.5 py-0.5 rounded ${severityColor(alert.rule.severity)}`}>
                      {alert.rule.severity.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 w-32 font-mono">
                      {new Date(alert.triggeredAt).toLocaleTimeString('pt-BR')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 flex-1">{alert.rule.message}</span>
                    <span className="text-slate-400 dark:text-slate-500">valor: {alert.currentValue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Logs Recentes ({recentLogs.length})
          </h3>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum log registrado</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                  <span className={`w-12 shrink-0 font-bold uppercase ${levelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">{log.category}</span>
                  <span className="text-slate-700 dark:text-slate-200 flex-1">{log.event}</span>
                  {log.duration !== undefined && (
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">{formatMs(log.duration)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Pipeline Panel (ADR-015) ─────────────────────────────────

const PipelinePanel: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const heartbeat = metrics.getGauge('dispatch_heartbeat');
  const health = heartbeat > 0 ? (Date.now() - heartbeat < 30000 ? 1 : Date.now() - heartbeat < 120000 ? 0 : -1) : -1;
  const pendingDepth = metrics.getGauge('outbox_pending_depth');
  const processingCount = metrics.getGauge('outbox_processing_count');
  const deadLetterCount = metrics.getGauge('outbox_dead_letter_count');
  const cycleCount = metrics.getCounter('dispatch_cycle_count');
  const cycleErrors = metrics.getCounter('dispatch_cycle_error');
  const itemsProcessed = metrics.getGauge('dispatch_items_processed');
  const cycleLatency = metrics.getSummary('dispatch_cycle_duration_ms');
  const enqueueCount = metrics.getCounter('outbox_enqueue_count');
  const publishCount = metrics.getCounter('outbox_publish_count');
  const failCount = metrics.getCounter('outbox_fail_count');
  const staleRecovery = metrics.getCounter('outbox_stale_recovery_count');
  const financeDelivered = metrics.getCounter('finance_deliver_success');
  const financeErrors = metrics.getCounter('finance_deliver_error');
  const financeSkipped = metrics.getCounter('finance_deliver_skip');
  const handlerMissing = metrics.getCounter('finance_handler_missing');

  const healthLabel = health === 1 ? 'VIVO' : health === 0 ? 'INSTÁVEL' : 'MORTO';
  const healthColor = health === 1 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : health === 0 ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30'
    : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  refreshKey; // force re-render on refresh

  const pipelineLogs = logger.getLogs({}).filter(l =>
    l.event.includes('dispatch') || l.event.includes('outbox') || l.event.includes('finance') || l.event.includes('pipeline')
  ).slice(-20).reverse();

  return (
    <div className="space-y-6">
      {/* Health Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Dispatch Loop"
          value={healthLabel}
          icon="monitor_heart"
          color={healthColor}
          sub={heartbeat > 0 ? `Último: ${new Date(heartbeat).toLocaleTimeString('pt-BR')}` : 'Nenhum heartbeat'}
        />
        <MetricCard label="Ciclos" value={formatNumber(cycleCount)} icon="loop" sub={cycleErrors > 0 ? `${cycleErrors} erros` : undefined} />
        <MetricCard label="Itens Processados" value={formatNumber(itemsProcessed)} icon="inventory_2" />
        <MetricCard label="Latência Média" value={formatMs(cycleLatency.avg)} icon="timer" />
      </div>

      {/* Outbox Depth */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Outbox Queue</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(enqueueCount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Enqueue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatNumber(pendingDepth)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(processingCount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Processing</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(publishCount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Published</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(deadLetterCount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Dead Letter</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(failCount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Retries</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{formatNumber(staleRecovery)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Stale Recovery</p>
          </div>
        </div>
      </div>

      {/* Finance Pipeline */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Finance Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Operações Entregues" value={formatNumber(financeDelivered)} icon="check_circle" color="text-emerald-600" />
          <MetricCard label="Erros Financeiros" value={formatNumber(financeErrors)} icon="error" color={financeErrors > 0 ? 'text-red-600' : 'text-slate-400'} />
          <MetricCard label="Idempotents (skip)" value={formatNumber(financeSkipped)} icon="skip_next" />
          <MetricCard label="Handler Ausente" value={formatNumber(handlerMissing)} icon="warning" color={handlerMissing > 0 ? 'text-red-600' : 'text-slate-400'} />
        </div>
      </div>

      {/* Pipeline Logs */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Pipeline Logs ({pipelineLogs.length})</h3>
        {pipelineLogs.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum log do pipeline registrado</p>
        ) : (
          <div className="space-y-1 font-mono text-xs">
            {pipelineLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                </span>
                <span className={`w-12 shrink-0 font-bold uppercase ${levelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-slate-700 dark:text-slate-200 flex-1">{log.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Domain Panel ───────────────────────────────────────────────

const DomainPanel: React.FC<{
  title: string;
  icon: string;
  metrics: DomainMetrics;
  logs: LogEntry[];
}> = ({ title, icon, metrics: m, logs }) => (
  <div className="space-y-6">
    {/* KPIs */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Sucesso" value={formatNumber(m.operations.success)} icon="check_circle" color="text-emerald-600" />
      <MetricCard label="Erros" value={formatNumber(m.operations.error)} icon="error" color={m.operations.error > 0 ? 'text-red-600' : 'text-slate-400'} />
      <MetricCard label="Total" value={formatNumber(m.operations.total)} icon="functions" />
      <MetricCard label="Latência Média" value={formatMs(m.latency.avg)} icon="timer" />
    </div>

    {/* Latency Distribution */}
    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Distribuição de Latência</h3>
      <div className="grid grid-cols-5 gap-4 text-center">
        {[
          { label: 'Mín', value: m.latency.min },
          { label: 'P50', value: m.latency.p50 },
          { label: 'Média', value: m.latency.avg },
          { label: 'P95', value: m.latency.p95 },
          { label: 'Máx', value: m.latency.max },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{formatMs(value)}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Recent Logs */}
    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Logs Recentes</h3>
      {logs.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum log para este domínio</p>
      ) : (
        <div className="space-y-1 font-mono text-xs">
          {logs.slice(0, 15).map((log, i) => (
            <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className={`w-12 shrink-0 font-bold uppercase ${levelColor(log.level)}`}>
                {log.level}
              </span>
              <span className="text-slate-700 dark:text-slate-200 flex-1">{log.event}</span>
              {log.duration !== undefined && (
                <span className="text-slate-400 dark:text-slate-500 shrink-0">{formatMs(log.duration)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default Observability;
