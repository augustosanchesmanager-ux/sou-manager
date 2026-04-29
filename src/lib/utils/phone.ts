export interface NormalizedPhone {
  digits: string;
  isValid: boolean;
}

export function normalizePhone(phone: string | null | undefined): NormalizedPhone {
  if (!phone) return { digits: '', isValid: false };
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) {
    return { digits, isValid: true };
  }
  return { digits, isValid: false };
}

export function buildWhatsAppUrl(
  name: string,
  phone: string | null | undefined,
  message: string
): string | null {
  const { digits, isValid } = normalizePhone(phone);
  if (!isValid) return null;

  const firstName = name.split(' ')[0];
  const template = message || `Olá, ${firstName}! Aqui é da Sanchez Barber. Faz um tempinho que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?`;
  const encoded = encodeURIComponent(template);

  if (digits.length === 10 || digits.length === 11) {
    return `https://wa.me/55${digits}?text=${encoded}`;
  }

  return null;
}