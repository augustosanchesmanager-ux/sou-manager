export const generateIdempotencyKey = (prefix = 'req') => {
  const randomPart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
};

interface SupabaseLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

const normalizeErrorText = (error: SupabaseLikeError | null | undefined) =>
  [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const isMissingSupabaseColumnError = (
  error: SupabaseLikeError | null | undefined,
  column: string,
  table?: string,
) => {
  const text = normalizeErrorText(error);
  const normalizedColumn = column.toLowerCase();
  const normalizedTable = table?.toLowerCase();

  if (!text.includes(normalizedColumn)) {
    return false;
  }

  if (normalizedTable && !text.includes(normalizedTable)) {
    return false;
  }

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    text.includes('schema cache') ||
    text.includes('column')
  );
};

export const stripIdempotencyKey = <TPayload extends { idempotency_key?: unknown }>(
  payload: TPayload,
): Omit<TPayload, 'idempotency_key'> => {
  const { idempotency_key: _ignored, ...rest } = payload;
  return rest;
};
