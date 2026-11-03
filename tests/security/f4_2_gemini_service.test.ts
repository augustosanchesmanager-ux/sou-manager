import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSupportResponse, generateBusinessInsights } from '../../services/geminiService';
import * as supabaseClientModule from '../../services/supabaseClient';

describe('F4.2 / Issue #222 — Gemini Service via Backend Edge Function', () => {
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(supabaseClientModule, 'getSharedClient').mockReturnValue({
      functions: {
        invoke: mockInvoke,
      },
    } as any);
  });

  describe('generateSupportResponse', () => {
    it('deve retornar aviso quando o usuário enviar pergunta vazia', async () => {
      const result = await generateSupportResponse('   ');
      expect(result).toBe('Por favor, digite sua dúvida.');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('deve invocar gemini-assistant com userQuestion e appSlug e retornar texto', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { text: 'Para fechar uma comanda, vá até o menu Comandas.' },
        error: null,
      });

      const result = await generateSupportResponse('Como fechar comanda?', 'barber');

      expect(mockInvoke).toHaveBeenCalledWith('gemini-assistant', {
        body: { userQuestion: 'Como fechar comanda?', appSlug: 'barber' },
      });
      expect(result).toBe('Para fechar uma comanda, vá até o menu Comandas.');
    });

    it('deve tratar erro 401 (não autenticado)', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { status: 401, message: 'Unauthorized' },
      });

      const result = await generateSupportResponse('Dúvida qualquer');
      expect(result).toContain('Sua sessão expirou ou não está autenticada');
    });

    it('deve tratar erro 429 (cota excedida)', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { status: 429, message: 'Too Many Requests' },
      });

      const result = await generateSupportResponse('Dúvida qualquer');
      expect(result).toContain('alta demanda no momento');
    });

    it('deve retornar mensagem amigável caso ocorra erro inesperado de rede', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      const result = await generateSupportResponse('Dúvida');
      expect(result).toContain('Assistente de IA temporariamente indisponível');
    });
  });

  describe('generateBusinessInsights', () => {
    it('deve invocar gemini-assistant com mode insights e métricas', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { text: 'Seu ticket médio cresceu 12%.' },
        error: null,
      });

      const result = await generateBusinessInsights({ revenue: 15000, avgTicket: 85 });

      expect(mockInvoke).toHaveBeenCalledWith('gemini-assistant', {
        body: {
          metrics: { revenue: 15000, avgTicket: 85 },
          mode: 'insights',
        },
      });
      expect(result).toBe('Seu ticket médio cresceu 12%.');
    });

    it('deve tratar erro na geração de insights graciosamente', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { status: 500, message: 'Internal error' },
      });

      const result = await generateBusinessInsights({ revenue: 0 });
      expect(result).toBe('No momento não foi possível gerar insights. Tente novamente mais tarde.');
    });
  });
});
