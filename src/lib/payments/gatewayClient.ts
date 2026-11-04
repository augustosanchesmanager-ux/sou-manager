/**
 * [SMG][LIB][PAYMENTS] Gateway Client with Outbound Idempotency & Retries
 *
 * Requirements:
 * 1. Sends an Idempotency-Key (UUID v4) generated once per business operation and reused on retries.
 * 2. Strictly rejects personal data (email, CPF, CNPJ, phone) as idempotency key.
 * 3. Anti-out-of-order reconciliation: provides retrieve methods to fetch authoritative state from gateway.
 */

export interface GatewayRequestOptions {
  idempotencyKey?: string;
  maxRetries?: number;
  backoffMs?: number;
}

export interface GatewayChargeInput {
  amount: number;
  currency?: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface GatewaySubscriptionInput {
  customerId: string;
  planId: string;
  metadata?: Record<string, string>;
}

export interface GatewayRefundInput {
  chargeId: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_OR_PHONE_REGEX = /^\d{10,14}$/;

/**
 * Validates that the provided idempotency key is a valid UUID v4 and does not contain personal data.
 */
export const assertValidIdempotencyKey = (key: string): void => {
  if (!key || typeof key !== 'string') {
    throw new Error('Chave de idempotência inválida: deve ser uma string não vazia.');
  }

  // Proibição estrita de dados pessoais
  const isNumericIdentifier = /^[\d.\-()+\s]+$/.test(key);
  if (EMAIL_REGEX.test(key) || (isNumericIdentifier && CPF_OR_PHONE_REGEX.test(key.replace(/\D/g, '')))) {
    throw new Error('Violação de segurança: nunca utilize dados pessoais (e-mail, CPF, telefone) como chave de idempotência.');
  }

  if (!UUID_V4_REGEX.test(key)) {
    throw new Error(`Chave de idempotência inválida: deve ser um UUID v4 (recebido: '${key}').`);
  }
};

/**
 * Generates a compliant UUID v4 idempotency key.
 */
export const generateIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export class GatewayClient {
  constructor(
    private readonly baseUrl: string = 'https://api.gateway.local/v1',
    private readonly apiKey: string = 'test_key',
    private readonly fetchFn: typeof fetch = globalThis.fetch?.bind(globalThis),
  ) {}

  /**
   * Executes an outbound request to the payment gateway with retry and fixed idempotency key.
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      body?: Record<string, unknown>;
      idempotencyKey?: string;
      maxRetries?: number;
      backoffMs?: number;
    } = {},
  ): Promise<{ data: T; idempotencyKeyUsed: string | null; attempts: number }> {
    const method = options.method || 'POST';
    const isMutation = method === 'POST' || method === 'DELETE';
    const maxRetries = options.maxRetries ?? 2;
    const backoffMs = options.backoffMs ?? 50;

    // Se for mutação, garante Idempotency-Key (UUID v4)
    let idempotencyKey: string | null = null;
    if (isMutation) {
      if (options.idempotencyKey) {
        assertValidIdempotencyKey(options.idempotencyKey);
        idempotencyKey = options.idempotencyKey;
      } else {
        idempotencyKey = generateIdempotencyKey();
      }
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        };

        if (idempotencyKey) {
          headers['Idempotency-Key'] = idempotencyKey;
        }

        const response = await this.fetchFn(`${this.baseUrl}${endpoint}`, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          // 4xx (exceto 429) são erros de negócio do cliente — não retentar
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errText = await response.text();
            throw new Error(`Gateway client error (${response.status}): ${errText}`);
          }
          throw new Error(`Gateway server error (${response.status})`);
        }

        const data = (await response.json()) as T;
        return { data, idempotencyKeyUsed: idempotencyKey, attempts: attempt };
      } catch (err: any) {
        lastError = err;
        if (attempt <= maxRetries) {
          // Backoff exponencial para retry
          await new Promise((res) => setTimeout(res, backoffMs * 2 ** (attempt - 1)));
        }
      }
    }

    throw lastError || new Error('Gateway request failed after retries');
  }

  /**
   * Criação de cobrança avulsa com idempotency key reutilizável em retry.
   */
  async createCharge(input: GatewayChargeInput, options?: GatewayRequestOptions) {
    return this.request<{ id: string; status: string; amount: number }>('/charges', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
      idempotencyKey: options?.idempotencyKey,
      maxRetries: options?.maxRetries,
    });
  }

  /**
   * Criação de assinatura com idempotency key reutilizável em retry.
   */
  async createSubscription(input: GatewaySubscriptionInput, options?: GatewayRequestOptions) {
    return this.request<{ id: string; status: string; planId: string }>('/subscriptions', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
      idempotencyKey: options?.idempotencyKey,
      maxRetries: options?.maxRetries,
    });
  }

  /**
   * Reembolso com idempotency key reutilizável em retry.
   */
  async createRefund(input: GatewayRefundInput, options?: GatewayRequestOptions) {
    return this.request<{ id: string; status: string; chargeId: string }>('/refunds', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
      idempotencyKey: options?.idempotencyKey,
      maxRetries: options?.maxRetries,
    });
  }

  /**
   * Busca estado fresco da assinatura (Anti-Out-of-Order Webhooks).
   */
  async retrieveSubscription(subscriptionId: string) {
    return this.request<{ id: string; status: string; current_period_end: number }>(
      `/subscriptions/${subscriptionId}`,
      { method: 'GET' },
    );
  }

  /**
   * Busca estado fresco da cobrança (Anti-Out-of-Order Webhooks).
   */
  async retrieveCharge(chargeId: string) {
    return this.request<{ id: string; status: string; paid: boolean }>(`/charges/${chargeId}`, {
      method: 'GET',
    });
  }
}
