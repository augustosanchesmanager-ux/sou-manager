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
  const parts = [`[${context}]`];
  if (payload.code) parts.push(`code=${payload.code}`);
  if (payload.status) parts.push(`status=${payload.status}`);
  parts.push(payload.message);
  if (payload.details) parts.push(`details=${payload.details}`);
  if (payload.hint) parts.push(`hint=${payload.hint}`);
  if (extra) parts.push(JSON.stringify(extra));
  console.error(parts.join(' | '), {
    ...payload,
    ...(extra || {}),
    ...(error instanceof Error ? { stack: error.stack } : {}),
  });
};
