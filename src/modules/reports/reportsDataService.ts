/**
 * src/modules/reports/reportsDataService.ts
 *
 * Camada de dados unificada para a Central de Relatórios (/reports).
 * - Multi-tenant estrito (tenant_id em todas as queries).
 * - Fuso horário local BRT (-03:00) para cortes de data consistentes.
 * - Rateio determinístico de descontos e comissões via allocateComandaDiscounts().
 * - Zero migrations/RPCs novas: consome estritamente tabelas existentes.
 */

import { getScopedClient, getSharedClient } from '../../../services/supabaseClient';
import {
  allocateComandaDiscounts,
  roundCurrency,
  type AllocatedComandaItem,
  type RawComandaItem,
} from '../../utils/financial/discountAllocation';
import { getEffectiveCommissionRateForItem } from '../../lib/staff/roles';

export type PaymentCategoryKey = 'pix' | 'credit' | 'debit' | 'cash' | 'club' | 'other';

export interface PaidComandaDetail {
  id: string;
  shortId: string;
  closedAt: string;
  clientId: string | null;
  clientName: string;
  staffNames: string[];
  paymentMethodLabels: string[];
  primaryPaymentCategory: PaymentCategoryKey;
  paymentBreakdown: Record<PaymentCategoryKey, number>;
  catalogTotal: number;
  discountTotal: number;
  appliedTotal: number;
  commissionTotal: number;
  allocatedItems: AllocatedComandaItemDetail[];
}

export interface AllocatedComandaItemDetail extends AllocatedComandaItem {
  closedAt: string;
  comandaShortId: string;
  clientName: string;
  paymentMethodLabel: string;
  isClubCredit: boolean;
}

export interface AppointmentReportRow {
  id: string;
  startTime: string;
  clientName: string;
  clientPhone: string;
  staffId: string;
  staffName: string;
  serviceNames: string;
  durationMinutes: number;
  rawStatus: string;
  statusCategory: 'completed' | 'scheduled' | 'cancelled' | 'no_show';
}

export interface ProductSalesReportRow {
  productId: string;
  productName: string;
  category: string;
  quantitySold: number;
  catalogTotal: number;
  discountTotal: number;
  appliedTotal: number;
  unitCost: number;
  cmv: number;
  grossProfit: number;
  marginPct: number;
  currentStock: number;
  minStock: number;
  isCriticalStock: boolean;
  supplierName: string;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  minStock: number;
  isCriticalStock: boolean;
  supplierName: string;
  active: boolean;
}

export interface BarberAdvanceRecord {
  id: string;
  staffId: string;
  amount: number;
  issuedAt: string;
  reason: string;
}

export interface FinancialTitleRow {
  id: string;
  type: 'receivable' | 'payable';
  dueDate: string;
  paidAt: string | null;
  description: string;
  partyName: string; // Cliente ou Fornecedor/Categoria
  category: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  sourceOrigin: 'club_receivable' | 'fiado_comanda' | 'accounts_payable';
}

const CHUNK_SIZE = 150;

export function buildBrtRangeBounds(dateFrom: string, dateTo: string) {
  const startIso = `${dateFrom}T00:00:00.000-03:00`;
  const endIso = `${dateTo}T23:59:59.999-03:00`;
  return {
    startIso,
    endIso,
    startMs: new Date(startIso).getTime(),
    endMs: new Date(endIso).getTime(),
  };
}

export function isTimestampInRange(
  isoOrDate: string | null | undefined,
  startMs: number,
  endMs: number
): boolean {
  if (!isoOrDate) return false;
  // Se vier apenas YYYY-MM-DD, interpreta no meio-dia local BRT para evitar drift UTC
  const normalized = isoOrDate.length === 10 ? `${isoOrDate}T12:00:00.000-03:00` : isoOrDate;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
}

export function classifyPaymentMethod(rawMethod?: string | null, isClub?: boolean): {
  category: PaymentCategoryKey;
  label: string;
} {
  if (isClub) {
    return { category: 'club', label: 'Crédito Clube' };
  }
  const m = String(rawMethod || '').toLowerCase().trim();
  if (m.includes('clube') || m.includes('chef') || m.includes('assinatura') || m === 'membership' || m === 'club_credit') {
    return { category: 'club', label: 'Crédito Clube' };
  }
  if (m === 'pix') {
    return { category: 'pix', label: 'PIX' };
  }
  if (m === 'cash' || m === 'dinheiro') {
    return { category: 'cash', label: 'Dinheiro' };
  }
  if (m.includes('credit') || m.includes('credito') || m.includes('crédito')) {
    return { category: 'credit', label: 'Cartão Crédito' };
  }
  if (m.includes('debit') || m.includes('debito') || m.includes('débito')) {
    return { category: 'debit', label: 'Cartão Débito' };
  }
  return { category: 'other', label: rawMethod ? String(rawMethod) : 'Direto' };
}

async function fetchInChunks<T>(
  client: any,
  table: string,
  column: string,
  ids: string[],
  select: string,
  tenantId: string
): Promise<T[]> {
  if (ids.length === 0) return [];
  const uniqueIds = Array.from(new Set(ids));
  const results: T[] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const batch = uniqueIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await client
      .from(table)
      .select(select)
      .eq('tenant_id', tenantId)
      .in(column, batch);
    if (error) {
      // Falha de query não pode virar lista vazia silenciosa: o relatório passaria a
      // exibir zeros como se não houvesse dados.
      throw new Error(`Falha ao consultar ${table}: ${error.message}`);
    }
    if (Array.isArray(data)) {
      results.push(...data);
    }
  }
  return results;
}

/**
 * Busca comandas finalizadas (paid/closed) no período BRT e processa os itens
 * pelo motor contábil allocateComandaDiscounts().
 */
export async function fetchPaidComandasReport(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{
  comandas: PaidComandaDetail[];
  allocatedItems: AllocatedComandaItemDetail[];
}> {
  const barberSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();
  const { startMs, endMs } = buildBrtRangeBounds(dateFrom, dateTo);

  // Busca comandas pagas/fechadas do tenant com margem ampla para filtrar no cliente com exatidão BRT
  const startBuffer = new Date(startMs - 48 * 60 * 60 * 1000).toISOString();
  const endBuffer = new Date(endMs + 48 * 60 * 60 * 1000).toISOString();

  const { data: rawComandas, error: comandasError } = await barberSupabase
    .from('comandas')
    .select(
      'id, client_id, staff_id, status, total, discount, payment_method, closure_mode, financial_effect, closed_at, settled_at, payment_date_real, created_at'
    )
    .eq('tenant_id', tenantId)
    .in('status', ['paid', 'closed'])
    .gte('created_at', new Date(startMs - 90 * 24 * 60 * 60 * 1000).toISOString())
    .lte('created_at', endBuffer)
    .order('closed_at', { ascending: false, nullsFirst: false });

  if (comandasError) {
    throw comandasError;
  }

  // Filtrar estritamente por closed_at / settled_at no range BRT (fallback seguro apenas se nulo em legado)
  const paidComandas = (rawComandas || []).filter((c: any) => {
    const effectiveDate = c.closed_at || c.settled_at || c.payment_date_real || c.created_at;
    return isTimestampInRange(effectiveDate, startMs, endMs);
  });

  if (paidComandas.length === 0) {
    return { comandas: [], allocatedItems: [] };
  }

  const comandaIds = paidComandas.map((c: any) => c.id);
  const clientIds = paidComandas.map((c: any) => c.client_id).filter(Boolean) as string[];

  const [itemsData, clientsData, staffData, transactionsData] = await Promise.all([
    fetchInChunks<any>(
      barberSupabase,
      'comanda_items',
      'comanda_id',
      comandaIds,
      'id, comanda_id, service_id, product_id, product_name, quantity, unit_price, staff_id',
      tenantId
    ),
    fetchInChunks<any>(
      barberSupabase,
      'clients',
      'id',
      clientIds,
      'id, name',
      tenantId
    ),
    sharedSupabase
      .from('staff')
      .select('id, name, role, commission_rate, product_commission_rate')
      .eq('tenant_id', tenantId)
      .then((res) => res.data || []),
    fetchInChunks<any>(
      barberSupabase,
      'transactions',
      'source_id',
      comandaIds,
      'id, source_id, amount, payment_method, status, type',
      tenantId
    ),
  ]);

  const clientMap = new Map<string, string>();
  clientsData.forEach((cl: any) => { clientMap.set(cl.id, cl.name || 'Cliente Balcão'); });

  const staffMap = new Map<string, any>();
  staffData.forEach((st: any) => { staffMap.set(st.id, st); });

  const itemsByComanda = new Map<string, any[]>();
  itemsData.forEach((it: any) => {
    const list = itemsByComanda.get(it.comanda_id) || [];
    list.push(it);
    itemsByComanda.set(it.comanda_id, list);
  });

  const txByComanda = new Map<string, any[]>();
  transactionsData.forEach((tx: any) => {
    if (tx.type === 'income' && tx.source_id) {
      const list = txByComanda.get(tx.source_id) || [];
      list.push(tx);
      txByComanda.set(tx.source_id, list);
    }
  });

  const resultComandas: PaidComandaDetail[] = [];
  const allAllocatedItems: AllocatedComandaItemDetail[] = [];

  for (const c of paidComandas) {
    const closedAt = c.closed_at || c.settled_at || c.payment_date_real || c.created_at;
    const shortId = `#${String(c.id).slice(0, 6).toUpperCase()}`;
    const clientName = (c.client_id && clientMap.get(c.client_id)) || 'Cliente Balcão';

    const rawItemsForComanda = itemsByComanda.get(c.id) || [];
    const comandaTxs = txByComanda.get(c.id) || [];
    const isLegacyClub =
      c.closure_mode === 'legacy_membership' ||
      c.financial_effect === false ||
      classifyPaymentMethod(c.payment_method).category === 'club';

    // Mapear pagamento
    const paymentBreakdown: Record<PaymentCategoryKey, number> = {
      pix: 0,
      credit: 0,
      debit: 0,
      cash: 0,
      club: 0,
      other: 0,
    };
    const paymentLabelsSet = new Set<string>();

    if (comandaTxs.length > 0) {
      for (const tx of comandaTxs) {
        const { category, label } = classifyPaymentMethod(tx.payment_method, isLegacyClub);
        paymentBreakdown[category] = roundCurrency(paymentBreakdown[category] + Number(tx.amount || 0));
        paymentLabelsSet.add(label);
      }
    } else {
      const { category, label } = classifyPaymentMethod(c.payment_method, isLegacyClub);
      const amt = Number(c.total || 0);
      paymentBreakdown[category] = roundCurrency(amt);
      paymentLabelsSet.add(label);
    }

    const paymentMethodLabels = Array.from(paymentLabelsSet);
    const primaryPaymentLabel = paymentMethodLabels[0] || 'Direto';
    const primaryCategory = classifyPaymentMethod(c.payment_method, isLegacyClub).category;

    // Montar RawComandaItem[] para passar no motor determinístico
    // Schema real de `comanda_items`: service_id/product_id, product_name, unit_price.
    // Não existem colunas item_type, name, price, discount nem commission_rate por linha.
    const rawInputs: RawComandaItem[] = rawItemsForComanda.map((item: any) => {
      const effectiveStaffId = item.staff_id || c.staff_id || '';
      const staffMember = staffMap.get(effectiveStaffId);
      const barberName = staffMember?.name || 'Sem profissional';

      let itemType: 'service' | 'product' | 'club_service' = 'service';
      if (item.product_id) {
        itemType = 'product';
      } else if (isLegacyClub && Number(item.unit_price || 0) === 0) {
        itemType = 'club_service';
      }

      // A taxa efetiva vem do cadastro do profissional (não há taxa por item no schema).
      const commRate = staffMember
        ? getEffectiveCommissionRateForItem(staffMember, {
            item_type: itemType === 'product' ? 'product' : 'service',
          })
        : 0;

      return {
        id: item.id,
        comanda_id: c.id,
        item_name: item.product_name || 'Item',
        item_type: itemType,
        barber_id: effectiveStaffId,
        barber_name: barberName,
        quantity: Number(item.quantity ?? 1),
        // `unit_price` é o preço de tabela da linha; desconto por item não existe no schema.
        unit_price: Number(item.unit_price ?? 0),
        item_discount: 0,
        commission_rate: commRate,
      };
    });

    // Passar pelo motor contábil allocateComandaDiscounts()
    const allocated = allocateComandaDiscounts(rawInputs, Number(c.discount ?? 0));

    const allocatedWithContext: AllocatedComandaItemDetail[] = allocated.map((alloc) => ({
      ...alloc,
      closedAt,
      comandaShortId: shortId,
      clientName,
      paymentMethodLabel: primaryPaymentLabel,
      isClubCredit: alloc.item_type === 'club_service' || isLegacyClub,
    }));

    allAllocatedItems.push(...allocatedWithContext);

    const catalogTotal = roundCurrency(
      allocatedWithContext.reduce((acc, it) => acc + it.catalog_price, 0)
    );
    const discountTotal = roundCurrency(
      allocatedWithContext.reduce((acc, it) => acc + it.total_discount, 0)
    );
    const appliedTotal = roundCurrency(
      allocatedWithContext.reduce((acc, it) => acc + it.applied_amount, 0)
    );
    const commissionTotal = roundCurrency(
      allocatedWithContext.reduce((acc, it) => acc + it.commission_amount, 0)
    );

    const staffSet = new Set<string>();
    allocatedWithContext.forEach((it) => {
      if (it.barber_name && it.barber_name !== 'Sem profissional') {
        staffSet.add(it.barber_name);
      }
    });
    if (staffSet.size === 0 && c.staff_id && staffMap.has(c.staff_id)) {
      staffSet.add(staffMap.get(c.staff_id).name);
    }

    resultComandas.push({
      id: c.id,
      shortId,
      closedAt,
      clientId: c.client_id,
      clientName,
      staffNames: Array.from(staffSet),
      paymentMethodLabels,
      primaryPaymentCategory: primaryCategory,
      paymentBreakdown,
      catalogTotal,
      discountTotal,
      appliedTotal,
      commissionTotal,
      allocatedItems: allocatedWithContext,
    });
  }

  return {
    comandas: resultComandas,
    allocatedItems: allAllocatedItems,
  };
}

/**
 * Busca atendimentos e agendamentos no período (visão operacional da cadeira).
 */
export async function fetchAppointmentsReport(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<AppointmentReportRow[]> {
  const barberSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();
  const { startIso, endIso } = buildBrtRangeBounds(dateFrom, dateTo);

  const { data: appts, error } = await barberSupabase
    .from('appointments')
    .select('id, client_id, staff_id, service_id, start_time, end_time, status, notes')
    .eq('tenant_id', tenantId)
    .gte('start_time', startIso)
    .lte('start_time', endIso)
    .order('start_time', { ascending: false });

  if (error) {
    throw error;
  }

  if (!appts || appts.length === 0) return [];

  const clientIds = appts.map((a: any) => a.client_id).filter(Boolean);
  const serviceIds = appts.map((a: any) => a.service_id).filter(Boolean);

  const [clientsData, servicesData, staffData] = await Promise.all([
    fetchInChunks<any>(barberSupabase, 'clients', 'id', clientIds, 'id, name, phone', tenantId),
    fetchInChunks<any>(barberSupabase, 'services', 'id', serviceIds, 'id, name, duration', tenantId),
    sharedSupabase
      .from('staff')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .then((res) => res.data || []),
  ]);

  const clientMap = new Map<string, { name: string; phone: string }>();
  clientsData.forEach((c: any) => { clientMap.set(c.id, { name: c.name || 'Cliente', phone: c.phone || '' }); });

  const serviceMap = new Map<string, { name: string; duration: number }>();
  servicesData.forEach((s: any) => { serviceMap.set(s.id, { name: s.name || 'Serviço', duration: Number(s.duration || 30) }); });

  const staffMap = new Map<string, string>();
  staffData.forEach((st: any) => { staffMap.set(st.id, st.name || 'Profissional'); });

  return appts.map((a: any) => {
    const clientInfo = (a.client_id && clientMap.get(a.client_id)) || { name: 'Cliente', phone: '' };
    const serviceInfo = (a.service_id && serviceMap.get(a.service_id)) || { name: 'Atendimento', duration: 30 };

    let durationMinutes = serviceInfo.duration;
    if (a.start_time && a.end_time) {
      const diffMins = Math.round(
        (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000
      );
      if (diffMins > 0 && diffMins < 600) {
        durationMinutes = diffMins;
      }
    }

    const rawStatus = String(a.status || 'scheduled').toLowerCase();
    let statusCategory: AppointmentReportRow['statusCategory'] = 'scheduled';
    if (rawStatus === 'completed' || rawStatus === 'concluido' || rawStatus === 'finished') {
      statusCategory = 'completed';
    } else if (rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'cancelado') {
      statusCategory = 'cancelled';
    } else if (rawStatus === 'no_show' || rawStatus === 'noshow' || rawStatus === 'falta') {
      statusCategory = 'no_show';
    }

    return {
      id: a.id,
      startTime: a.start_time,
      clientName: clientInfo.name,
      clientPhone: clientInfo.phone,
      staffId: a.staff_id || '',
      staffName: (a.staff_id && staffMap.get(a.staff_id)) || 'Sem profissional',
      serviceNames: serviceInfo.name,
      durationMinutes,
      rawStatus,
      statusCategory,
    };
  });
}

/**
 * Busca catálogo real de produtos e cruza com os itens vendidos (já rateados via allocateComandaDiscounts).
 */
export async function fetchProductsReport(
  tenantId: string,
  allocatedItems: AllocatedComandaItemDetail[]
): Promise<{
  salesRows: ProductSalesReportRow[];
  catalogItems: ProductCatalogItem[];
}> {
  const barberSupabase = getScopedClient('barber');

  const { data: productsData, error } = await barberSupabase
    .from('products')
    .select('id, name, category, price, sale_price, cost_price, stock_quantity, minimum_stock, min_stock_alert, active')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) {
    throw error;
  }

  const catalogItems: ProductCatalogItem[] = (productsData || []).map((p: any) => {
    const stock = Number(p.stock_quantity ?? 0);
    // Schema real: `minimum_stock` (o campo `min_stock` não existe em produção).
    const minStock = Number(p.minimum_stock ?? p.min_stock_alert ?? 0);
    // Produtos criados pelo módulo Estoque 360 gravam `sale_price` (com `price = 0.00`).
    const effectivePrice = Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price ?? 0);
    return {
      id: p.id,
      name: p.name || 'Produto',
      category: p.category || 'Geral',
      price: effectivePrice,
      costPrice: Number(p.cost_price ?? 0),
      stockQuantity: stock,
      minStock,
      isCriticalStock: p.active !== false && stock <= minStock,
      supplierName: '-',
      active: p.active !== false,
    };
  });

  const catalogByName = new Map<string, ProductCatalogItem>();
  catalogItems.forEach((p) => { catalogByName.set(p.name.toLowerCase().trim(), p); });

  // Agregar vendas por nome de produto a partir dos itens rateados
  const productSalesMap = new Map<string, ProductSalesReportRow>();

  for (const item of allocatedItems) {
    if (item.item_type !== 'product') continue;

    const key = item.item_name.toLowerCase().trim();
    const matchedCatalog = catalogByName.get(key);
    const unitCost = matchedCatalog?.costPrice ?? 0;

    const existing = productSalesMap.get(key) || {
      productId: matchedCatalog?.id || item.id,
      productName: item.item_name,
      category: matchedCatalog?.category || 'Produto',
      quantitySold: 0,
      catalogTotal: 0,
      discountTotal: 0,
      appliedTotal: 0,
      unitCost,
      cmv: 0,
      grossProfit: 0,
      marginPct: 0,
      currentStock: matchedCatalog?.stockQuantity ?? 0,
      minStock: matchedCatalog?.minStock ?? 0,
      isCriticalStock: matchedCatalog?.isCriticalStock ?? false,
      supplierName: matchedCatalog?.supplierName || '-',
    };

    existing.quantitySold += item.quantity;
    existing.catalogTotal = roundCurrency(existing.catalogTotal + item.catalog_price);
    existing.discountTotal = roundCurrency(existing.discountTotal + item.total_discount);
    existing.appliedTotal = roundCurrency(existing.appliedTotal + item.applied_amount);
    existing.cmv = roundCurrency(existing.quantitySold * unitCost);
    existing.grossProfit = roundCurrency(existing.appliedTotal - existing.cmv);
    existing.marginPct =
      existing.appliedTotal > 0
        ? Math.round((existing.grossProfit / existing.appliedTotal) * 1000) / 10
        : 0;

    productSalesMap.set(key, existing);
  }

  const salesRows = Array.from(productSalesMap.values()).sort(
    (a, b) => b.appliedTotal - a.appliedTotal
  );

  return { salesRows, catalogItems };
}

/**
 * Busca vales/adiantamentos exclusivamente da tabela canônica barber_advances.
 */
export async function fetchBarberAdvancesInPeriod(
  tenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<BarberAdvanceRecord[]> {
  const barberSupabase = getScopedClient('barber');
  const { startIso, endIso } = buildBrtRangeBounds(dateFrom, dateTo);

  const { data, error } = await barberSupabase
    .from('barber_advances')
    .select('id, staff_id, amount, issued_at, notes, reversed_at')
    .eq('tenant_id', tenantId)
    .is('reversed_at', null)
    .gte('issued_at', startIso)
    .lte('issued_at', endIso)
    .order('issued_at', { ascending: false });

  if (error) {
    // Se a tabela ainda não existir no ambiente demo/sandbox, degrada graciosamente
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    staffId: row.staff_id,
    amount: Number(row.amount || 0),
    issuedAt: row.issued_at,
    // Schema real: o motivo do vale está em `notes` (não existe coluna `reason`).
    reason: row.notes || 'Vale / Adiantamento',
  }));
}

/**
 * Busca títulos Financeiros (Contas a Receber e Contas a Pagar)
 * Regra estrita do PO:
 * - Contas a Receber consolida exclusivamente customer_subscription_receivables e comandas
 *   efetivamente marcadas como fiado/a prazo (is_fiado = true). NUNCA inclui comandas 'open' de PDV sem is_fiado.
 * - Contas a Pagar lê de accounts_payable.
 */
export async function fetchFinancialTitlesReport(
  tenantId: string,
  dateFrom: string,
  dateTo: string,
  dateField: 'due_date' | 'paid_at'
): Promise<{
  receivables: FinancialTitleRow[];
  payables: FinancialTitleRow[];
}> {
  const barberSupabase = getScopedClient('barber');
  const { startMs, endMs } = buildBrtRangeBounds(dateFrom, dateTo);
  const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const [clubRes, fiadoRes, payableRes] = await Promise.all([
    barberSupabase
      .from('customer_subscription_receivables')
      .select('id, customer_id, due_date, amount, status, paid_at, clients(name)')
      .eq('tenant_id', tenantId),
    barberSupabase
      .from('comandas')
      .select('id, client_id, total, discount, status, is_fiado, fiado_due_date, fiado_marked_at, closed_at, settled_at, payment_date_real, created_at, clients(name)')
      .eq('tenant_id', tenantId)
      .eq('is_fiado', true),
    barberSupabase
      .from('accounts_payable')
      .select('id, name, amount, due_date, category, status, paid_at, notes')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled'),
  ]);

  const receivables: FinancialTitleRow[] = [];

  // 1. Mensalidades do Clube dos Chefes
  if (!clubRes.error && Array.isArray(clubRes.data)) {
    for (const r of clubRes.data as any[]) {
      const targetDate = dateField === 'paid_at' ? r.paid_at : r.due_date;
      if (!isTimestampInRange(targetDate, startMs, endMs)) continue;

      const isPaid = r.status === 'paid';
      const isOverdue = !isPaid && r.due_date && r.due_date < todayYmd;

      receivables.push({
        id: r.id,
        type: 'receivable',
        dueDate: r.due_date || '',
        paidAt: r.paid_at || null,
        description: 'Mensalidade Clube dos Chefes',
        partyName: r.clients?.name || 'Assinante Clube',
        category: 'Assinatura Clube',
        amount: Number(r.amount || 0),
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        sourceOrigin: 'club_receivable',
      });
    }
  }

  // 2. Comandas faturadas a prazo (is_fiado === true, ADR-045)
  if (!fiadoRes.error && Array.isArray(fiadoRes.data)) {
    for (const c of fiadoRes.data as any[]) {
      const dueDate = c.fiado_due_date || (c.fiado_marked_at || c.created_at || '').slice(0, 10);
      const paidAt = c.status === 'paid' || c.status === 'closed' ? c.settled_at || c.payment_date_real || c.closed_at : null;
      const targetDate = dateField === 'paid_at' ? paidAt : dueDate;
      if (!isTimestampInRange(targetDate, startMs, endMs)) continue;

      const isPaid = c.status === 'paid' || c.status === 'closed';
      const isOverdue = !isPaid && dueDate && dueDate < todayYmd;

      receivables.push({
        id: c.id,
        type: 'receivable',
        dueDate,
        paidAt,
        description: `Comanda Fiado #${String(c.id).slice(0, 6).toUpperCase()}`,
        partyName: c.clients?.name || 'Cliente',
        category: 'Fiado / A Prazo',
        amount: roundCurrency(Math.max(0, Number(c.total || 0) - Number(c.discount || 0))),
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        sourceOrigin: 'fiado_comanda',
      });
    }
  }

  // 3. Contas a Pagar (accounts_payable)
  const payables: FinancialTitleRow[] = [];
  if (!payableRes.error && Array.isArray(payableRes.data)) {
    for (const p of payableRes.data as any[]) {
      const targetDate = dateField === 'paid_at' ? p.paid_at : p.due_date;
      if (!isTimestampInRange(targetDate, startMs, endMs)) continue;

      const isPaid = p.status === 'paid';
      const isOverdue = !isPaid && p.due_date && p.due_date < todayYmd;

      payables.push({
        id: p.id,
        type: 'payable',
        dueDate: p.due_date || '',
        paidAt: p.paid_at || null,
        description: p.name || 'Despesa',
        partyName: p.category || 'Despesa Operacional',
        category: p.category || 'Outros',
        amount: Number(p.amount || 0),
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        sourceOrigin: 'accounts_payable',
      });
    }
  }

  receivables.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
  payables.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

  return { receivables, payables };
}
