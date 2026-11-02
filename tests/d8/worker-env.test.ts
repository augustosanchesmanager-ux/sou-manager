/**
 * D8 — normalização de ambiente do worker-dispatcher.
 *
 * Regressão coberta: `SUPABASE_PUBLISHABLE_KEYS` é um dicionário JSON
 * (`{"default":"sb_publishable_..."}`), não uma chave crua. Passar a string
 * JSON como `apikey` faz o gateway responder 401 e derruba todo ciclo do
 * worker. `SUPABASE_URL` também pode chegar com sufixo `/rest/v1`, que o
 * supabase-js duplicaria.
 *
 * As funções testadas são puras: não dependem de `Deno.env`.
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeProjectUrl,
  resolvePublishableKey,
} from '../../supabase/functions/worker-dispatcher/env';

describe('D8 worker env — publishable key', () => {
  it('should_extract_default_key_when_publishable_keys_is_json_dictionary', () => {
    // Arrange
    const raw = JSON.stringify({ default: 'sb_publishable_abc' });

    // Act
    const key = resolvePublishableKey(raw, 'legacy-anon');

    // Assert
    expect(key).toBe('sb_publishable_abc');
  });

  it('should_extract_anon_key_when_default_is_absent', () => {
    // Arrange
    const raw = JSON.stringify({ anon: 'sb_publishable_anon' });

    // Act
    const key = resolvePublishableKey(raw, 'legacy-anon');

    // Assert
    expect(key).toBe('sb_publishable_anon');
  });

  it('should_use_fallback_when_dictionary_has_no_usable_key', () => {
    // Arrange
    const raw = JSON.stringify({ service_role: 'sb_secret_xyz' });

    // Act
    const key = resolvePublishableKey(raw, 'legacy-anon');

    // Assert
    expect(key).toBe('legacy-anon');
  });

  it('should_return_raw_value_when_secret_is_a_plain_key', () => {
    // Arrange — compatibilidade com deploys anteriores à migração
    const raw = 'plain-api-key';

    // Act
    const key = resolvePublishableKey(raw, 'legacy-anon');

    // Assert
    expect(key).toBe('plain-api-key');
  });

  it('should_return_fallback_when_secret_is_missing', () => {
    // Act
    const key = resolvePublishableKey(undefined, 'legacy-anon');

    // Assert
    expect(key).toBe('legacy-anon');
  });

  it('should_return_empty_string_when_secret_and_fallback_are_missing', () => {
    // Act
    const key = resolvePublishableKey(undefined);

    // Assert
    expect(key).toBe('');
  });
});

describe('D8 worker env — project URL', () => {
  it('should_strip_rest_v1_and_trailing_slash_when_normalizing_project_url', () => {
    // Act
    const url = normalizeProjectUrl('https://ushsnmlbeurfvlkieiln.supabase.co/rest/v1/');

    // Assert
    expect(url).toBe('https://ushsnmlbeurfvlkieiln.supabase.co');
  });

  it('should_strip_rest_v1_when_there_is_no_trailing_slash', () => {
    // Act
    const url = normalizeProjectUrl('https://ushsnmlbeurfvlkieiln.supabase.co/rest/v1');

    // Assert
    expect(url).toBe('https://ushsnmlbeurfvlkieiln.supabase.co');
  });

  it('should_keep_base_url_when_project_url_is_already_canonical', () => {
    // Act
    const url = normalizeProjectUrl('https://ushsnmlbeurfvlkieiln.supabase.co');

    // Assert
    expect(url).toBe('https://ushsnmlbeurfvlkieiln.supabase.co');
  });

  it('should_return_empty_string_when_project_url_is_missing', () => {
    // Act
    const url = normalizeProjectUrl(undefined);

    // Assert
    expect(url).toBe('');
  });
});
