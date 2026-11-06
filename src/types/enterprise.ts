/**
 * Tipos de Recursos Enterprise: Trilho Forense Corporativo e Portabilidade LGPD (Subfase 8.10)
 * Referência: ADR-043 (ACCEPTED)
 */

export type AuditCategory =
  | 'security'
  | 'financial'
  | 'compliance_lgpd'
  | 'operational'
  | 'system';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type ExportType =
  | 'customers_lgpd'
  | 'financial_ledger'
  | 'appointments_history'
  | 'full_backup';

export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export interface EnterpriseAuditLog {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  resource_type: string;
  resource_id?: string | null;
  details: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface EnterpriseDataExport {
  id: string;
  tenant_id: string;
  requested_by: string;
  export_type: ExportType;
  status: ExportStatus;
  record_count: number;
  file_url?: string | null;
  file_checksum_sha256?: string | null;
  expires_at: string;
  created_at: string;
  completed_at?: string | null;
}

export interface RecordAuditLogInput {
  tenant_id?: string;
  action: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  resource_type?: string;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  actor_email?: string | null;
  actor_role?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface RequestExportInput {
  tenant_id?: string;
  export_type: ExportType;
  expires_days?: number;
}

export interface RequestExportResult {
  success: boolean;
  export_id: string;
  status: ExportStatus;
  export_type: ExportType;
  expires_at: string;
}

export interface AuditLogFilters {
  category?: AuditCategory;
  severity?: AuditSeverity;
  action?: string;
  resource_type?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface PaginatedAuditLogsResult {
  data: EnterpriseAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
