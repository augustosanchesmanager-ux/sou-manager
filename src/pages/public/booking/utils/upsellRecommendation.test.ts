import { describe, it, expect } from 'vitest';
import {
  classifyServiceDomain,
  getSuggestedUpsellServices,
  getPopularServices,
} from './upsellRecommendation';
import type { PublicService } from '../hooks/types';

const mockServices: PublicService[] = [
  {
    id: 'srv-corte',
    name: 'Corte Degradê / Fade',
    category: 'Cabelo',
    price: 45,
    duration: 30,
    active: true,
  },
  {
    id: 'srv-barba',
    name: 'Barboterapia Completa',
    category: 'Barba',
    price: 35,
    duration: 30,
    active: true,
  },
  {
    id: 'srv-sobrancelha',
    name: 'Design de Sobrancelha',
    category: 'Estética',
    price: 20,
    duration: 15,
    active: true,
  },
  {
    id: 'srv-pezinho',
    name: 'Acabamento / Pezinho',
    category: 'Cabelo',
    price: 15,
    duration: 15,
    active: true,
  },
  {
    id: 'srv-platinado',
    name: 'Platinado Global',
    category: 'Química',
    price: 150,
    duration: 90,
    active: true,
  },
  {
    id: 'srv-inativo',
    name: 'Serviço Antigo',
    category: 'Outros',
    price: 10,
    duration: 10,
    active: false,
  },
];

describe('upsellRecommendation', () => {
  describe('classifyServiceDomain', () => {
    it('deve classificar corretamente cortes e cabelos como "hair"', () => {
      expect(classifyServiceDomain(mockServices[0])).toBe('hair');
      expect(classifyServiceDomain(mockServices[4])).toBe('hair');
    });

    it('deve classificar barba e barboterapia como "beard"', () => {
      expect(classifyServiceDomain(mockServices[1])).toBe('beard');
    });

    it('deve classificar sobrancelha e pezinho como "finish"', () => {
      expect(classifyServiceDomain(mockServices[2])).toBe('finish');
      expect(classifyServiceDomain(mockServices[3])).toBe('finish');
    });
  });

  describe('getSuggestedUpsellServices', () => {
    it('deve retornar vazio se não houver serviços ou nada selecionado', () => {
      expect(getSuggestedUpsellServices([], ['srv-corte'])).toEqual([]);
      expect(getSuggestedUpsellServices(mockServices, [])).toEqual([]);
    });

    it('deve sugerir Barba e Sobrancelha quando o cliente escolheu apenas Cabelo', () => {
      const suggestions = getSuggestedUpsellServices(mockServices, ['srv-corte']);

      expect(suggestions).toHaveLength(2);
      expect(suggestions.some((s) => s.id === 'srv-barba')).toBe(true);
      expect(suggestions.some((s) => s.id === 'srv-sobrancelha' || s.id === 'srv-pezinho')).toBe(true);
      expect(suggestions.some((s) => s.id === 'srv-corte')).toBe(false);
    });

    it('deve sugerir Corte/Cabelo quando o cliente escolheu apenas Barba', () => {
      const suggestions = getSuggestedUpsellServices(mockServices, ['srv-barba']);

      expect(suggestions).toHaveLength(2);
      // Deve sugerir o corte primeiro
      expect(suggestions[0].id).toBe('srv-corte');
      expect(suggestions.some((s) => s.id === 'srv-barba')).toBe(false);
    });

    it('deve retornar vazio se o cliente já selecionou Cabelo E Barba (combo completo)', () => {
      const suggestions = getSuggestedUpsellServices(mockServices, ['srv-corte', 'srv-barba']);
      expect(suggestions).toEqual([]);
    });

    it('não deve sugerir serviços inativos', () => {
      const customServices: PublicService[] = [
        {
          id: 'srv-corte-1',
          name: 'Corte',
          category: 'Cabelo',
          price: 40,
          duration: 30,
          active: true,
        },
        {
          id: 'srv-barba-inativa',
          name: 'Barba Inativa',
          category: 'Barba',
          price: 30,
          duration: 20,
          active: false,
        },
      ];

      const suggestions = getSuggestedUpsellServices(customServices, ['srv-corte-1']);
      expect(suggestions.some((s) => s.id === 'srv-barba-inativa')).toBe(false);
    });

    it('deve limitar a no máximo 2 sugestões', () => {
      const suggestions = getSuggestedUpsellServices(mockServices, ['srv-corte']);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getPopularServices', () => {
    it('deve retornar até o limite configurado de serviços populares', () => {
      const popular = getPopularServices(mockServices, 2);
      expect(popular).toHaveLength(2);
      expect(popular[0].active).toBe(true);
    });

    it('deve priorizar corte e barba nos mais pedidos', () => {
      const popular = getPopularServices(mockServices, 2);
      const ids = popular.map((s) => s.id);
      expect(ids).toContain('srv-corte');
      expect(ids).toContain('srv-barba');
    });

    it('retorna array vazio quando catálogo for vazio', () => {
      expect(getPopularServices([])).toEqual([]);
    });
  });
});
