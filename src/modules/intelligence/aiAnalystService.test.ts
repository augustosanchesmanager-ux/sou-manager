import { describe, it, expect } from 'vitest';
import {
  normalizeAiAnalystResponse,
  normalizeStrategyCopilotResponse,
} from './aiAnalystService';

describe('src/modules/intelligence/aiAnalystService (ADR-050 + ADR-057)', () => {
  it('should_normalize_valid_weekly_diagnosis_cards', () => {
    const res = normalizeAiAnalystResponse({
      generatedAt: '2026-11-26T12:00:00Z',
      cached: true,
      coldStart: false,
      cards: [
        {
          title: 'Ticket Médio em Alta',
          alertLevel: 'positive',
          diagnosis: 'Ticket subiu 12% na semana.',
          recommendedAction: 'Oferecer combo corte + barba.',
        },
      ],
    });

    expect(res.cached).toBe(true);
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0].alertLevel).toBe('positive');
  });

  it('should_normalize_valid_strategy_copilot_plan_response', () => {
    const res = normalizeStrategyCopilotResponse({
      generatedAt: '2026-11-26T15:00:00Z',
      actionType: 'paid_traffic',
      remainingToday: 19,
      plan: {
        headline: 'Campanha Local Terça e Quarta',
        summary: 'Seus horários ociosos estão entre 10h e 15h.',
        steps: [
          { step: 'Segmentar raio 3km', detail: 'Homens 20-45 anos perto da unidade.' },
          { step: 'Oferta de combo', detail: 'Corte + Barba com bônus de hidratação.' },
          { step: 'Link direto de agenda', detail: 'Enviar para /#/agendar com rastreio.' },
        ],
        readyMessage: 'Fala campeão! Terça e quarta temos condição especial no combo.',
        kpiToTrack: 'Agendamentos confirmados terça/quarta nos próximos 7 dias.',
      },
    });

    expect(res.actionType).toBe('paid_traffic');
    expect(res.remainingToday).toBe(19);
    expect(res.plan.steps).toHaveLength(3);
    expect(res.plan.readyMessage).toContain('combo');
  });

  it('should_throw_when_strategy_copilot_plan_is_missing_steps', () => {
    expect(() =>
      normalizeStrategyCopilotResponse({
        actionType: 'campaign',
        plan: { headline: 'Sem passos', summary: 'Teste', steps: [] },
      })
    ).toThrow('incompleto');
  });
});
