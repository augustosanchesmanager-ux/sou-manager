/**
 * [SMG][LIB][HTTP] API Idempotency Middleware / Helper
 *
 * For endpoints and application services creating orders or processing payments:
 * - Accepts client-provided Idempotency-Key header.
 * - Computes SHA-256 hash of payload to prevent parameter tampering.
 * - Returns exact cached response on repetition.
 * - Prevents concurrent duplicate execution with 409 Conflict or lock.
 */

import { assertValidIdempotencyKey } from '../payments/gatewayClient';

export interface IdempotentExecutionOptions {
  tenantId: string;
  idempotencyKey?: string | null;
  path: string;
  payload: Record<string, unknown>;
  db: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  };
}

export interface IdempotentResult<T> {
  statusCode: number;
  data: T;
  replayed: boolean;
}

const textEncoder = new TextEncoder();

export const computeSha256Hex = async (content: string): Promise<string> => {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(content));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Wraps an endpoint or service execution with end-to-end HTTP idempotency.
 */
export const withApiIdempotency = async <T extends Record<string, unknown>>(
  options: IdempotentExecutionOptions,
  action: () => Promise<{ statusCode: number; data: T }>,
): Promise<IdempotentResult<T>> => {
  const { tenantId, idempotencyKey, path, payload, db } = options;

  // Se não foi fornecida chave de idempotência, executa normalmente
  if (!idempotencyKey) {
    const result = await action();
    return {
      statusCode: result.statusCode,
      data: result.data,
      replayed: false,
    };
  }

  // Validação formal da chave (UUID v4, sem dados pessoais)
  assertValidIdempotencyKey(idempotencyKey);

  const requestHash = await computeSha256Hex(JSON.stringify(payload));

  // 1. Tentar claim atômico no banco
  const { data: claim, error: claimError } = await db.rpc('claim_api_idempotency_key', {
    p_tenant_id: tenantId,
    p_idempotency_key: idempotencyKey,
    p_path: path,
    p_request_hash: requestHash,
  });

  if (claimError) {
    throw new Error(`Falha ao verificar idempotência da requisição: ${claimError.message}`);
  }

  // 2. Se já finalizado com sucesso anteriormente -> Replay exato da resposta
  if (claim?.action === 'replay') {
    return {
      statusCode: claim.response_status ?? 200,
      data: (claim.response_body ?? {}) as T,
      replayed: true,
    };
  }

  // 3. Se chave foi usada com payload diferente -> Erro de integridade
  if (claim?.action === 'reject') {
    throw new Error(claim.error || 'Idempotency-Key mismatch: chave reutilizada com payload alterado.');
  }

  // 4. Se ainda em processamento concorrente -> 409 Conflict
  if (claim?.action === 'wait') {
    const err = new Error(claim.error || 'Operação concorrente em andamento.');
    (err as any).statusCode = 409;
    throw err;
  }

  // 5. Executar ação original (primeira vez)
  let executionResult: { statusCode: number; data: T };
  try {
    executionResult = await action();
  } catch (actionErr) {
    // Se a ação falhou, não grava como completada, permitindo retry posterior
    throw actionErr;
  }

  // 6. Gravar resposta para futuros replays
  try {
    await db.rpc('complete_api_idempotency_key', {
      p_tenant_id: tenantId,
      p_idempotency_key: idempotencyKey,
      p_response_status: executionResult.statusCode,
      p_response_body: executionResult.data,
    });
  } catch (completeErr) {
    console.error('[IDEMPOTENCY] Falha ao registrar resposta completada:', completeErr);
  }

  return {
    statusCode: executionResult.statusCode,
    data: executionResult.data,
    replayed: false,
  };
};
