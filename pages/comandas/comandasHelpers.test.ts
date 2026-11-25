import { describe, it, expect } from 'vitest';
import {
  buildPeriodLabel,
  chunkIds,
  getConsumptionSummary,
  getConsumptionTypeForFilter,
  getDisplayId,
  parseDateInputValue,
} from './comandasHelpers';

describe('pages/comandas/comandasHelpers (UXQ-007 #397)', () => {
  it('should_parse_date_input_value_for_start_and_end_of_day', () => {
    const start = parseDateInputValue('2026-11-25', false);
    const end = parseDateInputValue('2026-11-25', true);

    expect(start?.getHours()).toBe(0);
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
    expect(parseDateInputValue('')).toBeNull();
  });

  it('should_chunk_ids_into_expected_batch_sizes', () => {
    expect(chunkIds(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('should_compute_deterministic_display_id_in_valid_range', () => {
    const id = getDisplayId('12345678-1234-1234-1234-1234567890ab');
    expect(id).toBeGreaterThanOrEqual(1000);
    expect(id).toBeLessThan(91000);
    expect(getDisplayId('invalid')).toBe(1000);
  });

  it('should_classify_consumption_summary_and_filter_type', () => {
    expect(getConsumptionSummary({ comanda_items: [] })).toEqual({ title: 'Sem consumo', detail: '0 itens' });

    const mixed = {
      comanda_items: [
        { id: '1', product_name: 'Pomada', quantity: 1, unit_price: 30, product_id: 'p1', service_id: null },
        { id: '2', product_name: 'Corte Degradê', quantity: 1, unit_price: 60, product_id: null, service_id: 's1' },
      ],
    };

    expect(getConsumptionSummary(mixed)).toEqual({ title: 'Corte Degradê', detail: '+1' });
    expect(getConsumptionTypeForFilter(mixed)).toBe('mixed');
  });

  it('should_build_period_label_cleanly', () => {
    expect(buildPeriodLabel('all', '', '')).toBe('Todo o período');
    expect(buildPeriodLabel('today', '2026-11-25', '2026-11-25')).toContain('Hoje ·');
  });
});
