import { redact } from '../observability/redact';

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
};

export type SupabaseErrorPayload = {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
  name: string | null;
};

export const extractSupabaseError = (error: unknown): SupabaseErrorPayload => {
  if (error && typeof error === 'object') {
    const e = error as SupabaseErrorLike;
    return {
      message: e.message || 'Erro sem mensagem',
      code: e.code || null,
      details: e.details || null,
      hint: e.hint || null,
      status: e.status || null,
      name: e.name || null,
    };
  }

  return {
    message: String(error || 'Erro desconhecido'),
    code: null,
    details: null,
    hint: null,
    status: null,
    name: null,
  };
};

export const logSupabaseError = (
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void => {
  const payload = extractSupabaseError(error);
  const safePayload = redact(payload);
  const safeExtra = extra ? redact(extra) : undefined;

  const parts = [`[${context}]`];
  if (safePayload.code) parts.push(`code=${safePayload.code}`);
  if (safePayload.status) parts.push(`status=${safePayload.status}`);
  parts.push(safePayload.message);
  if (safePayload.details) parts.push(`details=${safePayload.details}`);
  if (safePayload.hint) parts.push(`hint=${safePayload.hint}`);
  if (safeExtra) parts.push(JSON.stringify(safeExtra));

  console.error(parts.join(' | '), {
    ...safePayload,
    ...(safeExtra || {}),
    ...(error instanceof Error && error.stack ? { stack: redact(error.stack) } : {}),
  });
};
