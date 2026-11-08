/**
 * Smart Return Module - Service
 * Desacoplamento da camada de dados para o Motor de Retorno Inteligente e Segmentação RFM.
 * Elimina chamadas .from() diretas na UI e encapsula as regras de inatividade, recall e RFM.
 */

import { getClientForTable } from '../../../services/supabaseClient';
import { normalizePhone } from '../../lib/utils/phone';
import type {
  FetchSmartReturnParams,
  RfmSegment,
  SmartReturnData,
  SmartReturnInactivityStatus,
  SmartReturnKPIs,
  SmartReturnRecord,
} from './types';

// Helper de formatação YYYY-MM-DD em horário local (evita bug de timezone)
const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatLocalBR = (d: string | null): string => {
  if (!d) return 'Sem visitas';
  const parts = d.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return d;
};

// Calcula a diferença em dias entre duas datas baseadas em meia-noite local
const getDaysDifference = (targetDate: Date, referenceDate: Date = new Date()): number => {
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffMs = refMidnight.getTime() - targetMidnight.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

// Determina o status com base na régua de inatividade
export const determineInactivityStatus = (
  days: number,
): { status: SmartReturnInactivityStatus; label: string } => {
  if (days < 20) {
    return { status: 'up_to_date', label: 'No Prazo' };
  }
  if (days <= 35) {
    return { status: 'attention', label: 'Janela de Retorno' };
  }
  if (days <= 60) {
    return { status: 'risk', label: 'Em Risco' };
  }
  return { status: 'inactive', label: 'Inativo' };
};

// Determina a segmentação RFM (Recência, Frequência e Valor)
export const determineRfmSegment = (
  days: number,
  visits: number,
  spent: number,
): { segment: RfmSegment; label: string } => {
  // Clientes com alto gasto e visitas frequentes
  if (visits >= 4 && spent >= 200) {
    if (days <= 35) {
      return { segment: 'champion', label: 'VIP / Campeão' };
    }
    return { segment: 'at_risk', label: 'VIP em Risco' };
  }
  if (visits >= 2 && days <= 35) {
    return { segment: 'loyal', label: 'Cliente Leal' };
  }
  if (visits <= 2 && days <= 20) {
    return { segment: 'promising', label: 'Promissor' };
  }
  if (days > 60) {
    return { segment: 'hibernating', label: 'Hibernando' };
  }
  return { segment: 'at_risk', label: 'Em Risco' };
};

export const fetchSmartReturnData = async (
  params: FetchSmartReturnParams,
): Promise<SmartReturnData> => {
  const { tenantId, tenantSlug } = params;
  const shopName = params.shopName?.trim() || 'Barbearia';

  if (!tenantId) {
    return {
      records: [],
      kpis: {
        totalClients: 0,
        upToDate: 0,
        attention: 0,
        risk: 0,
        inactive: 0,
        championsCount: 0,
        atRiskRevenue: 0,
      },
      publicBookingUrl: null,
      shopName,
    };
  }

  const clientsClient = getClientForTable('clients');
  const appointmentsClient = getClientForTable('appointments');
  const comandasClient = getClientForTable('comandas');
  const subsClient = getClientForTable('customer_subscriptions');
  const settingsClient = getClientForTable('tenant_settings');
  const now = new Date();
  const todayStartStr = `${formatLocalYMD(now)}T00:00:00-03:00`;

  // 1. Consultas paralelas isoladas por tenant_id
  const [
    clientsRes,
    appointmentsRes,
    comandasRes,
    upcomingRes,
    subsRes,
    settingsRes,
  ] = await Promise.all([
    clientsClient
      .from('clients')
      .select('id, name, phone, email, avatar, last_visit, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    appointmentsClient
      .from('appointments')
      .select('id, client_id, start_time, status, staff:staff_id(id, name)')
      .eq('tenant_id', tenantId)
      .in('status', ['completed', 'confirmed', 'attended', 'paid'])
      .order('start_time', { ascending: false }),
    comandasClient
      .from('comandas')
      .select('id, client_id, closed_at, status, total')
      .eq('tenant_id', tenantId)
      .in('status', ['paid', 'closed'])
      .order('closed_at', { ascending: false }),
    appointmentsClient
      .from('appointments')
      .select('client_id, start_time')
      .eq('tenant_id', tenantId)
      .gte('start_time', todayStartStr)
      .in('status', ['pending', 'confirmed', 'scheduled']),
    subsClient
      .from('customer_subscriptions')
      .select('client_id, status, plan:plan_id(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trial']),
    settingsClient
      .from('tenant_settings')
      .select('booking_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  const rawClients = (clientsRes.data || []) as any[];
  const rawAppointments = (appointmentsRes.data || []) as any[];
  const rawComandas = (comandasRes.data || []) as any[];
  const rawUpcoming = (upcomingRes.data || []) as any[];
  const rawSubs = (subsRes.data || []) as any[];
  const bookingEnabled = Boolean(settingsRes.data?.booking_enabled);

  // URL da vitrine pública de agendamento (se habilitada)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicBookingUrl = (bookingEnabled && tenantSlug)
    ? `${baseUrl}/#/agendar/${tenantSlug}`
    : null;

  // Set de clientes com agendamento futuro
  const upcomingClientIds = new Set<string>(
    rawUpcoming.map((a: any) => a.client_id).filter(Boolean),
  );

  // Mapa de assinaturas ativas do Clube dos Chefes
  const clubSubMap = new Map<string, string | null>();
  rawSubs.forEach((sub: any) => {
    if (sub.client_id) {
      const planName = sub.plan?.name || 'Membro do Clube';
      clubSubMap.set(sub.client_id, planName);
    }
  });

  // Mapa da última visita por cliente (considerando appointments e comandas)
  const clientVisitMap = new Map<
    string,
    { date: Date; staffName: string | null; raw: string }
  >();

  // Processar agendamentos passados
  rawAppointments.forEach((apt: any) => {
    if (!apt.client_id || !apt.start_time) return;
    const aptDate = new Date(apt.start_time);
    if (isNaN(aptDate.getTime())) return;

    const existing = clientVisitMap.get(apt.client_id);
    if (!existing || aptDate > existing.date) {
      const staffName = apt.staff?.name || null;
      clientVisitMap.set(apt.client_id, {
        date: aptDate,
        staffName,
        raw: apt.start_time,
      });
    }
  });

  // Processar comandas fechadas
  rawComandas.forEach((cmd: any) => {
    if (!cmd.client_id || !cmd.closed_at) return;
    const cmdDate = new Date(cmd.closed_at);
    if (isNaN(cmdDate.getTime())) return;

    const existing = clientVisitMap.get(cmd.client_id);
    if (!existing || cmdDate > existing.date) {
      clientVisitMap.set(cmd.client_id, {
        date: cmdDate,
        staffName: existing?.staffName || null,
        raw: cmd.closed_at,
      });
    }
  });

  // Mapa agregado de métricas RFM (Frequência e Valor Monetário)
  const clientRfmMap = new Map<string, { visitsCount: number; totalSpent: number }>();

  rawAppointments.forEach((apt: any) => {
    if (!apt.client_id) return;
    const cur = clientRfmMap.get(apt.client_id) || { visitsCount: 0, totalSpent: 0 };
    cur.visitsCount += 1;
    clientRfmMap.set(apt.client_id, cur);
  });

  rawComandas.forEach((cmd: any) => {
    if (!cmd.client_id) return;
    const cur = clientRfmMap.get(cmd.client_id) || { visitsCount: 0, totalSpent: 0 };
    const val = Number(cmd.total) || 0;
    cur.totalSpent += val;
    if (!rawAppointments.some((a: any) => a.client_id === cmd.client_id)) {
      cur.visitsCount += 1;
    }
    clientRfmMap.set(cmd.client_id, cur);
  });

  // 2. Construção dos registros enriquecidos
  const records: SmartReturnRecord[] = rawClients.map((client: any) => {
    const clientId = client.id;
    const visitInfo = clientVisitMap.get(clientId);

    let visitDate: Date;
    let visitRaw: string | null = null;

    if (visitInfo) {
      visitDate = visitInfo.date;
      visitRaw = visitInfo.raw;
    } else if (client.last_visit) {
      visitDate = new Date(client.last_visit);
      visitRaw = client.last_visit;
    } else if (client.created_at) {
      visitDate = new Date(client.created_at);
      visitRaw = client.created_at;
    } else {
      visitDate = new Date(now.getTime() - 90 * 86400000);
    }

    const daysSinceLastVisit = getDaysDifference(visitDate, now);
    const { status, label: statusLabel } = determineInactivityStatus(daysSinceLastVisit);

    const rfmStats = clientRfmMap.get(clientId) || { visitsCount: 0, totalSpent: 0 };
    const totalVisits = Math.max(1, rfmStats.visitsCount);
    const totalSpent = Math.round(rfmStats.totalSpent * 100) / 100;
    const avgTicket = totalVisits > 0 ? Math.round((totalSpent / totalVisits) * 100) / 100 : 0;
    const { segment: rfmSegment, label: rfmSegmentLabel } = determineRfmSegment(
      daysSinceLastVisit,
      totalVisits,
      totalSpent,
    );

    const rawPhone = client.phone || '';
    const { digits, isValid: isPhoneValid } = normalizePhone(rawPhone);
    const firstName = client.name ? client.name.trim().split(' ')[0] : 'Cliente';

    // Construção da mensagem sugerida de WhatsApp
    const bookingNotice = publicBookingUrl
      ? ` Você também pode agendar online por aqui: ${publicBookingUrl}`
      : '';

    let suggestedMessage = '';
    if (rfmSegment === 'champion') {
      suggestedMessage = `Fala, ${firstName}! Você é um dos nossos clientes mais especiais aqui na ${shopName}. Já faz ${daysSinceLastVisit} dias desde seu último corte. Quer garantir sua cadeira nessa semana com horário reservado?${bookingNotice}`;
    } else if (status === 'attention') {
      suggestedMessage = `Olá, ${firstName}! Aqui é da ${shopName}. Já faz ${daysSinceLastVisit} dias desde seu último atendimento. Que tal garantir seu horário para essa semana?${bookingNotice}`;
    } else if (status === 'risk') {
      suggestedMessage = `Olá, ${firstName}! Sentimos sua falta aqui na ${shopName}. Seu último corte foi há ${daysSinceLastVisit} dias. Vamos renovar o visual?${bookingNotice}`;
    } else if (status === 'inactive') {
      suggestedMessage = `Olá, ${firstName}! Faz um tempo que você não nos visita na ${shopName}. Preparamos um atendimento especial para o seu retorno. Que tal agendar seu horário?${bookingNotice}`;
    } else {
      suggestedMessage = `Olá, ${firstName}! Aqui é da ${shopName}. Tudo bem com você?${bookingNotice}`;
    }

    const whatsAppUrl = isPhoneValid
      ? `https://wa.me/55${digits}?text=${encodeURIComponent(suggestedMessage)}`
      : null;

    const isClubMember = clubSubMap.has(clientId);
    const clubPlanName = clubSubMap.get(clientId) || null;

    return {
      id: clientId,
      name: client.name || 'Cliente Sem Nome',
      firstName,
      phone: isPhoneValid ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : rawPhone,
      rawPhone,
      isPhoneValid,
      avatar: client.avatar || null,
      email: client.email || null,
      lastVisitDate: formatLocalYMD(visitDate),
      lastVisitFormatted: formatLocalBR(visitRaw),
      lastVisitRaw: visitRaw,
      daysSinceLastVisit,
      lastStaffName: visitInfo?.staffName || null,
      isClubMember,
      clubPlanName,
      status,
      statusLabel,
      totalVisits,
      totalSpent,
      avgTicket,
      rfmSegment,
      rfmSegmentLabel,
      hasUpcomingAppointment: upcomingClientIds.has(clientId),
      whatsAppUrl,
      suggestedMessage,
    };
  });

  // Ordenação: maiores períodos de inatividade primeiro
  records.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  // 3. Cálculo dos KPIs
  const kpis: SmartReturnKPIs = {
    totalClients: records.length,
    upToDate: records.filter((r) => r.status === 'up_to_date').length,
    attention: records.filter((r) => r.status === 'attention').length,
    risk: records.filter((r) => r.status === 'risk').length,
    inactive: records.filter((r) => r.status === 'inactive').length,
    championsCount: records.filter((r) => r.rfmSegment === 'champion').length,
    atRiskRevenue: records
      .filter((r) => r.status === 'risk' || r.status === 'inactive')
      .reduce((sum, r) => sum + r.totalSpent, 0),
  };

  return {
    records,
    kpis,
    publicBookingUrl,
    shopName,
  };
};
