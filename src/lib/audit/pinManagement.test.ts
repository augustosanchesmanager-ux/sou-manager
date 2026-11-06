import { describe, expect, it } from 'vitest';
import {
  AUDIT_PIN_DEMO_UNAVAILABLE,
  AUDIT_PIN_STATUS_UNAVAILABLE,
  isAuditPinRpcUnavailable,
  mapAuditPinRpcError,
  validateAuditPinForm,
} from './pinManagement';

describe('pinManagement — validação do formulário de PIN', () => {
  it('should_accept_a_valid_pin_when_creating_the_first_pin', () => {
    const error = validateAuditPinForm({
      configured: false,
      currentPin: '',
      newPin: '123456',
      confirmPin: '123456',
    });

    expect(error).toBeNull();
  });

  it('should_accept_a_valid_pin_when_changing_an_existing_pin', () => {
    const error = validateAuditPinForm({
      configured: true,
      currentPin: '654321',
      newPin: '12345678',
      confirmPin: '12345678',
    });

    expect(error).toBeNull();
  });

  it('should_reject_when_new_pin_has_less_than_six_digits', () => {
    const error = validateAuditPinForm({
      configured: false,
      currentPin: '',
      newPin: '12345',
      confirmPin: '12345',
    });

    expect(error).toBe('O novo PIN deve ter de 6 a 8 dígitos.');
  });

  it('should_reject_when_new_pin_has_more_than_eight_digits', () => {
    const error = validateAuditPinForm({
      configured: false,
      currentPin: '',
      newPin: '123456789',
      confirmPin: '123456789',
    });

    expect(error).toBe('O novo PIN deve ter de 6 a 8 dígitos.');
  });

  it('should_reject_when_confirmation_does_not_match', () => {
    const error = validateAuditPinForm({
      configured: false,
      currentPin: '',
      newPin: '123456',
      confirmPin: '123457',
    });

    expect(error).toBe('A confirmação do novo PIN não confere.');
  });

  it('should_reject_when_current_pin_is_missing_and_a_pin_already_exists', () => {
    const error = validateAuditPinForm({
      configured: true,
      currentPin: '',
      newPin: '123456',
      confirmPin: '123456',
    });

    expect(error).toBe('Informe o PIN atual (6 a 8 dígitos).');
  });

  it('should_reject_when_current_pin_has_invalid_format', () => {
    const error = validateAuditPinForm({
      configured: true,
      currentPin: '12ab56',
      newPin: '123456',
      confirmPin: '123456',
    });

    expect(error).toBe('Informe o PIN atual (6 a 8 dígitos).');
  });
});

describe('pinManagement — tradução de erros da RPC', () => {
  it('should_map_the_wrong_current_pin_error_when_rpc_fails', () => {
    expect(mapAuditPinRpcError('PIN atual invalido')).toBe('PIN atual inválido.');
  });

  it('should_map_the_missing_current_pin_error_when_rpc_fails', () => {
    expect(mapAuditPinRpcError('PIN atual obrigatorio para alterar o PIN')).toBe(
      'Informe o PIN atual para alterar o PIN.',
    );
  });

  it('should_map_the_invalid_format_error_when_rpc_fails', () => {
    expect(mapAuditPinRpcError('PIN deve ter de 6 a 8 digitos')).toBe(
      'O novo PIN deve ter de 6 a 8 dígitos.',
    );
  });

  it('should_map_the_permission_error_when_rpc_fails', () => {
    expect(mapAuditPinRpcError('Usuario sem permissao para gerenciar PIN gerencial')).toBe(
      'Seu perfil não tem permissão para gerenciar o PIN gerencial.',
    );
  });

  it('should_map_expired_session_when_rpc_fails', () => {
    expect(mapAuditPinRpcError('Usuario autenticado obrigatorio')).toBe(
      'Sessão expirada. Entre novamente para continuar.',
    );
  });

  it('should_map_missing_migration_when_rpc_is_not_found', () => {
    expect(
      mapAuditPinRpcError(
        'Could not find the function public.set_audit_pin(p_tenant_id, p_new_pin, p_current_pin) in the schema cache',
      ),
    ).toBe(AUDIT_PIN_STATUS_UNAVAILABLE);
  });

  it('should_map_demo_mode_when_rpc_is_unavailable', () => {
    expect(mapAuditPinRpcError('RPC indisponivel no modo local.')).toBe(AUDIT_PIN_DEMO_UNAVAILABLE);
  });

  it('should_fall_back_when_error_message_is_unknown', () => {
    expect(mapAuditPinRpcError('network timeout')).toBe(
      'Não foi possível concluir a operação com o PIN. Tente novamente.',
    );
  });

  it('should_fall_back_when_error_message_is_empty', () => {
    expect(mapAuditPinRpcError(null)).toBe(
      'Não foi possível concluir a operação com o PIN. Tente novamente.',
    );
  });

  it('should_detect_rpc_unavailability_when_message_matches', () => {
    expect(isAuditPinRpcUnavailable('Could not find the function public.get_audit_pin_status')).toBe(
      true,
    );
    expect(isAuditPinRpcUnavailable('RPC indisponivel no modo local.')).toBe(true);
    expect(isAuditPinRpcUnavailable('permission denied for function')).toBe(false);
    expect(isAuditPinRpcUnavailable(null)).toBe(false);
  });
});
