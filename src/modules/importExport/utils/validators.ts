import { z } from 'zod';
import type { EntityType, ParsedRow, ValidationRules, NormalizationRules, RowError } from '../types';
import { getEntityConfig } from '../config';

const phoneSchema = z.string().regex(/^(\+55)?[0-9]{10,13}$/, 'Telefone inválido');
const emailSchema = z.string().email('Email inválido').nullable().optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)').optional();
const positiveNumberSchema = z.number().min(0, 'Valor deve ser >= 0');
const percentageSchema = z.number().min(0).max(100, 'Percentual deve ser 0-100');
const positiveIntegerSchema = z.number().min(0, 'Valor deve ser >= 0').int('Valor deve ser inteiro');

function buildProductSchema(rules: ValidationRules) {
  return z.object({
    name: z.string().min(rules.name?.minLength ?? 2, 'Nome muito curto'),
    code: z.string().optional(),
    category: z.string().optional(),
    supplier: z.string().optional(),
    cost_price: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : v).pipe(positiveNumberSchema).optional(),
    sale_price: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : v).pipe(positiveNumberSchema),
    stock_quantity: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v.replace(/\D/g, ''), 10) || 0 : v).pipe(positiveIntegerSchema).optional(),
    minimum_stock: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v.replace(/\D/g, ''), 10) || 0 : v).pipe(positiveIntegerSchema).optional(),
    barcode: z.string().optional(),
    active: z.union([z.boolean(), z.string()]).transform(v => typeof v === 'string' ? !['false', 'nao', 'não', 'inativo', '0'].includes(v.toLowerCase()) : v).optional(),
    description: z.string().optional(),
  });
}

function buildServiceSchema(rules: ValidationRules) {
  return z.object({
    name: z.string().min(rules.name?.minLength ?? 2, 'Nome muito curto'),
    code: z.string().optional(),
    category: z.string().optional(),
    duration: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v, 10) || 0 : v).pipe(z.number().min(1, 'Duração deve ser > 0').max(480, 'Duração máxima 480 min')),
    price: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : v).pipe(positiveNumberSchema),
    commission: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace('%', '').trim()) / 100 || 0 : v).pipe(percentageSchema).optional(),
    active: z.union([z.boolean(), z.string()]).transform(v => typeof v === 'string' ? !['false', 'nao', 'não', 'inativo', '0'].includes(v.toLowerCase()) : v).optional(),
    description: z.string().optional(),
  });
}

function buildClientSchema(rules: ValidationRules) {
  return z.object({
    name: z.string().min(rules.name?.minLength ?? 2, 'Nome muito curto'),
    phone: z.string().min(10, 'Telefone muito curto').max(15, 'Telefone muito longo'),
    email: emailSchema,
    birthday: dateSchema.nullable().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    active: z.union([z.boolean(), z.string()]).transform(v => typeof v === 'string' ? !['false', 'nao', 'não', 'inativo', '0'].includes(v.toLowerCase()) : v).optional(),
  });
}

function buildGenericSchema(entity: EntityType) {
  switch (entity) {
    case 'products': return buildProductSchema({});
    case 'services': return buildServiceSchema({});
    case 'clients': return buildClientSchema({});
    default:
      return z.object({});
  }
}

export function getZodSchema(entity: EntityType, rules?: ValidationRules) {
  switch (entity) {
    case 'products':
      return buildProductSchema(rules ?? {});
    case 'services':
      return buildServiceSchema(rules ?? {});
    case 'clients':
      return buildClientSchema(rules ?? {});
    case 'financial_transactions':
      return z.object({
        description: z.string().min(1, 'Descrição é obrigatória'),
        type: z.enum(['income', 'expense']),
        amount: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : v).pipe(z.number().min(0, 'Valor deve ser >= 0')),
        date: dateSchema.optional(),
        category: z.string().optional(),
        payment_method: z.string().optional(),
        notes: z.string().optional(),
      });
    default:
      return z.object({});
  }
}

export function validateRow(
  row: Record<string, unknown>,
  entity: EntityType,
  rules?: ValidationRules,
): { success: boolean; data?: Record<string, unknown>; errors: RowError[] } {
  const schema = getZodSchema(entity, rules);

  const result = schema.safeParse(row);

  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown>, errors: [] };
  }

  const errors: RowError[] = result.error.issues.map(issue => ({
    field: String(issue.path[0] ?? 'unknown'),
    message: issue.message,
  }));

  return { success: false, errors };
}

export function validateParsedRows(
  rows: { rowNumber: number; data: Record<string, unknown> }[],
  entity: EntityType,
  rules?: ValidationRules,
): ParsedRow[] {
  const schema = getZodSchema(entity, rules);

  return rows.map(row => {
    const result = schema.safeParse(row.data);

    if (result.success) {
      return {
        rowNumber: row.rowNumber,
        original: row.data as Record<string, string>,
        normalized: result.data as Record<string, unknown>,
        errors: [],
        warnings: [],
        status: 'valid' as const,
      };
    }

    const errors: RowError[] = result.error.issues.map(issue => ({
      field: String(issue.path[0] ?? 'unknown'),
      message: issue.message,
    }));

    return {
      rowNumber: row.rowNumber,
      original: row.data as Record<string, string>,
      normalized: null,
      errors,
      warnings: [],
      status: 'invalid' as const,
    };
  });
}

export function checkRequiredColumns(
  headers: string[],
  requiredColumns: string[],
): { valid: boolean; missing: string[] } {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  const missing = requiredColumns.filter(col =>
    !normalizedHeaders.some(h => h === col.toLowerCase())
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function validateFileSize(sizeBytes: number, maxMB: number = 5): boolean {
  const maxBytes = maxMB * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

export function validateRowCount(rowCount: number, maxRows: number = 10000): boolean {
  return rowCount <= maxRows;
}