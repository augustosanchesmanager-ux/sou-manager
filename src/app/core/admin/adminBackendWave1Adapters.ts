import type { AdminActivity, RiskAlert } from '../../../../components/superadmin/types';
import type {
  AdminBackendAlertQueueItem,
  AdminBackendAlertQueueResponse,
  AdminBackendOperationalTimelineItem,
  AdminBackendOperationalTimelineResponse,
} from './adminBackendWave1Contracts';

interface BuildAdminBackendAlertQueueParams {
  generatedAt?: string;
  items: readonly RiskAlert[];
  openSupportTickets: number;
}

interface BuildAdminBackendOperationalTimelineParams {
  generatedAt?: string;
  items: readonly AdminActivity[];
}

const resolveGeneratedAt = (generatedAt?: string) => generatedAt ?? new Date().toISOString();

const buildSeveritySummary = (items: readonly AdminBackendAlertQueueItem[]) => ({
  high: items.filter((item) => item.severity === 'alto').length,
  medium: items.filter((item) => item.severity === 'medio').length,
  low: items.filter((item) => item.severity === 'baixo').length,
  total: items.length,
});

const mapActivitySource = (item: AdminActivity): AdminBackendOperationalTimelineItem['source'] => {
  if (item.eventType === 'support_ticket' || item.origin === 'Suporte') return 'support-ticket';
  if (item.eventType === 'access_request' || item.origin === 'Landing') return 'access-request';
  if (item.id.startsWith('alert-') || item.origin === 'Monitoramento') return 'alert';
  return 'audit';
};

export const buildAdminBackendAlertQueueResponse = ({
  generatedAt,
  items,
  openSupportTickets,
}: BuildAdminBackendAlertQueueParams): AdminBackendAlertQueueResponse => {
  const queueItems: AdminBackendAlertQueueItem[] = items.map((item) => ({
    id: item.id,
    source: item.id.startsWith('ticket-') ? 'support-ticket' : 'alert',
    title: item.title,
    description: item.description,
    severity: item.severity,
    slaLabel: item.sla,
    ctaLabel: item.cta,
    createdAt: resolveGeneratedAt(generatedAt),
    tenantId: null,
  }));

  return {
    generatedAt: resolveGeneratedAt(generatedAt),
    items: queueItems,
    severitySummary: buildSeveritySummary(queueItems),
    openSupportTickets,
  };
};

export const mapAdminBackendAlertQueueToRiskAlerts = (
  response: AdminBackendAlertQueueResponse,
): RiskAlert[] =>
  response.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    count: 1,
    severity: item.severity,
    sla: item.slaLabel,
    cta: item.ctaLabel,
  }));

export const buildAdminBackendOperationalTimelineResponse = ({
  generatedAt,
  items,
}: BuildAdminBackendOperationalTimelineParams): AdminBackendOperationalTimelineResponse => {
  const timelineItems: AdminBackendOperationalTimelineItem[] = items.map((item) => ({
    id: item.id,
    source: mapActivitySource(item),
    occurredAt: item.dateTime,
    type: item.type,
    companyLabel: item.company,
    actorLabel: item.actor,
    status: item.status,
    summary: item.summary,
    technicalContext: item.technicalLog || item.notes || `${item.origin} | ${item.eventType}`,
  }));

  return {
    generatedAt: resolveGeneratedAt(generatedAt),
    items: timelineItems,
    criticalAlerts: timelineItems.filter((item) => item.source === 'alert' && item.status === 'critico').length,
    supportTicketsInTimeline: timelineItems.filter((item) => item.source === 'support-ticket').length,
  };
};
