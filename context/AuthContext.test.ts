/**
 * [SMG][AUTH] AuthContext — Testes do ciclo de sessão e silent refresh (Frente F-01)
 *
 * Garante que:
 * 1. Carga fria (bootstrapping) realiza carga bloqueante com loading=true.
 * 2. Renovação de token (TOKEN_REFRESHED) ou foco de janela com o mesmo usuário ativo
 *    é SILENCIOSA (loading=false, sem desmontar a árvore React).
 * 3. SIGNED_OUT limpa o estado de forma não bloqueante (loading=false).
 * 4. Troca de usuário ativa carga bloqueante (loading=true) para isolamento correto.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */
import { describe, expect, it } from 'vitest';
import { decideSessionTransition } from './AuthContext';

describe('AuthContext — decideSessionTransition', () => {
    describe('Bootstrapping inicial (carga fria)', () => {
        it('should_trigger_blocking_load_when_initial_load_is_not_done', () => {
            // Arrange
            const params = {
                initialLoadDone: false,
                activeUserId: null,
                nextUserId: 'user-uuid-1',
                event: 'INITIAL_SESSION',
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert
            expect(transition).toEqual({
                type: 'COLD_BOOT_OR_USER_SWITCH',
                shouldSetLoading: true,
                shouldFetchAccessContext: true,
            });
        });
    });

    describe('Silent Session Refresh (F-01)', () => {
        it('should_trigger_silent_refresh_without_loading_when_same_user_refreshes_token', () => {
            // Arrange (mesmo usuário ativo após carga inicial)
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: 'user-uuid-1',
                event: 'TOKEN_REFRESHED',
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert: NUNCA deve alterar loading para true e nem re-executar RPC pesada
            expect(transition).toEqual({
                type: 'SILENT_REFRESH',
                shouldSetLoading: false,
                shouldFetchAccessContext: false,
            });
        });

        it('should_trigger_silent_refresh_with_background_fetch_when_user_updated', () => {
            // Arrange (mesmo usuário, evento de atualização de perfil ou sync de aba)
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: 'user-uuid-1',
                event: 'USER_UPDATED',
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert: deve buscar contexto em background mas SEM travar ou desmontar tela
            expect(transition).toEqual({
                type: 'SILENT_REFRESH',
                shouldSetLoading: false,
                shouldFetchAccessContext: true,
            });
        });

        it('should_trigger_silent_refresh_when_re_focusing_with_same_user_and_undefined_event', () => {
            // Arrange (re-verificação de foco sem event explícito)
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: 'user-uuid-1',
                event: undefined,
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert
            expect(transition.shouldSetLoading).toBe(false);
            expect(transition.type).toBe('SILENT_REFRESH');
        });
    });

    describe('Encerramento de sessão (Logout / Expiração)', () => {
        it('should_trigger_sign_out_without_loading_when_event_is_signed_out', () => {
            // Arrange
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: null,
                event: 'SIGNED_OUT',
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert
            expect(transition).toEqual({
                type: 'SIGN_OUT',
                shouldSetLoading: false,
                shouldFetchAccessContext: false,
            });
        });

        it('should_trigger_sign_out_when_next_user_is_null_even_without_explicit_event', () => {
            // Arrange
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: null,
                event: undefined,
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert
            expect(transition.type).toBe('SIGN_OUT');
            expect(transition.shouldSetLoading).toBe(false);
        });
    });

    describe('Troca de usuário autenticado', () => {
        it('should_trigger_blocking_load_when_different_user_logs_in', () => {
            // Arrange (troca de conta entre abas ou re-autenticação)
            const params = {
                initialLoadDone: true,
                activeUserId: 'user-uuid-1',
                nextUserId: 'user-uuid-2',
                event: 'SIGNED_IN',
            };

            // Act
            const transition = decideSessionTransition(params);

            // Assert
            expect(transition).toEqual({
                type: 'COLD_BOOT_OR_USER_SWITCH',
                shouldSetLoading: true,
                shouldFetchAccessContext: true,
            });
        });
    });
});
