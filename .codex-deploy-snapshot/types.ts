export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string;
  lastService: string;
  totalSpent: string;
  status: 'active' | 'inactive';
  avatar: string;
  birthday: string; // ISO date string YYYY-MM-DD
}

export interface KPI {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: string;
  color: string;
}

export interface Appointment {
  id: string;
  time: string;
  clientName: string;
  service: string;
  professional: string;
  status: 'confirmed' | 'pending' | 'completed';
}

export enum UserRole {
  ADMIN = 'Super Admin',
  MANAGER = 'Gerente',
  BARBER = 'Barbeiro',
  RECEPTIONIST = 'Recepcionista'
}