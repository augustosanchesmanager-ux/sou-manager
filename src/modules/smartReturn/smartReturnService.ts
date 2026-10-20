/**
 * Smart Return Module - Service
 * Desacoplamento da camada de dados para o Motor de Retorno Inteligente.
 * Elimina chamadas .from() diretas na UI e encapsula as regras de inatividade e recall.
 */

import { getClientForTable } from '../../../services/supabaseClient';
import { normalizePhone } from '../../lib/utils/phone';
import type {
  FetchSmartReturnParams,
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
const determineInactivityStatus = (days: number): { status: SmartReturnInactivityStatus; label: string } => {
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

export const fetchSmartReturnData = async (
  params: FetchSmartReturnParams
): Promise<SmartReturnData> => {
  const { tenantId, tenantSlug } = params;
  const shopName = params.shopName?.trim() || 'Barbearia';

  if (!tenantId) {
    return {
      records: [],
      kpis: { totalClients: 0, upToDate: 0, attention: 0, risk: 0, inactive: 0 },
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
      .select('id, client_id, closed_at, status')
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
    rawUpcoming.map((a: any) => a.client_id).filter(Boolean)
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

  // Processar comandas fechadas (caso haja comanda mais recente ou sem agendamento correspondente)
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

    const rawPhone = client.phone || '';
    const { digits, isValid: isPhoneValid } = normalizePhone(rawPhone);
    const firstName = client.name ? client.name.trim().split(' ')[0] : 'Cliente';

    // Construção da mensagem sugerida de WhatsApp
    const bookingNotice = publicBookingUrl
      ? ` Você também pode agendar online por aqui: ${publicBookingUrl}`
      : '';

    let suggestedMessage = '';
    if (status === 'attention') {
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
  };

  return {
    records,
    kpis,
    publicBookingUrl,
    shopName,
  };
};
