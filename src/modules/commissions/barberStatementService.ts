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
  const startIso = `${startDate}T00:00:00`;
  const endIso = `${endDate}T23:59:59`;

  // 1. Buscar comandas do profissional no período
  const { data: comandasData, error: comandasError } = await barberSupabase
    .from('comandas')
    .select('id, client_id, staff_id, status, total, paid_amount, created_at, clients(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  if (comandasError || !comandasData) {
    return [];
  }

  const comandas = comandasData as unknown as RawComandaRow[];
  const comandaIds = comandas.map((c) => c.id);

  // 2. Buscar itens vinculados a essas comandas
  let itemsByComandaId: Record<string, RawComandaItemRow[]> = {};
  if (comandaIds.length > 0) {
    const { data: itemsData, error: itemsError } = await barberSupabase
      .from('comanda_items')
      .select('id, comanda_id, service_id, product_name, unit_price, quantity, staff_id, services(name)')
      .in('comanda_id', comandaIds);

    if (!itemsError && itemsData) {
      const rawItems = itemsData as unknown as RawComandaItemRow[];
      itemsByComandaId = rawItems.reduce((acc: Record<string, RawComandaItemRow[]>, it) => {
        if (!acc[it.comanda_id]) acc[it.comanda_id] = [];
        acc[it.comanda_id].push(it);
        return acc;
      }, {});
    }
  }

  // 3. Montar itens consolidados do extrato
  const statementItems: BarberStatementItem[] = [];

  for (const comanda of comandas) {
    const clientName = comanda.clients?.name || 'Consumidor Final';
    const comandaItems = itemsByComandaId[comanda.id] || [];
    const isPaid = comanda.status === 'paid';

    if (comandaItems.length === 0) {
      const gross = Number(comanda.total) || 0;
      const commValue = (gross * commissionPercentage) / 100;
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
    } else {
      for (const it of comandaItems) {
        const itemName = it.services?.name || it.product_name || 'Serviço';
        const itemType = it.service_id ? 'service' : 'product';
        const gross = (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);
        const commValue = (gross * commissionPercentage) / 100;

        statementItems.push({
          id: it.id,
          comandaId: comanda.id,
          createdAt: comanda.created_at,
          clientName,
          itemName,
          itemType,
          grossValue: gross,
          commissionRate: commissionPercentage,
          commissionValue: commValue,
          comandaStatus: comanda.status,
          isPaid,
        });
      }
    }
  }

  return statementItems;
}
