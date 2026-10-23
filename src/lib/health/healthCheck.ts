import { getSharedClient, hasSupabaseEnv } from '../supabase/client';
import { logSupabaseError } from '../supabase/errors';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface HealthProbeResult {
  status: HealthStatus;
  latencyMs: number;
  timestamp: string;
}

export type HealthProbeQuery = () => PromiseLike<{ error?: unknown } | null | undefined>;

export interface HealthCheckOptions {
  probe?: HealthProbeQuery;
  timeoutMs?: number;
  isDemo?: boolean;
  now?: () => number;
  onFailure?: (error: unknown) => void;
}

export const HEALTH_TIMEOUT_MS = 3000;
export const HEALTH_HEALTHY_MAX_MS = 1000;

const defaultProbe: HealthProbeQuery = () =>
  getSharedClient().from('tenants').select('id', { head: true });

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const classifyLatency = (latencyMs: number): HealthStatus =>
  latencyMs <= HEALTH_HEALTHY_MAX_MS ? 'healthy' : 'degraded';

const runWithTimeout = async <T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('health probe timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
};

const notifyFailure = (error: unknown, onFailure: (error: unknown) => void): void => {
  try {
    onFailure(error);
  } catch {
    // Falha ao logar nunca pode derrubar a sonda.
  }
};

const executeCheck = async (options: HealthCheckOptions): Promise<HealthProbeResult> => {
  const probe = options.probe ?? defaultProbe;
  const timeoutMs = options.timeoutMs ?? HEALTH_TIMEOUT_MS;
  const isDemo = options.isDemo ?? !hasSupabaseEnv;
  const now = options.now ?? nowMs;
  const onFailure = options.onFailure ?? ((error: unknown) => logSupabaseError('health_probe', error));

  const startedAt = now();
  const buildResult = (status: HealthStatus, elapsedMs: number): HealthProbeResult => ({
    status,
    latencyMs: Math.max(0, Math.round(elapsedMs)),
    timestamp: new Date().toISOString(),
  });

  if (isDemo) {
    return buildResult('degraded', now() - startedAt);
  }

  try {
    const response = await runWithTimeout(probe(), timeoutMs);
    const elapsedMs = now() - startedAt;

    if (response && typeof response === 'object' && 'error' in response && response.error) {
      throw response.error;
    }

    return buildResult(classifyLatency(elapsedMs), elapsedMs);
  } catch (error) {
    notifyFailure(error, onFailure);
    return buildResult('down', now() - startedAt);
  }
};

/**
 * Sonda fail-open: nunca lança e devolve apenas status, latência e timestamp.
 * Em modo demo (sem backend configurado) a conectividade não é verificável, então o resultado é `degraded`.
 */
export const checkHealth = async (options: HealthCheckOptions = {}): Promise<HealthProbeResult> => {
  try {
    return await executeCheck(options);
  } catch {
    return { status: 'down', latencyMs: 0, timestamp: new Date().toISOString() };
  }
};
