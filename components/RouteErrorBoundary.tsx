import React from 'react';

interface RouteErrorBoundaryProps {
  resetKey: string;
  children: React.ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado ao carregar esta página.',
    };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[RouteErrorBoundary] Falha isolada na rota:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto my-12 rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-card-dark p-6 text-center space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Não foi possível exibir esta tela
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: null })}
            className="px-4 py-2 rounded-lg bg-primary text-night text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
