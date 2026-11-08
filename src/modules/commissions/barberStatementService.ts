import { supabase } from '../../../services/supabaseClient';
import type { BarberStatementItem } from '../../utils/barberStatement';
import { cardFeeRepository } from '../../../domain/paymentTerminal/cardFeeRepository';
import { calculateCardFeeSplit } from '../../../domain/paymentTerminal/cardFeeSplitEngine';

export interface StatementStaffMember {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
  commission_rate?: number | string | null;
  product_commission_rate?: number | string | null;
}

interface RawComandaRow {
  id: string;
  client_id?: string | null;
  staff_id?: string | null;
  appointment_id?: string | null;
  status: string;
  total?: number | null;
  created_at: string;
  clients?: { name?: string | null } | null;
}

interface RawAppointmentRow {
  id: string;
  tenant_id: string;
  staff_id: string;
  client_id?: string | null;
  client_name?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  price?: number | string | null;
  status: string;
  start_time: string;
  end_time?: string | null;
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
  created_at?: string;
  services?: { name?: string | null } | null;
}

export async function fetchStatementStaff(tenantId: string): Promise<StatementStaffMember[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, avatar, role, commission_rate, product_commission_rate')
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
  productCommissionPercentage?: number;
}): Promise<BarberStatementItem[]> {
  const { tenantId, staffId, startDate, endDate, commissionPercentage, productCommissionPercentage = 0 } = params;

  // Ajusta limites para ISO completo considerando início e fim do dia em fuso brasileiro (-03:00)
  const startIso = `${startDate}T00:00:00.000-03:00`;
  const endIso = `${endDate}T23:59:59.999-03:00`;

  // 1. Buscar agendamentos do profissional no período
  const { data: apptData } = await supabase
    .from('appointments')
    .select('id, tenant_id, staff_id, client_id, client_name, service_id, service_name, price, status, start_time, end_time, created_at, clients(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('start_time', startIso)
    .lte('start_time', endIso)
    .not('status', 'in', '("cancelled","no_show")')
    .order('start_time', { ascending: false });

  const staffAppointments = (apptData || []) as unknown as RawAppointmentRow[];
  const appointmentIds = staffAppointments.map((a) => a.id);
  const appointmentMap = new Map<string, RawAppointmentRow>();
  for (const a of staffAppointments) {
    appointmentMap.set(a.id, a);
  }

  // 2. Buscar comandas atribuídas diretamente ao profissional no período
  const { data: directComandasData } = await supabase
    .from('comandas')
    .select('id, client_id, staff_id, appointment_id, status, total, created_at, clients(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  const staffComandas = (directComandasData || []) as unknown as RawComandaRow[];

  // 2.1 Buscar comandas vinculadas aos agendamentos do profissional (mesmo se staff_id na comanda for nulo ou de recepção)
  let appointmentComandas: RawComandaRow[] = [];
  if (appointmentIds.length > 0) {
    const { data: apptCmdData } = await supabase
      .from('comandas')
      .select('id, client_id, staff_id, appointment_id, status, total, created_at, clients(name)')
      .eq('tenant_id', tenantId)
      .in('appointment_id', appointmentIds)
      .not('status', 'eq', 'cancelled');

    if (apptCmdData) {
      appointmentComandas = apptCmdData as unknown as RawComandaRow[];
    }
  }

  // 3. Buscar itens executados pelo profissional no período (inclusive em comandas abertas pela recepção)
  const { data: staffItemsData } = await supabase
    .from('comanda_items')
    .select('id, comanda_id, service_id, product_name, unit_price, quantity, staff_id, created_at, services(name)')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  const directItems = (staffItemsData || []) as unknown as RawComandaItemRow[];

  // 3.1 Buscar itens onde o profissional atuou como participante/assistente
  let participantItems: RawComandaItemRow[] = [];
  try {
    const { data: partData } = await supabase
      .from('service_execution_participants')
      .select('comanda_item_id, staff_id, payout_value, role, payout_type')
      .eq('tenant_id', tenantId)
      .eq('staff_id', staffId);

    const participantItemIds = Array.from(
      new Set((partData || []).map((p: any) => p.comanda_item_id).filter(Boolean))
    );

    if (participantItemIds.length > 0) {
      const { data: pItemsData } = await supabase
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

  // 4. Obter comandas de itens onde o profissional atuou mas que ainda não foram carregadas
  const knownComandaIds = new Set([
    ...staffComandas.map((c) => c.id),
    ...appointmentComandas.map((c) => c.id),
  ]);
  const externalComandaIds = Array.from(
    new Set(allDirectItems.map((it) => it.comanda_id).filter((id) => !knownComandaIds.has(id)))
  );

  let externalComandas: RawComandaRow[] = [];
  if (externalComandaIds.length > 0) {
    const { data: extData } = await supabase
      .from('comandas')
      .select('id, client_id, staff_id, appointment_id, status, total, created_at, clients(name)')
      .eq('tenant_id', tenantId)
      .in('id', externalComandaIds)
      .not('status', 'eq', 'cancelled');
    if (extData) {
      externalComandas = extData as unknown as RawComandaRow[];
    }
  }

  // Mapa consolidado de todas as comandas relevantes
  const allComandas = [...staffComandas, ...appointmentComandas, ...externalComandas];
  const comandaMap = new Map<string, RawComandaRow>();
  for (const cmd of allComandas) {
    if (!comandaMap.has(cmd.id)) {
      comandaMap.set(cmd.id, cmd);
    }
  }

  // 5. Buscar todos os itens das comandas consolidadas
  const allComandaIds = Array.from(comandaMap.keys());
  let itemsByComandaId: Record<string, RawComandaItemRow[]> = {};

  if (allComandaIds.length > 0) {
    const { data: allItemsData } = await supabase
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

  // 6. Buscar registros oficiais de comissão no livro-razão para comandas pagas
  const paidComandaIds = Array.from(comandaMap.values())
    .filter((c) => c.status === 'paid')
    .map((c) => c.id);
  const recordsByItemId = new Map<string, any>();
  const recordsByComandaId = new Map<string, any>();

  if (paidComandaIds.length > 0) {
    const { data: commRecords } = await supabase
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

  // 6.1 Buscar pagamentos e política de taxa de maquininha do profissional (Frente B)
  const staffFeePolicy = await cardFeeRepository.getStaffPolicy(tenantId, staffId);
  const paymentsByComandaId = new Map<string, any>();

  if (allComandaIds.length > 0) {
    try {
      const { data: payData } = await supabase
        .from('comanda_payments')
        .select('id, comanda_id, payment_type, payment_method, amount')
        .in('comanda_id', allComandaIds)
        .is('reversed_at', null);

      if (payData) {
        for (const p of payData) {
          paymentsByComandaId.set(p.comanda_id, p);
        }
      }
    } catch {
      // Degradação graciosa
    }
  }

  const resolveItemCardFee = (comandaId: string, gross: number, rate: number, isPaid: boolean) => {
    const pay = paymentsByComandaId.get(comandaId);
    const method = pay?.payment_method || pay?.payment_type || (isPaid ? 'Cartão' : 'Em Aberto');
    const isCredit = /cr[eé]dito|credit/i.test(method);
    const isDebit = /d[eé]bito|debit/i.test(method);
    const isCard = isCredit || isDebit || /cart[aã]o|card/i.test(method);

    let feePercentage = 0;
    if (isCredit) {
      feePercentage = 2.89;
    } else if (isDebit) {
      feePercentage = 1.25;
    } else if (isCard) {
      feePercentage = 2.0;
    }

    const split = calculateCardFeeSplit({
      grossAmount: gross,
      commissionRate: rate,
      feePercentage,
      policy: staffFeePolicy,
    });

    return {
      paymentMethod: method,
      cardFeePercentage: split.feePercentage,
      cardFeeAmount: split.feeAmount,
      cardFeePolicy: split.policy,
      barberFeeDeduction: split.barberFeeDeduction,
      shopFeeAbsorption: split.shopFeeAbsorption,
      isFeeExempt: split.isFeeExempt,
      exemptValue: split.exemptValue,
      netCommissionValue: split.netCommission,
    };
  };

  // 7. Montar itens consolidados do extrato
  const statementItems: BarberStatementItem[] = [];
  const processedItemIds = new Set<string>();
  const processedAppointmentIds = new Set<string>();

  for (const comanda of comandaMap.values()) {
    const linkedAppt = comanda.appointment_id ? appointmentMap.get(comanda.appointment_id) : null;
    if (comanda.appointment_id) {
      processedAppointmentIds.add(comanda.appointment_id);
    }

    const clientName =
      comanda.clients?.name ||
      linkedAppt?.clients?.name ||
      linkedAppt?.client_name ||
      'Consumidor Final';

    const comandaItems = itemsByComandaId[comanda.id] || [];
    const isPaid = comanda.status === 'paid';

    // Filtrar itens que pertencem ao profissional:
    // (a) item explicitamente atribuído a este staff, OU
    // (b) item sem staff_id atribuído mas a comanda é deste staff, OU
    // (c) item sem staff_id atribuído mas o agendamento vinculado é deste staff
    const relevantItems = comandaItems.filter(
      (it) =>
        it.staff_id === staffId ||
        (!it.staff_id && comanda.staff_id === staffId) ||
        (!it.staff_id && linkedAppt && linkedAppt.staff_id === staffId)
    );

    if (relevantItems.length === 0) {
      // Se a comanda não possui itens discriminados, mas foi aberta exclusivamente para este profissional
      if (comandaItems.length === 0 && (comanda.staff_id === staffId || (linkedAppt && linkedAppt.staff_id === staffId))) {
        const commRec = recordsByComandaId.get(comanda.id);
        const gross = commRec
          ? Number(commRec.net_value ?? commRec.gross_value ?? comanda.total ?? linkedAppt?.price ?? 0)
          : Number(comanda.total ?? linkedAppt?.price) || 0;
        const commValue = commRec
          ? Number(commRec.commission_value)
          : (gross * commissionPercentage) / 100;

        const feeData = resolveItemCardFee(comanda.id, gross, commissionPercentage, isPaid);

        statementItems.push({
          id: `cmd-${comanda.id}`,
          comandaId: comanda.id,
          appointmentId: comanda.appointment_id || undefined,
          createdAt: linkedAppt?.start_time || comanda.created_at,
          clientName,
          itemName: linkedAppt?.service_name || 'Atendimento Avulso',
          itemType: 'service',
          grossValue: gross,
          commissionRate: commissionPercentage,
          commissionValue: commValue,
          comandaStatus: comanda.status,
          isPaid,
          ...feeData,
        });
      }
    } else {
      for (const it of relevantItems) {
        if (processedItemIds.has(it.id)) continue;
        processedItemIds.add(it.id);

        const commRec = recordsByItemId.get(it.id) || recordsByComandaId.get(comanda.id);
        const itemName = it.services?.name || it.product_name || linkedAppt?.service_name || 'Serviço';
        const isProduct = !it.service_id;
        const itemType = isProduct ? 'product' : 'service';
        const applicableRate = isProduct ? productCommissionPercentage : commissionPercentage;

        const gross = commRec
          ? Number(commRec.net_value ?? commRec.gross_value ?? (Number(it.unit_price) || 0) * (Number(it.quantity) || 1))
          : (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);

        let commValue = 0;
        if (commRec && commRec.status === 'active') {
          // Se for produto e o colaborador tem 0% de comissão de produto, comissão = 0
          if (isProduct && productCommissionPercentage === 0) {
            commValue = 0;
          } else {
            commValue = Number(commRec.commission_value);
          }
        } else {
          commValue = (gross * applicableRate) / 100;
        }

        const effectiveRate = gross > 0 ? Math.round((commValue / gross) * 100) : applicableRate;
        const feeData = resolveItemCardFee(comanda.id, gross, effectiveRate, isPaid);

        statementItems.push({
          id: it.id,
          comandaId: comanda.id,
          appointmentId: comanda.appointment_id || undefined,
          createdAt: linkedAppt?.start_time || comanda.created_at,
          clientName,
          itemName,
          itemType,
          grossValue: gross,
          commissionRate: effectiveRate,
          commissionValue: commValue,
          comandaStatus: comanda.status,
          isPaid,
          ...feeData,
        });
      }
    }
  }

  // 8. Conciliar agendamentos do profissional que ainda não possuem comanda aberta ou faturada
  for (const appt of staffAppointments) {
    if (processedAppointmentIds.has(appt.id)) continue;
    processedAppointmentIds.add(appt.id);

    const gross = Number(appt.price) || 0;
    const commValue = (gross * commissionPercentage) / 100;
    const clientName = appt.clients?.name || appt.client_name || 'Consumidor Final';

    statementItems.push({
      id: `appt-${appt.id}`,
      appointmentId: appt.id,
      createdAt: appt.start_time || appt.created_at,
      clientName,
      itemName: appt.service_name || 'Serviço Agendado',
      itemType: 'service',
      grossValue: gross,
      commissionRate: commissionPercentage,
      commissionValue: commValue,
      comandaStatus: appt.status,
      isPaid: false,
      paymentMethod: 'Agendado',
      cardFeePercentage: 0,
      cardFeeAmount: 0,
      cardFeePolicy: staffFeePolicy,
      barberFeeDeduction: 0,
      shopFeeAbsorption: 0,
      isFeeExempt: true,
      exemptValue: 0,
      netCommissionValue: commValue,
    });
  }

  // Ordenar por data/horário decrescente
  statementItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return statementItems;
}
