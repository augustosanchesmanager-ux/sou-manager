import type { EntityType, EntityConfig, ImportExportTemplate } from '../types';
import { productsConfig } from './products';
import { servicesConfig } from './services';
import { clientsConfig } from './clients';
import { financialTransactionsConfig } from './financial';

export const entityConfigs: Record<EntityType, EntityConfig> = {
  products: productsConfig,
  services: servicesConfig,
  clients: clientsConfig,
  financial_transactions: financialTransactionsConfig,
  recurring_bills: {
    entity: 'recurring_bills',
    label: 'Conta Fixa',
    labelPlural: 'Contas Fixas',
    tableName: 'recurring_bills',
    idField: 'id',
    requiredColumns: ['Nome', 'Valor', 'Vencimento'],
    optionalColumns: ['Categoria', 'Dia do Vencimento', 'Ativo'],
    columnMapping: {
      'Nome': 'name',
      'Valor': 'amount',
      'Vencimento': 'due_date',
      'Categoria': 'category',
      'Dia do Vencimento': 'due_day',
      'Ativo': 'active',
    },
    validationRules: {
      name: { type: 'string', minLength: 1, required: true },
      amount: { type: 'number', min: 0, required: true },
      due_day: { type: 'integer', min: 1, max: 31 },
      active: { type: 'boolean' },
    },
    normalizationRules: {
      name: { trim: true },
      amount: { currency_br: true },
      due_day: { integer: true },
    },
    duplicateCheckFields: ['name', 'due_day'],
    defaultAction: 'create',
  },
  bank_statement_lines: {
    entity: 'bank_statement_lines',
    label: 'Linha de Extrato',
    labelPlural: 'Linhas de Extrato',
    tableName: 'bank_statement_staging',
    idField: 'id',
    requiredColumns: ['Data', 'Descrição', 'Valor'],
    optionalColumns: ['Tipo', 'Categoria', 'Conciliado'],
    columnMapping: {
      'Data': 'date',
      'Descrição': 'description',
      'Valor': 'amount',
      'Tipo': 'type',
      'Categoria': 'category',
      'Conciliado': 'conciliated',
    },
    validationRules: {
      date: { type: 'date', required: true },
      description: { type: 'string', minLength: 1, required: true },
      amount: { type: 'number', required: true },
      type: { type: 'string', pattern: '^(credit|debit)$' },
      conciliated: { type: 'boolean' },
    },
    normalizationRules: {
      date: { date_br: true },
      description: { trim: true },
      amount: { currency_br: true },
      type: { lower: true },
    },
    duplicateCheckFields: ['date', 'description', 'amount'],
    defaultAction: 'create',
  },
};

export function getEntityConfig(entity: EntityType): EntityConfig {
  return entityConfigs[entity];
}

export function getEntityLabel(entity: EntityType): string {
  return entityConfigs[entity]?.label ?? entity;
}

export function getEntityLabelPlural(entity: EntityType): string {
  return entityConfigs[entity]?.labelPlural ?? entity;
}

export function getImportableEntities(): EntityType[] {
  return ['products', 'services', 'clients'];
}

export function getExportableEntities(): EntityType[] {
  return ['products', 'services', 'clients'];
}

export function applyTemplateMapping(
  headers: string[],
  template: ImportExportTemplate,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const templateMapping = template.column_mapping;

  for (const header of headers) {
    if (templateMapping[header]) {
      mapping[header] = templateMapping[header];
    } else {
      for (const [csvCol, entityField] of Object.entries(templateMapping)) {
        if (csvCol.toLowerCase() === header.toLowerCase()) {
          mapping[header] = entityField as string;
          break;
        }
      }
    }
  }

  return mapping;
}

export function detectColumnMapping(
  headers: string[],
  entity: EntityType,
): Record<string, string> {
  const config = getEntityConfig(entity);
  const mapping: Record<string, string> = {};
  const configMapping = config.columnMapping;

  for (const header of headers) {
    const normalizedHeader = header.trim().toLowerCase();

    if (configMapping[header]) {
      mapping[header] = configMapping[header];
      continue;
    }

    for (const [csvCol, entityField] of Object.entries(configMapping)) {
      if (csvCol.toLowerCase() === normalizedHeader ||
          entityField.toLowerCase() === normalizedHeader) {
        mapping[header] = entityField;
        break;
      }
    }
  }

  return mapping;
}

export { productsConfig, servicesConfig, clientsConfig, financialTransactionsConfig };
export type { EntityConfig } from '../types';