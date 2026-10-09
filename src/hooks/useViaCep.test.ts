/**
 * [SMG][HOOK] useViaCep — testes do núcleo puro e dos helpers do hook.
 *
 * Não há harness de DOM no projeto (vitest em ambiente node, sem
 * @testing-library/react), então a lógica do hook é coberta pelos helpers
 * puros que ele usa: mensagem, dedupe e detecção de resposta obsoleta.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchViaCepAddress,
  isStaleViaCepRequest,
  resolveViaCepMessage,
  shouldSkipViaCepFetch,
} from './useViaCep';

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
});

describe('useViaCep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchViaCepAddress', () => {
    it('should_map_response_to_trimmed_address_when_cep_is_found', async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        jsonResponse({
          logradouro: ' Rua das Flores ',
          bairro: ' Centro ',
          localidade: ' São Paulo ',
          uf: ' SP ',
        }),
      );

      // Act
      const result = await fetchViaCepAddress('01001000');

      // Assert
      expect(result).toEqual({
        ok: true,
        address: {
          street: 'Rua das Flores',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
        },
      });
      expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/');
    });

    it('should_return_not_found_when_payload_has_erro_flag', async () => {
      // Arrange
      fetchMock.mockResolvedValue(jsonResponse({ erro: true }));

      // Act
      const result = await fetchViaCepAddress('99999999');

      // Assert
      expect(result).toEqual({ ok: false, error: 'not_found' });
    });

    it('should_return_not_found_when_response_is_not_ok', async () => {
      // Arrange
      fetchMock.mockResolvedValue(jsonResponse({ logradouro: 'Rua X' }, false));

      // Act
      const result = await fetchViaCepAddress('01001000');

      // Assert
      expect(result).toEqual({ ok: false, error: 'not_found' });
    });

    it('should_return_network_when_fetch_throws', async () => {
      // Arrange
      fetchMock.mockRejectedValue(new Error('offline'));

      // Act
      const result = await fetchViaCepAddress('01001000');

      // Assert
      expect(result).toEqual({ ok: false, error: 'network' });
    });

    it('should_return_network_when_response_json_throws', async () => {
      // Arrange
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('invalid json');
        },
      });

      // Act
      const result = await fetchViaCepAddress('01001000');

      // Assert
      expect(result).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('resolveViaCepMessage', () => {
    it('should_return_success_copy_when_result_is_ok', () => {
      const result = {
        ok: true as const,
        address: { street: '', neighborhood: '', city: '', state: '' },
      };

      expect(resolveViaCepMessage(result)).toBe(
        'Endereço preenchido automaticamente pelo CEP.',
      );
    });

    it('should_return_not_found_copy_when_error_is_not_found', () => {
      expect(resolveViaCepMessage({ ok: false, error: 'not_found' })).toBe(
        'CEP não encontrado. Preencha o endereço manualmente.',
      );
    });

    it('should_return_network_copy_when_error_is_network', () => {
      expect(resolveViaCepMessage({ ok: false, error: 'network' })).toBe(
        'Não foi possível consultar o CEP agora. Continue com preenchimento manual.',
      );
    });
  });

  describe('shouldSkipViaCepFetch', () => {
    it('should_skip_when_cep_matches_last_fetched', () => {
      expect(shouldSkipViaCepFetch('01001000', '01001000')).toBe(true);
    });

    it('should_not_skip_when_cep_differs_from_last_fetched', () => {
      expect(shouldSkipViaCepFetch('01001000', '02002000')).toBe(false);
    });

    it('should_not_skip_when_nothing_was_fetched_yet', () => {
      expect(shouldSkipViaCepFetch(null, '01001000')).toBe(false);
    });
  });

  describe('isStaleViaCepRequest', () => {
    it('should_flag_stale_when_request_id_is_not_latest', () => {
      expect(isStaleViaCepRequest(1, 2)).toBe(true);
    });

    it('should_not_flag_stale_when_request_id_is_latest', () => {
      expect(isStaleViaCepRequest(2, 2)).toBe(false);
    });
  });
});
