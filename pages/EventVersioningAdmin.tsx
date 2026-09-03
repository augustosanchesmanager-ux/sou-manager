import { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface EventType {
  id: string;
  name: string;
  aggregateType: string;
  currentVersion: number;
  publisherCount: number;
  subscriberCount: number;
  lastPublishedAt: string | null;
  status: 'active' | 'deprecated' | 'prepared';
  introducedIn: string;
  deprecatedIn: string | null;
  snapshotsEnabled: boolean;
  replaySupported: boolean;
}

interface EventField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface EventVersionDiff {
  eventType: string;
  fromVersion: number;
  toVersion: number;
  addedFields: EventField[];
  removedFields: EventField[];
  changedFields: { name: string; fromType: string; toType: string }[];
}

interface Upcaster {
  id: string;
  eventType: string;
  fromVersion: number;
  toVersion: number;
  status: 'registered' | 'tested' | 'active';
  registeredAt: string;
  description: string;
}

interface CompatibilityEntry {
  eventType: string;
  version: number;
  consumerName: string;
  canHandle: boolean;
  lastSeen: string;
}

interface ReplayJob {
  id: string;
  eventType: string;
  fromVersion: number;
  toVersion: number;
  status: 'running' | 'completed' | 'failed' | 'dry_run';
  totalEvents: number;
  processed: number;
  upcasted: number;
  retried: number;
  failed: number;
  snapshotUsed: boolean;
  projectionRebuild: boolean;
  operator: string;
  tenant: string;
  module: string;
  startedAt: string;
  completedAt: string | null;
  duration: string | null;
  timeline: TimelineStep[];
}

interface TimelineStep {
  time: string;
  label: string;
  status: 'completed' | 'running' | 'failed' | 'pending';
  detail?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  tenant: string;
  timestamp: string;
  details: string;
  severity: 'info' | 'warning' | 'error';
}

// ─── Mock Data ───────────────────────────────────────────────────

const EVENT_TYPES: EventType[] = [
  { id: '1', name: 'CheckoutCompleted', aggregateType: 'comanda', currentVersion: 1, publisherCount: 1, subscriberCount: 5, lastPublishedAt: '2026-07-24T14:32:00Z', status: 'active', introducedIn: '4.1', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '2', name: 'CheckoutReverted', aggregateType: 'comanda', currentVersion: 1, publisherCount: 0, subscriberCount: 1, lastPublishedAt: null, status: 'prepared', introducedIn: '4.1', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '3', name: 'AppointmentCreated', aggregateType: 'appointment', currentVersion: 1, publisherCount: 1, subscriberCount: 3, lastPublishedAt: '2026-07-24T15:10:00Z', status: 'active', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '4', name: 'AppointmentCancelled', aggregateType: 'appointment', currentVersion: 1, publisherCount: 1, subscriberCount: 2, lastPublishedAt: '2026-07-24T12:45:00Z', status: 'active', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '5', name: 'AppointmentCompleted', aggregateType: 'appointment', currentVersion: 1, publisherCount: 0, subscriberCount: 1, lastPublishedAt: null, status: 'prepared', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '6', name: 'CashClosingCompleted', aggregateType: 'cash_closing', currentVersion: 1, publisherCount: 1, subscriberCount: 2, lastPublishedAt: '2026-07-24T18:00:00Z', status: 'active', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '7', name: 'SubscriptionCreated', aggregateType: 'subscription', currentVersion: 1, publisherCount: 1, subscriberCount: 2, lastPublishedAt: '2026-07-23T10:00:00Z', status: 'active', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '8', name: 'SubscriptionCancelled', aggregateType: 'subscription', currentVersion: 1, publisherCount: 1, subscriberCount: 1, lastPublishedAt: '2026-07-22T16:30:00Z', status: 'active', introducedIn: '4.2', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '9', name: 'CreditsDeducted', aggregateType: 'subscription', currentVersion: 1, publisherCount: 1, subscriberCount: 1, lastPublishedAt: '2026-07-24T11:20:00Z', status: 'active', introducedIn: '4.6', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '10', name: 'TransactionCreated', aggregateType: 'transaction', currentVersion: 1, publisherCount: 0, subscriberCount: 1, lastPublishedAt: null, status: 'prepared', introducedIn: '4.6', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
  { id: '11', name: 'CommissionCalculated', aggregateType: 'commission', currentVersion: 1, publisherCount: 0, subscriberCount: 1, lastPublishedAt: null, status: 'prepared', introducedIn: '4.6', deprecatedIn: null, snapshotsEnabled: false, replaySupported: true },
];

const UPCASTERS: Upcaster[] = [];

const COMPATIBILITY: CompatibilityEntry[] = [
  { eventType: 'CheckoutCompleted', version: 1, consumerName: 'AnalyticsSubscriber', canHandle: true, lastSeen: '2026-07-24T14:32:00Z' },
  { eventType: 'CheckoutCompleted', version: 1, consumerName: 'AuditSubscriber', canHandle: true, lastSeen: '2026-07-24T14:32:00Z' },
  { eventType: 'CheckoutCompleted', version: 1, consumerName: 'NotificationSubscriber', canHandle: true, lastSeen: '2026-07-24T14:32:00Z' },
  { eventType: 'CheckoutCompleted', version: 1, consumerName: 'CommissionSubscriber', canHandle: true, lastSeen: '2026-07-24T14:32:00Z' },
  { eventType: 'CheckoutCompleted', version: 1, consumerName: 'FinanceSubscriber', canHandle: true, lastSeen: '2026-07-24T14:32:00Z' },
  { eventType: 'AppointmentCreated', version: 1, consumerName: 'AnalyticsSubscriber', canHandle: true, lastSeen: '2026-07-24T15:10:00Z' },
  { eventType: 'AppointmentCreated', version: 1, consumerName: 'ReminderSubscriber', canHandle: true, lastSeen: '2026-07-24T15:10:00Z' },
  { eventType: 'AppointmentCreated', version: 1, consumerName: 'MarketingSubscriber', canHandle: true, lastSeen: '2026-07-24T15:10:00Z' },
  { eventType: 'CashClosingCompleted', version: 1, consumerName: 'BiSubscriber', canHandle: true, lastSeen: '2026-07-24T18:00:00Z' },
  { eventType: 'CashClosingCompleted', version: 1, consumerName: 'AuditSubscriber', canHandle: true, lastSeen: '2026-07-24T18:00:00Z' },
];

const VERSION_DIFFS: EventVersionDiff[] = [];

const REPLAY_JOBS: ReplayJob[] = [
  {
    id: '1', eventType: 'CheckoutCompleted', fromVersion: 1, toVersion: 1,
    status: 'completed', totalEvents: 1247, processed: 1247, upcasted: 0, retried: 0, failed: 0,
    snapshotUsed: false, projectionRebuild: true, operator: 'system', tenant: 'barber-default', module: 'barber',
    startedAt: '2026-07-24T10:00:00Z', completedAt: '2026-07-24T10:00:04Z', duration: '4.2s',
    timeline: [
      { time: '10:00:00', label: 'Replay iniciado', status: 'completed', detail: '1247 eventos carregados' },
      { time: '10:00:01', label: 'Batch 1 processado', status: 'completed', detail: '500 eventos' },
      { time: '10:00:02', label: 'Batch 2 processado', status: 'completed', detail: '500 eventos' },
      { time: '10:00:03', label: 'Batch 3 processado', status: 'completed', detail: '247 eventos' },
      { time: '10:00:04', label: 'Projection rebuild', status: 'completed', detail: 'Subscribers notificados' },
    ],
  },
  {
    id: '2', eventType: 'AppointmentCreated', fromVersion: 1, toVersion: 1,
    status: 'completed', totalEvents: 892, processed: 892, upcasted: 0, retried: 0, failed: 0,
    snapshotUsed: false, projectionRebuild: true, operator: 'admin@soumanager.local', tenant: 'barber-default', module: 'barber',
    startedAt: '2026-07-24T10:05:00Z', completedAt: '2026-07-24T10:05:03Z', duration: '3.1s',
    timeline: [
      { time: '10:05:00', label: 'Replay iniciado', status: 'completed', detail: '892 eventos carregados' },
      { time: '10:05:01', label: 'Batch 1 processado', status: 'completed', detail: '500 eventos' },
      { time: '10:05:02', label: 'Batch 2 processado', status: 'completed', detail: '392 eventos' },
      { time: '10:05:03', label: 'Projection rebuild', status: 'completed', detail: 'Subscribers notificados' },
    ],
  },
  {
    id: '3', eventType: 'CashClosingCompleted', fromVersion: 1, toVersion: 1,
    status: 'dry_run', totalEvents: 156, processed: 156, upcasted: 0, retried: 0, failed: 0,
    snapshotUsed: false, projectionRebuild: false, operator: 'system', tenant: 'barber-default', module: 'barber',
    startedAt: '2026-07-24T10:10:00Z', completedAt: '2026-07-24T10:10:01Z', duration: '0.8s',
    timeline: [
      { time: '10:10:00', label: 'Dry-run iniciado', status: 'completed', detail: '156 eventos simulados' },
      { time: '10:10:01', label: 'Simulacao completa', status: 'completed', detail: 'Nenhuma projecao executada' },
    ],
  },
];

const AUDIT_ENTRIES: AuditEntry[] = [
  { id: '1', action: 'Replay iniciado', actor: 'system', tenant: 'barber-default', timestamp: '2026-07-24T10:00:00Z', details: 'CheckoutCompleted v1 → v1, 1247 eventos', severity: 'info' },
  { id: '2', action: 'Replay concluido', actor: 'system', tenant: 'barber-default', timestamp: '2026-07-24T10:00:04Z', details: '1247/1247 processados, 0 falhas', severity: 'info' },
  { id: '3', action: 'Replay iniciado', actor: 'admin@soumanager.local', tenant: 'barber-default', timestamp: '2026-07-24T10:05:00Z', details: 'AppointmentCreated v1 → v1, 892 eventos', severity: 'info' },
  { id: '4', action: 'Replay concluido', actor: 'admin@soumanager.local', tenant: 'barber-default', timestamp: '2026-07-24T10:05:03Z', details: '892/892 processados, 0 falhas', severity: 'info' },
  { id: '5', action: 'Dry-run executado', actor: 'system', tenant: 'barber-default', timestamp: '2026-07-24T10:10:00Z', details: 'CashClosingCompleted v1 → v1, 156 eventos simulados', severity: 'info' },
];

// ─── Helpers ─────────────────────────────────────────────────────

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ─── Shared Components ───────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    prepared: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    deprecated: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    registered: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
    tested: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
    running: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dry_run: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };
  const icons: Record<string, string> = {
    active: 'check_circle', prepared: 'schedule', deprecated: 'block',
    registered: 'app_registration', tested: 'verified',
    running: 'sync', completed: 'check_circle', failed: 'error', dry_run: 'science',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${styles[status] || styles.deprecated}`}>
      <span className="material-symbols-outlined text-[14px]">{icons[status] || 'help'}</span>
      {status.replace('_', ' ')}
    </span>
  );
}

function MetricCard({ icon, label, value, accent, sub }: { icon: string; label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent || 'bg-slate-100 dark:bg-[#1A1A1A]'}`}>
          <span className={`material-symbols-outlined text-lg ${accent ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}

function SectionHeader({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] flex items-center justify-center shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-lg text-slate-500 dark:text-slate-400">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Timeline Component ──────────────────────────────────────────

function ReplayTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${
              step.status === 'completed' ? 'bg-emerald-500' :
              step.status === 'running' ? 'bg-sky-500 animate-pulse' :
              step.status === 'failed' ? 'bg-red-500' :
              'bg-slate-300 dark:bg-slate-600'
            }`} />
            <div className="text-center">
              <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500">{step.time}</p>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 max-w-[80px] truncate">{step.label}</p>
              {step.detail && <p className="text-[9px] text-slate-400 dark:text-slate-500 max-w-[80px] truncate">{step.detail}</p>}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px mx-1 ${
              step.status === 'completed' ? 'bg-emerald-300 dark:bg-emerald-700' :
              'bg-slate-200 dark:bg-slate-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────

function OverviewTab() {
  const activeCount = EVENT_TYPES.filter(e => e.status === 'active').length;
  const preparedCount = EVENT_TYPES.filter(e => e.status === 'prepared').length;
  const totalSubscribers = EVENT_TYPES.reduce((sum, e) => sum + e.subscriberCount, 0);
  const replaySuccessRate = REPLAY_JOBS.length > 0
    ? ((REPLAY_JOBS.filter(j => j.status === 'completed').length / REPLAY_JOBS.length) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon="bolt" label="Eventos Registrados" value={EVENT_TYPES.length} accent="bg-primary" sub={`${activeCount} ativos, ${preparedCount} preparados`} />
        <MetricCard icon="check_circle" label="Health Score" value={`${replaySuccessRate}%`} accent="bg-emerald-500" sub="Taxa de sucesso geral" />
        <MetricCard icon="groups" label="Consumers Ativos" value={totalSubscribers} accent="bg-sky-500" sub="Subscribers registrados" />
        <MetricCard icon="replay" label="Replays Hoje" value={REPLAY_JOBS.length} accent="bg-violet-500" sub={`${REPLAY_JOBS.filter(j => j.status === 'completed').length} concluidos`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-5">
          <SectionHeader icon="monitoring" title="Event Health" description="Indicadores de saude do sistema de eventos" />
          <div className="space-y-3">
            <HealthRow label="Replay Success Rate" value="100%" status="healthy" />
            <HealthRow label="Projection Lag" value="0" status="healthy" />
            <HealthRow label="Consumers Offline" value="0" status="healthy" />
            <HealthRow label="Unknown Version Events" value="0" status="healthy" />
            <HealthRow label="Upcasters Registered" value="0" status="neutral" />
            <HealthRow label="Dead Letters (24h)" value="0" status="healthy" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-5">
          <SectionHeader icon="history" title="Atividade Recente" description="Ultimas operacoes de eventos" />
          <div className="space-y-2">
            {AUDIT_ENTRIES.slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-[#262626] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.severity === 'error' ? 'bg-red-500' :
                  entry.severity === 'warning' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{entry.action}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{entry.details}</p>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{formatTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, value, status }: { label: string; value: string; status: 'healthy' | 'warning' | 'error' | 'neutral' }) {
  const dot = status === 'healthy' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600';
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <span className="text-xs font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

// ─── Tab: Registry ───────────────────────────────────────────────

function RegistryTab() {
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#1A1A1A] border-b border-slate-200 dark:border-[#262626]">
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Evento</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Aggregate</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">Versao</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Introduzido</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">Consumers</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">Snapshots</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">Replay</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#262626]">
            {EVENT_TYPES.map(evt => (
              <tr
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <td className="px-5 py-4">
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{evt.name}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-md font-medium">{evt.aggregateType}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] text-xs font-bold text-slate-700 dark:text-slate-300">v{evt.currentVersion}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{evt.introducedIn}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{evt.subscriberCount}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  {evt.snapshotsEnabled ? (
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">cancel</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {evt.replaySupported ? (
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">cancel</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <StatusChip status={evt.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEvent && (
        <EventDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function EventDetailDrawer({ event, onClose }: { event: EventType; onClose: () => void }) {
  return (
    <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-xl text-primary">bolt</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">{event.name}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Detalhes do evento registrado</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors">
          <span className="material-symbols-outlined text-lg text-slate-400">close</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailField label="Aggregate" value={event.aggregateType} />
        <DetailField label="Versao Atual" value={`v${event.currentVersion}`} />
        <DetailField label="Introduzido Em" value={event.introducedIn} />
        <DetailField label="Deprecado Em" value={event.deprecatedIn || '—'} />
        <DetailField label="Publisher" value={`${event.publisherCount} fonte(s)`} />
        <DetailField label="Consumers" value={`${event.subscriberCount} registrado(s)`} />
        <DetailField label="Snapshots" value={event.snapshotsEnabled ? 'Habilitado' : 'Desabilitado'} />
        <DetailField label="Replay" value={event.replaySupported ? 'Suportado' : 'Nao suportado'} />
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-[#262626]">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">Ultimo Evento Publicado</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {event.lastPublishedAt ? formatDateTime(event.lastPublishedAt) : 'Nenhum evento publicado ainda'}
        </p>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Tab: Compatibility Matrix ───────────────────────────────────

function CompatibilityTab() {
  const eventNames = useMemo(() => [...new Set(COMPATIBILITY.map(c => c.eventType))], []);
  const consumerNames = useMemo(() => [...new Set(COMPATIBILITY.map(c => c.consumerName))], []);
  const versions = useMemo(() => [...new Set(COMPATIBILITY.map(c => c.version))].sort(), []);

  const matrix = useMemo(() => {
    const m: Record<string, Record<number, Record<string, boolean>>> = {};
    for (const entry of COMPATIBILITY) {
      if (!m[entry.eventType]) m[entry.eventType] = {};
      if (!m[entry.eventType][entry.version]) m[entry.eventType][entry.version] = {};
      m[entry.eventType][entry.version][entry.consumerName] = entry.canHandle;
    }
    return m;
  }, []);

  return (
    <div className="space-y-4">
      <SectionHeader icon="handshake" title="Matriz de Compatibilidade" description="Mapa visual de quais consumers suportam quais versoes de cada evento" />

      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#1A1A1A] border-b border-slate-200 dark:border-[#262626]">
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Evento</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Consumer</th>
              {versions.map(v => (
                <th key={v} className="px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">v{v}</th>
              ))}
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Ultimo Processamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#262626]">
            {eventNames.map(eventName => {
              const consumers = consumerNames.filter(c => COMPATIBILITY.some(ce => ce.eventType === eventName && ce.consumerName === c));
              return consumers.map((consumer, ci) => (
                <tr key={`${eventName}-${consumer}`} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  {ci === 0 ? (
                    <td className="px-5 py-3 text-sm font-bold text-slate-900 dark:text-white font-mono" rowSpan={consumers.length}>{eventName}</td>
                  ) : null}
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">{consumer}</td>
                  {versions.map(v => {
                    const supported = matrix[eventName]?.[v]?.[consumer];
                    return (
                      <td key={v} className="px-3 py-3 text-center">
                        {supported === true ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                            <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">check</span>
                          </span>
                        ) : supported === false ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30">
                            <span className="material-symbols-outlined text-[14px] text-red-600 dark:text-red-400">close</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1A1A1A]">
                            <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">remove</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(COMPATIBILITY.find(c => c.eventType === eventName && c.consumerName === consumer)?.lastSeen || null)}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Upcasters ─────────────────────────────────────────────

function UpcastersTab() {
  const [selectedDiff, setSelectedDiff] = useState<EventVersionDiff | null>(null);

  return (
    <div className="space-y-4">
      <SectionHeader icon="upgrade" title="Upcasters" description="Transformadores de versao para compatibilidade retroativa" />

      {UPCASTERS.length === 0 ? (
        <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl border-dashed">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1A1A1A] flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600">upgrade</span>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum upcaster registrado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Quando um evento evoluir de versao (ex: v1 para v2), os upcasters aparecerao aqui.
                Eles transformam eventos antigos para o formato atual sem perda de dados.
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                domain/events/upcasters/
              </code>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">→</span>
              <code className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                CheckoutCompletedV1ToV2.ts
              </code>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1A1A1A] border-b border-slate-200 dark:border-[#262626]">
                <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Evento</th>
                <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">De</th>
                <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">Para</th>
                <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Descricao</th>
                <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#262626]">
              {UPCASTERS.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white font-mono">{u.eventType}</td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1A1A1A] text-xs font-bold text-slate-700 dark:text-slate-300">v{u.fromVersion}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="material-symbols-outlined text-sm text-slate-400 mx-1">arrow_forward</span>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">v{u.toVersion}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{u.description}</td>
                  <td className="px-5 py-4"><StatusChip status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {VERSION_DIFFS.length > 0 && (
        <div className="space-y-3">
          <SectionHeader icon="compare" title="Diferencas entre Versoes" description="Comparacao visual de mudancas entre versoes de eventos" />
          {VERSION_DIFFS.map((diff, i) => (
            <VersionDiffCard key={i} diff={diff} onClick={(): void => { setSelectedDiff(diff); }} />
          ))}
        </div>
      )}

      {selectedDiff && (
        <VersionDiffViewer diff={selectedDiff} onClose={() => setSelectedDiff(null)} />
      )}
    </div>
  );
}

function VersionDiffCard({ diff, onClick }: { diff: EventVersionDiff; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-4 text-left hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-lg text-primary">compare</span>
        <div className="flex-1">
          <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{diff.eventType}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">v{diff.fromVersion} → v{diff.toVersion}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-emerald-600 dark:text-emerald-400">+{diff.addedFields.length}</span>
          <span className="text-red-600 dark:text-red-400">-{diff.removedFields.length}</span>
          <span className="text-amber-600 dark:text-amber-400">~{diff.changedFields.length}</span>
        </div>
        <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
      </div>
    </button>
  );
}

function VersionDiffViewer({ diff, onClose }: { diff: EventVersionDiff; onClose: () => void }) {
  return (
    <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-xl text-primary">compare</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">{diff.eventType}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">v{diff.fromVersion} → v{diff.toVersion}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors">
          <span className="material-symbols-outlined text-lg text-slate-400">close</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {diff.addedFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Campos Adicionados</p>
            {diff.addedFields.map(f => (
              <div key={f.name} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">{f.name}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{f.type} {f.required ? '(obrigatorio)' : '(opcional)'}</p>
              </div>
            ))}
          </div>
        )}

        {diff.removedFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Campos Removidos</p>
            {diff.removedFields.map(f => (
              <div key={f.name} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-2">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 font-mono line-through">{f.name}</p>
                <p className="text-[10px] text-red-600 dark:text-red-500">{f.type}</p>
              </div>
            ))}
          </div>
        )}

        {diff.changedFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Campos Alterados</p>
            {diff.changedFields.map(f => (
              <div key={f.name} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">{f.name}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500">{f.fromType} → {f.toType}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Replay Center ─────────────────────────────────────────

function ReplayCenterTab() {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <SectionHeader icon="replay" title="Replay Center" description="Histórico e detalhes de operações de replay com timeline" />

      <div className="space-y-3">
        {REPLAY_JOBS.map(job => (
          <div key={job.id} className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#262626] rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              className="w-full p-4 text-left hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{job.eventType}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">v{job.fromVersion} → v{job.toVersion}</span>
                    <StatusChip status={job.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    <span>{job.processed.toLocaleString()} / {job.totalEvents.toLocaleString()} eventos</span>
                    <span>{job.operator}</span>
                    <span>{job.tenant}</span>
                    <span>{job.module}</span>
                    <span>{formatDateTime(job.startedAt)}</span>
                    {job.duration && <span className="font-mono">{job.duration}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {job.upcasted > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{job.upcasted} upcasted</span>
                  )}
                  {job.retried > 0 && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">{job.retried} retries</span>
                  )}
                  {job.snapshotUsed && (
                    <span className="material-symbols-outlined text-[14px] text-violet-500">photo_camera</span>
                  )}
                  {job.projectionRebuild && (
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">engineering</span>
                  )}
                  <span className={`material-symbols-outlined text-sm transition-transform ${expandedJob === job.id ? 'rotate-180' : ''} text-slate-400`}>expand_more</span>
                </div>
              </div>
            </button>

            {expandedJob === job.id && (
              <div className="border-t border-slate-100 dark:border-[#262626] p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DetailField label="Operador" value={job.operator} />
                  <DetailField label="Tenant" value={job.tenant} />
                  <DetailField label="Módulo" value={job.module} />
                  <DetailField label="Duracao" value={job.duration || '—'} />
                  <DetailField label="Upcasts" value={`${job.upcasted}`} />
                  <DetailField label="Retries" value={`${job.retried}`} />
                  <DetailField label="Snapshot" value={job.snapshotUsed ? 'Utilizado' : 'Nao utilizado'} />
                  <DetailField label="Projecao" value={job.projectionRebuild ? 'Rebuild executado' : 'Sem rebuild'} />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">Timeline</p>
                  <ReplayTimeline steps={job.timeline} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function EventVersioningAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'registry' | 'compatibility' | 'upcasters' | 'replay'>('overview');

  const tabs = [
    { id: 'overview' as const, icon: 'dashboard', label: 'Overview' },
    { id: 'registry' as const, icon: 'list', label: 'Registry' },
    { id: 'compatibility' as const, icon: 'grid_view', label: 'Compatibilidade' },
    { id: 'upcasters' as const, icon: 'upgrade', label: 'Upcasters' },
    { id: 'replay' as const, icon: 'replay', label: 'Replay Center' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-primary">schema</span>
          Event Versioning
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Centro de operacoes do sistema de eventos. Registry, compatibilidade, upcasters e replay.
        </p>
      </div>

      <div className="flex overflow-x-auto gap-1 bg-slate-100 dark:bg-[#1A1A1A] p-1 rounded-xl">
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            icon={tab.icon}
            label={tab.label}
            onClick={(): void => { setActiveTab(tab.id); }}
          />
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'registry' && <RegistryTab />}
      {activeTab === 'compatibility' && <CompatibilityTab />}
      {activeTab === 'upcasters' && <UpcastersTab />}
      {activeTab === 'replay' && <ReplayCenterTab />}
    </div>
  );
}
