/**
 * [SMG][D8][WORKER] calculate — pure orchestration of the commission rule.
 *
 * Reproduces the EXACT certified logic of the browser-side handler
 * `createCommissionRecordHandler` (domain/events/outbox/providers/
 * createCommissionRecordHandler.ts), but consumes the MINIMAL context that the
 * narrow RPC `get_financial_operation_context` returns — never touching the DB.
 *
 * IMPORTANT (ADR-016 Amendment-02/03): the calculation lives ONLY in the
 * runtime-neutral Financial Domain Core (single source). This module:
 *   - calls ONLY the pure core functions (via a thin re-export),
 *   - performs NO writes, NO I/O, NO math beyond the approved formulas.
 * It is the worker's DECLARED reuse of the certified rule — any divergence is
 * caught by the D8 integrity gate + equivalence tests, not by duplicated code.
 *
 * Data contract notes (verified against live schema 2026-08-27):
 *   - comandas has NO paid_amount / amount_paid -> the RPC omits them, so we
 *     fall back to comanda.total (reproducing the handler's field-presence logic).
 *   - comanda_items has NO price/amount/discount -> unit_price is the base,
 *     item discount defaults to 0 (handled by resolveFinancialBase).
 *   - service_execution_participants has NO professional_id -> staff_id only.
 */

import {
  normalizePercentage,
  resolveFinancialBase,
  calculateCommissionValue,
  isCommissionEligible,
  getEffectiveRate,
  normalizeCommissionParticipants,
} from '../_shared/financial-core/index.ts';

// ─── Context types (mirror get_financial_operation_context output) ─────────

export interface WorkerStaffRow {
  id: string;
  role?: string | null;
  commission_rate?: number | null;
}

export interface WorkerParticipantRow {
  comanda_item_id: string;
  staff_id?: string | null;
  payout_type?: string;
  payout_value?: number | null;
  affects_commission?: boolean;
}

export interface WorkerItemRow {
  id: string;
  service_id?: string | null;
  staff_id?: string | null;
  unit_price?: number | null;
  quantity?: number | null;
}

export interface WorkerComandaRow {
  id: string;
  staff_id?: string | null;
  total?: number | null;
  discount?: number | null;
}

export interface WorkerOperationContext {
  event_id?: string | null;
  tenant_id: string;
  operation_type: string;
  idempotency_key?: string | null;
  source_event?: string | null;
  receivedValue?: number | null;
  comandaId?: string | null;
  comanda?: WorkerComandaRow | null;
  comanda_items?: WorkerItemRow[];
  participants?: WorkerParticipantRow[];
  staff?: WorkerStaffRow[];
}

export interface CommissionRecordToCreate {
  tenantId: string;
  comandaId: string;
  comandaItemId: string;
  staffId: string;
  grossValue: number;
  discount: number;
  netValue: number;
  receivedValue: number;
  commissionRate: number;
  commissionValue: number;
  participantShare: number;
  payoutType: string;
  affectsCommission: boolean;
  idempotencyKey: string;
  eventId: string;
  eventType: string;
}

export interface CalculateResult {
  records: CommissionRecordToCreate[];
  sourceStaffIds: string[];
}

const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getParticipantStaffId = (p: WorkerParticipantRow): string | null =>
  p.staff_id || null;

/**
 * Pure worker-side calculation. Returns an append-only list of commission
 * records to persist (no DB access here). Mirrors the certified handler's
 * 5-phase logic exactly.
 */
export const calculateCommissionRecordsFromContext = (
  context: WorkerOperationContext,
): CalculateResult => {
  const {
    tenant_id,
    operation_type,
    idempotency_key,
    source_event,
    receivedValue,
    comandaId,
    comanda,
    comanda_items,
    participants,
    staff,
  } = context;

  if (operation_type !== 'create_commission_record') {
    return { records: [], sourceStaffIds: [] };
  }
  if (!comandaId || !tenant_id) {
    return { records: [], sourceStaffIds: [] };
  }
  if (!comanda || !comanda_items || comanda_items.length === 0) {
    return { records: [], sourceStaffIds: [] };
  }

  // Idempotency key per record (mirrors handler: `${eventKey}_${staffId}`).
  const baseIdem = idempotency_key || `${source_event || 'op'}_${event_id(context)}`;

  // Phase 4 analog: staff lookup map.
  const staffById = new Map<string, WorkerStaffRow>();
  for (const s of staff || []) {
    staffById.set(s.id, s);
  }

  // Phase 1 analog: resolve paid amount by FIELD PRESENCE. The RPC already
  // omits absent columns, so effectivePaid honours the contract.
  const comandaTotal = toNum(comanda.total);
  const comandaPaidAmount = comandaTotal;
  const comandaDiscount = toNum(comanda.discount);

  // Phase 3 analog: participant grouping per item.
  const participantsByItem = new Map<string, WorkerParticipantRow[]>();
  for (const p of participants || []) {
    if (!p.comanda_item_id) continue;
    const list = participantsByItem.get(p.comanda_item_id) || [];
    list.push(p);
    participantsByItem.set(p.comanda_item_id, list);
  }

  const records: CommissionRecordToCreate[] = [];
  const sourceStaffIds = new Set<string>();

  // Phase 5 analog: item x participant loop.
  for (const item of comanda_items) {
    const itemValue = toNum(item.unit_price);
    const quantity = toNum(item.quantity, 1);
    const itemDiscountRaw = 0; // comanda_items has no discount column (schema fact)

    const rawParticipants = participantsByItem.get(item.id) || [];
    const normalized = normalizeCommissionParticipants(
      {
        id: item.id,
        service_id: item.service_id || undefined,
        staff_id: item.staff_id || undefined,
      },
      { staff_id: comanda.staff_id || undefined },
      rawParticipants as any,
      itemValue,
      staffById as any,
    );

    for (const participant of normalized.participants) {
      const staffId = getParticipantStaffId(participant as any);
      if (!staffId) continue;

      const staff = staffById.get(staffId);
      if (!staff || !isCommissionEligible(staff)) continue;
      sourceStaffIds.add(staffId);

      const financialBase = resolveFinancialBase({
        item: {
          id: item.id,
          unit_price: item.unit_price,
          quantity,
        },
        discount: itemDiscountRaw || comandaDiscount,
        paidAmount: comandaPaidAmount,
        quantity,
      });

      const commissionRate = getEffectiveRate(staff);
      const commissionValue = calculateCommissionValue(
        financialBase.receivedValue,
        participant as any,
        commissionRate,
      );

      if (commissionValue <= 0) continue;

      const participantShare =
        participant.payout_type === 'percentage'
          ? normalizePercentage(toNum(participant.payout_value, 0))
          : 1.0;

      records.push({
        tenantId: tenant_id,
        comandaId,
        comandaItemId: item.id,
        staffId,
        grossValue: financialBase.grossValue,
        discount: financialBase.discount,
        netValue: financialBase.netValue,
        receivedValue: financialBase.receivedValue,
        commissionRate,
        commissionValue,
        participantShare,
        payoutType: participant.payout_type || 'percentage',
        affectsCommission: !!participant.affects_commission,
        idempotencyKey: `${baseIdem}_${staffId}`,
        eventId: event_id(context) || '',
        eventType: source_event || '',
      });
    }
  }

  return { records, sourceStaffIds: Array.from(sourceStaffIds) };
};

function event_id(c: WorkerOperationContext): string {
  return c.event_id || '';
}
