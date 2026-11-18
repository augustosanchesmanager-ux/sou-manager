/**
 * src/utils/export/csvExporter.ts
 *
 * Exportador nativo de CSV formatado para Excel em português (Brasil).
 * Utiliza ponto e vírgula (;) como delimitador e UTF-8 BOM (\uFEFF)
 * para exibição correta de acentuação sem necessidade de configuração prévia no Excel.
 */

import type { ExportPayload } from './types';

/**
 * Escapa valores para o formato CSV.
 * Envolve em aspas se contiver ponto e vírgula, quebra de linha ou aspas duplas,
 * duplicando as aspas internas.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera a string pura em formato CSV a partir do payload de exportação.
 */
export function generateCsvContent<T>(payload: ExportPayload<T>): string {
  const lines: string[] = [];

  // Metadados do relatório
  lines.push(`${escapeCsvValue('Relatório')};${escapeCsvValue(payload.metadata.title)}`);
  lines.push(`${escapeCsvValue('Unidade')};${escapeCsvValue(payload.metadata.tenantName)}`);
  lines.push(`${escapeCsvValue('Período')};${escapeCsvValue(payload.metadata.periodLabel)}`);
  lines.push(`${escapeCsvValue('Gerado em')};${escapeCsvValue(payload.metadata.generatedAt)}`);

  // Summary Cards se houver
  if (payload.metadata.summaryCards && payload.metadata.summaryCards.length > 0) {
    lines.push('');
    lines.push(escapeCsvValue('--- RESUMO FINANCEIRO ---'));
    for (const card of payload.metadata.summaryCards) {
      lines.push(`${escapeCsvValue(card.label)};${escapeCsvValue(card.value)}`);
    }
  }

  lines.push(''); // Linha em branco separando metadados da tabela

  // Cabeçalho das colunas
  const headerLine = payload.columns.map((col) => escapeCsvValue(col.header)).join(';');
  lines.push(headerLine);

  // Linhas de dados
  for (const row of payload.data) {
    const rowValues = payload.columns.map((col) => {
      let rawVal: any;
      if (typeof col.key === 'string' && col.key.includes('.')) {
        rawVal = col.key.split('.').reduce((obj: any, key) => obj?.[key], row);
      } else {
        rawVal = (row as any)[col.key];
      }

      const formattedVal = col.format ? col.format(rawVal, row) : rawVal;
      return escapeCsvValue(formattedVal);
    });
    lines.push(rowValues.join(';'));
  }

  return lines.join('\r\n');
}

/**
 * Dispara o download direto do arquivo CSV no navegador com suporte a caracteres PT-BR.
 */
export function exportToCsv<T>(payload: ExportPayload<T>, filename: string): void {
  const csvContent = generateCsvContent(payload);
  const safeFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

  // UTF-8 BOM (\uFEFF) é fundamental para Excel PT-BR reconhecer acentuação automaticamente
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
