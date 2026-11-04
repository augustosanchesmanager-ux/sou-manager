/**
 * [SMG][DOMAIN][CLIENT] types
 *
 * Tipos centrais do domínio de clientes.
 * Extraídos de pages/Clients.tsx.
 */

export type PreferredFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  last_visit: string;
  last_service: string;
  total_spent: number;
  status: string;
  avatar: string;
  birthday: string;
  notes?: string;
  preferred_frequency?: PreferredFrequency | null;
  preferred_weekday?: number | null;
  preferred_time?: string | null;
  preferred_staff_id?: string | null;
}

export interface CreateClientInput {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  notes?: string;
  preferred_frequency?: PreferredFrequency | null;
  preferred_weekday?: number | null;
  preferred_time?: string | null;
  preferred_staff_id?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  birthday?: string;
  notes?: string;
  preferred_frequency?: PreferredFrequency | null;
  preferred_weekday?: number | null;
  preferred_time?: string | null;
  preferred_staff_id?: string | null;
}

export interface ClientImportRow {
  rowNumber: number;
  name: string;
  phone: string;
  email: string;
  birthday: string;
}

export interface ImportJobResult {
  jobId: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
}

export interface OpenComandaSummary {
  id: string;
  total: number;
  status: 'open';
  created_at: string;
}
