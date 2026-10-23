/**
 * Global Error Handlers — Fase 6.2 Observabilidade (P0)
 *
 * Captura erros não tratados do browser (`error` e `unhandledrejection`) e os
 * encaminha ao logger estruturado. Invariantes:
 *  - fail-open absoluto: nenhum caminho pode lançar para o browser;
 *  - guarda de reentrância evita loop quando o próprio logger falha;
 *  - instalação idempotente (StrictMode / múltiplas chamadas);
 *  - cleanup explícito para testes e HMR.
 */

import { logger } from './logger';

export type GlobalHandlerCleanup = () => void;

let installed = false;
let handling = false;

function normalizeError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(`Non-error throwable: ${JSON.stringify(value)}`);
  } catch {
    return new Error('Non-error throwable');
  }
}

function safeLog(event: string, value: unknown, data?: Record<string, unknown>): void {
  // Guarda de reentrância: se o próprio log lançar e disparar outro evento,
  // não recursa.
  if (handling) {
    return;
  }

  handling = true;
  try {
    logger.error(event, normalizeError(value), data);
  } catch {
    // fail-open: observabilidade nunca quebra o fluxo do usuário
  } finally {
    handling = false;
  }
}

/**
 * Instala listeners globais. Idempotente.
 * Em ambiente SSR (sem `window`), retorna no-op.
 */
export function installGlobalErrorHandlers(target?: Window): GlobalHandlerCleanup {
  if (installed) {
    return () => {};
  }

  const win: Window | undefined =
    target ?? (typeof window !== 'undefined' ? window : undefined);

  if (!win) {
    return () => {};
  }

  const onError = (event: ErrorEvent): void => {
    safeLog('window_error', event.error ?? event.message, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  };

  const onRejection = (event: PromiseRejectionEvent): void => {
    safeLog('unhandled_rejection', event.reason);
  };

  try {
    win.addEventListener('error', onError as EventListener);
    win.addEventListener('unhandledrejection', onRejection as EventListener);
    installed = true;
  } catch {
    return () => {};
  }

  return () => {
    try {
      win.removeEventListener('error', onError as EventListener);
      win.removeEventListener('unhandledrejection', onRejection as EventListener);
    } catch {
      // fail-open
    }
    installed = false;
  };
}

export function areGlobalErrorHandlersInstalled(): boolean {
  return installed;
}
