import { LucideIcon } from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'companies'
  | 'users'
  | 'subscriptions'
  | 'finance'
  | 'audit'
  | 'logs'
  | 'permissions'
  | 'settings';

export type AdminStatus =
  | 'ativo'
  | 'inativo'
  | 'aguardando ativacao'
  | 'pendente'
  | 'aguardando pagamento'
  | 'inadimplente'
  | 'bloqueado'
  | 'suspenso'
  | 'expirado'
  | 'critico'
  | 'analise'
  | 'cancelado'
  | 'aprovado'
  | 'recusado';

export type AlertSeverity = 'alto' | 'medio' | 'baixo';

export interface AdminFilterState {
  period: string;
  company: string;
  status: string;
  movementType: string;
  plan: string;
  user: string;
  financial: string;
  blockedState: string;
}

export interface AdminKpi {
  id: string;
  title: string;
  value: string;
  delta: string;
  context: string;
  icon: LucideIcon;
  tone: 'gold' | 'emerald' | 'red' | 'slate' | 'blue';
}

export interface AdminActivity {
  id: string;
  dateTime: string;
  type: string;
  company: string;
  user: string;
  origin: string;
  status: AdminStatus;
  actor: string;
  summary: string;
  eventType: string;
  notes: string;
  technicalLog: string;
  auditTrail: string[];
}

export interface SubscriptionRequestRow {
  id: string;
  company: string;
  owner: string;
  plan: string;
  value: number;
  paymentMethod: string;
  status: AdminStatus;
  requestDate: string;
  dueDate: string;
  history: string[];
}

export interface ManagedUserRow {
  id: string;
  name: string;
  company: string;
  role: string;
  lastAccess: string;
  status: AdminStatus;
  phone: string;
  email: string;
  riskLevel: AlertSeverity;
  history: string[];
}

export interface RiskAlert {
  id: string;
  title: string;
  description: string;
  count: number;
  severity: AlertSeverity;
  sla: string;
  cta: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  when: string;
  action: string;
  oldValue: string;
  newValue: string;
  origin: string;
  riskLevel: AlertSeverity;
  relatedObject: string;
  justification: string;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  tone: 'default' | 'danger' | 'success';
}

export interface SuperAdminDataset {
  kpis: AdminKpi[];
  activities: AdminActivity[];
  subscriptions: SubscriptionRequestRow[];
  users: ManagedUserRow[];
  alerts: RiskAlert[];
  audits: AuditEntry[];
  quickActions: QuickAction[];
  lastUpdatedAt: string;
}
