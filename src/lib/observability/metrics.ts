/**
 * Metrics Collector — Fase 3.5 Observabilidade
 *
 * Collects and aggregates business, performance, quality,
 * and infrastructure metrics.
 *
 * Usage:
 *   import { metrics } from '@/src/lib/observability/metrics';
 *
 *   metrics.increment('checkout_count', { tenant: 'tenant-1' });
 *   metrics.histogram('checkout_duration', 1250, { tenant: 'tenant-1' });
 *   metrics.gauge('active_users', 42);
 */

import { logger } from './logger';

// ─── Types ──────────────────────────────────────────────────────

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricSummary {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface DashboardMetrics {
  business: {
    checkoutsToday: number;
    averageTicket: number;
    servicesPerformed: number;
    creditsUsed: number;
    dailyCommission: number;
  };
  performance: {
    averageCheckoutTime: number;
    averageRpcTime: number;
    averageScheduleOpenTime: number;
  };
  quality: {
    errorRate: number;
    rollbackRate: number;
    timeoutCount: number;
  };
  infrastructure: {
    supabaseLatency: number;
    activeUsers: number;
    memoryUsage: number;
  };
}

// ─── In-Memory Store ────────────────────────────────────────────

const MAX_POINTS = 10000;
const points: MetricPoint[] = [];
const counters: Map<string, number> = new Map();
const gauges: Map<string, number> = new Map();

// ─── Metrics Collector Class ────────────────────────────────────

class MetricsCollector {
  /**
   * Increment a counter (monotonically increasing)
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const current = counters.get(key) || 0;
    counters.set(key, current + value);

    this.recordPoint(name, current + value, tags);
  }

  /**
   * Set a gauge value (can go up or down)
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    gauges.set(this.buildKey(name, tags), value);
    this.recordPoint(name, value, tags);
  }

  /**
   * Record a histogram value (for distribution analysis)
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordPoint(name, value, tags);
    logger.performance(name, value, 'ms', tags);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    return counters.get(this.buildKey(name, tags)) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number {
    return gauges.get(this.buildKey(name, tags)) || 0;
  }

  /**
   * Get histogram summary for a metric
   */
  getSummary(name: string): MetricSummary {
    const values = points
      .filter((p) => p.name === name)
      .map((p) => p.value)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Get all dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    return {
      business: {
        checkoutsToday: this.getCounter('checkout_completed'),
        averageTicket: this.getSummary('checkout_amount').avg,
        servicesPerformed: this.getCounter('appointment_completed'),
        creditsUsed: this.getCounter('club_credit_used'),
        dailyCommission: this.getSummary('commission_amount').sum,
      },
      performance: {
        averageCheckoutTime: this.getSummary('checkout_duration').avg,
        averageRpcTime: this.getSummary('rpc_duration').avg,
        averageScheduleOpenTime: this.getSummary('schedule_open_duration').avg,
      },
      quality: {
        errorRate: this.calculateErrorRate(),
        rollbackRate: this.calculateRollbackRate(),
        timeoutCount: this.getCounter('timeout_count'),
      },
      infrastructure: {
        supabaseLatency: this.getSummary('supabase_latency').avg,
        activeUsers: this.getGauge('active_users'),
        memoryUsage: this.getGauge('memory_usage'),
      },
    };
  }

  /**
   * Reset all metrics
   */
  clear(): void {
    points.length = 0;
    counters.clear();
    gauges.clear();
  }

  // ─── Private ────────────────────────────────────────────────

  private recordPoint(name: string, value: number, tags?: Record<string, string>): void {
    points.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Trim old points
    if (points.length > MAX_POINTS) {
      points.splice(0, points.length - MAX_POINTS);
    }
  }

  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagStr = Object.entries(tags)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateErrorRate(): number {
    const errors = this.getCounter('error_count');
    const total = this.getCounter('operation_count');
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private calculateRollbackRate(): number {
    const rollbacks = this.getCounter('rollback_count');
    const total = this.getCounter('operation_count');
    return total > 0 ? (rollbacks / total) * 100 : 0;
  }
}

// ─── Singleton Export ───────────────────────────────────────────

export const metrics = new MetricsCollector();
