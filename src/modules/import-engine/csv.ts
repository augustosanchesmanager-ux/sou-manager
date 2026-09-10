/**
 * [SMG][MODULE][IMPORT-ENGINE] csv
 *
 * Camada Parser + Normalização do pipeline (P2_DESIGN_GATE.md §2):
 *   arquivo externo → Parser (Papa.parse normalizado — nunca confiar em MIME/header)
 *                    → Normalização (encoding/BOM, colunas tolerantes, datas pt-BR, números)
 *
 * RESPONSABILIDADE:
 *   - Ler texto CSV e devolver linhas brutas tipadas (Record<string, string>).
 *   - Normalizar valores: BOM, whitespace, telefone (dígitos), email (lowercase),
 *     data pt-BR (dd/mm/aaaa → aaaa-mm-dd).
 *   - Aplicar limites estruturais de bytes/linhas informados pelo caller.
 *
 * NÃO FAZ:
 *   - Não valida domínio (regras de tenant) — ver pipeline.ts
 *   - Não detecta duplicidade — ver pipeline.ts
 *   - Não persiste nada
 *
 * GARANTIAS:
 *   - Determinístico e 100% testável (sem I/O, sem dependência de banco).
 */

import * as Papa from 'papaparse';

/** BOM UTF-8 — removido do início do arquivo antes do parse. */
const UTF8_BOM = '\uFEFF';

export interface ParsedCsv {
  /** Headers detectados (trim + remoção de BOM). */
  headers: string[];
  /** Linhas de dados — cada célula é Record<header, valor bruto>. */
  rows: Array<Record<string, string>>;
  /** Avisos do Papa (linhas malformadas, etc.). */
  parseWarnings: string[];
}

export interface CsvParseLimits {
  maxRows: number;
  maxFileBytes: number;
  maxColumns: number;
}

export interface CsvParseResult {
  /** CSV parseado com sucesso (quando errors vazio). */
  csv: ParsedCsv | null;
  /** Erros estruturais de arquivo (tamanho, linhas, colunas, formato). */
  errors: string[];
}

const normalizeHeaderName = (raw: string): string => raw.trim();

const formatRowError = (rowIndex: number, message: string): string =>
  `Linha ${rowIndex}: ${message}`;

/**
 * Lê e valida o conteúdo de um arquivo CSV (entrada não confiável).
 *
 * Regras (gate §10.1 princípios 1 e 2):
 *  - Nunca confiar em MIME/header — validar o conteúdo real.
 *  - Limites de bytes/linhas/colunas aplicados aqui (estruturais).
 *  - Linhas vazias são ignoradas (skipEmptyLines greedy).
 */
export function parseCsvText(
  text: string,
  limits: CsvParseLimits,
  fileName = 'arquivo.csv',
): CsvParseResult {
  const errors: string[] = [];

  const bytes = new Blob([text]).size;
  if (bytes > limits.maxFileBytes) {
    errors.push(
      `Arquivo excede o limite de ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB (${fileName}, ${bytes} bytes).`,
    );
  }

  const cleanText = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeaderName,
  });

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data ?? [];

  if (rows.length === 0 || headers.length === 0) {
    errors.push('Arquivo vazio ou sem cabeçalho válido. Use o template clientes_v1.csv.');
    return { csv: null, errors };
  }

  if (headers.length > limits.maxColumns) {
    errors.push(
      `Arquivo possui ${headers.length} colunas — limite é ${limits.maxColumns}. Remova colunas extras e tente novamente.`,
    );
  }

  if (rows.length > limits.maxRows) {
    errors.push(
      `Arquivo possui ${rows.length} linhas de dados — limite é ${limits.maxRows}. Divida o arquivo.`,
    );
  }

  const parseWarnings: string[] = (parsed.errors ?? [])
    .filter((err) => err.type === 'FieldMismatch' || err.type === 'Delimiter')
    .map((err) => formatRowError((err.row ?? 0) + 2, err.message));

  return {
    csv: { headers, rows, parseWarnings },
    errors,
  };
}

/** Normaliza texto livre: trim + colapsa espaços/quebras múltiplos. */
export const normalizeText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

/** Normaliza telefone: apenas dígitos (aceita DDI 55 e DDD). */
export const normalizePhone = (value: string): string =>
  value.replace(/\D/g, '').trim();

/** Normaliza email: trim + lowercase. */
export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();

/**
 * Normaliza data:
 *  - pt-BR (dd/mm/aaaa ou d/m/aaaa ou com separador - ou .) → aaaa-mm-dd
 *  - ISO (aaaa-mm-dd) já normalizada → validada e mantida
 * Retorna '' se inválida (validação de domínio acontece no pipeline).
 */
export const normalizeDate = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isValidIsoDate(raw) ? raw : '';
  }

  const match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return '';

  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : '';
};

const isValidIsoDate = (iso: string): boolean => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const parts = iso.split('-').map(Number);
  return (
    date.getUTCFullYear() === parts[0] &&
    date.getUTCMonth() + 1 === parts[1] &&
    date.getUTCDate() === parts[2]
  );
};

/** Normaliza número pt-BR ("1.234,56" → "1234.56"). Retorna '' se vazio. */
export const normalizeNumber = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  return Number.isNaN(Number(normalized)) ? '' : String(Number(normalized));
};