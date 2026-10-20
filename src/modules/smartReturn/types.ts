/**
 * Smart Return Module - Types
 * Categorização preditiva de inatividade, ciclo de retorno e retenção de clientes.
 */

export type SmartReturnInactivityStatus =
  | 'up_to_date' // No Prazo / Em Dia (< 20 dias)
  | 'attention'  // Janela de Retorno / Lembrete (20 a 35 dias)
  | 'risk'       // Em Risco / Churn (36 a 60 dias)
  | 'inactive';  // Inativo / Resgate (> 60 dias)

export type SmartReturnFilterTab = SmartReturnInactivityStatus | 'all';

export interface SmartReturnRecord {
  id: string; // client_id
  name: string;
  firstName: string;
  phone: string;
  rawPhone: string;
  isPhoneValid: boolean;
  avatar: string | null;
  email: string | null;
  lastVisitDate: string; // YYYY-MM-DD
  lastVisitFormatted: string; // DD/MM/YYYY
  lastVisitRaw: string | null;
  daysSinceLastVisit: number;
  lastStaffName: string | null;
  isClubMember: boolean;
  clubPlanName: string | null;
  status: SmartReturnInactivityStatus;
  statusLabel: string;
  hasUpcomingAppointment: boolean;
  whatsAppUrl: string | null;
  suggestedMessage: string;
}

export interface SmartReturnKPIs {
  totalClients: number;
  upToDate: number;  // No Prazo (< 20 dias)
  attention: number; // Janela de Retorno (20-35 dias)
  risk: number;      // Em Risco (36-60 dias)
  inactive: number;  // Inativo (> 60 dias)
}

export interface SmartReturnData {
  records: SmartReturnRecord[];
  kpis: SmartReturnKPIs;
  publicBookingUrl: string | null;
  shopName: string;
}

export interface FetchSmartReturnParams {
  tenantId: string;
  tenantSlug?: string;
  shopName?: string;
}
