/**
 * [SMG][DOMAIN][CLIENT] types
 *
 * Tipos centrais do domínio de clientes.
 * Extraídos de pages/Clients.tsx.
 */

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
}

export interface CreateClientInput {
  name: string;
  email: string;
  phone: string;
  birthday: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  birthday?: string;
}

export interface OpenComandaSummary {
  id: string;
  total: number;
  status: 'open';
  created_at: string;
}
