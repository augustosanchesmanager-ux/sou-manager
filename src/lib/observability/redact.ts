/**
 * Redaction Utility — Fase 6.2 Observabilidade (P0)
 *
 * Sanitiza payloads antes de qualquer sink de log (console, memória ou futuro
 * transporte remoto). Regras:
 *  - chaves sensíveis são substituídas integralmente por [REDACTED];
 *  - valores textuais têm padrões de alta confiança mascarados
 *    (Bearer, JWT, e-mail, CPF, telefone BR, segredos em query string);
 *  - recursão limitada a MAX_REDACT_DEPTH (4); além disso → [TRUNCATED];
 *  - referências circulares → [Circular];
 *  - fail-open: qualquer falha interna retorna [UNREDACTABLE], nunca lança.
 *
 * Invariante multi-tenant: `tenantId` / `tenant_id` são preservados como tag
 * de correlação (UUID interno, não PII). Nunca inferir tenant a partir de PII.
 */

export const REDACTED = '[REDACTED]';
export const TRUNCATED = '[TRUNCATED]';
export const UNREDACTABLE = '[UNREDACTABLE]';
export const CIRCULAR = '[Circular]';
export const MAX_REDACT_DEPTH = 4;

/**
 * Chaves cujo valor é sempre substituído. Case-insensitive.
 * Não inclui `tenant` de propósito: tenantId é tag de correlação permitida.
 */
const SENSITIVE_KEY_PATTERN =
  /(pass(word|wd)?|pwd|senha|token|secret|jwt|authorization|bearer|api[_-]?key|access[_-]?key|private[_-]?key|card([_-]?(number|num|no))?|cvv|cvc|cpf|cnpj|ssn|email|e[_-]?mail|phone|telefone|celular|whatsapp)/i;

/** Padrões aplicados a strings livres. Ordem importa. */
const INLINE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED}`],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  [/([?&](?:token|access_token|refresh_token|api[_-]?key|key|secret)=)[^&\s]+/gi, `$1${REDACTED}`],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, REDACTED],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, REDACTED],
  [/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, REDACTED],
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactString(value: string): string {
  let output = value;
  for (const [pattern, replacement] of INLINE_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function redactInternal(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const type = typeof value;
  if (type === 'string') {
    return redactString(value as string);
  }
  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return value;
  }
  if (type === 'symbol') {
    return String(value);
  }
  if (type === 'function') {
    return '[Function]';
  }

  if (depth >= MAX_REDACT_DEPTH) {
    return TRUNCATED;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    const safe: Record<string, unknown> = {
      name: value.name,
      message: redactString(value.message),
    };
    if (value.stack) {
      safe.stack = redactString(value.stack);
    }
    return safe;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const out = value.map((item) => redactInternal(item, depth + 1, seen));
    seen.delete(value);
    return out;
  }

  if (value instanceof Map) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, item] of value.entries()) {
      const k = String(key);
      out[k] = isSensitiveKey(k) ? REDACTED : redactInternal(item, depth + 1, seen);
    }
    seen.delete(value);
    return out;
  }

  if (value instanceof Set) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const out = Array.from(value, (item) => redactInternal(item, depth + 1, seen));
    seen.delete(value);
    return out;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (seen.has(record)) {
      return CIRCULAR;
    }
    seen.add(record);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactInternal(item, depth + 1, seen);
    }
    seen.delete(record);
    return out;
  }

  return String(value);
}

/**
 * Redige um valor arbitrário sem mutar a entrada.
 * Fail-open: nunca lança; em falha retorna [UNREDACTABLE].
 */
export function redact<T>(value: T): T {
  try {
    return redactInternal(value, 0, new WeakSet<object>()) as T;
  } catch {
    return UNREDACTABLE as unknown as T;
  }
}
