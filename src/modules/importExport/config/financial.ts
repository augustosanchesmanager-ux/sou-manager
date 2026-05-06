import type { EntityConfig } from '../types';

export const financialTransactionsConfig: EntityConfig = {
  entity: 'financial_transactions',
  label: 'Lançamento Financeiro',
  labelPlural: 'Lançamentos Financeiros',
  tableName: 'transactions',
  idField: 'id',
  requiredColumns: ['Descrição', 'Tipo', 'Valor'],
  optionalColumns: [
    'Data',
    'Categoria',
    'Cliente',
    'Forma de Pagamento',
    'Notas',
  ],
  columnMapping: {
    'Descrição': 'description',
    'Tipo': 'type',
    'Valor': 'amount',
    'Data': 'date',
    'Categoria': 'category',
    'Cliente': 'client_id',
    'Forma de Pagamento': 'payment_method',
    'Notas': 'notes',
  },
  validationRules: {
    description: { type: 'string', minLength: 1, required: true },
    type: { type: 'string', pattern: '^(income|expense)$', required: true },
    amount: { type: 'number', required: true },
    date: { type: 'date' },
    payment_method: { type: 'string' },
  },
  normalizationRules: {
    description: { trim: true },
    type: { lower: true },
    amount: { currency_br: true },
    date: { date_br: true },
    notes: { trim: true },
  },
  duplicateCheckFields: ['description', 'date', 'amount'],
  defaultAction: 'create',
};