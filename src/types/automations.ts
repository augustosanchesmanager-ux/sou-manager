export type AutomationCategory = 'operational' | 'client' | 'retention';
export type ChannelType = 'whatsapp' | 'email';
export type AutomationStatus = 'active' | 'paused';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  channels: ChannelType[];
  triggerDescription: string;
  enabled: boolean;
  scheduledTime?: string;
  delayMinutes?: number;
  templateId: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  category: AutomationCategory;
  channel: ChannelType;
  subject?: string;
  content: string;
  availableVariables: string[];
}

export interface DispatchQueueItem {
  id: string;
  automationName: string;
  recipientName: string;
  recipientContact: string;
  channel: ChannelType;
  status: 'sent' | 'delivered' | 'pending' | 'failed' | 'skipped_duplicate';
  scheduledFor: string;
  sentAt?: string;
  errorMessage?: string;
  idempotencyKey: string;
}

export interface ConnectionSettings {
  whatsappStatus: 'connected' | 'disconnected' | 'connecting';
  whatsappPhoneNumber?: string;
  resendStatus: 'active' | 'unconfigured';
  senderEmail: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailyRateLimit: number;
}
