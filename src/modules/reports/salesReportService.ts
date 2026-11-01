import { getScopedClient, getSharedClient } from '../../../services/supabaseClient';
import { getEffectiveCommissionRate } from '../../lib/staff/roles';

export type DateRegime = 'attendance' | 'payment';

export interface FilterState {
  dateFrom: string;
  dateTo: string;
}

export interface PaymentBadgeInfo {
  label: string;
  amount: number;
  isClubCredit: boolean;
  toneClass: string;
}

export interface SaleRecord {
  id: string;
  short_id: string;
  client_id: string | null;
  client_name: string;
  is_club_member: boolean;
  attendance_date: string;
  payment_date: string | null;
  channel: 'online' | 'balcao';
  staff_names: string[];
  items_summary: string;
  items_count: number;
  payment_badges: PaymentBadgeInfo[];
  cash_revenue: number;
  club_credit_volume: number;
  total: number;
  commission_generated: number;
  status: string;
}

export interface FetchSalesResult {
  sales: SaleRecord[];
  isTruncated: boolean;
}

export const MAX_DISPLAY_RECORDS = 500;
const CHUNK_SIZE = 150;

export const isOnlineAppointment = (appt?: {
  source?: string | null;
  channel?: string | null;
} | null): boolean => {
  if (!appt) return false;
  const src = String(appt.source || '').toLowerCase().trim();
  const ch = String(appt.channel || '').toLowerCase().trim();
  return (
    src === 'booking_web' ||
    src === 'site_sanchez' ||
    src === 'portal' ||
    src === 'online' ||
    ch === 'site' ||
    ch === 'portal' ||
    ch === 'online' ||
    ch === 'booking_web'
  );
};

export const isClubPaymentMethod = (
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

export const formatPaymentMethodBadge = (
  rawMethod: string | null | undefined,
  amount: number,
  isClubCredit: boolean,
): PaymentBadgeInfo => {
  if (isClubCredit) {
    return {
      label: 'Crédito Clube',
      amount,
      isClubCredit: true,
      toneClass:
        'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
    };
  }

  const m = String(rawMethod || '').toLowerCase().trim();
  if (m === 'pix') {
    return {
      label: 'PIX',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
    };
  }
  if (m === 'cash' || m === 'dinheiro') {
    return {
      label: 'Dinheiro',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30',
    };
  }
  if (
    m === 'credit' ||
    m === 'credito' ||
    m === 'crédito' ||
    m === 'cartao_credito' ||
    m === 'cartão de crédito'
  ) {
    return {
      label: 'Cartão Crédito',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30',
    };
  }
  if (
    m === 'debit' ||
    m === 'debito' ||
    m === 'débito' ||
    m === 'cartao_debito' ||
    m === 'cartão de débito'
  ) {
    return {
      label: 'Cartão Débito',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30',
    };
  }

  return {
    label: rawMethod ? String(rawMethod) : 'Direto',
    amount,
    isClubCredit: false,
    toneClass:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30',
  };
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

export const fetchSalesData = async (
  tenantId: string,
  filters: FilterState,
  dateRegime: DateRegime,
): Promise<FetchSalesResult> => {
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();

  const fromIso = filters.dateFrom ? `${filters.dateFrom}T00:00:00-03:00` : undefined;
  const toIso = filters.dateTo ? `${filters.dateTo}T23:59:59.999-03:00` : undefined;
  const fromMs = fromIso ? new Date(fromIso).getTime() : null;
  const toMs = toIso ? new Date(toIso).getTime() : null;

  let rawComandas: any[] = [];

  if (dateRegime === 'payment') {
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

  const truncated = rawComandas.length > MAX_DISPLAY_RECORDS;
  const comandasSlice = truncated ? rawComandas.slice(0, MAX_DISPLAY_RECORDS) : rawComandas;

  const comandaIds = comandasSlice.map((c: any) => c.id).filter(Boolean);
  const appointmentIds = Array.from(
    new Set(comandasSlice.map((c: any) => c.appointment_id).filter(Boolean)),
  ) as string[];
  const clientIds = Array.from(
    new Set(comandasSlice.map((c: any) => c.client_id).filter(Boolean)),
  ) as string[];

  const [
    staffRes,
    itemsData,
    appointmentsData,
    paymentsData,
    commissionsData,
    activeSubsData,
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
    clientIds.length > 0
      ? fetchChunks<any>(
          clubSupabase,
          'customer_subscriptions',
          'client_id',
          clientIds,
          'id, client_id, status',
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

  const appointmentById = new Map<
    string,
    { id: string; start_time?: string | null; source?: string | null; channel?: string | null }
  >();
  for (const appt of appointmentsData) {
    appointmentById.set(appt.id, appt);
  }

  const clubSubscriberClientIds = new Set<string>();
  for (const sub of activeSubsData) {
    if (sub.client_id && sub.status === 'active') {
      clubSubscriberClientIds.add(sub.client_id);
    }
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

  const builtRecords: SaleRecord[] = [];

  for (const comanda of comandasSlice) {
    const appt = comanda.appointment_id ? appointmentById.get(comanda.appointment_id) : null;
    const attendanceDate = appt?.start_time || comanda.created_at;
    const paymentDate = comanda.closed_at || comanda.created_at;

    const targetTimestamp =
      dateRegime === 'attendance'
        ? new Date(attendanceDate).getTime()
        : new Date(paymentDate).getTime();

    if (fromMs !== null && !Number.isNaN(targetTimestamp) && targetTimestamp < fromMs) {
      continue;
    }
    if (toMs !== null && !Number.isNaN(targetTimestamp) && targetTimestamp > toMs) {
      continue;
    }

    const comandaTotal = Number(comanda.total || 0);
    const items = itemsByComandaId.get(comanda.id) || [];

    const staffNamesSet = new Set<string>();
    if (comanda.staff_id && staffById.has(comanda.staff_id)) {
      staffNamesSet.add(staffById.get(comanda.staff_id)!.name);
    }
    for (const item of items) {
      if (item.staff_id && staffById.has(item.staff_id)) {
        staffNamesSet.add(staffById.get(item.staff_id)!.name);
      }
      const parts = participantsByItemId.get(item.id) || [];
      for (const p of parts) {
        const pid = p.professional_id || p.staff_id;
        if (pid && staffById.has(pid)) {
          staffNamesSet.add(staffById.get(pid)!.name);
        }
      }
    }

    const totalItemsQty = items.reduce(
      (sum, it) => sum + Math.max(1, Number(it.quantity || 1)),
      0,
    );
    const itemLabels = items
      .map((it) => {
        const qty = Math.max(1, Number(it.quantity || 1));
        const name = String(it.product_name || 'Item').trim();
        return qty > 1 ? `${qty}x ${name}` : name;
      })
      .filter(Boolean);
    const itemsSummary =
      itemLabels.length > 0 ? itemLabels.join(', ') : 'Sem itens detalhados';

    const activePayments = paymentsByComandaId.get(comanda.id) || [];
    const badges: PaymentBadgeInfo[] = [];
    let cashRevenue = 0;
    let clubCreditVolume = 0;

    const comandaIsClub = isClubPaymentMethod(
      comanda.payment_method,
      comanda.closure_mode,
      comanda.financial_effect,
    );

    if (activePayments.length > 0) {
      const groupedByMethod = new Map<string, { amount: number; isClub: boolean }>();
      for (const pay of activePayments) {
        const amt = Number(pay.amount || 0);
        const isClub =
          comandaIsClub ||
          isClubPaymentMethod(pay.payment_method, comanda.closure_mode, comanda.financial_effect);
        const methodKey = String(pay.payment_method || comanda.payment_method || 'Direto');
        const prev = groupedByMethod.get(methodKey) || { amount: 0, isClub };
        groupedByMethod.set(methodKey, {
          amount: prev.amount + amt,
          isClub: prev.isClub || isClub,
        });
      }

      groupedByMethod.forEach((info, methodKey) => {
        badges.push(formatPaymentMethodBadge(methodKey, info.amount, info.isClub));
        if (info.isClub) {
          clubCreditVolume += info.amount;
        } else {
          cashRevenue += info.amount;
        }
      });
    } else {
      badges.push(
        formatPaymentMethodBadge(comanda.payment_method, comandaTotal, comandaIsClub),
      );
      if (comandaIsClub) {
        clubCreditVolume += comandaTotal;
      } else {
        cashRevenue += comandaTotal;
      }
    }

    const commRecords = commissionRecordsByComandaId.get(comanda.id) || [];
    let commissionGenerated = 0;
    if (commRecords.length > 0) {
      const activeOriginals = commRecords.filter(
        (r: any) => r.record_type === 'commission' && r.status === 'active',
      );
      if (activeOriginals.length > 0) {
        commissionGenerated = activeOriginals.reduce(
          (acc: number, r: any) => acc + Number(r.commission_value || 0),
          0,
        );
      } else {
        commissionGenerated = Math.max(
          0,
          commRecords.reduce(
            (acc: number, r: any) => acc + Number(r.commission_value || 0),
            0,
          ),
        );
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
            commissionGenerated += baseVal * effRate;
          }
        } else {
          const pid = item.staff_id || comanda.staff_id;
          const staffObj = pid ? staffById.get(pid) : undefined;
          const effRate = getEffectiveCommissionRate(staffObj);
          if (effRate > 0) {
            commissionGenerated += lineTotal * effRate;
          }
        }
      }
    }

    const isSubscriber =
      (comanda.client_id ? clubSubscriberClientIds.has(comanda.client_id) : false) ||
      comandaIsClub ||
      clubCreditVolume > 0;

    builtRecords.push({
      id: comanda.id,
      short_id: `#${String(comanda.id || '').slice(0, 8)}`,
      client_id: comanda.client_id || null,
      client_name: comanda.clients?.name || 'Cliente não informado',
      is_club_member: isSubscriber,
      attendance_date: attendanceDate,
      payment_date: paymentDate,
      channel: isOnlineAppointment(appt) ? 'online' : 'balcao',
      staff_names: Array.from(staffNamesSet),
      items_summary: itemsSummary,
      items_count: totalItemsQty,
      payment_badges: badges,
      cash_revenue: cashRevenue,
      club_credit_volume: clubCreditVolume,
      total: comandaTotal,
      commission_generated: commissionGenerated,
      status: comanda.status,
    });
  }

  return {
    sales: builtRecords,
    isTruncated: truncated,
  };
};
