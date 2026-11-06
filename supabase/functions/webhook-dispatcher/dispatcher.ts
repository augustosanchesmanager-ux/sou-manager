import {
  generateWebhookSignature,
} from './crypto.ts';
import type {
  WebhookDeliveryRecord,
  DispatchResult,
  DispatchOptions,
} from './types.ts';

/**
 * Tabela de delays para retries em segundos:
 * 1ª falha (attempts = 1): +1 min (60s)
 * 2ª falha (attempts = 2): +5 min (300s)
 * 3ª falha (attempts = 3): +15 min (900s)
 * 4ª falha (attempts = 4): +1 hora (3600s)
 * 5ª falha (attempts = 5): +6 horas (21600s)
 * >= 6 falhas: sem retry (transiciona para failed definitivo)
 */
export const RETRY_DELAYS_SECONDS: readonly number[] = [
  60,      // Tentativa 1 -> +1m
  300,     // Tentativa 2 -> +5m
  900,     // Tentativa 3 -> +15m
  3600,    // Tentativa 4 -> +1h
  21600,   // Tentativa 5 -> +6h
];

export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Calcula a próxima data de re-tentativa com base no número de tentativas já realizadas.
 * Se attempts >= 6 (ou seja, excedeu o limite de 5 retries agendáveis), retorna null.
 */
export function calculateNextRetry(attempts: number, baseDate: Date = new Date()): Date | null {
  if (attempts <= 0) {
    // 1ª tentativa
    const delay = RETRY_DELAYS_SECONDS[0];
    return new Date(baseDate.getTime() + delay * 1000);
  }

  const delayIndex = attempts - 1;
  if (delayIndex >= RETRY_DELAYS_SECONDS.length) {
    return null;
  }

  const delaySeconds = RETRY_DELAYS_SECONDS[delayIndex];
  return new Date(baseDate.getTime() + delaySeconds * 1000);
}

/**
 * Trunca uma string para o tamanho máximo especificado
 */
export function truncateString(str: string | null | undefined, maxLength: number = 1024): string | null {
  if (str === null || str === undefined) {
    return null;
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength);
}

/**
 * Executa o despacho individual de um webhook para o endpoint do assinante com:
 * - Assinatura criptográfica HMAC-SHA256 (X-SMG-Signature)
 * - Headers canônicos (Content-Type, User-Agent, X-SMG-Delivery-Id, X-SMG-Event)
 * - Timeout estrito de segurança (padrão 8.000 ms)
 * - Captura e truncamento seguro do corpo de resposta (máx 1024 caracteres)
 * - Cálculo de backoff exponencial em caso de falha HTTP ou erro de rede/timeout
 */
export async function dispatchSingleWebhook(
  delivery: WebhookDeliveryRecord,
  targetUrl: string,
  secret: string,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBodyLength = options.maxBodyLength ?? 1024;
  const fetchFn = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();

  const startTime = Date.now();
  const rawPayload = JSON.stringify(delivery.payload);

  // 1. Gerar assinatura HMAC-SHA256
  const timestampSeconds = Math.floor(now.getTime() / 1000);
  let signatureHeader = '';
  try {
    const sig = await generateWebhookSignature(rawPayload, secret, timestampSeconds);
    signatureHeader = sig.signatureHeader;
  } catch (sigErr: any) {
    const durationMs = Date.now() - startTime;
    const newAttempts = delivery.attempts + 1;
    const nextRetryDate = calculateNextRetry(newAttempts, now);
    return {
      deliveryId: delivery.id,
      status: nextRetryDate ? 'pending' : 'failed',
      attempts: newAttempts,
      nextRetryAt: nextRetryDate ? nextRetryDate.toISOString() : null,
      responseStatus: null,
      responseBody: truncateString(`Erro ao gerar assinatura HMAC: ${sigErr?.message || String(sigErr)}`, maxBodyLength),
      deliveredAt: null,
      durationMs,
      error: sigErr?.message || String(sigErr),
    };
  }

  // 2. Montar AbortController para timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SMG-Webhook-Dispatcher/1.0',
        'X-SMG-Delivery-Id': delivery.id,
        'X-SMG-Event': delivery.event_type,
        'X-SMG-Signature': signatureHeader,
      },
      body: rawPayload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    let responseText = '';
    try {
      responseText = await response.text();
    } catch {
      responseText = '';
    }
    const truncatedBody = truncateString(responseText, maxBodyLength);

    // Sucesso: 2xx (200 - 299)
    if (response.ok) {
      return {
        deliveryId: delivery.id,
        status: 'delivered',
        attempts: delivery.attempts + 1,
        nextRetryAt: null,
        responseStatus: response.status,
        responseBody: truncatedBody,
        deliveredAt: now.toISOString(),
        durationMs,
      };
    }

    // Falha HTTP (ex: 400, 404, 500, 502...)
    const newAttempts = delivery.attempts + 1;
    const nextRetryDate = calculateNextRetry(newAttempts, now);

    return {
      deliveryId: delivery.id,
      status: nextRetryDate ? 'pending' : 'failed',
      attempts: newAttempts,
      nextRetryAt: nextRetryDate ? nextRetryDate.toISOString() : null,
      responseStatus: response.status,
      responseBody: truncatedBody,
      deliveredAt: null,
      durationMs,
      error: `HTTP ${response.status}`,
    };
  } catch (networkError: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const isTimeout = networkError?.name === 'AbortError';

    const newAttempts = delivery.attempts + 1;
    const nextRetryDate = calculateNextRetry(newAttempts, now);
    const errorMsg = isTimeout
      ? `Timeout excedido após ${timeoutMs}ms`
      : (networkError?.message || 'Falha de rede ao conectar com webhook');

    return {
      deliveryId: delivery.id,
      status: nextRetryDate ? 'pending' : 'failed',
      attempts: newAttempts,
      nextRetryAt: nextRetryDate ? nextRetryDate.toISOString() : null,
      responseStatus: isTimeout ? 504 : null,
      responseBody: truncateString(errorMsg, maxBodyLength),
      deliveredAt: null,
      durationMs,
      error: errorMsg,
    };
  }
}
