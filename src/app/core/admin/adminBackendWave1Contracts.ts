export interface AdminBackendAlertQueueItem {
  id: string;
  source: 'alert' | 'support-ticket';
  title: string;
  description: string;
  severity: 'alto' | 'medio' | 'baixo';
  slaLabel: string;
  ctaLabel: string;
  createdAt: string;
  tenantId: string | null;
}

export interface AdminBackendAlertSeveritySummary {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AdminBackendAlertQueueResponse {
  generatedAt: string;
  items: AdminBackendAlertQueueItem[];
  severitySummary: AdminBackendAlertSeveritySummary;
  openSupportTickets: number;
}

export interface AdminBackendOperationalTimelineItem {
  id: string;
  source: 'audit' | 'support-ticket' | 'access-request' | 'alert';
  occurredAt: string;
  type: string;
  companyLabel: string;
  actorLabel: string;
  status: string;
  summary: string;
  technicalContext: string;
}

export interface AdminBackendOperationalTimelineResponse {
  generatedAt: string;
  items: AdminBackendOperationalTimelineItem[];
  criticalAlerts: number;
  supportTicketsInTimeline: number;
}

export interface AdminBackendDatabaseOverviewResponse {
  generatedAt: string;
  totalShops: number;
  totalUsers: number;
  activeTickets: number;
}

export interface AdminBackendPlatformStackEntry {
  key: 'frontendRuntime' | 'backendRuntime' | 'authModel' | 'deployContext';
  label: string;
  value: string;
}

export interface AdminBackendPlatformStackResponse {
  generatedAt: string;
  entries: AdminBackendPlatformStackEntry[];
}
