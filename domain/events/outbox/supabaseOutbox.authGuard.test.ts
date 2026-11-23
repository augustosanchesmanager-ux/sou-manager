/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][F-02] Auth guard tests
 *
 * Frente F-02 — loop de `401` no polling do outbox.
 *
 * Cenários:
 *   1. Classificação pura de falha de auth (401/PGRST301 vs 403/42501).
 *   2. Validade da sessão (expiração com folga, sessão sem `expires_at`).
 *   3. Guard bloqueia query sem sessão / com token expirado.
 *   4. Circuit breaker abre em 401/403 e para o polling.
 *   5. Backoff exponencial 30 s → 5 min e reset por sucesso ou token novo.
 *
 * Nenhum teste existente é alterado; o mock de chaos (sessão `{}`) continua
 * válido porque o guard é aditivo quanto a `expires_at`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SupabaseOutbox,
  createSupabaseOutbox,
  classifyOutboxAuthFailure,
  isOutboxSessionUsable,
  OUTBOX_AUTH_BREAKER_BASE_MS,
  OUTBOX_AUTH_BREAKER_MAX_MS,
  OUTBOX_SESSION_EXPIRY_SKEW_SECONDS,
} from './supabaseOutbox';

// ─── Mock client ──────────────────────────────────────────────

type QueryError = { code?: string; message?: string } | null;

interface GuardedClient {
  client: {
    from: (table: string) => unknown;
    auth: { getSession: () => Promise<unknown> };
  };
  fromCalls: string[];
  setQueryError: (error: QueryError) => void;
  setSession: (session: Record<string, unknown> | null) => void;
}

function createGuardedClient(options: {
  session: Record<string, unknown> | null;
  queryError?: QueryError;
}): GuardedClient {
  const fromCalls: string[] = [];
  let queryError: QueryError = options.queryError ?? null;

  // Builder chainable: o guard é avaliado antes de qualquer query, então os
  // testes só precisam de um terminal que devolva `error` controlável.
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    gt: () => builder,
    lt: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    single: async () => ({ data: null, error: queryError }),
    maybeSingle: async () => ({ data: null, error: queryError }),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: null, count: null, error: queryError }),
  });

  const client = {
    from: (table: string) => {
      fromCalls.push(table);
      return builder;
    },
    auth: {
      getSession: async () => ({
        data: { session: options.session },
        error: null,
      }),
    },
  };

  return {
    client,
    fromCalls,
    setQueryError: (error) => {
      queryError = error;
    },
    setSession: (session) => {
      options.session = session;
    },
  };
}

const attachClient = (outbox: SupabaseOutbox, client: GuardedClient['client']): void => {
  (outbox as unknown as { client: GuardedClient['client'] }).client = client;
};

const BASE_TIME_MS = Date.parse('2026-11-23T12:00:00.000Z');
const advance = (ms: number): void => {
  vi.setSystemTime(new Date(Date.now() + ms));
};

const sessionWithExpiry = (secondsFromNow: number): Record<string, unknown> => ({
  access_token: `token-${secondsFromNow}`,
  expires_at: Math.floor(Date.now() / 1000) + secondsFromNow,
});

// ─── Testes ───────────────────────────────────────────────────

describe('F-02 — SupabaseOutbox auth guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_TIME_MS));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('classifyOutboxAuthFailure', () => {
    it('should_classify_unauthenticated_when_status_is_401', () => {
      expect(classifyOutboxAuthFailure({ status: 401 })).toBe('unauthenticated');
    });

    it('should_classify_unauthenticated_when_code_is_PGRST301', () => {
      expect(classifyOutboxAuthFailure({ code: 'PGRST301' })).toBe('unauthenticated');
    });

    it('should_classify_forbidden_when_code_is_42501', () => {
      expect(classifyOutboxAuthFailure({ code: '42501' })).toBe('forbidden');
    });

    it('should_classify_forbidden_when_status_is_403', () => {
      expect(classifyOutboxAuthFailure({ status: 403 })).toBe('forbidden');
    });

    it('should_classify_none_when_error_is_not_auth_related', () => {
      expect(classifyOutboxAuthFailure({ code: '23505', message: 'duplicate key' })).toBe('none');
      expect(classifyOutboxAuthFailure(null)).toBe('none');
      expect(classifyOutboxAuthFailure(undefined)).toBe('none');
    });
  });

  describe('isOutboxSessionUsable', () => {
    it('should_reject_session_when_expires_at_is_inside_the_skew_window', () => {
      const expiresAt = Math.floor(BASE_TIME_MS / 1000) + OUTBOX_SESSION_EXPIRY_SKEW_SECONDS - 1;

      expect(isOutboxSessionUsable({ hasSession: true, expiresAt, nowMs: BASE_TIME_MS })).toBe(false);
    });

    it('should_reject_session_when_expires_at_is_in_the_past', () => {
      const expiresAt = Math.floor(BASE_TIME_MS / 1000) - 60;

      expect(isOutboxSessionUsable({ hasSession: true, expiresAt, nowMs: BASE_TIME_MS })).toBe(false);
    });

    it('should_accept_session_when_expires_at_is_beyond_the_skew_window', () => {
      const expiresAt = Math.floor(BASE_TIME_MS / 1000) + OUTBOX_SESSION_EXPIRY_SKEW_SECONDS + 1;

      expect(isOutboxSessionUsable({ hasSession: true, expiresAt, nowMs: BASE_TIME_MS })).toBe(true);
    });

    it('should_accept_session_when_expires_at_is_absent', () => {
      // Compatibilidade com sessões legadas e com o mock de chaos (`{}`).
      expect(isOutboxSessionUsable({ hasSession: true, nowMs: BASE_TIME_MS })).toBe(true);
      expect(
        isOutboxSessionUsable({ hasSession: true, expiresAt: null, nowMs: BASE_TIME_MS }),
      ).toBe(true);
    });

    it('should_reject_when_there_is_no_session', () => {
      expect(isOutboxSessionUsable({ hasSession: false, nowMs: BASE_TIME_MS })).toBe(false);
    });
  });

  describe('hasActiveSession guard', () => {
    it('should_skip_queries_when_there_is_no_session', async () => {
      // Arrange
      const mock = createGuardedClient({ session: null });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      const result = await outbox.count('pending');

      // Assert
      expect(result).toBe(0);
      expect(mock.fromCalls).toHaveLength(0);
    });

    it('should_skip_queries_when_token_is_expired', async () => {
      // Arrange
      const mock = createGuardedClient({ session: sessionWithExpiry(-60) });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      const result = await outbox.count('pending');

      // Assert
      expect(result).toBe(0);
      expect(mock.fromCalls).toHaveLength(0);
    });

    it('should_query_when_session_has_no_expires_at', async () => {
      // Arrange — mesmo shape do mock de chaos (`session: {}`).
      const mock = createGuardedClient({ session: {} });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(1);
    });

    it('should_query_when_token_is_valid', async () => {
      // Arrange
      const mock = createGuardedClient({ session: sessionWithExpiry(3600) });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(1);
    });
  });

  describe('circuit breaker', () => {
    it('should_open_circuit_when_query_returns_PGRST301', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301', message: 'No suitable key or wrong key type' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');
      await outbox.count('pending');

      // Assert — a segunda chamada não emite query.
      expect(mock.fromCalls).toHaveLength(1);
    });

    it('should_open_circuit_when_query_returns_42501', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: '42501', message: 'permission denied' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(1);
    });

    it('should_keep_polling_when_error_is_not_auth_related', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: '57014', message: 'statement timeout' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(2);
    });

    it('should_retry_when_backoff_window_elapses', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act
      await outbox.count('pending');
      await outbox.count('pending');
      advance(OUTBOX_AUTH_BREAKER_BASE_MS);
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(2);
    });

    it('should_double_backoff_when_failure_repeats', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act — 1ª falha abre 30 s; 2ª abre 60 s.
      await outbox.count('pending');
      advance(OUTBOX_AUTH_BREAKER_BASE_MS);
      await outbox.count('pending');
      advance(OUTBOX_AUTH_BREAKER_BASE_MS);
      await outbox.count('pending');
      advance(OUTBOX_AUTH_BREAKER_BASE_MS);
      await outbox.count('pending');

      // Assert — a 3ª tentativa só passa após 60 s completos.
      expect(mock.fromCalls).toHaveLength(3);
    });

    it('should_cap_backoff_at_max_window', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act — 30 s, 60 s, 120 s, 240 s, 300 s (teto).
      await outbox.count('pending');
      advance(30_000);
      await outbox.count('pending');
      advance(60_000);
      await outbox.count('pending');
      advance(120_000);
      await outbox.count('pending');
      advance(240_000);
      await outbox.count('pending');
      advance(OUTBOX_AUTH_BREAKER_MAX_MS - 1);
      await outbox.count('pending');
      advance(1);
      await outbox.count('pending');

      // Assert — a 6ª chamada só passou depois de 300 s completos.
      expect(mock.fromCalls).toHaveLength(6);
    });

    it('should_reset_backoff_when_query_succeeds_after_window', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act — falha, espera, sucesso (fecha), falha de novo (30 s, não 60 s).
      await outbox.count('pending');
      advance(30_000);
      mock.setQueryError(null);
      await outbox.count('pending');
      mock.setQueryError({ code: 'PGRST301' });
      await outbox.count('pending');
      advance(30_000);
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(4);
    });

    it('should_reset_circuit_when_session_token_changes', async () => {
      // Arrange
      const mock = createGuardedClient({
        session: sessionWithExpiry(3600),
        queryError: { code: 'PGRST301' },
      });
      const outbox = createSupabaseOutbox();
      attachClient(outbox, mock.client);

      // Act — circuito aberto com token A.
      await outbox.count('pending');
      await outbox.count('pending');
      // Novo login/refresh entrega token B: o circuito deve rearmar na hora.
      mock.setSession({ access_token: 'token-B', expires_at: Math.floor(Date.now() / 1000) + 3600 });
      mock.setQueryError(null);
      await outbox.count('pending');

      // Assert
      expect(mock.fromCalls).toHaveLength(2);
    });
  });
});
