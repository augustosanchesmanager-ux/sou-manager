import { getScopedClient, getSharedClient } from '../../../services/supabaseClient';
import { getEffectiveCommissionRate } from '../../lib/staff/roles';
import type {
  DateRegime,
  PerformanceFilterState,
  PerformanceResult,
  StaffPerformanceRecord,
  TenantGoal,
  TimelinePoint,
} from './types';

const MAX_DISPLAY_RECORDS = 500;
const CHUNK_SIZE = 150;

const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const isClubPaymentMethod = (
  method?: string | null,
  closureMode?: string | null,
  financialEffect?: boolean | null,
): boolean => {
  if (closureMode === 'legacy_membership' || financialEffect === false) return true;
  const normalized = String(method || '').toLowerCase().trim();
  return (
    normalized.includes('clube') ||
    normalized.includes('chef') ||
    normalized.includes('assinatura') ||
    normalized === 'membership' ||
    normalized === 'subscription' ||
    normalized === 'club_credit' ||
    normalized === 'credito_clube' ||
    normalized === 'crédito clube'
  );
};

const fetchChunks = async <T,>(
  client: any,
  table: string,
  column: string,
  ids: string[],
  selectCols: string,
  tenantId: string,
): Promise<T[]> => {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const batch = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await client
      .from(table)
      .select(selectCols)
      .eq('tenant_id', tenantId)
      .in(column, batch);
    if (!error && Array.isArray(data)) {
      results.push(...(data as T[]));
    }
  }
  return results;
};

export const fetchPerformanceData = async (
  tenantId: string,
  filters: PerformanceFilterState,
  dateRegime: DateRegime,
): Promise<PerformanceResult> => {
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();

  // 1. Buscar metas ativas da unidade (public.tenant_goals)
  const { data: goalRows, error: goalErr } = await sharedSupabase
    .from('tenant_goals')
    .select('id, period, revenue_goal, appointments_goal, clients_goal, active')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (goalErr) {
    console.warn('Aviso ao consultar tenant_goals:', goalErr.message);
  }

  let resolvedGoal: TenantGoal | null = null;
  if (goalRows && goalRows.length > 0) {
    const activeGoal =
      goalRows.find((g: any) => g.period === 'monthly') || goalRows[0];
    resolvedGoal = {
      id: activeGoal.id,
      period: activeGoal.period || 'monthly',
      revenue_goal: Number(activeGoal.revenue_goal || 0),
      appointments_goal: Number(activeGoal.appointments_goal || 0),
      clients_goal: Number(activeGoal.clients_goal || 0),
      active: Boolean(activeGoal.active),
    };
  }

  // 2. Montagem de datas com offset explícito (-03:00) para eliminar distorção de timezone
  const fromIso = filters.dateFrom ? `${filters.dateFrom}T00:00:00-03:00` : undefined;
  const toIso = filters.dateTo ? `${filters.dateTo}T23:59:59.999-03:00` : undefined;
  const fromMs = fromIso ? new Date(fromIso).getTime() : null;
  const toMs = toIso ? new Date(toIso).getTime() : null;

  let rawComandas: any[] = [];

  if (dateRegime === 'payment') {
    // Regime de Caixa / Pagamento (closed_at com fallback para created_at)
    let query = clubSupabase
      .from('comandas')
      .select(
        'id, client_id, appointment_id, status, total, discount, payment_method, closure_mode, financial_effect, created_at, closed_at, staff_id, clients(name)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .order('closed_at', { ascending: false })
      .limit(MAX_DISPLAY_RECORDS + 1);

    if (fromIso && toIso) {
      query = query.or(
        `and(closed_at.gte.${fromIso},closed_at.lte.${toIso}),and(closed_at.is.null,created_at.gte.${fromIso},created_at.lte.${toIso})`,
      );
    } else if (fromIso) {
      query = query.gte('closed_at', fromIso);
    } else if (toIso) {
      query = query.lte('closed_at', toIso);
    }

    const { data, error } = await query;
    if (error) throw error;
    rawComandas = data || [];
  } else {
    // Regime de Atendimento (appointment.start_time ou comandas.created_at)
    let apptIdsInWindow: string[] = [];
    if (fromIso || toIso) {
      let apptQuery = clubSupabase
        .from('appointments')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(MAX_DISPLAY_RECORDS);
      if (fromIso) apptQuery = apptQuery.gte('start_time', fromIso);
      if (toIso) apptQuery = apptQuery.lte('start_time', toIso);
      const { data: apptRows } = await apptQuery;
      apptIdsInWindow = (apptRows || []).map((a: any) => a.id).filter(Boolean);
    }

    let createdQuery = clubSupabase
      .from('comandas')
      .select(
        'id, client_id, appointment_id, status, total, discount, payment_method, closure_mode, financial_effect, created_at, closed_at, staff_id, clients(name)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(MAX_DISPLAY_RECORDS + 1);

    if (fromIso) createdQuery = createdQuery.gte('created_at', fromIso);
    if (toIso) createdQuery = createdQuery.lte('created_at', toIso);

    const [createdRes, byApptComandas] = await Promise.all([
      createdQuery,
      apptIdsInWindow.length > 0
        ? fetchChunks<any>(
            clubSupabase,
            'comandas',
            'appointment_id',
            apptIdsInWindow,
            'id, client_id, appointment_id, status, total, discount, payment_method, closure_mode, financial_effect, created_at, closed_at, staff_id, clients(name)',
            tenantId,
          )
        : Promise.resolve([] as any[]),
    ]);

    if (createdRes.error) throw createdRes.error;

    const mergedMap = new Map<string, any>();
    for (const c of createdRes.data || []) {
      if (c.id) mergedMap.set(c.id, c);
    }
    for (const c of byApptComandas) {
      if (c.id && c.status === 'paid' && !mergedMap.has(c.id)) {
        mergedMap.set(c.id, c);
      }
    }
    rawComandas = Array.from(mergedMap.values());
  }

  const comandasSlice =
    rawComandas.length > MAX_DISPLAY_RECORDS
      ? rawComandas.slice(0, MAX_DISPLAY_RECORDS)
      : rawComandas;

  const comandaIds = comandasSlice.map((c: any) => c.id).filter(Boolean);
  const appointmentIds = Array.from(
    new Set(comandasSlice.map((c: any) => c.appointment_id).filter(Boolean)),
  ) as string[];

  // 3. Enriquecimento paralelo em chunks (somente SELECT, estritamente tenant_id)
  const [
    staffRes,
    itemsData,
    appointmentsData,
    paymentsData,
    commissionsData,
  ] = await Promise.all([
    sharedSupabase
      .from('staff')
      .select('id, name, role, commission_rate')
      .eq('tenant_id', tenantId),
    comandaIds.length > 0
      ? fetchChunks<any>(
          clubSupabase,
          'comanda_items',
          'comanda_id',
          comandaIds,
          'id, comanda_id, service_id, product_id, product_name, quantity, unit_price, staff_id',
          tenantId,
        )
      : Promise.resolve([] as any[]),
    appointmentIds.length > 0
      ? fetchChunks<any>(
          clubSupabase,
          'appointments',
          'id',
          appointmentIds,
          'id, start_time, source, channel',
          tenantId,
        )
      : Promise.resolve([] as any[]),
    comandaIds.length > 0
      ? fetchChunks<any>(
          sharedSupabase,
          'comanda_payments',
          'comanda_id',
          comandaIds,
          'id, comanda_id, payment_type, amount, payment_method, reversed_at',
          tenantId,
        )
      : Promise.resolve([] as any[]),
    comandaIds.length > 0
      ? fetchChunks<any>(
          sharedSupabase,
          'commission_records',
          'comanda_id',
          comandaIds,
          'id, comanda_id, comanda_item_id, staff_id, record_type, commission_value, status',
          tenantId,
        )
      : Promise.resolve([] as any[]),
  ]);

  const itemIds = itemsData.map((item: any) => item.id).filter(Boolean);
  const participantsData =
    itemIds.length > 0
      ? await fetchChunks<any>(
          sharedSupabase,
          'service_execution_participants',
          'comanda_item_id',
          itemIds,
          'id, comanda_item_id, professional_id, role, payout_type, payout_value, affects_commission',
          tenantId,
        )
      : [];

  // Mapeamentos em memória
  const staffById = new Map<
    string,
    { id: string; name: string; role: string; commission_rate: number | null }
  >();
  for (const s of staffRes.data || []) {
    staffById.set(s.id, {
      id: s.id,
      name: String(s.name || 'Profissional'),
      role: String(s.role || 'barber'),
      commission_rate: s.commission_rate ?? null,
    });
  }

  const appointmentById = new Map<string, any>();
  for (const appt of appointmentsData) {
    appointmentById.set(appt.id, appt);
  }

  const itemsByComandaId = new Map<string, any[]>();
  for (const item of itemsData) {
    const list = itemsByComandaId.get(item.comanda_id) || [];
    list.push(item);
    itemsByComandaId.set(item.comanda_id, list);
  }

  const participantsByItemId = new Map<string, any[]>();
  for (const part of participantsData) {
    const list = participantsByItemId.get(part.comanda_item_id) || [];
    list.push(part);
    participantsByItemId.set(part.comanda_item_id, list);
  }

  const paymentsByComandaId = new Map<string, any[]>();
  for (const pay of paymentsData) {
    if (pay.reversed_at) continue;
    const list = paymentsByComandaId.get(pay.comanda_id) || [];
    list.push(pay);
    paymentsByComandaId.set(pay.comanda_id, list);
  }

  const commissionRecordsByComandaId = new Map<string, any[]>();
  for (const rec of commissionsData) {
    const list = commissionRecordsByComandaId.get(rec.comanda_id) || [];
    list.push(rec);
    commissionRecordsByComandaId.set(rec.comanda_id, list);
  }

  // Estruturas de agregação por barbeiro
  const staffMetricsMap = new Map<
    string,
    {
      cash_revenue: number;
      club_credit_volume: number;
      commission_generated: number;
      comandaIds: Set<string>;
    }
  >();

  const initStaffMetrics = (id: string) => {
    if (!staffMetricsMap.has(id)) {
      staffMetricsMap.set(id, {
        cash_revenue: 0,
        club_credit_volume: 0,
        commission_generated: 0,
        comandaIds: new Set<string>(),
      });
    }
    return staffMetricsMap.get(id)!;
  };

  for (const s of staffById.values()) {
    initStaffMetrics(s.id);
  }

  let houseCashRevenue = 0;
  let houseClubVolume = 0;
  let houseTotalRevenue = 0;
  let houseTotalCommissions = 0;
  let houseTotalAttendances = 0;

  const timelineMap = new Map<string, { cash: number; club: number; total: number; count: number }>();

  for (const comanda of comandasSlice) {
    const appt = comanda.appointment_id ? appointmentById.get(comanda.appointment_id) : null;
    const attendanceDate = appt?.start_time || comanda.created_at;
    const paymentDate = comanda.closed_at || comanda.created_at;

    const targetDate = dateRegime === 'attendance' ? attendanceDate : paymentDate;
    const targetTimestamp = new Date(targetDate).getTime();

    if (fromMs !== null && !Number.isNaN(targetTimestamp) && targetTimestamp < fromMs) {
      continue;
    }
    if (toMs !== null && !Number.isNaN(targetTimestamp) && targetTimestamp > toMs) {
      continue;
    }

    const comandaTotal = Number(comanda.total || 0);
    const items = itemsByComandaId.get(comanda.id) || [];
    const activePayments = paymentsByComandaId.get(comanda.id) || [];

    let comandaCash = 0;
    let comandaClub = 0;
    const comandaIsClub = isClubPaymentMethod(
      comanda.payment_method,
      comanda.closure_mode,
      comanda.financial_effect,
    );

    if (activePayments.length > 0) {
      for (const pay of activePayments) {
        const amt = Number(pay.amount || 0);
        const isClub =
          comandaIsClub ||
          isClubPaymentMethod(pay.payment_method, comanda.closure_mode, comanda.financial_effect);
        if (isClub) {
          comandaClub += amt;
        } else {
          comandaCash += amt;
        }
      }
    } else {
      if (comandaIsClub) {
        comandaClub = comandaTotal;
      } else {
        comandaCash = comandaTotal;
      }
    }

    const calculatedComandaTotal = comandaCash + comandaClub;
    const effectiveTotal = calculatedComandaTotal > 0 ? calculatedComandaTotal : comandaTotal;
    const cashRatio = effectiveTotal > 0 ? comandaCash / effectiveTotal : 1;
    const clubRatio = effectiveTotal > 0 ? comandaClub / effectiveTotal : 0;

    houseCashRevenue += comandaCash;
    houseClubVolume += comandaClub;
    houseTotalRevenue += effectiveTotal;
    houseTotalAttendances += 1;

    const dayKey = targetDate ? formatLocalYMD(new Date(targetDate)) : 'outros';
    const currentDay = timelineMap.get(dayKey) || { cash: 0, club: 0, total: 0, count: 0 };
    timelineMap.set(dayKey, {
      cash: currentDay.cash + comandaCash,
      club: currentDay.club + comandaClub,
      total: currentDay.total + effectiveTotal,
      count: currentDay.count + 1,
    });

    if (items.length > 0) {
      for (const item of items) {
        const qty = Math.max(1, Number(item.quantity || 1));
        const itemPrice = Number(item.unit_price || 0) * qty;
        const itemCash = itemPrice * cashRatio;
        const itemClub = itemPrice * clubRatio;

        const parts = participantsByItemId.get(item.id) || [];
        if (parts.length > 0) {
          const partShare = 1 / parts.length;
          for (const part of parts) {
            const pid =
              part.professional_id || part.staff_id || item.staff_id || comanda.staff_id;
            if (pid) {
              const m = initStaffMetrics(pid);
              m.cash_revenue += itemCash * partShare;
              m.club_credit_volume += itemClub * partShare;
              m.comandaIds.add(comanda.id);
            }
          }
        } else {
          const pid = item.staff_id || comanda.staff_id;
          if (pid) {
            const m = initStaffMetrics(pid);
            m.cash_revenue += itemCash;
            m.club_credit_volume += itemClub;
            m.comandaIds.add(comanda.id);
          }
        }
      }
    } else if (comanda.staff_id) {
      const m = initStaffMetrics(comanda.staff_id);
      m.cash_revenue += comandaCash;
      m.club_credit_volume += comandaClub;
      m.comandaIds.add(comanda.id);
    }

    const commRecords = commissionRecordsByComandaId.get(comanda.id) || [];
    if (commRecords.length > 0) {
      const activeOriginals = commRecords.filter(
        (r: any) => r.record_type === 'commission' && r.status === 'active',
      );
      const recordsToProcess =
        activeOriginals.length > 0 ? activeOriginals : commRecords;

      for (const rec of recordsToProcess) {
        const val = Number(rec.commission_value || 0);
        houseTotalCommissions += val;
        if (rec.staff_id) {
          const m = initStaffMetrics(rec.staff_id);
          m.commission_generated += val;
        }
      }
    } else if (comanda.financial_effect !== false) {
      for (const item of items) {
        const qty = Math.max(1, Number(item.quantity || 1));
        const lineTotal = Number(item.unit_price || 0) * qty;
        if (lineTotal <= 0) continue;

        const parts = (participantsByItemId.get(item.id) || []).filter(
          (p: any) => p.affects_commission !== false,
        );

        if (parts.length > 0) {
          for (const part of parts) {
            const pid =
              part.professional_id || part.staff_id || item.staff_id || comanda.staff_id;
            const staffObj = pid ? staffById.get(pid) : undefined;
            const effRate = getEffectiveCommissionRate(staffObj);
            if (effRate <= 0) continue;

            const payoutVal = Number(part.payout_value ?? 100);
            const baseVal =
              part.payout_type === 'fixed'
                ? Math.min(lineTotal, Math.max(0, payoutVal))
                : lineTotal * (payoutVal > 1 ? payoutVal / 100 : payoutVal);
            const comm = baseVal * effRate;
            houseTotalCommissions += comm;
            if (pid) {
              const m = initStaffMetrics(pid);
              m.commission_generated += comm;
            }
          }
        } else {
          const pid = item.staff_id || comanda.staff_id;
          const staffObj = pid ? staffById.get(pid) : undefined;
          const effRate = getEffectiveCommissionRate(staffObj);
          if (effRate > 0) {
            const comm = lineTotal * effRate;
            houseTotalCommissions += comm;
            if (pid) {
              const m = initStaffMetrics(pid);
              m.commission_generated += comm;
            }
          }
        }
      }
    }
  }

  const builtStaffList: StaffPerformanceRecord[] = [];
  staffMetricsMap.forEach((metrics, sId) => {
    const staffObj = staffById.get(sId);
    const name = staffObj ? staffObj.name : 'Colaborador';
    const role = staffObj ? staffObj.role : 'barber';
    const commission_rate = staffObj ? staffObj.commission_rate : null;

    const totalRev = metrics.cash_revenue + metrics.club_credit_volume;
    const apptCount = metrics.comandaIds.size;
    const avgTicket = apptCount > 0 ? totalRev / apptCount : 0;
    const sharePct =
      houseTotalRevenue > 0 ? (totalRev / houseTotalRevenue) * 100 : 0;

    builtStaffList.push({
      id: sId,
      name,
      role,
      commission_rate,
      appointments_count: apptCount,
      cash_revenue: metrics.cash_revenue,
      club_credit_volume: metrics.club_credit_volume,
      total_revenue: totalRev,
      average_ticket: avgTicket,
      commission_generated: metrics.commission_generated,
      share_percentage: sharePct,
    });
  });

  builtStaffList.sort((a, b) => {
    if (b.total_revenue !== a.total_revenue) {
      return b.total_revenue - a.total_revenue;
    }
    return b.appointments_count - a.appointments_count;
  });

  const avgTicket =
    houseTotalAttendances > 0 ? houseTotalRevenue / houseTotalAttendances : 0;
  const netMargin = Math.max(0, houseTotalRevenue - houseTotalCommissions);
  const netMarginPercent =
    houseTotalRevenue > 0 ? (netMargin / houseTotalRevenue) * 100 : 0;

  const sortedDays = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      key,
      label: fmtDate(key),
      cash: val.cash,
      club: val.club,
      total: val.total,
      count: val.count,
    }));

  return {
    tenantGoal: resolvedGoal,
    rankedStaff: builtStaffList,
    timeline: sortedDays,
    totals: {
      totalRevenue: houseTotalRevenue,
      cashRevenue: houseCashRevenue,
      clubCreditVolume: houseClubVolume,
      totalAttendances: houseTotalAttendances,
      averageTicket: avgTicket,
      totalCommissions: houseTotalCommissions,
      netMargin,
      netMarginPercent,
    },
  };
};
