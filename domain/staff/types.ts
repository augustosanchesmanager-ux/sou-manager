/**
 * [SMG][DOMAIN][STAFF] types
 *
 * Tipos centrais do domínio de equipe/staff.
 * Extraídos de pages/Team.tsx.
 */

export interface DayWorkingHours {
  open: string;
  close: string;
  break_start?: string | null;
  break_end?: string | null;
}

export type StaffWorkingHours = {
  monday?: DayWorkingHours | null;
  tuesday?: DayWorkingHours | null;
  wednesday?: DayWorkingHours | null;
  thursday?: DayWorkingHours | null;
  friday?: DayWorkingHours | null;
  saturday?: DayWorkingHours | null;
  sunday?: DayWorkingHours | null;
} | null;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  commission_rate: number;
  product_commission_rate?: number;
  status: string;
  working_hours?: StaffWorkingHours;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  commission_rate?: number;
  product_commission_rate?: number;
  status?: string;
  avatar?: string;
  working_hours?: StaffWorkingHours;
}
