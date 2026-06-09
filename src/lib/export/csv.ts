const CSV_SEPARATOR = ';';
const UTF8_BOM = '\uFEFF';

export type CsvCell = string | number | boolean | null | undefined;

export interface DownloadCsvParams {
  filenameBase: string;
  headers: CsvCell[];
  rows: CsvCell[][];
  date?: Date;
}

export const escapeCsvCell = (value: CsvCell): string => {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

export const buildDatedCsvFilename = (filenameBase: string, date = new Date()): string => {
  const safeBase = filenameBase
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'exportacao';

  return `${safeBase}-${date.toISOString().slice(0, 10)}.csv`;
};

export const buildCsvContent = (headers: CsvCell[], rows: CsvCell[][]): string => {
  const lines = [
    headers.map(escapeCsvCell).join(CSV_SEPARATOR),
    ...rows.map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR)),
  ];

  return `${UTF8_BOM}${lines.join('\n')}`;
};

export const downloadCsv = ({ filenameBase, headers, rows, date }: DownloadCsvParams): void => {
  const blob = new Blob([buildCsvContent(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', buildDatedCsvFilename(filenameBase, date));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
