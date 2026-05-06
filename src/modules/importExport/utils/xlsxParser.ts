import type { ColumnMapping, FileFormat } from '../types';
import * as XLSX from 'xlsx';

export function generateCSVTemplate(
  headers: string[],
  filename: string,
): string {
  const csvRows = headers.map(header => header);
  const csvContent = [headers.join(','), ...csvRows.map(h => `"${h}"`)].join('\n');

  return csvContent;
}

export function downloadCSVTemplate(
  headers: string[],
  filename: string,
): void {
  const content = generateCSVTemplate(headers, filename);
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function downloadXLSXTemplate(
  headers: string[],
  sheetData: string[][],
  filename: string,
): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as unknown as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });

  downloadBlob(blob, filename);
}

export function generateXLSX(
  data: Record<string, unknown>[],
  headers: string[],
  columnMapping: Record<string, string>,
  filename: string,
): void {
  const reversedMapping: Record<string, string> = {};
  for (const [csvCol, entityField] of Object.entries(columnMapping)) {
    reversedMapping[entityField] = csvCol;
  }

  const csvHeaders = headers.length > 0 ? headers : Object.keys(reversedMapping);

  const sheetData = data.map(row => {
    return csvHeaders.map(header => {
      const entityField = reversedMapping[header] ?? header;
      const value = row[entityField];
      return formatXLSXValue(value);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet([csvHeaders, ...sheetData]);

  for (let i = 0; i < csvHeaders.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].t = 's';
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as unknown as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });

  downloadBlob(blob, filename);
}

export function parseXLSX(file: File): Promise<{ headers: string[]; rows: { rowNumber: number; data: Record<string, string> }[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
          defval: '',
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const headers = Object.keys(jsonData[0]);

        const rows = jsonData.map((row, index) => ({
          rowNumber: index + 2,
          data: row,
        }));

        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read XLSX file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function formatXLSXValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToXLSX(
  data: Record<string, unknown>[],
  filename: string,
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const sheetData = data.map(row =>
    headers.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      return String(val);
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');

  XLSX.writeFile(wb, filename);
}