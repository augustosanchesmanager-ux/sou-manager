import type {
  AutomationRule,
  AutomationTemplate,
  DispatchQueueItem,
  ConnectionSettings,
} from '../src/types/automations';

const STORAGE_KEY_PREFIX = 'smg_automation_hub';

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-no-show-d1',
    name: 'Confirmação Anti-No-Show (Véspera)',
    description: 'Dispara confirmação na noite anterior para liberar horários desmarcados com antecedência.',
    category: 'client',
    channels: ['whatsapp'],
    triggerDescription: '1 dia antes às 19:00',
    enabled: true,
    scheduledTime: '19:00',
    templateId: 'tmpl-no-show-d1',
  },
  {
    id: 'rule-no-show-h2',
    name: 'Lembrete de Pontualidade (2h Antes)',
    description: 'Envia endereço e tolerância de 10 minutos para evitar atrasos em cadeia.',
    category: 'client',
    channels: ['whatsapp'],
    triggerDescription: '2 horas antes do agendamento',
    enabled: true,
    delayMinutes: 120,
    templateId: 'tmpl-no-show-h2',
  },
  {
    id: 'rule-review-nps',
    name: 'Pesquisa de Satisfação & Review Google',
    description: 'Solicita avaliação 5 estrelas logo após a finalização do atendimento.',
    category: 'client',
    channels: ['whatsapp'],
    triggerDescription: '30 minutos após fechar comanda',
    enabled: true,
    delayMinutes: 30,
    templateId: 'tmpl-review-nps',
  },
  {
    id: 'rule-barber-agenda',
    name: 'Agenda Diária Individual do Barbeiro',
    description: 'Envia o briefing matinal de atendimentos para o WhatsApp de cada barbeiro.',
    category: 'operational',
    channels: ['whatsapp'],
    triggerDescription: 'Diariamente às 08:00',
    enabled: true,
    scheduledTime: '08:00',
    templateId: 'tmpl-barber-agenda',
  },
  {
    id: 'rule-morning-briefing',
    name: 'Briefing Matinal da Gestão',
    description: 'Consolida ocupação esperada, contas do dia e assinantes do Clube na agenda.',
    category: 'operational',
    channels: ['whatsapp', 'email'],
    triggerDescription: 'Diariamente às 07:30',
    enabled: true,
    scheduledTime: '07:30',
    templateId: 'tmpl-morning-briefing',
  },
  {
    id: 'rule-evening-closing',
    name: 'Fechamento da Noite & Auditoria',
    description: 'Relatório de faturamento líquido, comissões geradas e alerta de comandas em aberto.',
    category: 'operational',
    channels: ['whatsapp', 'email'],
    triggerDescription: 'Diariamente às 21:30',
    enabled: true,
    scheduledTime: '21:30',
    templateId: 'tmpl-evening-closing',
  },
  {
    id: 'rule-smart-return',
    name: 'Smart Return (Reativação de Inativos)',
    description: 'Dispara convite personalizado para clientes que não cortam há mais de 30 dias.',
    category: 'retention',
    channels: ['whatsapp'],
    triggerDescription: '30 dias após último corte',
    enabled: true,
    templateId: 'tmpl-smart-return',
  },
  {
    id: 'rule-club-renewal',
    name: 'Régua de Renovação Clube dos Chefes',
    description: 'Avisa sobre cobrança e renovação de créditos do plano de assinatura.',
    category: 'retention',
    channels: ['whatsapp', 'email'],
    triggerDescription: 'No dia do vencimento da assinatura',
    enabled: true,
    templateId: 'tmpl-club-renewal',
  },
  {
    id: 'rule-birthday',
    name: 'Parabéns ao Aniversariante com Cortesia',
    description: 'Envia mensagem especial no dia do aniversário com benefício para agendamento.',
    category: 'retention',
    channels: ['whatsapp'],
    triggerDescription: 'No dia do aniversário às 09:00',
    enabled: false,
    scheduledTime: '09:00',
    templateId: 'tmpl-birthday',
  },
];

const DEFAULT_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tmpl-no-show-d1',
    name: 'Confirmação Anti-No-Show (WhatsApp)',
    category: 'client',
    channel: 'whatsapp',
    content: `Fala, {{cliente}}! Passando pra lembrar do seu horário amanhã às *{{horario}}* com *{{barbeiro}}* para *{{servico}}* na {{unidade}}.\n\nPodemos confirmar sua presença? Responda:\n*1* para Confirmar\n*2* para Remarcar`,
    availableVariables: ['{{cliente}}', '{{horario}}', '{{barbeiro}}', '{{servico}}', '{{unidade}}'],
  },
  {
    id: 'tmpl-no-show-h2',
    name: 'Lembrete de Pontualidade 2h Antes (WhatsApp)',
    category: 'client',
    channel: 'whatsapp',
    content: `{{cliente}}, sua cadeira já está sendo preparada! Seu atendimento com *{{barbeiro}}* é hoje às *{{horario}}*.\n\n📍 *Endereço:* {{endereco_unidade}}\nTemos tolerância de 10 minutos. Te esperamos!`,
    availableVariables: ['{{cliente}}', '{{barbeiro}}', '{{horario}}', '{{endereco_unidade}}'],
  },
  {
    id: 'tmpl-review-nps',
    name: 'Avaliação & Review Google (WhatsApp)',
    category: 'client',
    channel: 'whatsapp',
    content: `Valeu pela visita hoje, {{cliente}}! Como ficou o visual com o {{barbeiro}}?\n\nDeixe sua avaliação rápida de 5 estrelas aqui:\n{{link_avaliacao}}\n\nAté a próxima!`,
    availableVariables: ['{{cliente}}', '{{barbeiro}}', '{{link_avaliacao}}'],
  },
  {
    id: 'tmpl-barber-agenda',
    name: 'Agenda Diária do Barbeiro (WhatsApp)',
    category: 'operational',
    channel: 'whatsapp',
    content: `Bom dia, {{barbeiro}}! ☀️ Sua agenda de hoje na {{unidade}}:\n\n• *Atendimentos:* {{total_agendados}} clientes (1º às {{primeiro_horario}} | último às {{ultimo_horario}})\n• *Clube dos Chefes:* {{total_clube}} assinantes na sua cadeira\n• *Janelas Livres p/ Encaixe:* {{horarios_livres}}\n\nBora pra cima! Acompanhe em tempo real pelo SMG.`,
    availableVariables: ['{{barbeiro}}', '{{unidade}}', '{{total_agendados}}', '{{primeiro_horario}}', '{{ultimo_horario}}', '{{total_clube}}', '{{horarios_livres}}'],
  },
  {
    id: 'tmpl-smart-return',
    name: 'Reativação Smart Return (WhatsApp)',
    category: 'retention',
    channel: 'whatsapp',
    content: `Opa, {{cliente}}! Notamos que já faz {{dias_sem_visita}} dias desde o seu último corte com o {{barbeiro}}.\n\nQue tal dar aquele talento no visual essa semana? Garanta seu horário em 1 minuto:\n{{link_agendamento}}`,
    availableVariables: ['{{cliente}}', '{{dias_sem_visita}}', '{{barbeiro}}', '{{link_agendamento}}'],
  },
  {
    id: 'tmpl-club-renewal',
    name: 'Aviso de Renovação do Clube (WhatsApp)',
    category: 'retention',
    channel: 'whatsapp',
    content: `Olá, {{cliente}}! Sua assinatura do *Clube dos Chefes ({{plano}})* renova hoje com sucesso.\n\nSeus {{creditos}} créditos mensais já estão liberados para uso. Aproveite para agendar seus atendimentos!`,
    availableVariables: ['{{cliente}}', '{{plano}}', '{{creditos}}'],
  },
];

const DEFAULT_QUEUE: DispatchQueueItem[] = [
  {
    id: 'q-101',
    automationName: 'Confirmação Anti-No-Show (Véspera)',
    recipientName: 'Carlos Eduardo',
    recipientContact: '(11) 98765-4321',
    channel: 'whatsapp',
    status: 'delivered',
    scheduledFor: 'Ontem 19:00',
    sentAt: 'Ontem 19:00:12',
    idempotencyKey: 'noshow_carlos_20261107',
  },
  {
    id: 'q-102',
    automationName: 'Agenda Diária Individual do Barbeiro',
    recipientName: 'Heron Ferreira (Barbeiro)',
    recipientContact: '(11) 97777-1111',
    channel: 'whatsapp',
    status: 'sent',
    scheduledFor: 'Hoje 08:00',
    sentAt: 'Hoje 08:00:03',
    idempotencyKey: 'agenda_heron_20261108',
  },
  {
    id: 'q-103',
    automationName: 'Briefing Matinal da Gestão',
    recipientName: 'Augusto (Admin)',
    recipientContact: 'augusto@sanchezbarber.com.br',
    channel: 'email',
    status: 'sent',
    scheduledFor: 'Hoje 07:30',
    sentAt: 'Hoje 07:30:01',
    idempotencyKey: 'briefing_augusto_20261108',
  },
  {
    id: 'q-104',
    automationName: 'Lembrete de Pontualidade (2h Antes)',
    recipientName: 'Felipe Azevedo',
    recipientContact: '(11) 98888-2222',
    channel: 'whatsapp',
    status: 'sent',
    scheduledFor: 'Hoje 12:30',
    sentAt: 'Hoje 12:30:05',
    idempotencyKey: 'lembrete_felipe_20261108',
  },
  {
    id: 'q-105',
    automationName: 'Confirmação Anti-No-Show (Véspera)',
    recipientName: 'Carlos Eduardo (Repetição)',
    recipientContact: '(11) 98765-4321',
    channel: 'whatsapp',
    status: 'skipped_duplicate',
    scheduledFor: 'Hoje 10:15',
    sentAt: 'Hoje 10:15:00',
    errorMessage: 'Bloqueado por Idempotência (Já enviado hoje)',
    idempotencyKey: 'noshow_carlos_20261107',
  },
];

const DEFAULT_SETTINGS: ConnectionSettings = {
  whatsappStatus: 'connected',
  whatsappPhoneNumber: '+55 11 98888-7777 (Unidade Parque Cisper)',
  resendStatus: 'active',
  senderEmail: 'resumos@soumanager.com.br',
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  dailyRateLimit: 500,
};

export const automationHubService = {
  async getRules(tenantId: string): Promise<AutomationRule[]> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}_rules_${tenantId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_RULES;
  },

  async toggleRule(tenantId: string, ruleId: string): Promise<AutomationRule[]> {
    const rules = await this.getRules(tenantId);
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_rules_${tenantId}`, JSON.stringify(updated));
    return updated;
  },

  async getTemplates(tenantId: string): Promise<AutomationTemplate[]> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}_templates_${tenantId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_TEMPLATES;
  },

  async saveTemplate(tenantId: string, template: AutomationTemplate): Promise<AutomationTemplate[]> {
    const templates = await this.getTemplates(tenantId);
    const updated = templates.map((t) => (t.id === template.id ? template : t));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_templates_${tenantId}`, JSON.stringify(updated));
    return updated;
  },

  async getQueue(tenantId: string): Promise<DispatchQueueItem[]> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}_queue_${tenantId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_QUEUE;
  },

  async getSettings(tenantId: string): Promise<ConnectionSettings> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}_settings_${tenantId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  },

  async updateSettings(tenantId: string, settings: ConnectionSettings): Promise<void> {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_settings_${tenantId}`, JSON.stringify(settings));
  },

  async addQueueItem(tenantId: string, item: DispatchQueueItem): Promise<DispatchQueueItem[]> {
    const queue = await this.getQueue(tenantId);
    const updated = [item, ...queue];
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_queue_${tenantId}`, JSON.stringify(updated));
    return updated;
  },

  async connectWhatsApp(tenantId: string, phoneNumber: string): Promise<ConnectionSettings> {
    const current = await this.getSettings(tenantId);
    const updated: ConnectionSettings = {
      ...current,
      whatsappStatus: 'connected',
      whatsappPhoneNumber: phoneNumber,
    };
    await this.updateSettings(tenantId, updated);
    return updated;
  },

  async disconnectWhatsApp(tenantId: string): Promise<ConnectionSettings> {
    const current = await this.getSettings(tenantId);
    const updated: ConnectionSettings = {
      ...current,
      whatsappStatus: 'disconnected',
      whatsappPhoneNumber: undefined,
    };
    await this.updateSettings(tenantId, updated);
    return updated;
  },
};
