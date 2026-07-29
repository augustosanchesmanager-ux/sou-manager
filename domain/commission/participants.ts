/**
 * [SMG][DOMAIN][COMMISSION] participants
 *
 * Lógica de resolução de participantes e execução compartilhada.
 * Extraídas de pages/Commissions.tsx, pages/Checkout.tsx, pages/Schedule.tsx, pages/Comandas.tsx.
 *
 * Elimina duplicação de isSharedExecution, normalizeCommissionParticipants,
 * buildSoloParticipant, buildInferredPrimaryParticipant.
 */

import { normalizePercentage } from '../../shared/numbers/normalize';
import { isCommissionEligible } from './calculate';
import type { ParticipantRow, ServiceItemLike } from './types';

/**
 * Verifica se um item de serviço é uma execução compartilhada.
 * Compartilhado = mais de 1 participante, ou 1 participante com payout parcial.
 */
export const isSharedExecution = (
  item: ServiceItemLike,
  participants?: ParticipantRow[],
): boolean => {
  if (!participants || participants.length === 0) return false;
  if (participants.length > 1) return true;

  const single = participants[0];
  if (!single) return false;
  if (!single.affects_commission) return false;

  const rate = normalizePercentage(single.payout_value);
  return rate < 1;
};

/**
 * Detecta se um item de serviço é compartilhado (alias para compatibilidade).
 */
export const isSharedServiceItem = isSharedExecution;

/**
 * Cria um participante sintético 100% primary para itens solo.
 */
export const buildSoloParticipant = (
  comandaItemId: string,
  staffId: string,
): ParticipantRow => ({
  id: `solo-${comandaItemId}`,
  comanda_item_id: comandaItemId,
  staff_id: staffId,
  professional_id: staffId,
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
});

/**
 * Verifica se um participante tem payout parcial (rate > 0 e < 100%).
 */
export const hasPartialSavedPayout = (
  participant: ParticipantRow,
  itemValue: number,
): boolean => {
  if (!participant.affects_commission) return false;
  const rate = normalizePercentage(participant.payout_value);
  return rate > 0 && rate < 1;
};

/**
 * Infere o participante primary faltante a partir de um split parcial salvo.
 * Usado para reparar dados legados onde o primary não foi salvo.
 */
export const buildInferredPrimaryParticipant = (
  comandaItemId: string,
  savedParticipants: ParticipantRow[],
  staffById: Map<string, { id: string; role: string; commission_rate?: number | null }>,
): ParticipantRow | null => {
  const totalPayout = savedParticipants
    .filter((p) => p.affects_commission)
    .reduce((sum, p) => {
      const rate = normalizePercentage(p.payout_value);
      return sum + (p.payout_type === 'fixed' ? p.payout_value : rate);
    }, 0);

  const remaining = 1 - totalPayout;
  if (remaining <= 0.01) return null;

  const savedStaffIds = new Set(savedParticipants.map((p) => p.staff_id || p.professional_id).filter(Boolean));

  for (const [, staff] of staffById) {
    if (savedStaffIds.has(staff.id)) continue;
    if (!isCommissionEligible(staff)) continue;

    return {
      id: `inferred-${comandaItemId}-${staff.id}`,
      comanda_item_id: comandaItemId,
      staff_id: staff.id,
      professional_id: staff.id,
      role: 'primary',
      payout_type: 'percentage',
      payout_value: remaining * 100,
      affects_commission: true,
    };
  }

  return null;
};

/**
 * Normaliza a lista de participantes de um item de comanda.
 * Deduplica por staff_id, filtra staff não comissionável, infere primary faltante.
 * Retorna { participants, isShared, primaryStaffId }.
 */
export const normalizeCommissionParticipants = (
  item: { id: string; service_id?: string; staff_id?: string },
  comanda: { staff_id?: string },
  rawParticipants: ParticipantRow[],
  itemValue: number,
  staffById: Map<string, { id: string; role: string; commission_rate?: number | null }>,
): {
  participants: ParticipantRow[];
  isShared: boolean;
  primaryStaffId: string | null;
} => {
  if (!rawParticipants || rawParticipants.length === 0) {
    const fallbackStaffId = item.staff_id || comanda.staff_id;
    if (!fallbackStaffId) {
      return { participants: [], isShared: false, primaryStaffId: null };
    }
    return {
      participants: [buildSoloParticipant(item.id, fallbackStaffId)],
      isShared: false,
      primaryStaffId: fallbackStaffId,
    };
  }

  const byStaffId = new Map<string, ParticipantRow>();
  for (const p of rawParticipants) {
    const sid = p.staff_id || p.professional_id;
    if (!sid) continue;
    const staff = staffById.get(sid);
    if (staff && !isCommissionEligible(staff)) continue;
    const existing = byStaffId.get(sid);
    if (!existing || p.role === 'primary') {
      byStaffId.set(sid, p);
    }
  }

  const unique = Array.from(byStaffId.values());

  const hasPrimary = unique.some((p) => p.role === 'primary' && p.affects_commission);
  if (!hasPrimary) {
    const inferred = buildInferredPrimaryParticipant(item.id, unique, staffById);
    if (inferred) unique.push(inferred);
  }

  const primaryParticipant = unique.find((p) => p.role === 'primary');
  const primaryStaffId = primaryParticipant?.staff_id || primaryParticipant?.professional_id || null;

  const isShared = isSharedExecution(
    { service_id: item.service_id },
    unique.filter((p) => p.affects_commission),
  );

  return { participants: unique, isShared, primaryStaffId };
};

/**
 * Retorna o participante primary de uma lista.
 */
export const getPrimaryParticipant = (
  participants: ParticipantRow[],
): ParticipantRow | undefined =>
  participants.find((p) => p.role === 'primary' && p.affects_commission);

/**
 * Retorna participantes assistentes (assistant ou co_executor).
 */
export const getAssistantParticipants = (
  participants: ParticipantRow[],
): ParticipantRow[] =>
  participants.filter(
    (p) => (p.role === 'assistant' || p.role === 'co_executor') && p.affects_commission,
  );
