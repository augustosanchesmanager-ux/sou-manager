/**
 * P1.1 — Testes unitários do mapeamento preset → período canônico
 *
 * Valida a regra do Design Gate §5: presets com correspondência direta no
 * contrato P1.3 traduzem; presets sem equivalente ficam ancorados no último
 * período canônico renderizado (nunca em intervalo sem fonte RPC).
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_CANONICAL_PERIOD,
  PRESET_TO_CANONICAL,
  canonicalPeriodLabel,
  resolveCanonicalPeriod,
} from './presetMapping';

describe('resolveCanonicalPeriod', () => {
  describe('presets mapeados', () => {
    it('should_map_today_to_canonical_today', () => {
      const result = resolveCanonicalPeriod('today', 'month');
      expect(result).toEqual({ period: 'today', anchor: 'today', isMapped: true });
    });

    it('should_map_yesterday_to_canonical_yesterday', () => {
      const result = resolveCanonicalPeriod('yesterday', 'month');
      expect(result).toEqual({ period: 'yesterday', anchor: 'yesterday', isMapped: true });
    });

    it('should_map_this_month_to_canonical_month', () => {
      const result = resolveCanonicalPeriod('this_month', 'year');
      expect(result).toEqual({ period: 'month', anchor: 'month', isMapped: true });
    });

    it('should_map_this_year_to_canonical_year', () => {
      const result = resolveCanonicalPeriod('this_year', 'month');
      expect(result).toEqual({ period: 'year', anchor: 'year', isMapped: true });
    });
  });

  describe('presets sem equivalente canônico (ancorados)', () => {
    it('should_anchor_last_7_days_to_anchor_preserving_anchor', () => {
      const result = resolveCanonicalPeriod('last_7_days', 'month');
      expect(result).toEqual({ period: 'month', anchor: 'month', isMapped: false });
    });

    it('should_anchor_last_month_to_anchor_preserving_anchor', () => {
      const result = resolveCanonicalPeriod('last_month', 'year');
      expect(result).toEqual({ period: 'year', anchor: 'year', isMapped: false });
    });

    it('should_anchor_custom_to_anchor_preserving_anchor', () => {
      const result = resolveCanonicalPeriod('custom', 'quarter');
      expect(result).toEqual({ period: 'quarter', anchor: 'quarter', isMapped: false });
    });
  });

  describe('cadeia de âncora (preset mapeado depois não mapeado)', () => {
    it('should_anchor_uses_last_mapped_period_when_preset_follows_anchor', () => {
      // Arrange: usuário navegou para "Este ano" (anchor = year)
      const mapped = resolveCanonicalPeriod('this_year', INITIAL_CANONICAL_PERIOD);

      // Act: depois escolheu intervalo livre (custom)
      const anchored = resolveCanonicalPeriod('custom', mapped.anchor);

      // Assert
      expect(anchored.period).toBe('year');
      expect(anchored.isMapped).toBe(false);
    });
  });
});

describe('PRESET_TO_CANONICAL', () => {
  it('should_contain_only_the_four_semantic_mappings', () => {
    expect(Object.keys(PRESET_TO_CANONICAL).sort()).toEqual([
      'this_month',
      'this_year',
      'today',
      'yesterday',
    ]);
  });
});

describe('INITIAL_CANONICAL_PERIOD', () => {
  it('should_default_to_month', () => {
    expect(INITIAL_CANONICAL_PERIOD).toBe('month');
  });
});

describe('canonicalPeriodLabel', () => {
  it('should_return_pt_br_label_for_month', () => {
    expect(canonicalPeriodLabel('month')).toBe('Este mês');
  });

  it('should_return_pt_br_label_for_today', () => {
    expect(canonicalPeriodLabel('today')).toBe('Hoje');
  });

  it('should_return_pt_br_label_for_year', () => {
    expect(canonicalPeriodLabel('year')).toBe('Este ano');
  });
});