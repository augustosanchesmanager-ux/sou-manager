import { getScopedClient, supabase } from '../../../services/supabaseClient';
import type { BarberStatementItem } from '../../utils/barberStatement';

export interface StatementStaffMember {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
  commission_rate?: number | string | null;
}

interface RawComandaRow {
  id: string;
  client_id?: string | null;
  staff_id?: string | null;
  status: 'open' | 'paid' | 'cancelled' | 'blocked';
  total?: number | null;
  paid_amount?: number | null;
  created_at: string;
  clients?: { name?: string | null } | null;
}

interface RawComandaItemRow {
  id: string;
  comanda_id: string;
  service_id?: string | null;
  product_name?: string | null;
  unit_price?: number | null;
  quantity?: number | null;
  staff_id?: string | null;
  services?: { name?: string | null } | null;
}

export async function fetchStatementStaff(tenantId: string): Promise<StatementStaffMember[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, avatar, role, commission_rate')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name');

  if (error || !data) {
    return [];
  }

  return data as StatementStaffMember[];
}

export async function fetchBarberStatementData(params: {
  tenantId: string;
  staffId: string;
  startDate: string;
  endDate: string;
  commissionPercentage: number;
}): Promise<BarberStatementItem[]> {
  const { tenantId, staffId, startDate, endDate, commissionPercentage } = params;
  const barberSupabase = getScopedClient('barber');

  // Ajusta limites para ISO completo considerando início e fim do dia em fuso brasileiro (-03:00)
  const startIso = `${startDate}T00:00:00.000-03:00`;
  const endIso = `${endDate}T23:59:59.999-03:00`;

  // 1. Buscar comandas atribuídas diretamente ao profissional no período
  const { data: comandasData } = await barberSupabase
    .from('comandas')
    .select('id, client_id, staff_id, status, total, paid_amount, created_at, clients(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  const staffComandas = (comandasData || []) as unknown as RawComandaRow[];

  // 2. Buscar itens executados pelo profissional no período (inclusive em comandas abertas pela recepção)
  const { data: staffItemsData } = await barberSupabase
    .from('comanda_items')
    .select('id, comanda_id, service_id, product_name, unit_price, quantity, staff_id, created_at, services(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  const directItems = (staffItemsData || []) as unknown as RawComandaItemRow[];

  // 2.1 Buscar itens onde o profissional atuou como participante/assistente
  let participantItems: RawComandaItemRow[] = [];
  try {
    const { data: partData } = await barberSupabase
      .from('service_execution_participants')
      .select('comanda_item_id, staff_id, payout_value, role, payout_type')
      .eq('tenant_id', tenantId)
      .eq('staff_id', staffId);

    const participantItemIds = Array.from(
      new Set((partData || []).map((p: any) => p.comanda_item_id).filter(Boolean))
    );

    if (participantItemIds.length > 0) {
      const { data: pItemsData } = await barberSupabase
        .from('comanda_items')
        .select('id, comanda_id, service_id, product_name, unit_price, quantity, staff_id, created_at, services(name)')
        .in('id', participantItemIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      if (pItemsData) {
        participantItems = pItemsData as unknown as RawComandaItemRow[];
      }
    }
  } catch {
    // Degradação graciosa
  }

  const allDirectItems = [...directItems, ...participantItems];

  // 3. Obter comandas de itens onde o profissional atuou mas comanda.staff_id != staffId
  const directComandaIds = new Set(staffComandas.map((c) => c.id));
  const externalComandaIds = Array.from(
    new Set(allDirectItems.map((it) => it.comanda_id).filter((id) => !directComandaIds.has(id)))
  );

  let externalComandas: RawComandaRow[] = [];
  if (externalComandaIds.length > 0) {
    const { data: extData } = await barberSupabase
      .from('comandas')
      .select('id, client_id, staff_id, status, total, paid_amount, created_at, clients(name)')
      .eq('tenant_id', tenantId)
      .in('id', externalComandaIds)
      .not('status', 'eq', 'cancelled');
    if (extData) {
      externalComandas = extData as unknown as RawComandaRow[];
    }
  }

  // Mapa consolidado de todas as comandas relevantes
  const allComandas = [...staffComandas, ...externalComandas];
  const comandaMap = new Map<string, RawComandaRow>();
  for (const cmd of allComandas) {
    comandaMap.set(cmd.id, cmd);
  }

  // 4. Buscar todos os itens das comandas do profissional (para não perder comandas abertas por ele)
  const allComandaIds = Array.from(comandaMap.keys());
  let itemsByComandaId: Record<string, RawComandaItemRow[]> = {};

  if (allComandaIds.length > 0) {
    const { data: allItemsData } = await barberSupabase
      .from('comanda_items')
      .select('id, comanda_id, service_id, product_name, unit_price, quantity, staff_id, services(name)')
      .in('comanda_id', allComandaIds);

    if (allItemsData) {
      const rawAllItems = allItemsData as unknown as RawComandaItemRow[];
      itemsByComandaId = rawAllItems.reduce((acc: Record<string, RawComandaItemRow[]>, it) => {
        if (!acc[it.comanda_id]) acc[it.comanda_id] = [];
        acc[it.comanda_id].push(it);
        return acc;
      }, {});
    }
  }

  // 5. Buscar registros oficiais de comissão no livro-razão para comandas pagas
  const paidComandaIds = allComandas.filter((c) => c.status === 'paid').map((c) => c.id);
  const recordsByItemId = new Map<string, any>();
  const recordsByComandaId = new Map<string, any>();

  if (paidComandaIds.length > 0) {
    const { data: commRecords } = await barberSupabase
      .from('commission_records')
      .select('id, comanda_id, comanda_item_id, staff_id, gross_value, net_value, commission_value, status, record_type')
      .eq('tenant_id', tenantId)
      .eq('staff_id', staffId)
      .in('comanda_id', paidComandaIds)
      .eq('status', 'active')
      .eq('record_type', 'commission');

    if (commRecords) {
      for (const rec of commRecords) {
        if (rec.comanda_item_id) {
          recordsByItemId.set(rec.comanda_item_id, rec);
        } else {
          recordsByComandaId.set(rec.comanda_id, rec);
        }
      }
    }
  }

  // 6. Montar itens consolidados do extrato
  const statementItems: BarberStatementItem[] = [];
  const processedItemIds = new Set<string>();

  for (const comanda of allComandas) {
    const clientName = comanda.clients?.name || 'Consumidor Final';
    const comandaItems = itemsByComandaId[comanda.id] || [];
    const isPaid = comanda.status === 'paid';

    // Filtrar itens que pertencem ao profissional:
    // (a) item explicitamente atribuído a este staff, OU
    // (b) item sem staff_id atribuído mas a comanda é deste staff
    const relevantItems = comandaItems.filter(
      (it) => it.staff_id === staffId || (!it.staff_id && comanda.staff_id === staffId)
    );

    if (relevantItems.length === 0) {
      // Se não há itens discriminados mas a comanda foi aberta para o profissional
      if (comanda.staff_id === staffId) {
        const commRec = recordsByComandaId.get(comanda.id);
        const gross = commRec
          ? Number(commRec.net_value ?? commRec.gross_value ?? comanda.total ?? 0)
          : Number(comanda.total) || 0;
        const commValue = commRec
          ? Number(commRec.commission_value)
          : (gross * commissionPercentage) / 100;

        statementItems.push({
          id: `cmd-${comanda.id}`,
          comandaId: comanda.id,
          createdAt: comanda.created_at,
          clientName,
          itemName: 'Atendimento Avulso',
          itemType: 'service',
          grossValue: gross,
          commissionRate: commissionPercentage,
          commissionValue: commValue,
          comandaStatus: comanda.status,
          isPaid,
        });
      }
    } else {
      for (const it of relevantItems) {
        if (processedItemIds.has(it.id)) continue;
        processedItemIds.add(it.id);

        const commRec = recordsByItemId.get(it.id) || recordsByComandaId.get(comanda.id);
        const itemName = it.services?.name || it.product_name || 'Serviço';
        const itemType = it.service_id ? 'service' : 'product';

        const gross = commRec
          ? Number(commRec.net_value ?? commRec.gross_value ?? (Number(it.unit_price) || 0) * (Number(it.quantity) || 1))
          : (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);

        const commValue = commRec
          ? Number(commRec.commission_value)
          : (gross * commissionPercentage) / 100;

        const effectiveRate = gross > 0 ? Math.round((commValue / gross) * 100) : commissionPercentage;

        statementItems.push({
          id: it.id,
          comandaId: comanda.id,
          createdAt: comanda.created_at,
          clientName,
          itemName,
          itemType,
          grossValue: gross,
          commissionRate: effectiveRate,
          commissionValue: commValue,
          comandaStatus: comanda.status,
          isPaid,
        });
      }
    }
  }

  return statementItems;
}
