/**
 * Structured Logger — Fase 3.5 Observabilidade
 *
 * Provides structured logging for business events, performance metrics,
 * and error tracking. All logs include tenant_id, user_id, request_id,
 * correlation_id, duration, and result.
 *
 * Usage:
 *   import { logger } from '@/src/lib/observability/logger';
 *
 *   logger.business('checkout_completed', {
 *     tenantId: 'tenant-1',
 *     userId: 'user-1',
 *     comandaId: 'comanda-1',
 *     amount: 120.0,
 *     paymentMethod: 'cash',
 *   });
 */

// ─── Types ──────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type EventCategory =
  | 'business'      // Domain events (checkout, appointment, etc.)
  | 'performance'   // Timing and latency
  | 'security'      // Auth, RLS, access
  | 'error'         // Application errors
  | 'audit';        // Compliance and audit trail

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: EventCategory;
  event: string;
  context: LogContext;
  data?: Record<string, unknown>;
  duration?: number;
  result?: 'success' | 'failure' | 'timeout';
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
}

// ─── In-Memory Log Store (for dev/demo) ────────────────────────

const MAX_LOGS = 1000;
const logs: LogEntry[] = [];
const metrics: PerformanceMetric[] = [];

// ─── Logger Class ───────────────────────────────────────────────

class StructuredLogger {
  private enabled: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.enabled = typeof window !== 'undefined';
    this.minLevel = 'debug';
  }

  /**
   * Log a business event (checkout, appointment, etc.)
   */
  business(event: string, data?: Record<string, unknown>, context?: LogContext): void {
    this.log('info', 'business', event, data, context);
  }

  /**
   * Log a performance metric
   */
  performance(name: string, value: number, unit: PerformanceMetric['unit'] = 'ms', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = { name, value, unit, tags };
    metrics.push(metric);

    // Keep only last 500 metrics
    if (metrics.length > 500) {
      metrics.splice(0, metrics.length - 500);
    }

    this.log('info', 'performance', name, { value, unit, tags });
  }

  /**
   * Log a security event
   */
  security(event: string, data?: Record<string, unknown>, context?: LogContext): void {
    this.log('warn', 'security', event, data, context);
  }

  /**
   * Log an error
   */
  error(event: string, error: Error, data?: Record<string, unknown>, context?: LogContext): void {
    this.log('error', 'error', event, {
      ...data,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }, context);
  }

  /**
   * Log an audit trail event
   */
  audit(event: string, data?: Record<string, unknown>, context?: LogContext): void {
    this.log('info', 'audit', event, data, context);
  }

  /**
   * Start a performance timer
   */
  startTimer(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.performance(name, duration, 'ms');
      return duration;
    };
  }

  /**
   * Get all stored logs (for debugging/dashboard)
   */
  getLogs(filter?: { level?: LogLevel; category?: EventCategory; event?: string }): LogEntry[] {
    let filtered = [...logs];

    if (filter?.level) {
      filtered = filtered.filter((l) => l.level === filter.level);
    }
    if (filter?.category) {
      filtered = filtered.filter((l) => l.category === filter.category);
    }
    if (filter?.event) {
      filtered = filtered.filter((l) => l.event.includes(filter.event!));
    }

    return filtered;
  }

  /**
   * Get all stored metrics (for debugging/dashboard)
   */
  getMetrics(filter?: { name?: string }): PerformanceMetric[] {
    let filtered = [...metrics];

    if (filter?.name) {
      filtered = filtered.filter((m) => m.name.includes(filter.name!));
    }

    return filtered;
  }

  /**
   * Get metric summary (avg, min, max, count)
   */
  getMetricSummary(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } {
    const values = metrics
      .filter((m) => m.name === name)
      .map((m) => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0 };
    }

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(count * 0.95);

    return {
      count,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
      p95: values[p95Index] || values[count - 1],
    };
  }

  /**
   * Clear all stored logs and metrics
   */
  clear(): void {
    logs.length = 0;
    metrics.length = 0;
  }

  // ─── Private ────────────────────────────────────────────────

  private log(
    level: LogLevel,
    category: EventCategory,
    event: string,
    data?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (!this.enabled || !this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      event,
      context: context || {},
      data,
    };

    // Extract result from data if present
    if (data && 'result' in data) {
      entry.result = data.result as LogEntry['result'];
    }
    if (data && 'duration' in data) {
      entry.duration = data.duration as number;
    }

    logs.push(entry);

    // Keep only last MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }

    // Console output in dev mode
    if (import.meta.env.DEV) {
      this.consoleOutput(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.category.toUpperCase()}]`;
    const contextStr = entry.context.tenantId ? ` tenant=${entry.context.tenantId}` : '';
    const durationStr = entry.duration !== undefined ? ` ${entry.duration.toFixed(1)}ms` : '';
    const resultStr = entry.result ? ` result=${entry.result}` : '';

    const message = `${prefix} ${entry.event}${contextStr}${durationStr}${resultStr}`;

    switch (entry.level) {
      case 'error':
        console.error(message, entry.data);
        break;
      case 'warn':
        console.warn(message, entry.data);
        break;
      case 'debug':
        console.debug(message, entry.data);
        break;
      default:
        console.log(message, entry.data);
    }
  }
}

// ─── Singleton Export ───────────────────────────────────────────

export const logger = new StructuredLogger();

// ─── Convenience Functions ──────────────────────────────────────

/**
 * Create a timed operation wrapper
 *
 * Usage:
 *   const end = timer('checkout_duration');
 *   await doCheckout();
 *   end(); // Logs duration
 */
export function timer(name: string): () => number {
  return logger.startTimer(name);
}

/**
 * Create a correlation ID for tracking related operations
 */
export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a request ID for tracking individual operations
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
