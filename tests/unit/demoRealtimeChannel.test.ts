import { describe, expect, it } from 'vitest';
import {
  createDemoRealtimeChannel,
  removeDemoRealtimeChannel,
} from '../../src/lib/supabase/client';

describe('createDemoRealtimeChannel', () => {
  it('should_allow_single_on_then_subscribe_when_consumer_listens_to_one_table', () => {
    // Cobre o encadeamento de ChairSelfCheckoutModal: um único `.on()`.
    const channel = createDemoRealtimeChannel();

    expect(() => {
      channel.on('postgres_changes', { table: 'comandas' }, () => {}).subscribe();
    }).not.toThrow();
  });

  it('should_allow_two_on_calls_when_consumer_listens_to_multiple_tables', () => {
    // Cobre o encadeamento de useNotifications: `notifications` + `tenant_alerts`.
    const channel = createDemoRealtimeChannel();

    expect(() => {
      channel
        .on('postgres_changes', { table: 'notifications' }, () => {})
        .on('postgres_changes', { table: 'tenant_alerts' }, () => {})
        .subscribe();
    }).not.toThrow();
  });

  it('should_return_the_same_channel_when_on_and_subscribe_are_called', () => {
    const channel = createDemoRealtimeChannel();

    const chained = channel.on('postgres_changes', {}, () => {}).subscribe();

    expect(chained).toBe(channel);
  });

  it('should_resolve_ok_when_unsubscribe_is_called_twice', async () => {
    const channel = createDemoRealtimeChannel();

    const first = await channel.unsubscribe();
    const second = await channel.unsubscribe();

    expect([first, second]).toEqual(['ok', 'ok']);
  });
});

describe('removeDemoRealtimeChannel', () => {
  it('should_resolve_null_on_every_call_when_removal_repeats', async () => {
    const first = await removeDemoRealtimeChannel();
    const second = await removeDemoRealtimeChannel();

    expect([first, second]).toEqual([null, null]);
  });
});
