/**
 * [SMG][UTILS] sanitization
 *
 * Converte strings vazias ou preenchidas apenas com espaços em null.
 * Evita violação de restrições UNIQUE (ex: CPF, email, PIX) ou constraints
 * em colunas opcionais no Supabase / PostgreSQL.
 */

export function sanitizeNullableString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function sanitizeOptionalFields<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      sanitized[key] = trimmed === '' ? null : trimmed;
    } else if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      sanitized[key] = sanitizeOptionalFields(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}
