/**
 * [SMG][DOMAIN][TENANT] tenantLifecycleService
 *
 * RESPONSABILIDADE: Writer único lógico de `tenants.status` (ADR-013 §3.1).
 *   - transitionTo(tenantId, to, reason): valida contra a matriz congelada
 *     (ADR-013 §5.2) e aplica via TenantRepository.updateStatus
 *   - getValidTransitions(status): transições válidas a partir de um status
 *   - canAccess(status): espelho do nível de acesso do Estado Efetivo
 *     (D-6.0.5-1/2) — trial/active/past_due/cancelled acessam;
 *     draft (pré-provisão), suspended (bloqueado) e archived (encerrado) não
 *
 * REGRA DE OURO (entry audit 6.0.5.4 §2.5):
 *   - Fora desta API, nenhum componente (frontend, application/*, RPC)
 *     escreve `tenants.status` diretamente — a única exceção é a RPC fina
 *     `apply_subscription_transition`, exclusivamente como persistência
 *     delegada (Transition Executor, ADR-013 §3.1).
 *
 * NOTA: `reason` é parâmetro da API congelada (LIFECYCLE_MODEL.md §4);
 * reservado para auditoria futura em billing_events.
 *
 * GARANTIAS:
 *   - Zero conhecimento de React, UI, navigate, toast
 *   - Lança erro em transição inválida (fail-fast — D-6.0.5.4-4)
 */

import { tenantRepository, type TenantRepository } from './repository';
import type { TenantStatus } from './types';

/**
 * Matriz congelada de transições de tenant (ADR-013 §5.2 / LIFECYCLE_MODEL §4.1).
 * `cancelled → active` NÃO existe por construção (D-6.0.5-2 / ADR-013 §5).
 */
export const VALID_TRANSITIONS: Record<TenantStatus, readonly TenantStatus[]> = {
  draft: ['trial', 'cancelled'],
  trial: ['active', 'past_due', 'cancelled'],
  active: ['past_due', 'cancelled'],
  past_due: ['active', 'suspended', 'cancelled'],
  suspended: ['active', 'cancelled'],
  cancelled: ['archived'],
  archived: [],
};

/** Nível de acesso por status — espelho do Estado Efetivo (D-6.0.5-1/2). */
export const ACCESSIBLE_STATUSES: readonly TenantStatus[] = [
  'trial',
  'active',
  'past_due',
  'cancelled',
];

export interface TenantLifecycleService {
  /** Valida contra a matriz congelada (ADR-013 §5.2) e aplica a transição de tenant. */
  transitionTo(tenantId: string, to: TenantStatus, reason: string): Promise<void>;
  /** Transições válidas a partir de um status (matriz congelada). */
  getValidTransitions(status: TenantStatus): TenantStatus[];
  /** Nível de acesso esperado para o status (espelho do Estado Efetivo — D-6.0.5-1/2). */
  canAccess(status: TenantStatus): boolean;
}

export class TenantLifecycleServiceImpl implements TenantLifecycleService {
  constructor(private readonly repo: TenantRepository = tenantRepository) {}

  async transitionTo(tenantId: string, to: TenantStatus, reason: string): Promise<void> {
    void reason; // reservado para auditoria futura em billing_events
    const tenant = await this.repo.getById(tenantId);
    if (!tenant) throw new Error(`Tenant não encontrado: ${tenantId}`);

    const allowed = VALID_TRANSITIONS[tenant.status];
    if (!allowed.includes(to)) {
      throw new Error(`Transição inválida de tenant: ${tenant.status} → ${to}`);
    }

    await this.repo.updateStatus(tenantId, to);
  }

  getValidTransitions(status: TenantStatus): TenantStatus[] {
    return [...VALID_TRANSITIONS[status]];
  }

  canAccess(status: TenantStatus): boolean {
    return ACCESSIBLE_STATUSES.includes(status);
  }
}

export const tenantLifecycleService: TenantLifecycleService = new TenantLifecycleServiceImpl();
