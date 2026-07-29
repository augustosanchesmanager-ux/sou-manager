/**
 * [SMG][DOMAIN][STAFF] types
 *
 * Tipos centrais do domínio de equipe/staff.
 * Extraídos de pages/Team.tsx.
 */

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  commission_rate: number;
  status: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  commission_rate?: number;
  status?: string;
  avatar?: string;
}
