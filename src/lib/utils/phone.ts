export interface NormalizedPhone {
  digits: string;
  isValid: boolean;
}

export function normalizePhone(phone: string | null | undefined): NormalizedPhone {
  if (!phone) return { digits: '', isValid: false };
  const rawDigits = phone.replace(/\D/g, '');
  const digits =
    (rawDigits.length === 12 || rawDigits.length === 13) && rawDigits.startsWith('55')
      ? rawDigits.slice(2)
      : rawDigits;

  if (digits.length >= 10 && digits.length <= 11) {
    return { digits, isValid: true };
  }
  return { digits, isValid: false };
}

/**
 * Returns canonical 10-11 digit Brazilian phone (without +55/55),
 * or null for invalid lengths or repeated-digit placeholders (e.g. 11111111111).
 */
export function getCanonicalBrPhone(phone: string | null | undefined): string | null {
  const { digits, isValid } = normalizePhone(phone);
  if (!isValid) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits;
}

/**
 * Finds the primary matching client by canonical Brazilian phone (ignoring +55/55 and formatting).
 * Prefers non-shared phone owners (is_shared_phone !== true).
 */
export function findClientByCanonicalPhone<
  T extends { phone?: string | null; is_shared_phone?: boolean | null },
>(clients: readonly T[], phone: string | null | undefined): T | undefined {
  const target = getCanonicalBrPhone(phone);
  if (!target) return undefined;

  let sharedMatch: T | undefined;
  for (const client of clients) {
    if (getCanonicalBrPhone(client.phone) !== target) continue;
    if (client.is_shared_phone !== true) return client;
    if (!sharedMatch) sharedMatch = client;
  }
  return sharedMatch;
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