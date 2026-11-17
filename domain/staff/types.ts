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

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface StaffProfileDetails {
  nickname?: string | null;
  pix_key?: string | null;
  pix_type?: PixKeyType | null;
  bank?: string | null;
  fixed_salary?: number | null;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  address?: string | null;
  notes?: string | null;
  show_in_calendar?: boolean | null;
}

export type StaffDayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type StaffWorkingHours = {
  monday?: DayWorkingHours | null;
  tuesday?: DayWorkingHours | null;
  wednesday?: DayWorkingHours | null;
  thursday?: DayWorkingHours | null;
  friday?: DayWorkingHours | null;
  saturday?: DayWorkingHours | null;
  sunday?: DayWorkingHours | null;
  _profile?: StaffProfileDetails | null;
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
