import { describe, expect, it } from 'vitest';
import {
  CIRCULAR,
  MAX_REDACT_DEPTH,
  REDACTED,
  TRUNCATED,
  UNREDACTABLE,
  isSensitiveKey,
  redact,
  redactString,
} from './redact';

describe('redact', () => {
  it('should_redact_sensitive_keys_when_nested', () => {
    const input = {
      password: 'segredo',
      nested: { authorization: 'Bearer abc', token: 'tok_123' },
    };

    const output = redact(input);

    expect(output.password).toBe(REDACTED);
    expect(output.nested.authorization).toBe(REDACTED);
    expect(output.nested.token).toBe(REDACTED);
  });

  it('should_preserve_tenant_tags_when_redacting', () => {
    const input = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      tenant_id: '22222222-2222-2222-2222-222222222222',
      customerEmail: 'cliente@exemplo.com',
    };

    const output = redact(input);

    expect(output.tenantId).toBe(input.tenantId);
    expect(output.tenant_id).toBe(input.tenant_id);
    expect(output.customerEmail).toBe(REDACTED);
  });

  it('should_redact_bearer_and_jwt_when_present_in_free_text', () => {
    const bearer = redactString('Authorization: Bearer abc.def.ghi');
    const jwt = redactString(
      'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
    );

    expect(bearer).toContain(`Bearer ${REDACTED}`);
    expect(bearer).not.toContain('abc.def.ghi');
    expect(jwt).toContain(REDACTED);
    expect(jwt).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('should_redact_email_cpf_and_phone_when_present_in_strings', () => {
    const output = redactString(
      'contato cliente@exemplo.com cpf 123.456.789-00 tel 11 98765-4321',
    );

    expect(output).not.toContain('cliente@exemplo.com');
    expect(output).not.toContain('123.456.789-00');
    expect(output).not.toContain('98765-4321');
    expect(output.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('should_redact_secret_query_params_when_present_in_urls', () => {
    const output = redactString(
      'https://app.exemplo.com/callback?token=abc123&refresh_token=xyz&page=1',
    );

    expect(output).not.toContain('abc123');
    expect(output).not.toContain('xyz');
    expect(output).toContain('page=1');
  });

  it('should_redact_each_item_when_input_is_array', () => {
    const output = redact([{ password: 'a' }, { email: 'b@c.com' }, 'plain']);

    expect(output).toEqual([{ password: REDACTED }, { email: REDACTED }, 'plain']);
  });

  it('should_truncate_when_depth_exceeds_limit', () => {
    const input = { a: { b: { c: { d: { e: 'fundo' } } } } };

    const output = redact(input);

    expect(MAX_REDACT_DEPTH).toBe(4);
    expect(output.a.b.c.d).toBe(TRUNCATED);
  });

  it('should_replace_circular_reference_when_object_references_itself', () => {
    const input: Record<string, unknown> = { name: 'raiz' };
    input.self = input;

    const output = redact(input);

    expect(output.self).toBe(CIRCULAR);
  });

  it('should_not_mutate_input_when_redacting', () => {
    const input = { password: 'segredo', nested: { token: 'tok' } };

    redact(input);

    expect(input.password).toBe('segredo');
    expect(input.nested.token).toBe('tok');
  });

  it('should_redact_error_stack_when_error_contains_pii', () => {
    const error = new Error('falha para cliente@exemplo.com');
    const output = redact(error) as { message: string; stack?: string };

    expect(output.message).toBe(`falha para ${REDACTED}`);
    expect(output.stack ?? '').not.toContain('cliente@exemplo.com');
  });

  it('should_fail_open_when_accessor_throws', () => {
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'boom', {
      enumerable: true,
      get() {
        throw new Error('getter explodiu');
      },
    });

    expect(redact(hostile)).toBe(UNREDACTABLE);
  });

  it('should_classify_keys_when_sensitive', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('authorization')).toBe(true);
    expect(isSensitiveKey('cpf')).toBe(true);
    expect(isSensitiveKey('tenantId')).toBe(false);
    expect(isSensitiveKey('operation')).toBe(false);
  });
});
