import Papa from 'papaparse';
import type { ParsedRow, RowError, NormalizationRules, ColumnMapping } from '../types';
import { parseBrazilianCurrency, parseBrazilianDate, normalizePhoneBR, parsePercentage, parseInteger, toTitleCase, normalizeBoolean } from './normalizers';

export interface ParseOptions {
  delimiter?: ',' | ';';
  header?: boolean;
  skipEmptyLines?: boolean;
}

export interface ParseResult {
  headers: string[];
  rows: { rowNumber: number; data: Record<string, string> }[];
  errors: { rowNumber: number; message: string }[];
  delimiterDetected: ',' | ';';
}

export function detectDelimiter(sample: string): ',' | ';' {
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

export function parseCSV(
  fileContent: string,
  options: ParseOptions = {},
): ParseResult {
  const delimiter = options.delimiter ?? detectDelimiter(fileContent.slice(0, 1024));

  const result = Papa.parse(fileContent, {
    delimiter,
    header: options.header ?? true,
    skipEmptyLines: options.skipEmptyLines ?? true,
    transformHeader: (header: string) => header.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows: { rowNumber: number; data: Record<string, string> }[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  let rowNumber = 1;
  for (const record of result.data as Record<string, string>[]) {
    rowNumber++;
    if (Object.values(record).every(v => !v || v.trim() === '')) {
      continue;
    }
    rows.push({ rowNumber, data: record });
  }

  if (result.errors.length > 0) {
    for (const err of result.errors.slice(0, 10)) {
      errors.push({
        rowNumber: err.row ?? 0,
        message: err.message,
      });
    }
  }

  return { headers, rows, errors, delimiterDetected: delimiter };
}

export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = parseCSV(content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

export function applyNormalization(
  row: Record<string, string>,
  mapping: ColumnMapping,
  normalizationRules: NormalizationRules | null,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [csvColumn, entityField] of Object.entries(mapping)) {
    const rawValue = row[csvColumn] ?? '';
    let value: unknown = rawValue;

    if (normalizationRules && normalizationRules[entityField]) {
      const rules = normalizationRules[entityField];

      if (rules.phone_br) {
        value = normalizePhoneBR(rawValue);
      } else if (rules.date_br) {
        value = parseBrazilianDate(rawValue);
      } else if (rules.currency_br) {
        value = parseBrazilianCurrency(rawValue);
      } else if (rules.percentage) {
        value = parsePercentage(rawValue);
      } else if (rules.integer) {
        value = parseInteger(rawValue);
      } else if (rules.title_case && typeof value === 'string') {
        value = toTitleCase(rawValue);
      } else if (rules.lower && typeof value === 'string') {
        value = rawValue.toLowerCase();
      } else if (rules.upper && typeof value === 'string') {
        value = rawValue.toUpperCase();
      } else if (rules.trim) {
        value = rawValue.trim();
      } else if (typeof value === 'string') {
        value = rawValue.trim();
      } else {
        value = rawValue;
      }
    } else {
      value = rawValue.trim();
    }

    normalized[entityField] = value;
  }

  return normalized;
}

export function validateNormalizedRow(
  normalized: Record<string, unknown>,
  requiredFields: string[],
): RowError[] {
  const errors: RowError[] = [];

  for (const field of requiredFields) {
    const value = normalized[field];
    if (value === undefined || value === null || value === '') {
      errors.push({ field, message: `Campo obrigatório: ${field}` });
    }
  }

  return errors;
}

export function mapAndValidateRows(
  rows: { rowNumber: number; data: Record<string, string> }[],
  mapping: ColumnMapping,
  normalizationRules: NormalizationRules | null,
  requiredFields: string[],
): ParsedRow[] {
  return rows.map(({ rowNumber, data }) => {
    const normalized = applyNormalization(data, mapping, normalizationRules);
    const validationErrors = validateNormalizedRow(normalized, requiredFields);

    return {
      rowNumber,
      original: data,
      normalized: validationErrors.length === 0 ? normalized : null,
      errors: validationErrors,
      warnings: [],
      status: validationErrors.length === 0 ? 'valid' : 'invalid',
    };
  });
}

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return String(value);
}

export function generateCSVContent(
  headers: string[],
  rows: Record<string, unknown>[],
  columnMapping: Record<string, string>,
): string {
  const reversedMapping: Record<string, string> = {};
  for (const [csvCol, entityField] of Object.entries(columnMapping)) {
    reversedMapping[entityField] = csvCol;
  }

  const csvHeaders = headers.length > 0 ? headers : Object.keys(reversedMapping);

  const csvRows = rows.map(row => {
    return csvHeaders.map(header => {
      const entityField = reversedMapping[header] ?? header;
      const value = row[entityField];
      return formatCSVValue(value);
    });
  });

  return Papa.unparse({ fields: csvHeaders, data: csvRows });
}

export function generateErrorCSV(rows: ParsedRow[]): string {
  const data = rows
    .filter(r => r.errors.length > 0)
    .map(r => ({
      Linha: r.rowNumber,
      'Dados Originais': JSON.stringify(r.original),
      Erros: r.errors.map(e => `${e.field}: ${e.message}`).join('; '),
    }));

  return Papa.unparse(data);
}

export function generateCSVTemplate(
  headers: string[],
  _filename: string,
): string {
  return headers.join(',');
}