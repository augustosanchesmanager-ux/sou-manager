export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WebhookSubscriptionRecord {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  subscription_id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, unknown> | unknown[];
  status: WebhookDeliveryStatus;
  attempts: number;
  next_retry_at: string | null;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string | null;
  created_at: string;
  // Opcional: junção com a subscription para envio
  subscription?: WebhookSubscriptionRecord | null;
}

export interface DispatchResult {
  deliveryId: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  nextRetryAt: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: string | null;
  durationMs: number;
  error?: string;
}

export interface DispatchOptions {
  timeoutMs?: number;
  maxBodyLength?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
}
