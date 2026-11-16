import { normalizePhone } from '../lib/utils/phone';

export interface AppointmentTemplateParams {
  clientName: string;
  serviceName: string;
  timeLabel: string;
  bookingUrl: string;
}

export interface WhatsAppTemplateOption {
  id: 'confirm' | 'delay' | 'tolerance' | 'reschedule';
  label: string;
  description: string;
  icon: string;
  message: string;
}

export interface PostSaleThankYouParams {
  clientName: string;
  barbershopName: string;
  bookingUrl: string;
  googleReviewUrl?: string | null;
}

export function cleanPhoneNumber(phone?: string | null): string {
  const { digits, isValid } = normalizePhone(phone);
  if (!isValid || !digits) return '';
  return `55${digits}`;
}

export function isValidWhatsAppPhone(phone?: string | null): boolean {
  return Boolean(cleanPhoneNumber(phone));
}

export function generateWhatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function getFirstName(fullName?: string | null, fallback = 'Cliente'): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0] || fallback;
}

export function buildPublicBookingUrl(slug?: string | null): string {
  const safeSlug = (slug || '').trim() || 'sua-barbearia';
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}${window.location.pathname || ''}`.replace(/\/+$/, '')
      : 'https://barber.soumanager.com';
  return `${baseUrl}/#/agendar/${encodeURIComponent(safeSlug)}`;
}

export function buildAppointmentWhatsAppTemplates(
  params: AppointmentTemplateParams,
): WhatsAppTemplateOption[] {
  const firstName = getFirstName(params.clientName);
  const service = (params.serviceName || '').trim() || 'seu atendimento';
  const time = (params.timeLabel || '').trim() || '--:--';
  const bookingUrl = (params.bookingUrl || '').trim() || buildPublicBookingUrl(null);

  return [
    {
      id: 'confirm',
      label: 'Confirmar Horário',
      description: 'Confirmação direta do serviço e horário de hoje',
      icon: 'check_circle',
      message: `Fala *${firstName}*, tudo certo? Passando pra confirmar seu horário de *${service}* hoje às *${time}*.`,
    },
    {
      id: 'delay',
      label: 'Notificar Atraso',
      description: 'Consulta rápida caso o cliente esteja atrasado',
      icon: 'schedule',
      message: `Fala *${firstName}*, notamos um pequeno atraso. Ainda consegue chegar para o seu horário das *${time}*?`,
    },
    {
      id: 'tolerance',
      label: 'Pedir Tolerância',
      description: 'Avisa que o barbeiro está finalizando o atendimento anterior',
      icon: 'hourglass_top',
      message: `Fala *${firstName}*, seu barbeiro está finalizando um atendimento e pedimos uns minutinhos de tolerância, mas já estamos te esperando!`,
    },
    {
      id: 'reschedule',
      label: 'Remarcar (Falta)',
      description: 'Convite cordial com link direto para reagendar',
      icon: 'event_repeat',
      message: `Fala *${firstName}*, como não conseguimos te atender hoje, vamos remarcar para não deixar o cabelo perder o corte? Só escolher um horário aqui: *${bookingUrl}*`,
    },
  ];
}

export function buildPostSaleThankYouMessage(params: PostSaleThankYouParams): string {
  const firstName = getFirstName(params.clientName);
  const shopName = (params.barbershopName || '').trim() || 'nossa barbearia';
  const bookingUrl = (params.bookingUrl || '').trim() || buildPublicBookingUrl(null);
  const trimmedReviewUrl = (params.googleReviewUrl || '').trim();

  if (trimmedReviewUrl) {
    return (
      `Fala *${firstName}*, valeu por colar na *${shopName}* hoje! ✂️\n\n` +
      `Se curtiu o atendimento, dá uma força avaliando a gente no Google, é rapidinho: *${trimmedReviewUrl}*\n\n` +
      `E para agendar seus próximos cortes ou deixar alguma sugestão para nossa equipe, é só acessar nosso link: *${bookingUrl}*`
    );
  }

  return (
    `Fala *${firstName}*, valeu por colar na *${shopName}* hoje! ✂️\n\n` +
    `Para agendar seus próximos cortes ou deixar alguma sugestão para nossa equipe, é só acessar nosso link: *${bookingUrl}*`
  );
}
