import { describe, expect, it, vi } from 'vitest';
import { HEALTH_HEALTHY_MAX_MS, HEALTH_TIMEOUT_MS, checkHealth } from './healthCheck';

const clock = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
};

describe('checkHealth', () => {
  it('should_return_healthy_when_probe_resolves_without_error', async () => {
    const result = await checkHealth({
      probe: async () => ({ error: null }),
      isDemo: false,
      now: clock([0, 40]),
      onFailure: vi.fn(),
    });

    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBe(40);
  });

  it('should_return_degraded_when_latency_exceeds_healthy_threshold', async () => {
    const result = await checkHealth({
      probe: async () => ({ error: null }),
      isDemo: false,
      now: clock([0, HEALTH_HEALTHY_MAX_MS + 1]),
      onFailure: vi.fn(),
    });

    expect(result.status).toBe('degraded');
    expect(result.latencyMs).toBe(HEALTH_HEALTHY_MAX_MS + 1);
  });

  it('should_return_down_when_probe_resolves_with_error_payload', async () => {
    const failure = new Error('permission denied');
    const onFailure = vi.fn();

    const result = await checkHealth({
      probe: async () => ({ error: failure }),
      isDemo: false,
      now: clock([0, 10, 12]),
      onFailure,
    });

    expect(result.status).toBe('down');
    expect(onFailure).toHaveBeenCalledWith(failure);
  });

  it('should_return_down_when_probe_rejects', async () => {
    const onFailure = vi.fn();

    const result = await checkHealth({
      probe: async () => {
        throw new Error('network offline');
      },
      isDemo: false,
      now: clock([0, 10, 12]),
      onFailure,
    });

    expect(result.status).toBe('down');
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('should_return_down_when_probe_throws_synchronously', async () => {
    const result = await checkHealth({
      probe: () => {
        throw new Error('boom');
      },
      isDemo: false,
      now: clock([0, 5]),
      onFailure: vi.fn(),
    });

    expect(result.status).toBe('down');
  });

  it('should_return_down_when_probe_exceeds_timeout', async () => {
    const onFailure = vi.fn();
    const startedAt = Date.now();

    const result = await checkHealth({
      probe: () => new Promise(() => {}),
      timeoutMs: 10,
      isDemo: false,
      onFailure,
    });

    expect(result.status).toBe('down');
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it('should_return_degraded_without_calling_probe_when_demo', async () => {
    const probe = vi.fn(async () => ({ error: null }));

    const result = await checkHealth({
      probe,
      isDemo: true,
      now: clock([0, 5]),
      onFailure: vi.fn(),
    });

    expect(result.status).toBe('degraded');
    expect(probe).not.toHaveBeenCalled();
  });

  it('should_expose_only_status_latency_and_timestamp_when_probe_fails', async () => {
    const result = await checkHealth({
      probe: async () => {
        throw new Error('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk');
      },
      isDemo: false,
      now: clock([0, 10, 12]),
      onFailure: vi.fn(),
    });

    expect(Object.keys(result).sort()).toEqual(['latencyMs', 'status', 'timestamp']);
    expect(JSON.stringify(result)).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(JSON.stringify(result)).not.toContain('Error');
  });

  it('should_not_throw_when_failure_logger_throws', async () => {
    const result = await checkHealth({
      probe: async () => {
        throw new Error('offline');
      },
      isDemo: false,
      now: clock([0, 10, 12]),
      onFailure: () => {
        throw new Error('logger down');
      },
    });

    expect(result.status).toBe('down');
  });

  it('should_return_iso_timestamp_and_rounded_latency', async () => {
    const result = await checkHealth({
      probe: async () => ({ error: null }),
      isDemo: false,
      now: clock([100, 112.7]),
      onFailure: vi.fn(),
    });

    expect(result.latencyMs).toBe(13);
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should_expose_timeout_and_threshold_constants', () => {
    expect(HEALTH_TIMEOUT_MS).toBe(3000);
    expect(HEALTH_HEALTHY_MAX_MS).toBe(1000);
  });
});
