/**
 * [SMG][LIB][AUDIT] pinManagement
 *
 * Helpers puros para o autoatendimento do PIN gerencial em Configurações.
 * A validação de formato reaproveita `competence.ts` para manter uma única
 * regra (6 a 8 dígitos) entre o modal de estorno e o cadastro.
 */

import { isAuditPinFormatValid } from './competence';

export const AUDIT_PIN_STATUS_UNAVAILABLE =
  'A gestão do PIN ainda não está disponível neste ambiente. A migration de PIN precisa ser aplicada.';

export const AUDIT_PIN_DEMO_UNAVAILABLE =
  'A gestão do PIN não está disponível no modo demonstração local.';

/**
 * Valida o formulário antes de chamar a RPC. Retorna a mensagem de erro ou
 * `null` quando o formulário está pronto para envio.
 */
export function validateAuditPinForm(params: {
  configured: boolean;
  currentPin: string;
  newPin: string;
  confirmPin: string;
}): string | null {
  const { configured, currentPin, newPin, confirmPin } = params;

  if (configured && !isAuditPinFormatValid(currentPin)) {
    return 'Informe o PIN atual (6 a 8 dígitos).';
  }

  if (!isAuditPinFormatValid(newPin)) {
    return 'O novo PIN deve ter de 6 a 8 dígitos.';
  }

  if (newPin !== confirmPin) {
    return 'A confirmação do novo PIN não confere.';
  }

  return null;
}

export function isAuditPinRpcUnavailable(message?: string | null): boolean {
  const raw = (message || '').toLowerCase();

  return (
    raw.includes('could not find the function') ||
    raw.includes('schema cache') ||
    raw.includes('rpc indisponivel no modo local') ||
    raw.includes('does not exist')
  );
}

export function mapAuditPinRpcError(message?: string | null): string {
  const raw = (message || '').toLowerCase();

  if (!raw) {
    return 'Não foi possível concluir a operação com o PIN. Tente novamente.';
  }

  if (raw.includes('rpc indisponivel no modo local')) {
    return AUDIT_PIN_DEMO_UNAVAILABLE;
  }

  if (isAuditPinRpcUnavailable(raw)) {
    return AUDIT_PIN_STATUS_UNAVAILABLE;
  }

  if (raw.includes('pin atual invalido')) {
    return 'PIN atual inválido.';
  }

  if (raw.includes('pin atual obrigatorio')) {
    return 'Informe o PIN atual para alterar o PIN.';
  }

  if (raw.includes('pin deve ter de 6 a 8 digitos')) {
    return 'O novo PIN deve ter de 6 a 8 dígitos.';
  }

  if (raw.includes('usuario sem permissao para gerenciar pin')) {
    return 'Seu perfil não tem permissão para gerenciar o PIN gerencial.';
  }

  if (raw.includes('tenant nao autorizado')) {
    return 'Você não tem acesso a este tenant.';
  }

  if (raw.includes('usuario autenticado obrigatorio')) {
    return 'Sessão expirada. Entre novamente para continuar.';
  }

  return 'Não foi possível concluir a operação com o PIN. Tente novamente.';
}
