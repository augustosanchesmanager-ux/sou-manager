import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  getSharedClient: () => ({
    functions: {
      invoke: invokeMock,
    },
  }),
}));

import { fetchStrategicDiagnosis } from './aiAnalystService';

describe('aiAnalystService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_return_structured_cards_when_ai_analyst_succeeds', async () => {
    // Arrange
    const expectedCards = [
      {
        title: 'Faturamento em alta',
        alertLevel: 'positive',
        diagnosis: 'Receita cresceu 12% na semana.',
        recommendedAction: 'Manter campanha de combos.',
      },
      {
        title: 'Terça-feira ociosa',
        alertLevel: 'warning',
        diagnosis: 'Ocupação abaixo de 35% na terça.',
        recommendedAction: 'Ativar lembrete para clientes inativos.',
      },
      {
        title: 'No-show controlado',
        alertLevel: 'info',
        diagnosis: 'Apenas 2 faltas registradas.',
        recommendedAction: 'Seguir com confirmação automática.',
      },
    ];
    invokeMock.mockResolvedValue({
      data: {
        generatedAt: '2026-11-19T10:00:00Z',
        referenceDate: '2026-11-19',
        cached: true,
        coldStart: false,
        cards: expectedCards,
      },
      error: null,
    });

    // Act
    const result = await fetchStrategicDiagnosis();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('ai-analyst', { body: {} });
    expect(result.cached).toBe(true);
    expect(result.coldStart).toBe(false);
    expect(result.cards).toEqual(expectedCards);
  });

  it('should_throw_forbidden_message_when_role_is_not_owner_or_manager', async () => {
    // Arrange
    invokeMock.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Forbidden' },
    });

    // Act & Assert
    await expect(fetchStrategicDiagnosis()).rejects.toThrow(
      'Diagnóstico estratégico disponível apenas para proprietários e gerentes.',
    );
  });

  it('should_throw_contract_error_when_cards_payload_is_invalid', async () => {
    // Arrange
    invokeMock.mockResolvedValue({
      data: {
        cached: false,
        cards: [{ title: 'Incompleto' }],
      },
      error: null,
    });

    // Act & Assert
    await expect(fetchStrategicDiagnosis()).rejects.toThrow(
      'Resposta do diagnóstico inteligente em formato inválido.',
    );
  });
});
