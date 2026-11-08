/**
 * Smart Return Module - Types
 * Categorização preditiva de inatividade, ciclo de retorno, RFM e retenção de clientes.
 */

export type SmartReturnInactivityStatus =
  | 'up_to_date' // No Prazo / Em Dia (< 20 dias)
  | 'attention'  // Janela de Retorno / Lembrete (20 a 35 dias)
  | 'risk'       // Em Risco / Churn (36 a 60 dias)
  | 'inactive';  // Inativo / Resgate (> 60 dias)

export type RfmSegment =
  | 'champion'    // VIP / Campeão (alta frequência e alto valor)
  | 'loyal'       // Cliente Leal (frequência regular)
  | 'promising'   // Promissor (recente, 1 ou 2 visitas)
  | 'at_risk'     // Risco de Churn (habitual que se afastou)
  | 'hibernating'; // Hibernando (> 60 dias sem visita)

export type SmartReturnFilterTab = SmartReturnInactivityStatus | RfmSegment | 'all';

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
  totalVisits: number;
  totalSpent: number;
  avgTicket: number;
  rfmSegment: RfmSegment;
  rfmSegmentLabel: string;
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
  championsCount: number; // Total de clientes VIP / Campeões
  atRiskRevenue: number;  // Faturamento estimado em risco com clientes inativos/em risco
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
