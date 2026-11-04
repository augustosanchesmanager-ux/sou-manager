/**
 * clientReengagement.ts
 * Lógica pura para detecção de clientes inativos / churn preventivo (Fase 7.1)
 * e geração de mensagens personalizadas para reengajamento via WhatsApp.
 */

export type InactivityTier = 'active' | 'absent' | 'critical' | 'never';

export interface InactivityStatus {
  days: number | null;
  tier: InactivityTier;
  label: string;
  badgeClass: string;
}

/**
 * 1. Calcula os dias decorridos desde a data da última visita.
 */
export function calculateDaysSinceDate(
  dateStr: string | null | undefined,
  referenceDate = new Date()
): number | null {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return null;
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const diffMs = referenceDate.getTime() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * 2. Classifica a inatividade do cliente por tiers operacionais:
 * - active: < 30 dias (visita recente)
 * - absent: 30 a 60 dias (ausente, momento ideal de lembrete)
 * - critical: > 60 dias (crítico, risco alto de churn)
 * - never: sem registro de visita
 */
export function getClientInactivityStatus(
  lastVisit: string | null | undefined,
  referenceDate = new Date()
): InactivityStatus {
  const days = calculateDaysSinceDate(lastVisit, referenceDate);

  if (days === null) {
    return {
      days: null,
      tier: 'never',
      label: 'Sem visitas',
      badgeClass:
        'text-slate-500 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10',
    };
  }

  if (days < 30) {
    const label = days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `Há ${days} dias`;
    return {
      days,
      tier: 'active',
      label,
      badgeClass:
        'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20',
    };
  }

  if (days <= 60) {
    return {
      days,
      tier: 'absent',
      label: `Há ${days} dias`,
      badgeClass:
        'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20',
    };
  }

  return {
    days,
    tier: 'critical',
    label: `Há ${days} dias`,
    badgeClass:
      'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20',
  };
}

/**
 * 3. Sanitiza o telefone para o formato padrão internacional do WhatsApp.
 * Adiciona DDI 55 caso seja número brasileiro com 10 ou 11 dígitos.
 */
export function sanitizePhoneNumberForWhatsApp(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Se já começou com '+' explícito, respeita o DDI internacional fornecido
  if (trimmed.startsWith('+')) {
    return digits;
  }

  // Se já começa com 55 e tem 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Se tem 10 ou 11 dígitos (DDD + número), assume Brasil (+55)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * 4. Gera o texto da mensagem de reengajamento com tom profissional e amigável.
 */
export function generateReengagementMessage(params: {
  clientName: string;
  shopName?: string;
  daysSinceVisit?: number | null;
  bookingUrl?: string;
}): string {
  const { clientName, shopName, daysSinceVisit, bookingUrl } = params;

  const rawFirstName = clientName ? clientName.trim().split(' ')[0] : '';
  const firstName = rawFirstName || 'amigo';
  const shop = shopName?.trim() ? `da ${shopName.trim()}` : 'da equipe da barbearia';

  let timeNotice = 'já faz algum tempo que não nos vemos';
  if (daysSinceVisit != null && daysSinceVisit > 0) {
    timeNotice = `faz cerca de ${daysSinceVisit} dias desde sua última visita`;
  }

  let message = `Olá, ${firstName}! Tudo bem? Aqui é ${shop}.\n\nNotamos que ${timeNotice} e queríamos saber como você está. Que tal renovar aquele corte e dar aquele trato no visual essa semana? 💈✂️`;

  if (bookingUrl && bookingUrl.trim()) {
    message += `\n\nVocê pode escolher o melhor horário direto por aqui:\n${bookingUrl.trim()}`;
  }

  return message;
}

/**
 * 5. Constrói o link oficial do WhatsApp (wa.me) pronto para clique.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = sanitizePhoneNumberForWhatsApp(phone);
  if (!cleanPhone) return '';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
