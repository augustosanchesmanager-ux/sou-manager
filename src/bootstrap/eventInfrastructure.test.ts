import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeEventInfrastructure,
  getEventInfrastructure,
  disposeEventInfrastructure,
} from './eventInfrastructure';

describe('EventInfrastructure', () => {
  beforeEach(() => {
    disposeEventInfrastructure();
  });

  it('should_initialize_and_return_infrastructure', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.isInitialized).toBe(true);
    expect(infra.registry.count()).toBe(6);
  });

  it('should_return_same_instance_on_double_initialize', () => {
    const first = initializeEventInfrastructure();
    const second = initializeEventInfrastructure();
    expect(first).toBe(second);
  });

  it('should_create_new_instance_after_dispose', () => {
    const first = initializeEventInfrastructure();
    disposeEventInfrastructure();
    const second = initializeEventInfrastructure();
    expect(first).not.toBe(second);
    expect(second.isInitialized).toBe(true);
  });

  it('should_register_all_6_read_only_subscribers', () => {
    const infra = initializeEventInfrastructure();
    const names = infra.registry.names();
    expect(names).toContain('AnalyticsSubscriber');
    expect(names).toContain('AuditSubscriber');
    expect(names).toContain('NotificationSubscriber');
    expect(names).toContain('ReminderSubscriber');
    expect(names).toContain('MarketingSubscriber');
    expect(names).toContain('BiSubscriber');
  });

  it('should_not_duplicate_subscribers_on_repeated_initialize', () => {
    initializeEventInfrastructure();
    initializeEventInfrastructure();
    const infra = getEventInfrastructure();
    expect(infra?.registry.count()).toBe(6);
  });

  it('should_return_null_after_dispose', () => {
    initializeEventInfrastructure();
    disposeEventInfrastructure();
    expect(getEventInfrastructure()).toBeNull();
  });

  it('should_return_null_when_never_initialized', () => {
    expect(getEventInfrastructure()).toBeNull();
  });

  it('should_not_register_finance_subscribers_in_read_only_mode', () => {
    const infra = initializeEventInfrastructure();
    const names = infra.registry.names();
    expect(names).not.toContain('FinanceSubscriber');
    expect(names).not.toContain('CommissionSubscriber');
  });
});
