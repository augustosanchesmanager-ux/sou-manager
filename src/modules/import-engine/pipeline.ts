/**
 * [SMG][MODULE][IMPORT-ENGINE] pipeline
 *
 * Núcleo do Import Engine (P2_DESIGN_GATE.md §2):
 *   Parser → Normalização → Validação estrutural → Validação de domínio
 *          → Duplicidade → PREVIEW
 *
 * RESPONSABILIDADE:
 *   - buildImportPreview(): transforma um CSV bruto + ImportDefinition em um
 *     ImportPreview com todas as linhas classificadas (valid / duplicate /
 *     invalid), motivos por linha, erros estruturais de arquivo e avisos.
 *
 * NÃO FAZ:
 *   - Não persiste nada (persistência via RPC transacional — ver repository).
 *   - Não executa em banco (existingKeys é injetado pelo caller).
 *   - Não conhece React.
 *
 * GARANTIAS:
 *   - Determinístico e 100% testável.
 *   - Duplicidade é SEMPRE heurística: sinaliza candidata, nunca bloqueia
 *     (princípio 9) e nunca vira UNIQUE.
 *   - Erros estruturais de arquivo bloqueiam o preview (sem linhas), avisos não.
 */

import { normalizePhone, normalizeText, parseCsvText } from './csv';
import type {
  BuildImportPreviewInput,
  ColumnType,
  ImportColumn,
  ImportPreview,
  NormalizedRow,
  PreviewRow,
} from './types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza header para match (trim, lowercase, sem acento). */
const normalizeHeaderForMatch = (header: string): string =>
  normalizeText(header)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Validações de domínio por tipo (aplicadas após parse). */
const TYPE_VALIDATORS: Record<ColumnType, (value: string) => string | null> = {
  string: () => null,
  phone: (value) =>
    value && !/^\d{10,13}$/.test(value)
      ? 'Telefone deve conter 10 a 13 dígitos (DDD + número)'
      : null,
  email: (value) => (value && !EMAIL_REGEX.test(value) ? 'Email inválido' : null),
  // Data: parse (normalizeDate) já garante ISO válido ou '' — formato inválido
  // é capturado pela regra "raw não-vazio e parsed vazio" abaixo.
  date: () => null,
  number: (value) => (value && Number.isNaN(Number(value)) ? 'Número inválido' : null),
};

/** Mapeia headers do CSV → coluna canônica (primeiro match por alias). */
const buildColumnHeaderMap = (
  definitionHeaders: ImportColumn[],
  csvHeaders: string[],
): Map<string, string> => {
  const map = new Map<string, string>();
  const normalizedCsvHeaders = csvHeaders.map(normalizeHeaderForMatch);

  for (const column of definitionHeaders) {
    const candidates = [column.key, ...column.aliases].map(normalizeHeaderForMatch);
    const headerIndex = normalizedCsvHeaders.findIndex((header) =>
      candidates.includes(header),
    );
    if (headerIndex !== -1) {
      map.set(column.key, csvHeaders[headerIndex]);
    }
  }
  return map;
};

/** Valida uma linha bruta → valores normalizados + erros de domínio. */
const normalizeRow = (
  record: Record<string, string>,
  rowNumber: number,
  definitionColumns: ImportColumn[],
  columnHeaderMap: Map<string, string>,
): { row: NormalizedRow; errors: string[] } => {
  const values: Record<string, string> = {};
  const errors: string[] = [];

  for (const column of definitionColumns) {
    const header = columnHeaderMap.get(column.key);
    const raw = header ? (record[header] ?? '') : '';
    const wasRaw = raw.trim() !== '';

    const parsed = column.parse ? column.parse(raw) : normalizeText(raw);
    values[column.key] = parsed;

    if (column.required && raw.trim() === '') {
      errors.push(`${column.label} é obrigatório`);
      continue;
    }
    if (wasRaw && parsed === '') {
      errors.push(`${column.label} em formato inválido`);
      continue;
    }
    if (!wasRaw || parsed === '') continue;

    const typeError = TYPE_VALIDATORS[column.type](parsed);
    if (typeError) errors.push(typeError);
    for (const validate of column.validators ?? []) {
      const customError = validate(parsed);
      if (customError) errors.push(customError);
    }
  }

  return { row: { rowNumber, values }, errors };
};

/**
 * Executa o pipeline completo de preview (P2_DESIGN_GATE.md §2 / §10.1):
 * parse → normalização → validação estrutural → domínio → duplicidade.
 *
 * Regras de classificação (precedência):
 *   1. Inválida (erros de domínio) — mostra motivos.
 *   2. Duplicada (chave do duplicateStrategy em existingKeys ou no próprio
 *      arquivo) — sinalizada, NUNCA bloqueada (princípio 9).
 *   3. Válida — importável.
 *
 * Erros estruturais de arquivo (bytes/linhas/colunas excedidas, CSV vazio ou
 * coluna obrigatória ausente) bloqueiam o preview — rows fica vazio e apenas
 * fileErrors é populado. Avisos (colunas ignoradas, linhas malformadas) não.
 */
export function buildImportPreview(input: BuildImportPreviewInput): ImportPreview {
  const { definition, csvText, fileBytes, fileName = 'arquivo.csv', existingKeys } = input;
  const fileErrors: string[] = [];
  const warnings: string[] = [];

  const parseResult = parseCsvText(csvText, definition.limits, fileName);
  fileErrors.push(...parseResult.errors);
  warnings.push(...(parseResult.csv?.parseWarnings ?? []));

  const csv = parseResult.csv;
  const columnHeaderMap = csv ? buildColumnHeaderMap(definition.columns, csv.headers) : new Map<string, string>();

  if (csv) {
    const missingRequired = definition.columns
      .filter((column) => column.required && !columnHeaderMap.has(column.key))
      .map((column) => column.label);
    if (missingRequired.length > 0) {
      fileErrors.push(`Coluna(s) obrigatória(s) ausente(s): ${missingRequired.join(', ')}`);
    }

    const knownHeaders = new Set(definition.columns.flatMap((column) => [column.key, ...column.aliases].map(normalizeHeaderForMatch)));
    for (const header of csv.headers) {
      if (!knownHeaders.has(normalizeHeaderForMatch(header))) {
        warnings.push(`Coluna ignorada: "${header}"`);
      }
    }
  }

  if (fileErrors.length > 0 || !csv) {
    return {
      definition,
      fileName,
      fileBytes,
      totalRows: 0,
      rows: [],
      validRows: [],
      duplicateRows: [],
      invalidRows: [],
      fileErrors,
      warnings,
    };
  }

  // 1) Normalização + validação de domínio por linha.
  const normalizedRows: Array<{ row: NormalizedRow; errors: string[] }> = csv.rows.map(
    (record, index) => normalizeRow(record, index + 1, definition.columns, columnHeaderMap),
  );

  // 2) Detecção de duplicidade (heurística — princípio 9).
  const seenInFile = new Map<string, number>();
  const rows: PreviewRow[] = normalizedRows.map(({ row, errors }) => {
    let status: PreviewRow['status'] = errors.length > 0 ? 'invalid' : 'valid';
    let duplicateOf: string | undefined;

    const key = definition.duplicateStrategy.normalize(row);
    if (errors.length === 0 && key) {
      if (existingKeys?.has(key)) {
        status = 'duplicate';
        duplicateOf = `Já existe um cliente com ${definition.duplicateStrategy.key} igual`;
      } else if (seenInFile.has(key)) {
        status = 'duplicate';
        duplicateOf = `Duplicado na linha ${seenInFile.get(key)} (mesmo arquivo)`;
      } else {
        seenInFile.set(key, row.rowNumber);
      }
    }

    return { rowNumber: row.rowNumber, status, values: row.values, errors, ...(duplicateOf ? { duplicateOf } : {}) };
  });

  const validRows = rows.filter((row) => row.status === 'valid');
  const duplicateRows = rows.filter((row) => row.status === 'duplicate');
  const invalidRows = rows.filter((row) => row.status === 'invalid');

  return {
    definition,
    fileName,
    fileBytes,
    totalRows: rows.length,
    rows,
    validRows,
    duplicateRows,
    invalidRows,
    fileErrors,
    warnings,
  };
}

/** Chave de duplicidade por telefone (dígitos) — usada para existingKeys. */
export const phoneDuplicateKey = (phone: string): string => normalizePhone(phone);