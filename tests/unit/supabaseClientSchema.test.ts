import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE_SUPABASE_CLIENT_OPTIONS,
  PUBLIC_ANONYMOUS_CLIENT_OPTIONS,
} from '../../src/lib/supabase/client';
import { SHARED_SCHEMA } from '../../src/lib/supabase/schemas';

const jsonOkResponse = (): Response =>
  new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('supabase client explicit schema options (F-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_declare_public_schema_explicitly_when_reading_base_client_options', () => {
    expect(BASE_SUPABASE_CLIENT_OPTIONS.db?.schema).toBe(SHARED_SCHEMA);
    expect(BASE_SUPABASE_CLIENT_OPTIONS.db?.schema).toBe('public');
  });

  it('should_declare_public_schema_explicitly_when_reading_public_anonymous_client_options', () => {
    expect(PUBLIC_ANONYMOUS_CLIENT_OPTIONS.db?.schema).toBe(SHARED_SCHEMA);
    expect(PUBLIC_ANONYMOUS_CLIENT_OPTIONS.auth?.persistSession).toBe(false);
    expect(PUBLIC_ANONYMOUS_CLIENT_OPTIONS.auth?.autoRefreshToken).toBe(false);
  });

  it('should_send_content_profile_public_header_when_calling_rpc_with_base_options', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonOkResponse());
    const client = createClient('https://example.supabase.co', 'anon-key', {
      ...BASE_SUPABASE_CLIENT_OPTIONS,
      global: { fetch: mockFetch },
    });

    // Act
    await client.rpc('get_auth_access_context');

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-profile')).toBe('public');
  });

  it('should_send_accept_profile_public_header_when_selecting_from_table_with_base_options', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonOkResponse());
    const client = createClient('https://example.supabase.co', 'anon-key', {
      ...BASE_SUPABASE_CLIENT_OPTIONS,
      global: { fetch: mockFetch },
    });

    // Act
    await client.from('profiles').select('id');

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('accept-profile')).toBe('public');
  });
});
