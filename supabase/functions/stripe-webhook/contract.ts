/**
 * [SMG][EDGE][PAYMENTS] Stripe Webhook Contract
 *
 * Pure logic module for inbound Stripe / payment webhooks:
 * - Signature verification using raw request body + HMAC-SHA256 (timing-safe)
 * - Anti-replay attack tolerance (default 5 minutes)
 * - Atomic event deduplication via webhook_events
 * - Immediate 200 response for duplicates
 * - Lightweight outbox dispatch for async processing (no heavy work in webhook)
 */

export interface WebhookVerificationOptions {
  toleranceSeconds?: number;
  nowEpochSeconds?: number;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  created?: number;
  data: {
    object: Record<string, unknown>;
  };
  livemode?: boolean;
}

export interface WebhookProcessingResult {
  statusCode: number;
  body: {
    received: boolean;
    duplicate?: boolean;
    queued?: boolean;
    eventId?: string;
    error?: string;
  };
}

export interface WebhookDatabaseClient {
  recordWebhookEvent: (params: {
    gateway: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) => Promise<{ recorded: boolean; duplicate: boolean; status?: string }>;

  enqueueOutboxItem?: (params: {
    tenantId: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) => Promise<void>;
}

const textEncoder = new TextEncoder();

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 */
export const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < leftBytes.length; i++) {
    diff |= leftBytes[i] ^ rightBytes[i];
  }
  return diff === 0;
};

/**
 * Computes HMAC-SHA256 hex string using global Web Crypto API.
 */
export const hmacSha256Hex = async (secret: string, data: string): Promise<string> => {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Parses Stripe signature header formatted as:
 * t=1492774577,v1=5257a869e7ecebeda32affa62cd4908f483a625b4c473857bee1e4334048022b
 */
export const parseStripeSignatureHeader = (
  header: string,
): { timestamp: number; signatures: string[] } | null => {
  if (!header || typeof header !== 'string') return null;

  const parts = header.split(',');
  let timestamp = -1;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key === 't') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) timestamp = parsed;
    } else if (key === 'v1' && value) {
      signatures.push(value.trim());
    }
  }

  if (timestamp === -1 || signatures.length === 0) return null;
  return { timestamp, signatures };
};

/**
 * Verifies webhook cryptographic signature against raw request body.
 */
export const verifyStripeSignature = async (
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  options: WebhookVerificationOptions = {},
): Promise<{ valid: boolean; reason?: string }> => {
  if (!webhookSecret || !webhookSecret.trim()) {
    return { valid: false, reason: 'Missing webhook secret' };
  }

  const parsedHeader = parseStripeSignatureHeader(signatureHeader);
  if (!parsedHeader) {
    return { valid: false, reason: 'Malformed or missing stripe-signature header' };
  }

  const tolerance = options.toleranceSeconds ?? 300; // 5 min default
  const now = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);

  if (Math.abs(now - parsedHeader.timestamp) > tolerance) {
    return { valid: false, reason: 'Webhook timestamp outside tolerance window' };
  }

  const signedPayload = `${parsedHeader.timestamp}.${rawBody}`;
  const expectedSignature = await hmacSha256Hex(webhookSecret, signedPayload);

  const matched = parsedHeader.signatures.some((sig) => timingSafeEqual(sig, expectedSignature));

  if (!matched) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  return { valid: true };
};

/**
 * Processes an inbound webhook request atomically:
 * 1. Checks & records event_id in database.
 * 2. If already exists (duplicate), immediately returns HTTP 200 and halts.
 * 3. If new, enqueues to outbox for async worker processing.
 * 4. Returns HTTP 200 within ms.
 */
export const handleWebhookEvent = async (
  event: WebhookEventPayload,
  db: WebhookDatabaseClient,
  tenantId: string = 'system',
): Promise<WebhookProcessingResult> => {
  if (!event || !event.id || !event.type) {
    return {
      statusCode: 400,
      body: { received: false, error: 'Event payload must contain id and type' },
    };
  }

  // 1. Tentar gravar atômica na tabela de idempotência
  const recordResult = await db.recordWebhookEvent({
    gateway: 'stripe',
    eventId: event.id,
    eventType: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  // 2. Se já existia (duplicate), responde 200 e NÃO faz mais nada
  if (recordResult.duplicate) {
    return {
      statusCode: 200,
      body: {
        received: true,
        duplicate: true,
        eventId: event.id,
      },
    };
  }

  // 3. Se novo, envia o trabalho pesado para a fila/outbox
  if (db.enqueueOutboxItem) {
    await db.enqueueOutboxItem({
      tenantId,
      eventId: event.id,
      eventType: event.type,
      payload: event.data?.object || {},
    });
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      queued: true,
      eventId: event.id,
    },
  };
};
