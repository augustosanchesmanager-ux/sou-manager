import type {
  ImportJob,
  ImportJobRow,
  ImportExportTemplate,
  EntityType,
  FileFormat,
} from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/import-export${path}`;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getTemplate(
  entity: EntityType,
  format: FileFormat,
): Promise<{ template: ImportExportTemplate; downloadUrl: string } | null> {
  return request<{ template: ImportExportTemplate; downloadUrl: string } | null>(
    `/${entity}/template?format=${format}`,
  );
}

export async function getTemplates(
  entity?: EntityType,
  appSlug?: string,
): Promise<ImportExportTemplate[]> {
  const params = new URLSearchParams();
  if (entity) params.set('entity', entity);
  if (appSlug) params.set('app_slug', appSlug);
  const query = params.toString();
  return request<ImportExportTemplate[]>(`/templates${query ? `?${query}` : ''}`);
}

export async function createTemplate(
  template: Omit<ImportExportTemplate, 'id' | 'created_at' | 'updated_at'>,
): Promise<ImportExportTemplate> {
  return request<ImportExportTemplate>('/templates', {
    method: 'POST',
    body: template,
  });
}

export async function updateTemplate(
  id: string,
  updates: Partial<ImportExportTemplate>,
): Promise<ImportExportTemplate> {
  return request<ImportExportTemplate>(`/templates/${id}`, {
    method: 'PUT',
    body: updates,
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await request<void>(`/templates/${id}`, { method: 'DELETE' });
}

export async function validateImport(
  entity: EntityType,
  jobId: string,
  rows: Record<string, unknown>[],
  templateId?: string,
): Promise<{ valid: number; invalid: number; errors: Record<string, string[]> }> {
  return request(`/${entity}/validate`, {
    method: 'POST',
    body: { jobId, rows, templateId },
  });
}

export async function commitImport(
  entity: EntityType,
  jobId: string,
  options?: {
    createStockMovements?: boolean;
    importOnlyValid?: boolean;
  },
): Promise<{
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}> {
  return request(`/${entity}/commit`, {
    method: 'POST',
    body: { jobId, ...options },
  });
}

export async function getJobs(
  entity?: EntityType,
  page: number = 1,
  limit: number = 20,
): Promise<{ jobs: ImportJob[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (entity) params.set('entity', entity);
  return request<{ jobs: ImportJob[]; total: number }>(`/jobs?${params.toString()}`);
}

export async function getJobById(jobId: string): Promise<ImportJob & { rows: ImportJobRow[] }> {
  return request<ImportJob & { rows: ImportJobRow[] }>(`/jobs/${jobId}`);
}

export async function cancelJob(jobId: string): Promise<void> {
  await request<void>(`/jobs/${jobId}/cancel`, { method: 'POST' });
}

export async function exportData(
  entity: EntityType,
  format: FileFormat,
  filters?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<{ downloadUrl: string }> {
  const params = new URLSearchParams({ format });
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  return request<{ downloadUrl: string }>(`/${entity}/export?${params.toString()}`);
}

export async function startImportJob(
  entity: EntityType,
  format: FileFormat,
  fileName: string,
  fileSize: number,
  totalRows: number,
  templateId?: string,
): Promise<ImportJob> {
  return request<ImportJob>('/jobs', {
    method: 'POST',
    body: {
      entity,
      format,
      direction: 'import',
      fileName,
      fileSize,
      totalRows,
      templateId,
    },
  });
}

export async function getAuditLogs(
  jobId?: string,
  entity?: EntityType,
): Promise<{
  id: string;
  job_id: string;
  tenant_id: string;
  app_slug: string;
  entity: string;
  action: string;
  actor_id: string;
  details: Record<string, unknown>;
  created_at: string;
}[]> {
  const params = new URLSearchParams();
  if (jobId) params.set('job_id', jobId);
  if (entity) params.set('entity', entity);
  const query = params.toString();
  return request<[]>('/audit-logs' + (query ? `?${query}` : ''));
}