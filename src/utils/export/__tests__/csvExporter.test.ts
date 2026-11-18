import { describe, it, expect } from 'vitest';
import { generateCsvContent, escapeCsvValue } from '../csvExporter';
import type { ExportPayload } from '../types';

describe('CSV Exporter (generateCsvContent)', () => {
  it('deve escapar corretamente valores contendo ponto e vírgula e aspas duplas', () => {
    expect(escapeCsvValue('Simples')).toBe('Simples');
    expect(escapeCsvValue('Corte; Barba')).toBe('"Corte; Barba"');
    expect(escapeCsvValue('Pomada "Efeito Seco"')).toBe('"Pomada ""Efeito Seco"""');
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
    expect(escapeCsvValue(123.45)).toBe('123.45');
  });

  it('deve gerar cabeçalho executivo, summary cards e colunas delimitadas por ponto e vírgula', () => {
    interface TestItem {
      id: string;
      description: string;
      value: number;
    }

    const payload: ExportPayload<TestItem> = {
      metadata: {
        title: 'Extrato de Comissões',
        tenantName: 'Barbearia Sanchez',
        periodLabel: '01/11/2026 a 15/11/2026',
        generatedAt: '17/11/2026 21:00',
        summaryCards: [
          { label: 'Total Faturado', value: 'R$ 1.500,00' },
          { label: 'Total Comissões', value: 'R$ 750,00' },
        ],
      },
      columns: [
        { header: 'ID', key: 'id' },
        { header: 'Descrição', key: 'description' },
        {
          header: 'Valor',
          key: 'value',
          format: (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
        },
      ],
      data: [
        { id: '1', description: 'Corte Tradicional', value: 50.0 },
        { id: '2', description: 'Barba; Alinhamento', value: 35.0 },
      ],
    };

    const csv = generateCsvContent(payload);

    // Deve conter os metadados
    expect(csv).toContain('Relatório;Extrato de Comissões');
    expect(csv).toContain('Unidade;Barbearia Sanchez');
    expect(csv).toContain('Período;01/11/2026 a 15/11/2026');

    // Deve conter os summary cards
    expect(csv).toContain('--- RESUMO FINANCEIRO ---');
    expect(csv).toContain('Total Faturado;R$ 1.500,00');
    expect(csv).toContain('Total Comissões;R$ 750,00');

    // Deve conter os cabeçalhos das colunas
    expect(csv).toContain('ID;Descrição;Valor');

    // Deve conter os dados formatados
    expect(csv).toContain('1;Corte Tradicional;R$ 50,00');
    expect(csv).toContain('2;"Barba; Alinhamento";R$ 35,00');
  });
});
