export function parseBrazilianCurrency(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).trim();

  const cleaned = str
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

export function parseBrazilianDate(value: unknown): string | null {
  if (!value) return null;

  const str = String(value).trim();

  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      let day: string, month: string, year: string;

      if (str.includes('-') && str.indexOf('-') < 4) {
        [day, month, year] = match.slice(1);
      } else if (str.includes('-')) {
        [year, month, day] = match.slice(1);
      } else {
        [day, month, year] = match.slice(1);
      }

      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);

      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

export function formatDateToBrazilian(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function normalizePhoneBR(value: unknown): string {
  if (!value) return '';

  const str = String(value).replace(/\D/g, '');

  if (str.length < 10) return str;

  const ddd = str.slice(0, 2);
  const rest = str.slice(2);

  if (rest.length === 9) {
    return `+55${ddd}${rest}`;
  }

  if (rest.length === 8) {
    return `+55${ddd}${rest}`;
  }

  return str;
}

export function normalizePhoneInternational(value: unknown): string {
  return normalizePhoneBR(value);
}

export function parsePercentage(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const str = String(value).replace('%', '').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed / 100;
}

export function parseInteger(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;

  const str = String(value).replace(/\D/g, '');
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function toTitleCase(value: string): string {
  const connectors = ['de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'em', 'com', 'para', 'para'];
  return value
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index > 0 && connectors.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return false;

  const str = String(value).trim().toLowerCase();
  return !['false', 'nao', 'não', 'inativo', '0', 'não', 'inactive', 'no', 'n'].includes(str);
}

export function parseBooleanField(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'boolean') return value;

  const str = String(value).trim().toLowerCase();
  if (['true', 'sim', 'ativo', '1', 's', 'y', 'yes'].includes(str)) return true;
  return false;
}