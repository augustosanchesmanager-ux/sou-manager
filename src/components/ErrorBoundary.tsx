/**
 * ErrorBoundary — Fase 6.2 Observabilidade (P0)
 *
 * Barreira de erro de renderização. Requisitos:
 *  - fallback visual limpo, sem stack trace em produção;
 *  - botão de recuperação que recarrega a aplicação com segurança;
 *  - log estruturado via logger (redigido), sem PII;
 *  - fail-open: falha do logger nunca quebra o render do fallback.
 *
 * Nota: componente de classe é obrigatório — `componentDidCatch` não existe
 * em componentes de função.
 */

import React from 'react';
import { logger } from '../lib/observability/logger';
import { redact } from '../lib/observability/redact';

export interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function safeRedact(value: string): string {
  try {
    return String(redact(value));
  } catch {
    return '[REDACTED]';
  }
}

const STYLES = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  },
  card: {
    maxWidth: '520px',
    width: '100%',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '28px',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '20px',
    lineHeight: '28px',
  },
  text: {
    margin: '0 0 20px',
    fontSize: '14px',
    lineHeight: '22px',
    color: '#94a3b8',
  },
  button: {
    appearance: 'none',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: '#3b82f6',
    color: '#ffffff',
  },
  details: {
    margin: '0 0 20px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  pre: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '12px',
    maxHeight: '220px',
    overflow: 'auto',
  },
} as const;

export class ErrorBoundary extends React.Component {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    try {
      logger.error('react_error_boundary', error, {
        componentStack: safeRedact(info?.componentStack ?? ''),
      });
    } catch {
      // fail-open: observabilidade nunca pode quebrar o fallback
    }
  }

  private handleReset = (): void => {
    try {
      if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.reload === 'function'
      ) {
        window.location.reload();
        return;
      }
    } catch {
      // fail-open: cai no reset de estado
    }

    (this as unknown as { setState: (state: ErrorBoundaryState) => void }).setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children ?? null;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const showDetails = Boolean(import.meta.env.DEV);
    const message = safeRedact(this.state.error?.message ?? 'Erro inesperado');
    const stack = this.state.error?.stack ? safeRedact(this.state.error.stack) : '';

    return (
      <div role="alert" style={STYLES.wrapper}>
        <div style={STYLES.card}>
          <h1 style={STYLES.title}>Algo deu errado</h1>
          <p style={STYLES.text}>
            Não foi possível exibir esta tela. Você pode recarregar a página com
            segurança; nenhum dado foi perdido.
          </p>

          {showDetails ? (
            <details style={STYLES.details}>
              <summary>Detalhes técnicos (apenas em desenvolvimento)</summary>
              <pre style={STYLES.pre}>
                {message}
                {stack ? `\n\n${stack}` : ''}
              </pre>
            </details>
          ) : null}

          <button type="button" onClick={this.handleReset} style={STYLES.button}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
