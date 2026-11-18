/**
 * src/utils/export/types.ts
 *
 * Contratos de dados compartilhados para a infraestrutura de exportação
 * de relatórios e extratos (CSV e PDF).
 */

export interface ExportColumn<T = any> {
  header: string;
  key: keyof T | string;
  format?: (value: any, row: T) => string;
}

export interface ExportSummaryCard {
  label: string;
  value: string;
}

export interface ExportMetadata {
  title: string;
  tenantName: string;
  periodLabel: string;
  generatedAt: string;
  summaryCards?: ExportSummaryCard[];
}

export interface ExportPayload<T = any> {
  metadata: ExportMetadata;
  columns: ExportColumn<T>[];
  data: T[];
  orientation?: 'portrait' | 'landscape';
}
