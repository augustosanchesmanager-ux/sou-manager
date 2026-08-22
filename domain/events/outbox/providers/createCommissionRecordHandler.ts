/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] createCommissionRecordHandler
 *
 * TD-001 B3.4-D: OperationHandler for 'create_commission_record' operations.
 *
 * EXECUTES the commission record creation by resolving staff from
 * comanda_items → service_execution_participants (NOT from event payload).
 *
 * PO RULE: "CheckoutCompleted.staffId is NOT source of truth for commission.
 *           Must resolve via comanda_items → service_execution_participants."
 *
 * DATA CONTRACT (from FinanceOperation.data):
 *   - comandaId: string — the comanda being settled
 *   - tenantId: string — tenant isolation
 *   - receivedValue: number — total comanda value (used as fallback for paidAmount)
 *
 * FLOW (mirrors CommissionApplicationService.loadCommissionLines 4-phase logic):
 *   1. Fetch comanda → get discount, paid_amount, status, total
 *   2. Fetch comanda_items → get unit_price, quantity, staff_id
 *   3. Fetch service_execution_participants → normalize per item
 *   4. Fetch staff → get commission_rate, role
 *   5. For each item × participant: resolveFinancialBase → calculateCommissionValue
 *   6. CommissionRecordRepository.create() per staff member
 *
 * IDEMPOTENCY:
 *   - Uses idempotencyKey from context
 *   - Checks existsByStaffComanda before insert
 *   - Partial unique index on (tenant_id, comanda_id, staff_id) WHERE record_type='commission'
 */

import { normalizePercentage } from '../../../../shared/numbers/normalize';
import { receivesCommission, getEffectiveCommissionRate } from '../../../../src/lib/staff/roles';
import {
  resolveFinancialBase,
  calculateCommissionValue,
} from '../../../commission/calculate';
import {
  normalizeCommissionParticipants,
} from '../../../commission/participants';
import type { ParticipantRow } from '../../../commission/types';
import type { CommissionRecordRepository } from '../../../commission/commissionRecordRepository';
import type { OperationHandler, OperationContext } from './financeProvider';

// ─── Dependency Interfaces ─────────────────────────────────────

export interface ComandaRow {
  id: string;
  staff_id?: string;
  status?: string;
  total?: number;
  discount?: number;
  paid_amount?: number | null;
  amount_paid?: number | null;
}

export interface ComandaItemRow {
  id: string;
  comanda_id: string;
  service_id?: string;
  product_name?: string;
  staff_id?: string;
  unit_price?: number;
  price?: number;
  amount?: number;
  quantity?: number;
  discount?: number;
  item_type?: string;
  type?: string;
}

export interface StaffRow {
  id: string;
  name?: string;
  role?: string;
  commission_rate?: number | null;
}

export interface CreateCommissionRecordDeps {
  comandaRepository: {
    get(id: string, tenantId: string): Promise<ComandaRow | null>;
  };
  comandaItemRepository: {
    listByComandaIds(ids: string[], tenantId: string): Promise<ComandaItemRow[]>;
  };
  participantRepository: {
    listByComandaItemIds(ids: string[], tenantId: string): Promise<ParticipantRow[]>;
  };
  staffRepository: {
    listForCommission(tenantId: string): Promise<StaffRow[]>;
  };
  commissionRecordRepository: CommissionRecordRepository;
}

// ─── Operation Data ────────────────────────────────────────────

export interface CreateCommissionRecordData {
  comandaId: string;
  tenantId: string;
  receivedValue: number;
}

// ─── Helpers ───────────────────────────────────────────────────

const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getParticipantStaffId = (p: ParticipantRow): string | null =>
  p.staff_id || p.professional_id;

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Creates an OperationHandler for 'create_commission_record' operations.
 *
 * Resolves staff from comanda_items → service_execution_participants.
 * Calculates commission per participant using resolveFinancialBase + calculateCommissionValue.
 * Creates one CommissionRecord per staff member.
 *
 * @param deps - Injected repositories for data resolution
 */
export const createCommissionRecordHandler = (
  deps: CreateCommissionRecordDeps,
): OperationHandler => ({
  execute: async (data, context) => {
    const {
      comandaId,
      tenantId,
      receivedValue,
    } = data as unknown as CreateCommissionRecordData;

    if (!comandaId) {
      return { success: false, error: 'Missing required field: comandaId' };
    }
    if (!tenantId) {
      return { success: false, error: 'Missing required field: tenantId' };
    }

    // ── Phase 1: Fetch comanda ────────────────────────────────
    const comanda = await deps.comandaRepository.get(comandaId, tenantId);
    if (!comanda) {
      console.log(
        `[COMMISSION_RECORD_HANDLER] Comanda ${comandaId} not found — skipping`,
      );
      return { success: true };
    }

    const comandaDiscount = toNum(comanda.discount);
    const comandaPaidAmount = toNum(
      comanda.paid_amount ?? comanda.amount_paid ?? comanda.total,
      receivedValue,
    );

    // ── Phase 2: Fetch comanda items ──────────────────────────
    const items = await deps.comandaItemRepository.listByComandaIds(
      [comandaId],
      tenantId,
    );

    if (!items || items.length === 0) {
      console.log(
        `[COMMISSION_RECORD_HANDLER] No items for comanda ${comandaId} — skipping`,
      );
      return { success: true };
    }

    // ── Phase 3: Fetch participants ───────────────────────────
    const itemIds = items.map((i) => i.id).filter(Boolean);
    const rawParticipants =
      itemIds.length > 0
        ? await deps.participantRepository.listByComandaItemIds(
            itemIds,
            tenantId,
          )
        : [];

    const participantsByItem: Record<string, ParticipantRow[]> = {};
    for (const p of rawParticipants || []) {
      if (!participantsByItem[p.comanda_item_id]) {
        participantsByItem[p.comanda_item_id] = [];
      }
      participantsByItem[p.comanda_item_id].push(p);
    }

    // ── Phase 4: Fetch staff ──────────────────────────────────
    const staffList = await deps.staffRepository.listForCommission(tenantId);
    const staffById = new Map<string, StaffRow>();
    for (const s of staffList) {
      staffById.set(s.id, s);
    }

    // ── Phase 5: Process each item × participant ──────────────
    let recordsCreated = 0;

    for (const item of items) {
      const itemParticipants = participantsByItem[item.id] || [];
      const itemValue = toNum(item.unit_price ?? item.price ?? item.amount ?? 0);
      const quantity = toNum(item.quantity, 1);
      const itemDiscount = toNum(item.discount);

      // Normalize participants (dedup, infer primary, detect shared)
      const normalized = normalizeCommissionParticipants(
        {
          id: item.id,
          service_id: item.service_id || undefined,
          staff_id: item.staff_id || undefined,
        },
        { staff_id: comanda.staff_id },
        itemParticipants,
        itemValue,
        staffById as any,
      );

      const participantsForCommission = normalized.participants;

      // Process each commissionable participant
      for (const participant of participantsForCommission) {
        const staffId = getParticipantStaffId(participant);
        if (!staffId) continue;

        const staff = staffById.get(staffId);
        if (!staff || !receivesCommission(staff as any)) continue;

        // Resolve financial base for this item
        const financialBase = resolveFinancialBase({
          item: item as unknown as Record<string, unknown>,
          discount: itemDiscount || comandaDiscount,
          paidAmount: comandaPaidAmount,
          quantity,
        });

        const commissionRate = getEffectiveCommissionRate(staff as any);
        const commissionValue = calculateCommissionValue(
          financialBase.receivedValue,
          participant,
          commissionRate,
        );

        // Skip zero-value commissions
        if (commissionValue <= 0) continue;

        const participantShare =
          participant.payout_type === 'percentage'
            ? normalizePercentage(participant.payout_value)
            : 1.0;

        // Check idempotency — skip if record already exists
        try {
          const alreadyExists = await deps.commissionRecordRepository.existsByStaffComanda(
            staffId,
            comandaId,
            tenantId,
          );
          if (alreadyExists) {
            console.log(
              `[COMMISSION_RECORD_HANDLER] Record already exists for staff ${staffId} + comanda ${comandaId} — skipping`,
            );
            continue;
          }
        } catch {
          // If check fails (e.g., table doesn't exist), proceed with insert
        }

        // Create commission record
        try {
          await deps.commissionRecordRepository.create(
            {
              tenant_id: tenantId,
              comanda_id: comandaId,
              comanda_item_id: item.id,
              staff_id: staffId,
              gross_value: financialBase.grossValue,
              discount: financialBase.discount,
              net_value: financialBase.netValue,
              received_value: financialBase.receivedValue,
              commission_rate: commissionRate,
              commission_value: commissionValue,
              participant_share: participantShare,
              payout_type: participant.payout_type,
              affects_commission: participant.affects_commission,
              idempotency_key: `${context.idempotencyKey}_${staffId}`,
              event_id: context.eventId,
              event_type: context.sourceEvent,
            },
            tenantId,
          );

          recordsCreated++;
          console.log(
            `[COMMISSION_RECORD_HANDLER] Created commission record: staff=${staffId}, comanda=${comandaId}, value=${commissionValue.toFixed(2)}`,
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[COMMISSION_RECORD_HANDLER] Failed to create record for staff ${staffId} + comanda ${comandaId}:`,
            errorMsg,
          );
          // Continue processing other participants — don't fail the whole operation
        }
      }
    }

    console.log(
      `[COMMISSION_RECORD_HANDLER] Comanda ${comandaId}: ${recordsCreated} commission record(s) created`,
    );

    return { success: true };
  },
});
