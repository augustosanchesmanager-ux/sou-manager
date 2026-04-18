export type MonitorRange = 'today' | '7d' | '30d';

export type ResourceTrend = 'up' | 'stable' | 'down';

export type AlertLevel = 'warning' | 'critical';

export type NotificationType = 'email' | 'webhook' | 'internal';

export interface UsagePoint {
  timestamp: string;
  value: number;
}

export interface ResourceMetric {
  id: string;
  label: string;
  icon: string;
  unit: string;
  current: number;
  limit: number;
  trend: ResourceTrend;
  description: string;
  etaDays: number | null;
  available: boolean;
  history: UsagePoint[];
}

export interface MonitorAlert {
  id: string;
  resourceId: string;
  resourceLabel: string;
  message: string;
  level: AlertLevel;
  usagePct: number;
  createdAt: string;
  active: boolean;
}

export interface NotificationChannel {
  id: string;
  type: NotificationType;
  target: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
}

export interface AutomationRule {
  id: string;
  title: string;
  description: string;
  cadence: string;
  status: 'active' | 'draft';
}

export interface SupabaseMonitorSnapshot {
  lastUpdatedAt: string;
  resources: ResourceMetric[];
  alerts: MonitorAlert[];
  channels: NotificationChannel[];
  automations: AutomationRule[];
}
