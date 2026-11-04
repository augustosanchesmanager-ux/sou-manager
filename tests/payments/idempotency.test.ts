import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyStripeSignature,
  handleWebhookEvent,
  parseStripeSignatureHeader,
  hmacSha256Hex,
  type WebhookDatabaseClient,
  type WebhookEventPayload,
} from '../../supabase/functions/stripe-webhook/contract';
import {
  GatewayClient,
  assertValidIdempotencyKey,
  generateIdempotencyKey,
} from '../../src/lib/payments/gatewayClient';
import { withApiIdempotency } from '../../src/lib/http/idempotency';
import * as fs from 'fs';
import * as path from 'path';

describe('Payment & Webhook Idempotency Hardening', () => {
  const webhookSecret = 'whsec_test_secret_1234567890';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Inbound Webhooks: Raw Body Signature Verification
  // =========================================================================
  describe('Inbound Webhooks: Signature Verification', () => {
    it('should_verify_valid_signature_with_raw_body', async () => {
      const now = 1700000000;
      const rawBody = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
      const signature = await hmacSha256Hex(webhookSecret, `${now}.${rawBody}`);
      const header = `t=${now},v1=${signature}`;

      const result = await verifyStripeSignature(rawBody, header, webhookSecret, {
        nowEpochSeconds: now,
      });

      expect(result.valid).toBe(true);
    });

    it('should_reject_if_raw_body_is_tampered', async () => {
      const now = 1700000000;
      const originalBody = JSON.stringify({ id: 'evt_1', amount: 1000 });
      const tamperedBody = JSON.stringify({ id: 'evt_1', amount: 10 }); // Alterado!
      const signature = await hmacSha256Hex(webhookSecret, `${now}.${originalBody}`);
      const header = `t=${now},v1=${signature}`;

      const result = await verifyStripeSignature(tamperedBody, header, webhookSecret, {
        nowEpochSeconds: now,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Signature mismatch');
    });

    it('should_reject_stale_webhook_timestamp_to_prevent_replay_attacks', async () => {
      const now = 1700000000;
      const staleTimestamp = now - 600; // 10 minutos atrás (tolerância padrão: 5 min)
      const rawBody = JSON.stringify({ id: 'evt_old' });
      const signature = await hmacSha256Hex(webhookSecret, `${staleTimestamp}.${rawBody}`);
      const header = `t=${staleTimestamp},v1=${signature}`;

      const result = await verifyStripeSignature(rawBody, header, webhookSecret, {
        nowEpochSeconds: now,
        toleranceSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Webhook timestamp outside tolerance window');
    });
  });

  // =========================================================================
  // 2. Inbound Webhooks: Serial & Concurrent Deduplication
  // =========================================================================
  describe('Inbound Webhooks: Deduplication & Async Queueing', () => {
    it('should_record_and_queue_first_time_and_ignore_on_serial_duplicate', async () => {
      const recordedEvents = new Set<string>();
      const queuedOutbox: any[] = [];

      const mockDb: WebhookDatabaseClient = {
        recordWebhookEvent: vi.fn(async ({ eventId }) => {
          if (recordedEvents.has(eventId)) {
            return { recorded: false, duplicate: true };
          }
          recordedEvents.add(eventId);
          return { recorded: true, duplicate: false };
        }),
        enqueueOutboxItem: vi.fn(async (item) => {
          queuedOutbox.push(item);
        }),
      };

      const event: WebhookEventPayload = {
        id: 'evt_test_100',
        type: 'invoice.payment_succeeded',
        data: { object: { id: 'in_100', amount_paid: 5000 } },
      };

      // 1ª Recepção do evento
      const res1 = await handleWebhookEvent(event, mockDb, 'tenant-alpha');
      expect(res1.statusCode).toBe(200);
      expect(res1.body.received).toBe(true);
      expect(res1.body.queued).toBe(true);
      expect(res1.body.duplicate).toBeUndefined();
      expect(queuedOutbox).toHaveLength(1);

      // 2ª Recepção do MESMO evento (reenvio do gateway)
      const res2 = await handleWebhookEvent(event, mockDb, 'tenant-alpha');
      expect(res2.statusCode).toBe(200);
      expect(res2.body.received).toBe(true);
      expect(res2.body.duplicate).toBe(true);

      // Efeito colateral ocorreu apenas 1 vez
      expect(queuedOutbox).toHaveLength(1);
      expect(mockDb.enqueueOutboxItem).toHaveBeenCalledTimes(1);
    });

    it('should_handle_concurrent_identical_webhooks_without_duplicate_processing', async () => {
      // Simulação atômica de banco com constraint UNIQUE
      const dbTable = new Map<string, any>();
      const queuedOutbox: any[] = [];

      const mockDb: WebhookDatabaseClient = {
        recordWebhookEvent: vi.fn(async ({ gateway, eventId, eventType, payload }) => {
          const key = `${gateway}:${eventId}`;
          // Concorrência atômica: se já existe, retorna duplicate
          if (dbTable.has(key)) {
            return { recorded: false, duplicate: true };
          }
          dbTable.set(key, { gateway, eventId, eventType, payload });
          return { recorded: true, duplicate: false };
        }),
        enqueueOutboxItem: vi.fn(async (item) => {
          queuedOutbox.push(item);
        }),
      };

      const event: WebhookEventPayload = {
        id: 'evt_concurrent_999',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_999', status: 'active' } },
      };

      // Disparo de duas requisições idênticas no mesmo milissegundo (Promise.all)
      const [result1, result2] = await Promise.all([
        handleWebhookEvent(event, mockDb, 'tenant-alpha'),
        handleWebhookEvent(event, mockDb, 'tenant-alpha'),
      ]);

      // Ambas respondem HTTP 200 rápido ao gateway
      expect(result1.statusCode).toBe(200);
      expect(result2.statusCode).toBe(200);

      // Exatamente uma venceu e enfileirou; a outra foi marcada como duplicate
      const responses = [result1.body, result2.body];
      const newCount = responses.filter((r) => r.queued === true).length;
      const dupCount = responses.filter((r) => r.duplicate === true).length;

      expect(newCount).toBe(1);
      expect(dupCount).toBe(1);

      // Fila recebeu o trabalho apenas uma vez
      expect(queuedOutbox).toHaveLength(1);
      expect(mockDb.enqueueOutboxItem).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. Outbound Calls to Gateway: Idempotency Key & Safe Retries
  // =========================================================================
  describe('Outbound Gateway Client: Idempotency Key & Safe Retries', () => {
    it('should_generate_uuid_v4_idempotency_key', () => {
      const key = generateIdempotencyKey();
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should_strictly_reject_personal_data_as_idempotency_key', () => {
      // E-mail
      expect(() => assertValidIdempotencyKey('cliente@gmail.com')).toThrow(
        /Violação de segurança: nunca utilize dados pessoais/,
      );

      // CPF / Telefone
      expect(() => assertValidIdempotencyKey('12345678909')).toThrow(
        /Violação de segurança: nunca utilize dados pessoais/,
      );

      // String qualquer não UUID v4
      expect(() => assertValidIdempotencyKey('minha-chave-customizada')).toThrow(
        /deve ser um UUID v4/,
      );
    });

    it('should_accept_valid_uuid_v4_when_digits_project_onto_cpf_range', () => {
      // Regressão: UUID v4 legítimo cuja projeção de dígitos tem 11 caracteres (faixa CPF/telefone).
      const key = 'abcdef12-3456-4abc-89ab-cdefabcdef12';

      expect(key.replace(/\D/g, '')).toHaveLength(11);
      expect(() => assertValidIdempotencyKey(key)).not.toThrow();
    });

    it('should_accept_every_generated_key_regardless_of_digit_distribution', () => {
      // Regressão do falso-positivo de ~1,8%: nenhuma chave gerada pode ser rejeitada.
      const rejected: string[] = [];

      for (let i = 0; i < 2000; i++) {
        const key = generateIdempotencyKey();
        try {
          assertValidIdempotencyKey(key);
        } catch {
          rejected.push(key);
        }
      }

      expect(rejected).toEqual([]);
    });

    it('should_preserve_exact_same_idempotency_key_across_network_retries', async () => {
      const capturedHeaders: Array<Record<string, string>> = [];
      let callCount = 0;

      const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        callCount++;
        capturedHeaders.push((init?.headers as Record<string, string>) || {});

        if (callCount < 3) {
          // Falhas temporárias de rede (503 Service Unavailable)
          return new Response('Gateway timeout', { status: 503 });
        }

        // Sucesso na 3ª tentativa
        return new Response(JSON.stringify({ id: 'ch_123', status: 'succeeded', amount: 5000 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new GatewayClient('https://api.gateway.test/v1', 'key_test', mockFetch as any);
      const businessIdempotencyKey = generateIdempotencyKey();

      const result = await client.createCharge(
        { amount: 5000, customerId: 'cust_abc' },
        { idempotencyKey: businessIdempotencyKey, maxRetries: 3, backoffMs: 1 },
      );

      expect(result.attempts).toBe(3);
      expect(result.data.status).toBe('succeeded');

      // Todas as 3 tentativas devem enviar a MESMA Idempotency-Key
      expect(capturedHeaders).toHaveLength(3);
      capturedHeaders.forEach((headers) => {
        expect(headers['Idempotency-Key']).toBe(businessIdempotencyKey);
      });
    });

    it('should_fetch_authoritative_state_from_gateway_to_avoid_out_of_order_events', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes('/subscriptions/sub_456')) {
          return new Response(
            JSON.stringify({ id: 'sub_456', status: 'canceled', current_period_end: 1800000000 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const client = new GatewayClient('https://api.gateway.test/v1', 'key_test', mockFetch as any);
      const { data } = await client.retrieveSubscription('sub_456');

      expect(data.id).toBe('sub_456');
      expect(data.status).toBe('canceled');
    });
  });

  // =========================================================================
  // 4. Inbound Application Endpoints: Idempotency-Key Header Protection
  // =========================================================================
  describe('Inbound Application Endpoints: Idempotency-Key Protection', () => {
    it('should_replay_exact_cached_response_when_client_resends_same_idempotency_key', async () => {
      const storage = new Map<string, any>();
      let backendActionExecutionCount = 0;

      const mockDb = {
        rpc: vi.fn(async (name: string, params: any) => {
          if (name === 'claim_api_idempotency_key') {
            const key = `${params.p_tenant_id}:${params.p_idempotency_key}`;
            const existing = storage.get(key);

            if (existing) {
              if (existing.request_hash !== params.p_request_hash) {
                return { data: { action: 'reject', error: 'hash mismatch' }, error: null };
              }
              if (existing.status === 'completed') {
                return {
                  data: {
                    action: 'replay',
                    status: 'completed',
                    response_status: existing.response_status,
                    response_body: existing.response_body,
                  },
                  error: null,
                };
              }
              return { data: { action: 'wait' }, error: null };
            }

            storage.set(key, {
              status: 'processing',
              request_hash: params.p_request_hash,
            });
            return { data: { action: 'execute', status: 'new' }, error: null };
          }

          if (name === 'complete_api_idempotency_key') {
            const key = `${params.p_tenant_id}:${params.p_idempotency_key}`;
            const existing = storage.get(key);
            if (existing) {
              existing.status = 'completed';
              existing.response_status = params.p_response_status;
              existing.response_body = params.p_response_body;
            }
            return { data: null, error: null };
          }

          return { data: null, error: null };
        }),
      };

      const idempotencyKey = generateIdempotencyKey();
      const payload = { comandaId: 'cmd_1', amount: 150 };

      // Execução 1
      const res1 = await withApiIdempotency(
        {
          tenantId: 'tenant-1',
          idempotencyKey,
          path: '/api/checkout/finish',
          payload,
          db: mockDb,
        },
        async () => {
          backendActionExecutionCount++;
          return { statusCode: 201, data: { orderId: 'ord_1', paid: true } };
        },
      );

      expect(res1.statusCode).toBe(201);
      expect(res1.data.orderId).toBe('ord_1');
      expect(res1.replayed).toBe(false);
      expect(backendActionExecutionCount).toBe(1);

      // Execução 2 (Cliente reenviando o mesmo pedido com o mesmo header Idempotency-Key)
      const res2 = await withApiIdempotency(
        {
          tenantId: 'tenant-1',
          idempotencyKey,
          path: '/api/checkout/finish',
          payload,
          db: mockDb,
        },
        async () => {
          backendActionExecutionCount++;
          return { statusCode: 201, data: { orderId: 'ord_WRONG_DUPLICATE', paid: true } };
        },
      );

      expect(res2.statusCode).toBe(201);
      expect(res2.data.orderId).toBe('ord_1'); // Devolveu resposta idêntica armazenada!
      expect(res2.replayed).toBe(true);

      // A lógica de negócio no servidor NÃO executou pela segunda vez
      expect(backendActionExecutionCount).toBe(1);
    });

    it('should_reject_if_idempotency_key_is_reused_with_different_payload', async () => {
      const mockDb = {
        rpc: vi.fn(async (name: string) => {
          if (name === 'claim_api_idempotency_key') {
            return {
              data: {
                action: 'reject',
                status: 'hash_mismatch',
                error: 'A chave de idempotência foi reutilizada com um payload diferente.',
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
      };

      const idempotencyKey = generateIdempotencyKey();

      await expect(
        withApiIdempotency(
          {
            tenantId: 'tenant-1',
            idempotencyKey,
            path: '/api/checkout/finish',
            payload: { comandaId: 'cmd_tampered', amount: 999 },
            db: mockDb,
          },
          async () => ({ statusCode: 200, data: {} }),
        ),
      ).rejects.toThrow(/chave de idempotência foi reutilizada com um payload diferente/);
    });
  });

  // =========================================================================
  // 5. Database Schema & Migration Contract Integrity
  // =========================================================================
  describe('Database Migration SQL Verification', () => {
    it('should_contain_unique_constraints_and_rls_in_migration_sql', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261103161000_webhook_and_api_idempotency.sql',
      );
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Tabela webhook_events e constraint única
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.webhook_events');
      expect(sql).toContain('CONSTRAINT uq_webhook_events_gateway_event UNIQUE (gateway, event_id)');
      expect(sql).toContain('ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY');

      // Tabela api_idempotency_keys e constraint única
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.api_idempotency_keys');
      expect(sql).toContain('CONSTRAINT uq_api_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key)');
      expect(sql).toContain('ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY');

      // Funções atômicas
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_webhook_event');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_api_idempotency_key');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.complete_api_idempotency_key');
      expect(sql).toContain('ON CONFLICT (gateway, event_id) DO NOTHING');
    });
  });
});
