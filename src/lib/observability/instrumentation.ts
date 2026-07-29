/**
 * Observable Service Wrapper — Fase 3.5 Observabilidade
 *
 * Declarative instrumentation for Application Services.
 * Services stay clean; observability is configured externally.
 *
 * Usage:
 *   import { withObservability, instrumentService } from '@/src/lib/observability/instrumentation';
 *
 *   // Individual method wrapping
 *   const wrapped = withObservability(
 *     originalFinish,
 *     { operation: 'Checkout.finish', metric: 'checkout_duration' }
 *   );
 *
 *   // Service-level instrumentation (wraps all methods at once)
 *   instrumentService(checkoutApplicationService, {
 *     finish: { operation: 'Checkout.finish', businessEvent: 'CHECKOUT_COMPLETED' },
 *   });
 */

import { logger } from './logger';
import { metrics } from './metrics';
import { createCorrelationId, createRequestId } from './logger';
import { BUSINESS_EVENTS, type BusinessEventName } from './events';

// ─── Types ──────────────────────────────────────────────────────

export interface ObservabilityConfig {
  /** Operation name for logs (e.g., 'Checkout.finish') */
  operation: string;

  /** Business event to emit on success (e.g., 'CHECKOUT_COMPLETED') */
  businessEvent?: BusinessEventName;

  /** Metric name for duration histogram (e.g., 'checkout_duration') */
  metric?: string;

  /** Static tags applied to all metric recordings */
  tags?: Record<string, string>;

  /** If true, logs function arguments (sanitized) */
  logArgs?: boolean;

  /** If true, logs result object */
  logResult?: boolean;

  /** Argument keys to redact from logs */
  excludeArgs?: string[];
}

export type ServiceInstrumentationMap<T> = {
  [K in keyof T]?: T[K] extends (...args: unknown[]) => unknown
    ? ObservabilityConfig
    : never;
};

// ─── Core Wrapper ───────────────────────────────────────────────

/**
 * Wrap an async function with declarative observability.
 * The function's own logic is untouched.
 */
export function withObservability<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: ObservabilityConfig,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const requestId = createRequestId();
    const correlationId = createCorrelationId();
    const startTime = performance.now();
    const tags = config.tags || {};

    const context = { requestId, correlationId };

    logger.business(`${config.operation}_started`, {
      ...(config.logArgs ? { args: sanitizeArgs(args, config.excludeArgs) } : {}),
    }, context);

    metrics.increment('operation_count', 1, { operation: config.operation });

    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;

      logger.business(`${config.operation}_completed`, {
        duration,
        result: 'success',
        ...(config.logResult && result !== undefined ? { data: result } : {}),
      }, context);

      if (config.metric) {
        metrics.histogram(config.metric, duration, tags);
      }
      metrics.increment(`${config.operation}_success`, 1, { operation: config.operation });

      if (config.businessEvent) {
        const eventDef = BUSINESS_EVENTS[config.businessEvent];
        if (eventDef) {
          logger.business(eventDef.name, {
            operation: config.operation,
            duration,
          }, context);
        }
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(`${config.operation}_failed`, errorObj, {
        duration,
        result: 'failure',
      }, context);

      if (config.metric) {
        metrics.histogram(config.metric, duration, tags);
      }
      metrics.increment(`${config.operation}_error`, 1, { operation: config.operation });
      metrics.increment('error_count', 1, { operation: config.operation });

      throw error;
    }
  };
}

/**
 * Wrap a synchronous function with declarative observability.
 */
export function withObservabilitySync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  config: ObservabilityConfig,
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    const startTime = performance.now();
    const requestId = createRequestId();
    const tags = config.tags || {};

    try {
      const result = fn(...args);
      const duration = performance.now() - startTime;

      logger.business(`${config.operation}_completed`, {
        duration,
        result: 'success',
      }, { requestId });

      if (config.metric) {
        metrics.histogram(config.metric, duration, tags);
      }
      metrics.increment(`${config.operation}_success`, 1, { operation: config.operation });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      logger.error(`${config.operation}_failed`, errorObj, {
        duration,
        result: 'failure',
      }, { requestId });

      if (config.metric) {
        metrics.histogram(config.metric, duration, tags);
      }
      metrics.increment(`${config.operation}_error`, 1, { operation: config.operation });
      metrics.increment('error_count', 1, { operation: config.operation });

      throw error;
    }
  };
}

// ─── Service Instrumentation ────────────────────────────────────

/**
 * Instrument all methods of a service class instance declaratively.
 * Mutates the instance in place (wraps methods).
 *
 * Usage:
 *   instrumentService(checkoutApplicationService, {
 *     finish: { operation: 'Checkout.finish', businessEvent: 'CHECKOUT_COMPLETED' },
 *     validateFinishRequest: { operation: 'Checkout.validate' },
 *   });
 */
export function instrumentService<T extends Record<string, unknown>>(
  service: T,
  map: ServiceInstrumentationMap<T>,
): void {
  for (const [method, config] of Object.entries(map)) {
    if (!config) continue;

    const original = (service as Record<string, unknown>)[method];
    if (typeof original !== 'function') continue;

    const wrapped = withObservability(
      original as (...args: unknown[]) => Promise<unknown>,
      config as ObservabilityConfig,
    );

    (service as Record<string, unknown>)[method] = wrapped;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function sanitizeArgs(args: unknown[], exclude?: string[]): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  args.forEach((arg, index) => {
    if (arg && typeof arg === 'object') {
      const obj = arg as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        sanitized[`arg${index}_${key}`] = exclude?.includes(key) ? '[REDACTED]' : value;
      }
    } else {
      sanitized[`arg${index}`] = arg;
    }
  });

  return sanitized;
}

export function createTimer(name: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    metrics.histogram(name, duration, 'ms');
    logger.performance(name, duration, 'ms');
  };
}
