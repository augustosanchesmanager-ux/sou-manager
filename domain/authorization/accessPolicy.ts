/**
 * [SMG][DOMAIN][AUTHORIZATION] accessPolicy — política de acesso pura
 *
 * RESPONSABILIDADE: responder "Pode?" — dado o estado do tenant (fonte de
 * verdade de acesso, ADR-013 §3) e a assinatura/subscription (contexto
 * informativo), produz o AccessLevel e valida ações contra esse nível.
 *
 * NÃO conhece Feature Flags (ajuste PO #3): feature é questão do resolver
 * (`featureAvailability.ts`), não da policy. Acesso FULL com chef_club=false
 * é válido — são perguntas independentes ("Pode?" vs "Está habilitada?").
 *
 * FAIL-FAST (ADR-013 §4.7): o mapeamento tenant status → nível é TOTAL (cobre
 * os 7 estados) e lança erro em status desconhecido. Proibido `ELSE → active`.
 * Ações desconhecidas também lançam — não existe fallback silencioso.
 *
 * FONTE (congelada):
 *   - Níveis: LIFECYCLE_MODEL ACCESS_BY_STATUS + ADR-013 §2.2 + D-6.0.5-1/2
 *   - `past_due` → restricted (read-only + aviso, D-6.0.5-1)
 *   - `cancelled` → readonly (login/consulta/exportação; escrita bloqueada, D-6.0.5-2)
 *   - `suspended`/`archived` → none (bloqueado / retenção terminal)
 *
 * Domínio puro — zero dependência de Supabase/React.
 */

import type { TenantStatus } from '../tenant/types';
import type { SubscriptionStatus } from '../billing/types';
import type { AccessLevel, AccessWarning } from './effectiveState';

// ─── Catálogo de ações do sistema ────────────────────────────────

export type SystemAction =
  | 'system.access'
  | 'system.onboarding'
  | 'system.read'
  | 'system.write'
  | 'system.export'
  | 'system.financial'
  | 'system.stock'
  | 'system.cadastral';

/**
 * Níveis permitidos por ação (matriz congelada):
 * - access: login é permitido em todos, exceto none (bloqueado/arquivado).
 * - onboarding: somente draft (pré-F10).
 * - read/export: permitidos em full, restricted e readonly (D-6.0.5-1/2).
 * - write/financial/stock/cadastral: somente full — escrita bloqueada em
 *   restricted (inadimplência) e readonly (cancelado).
 */
const ACTION_LEVELS: Readonly<Record<SystemAction, readonly AccessLevel[]>> = {
  'system.access': ['onboarding', 'full', 'restricted', 'readonly'],
  'system.onboarding': ['onboarding'],
  'system.read': ['full', 'restricted', 'readonly'],
  'system.write': ['full'],
  'system.export': ['full', 'restricted', 'readonly'],
  'system.financial': ['full'],
  'system.stock': ['full'],
  'system.cadastral': ['full'],
};

// ─── Input da policy ─────────────────────────────────────────────

export interface AccessPolicyInput {
  /** Fonte de verdade de acesso (ADR-013 §3). Determina o nível. */
  tenantStatus: TenantStatus;
  /**
   * Contexto informativo do contrato (ADR-013 §2.4). Na 6.0.5.1 o nível é
   * dominado por `tenants.status`; a validação de pareamento
   * subscription↔tenant pertence à fronteira de transição (Billing Engine),
   * não à política de acesso.
   */
  subscriptionStatus?: SubscriptionStatus | null;
}

// ─── Avaliação de acesso (total + fail-fast, ADR-013 §4.7) ───────

/**
 * Mapeia o estado do tenant para o nível de acesso. TOTAL — cobre os 7
 * estados do enum `tenant_status`; estado desconhecido lança erro.
 * Proibido fallback `ELSE → active`.
 */
function accessLevelForTenantStatus(status: TenantStatus): AccessLevel {
  switch (status) {
    case 'draft':
      return 'onboarding';
    case 'trial':
      return 'full';
    case 'active':
      return 'full';
    case 'past_due':
      return 'restricted';
    case 'suspended':
      return 'none';
    case 'cancelled':
      return 'readonly';
    case 'archived':
      return 'none';
    default:
      throw new Error(
        `[SMG][DOMAIN][AUTHORIZATION] estado de tenant desconhecido: ${String(status)}`,
      );
  }
}

export function evaluateAccess(input: AccessPolicyInput): AccessLevel {
  return accessLevelForTenantStatus(input.tenantStatus);
}

// ─── Validação de ação (fail-fast em ação desconhecida) ──────────

export function can(action: SystemAction, level: AccessLevel): boolean {
  const allowed = ACTION_LEVELS[action];
  if (!allowed) {
    throw new Error(`[SMG][DOMAIN][AUTHORIZATION] ação de sistema desconhecida: ${String(action)}`);
  }
  return allowed.includes(level);
}

// ─── Avisos para a UI ────────────────────────────────────────────

/**
 * Sinais derivados para a interface (D-6.0.5-1/2):
 * - restricted → readonly + past_due (acesso limitado por inadimplência)
 * - readonly → readonly + cancelled (modo consulta permanente)
 */
export function getWarnings(level: AccessLevel): AccessWarning[] {
  switch (level) {
    case 'onboarding':
      return [];
    case 'full':
      return [];
    case 'restricted':
      return ['readonly', 'past_due'];
    case 'readonly':
      return ['readonly', 'cancelled'];
    case 'none':
      return [];
    default:
      throw new Error(`[SMG][DOMAIN][AUTHORIZATION] nível de acesso desconhecido: ${String(level)}`);
  }
}

// ─── Policy (interface) ──────────────────────────────────────────

export interface AccessPolicy {
  evaluateAccess(input: AccessPolicyInput): AccessLevel;
  can(action: SystemAction, level: AccessLevel): boolean;
  getWarnings(level: AccessLevel): AccessWarning[];
}

export const accessPolicy: AccessPolicy = {
  evaluateAccess,
  can,
  getWarnings,
};
