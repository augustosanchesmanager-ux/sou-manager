export type EntityType =
  | 'products'
  | 'services'
  | 'clients'
  | 'financial_transactions'
  | 'recurring_bills'
  | 'bank_statement_lines';

export type ImportDirection = 'import' | 'export';
export type FileFormat = 'csv' | 'xlsx';
export type JobStatus =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'committing'
  | 'completed'
  | 'partial_completed'
  | 'failed'
  | 'cancelled';
export type RowStatus = 'pending' | 'valid' | 'invalid' | 'skipped';
export type ActionTaken = 'create' | 'update' | 'skip' | 'error';

export interface ColumnMapping {
  [csvColumn: string]: string;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date';
  min?: number;
  max?: number;
  minLength?: number;
  pattern?: string;
  required?: boolean;
}

export interface NormalizationRule {
  phone_br?: boolean;
  date_br?: boolean;
  currency_br?: boolean;
  percentage?: boolean;
  integer?: boolean;
  trim?: boolean;
  upper?: boolean;
  lower?: boolean;
  title_case?: boolean;
}

export interface ValidationRules {
  [fieldName: string]: ValidationRule;
}

export interface NormalizationRules {
  [fieldName: string]: NormalizationRule;
}

export interface ImportExportTemplate {
  id: string;
  tenant_id: string | null;
  app_slug: string;
  entity: EntityType;
  name: string;
  description: string | null;
  direction: ImportDirection | 'both';
  formats: FileFormat[];
  is_default: boolean;
  is_active: boolean;
  version: number;
  column_mapping: ColumnMapping;
  required_columns: string[];
  optional_columns: string[];
  validation_rules: ValidationRules | null;
  normalization_rules: NormalizationRules | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  app_slug: string;
  entity: EntityType;
  template_id: string | null;
  direction: ImportDirection;
  format: FileFormat;
  status: JobStatus;
  file_name: string | null;
  file_size: number | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  error_summary: Record<string, string[]>;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJobRow {
  id: string;
  job_id: string;
  row_number: number;
  status: RowStatus;
  action_taken: ActionTaken | null;
  original_data: Record<string, unknown>;
  normalized_data: Record<string, unknown> | null;
  errors: RowError[];
  warnings: RowWarning[];
  result_id: string | null;
  processed_at: string | null;
}

export interface RowError {
  field: string;
  message: string;
}

export interface RowWarning {
  field: string;
  message: string;
}

export interface ParsedRow {
  rowNumber: number;
  original: Record<string, string>;
  normalized: Record<string, unknown> | null;
  errors: RowError[];
  warnings: RowWarning[];
  status: RowStatus;
}

export interface ImportResult {
  success: boolean;
  jobId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: RowError[];
}

export interface EntityConfig {
  entity: EntityType;
  label: string;
  labelPlural: string;
  tableName: string;
  idField: string;
  requiredColumns: string[];
  optionalColumns: string[];
  columnMapping: ColumnMapping;
  validationRules: ValidationRules;
  normalizationRules: NormalizationRules;
  duplicateCheckFields: string[];
  defaultAction: 'create' | 'update' | 'skip';
}

export interface TemplateSelectProps {
  entity: EntityType;
  onSelect: (template: ImportExportTemplate | null) => void;
  filterDirection?: ImportDirection;
}

export interface ImportWizardProps {
  entity: EntityType;
  onComplete: (result: ImportResult) => void;
  onCancel: () => void;
  initialTemplate?: ImportExportTemplate | null;
}

export interface ExportOptions {
  entity: EntityType;
  format: FileFormat;
  filters?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  templateId?: string;
}