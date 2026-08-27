/**
 * Alert System — Fase 3.5 Observabilidade
 *
 * Monitors metrics and triggers alerts when thresholds are exceeded.
 * Supports multiple notification channels (console, callback, webhook).
 *
 * Usage:
 *   import { alerts } from '@/src/lib/observability/alerts';
 *
 *   alerts.define({
 *     name: 'high_error_rate',
 *     metric: 'error_rate',
 *     threshold: 5,
 *     operator: '>',
 *     window: 5 * 60 * 1000,
 *     severity: 'critical',
 *     message: 'Error rate exceeded 5% in last 5 minutes',
 *   });
 *
 *   alerts.check();
 */

import { metrics } from './metrics';
import { logger } from './logger';

// ─── Types ──────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: AlertOperator;
  window: number;
  severity: AlertSeverity;
  message: string;
  cooldown?: number;
  tags?: Record<string, string>;
}

export interface Alert {
  rule: AlertRule;
  triggeredAt: number;
  currentValue: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface AlertNotification {
  alert: Alert;
  message: string;
  severity: AlertSeverity;
  timestamp: number;
}

export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  transform?: (notification: AlertNotification) => Record<string, unknown>;
}

type NotificationChannel = (notification: AlertNotification) => void;

// ─── Alert Manager Class ────────────────────────────────────────

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private channels: NotificationChannel[] = [];
  private lastTriggered: Map<string, number> = new Map();

  define(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
  }

  onNotify(channel: NotificationChannel): void {
    this.channels.push(channel);
  }

  addWebhook(config: WebhookConfig): void {
    this.onNotify(async (notification) => {
      try {
        const body = config.transform
          ? config.transform(notification)
          : {
              text: notification.message,
              severity: notification.severity,
              alert: notification.alert.rule.name,
              value: notification.alert.currentValue,
              threshold: notification.alert.rule.threshold,
              timestamp: new Date(notification.timestamp).toISOString(),
            };

        await fetch(config.url, {
          method: config.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        console.error('[AlertManager] Webhook failed:', error);
      }
    });
  }

  check(): Alert[] {
    const triggered: Alert[] = [];

    for (const [, rule] of this.rules) {
      const result = this.evaluateRule(rule);
      if (result) {
        triggered.push(result);
      }
    }

    return triggered;
  }

  getActive(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => !a.resolved);
  }

  getHistory(limit: number = 50): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  resolve(alertName: string): void {
    const alert = this.activeAlerts.get(alertName);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(alertName);

      this.notify({
        alert,
        message: `Alert RESOLVED: ${alert.rule.message}`,
        severity: 'info',
        timestamp: Date.now(),
      });
    }
  }

  clear(): void {
    this.rules.clear();
    this.activeAlerts.clear();
    this.alertHistory.length = 0;
    this.lastTriggered.clear();
  }

  // ─── Private ────────────────────────────────────────────────

  private evaluateRule(rule: AlertRule): Alert | null {
    // ADR-015: Support counters, gauges, and histograms.
    // Check counter first, then gauge, then histogram summary.
    let currentValue = metrics.getCounter(rule.metric);
    if (currentValue === 0) {
      currentValue = metrics.getGauge(rule.metric);
    }
    if (currentValue === 0) {
      const summary = metrics.getSummary(rule.metric);
      currentValue = summary.count > 0 ? summary.avg : 0;
    }

    if (!this.compare(currentValue, rule.operator, rule.threshold)) {
      return null;
    }

    const lastTrigger = this.lastTriggered.get(rule.name) || 0;
    const cooldown = rule.cooldown || 60_000;
    if (Date.now() - lastTrigger < cooldown) {
      return null;
    }

    if (this.activeAlerts.has(rule.name)) {
      return null;
    }

    const alert: Alert = {
      rule,
      triggeredAt: Date.now(),
      currentValue,
      resolved: false,
    };

    this.activeAlerts.set(rule.name, alert);
    this.alertHistory.push(alert);
    this.lastTriggered.set(rule.name, Date.now());

    this.notify({
      alert,
      message: `Alert ${rule.severity.toUpperCase()}: ${rule.message} (current: ${currentValue.toFixed(2)})`,
      severity: rule.severity,
      timestamp: Date.now(),
    });

    return alert;
  }

  private compare(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  private notify(notification: AlertNotification): void {
    logger.security('alert_triggered', {
      alertName: notification.alert.rule.name,
      severity: notification.severity,
      message: notification.message,
      currentValue: notification.alert.currentValue,
      threshold: notification.alert.rule.threshold,
    });

    for (const channel of this.channels) {
      try {
        channel(notification);
      } catch (error) {
        console.error('Alert notification failed:', error);
      }
    }
  }
}

// ─── Singleton Export ───────────────────────────────────────────

export const alerts = new AlertManager();

// ─── Default Alert Rules ────────────────────────────────────────

export const DEFAULT_ALERTS: AlertRule[] = [
  // ── Global ──
  {
    name: 'high_error_rate',
    metric: 'error_count',
    threshold: 5,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'More than 5 errors in the last 5 minutes',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'high_rpc_latency',
    metric: 'rpc_duration',
    threshold: 3000,
    operator: '>',
    window: 10 * 60 * 1000,
    severity: 'warning',
    message: 'RPC latency exceeded 3 seconds',
    cooldown: 10 * 60 * 1000,
  },
  {
    name: 'high_rollback_rate',
    metric: 'rollback_count',
    threshold: 10,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'critical',
    message: 'Rollback rate exceeded 10 in last 15 minutes',
    cooldown: 15 * 60 * 1000,
  },

  // ── Checkout ──
  {
    name: 'checkout_failure_rate',
    metric: 'Checkout.finish_error',
    threshold: 3,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'Checkout failure rate exceeded 3 in 5 minutes',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'checkout_timeout',
    metric: 'checkout_duration_ms',
    threshold: 10000,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'warning',
    message: 'Checkout taking more than 10 seconds',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'checkout_sync_items_rollback',
    metric: 'Checkout.syncItems_error',
    threshold: 1,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'critical',
    message: 'Checkout items sync rollback detected',
    cooldown: 15 * 60 * 1000,
  },

  // ── Cash Closing ──
  {
    name: 'cash_close_failure',
    metric: 'CashClosing.close_error',
    threshold: 2,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'critical',
    message: 'Cash closing failures detected',
    cooldown: 15 * 60 * 1000,
  },
  {
    name: 'cash_close_duration_high',
    metric: 'cash_closing_close_duration_ms',
    threshold: 15000,
    operator: '>',
    window: 10 * 60 * 1000,
    severity: 'warning',
    message: 'Cash close taking more than 15 seconds',
    cooldown: 10 * 60 * 1000,
  },

  // ── Appointment ──
  {
    name: 'appointment_creation_failure',
    metric: 'Appointment.create_error',
    threshold: 3,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'Appointment creation failures detected',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'appointment_create_duration_high',
    metric: 'appointment_create_duration_ms',
    threshold: 8000,
    operator: '>',
    window: 10 * 60 * 1000,
    severity: 'warning',
    message: 'Appointment creation taking more than 8 seconds',
    cooldown: 10 * 60 * 1000,
  },

  // ── Commission ──
  {
    name: 'commission_load_failure',
    metric: 'Commission.loadLines_error',
    threshold: 2,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'warning',
    message: 'Commission loading failures detected',
    cooldown: 15 * 60 * 1000,
  },

  // ── Club dos Chefes ──
  {
    name: 'club_credit_deduction_failure',
    metric: 'ChefClub.deductCredits_error',
    threshold: 2,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'critical',
    message: 'Club dos Chefes credit deduction failures detected',
    cooldown: 15 * 60 * 1000,
  },
  {
    name: 'club_subscription_resolution_failure',
    metric: 'ChefClub.resolveSubscription_error',
    threshold: 3,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'warning',
    message: 'Club dos Chefes subscription resolution failures detected',
    cooldown: 15 * 60 * 1000,
  },

  // ── ADR-015: Pipeline Observability ──
  {
    name: 'outbox_pending_depth_high',
    metric: 'outbox_pending_depth',
    threshold: 50,
    operator: '>',
    window: 10 * 60 * 1000,
    severity: 'warning',
    message: 'Outbox pending depth exceeded 50 items',
    cooldown: 10 * 60 * 1000,
  },
  {
    name: 'outbox_dead_letter_growing',
    metric: 'outbox_dead_letter_count',
    threshold: 0,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'Dead letter items detected in outbox',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'outbox_stale_recovery_frequent',
    metric: 'outbox_stale_recovery_count',
    threshold: 3,
    operator: '>',
    window: 15 * 60 * 1000,
    severity: 'warning',
    message: 'Frequent stale recovery (>3 items in 15 min)',
    cooldown: 15 * 60 * 1000,
  },
  {
    name: 'dispatch_cycle_failure_rate',
    metric: 'dispatch_cycle_error',
    threshold: 1,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'Dispatch cycle failures detected',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'finance_provider_error_rate',
    metric: 'dispatch_item_error',
    threshold: 3,
    operator: '>',
    window: 5 * 60 * 1000,
    severity: 'warning',
    message: 'Dispatch item delivery failures detected',
    cooldown: 5 * 60 * 1000,
  },
  {
    name: 'finance_provider_handler_missing',
    metric: 'dispatch_item_error',
    threshold: 1,
    operator: '>=',
    window: 5 * 60 * 1000,
    severity: 'critical',
    message: 'Dispatch item error — provider not found or handler missing',
    cooldown: 5 * 60 * 1000,
  },
];

/**
 * Initialize alerts with default rules
 */
export function initializeAlerts(): void {
  for (const rule of DEFAULT_ALERTS) {
    alerts.define(rule);
  }

  // Console notification channel for development
  alerts.onNotify((notification) => {
    if (import.meta.env.DEV) {
      const icon = notification.severity === 'critical' ? '🔴' :
                   notification.severity === 'warning' ? '🟡' : '🟢';
      console.log(`${icon} [ALERT] ${notification.message}`);
    }
  });
}
