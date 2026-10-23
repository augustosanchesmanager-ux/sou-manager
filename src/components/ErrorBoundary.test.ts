import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));

vi.mock('../lib/observability/logger', () => ({
  logger: {
    business: vi.fn(),
    performance: vi.fn(),
    security: vi.fn(),
    error: loggerError,
    audit: vi.fn(),
  },
}));

import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    loggerError.mockReset();
  });

  it('should_set_error_state_when_get_derived_state_from_error_receives_error', () => {
    const error = new Error('falhou');

    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it('should_normalize_throwable_when_value_is_not_an_error', () => {
    const state = ErrorBoundary.getDerivedStateFromError('string qualquer');

    expect(state.hasError).toBe(true);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('string qualquer');
  });

  it('should_log_structured_error_when_component_did_catch_runs', () => {
    const boundary = new ErrorBoundary({});
    const error = new Error('quebrou');

    boundary.componentDidCatch(error, { componentStack: 'at Page (Page.tsx:10)' });

    expect(loggerError).toHaveBeenCalledTimes(1);
    const [event, loggedError, data] = loggerError.mock.calls[0];
    expect(event).toBe('react_error_boundary');
    expect(loggedError).toBe(error);
    expect(data.componentStack).toContain('Page.tsx:10');
  });

  it('should_not_throw_when_logger_fails', () => {
    loggerError.mockImplementation(() => {
      throw new Error('logger indisponível');
    });
    const boundary = new ErrorBoundary({});

    expect(() => boundary.componentDidCatch(new Error('x'), { componentStack: '' })).not.toThrow();
  });

  it('should_render_children_when_there_is_no_error', () => {
    const boundary = new ErrorBoundary({ children: 'conteúdo' });

    expect(boundary.render()).toBe('conteúdo');
  });

  it('should_render_accessible_fallback_when_has_error', () => {
    const boundary = new ErrorBoundary({});
    boundary.state = { hasError: true, error: new Error('falhou') };

    const tree = boundary.render() as { props: { role?: string } };

    expect(tree.props.role).toBe('alert');
  });

  it('should_redact_pii_when_rendering_fallback_message', () => {
    const boundary = new ErrorBoundary({});
    boundary.state = { hasError: true, error: new Error('erro para cliente@exemplo.com') };

    const serialized = JSON.stringify(boundary.render());

    expect(serialized).not.toContain('cliente@exemplo.com');
    expect(serialized).toContain('[REDACTED]');
  });

  it('should_reset_state_when_reload_is_unavailable', () => {
    const boundary = new ErrorBoundary({});
    const setState = vi.fn();
    (boundary as unknown as { setState: typeof setState }).setState = setState;

    (boundary as unknown as { handleReset: () => void }).handleReset();

    expect(setState).toHaveBeenCalledWith({ hasError: false, error: null });
  });
});
