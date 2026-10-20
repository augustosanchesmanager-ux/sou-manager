import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getScopedClient, getSharedClient } from '../services/supabaseClient';
import DateRangeFilter, { type DatePreset } from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import { getEffectiveCommissionRate } from '../src/lib/staff/roles';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtNumber = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(v);

const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type DateRegime = 'attendance' | 'payment';

interface FilterState {
  dateFrom: string;
  dateTo: string;
}

interface TenantGoal {
  id: string;
  period: string;
  revenue_goal: number;
  appointments_goal: number;
  clients_goal: number;
  active: boolean;
}

interface StaffPerformanceRecord {
  id: string;
  name: string;
  role: string;
  commission_rate: number | null;
  appointments_count: number;
  cash_revenue: number;
  club_credit_volume: number;
  total_revenue: number;
  average_ticket: number;
  commission_generated: number;
  share_percentage: number;
}

interface TimelinePoint {
  key: string;
  label: string;
  cash: number;
  club: number;
  total: number;
  count: number;
}

const getInitialMonthRange = (): FilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: formatLocalYMD(start),
    dateTo: formatLocalYMD(end),
  };
};

const MAX_DISPLAY_RECORDS = 500;
const CHUNK_SIZE = 150;

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

const Performance: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Filtros: padrão em Regime de Atendimento conforme especificado
  const [filters, setFilters] = useState<FilterState>(getInitialMonthRange);
  const [dateRegime, setDateRegime] = useState<DateRegime>('attendance');
  const [preset, setPreset] = useState<DatePreset>('this_month');

  // Metas do estabelecimento (public.tenant_goals)
  const [tenantGoal, setTenantGoal] = useState<TenantGoal | null>(null);

  // Dados consolidados de performance
  const [rankedStaff, setRankedStaff] = useState<StaffPerformanceRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    cashRevenue: 0,
    clubCreditVolume: 0,
    totalAttendances: 0,
    averageTicket: 0,
    totalCommissions: 0,
    netMargin: 0,
    netMarginPercent: 0,
  });

  const fetchPerformanceData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      // 1. Buscar metas ativas da unidade (public.tenant_goals)
      const { data: goalRows, error: goalErr } = await sharedSupabase
        .from('tenant_goals')
        .select('id, period, revenue_goal, appointments_goal, clients_goal, active')
        .eq('tenant_id', tenantId)
        .eq('active', true);

      if (goalErr) {
        console.warn('Aviso ao consultar tenant_goals:', goalErr.message);
      }

      if (goalRows && goalRows.length > 0) {
        // Prioriza meta mensal, ou pega a primeira ativa
        const activeGoal =
          goalRows.find((g: any) => g.period === 'monthly') || goalRows[0];
        setTenantGoal({
          id: activeGoal.id,
          period: activeGoal.period || 'monthly',
          revenue_goal: Number(activeGoal.revenue_goal || 0),
          appointments_goal: Number(activeGoal.appointments_goal || 0),
          clients_goal: Number(activeGoal.clients_goal || 0),
          active: Boolean(activeGoal.active),
        });
      } else {
        setTenantGoal(null);
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

      // Inicializa para todos os colaboradores do staff
      for (const s of staffById.values()) {
        initStaffMetrics(s.id);
      }

      let houseCashRevenue = 0;
      let houseClubVolume = 0;
      let houseTotalRevenue = 0;
      let houseTotalCommissions = 0;
      let houseTotalAttendances = 0;

      // Agrupamento temporal para gráfico dinâmico de evolução
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

        // Segregação de pagamento (Caixa vs. Consumo de Créditos do Clube)
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

        // Registro na timeline (por dia YYYY-MM-DD em horário local)
        const dayKey = targetDate ? formatLocalYMD(new Date(targetDate)) : 'outros';
        const currentDay = timelineMap.get(dayKey) || { cash: 0, club: 0, total: 0, count: 0 };
        timelineMap.set(dayKey, {
          cash: currentDay.cash + comandaCash,
          club: currentDay.club + comandaClub,
          total: currentDay.total + effectiveTotal,
          count: currentDay.count + 1,
        });

        // 4. Atribuição de Faturamento e Atendimentos por Barbeiro
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

        // 5. Apuração Canônica de Comissões (100% idêntica a /reports)
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
          // Fallback para itens e participantes
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

      // Montagem do ranking de barbeiros
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

        // Apenas inclui colaboradores com papel operacional ou com produção no período
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

      // Ordena por maior faturamento total (critério desempate: atendimentos)
      builtStaffList.sort((a, b) => {
        if (b.total_revenue !== a.total_revenue) {
          return b.total_revenue - a.total_revenue;
        }
        return b.appointments_count - a.appointments_count;
      });

      setRankedStaff(builtStaffList);

      // Totais consolidados da unidade
      const avgTicket =
        houseTotalAttendances > 0 ? houseTotalRevenue / houseTotalAttendances : 0;
      const netMargin = Math.max(0, houseTotalRevenue - houseTotalCommissions);
      const netMarginPercent =
        houseTotalRevenue > 0 ? (netMargin / houseTotalRevenue) * 100 : 0;

      setTotals({
        totalRevenue: houseTotalRevenue,
        cashRevenue: houseCashRevenue,
        clubCreditVolume: houseClubVolume,
        totalAttendances: houseTotalAttendances,
        averageTicket: avgTicket,
        totalCommissions: houseTotalCommissions,
        netMargin,
        netMarginPercent,
      });

      // Timeline de evolução ordenada por data
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
      setTimeline(sortedDays);
    } catch (err: any) {
      console.error('Erro ao carregar dados de performance:', err);
      setToast({
        msg: err.message || 'Falha ao carregar indicadores de performance',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters, dateRegime, clubSupabase, sharedSupabase]);

  useEffect(() => {
    void fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Exportação rápida de dados de performance em CSV
  const handleExportCSV = () => {
    if (rankedStaff.length === 0) return;
    const header = [
      'Posição',
      'Profissional',
      'Cargo',
      'Atendimentos',
      'Faturamento Total (R$)',
      'Faturamento Caixa (R$)',
      'Consumo Clube (R$)',
      'Ticket Médio (R$)',
      'Comissão Acumulada (R$)',
      'Participação (%)',
    ].join(';');

    const rows = rankedStaff.map((s, idx) =>
      [
        `#${idx + 1}`,
        `"${s.name}"`,
        `"${s.role}"`,
        s.appointments_count,
        s.total_revenue.toFixed(2),
        s.cash_revenue.toFixed(2),
        s.club_credit_volume.toFixed(2),
        s.average_ticket.toFixed(2),
        s.commission_generated.toFixed(2),
        s.share_percentage.toFixed(2),
      ].join(';'),
    );

    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `performance_equipe_${filters.dateFrom}_${filters.dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cálculos de atingimento de metas (public.tenant_goals)
  const goalProgress = useMemo(() => {
    if (!tenantGoal) return null;
    const revGoal = tenantGoal.revenue_goal;
    const apptGoal = tenantGoal.appointments_goal;

    const revPct = revGoal > 0 ? (totals.totalRevenue / revGoal) * 100 : 0;
    const apptPct =
      apptGoal > 0 ? (totals.totalAttendances / apptGoal) * 100 : 0;

    return {
      revenueGoal: revGoal,
      appointmentsGoal: apptGoal,
      revPct: Math.min(100, revPct),
      rawRevPct: revPct,
      apptPct: Math.min(100, apptPct),
      rawApptPct: apptPct,
      periodLabel:
        tenantGoal.period === 'monthly'
          ? 'Mensal'
          : tenantGoal.period === 'weekly'
            ? 'Semanal'
            : 'Anual',
    };
  }, [tenantGoal, totals]);

  // Top 3 do pódio
  const topThree = useMemo(() => {
    return rankedStaff.slice(0, 3).filter((s) => s.total_revenue > 0);
  }, [rankedStaff]);

  // Gráfico de evolução: cálculo dos pontos máximos
  const chartMax = useMemo(() => {
    if (timeline.length === 0) return 100;
    const maxVal = Math.max(...timeline.map((t) => t.total));
    return maxVal > 0 ? maxVal : 100;
  }, [timeline]);

  return (
    <div className="space-y-7 max-w-7xl mx-auto w-full animate-fade-in pb-12">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Cabeçalho Principal & Controles de Período */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-border-dark">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-2xl">
              trending_up
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Performance & Inteligência de Equipe
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Auditoria em tempo real de faturamento operacional, metas ativas e produtividade individual dos barbeiros.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={rankedStaff.length === 0 || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-card-dark text-slate-700 dark:text-slate-200 hover:border-amber-500/40 hover:text-amber-500 transition-all disabled:opacity-50"
            title="Exportar planilha de performance dos profissionais"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-primary text-night hover:bg-primary-hover shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Auditoria de Vendas
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Período e Seletor de Regime Temporal */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* DateRangeFilter */}
        <div className="flex-1">
          <DateRangeFilter
            startDate={filters.dateFrom}
            endDate={filters.dateTo}
            onStartDateChange={(dateFrom) =>
              setFilters((prev) => ({ ...prev, dateFrom }))
            }
            onEndDateChange={(dateTo) =>
              setFilters((prev) => ({ ...prev, dateTo }))
            }
            onPresetChange={(p) => setPreset(p)}
          />
        </div>

        {/* Seletor de Regime: Atendimento (Padrão) vs. Pagamento / Caixa */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-border-dark">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Regime:
          </span>
          <div
            className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700"
            role="group"
            aria-label="Regime de Data da Performance"
          >
            <button
              type="button"
              onClick={() => setDateRegime('attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'attendance'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">event_available</span>
              <span>Data do Atendimento</span>
            </button>

            <button
              type="button"
              onClick={() => setDateRegime('payment')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'payment'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">payments</span>
              <span>Data do Pagamento / Caixa</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Cards Principais de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Gerado (Caixa + Clube) */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-emerald-500/30 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Faturamento Gerado
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {fmt(totals.totalRevenue)}
          </h3>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-border-dark flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Caixa: <strong className="text-slate-700 dark:text-slate-200">{fmt(totals.cashRevenue)}</strong></span>
            <span>Clube: <strong className="text-amber-500">{fmt(totals.clubCreditVolume)}</strong></span>
          </div>
        </div>

        {/* Total de Atendimentos */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total de Atendimentos
            </span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
            {fmtNumber(totals.totalAttendances)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Comandas finalizadas e apuradas no período
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ticket Médio Global
            </span>
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <span className="material-symbols-outlined text-lg">confirmation_number</span>
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
            {fmt(totals.averageTicket)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Valor médio por cliente / atendimento
          </p>
        </div>

        {/* Comissões Geradas */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-amber-500/30 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Comissões da Equipe
            </span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-amber-500 dark:text-amber-400 tabular-nums">
            {fmt(totals.totalCommissions)}
          </h3>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-border-dark flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Margem Casa: <strong className="text-emerald-500">{fmt(totals.netMargin)}</strong></span>
            <span>({totals.netMarginPercent.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Seção de Metas da Unidade (public.tenant_goals) */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <span className="material-symbols-outlined text-xl">flag</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Metas Operacionais da Barbearia
                {goalProgress && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    Ciclo {goalProgress.periodLabel}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento em tempo real do atingimento das metas configuradas no estabelecimento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            Gerenciar Metas
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>

        {goalProgress && (goalProgress.revenueGoal > 0 || goalProgress.appointmentsGoal > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Meta de Faturamento */}
            <div className="space-y-2 bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Meta de Faturamento
                </span>
                <span className="font-black text-amber-500 text-sm">
                  {goalProgress.rawRevPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalProgress.rawRevPct >= 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${goalProgress.revPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Realizado: <strong>{fmt(totals.totalRevenue)}</strong></span>
                <span>Alvo: <strong>{fmt(goalProgress.revenueGoal)}</strong></span>
              </div>
            </div>

            {/* Meta de Atendimentos */}
            <div className="space-y-2 bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Meta de Atendimentos
                </span>
                <span className="font-black text-amber-500 text-sm">
                  {goalProgress.rawApptPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalProgress.rawApptPct >= 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${goalProgress.apptPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Realizado: <strong>{fmtNumber(totals.totalAttendances)}</strong></span>
                <span>Alvo: <strong>{fmtNumber(goalProgress.appointmentsGoal)} atendimentos</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 px-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <span className="material-symbols-outlined text-amber-500 text-2xl">info</span>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Nenhuma meta ativa cadastrada no estabelecimento
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cadastre metas de faturamento e volume de atendimentos em Configurações para acompanhar o ritmo da equipe em tempo real.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-all shrink-0"
            >
              Definir Metas
            </button>
          </div>
        )}
      </div>

      {/* Gráfico Dinâmico de Evolução no Período */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-lg">show_chart</span>
              Evolução Diária de Produção
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição do faturamento gerado (Caixa Direto + Consumo do Clube) ao longo do período selecionado.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Caixa Direto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Consumo Clube
            </span>
          </div>
        </div>

        {timeline.length > 0 ? (
          <div className="space-y-4">
            {/* Visualização em Barras Proporcionais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-10 gap-2 items-end pt-4 min-h-[160px]">
              {timeline.slice(-14).map((point) => {
                const heightPct = Math.max(8, Math.min(100, (point.total / chartMax) * 100));
                const cashPct = point.total > 0 ? (point.cash / point.total) * 100 : 100;
                const clubPct = point.total > 0 ? (point.club / point.total) * 100 : 0;

                return (
                  <div key={point.key} className="flex flex-col items-center gap-1.5 group">
                    <div className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {fmt(point.total)}
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800/80 rounded-lg h-36 flex flex-col justify-end overflow-hidden p-1">
                      <div
                        className="w-full rounded-md flex flex-col overflow-hidden transition-all duration-300"
                        style={{ height: `${heightPct}%` }}
                        title={`${point.label}: Total ${fmt(point.total)} (${point.count} atendimentos)`}
                      >
                        {clubPct > 0 && (
                          <div
                            className="w-full bg-amber-500"
                            style={{ height: `${clubPct}%` }}
                          />
                        )}
                        <div
                          className="w-full bg-emerald-500"
                          style={{ height: `${cashPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                      {point.label.slice(0, 5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-center text-slate-400 pt-2">
              Mostrando os dias com produção ativa no período selecionado ({timeline.length} dia(s) com movimento registrado).
            </p>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-40">query_stats</span>
            <p className="text-xs font-medium">Nenhum registro de faturamento encontrado no período.</p>
          </div>
        )}
      </div>

      {/* Pódio dos Top 3 Barbeiros (se houver dados) */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((barber, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const medalClass = isFirst
              ? 'border-amber-400/60 bg-amber-500/10 text-amber-400'
              : isSecond
                ? 'border-slate-300/40 bg-slate-300/10 text-slate-200'
                : 'border-amber-700/40 bg-amber-700/10 text-amber-600';
            const badgeLabel = isFirst ? '🥇 #1 Top Performer' : isSecond ? '🥈 #2 Destaque' : '🥉 #3 Destaque';

            return (
              <div
                key={barber.id}
                className={`p-5 rounded-xl border bg-white dark:bg-card-dark shadow-sm flex flex-col justify-between ${
                  isFirst ? 'border-amber-500/40' : 'border-slate-200 dark:border-border-dark'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${medalClass}`}>
                      {badgeLabel}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {barber.share_percentage.toFixed(1)}% da casa
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-200">
                      {barber.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {barber.name}
                      </h4>
                      <p className="text-xs text-slate-400 capitalize">
                        {barber.role}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-border-dark space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Faturamento Produzido:</span>
                    <strong className="text-emerald-500 dark:text-emerald-400 font-black">
                      {fmt(barber.total_revenue)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Atendimentos:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {barber.appointments_count} clientes
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Comissão Gerada:</span>
                    <strong className="text-amber-500 font-bold">
                      {fmt(barber.commission_generated)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela Completa de Ranking e Performance Individual */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-lg">military_tech</span>
              Ranking Geral de Produtividade da Equipe
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Classificação por volume de produção, comissões apuradas e participação percentual na receita total.
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 self-start sm:self-auto">
            {rankedStaff.length} profissional(is) cadastrado(s)
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-amber-500">
              progress_activity
            </span>
            <p className="text-xs font-medium">Consolidando métricas e comissões da equipe...</p>
          </div>
        ) : rankedStaff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-900/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-border-dark">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Pos.</th>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4 text-center">Atendimentos</th>
                  <th className="py-3 px-4 text-right">Faturamento Total</th>
                  <th className="py-3 px-4">Composição da Receita</th>
                  <th className="py-3 px-4 text-right">Ticket Médio</th>
                  <th className="py-3 px-4 text-right">Comissão Gerada</th>
                  <th className="py-3 px-4 text-center w-36">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                {rankedStaff.map((staff, idx) => {
                  const isTopOne = idx === 0 && staff.total_revenue > 0;
                  const isTopTwo = idx === 1 && staff.total_revenue > 0;
                  const isTopThree = idx === 2 && staff.total_revenue > 0;

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Posição */}
                      <td className="py-3.5 px-4 text-center">
                        {isTopOne ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs border border-amber-500/40">
                            1
                          </span>
                        ) : isTopTwo ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 font-black text-xs border border-slate-300/40">
                            2
                          </span>
                        ) : isTopThree ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 font-black text-xs border border-amber-700/40">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Profissional */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0">
                            {staff.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {staff.name}
                            </p>
                            <p className="text-[11px] text-slate-400 capitalize">
                              {staff.role}
                              {staff.commission_rate != null && (
                                <span className="text-amber-500/90 ml-1">
                                  ({Number(staff.commission_rate) > 1 ? Number(staff.commission_rate) : Number(staff.commission_rate) * 100}%)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Atendimentos */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {staff.appointments_count}
                      </td>

                      {/* Faturamento Total */}
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {fmt(staff.total_revenue)}
                      </td>

                      {/* Composição da Receita */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Caixa: {fmt(staff.cash_revenue)}
                          </span>
                          {staff.club_credit_volume > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Clube: {fmt(staff.club_credit_volume)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ticket Médio */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                        {fmt(staff.average_ticket)}
                      </td>

                      {/* Comissão Gerada */}
                      <td className="py-3.5 px-4 text-right font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                        {fmt(staff.commission_generated)}
                      </td>

                      {/* Participação na Casa */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, staff.share_percentage)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-10 text-right">
                            {staff.share_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">group_off</span>
            <p className="text-sm font-medium">Nenhum dado de produtividade encontrado para o período selecionado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Performance;
