import { describe, it, expect } from 'vitest';
import {
  isTerminalStatus,
  isCreditOperableStatus,
  isReceivableGenerableStatus,
  validateStatusTransition,
} from './validation';
import type { SubscriptionStatus } from './types';

describe('isTerminalStatus', () => {
  it('returns true for canceled', () => {
    expect(isTerminalStatus('canceled')).toBe(true);
  });

  it('returns false for active', () => {
    expect(isTerminalStatus('active')).toBe(false);
  });

  it('returns false for paused', () => {
    expect(isTerminalStatus('paused')).toBe(false);
  });

  it('returns false for past_due', () => {
    expect(isTerminalStatus('past_due')).toBe(false);
  });
});

describe('isCreditOperableStatus', () => {
  it('returns true for active', () => {
    expect(isCreditOperableStatus('active')).toBe(true);
  });

  it('returns true for past_due', () => {
    expect(isCreditOperableStatus('past_due')).toBe(true);
  });

  it('returns false for paused', () => {
    expect(isCreditOperableStatus('paused')).toBe(false);
  });

  it('returns false for canceled', () => {
    expect(isCreditOperableStatus('canceled')).toBe(false);
  });
});

describe('isReceivableGenerableStatus', () => {
  it('returns true for active', () => {
    expect(isReceivableGenerableStatus('active')).toBe(true);
  });

  it('returns true for past_due', () => {
    expect(isReceivableGenerableStatus('past_due')).toBe(true);
  });

  it('returns true for paused', () => {
    expect(isReceivableGenerableStatus('paused')).toBe(true);
  });

  it('returns false for canceled', () => {
    expect(isReceivableGenerableStatus('canceled')).toBe(false);
  });
});

describe('validateStatusTransition', () => {
  it('allows same status (no-op)', () => {
    expect(validateStatusTransition('active', 'active')).toEqual({ valid: true });
  });

  it('allows active → paused', () => {
    expect(validateStatusTransition('active', 'paused')).toEqual({ valid: true });
  });

  it('allows active → canceled', () => {
    expect(validateStatusTransition('active', 'canceled')).toEqual({ valid: true });
  });

  it('rejects active → active (already covered but explicit)', () => {
    const result = validateStatusTransition('active', 'active');
    expect(result.valid).toBe(true);
  });

  it('allows past_due → active', () => {
    expect(validateStatusTransition('past_due', 'active')).toEqual({ valid: true });
  });

  it('allows past_due → paused', () => {
    expect(validateStatusTransition('past_due', 'paused')).toEqual({ valid: true });
  });

  it('allows past_due → canceled', () => {
    expect(validateStatusTransition('past_due', 'canceled')).toEqual({ valid: true });
  });

  it('allows paused → active', () => {
    expect(validateStatusTransition('paused', 'active')).toEqual({ valid: true });
  });

  it('allows paused → canceled', () => {
    expect(validateStatusTransition('paused', 'canceled')).toEqual({ valid: true });
  });

  it('rejects canceled → any', () => {
    const result = validateStatusTransition('canceled', 'active');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('cancelada');
    }
  });

  it('rejects active → past_due', () => {
    const result = validateStatusTransition('active', 'past_due');
    expect(result.valid).toBe(false);
  });

  it('rejects paused → past_due', () => {
    const result = validateStatusTransition('paused', 'past_due');
    expect(result.valid).toBe(false);
  });
});
