import type { SupabaseClient } from '@supabase/supabase-js';
import { getScopedClient, getSharedClient, logSupabaseError } from '../../../services/supabaseClient';
import {
  MAX_DISPLAY_RECORDS,
  buildSnapshot,
  clampToRecordLimit,
  computeDeltas,
  resolveGoalContext,
  resolvePreviousWindow,
  resolveWindow,
  todayInSaoPaulo,
  type PerformanceAppointmentRow,
  type PerformanceComandaItemRow,
  type PerformanceComandaRow,
  type PerformanceCommissionRecordRow,
  type PerformanceParticipantRow,
  type PerformancePaymentRow,
  type PerformanceSnapshotContext,
  type PerformanceStaffInfo,
  type ResolvedWindow,
} from './snapshot';
import type {
  DateRegime,
  PerformanceFilterState,
  PerformanceResult,
  PerformanceWindow,
  TenantGoal,
} from './types';

const CHUNK_SIZE = 150;

const COMANDA_COLUMNS =
  'id, client_id, appointment_id, status, total, discount, payment_method, closure_mode, financial_effect, created_at, closed_at, staff_id, clients(name)';

const toPublicWindow = (window: ResolvedWindow): PerformanceWindow => ({
  dateFrom: window.dateFrom,
  dateTo: window.dateTo,
  days: window.days,
  granularity: window.granularity,
});

const toWindowBounds = (window: ResolvedWindow) => ({
  fromIso: `${window.dateFrom}T00:00:00-03:00`,
  toIso: `${window.dateTo}T23:59:59.999-03:00`,
});

const fetchChunks = async <T,>(
  client: SupabaseClient,
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
    // Erro de enriquecimento não pode virar número menor em silêncio.
    if (error) {
      throw new Error(`Falha ao consultar ${table}: ${error.message}`);
    }
    if (Array.isArray(data)) {
      results.push(...(data as T[]));
    }
  }
  return results;
};

const fetchActiveGoal = async (tenantId: string): Promise<TenantGoal | null> => {
  const sharedSupabase = getSharedClient();
  const { data, error } = await sharedSupabase
    .from('tenant_goals')
    .select('id, period, revenue_goal, appointments_goal, clients_goal, active')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (error) {
    // Meta é metadado: falhar aqui não pode derrubar o painel inteiro, mas o
    // motivo fica registrado para não parecer que a unidade não tem meta.
    logSupabaseError('performance.fetchActiveGoal', error, { tenantId });
    return null;
  }

  if (!data || data.length === 0) return null;
  const goals = data as Array<{
    id: string;
    period?: string | null;
    revenue_goal?: number | string | null;
    appointments_goal?: number | string | null;
    clients_goal?: number | string | null;
    active?: boolean | null;
  }>;
  const activeGoal = goals.find((goal) => goal.period === 'monthly') || goals[0];
  return {
    id: activeGoal.id,
    period: activeGoal.period || 'monthly',
    revenue_goal: Number(activeGoal.revenue_goal || 0),
    appointments_goal: Number(activeGoal.appointments_goal || 0),
    clients_goal: Number(activeGoal.clients_goal || 0),
    active: Boolean(activeGoal.active),
  };
};

interface WindowRows {
  rows: PerformanceComandaRow[];
  truncated: boolean;
}

const fetchComandasForWindow = async (
  tenantId: string,
  window: ResolvedWindow,
  dateRegime: DateRegime,
): Promise<WindowRows> => {
  const clubSupabase = getScopedClient('barber');
  const { fromIso, toIso } = toWindowBounds(window);

  if (dateRegime === 'payment') {
    const { data, error } = await clubSupabase
      .from('comandas')
      .select(COMANDA_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .or(
        `and(closed_at.gte.${fromIso},closed_at.lte.${toIso}),and(closed_at.is.null,created_at.gte.${fromIso},created_at.lte.${toIso})`,
      )
      .order('closed_at', { ascending: false })
      .limit(MAX_DISPLAY_RECORDS + 1);

    if (error) throw error;
    return clampToRecordLimit<PerformanceComandaRow>(data || []);
  }

  const apptRes = await clubSupabase
    .from('appointments')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('start_time', fromIso)
    .lte('start_time', toIso)
    .limit(MAX_DISPLAY_RECORDS + 1);

  // Sem os atendimentos da janela não há como atribuir as comandas ao dia
  // correto; devolver números parciais seria pior do que falhar explicitamente.
  if (apptRes.error) throw apptRes.error;

  const appointmentIds = ((apptRes.data || []) as PerformanceAppointmentRow[])
    .map((appointment) => appointment.id)
    .filter(Boolean);
  const appointmentsTruncated = appointmentIds.length > MAX_DISPLAY_RECORDS;
  const cappedAppointmentIds = appointmentIds.slice(0, MAX_DISPLAY_RECORDS);

  const createdRes = await clubSupabase
    .from('comandas')
    .select(COMANDA_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('status', 'paid')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(MAX_DISPLAY_RECORDS + 1);

  if (createdRes.error) throw createdRes.error;

  const byAppointment: PerformanceComandaRow[] =
    cappedAppointmentIds.length > 0
      ? await fetchChunks<PerformanceComandaRow>(
          clubSupabase,
          'comandas',
          'appointment_id',
          cappedAppointmentIds,
          COMANDA_COLUMNS,
          tenantId,
        )
      : [];

  const merged = new Map<string, PerformanceComandaRow>();
  for (const comanda of (createdRes.data || []) as PerformanceComandaRow[]) {
    if (comanda.id) merged.set(comanda.id, comanda);
  }
  for (const comanda of byAppointment) {
    if (comanda.id && comanda.status === 'paid' && !merged.has(comanda.id)) {
      merged.set(comanda.id, comanda);
    }
  }

  const all = Array.from(merged.values());
  const capped = clampToRecordLimit(all);
  return {
    rows: capped.rows,
    truncated:
      appointmentsTruncated ||
      (createdRes.data || []).length > MAX_DISPLAY_RECORDS ||
      capped.truncated,
  };
};

const fetchSnapshotContext = async (
  tenantId: string,
  comandas: PerformanceComandaRow[],
  dateRegime: DateRegime,
): Promise<PerformanceSnapshotContext> => {
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();

  const comandaIds = Array.from(new Set(comandas.map((comanda) => comanda.id).filter(Boolean)));
  const appointmentIds = Array.from(
    new Set(comandas.map((comanda) => comanda.appointment_id).filter(Boolean)),
  ) as string[];

  const [staffRes, itemsData, appointmentsData, paymentsData, commissionsData] =
    await Promise.all([
      sharedSupabase
        .from('staff')
        .select('id, name, role, commission_rate, product_commission_rate')
        .eq('tenant_id', tenantId),
      comandaIds.length > 0
        ? fetchChunks<PerformanceComandaItemRow>(
            clubSupabase,
            'comanda_items',
            'comanda_id',
            comandaIds,
            'id, comanda_id, service_id, product_id, product_name, quantity, unit_price, staff_id',
            tenantId,
          )
        : Promise.resolve([] as PerformanceComandaItemRow[]),
      appointmentIds.length > 0
        ? fetchChunks<PerformanceAppointmentRow>(
            clubSupabase,
            'appointments',
            'id',
            appointmentIds,
            'id, start_time, source, channel',
            tenantId,
          )
        : Promise.resolve([] as PerformanceAppointmentRow[]),
      comandaIds.length > 0
        ? fetchChunks<PerformancePaymentRow>(
            sharedSupabase,
            'comanda_payments',
            'comanda_id',
            comandaIds,
            'id, comanda_id, payment_type, amount, payment_method, reversed_at',
            tenantId,
          )
        : Promise.resolve([] as PerformancePaymentRow[]),
      comandaIds.length > 0
        ? fetchChunks<PerformanceCommissionRecordRow>(
            sharedSupabase,
            'commission_records',
            'comanda_id',
            comandaIds,
            'id, comanda_id, comanda_item_id, staff_id, record_type, commission_value, status',
            tenantId,
          )
        : Promise.resolve([] as PerformanceCommissionRecordRow[]),
    ]);

  if (staffRes.error) throw staffRes.error;

  const itemIds = itemsData.map((item) => item.id).filter(Boolean);
  const participantsData =
    itemIds.length > 0
      ? await fetchChunks<PerformanceParticipantRow>(
          sharedSupabase,
          'service_execution_participants',
          'comanda_item_id',
          itemIds,
          'id, comanda_item_id, staff_id, role, payout_type, payout_value, affects_commission',
          tenantId,
        )
      : [];

  const staffById = new Map<string, PerformanceStaffInfo>();
  for (const staff of staffRes.data || []) {
    staffById.set(staff.id, {
      id: staff.id,
      name: String(staff.name || 'Profissional'),
      role: String(staff.role || 'barber'),
      commission_rate: staff.commission_rate ?? null,
      product_commission_rate: staff.product_commission_rate ?? null,
    });
  }

  const appointmentById = new Map<string, PerformanceAppointmentRow>();
  for (const appointment of appointmentsData) {
    appointmentById.set(appointment.id, appointment);
  }

  const itemsByComandaId = new Map<string, PerformanceComandaItemRow[]>();
  for (const item of itemsData) {
    const list = itemsByComandaId.get(item.comanda_id) || [];
    list.push(item);
    itemsByComandaId.set(item.comanda_id, list);
  }

  const participantsByItemId = new Map<string, PerformanceParticipantRow[]>();
  for (const participant of participantsData) {
    const list = participantsByItemId.get(participant.comanda_item_id) || [];
    list.push(participant);
    participantsByItemId.set(participant.comanda_item_id, list);
  }

  const paymentsByComandaId = new Map<string, PerformancePaymentRow[]>();
  for (const payment of paymentsData) {
    if (payment.reversed_at) continue;
    const list = paymentsByComandaId.get(payment.comanda_id) || [];
    list.push(payment);
    paymentsByComandaId.set(payment.comanda_id, list);
  }

  const commissionRecordsByComandaId = new Map<string, PerformanceCommissionRecordRow[]>();
  for (const record of commissionsData) {
    const list = commissionRecordsByComandaId.get(record.comanda_id) || [];
    list.push(record);
    commissionRecordsByComandaId.set(record.comanda_id, list);
  }

  return {
    dateRegime,
    staffById,
    appointmentById,
    itemsByComandaId,
    participantsByItemId,
    paymentsByComandaId,
    commissionRecordsByComandaId,
  };
};

export const fetchPerformanceData = async (
  tenantId: string,
  filters: PerformanceFilterState,
  dateRegime: DateRegime,
): Promise<PerformanceResult> => {
  const window = resolveWindow(filters.dateFrom, filters.dateTo);
  if (!window) {
    throw new Error('Período inválido. Selecione uma data inicial e uma data final.');
  }
  const previousWindow = resolvePreviousWindow(window);

  const [goal, currentRows, previousRows] = await Promise.all([
    fetchActiveGoal(tenantId),
    fetchComandasForWindow(tenantId, window, dateRegime),
    previousWindow
      ? fetchComandasForWindow(tenantId, previousWindow, dateRegime)
      : Promise.resolve<WindowRows>({ rows: [], truncated: false }),
  ]);

  const union = new Map<string, PerformanceComandaRow>();
  for (const comanda of [...currentRows.rows, ...previousRows.rows]) {
    if (comanda.id && !union.has(comanda.id)) union.set(comanda.id, comanda);
  }
  const context = await fetchSnapshotContext(
    tenantId,
    Array.from(union.values()),
    dateRegime,
  );

  const current = buildSnapshot(currentRows.rows, context, window);
  const previous = previousWindow
    ? buildSnapshot(previousRows.rows, context, previousWindow)
    : null;
  const previousTotals =
    previous && previousRows.rows.length > 0 ? previous.totals : null;

  return {
    tenantGoal: goal,
    goalContext: resolveGoalContext(window, goal, todayInSaoPaulo()),
    rankedStaff: current.rankedStaff,
    timeline: current.timeline,
    totals: current.totals,
    previousTotals,
    deltas: computeDeltas(current.totals, previousTotals),
    window: toPublicWindow(window),
    previousWindow: previousWindow ? toPublicWindow(previousWindow) : null,
    truncated: currentRows.truncated,
    previousTruncated: previousRows.truncated,
  };
};
