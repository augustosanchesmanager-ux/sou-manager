import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeAiAnalystResponse } from '../../src/modules/intelligence/aiAnalystService';

describe('GTM-004 (#403 / ADR-050): SMG Barber Intelligence — Fase 1', () => {
  it('should_normalize_valid_ai_analyst_response_with_up_to_3_cards', () => {
    const result = normalizeAiAnalystResponse({
      generatedAt: '2026-11-25T10:00:00Z',
      cached: true,
      coldStart: false,
      cards: [
        {
          title: 'Faturamento semanal em alta',
          alertLevel: 'positive',
          diagnosis: 'Receita subiu 12% frente à semana anterior.',
          recommendedAction: 'Manter campanhas nos horários de pico.',
        },
        {
          title: 'Cancelamentos em atenção',
          alertLevel: 'warning',
          diagnosis: 'Taxa de cancelamento chegou a 14%.',
          recommendedAction: 'Ativar confirmação por WhatsApp 2h antes.',
        },
        {
          title: 'Ticket médio estável',
          alertLevel: 'info',
          diagnosis: 'Ticket médio em R$ 78,00.',
          recommendedAction: 'Oferecer combo corte + barba no check-in.',
        },
        {
          title: 'Extra card ignored',
          alertLevel: 'info',
          diagnosis: 'Should be sliced out.',
          recommendedAction: 'Ignored.',
        },
      ],
    });

    expect(result.cached).toBe(true);
    expect(result.coldStart).toBe(false);
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].alertLevel).toBe('positive');
  });

  it('should_fallback_unknown_alert_level_to_info_and_reject_empty_cards', () => {
    const normalized = normalizeAiAnalystResponse({
      cards: [
        {
          title: 'Teste',
          alertLevel: 'invalid-level',
          diagnosis: 'Diagnóstico válido.',
          recommendedAction: 'Ação prática.',
        },
      ],
    });

    expect(normalized.cards[0].alertLevel).toBe('info');
    expect(() => normalizeAiAnalystResponse({ cards: [] })).toThrow(
      'Nenhum card de diagnóstico foi retornado.'
    );
  });

  it('should_enforce_rls_unique_daily_cache_and_auth_check_in_migration', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261125070000_gtm004_ai_intelligence_phase1.sql'),
      'utf8'
    );

    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('UNIQUE (tenant_id, reference_date)');
    expect(migration).toContain('current_tenant_id_from_auth_uid()');
    expect(migration).toContain('current_is_super_admin_from_auth_uid()');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_tenant_weekly_metrics');
    expect(migration).toContain('auth.uid()');
  });

  it('should_declare_ai_analyst_with_verify_jwt_true_and_zero_purple_in_panel', () => {
    const configToml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    const edgeFn = readFileSync(resolve(process.cwd(), 'supabase/functions/ai-analyst/index.ts'), 'utf8');
    const panel = readFileSync(resolve(process.cwd(), 'components/bi/AiIntelligencePanel.tsx'), 'utf8');

    expect(configToml).toMatch(/\[functions\.ai-analyst\][\s\S]*verify_jwt\s*=\s*true/);
    expect(edgeFn).toContain('get_tenant_weekly_metrics');
    expect(edgeFn).toContain('ai_insights');
    expect(edgeFn).toContain('ai_usage_logs');
    expect(edgeFn).toContain('COLD_START_CARDS');
    expect(panel).not.toMatch(/purple|violet|indigo/i);
  });
});
