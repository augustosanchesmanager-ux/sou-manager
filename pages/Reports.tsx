import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getScopedClient, getSharedClient } from '../services/supabaseClient';
import DateRangeFilter, { type DatePreset } from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import { getDashboardKpis } from '../src/modules/dashboard/rpc';
import type { DashboardKpiFinancial, DashboardKpiPeriod } from '../src/modules/dashboard/kpiTypes';
import {
  canonicalPeriodLabel,
  INITIAL_CANONICAL_PERIOD,
  resolveCanonicalPeriod,
} from '../src/modules/reports/presetMapping';
import { getEffectiveCommissionRate } from '../src/lib/staff/roles';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// YYYY-MM-DD puro — evita parse UTC (new Date('YYYY-MM-DD') = midnight UTC,
// que em America/Sao_Paulo renderiza o dia ANTERIOR).
const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

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

interface PaymentBadgeInfo {
  label: string;
  amount: number;
  isClubCredit: boolean;
  toneClass: string;
}

interface SaleRecord {
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

const isOnlineAppointment = (appt?: {
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

const formatPaymentMethodBadge = (
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
  if (m === 'credit' || m === 'credito' || m === 'crédito' || m === 'cartao_credito' || m === 'cartão de crédito') {
    return {
      label: 'Cartão Crédito',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30',
    };
  }
  if (m === 'debit' || m === 'debito' || m === 'débito' || m === 'cartao_debito' || m === 'cartão de débito') {
    return {
      label: 'Cartão Débito',
      amount,
      isClubCredit: false,
      toneClass:
        'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
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

const Reports: React.FC = () => {
  const { tenantId } = useAuth();
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'chefclub' | 'sales'>('chefclub');

  const [filters, setFilters] = useState<FilterState>(getInitialMonthRange);
  const [dateRegime, setDateRegime] = useState<DateRegime>('payment');
  const [isTruncated, setIsTruncated] = useState<boolean>(false);

  // ─── Período canônico (§5 do Design Gate) ────────────────────
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [anchorPeriod, setAnchorPeriod] = useState<DashboardKpiPeriod>(INITIAL_CANONICAL_PERIOD);
  const { period: canonicalPeriod, isMapped } = resolveCanonicalPeriod(preset, anchorPeriod);

  const [chefClubStats, setChefClubStats] = useState({
    activeSubscriptions: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    popularPlan: null as string | null,
  });

  const [sales, setSales] = useState<SaleRecord[]>([]);

  // KPIs vêm EXCLUSIVAMENTE do RPC canônico — zero recálculo local (§4.4/§4.5).
  const [kpi, setKpi] = useState<DashboardKpiFinancial | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const handlePresetChange = useCallback((nextPreset: DatePreset) => {
    setPreset(nextPreset);
    setAnchorPeriod((prevAnchor) => resolveCanonicalPeriod(nextPreset, prevAnchor).anchor);
  }, []);

  const fetchChefClubData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [subsRes, creditsRes, plansRes] = await Promise.all([
        clubSupabase
          .from('customer_subscriptions')
          .select('id, status, plan_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        clubSupabase
          .from('customer_credits')
          .select('available_credits, used_credits')
          .eq('tenant_id', tenantId),
        clubSupabase
          .from('customer_plans')
          .select('id, name')
          .eq('tenant_id', tenantId),
      ]);

      const activeCount = (subsRes.data || []).length;
      const planMap = new Map((plansRes.data || []).map((p: any) => [p.id, p.name]));

      const planCounts = new Map<string, number>();
      (subsRes.data || []).forEach((sub: any) => {
        const planName = planMap.get(sub.plan_id) || 'Standard';
        planCounts.set(planName, (planCounts.get(planName) || 0) + 1);
      });

      let popularPlan: string | null = null;
      let maxCount = 0;
      planCounts.forEach((count, plan) => {
        if (count > maxCount) {
          maxCount = count;
          popularPlan = plan;
        }
      });

      let totalAvailable = 0;
      let totalUsed = 0;
      (creditsRes.data || []).forEach((c: any) => {
        totalAvailable += Number(c.available_credits || 0);
        totalUsed += Number(c.used_credits || 0);
      });

      setChefClubStats({
        activeSubscriptions: activeCount,
        totalCreditsAvailable: totalAvailable,
        totalCreditsUsed: totalUsed,
        popularPlan,
      });
    } catch (err) {
      console.error('Erro ao buscar dados do Clube:', err);
      setToast({ msg: 'Erro ao carregar dados do Clube', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, clubSupabase]);

  // Detalhamento de vendas enriquecido (somente leitura, isolamento por tenant_id)
  const fetchSales = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Montagem explícita com offset do Brasil (-03:00) para eliminar desvio de 3h UTC
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

      const truncated = rawComandas.length > MAX_DISPLAY_RECORDS;
      const comandasSlice = truncated ? rawComandas.slice(0, MAX_DISPLAY_RECORDS) : rawComandas;

      const comandaIds = comandasSlice.map((c: any) => c.id).filter(Boolean);
      const appointmentIds = Array.from(
        new Set(comandasSlice.map((c: any) => c.appointment_id).filter(Boolean)),
      ) as string[];
      const clientIds = Array.from(
        new Set(comandasSlice.map((c: any) => c.client_id).filter(Boolean)),
      ) as string[];

      // Consultas de enriquecimento em paralelo (estritamente SELECT com tenant_id)
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

      const staffById = new Map<string, { id: string; name: string; role: string; commission_rate: number | null }>();
      for (const s of staffRes.data || []) {
        staffById.set(s.id, {
          id: s.id,
          name: String(s.name || 'Profissional'),
          role: String(s.role || 'barber'),
          commission_rate: s.commission_rate ?? null,
        });
      }

      const appointmentById = new Map<string, { id: string; start_time?: string | null; source?: string | null; channel?: string | null }>();
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

        // Filtro fino por janela em America/Sao_Paulo conforme o regime selecionado
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

        // Profissionais envolvidos (comanda + comanda_items + service_execution_participants)
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

        // Resumo de itens
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

        // Segregação de pagamentos: comanda_payments (ADR-018) com fallback para comandas.payment_method
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
          // Agrupar por método
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
          // Fallback para comandas que não possuem linhas em comanda_payments
          badges.push(
            formatPaymentMethodBadge(comanda.payment_method, comandaTotal, comandaIsClub),
          );
          if (comandaIsClub) {
            clubCreditVolume += comandaTotal;
          } else {
            cashRevenue += comandaTotal;
          }
        }

        // Cálculo de comissão gerada na comanda:
        // 1) Prioriza soma líquida de commission_records (active / com reversões)
        // 2) Fallback: cálculo pelos itens/participantes quando não há registro em commission_records
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
                const pid = part.professional_id || part.staff_id || item.staff_id || comanda.staff_id;
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
          status: String(comanda.status || 'paid'),
        });
      }

      // Ordenação decrescente pelo critério temporal ativo
      builtRecords.sort((a, b) => {
        const da =
          dateRegime === 'attendance'
            ? new Date(a.attendance_date).getTime()
            : new Date(a.payment_date || a.attendance_date).getTime();
        const db =
          dateRegime === 'attendance'
            ? new Date(b.attendance_date).getTime()
            : new Date(b.payment_date || b.attendance_date).getTime();
        return db - da;
      });

      setIsTruncated(truncated);
      setSales(builtRecords);
    } catch (err) {
      console.error('Erro ao buscar vendas:', err);
      setToast({ msg: 'Erro ao carregar vendas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, clubSupabase, sharedSupabase, filters.dateFrom, filters.dateTo, dateRegime]);

  // Efeito dedicado à aba Clube dos Chefs (não re-executa ao mudar filtros de data de vendas)
  useEffect(() => {
    if (!tenantId || activeTab !== 'chefclub') return;
    void fetchChefClubData();
  }, [tenantId, activeTab, fetchChefClubData]);

  // Efeito dedicado à aba Vendas
  useEffect(() => {
    if (!tenantId || activeTab !== 'sales') return;
    void fetchSales();
  }, [tenantId, activeTab, fetchSales]);

  // Cards canônicos: período derivado do preset ativo (nunca do intervalo livre).
  useEffect(() => {
    if (!tenantId || activeTab !== 'sales') return;

    let cancelled = false;
    setKpiLoading(true);
    getDashboardKpis(canonicalPeriod)
      .then((result) => {
        if (!cancelled) {
          setKpi(result?.financial ?? null);
          setKpiError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setKpi(null);
          setKpiError(err.message || 'Falha ao carregar KPIs canônicos');
        }
      })
      .finally(() => {
        if (!cancelled) setKpiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, activeTab, canonicalPeriod]);

  // Totalizadores rápidos calculados diretamente sobre o período e regime selecionados
  const periodTotals = useMemo(() => {
    return sales.reduce(
      (acc, sale) => {
        acc.cashRevenue += sale.cash_revenue;
        acc.clubCreditVolume += sale.club_credit_volume;
        acc.totalCommissions += sale.commission_generated;
        acc.totalAttendances += 1;
        return acc;
      },
      {
        cashRevenue: 0,
        clubCreditVolume: 0,
        totalCommissions: 0,
        totalAttendances: 0,
      },
    );
  }, [sales]);

  const tabs = [
    { id: 'chefclub', label: 'Clube dos Chefs', icon: 'workspace_premium' },
    { id: 'sales', label: 'Vendas', icon: 'point_of_sale' },
  ];

  const renderKpiCard = (label: string, value: string, tone: string, helper?: string) => (
    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">{label}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      {helper && <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>}
    </div>
  );

  const renderSalesTab = () => {
    const detailRange =
      filters.dateFrom || filters.dateTo
        ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : '—'} → ${filters.dateTo ? fmtDate(filters.dateTo) : '—'}`
        : 'Todo o período';

    const regimeLabel =
      dateRegime === 'payment' ? 'Regime de Caixa (Data do Pagamento)' : 'Competência (Data do Atendimento)';

    const growthText = kpi?.growth == null ? '—' : `${(kpi.growth * 100).toFixed(1)}%`;

    return (
      <div className="space-y-5">
        {/* Seletor de Regime Temporal (Atendimento vs. Pagamento/Caixa) */}
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Critério Temporal da Auditoria
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha se o período selecionado filtra as comandas pela data em que o serviço ocorreu ou pela data da baixa financeira.
            </p>
          </div>

          <div
            className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 shrink-0"
            role="group"
            aria-label="Seletor de Regime de Data"
          >
            <button
              type="button"
              onClick={() => setDateRegime('payment')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'payment'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">payments</span>
              <span>Data do Pagamento / Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setDateRegime('attendance')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'attendance'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">event_available</span>
              <span>Data do Atendimento</span>
            </button>
          </div>
        </div>

        {/* Cards Totalizadores Rápidos do Período Selecionado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-card-dark rounded-xl border border-emerald-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Faturamento de Caixa
              </p>
              <span className="material-symbols-outlined text-emerald-500 text-lg">account_balance_wallet</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {fmt(periodTotals.cashRevenue)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Apenas Dinheiro, PIX e Cartões ({detailRange})
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-amber-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Consumo Créditos do Clube
              </p>
              <span className="material-symbols-outlined text-amber-500 text-lg">workspace_premium</span>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {fmt(periodTotals.clubCreditVolume)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Volume facial de assinaturas (isolado do caixa)
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-sky-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Comissões Geradas
              </p>
              <span className="material-symbols-outlined text-sky-500 text-lg">badge</span>
            </div>
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400 tabular-nums">
              {fmt(periodTotals.totalCommissions)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Total apurado nas comandas do período
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Total de Atendimentos
              </p>
              <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {periodTotals.totalAttendances}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Comandas baixadas no filtro ativo
            </p>
          </div>
        </div>

        {!isMapped && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined align-middle text-sm mr-1">info</span>
            Período dos KPIs institucionais: <strong>{canonicalPeriodLabel(canonicalPeriod)}</strong>
            <span className="mx-2 text-amber-500/60">·</span>
            Auditoria e totalizadores acima: <strong>{detailRange}</strong> ({regimeLabel})
          </div>
        )}

        {/* KPIs Canônicos Consolidados (RPC get_dashboard_kpis) */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Resumo Executivo (DRE / Caixa)</h3>
              <p className="text-sm text-slate-500">
                KPIs canônicos: {canonicalPeriodLabel(canonicalPeriod)}
              </p>
            </div>
          </div>

          {kpiError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
              KPIs canônicos indisponíveis: {kpiError}. A auditoria detalhada abaixo continua
              funcionando com os filtros selecionados.
            </div>
          )}

          {kpiError ? (
            <div className="flex items-center justify-center py-4 text-sm font-semibold text-slate-400">
              KPIs indisponíveis — consulte os totalizadores do período e o detalhamento abaixo.
            </div>
          ) : kpiLoading || !kpi ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {renderKpiCard('Faturamento Líquido', fmt(kpi.revenue), 'text-emerald-600', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Despesas', fmt(kpi.expenses), 'text-slate-700 dark:text-slate-200', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Resultado', fmt(kpi.result), kpi.result >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Ticket Médio', fmt(kpi.average_ticket), 'text-[#007BFF] dark:text-[#00D2FF]', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Crescimento', growthText, 'text-indigo-600 dark:text-indigo-300', 'vs. período anterior')}
            </div>
          )}
        </div>

        {isTruncated && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>
              Exibindo os primeiros <strong>{MAX_DISPLAY_RECORDS}</strong> registros do intervalo selecionado. Para auditorias mais extensas, refine o filtro de datas.
            </span>
          </div>
        )}

        {/* Tabela de Auditoria de Comandas */}
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Auditoria de Comandas no Período
              </h4>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {sales.length} {sales.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {detailRange} · {regimeLabel} (BRT -03:00)
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">receipt_long</span>
              <p className="text-sm font-semibold text-slate-500">Nenhuma comanda encontrada no período e regime selecionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Comanda</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Data Atendimento</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Data Pagamento</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Canal</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Cliente</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Profissional(is)</th>
                    <th className="px-3.5 py-2.5 font-bold">Itens</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Forma de Pagamento</th>
                    <th className="px-3.5 py-2.5 font-bold text-right whitespace-nowrap">Valor Total</th>
                    <th className="px-3.5 py-2.5 font-bold text-right whitespace-nowrap">Comissão Gerada</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Comanda (#ID) */}
                      <td className="px-3.5 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap" title={sale.id}>
                        {sale.short_id}
                      </td>

                      {/* Data Atendimento */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDateTime(sale.attendance_date)}
                      </td>

                      {/* Data Pagamento */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDateTime(sale.payment_date)}
                      </td>

                      {/* Canal */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {sale.channel === 'online' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <span aria-hidden="true">🌐</span>
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                            <span aria-hidden="true">🏬</span>
                            <span>Balcão</span>
                          </span>
                        )}
                      </td>

                      {/* Cliente + Indicador Assinante do Clube */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {sale.client_name}
                          </span>
                          {sale.is_club_member && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              title="Assinante do Clube dos Chefes"
                            >
                              <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                              Clube
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Profissional(is) */}
                      <td className="px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {sale.staff_names.length > 0 ? sale.staff_names.join(', ') : '—'}
                      </td>

                      {/* Itens (resumo) */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[240px]">
                        <div className="truncate" title={sale.items_summary}>
                          {sale.items_summary}
                        </div>
                      </td>

                      {/* Forma de Pagamento */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          {sale.payment_badges.map((badge, idx) => (
                            <span
                              key={`${sale.id}-pay-${idx}`}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.toneClass}`}
                            >
                              <span>{badge.label}</span>
                              {sale.payment_badges.length > 1 && (
                                <span className="opacity-80">({fmt(badge.amount)})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white text-right tabular-nums whitespace-nowrap">
                        {fmt(sale.total)}
                      </td>

                      {/* Comissão Gerada */}
                      <td className="px-3.5 py-3 font-bold text-sky-600 dark:text-sky-400 text-right tabular-nums whitespace-nowrap">
                        {fmt(sale.commission_generated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (loading && activeTab === 'chefclub') {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'chefclub':
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">workspace_premium</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Clube dos Chefs</h3>
                  <p className="text-sm text-slate-500">Programa de fidelidade</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Assinantes Ativos</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.activeSubscriptions}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Usados</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.totalCreditsUsed}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Disponíveis</p>
                  <p className="text-3xl font-black text-emerald-600">{chefClubStats.totalCreditsAvailable}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Plano Mais Popular</p>
                  <p className="text-xl font-black text-amber-600 truncate">{chefClubStats.popularPlan || 'N/A'}</p>
                </div>
              </div>

              {chefClubStats.activeSubscriptions > 0 && (
                <div className="mt-4 pt-4 border-t border-amber-500/20">
                  <a
                    href="/chef-club-subscriptions"
                    className="text-sm font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    Ver todos os assinantes
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );

      case 'sales':
        return renderSalesTab();
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-slate-500">Visão completa de faturamento, caixa e auditoria operacional</p>
        </div>
        <DateRangeFilter
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
          onStartDateChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
          onEndDateChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          onPresetChange={handlePresetChange}
          showPresets={true}
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'chefclub' | 'sales')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Reports;
