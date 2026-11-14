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
  if (digits.startsWith('0')) return null;
  if (/^\d{2}9?0{8}$/.test(digits)) return null;
  return digits;
}

export function applyCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

export function normalizeCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits;
}

export function isValidBrCpf(cpf: string | null | undefined): boolean {
  const digits = normalizeCpf(cpf);
  if (!digits) return false;
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
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