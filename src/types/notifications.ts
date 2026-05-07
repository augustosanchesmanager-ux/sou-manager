export const NOTIFICATION_TYPES = [
  'comanda_aberta',
  'estoque_baixo',
  'pagamento_a_realizar',
  'cobranca_clube_chefes',
  'proximo_cliente',
  'cliente_atrasado',
] as const;

export type InternalNotificationType = (typeof NOTIFICATION_TYPES)[number];
export type InternalNotificationSeverity = 'info' | 'warning' | 'critical';
export type InternalNotificationStatus = 'unread' | 'read' | 'archived';

export interface InternalNotification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  type: InternalNotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  severity: InternalNotificationSeverity;
  status: InternalNotificationStatus;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreference {
  type: InternalNotificationType;
  label: string;
  description: string;
  enabled: boolean;
}

export const NOTIFICATION_TYPE_LABELS: Record<InternalNotificationType, string> = {
  comanda_aberta: 'Comandas abertas',
  estoque_baixo: 'Estoque baixo',
  pagamento_a_realizar: 'Pagamentos a realizar',
  cobranca_clube_chefes: 'Clube dos Chefes',
  proximo_cliente: 'Próximo cliente',
  cliente_atrasado: 'Cliente atrasado',
};
