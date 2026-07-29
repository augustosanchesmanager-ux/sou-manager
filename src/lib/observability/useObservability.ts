/**
 * Observability Hook — Fase 3.5
 *
 * Initializes observability system when the app starts.
 * Should be called once in the root component.
 *
 * Usage:
 *   import { useObservability } from '@/src/lib/observability/useObservability';
 *
 *   // In App.tsx or root component
 *   useObservability();
 */

import { useEffect } from 'react';
import { initializeAlerts } from './alerts';
import { initializeInstrumentation } from './config';
import { logger } from './logger';
import { metrics } from './metrics';

/**
 * Initialize observability system
 */
export function useObservability(): void {
  useEffect(() => {
    // Instrument all Application Services (declarative, idempotent)
    initializeInstrumentation();

    // Initialize alerts with default rules
    initializeAlerts();

    // Log app startup
    logger.business('app_started', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Track memory usage periodically
    const memoryInterval = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as { memory: { usedJSHeapSize: number } }).memory;
        metrics.gauge('memory_usage', memory.usedJSHeapSize / 1024 / 1024, { unit: 'MB' });
      }
    }, 30_000); // Every 30 seconds

    // Track active users (simple heuristic)
    metrics.gauge('active_users', 1);

    // Cleanup
    return () => {
      clearInterval(memoryInterval);
      logger.business('app_shutdown', {
        timestamp: new Date().toISOString(),
      });
    };
  }, []);
}

/**
 * Hook for tracking page views
 */
export function usePageView(pageName: string): void {
  useEffect(() => {
    logger.business('page_viewed', { page: pageName });
    metrics.increment('page_view_count', 1, { page: pageName });
  }, [pageName]);
}
