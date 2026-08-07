/**
 * [SMG][APPLICATION][AUTHORIZATION] AuthorizationService
 *
 * RESPONSABILIDADE: API pública de autorização para a camada de UI/rotas.
 * `App.tsx` NÃO conhece `EffectiveAccessService` nem regras de estado —
 * apenas consulta `getNavigationState(...)` / `resolveRoute(...)` (ajuste
 * PO #1). Internamente orquestra:
 *
 *   AuthorizationService
 *     └── EffectiveAccessService (EffectiveState VO)
 *           ├── AccessPolicy (AccessLevel, can, warnings)
 *           └── FeatureAvailabilityResolver (FeatureSet)
 *
 * REGRAS DE NAVEGAÇÃO (espelham os guards antigos de App.tsx:158/162, com a
 * mudança aprovada D-6.0.5-2):
 *   - superadmin: sempre permitido (bypass, como hoje)
 *   - tenant null (pré-tenant): permitido — o fluxo de provision orquestra
 *   - 'draft' (onboarding): redireciona a `/onboarding/welcome` fora das
 *     rotas de onboarding
 *   - 'suspended'/'archived' (none): bloqueado → `/pending-approval`
 *   - 'cancelled' (readonly): PERMITIDO em modo somente leitura (D-6.0.5-2 —
 *     não redireciona mais; warnings sinalizam a UI)
 *   - 'past_due' (restricted): permitido read-only com aviso (D-6.0.5-1)
 *   - 'trial'/'active' (full): permitido
 *
 * NÃO FAZ:
 *   - Decisões de acesso/feature (delegadas à Policy + Resolver)
 *   - Enforcement de escrita (read-only efetivo em RPCs = 6.0.5.3)
 *   - Conhece React/UI (retorna dados; App.tsx renderiza)
 */

import type { TenantStatus } from '../../domain/tenant/types';
import type { SubscriptionStatus, TenantPlan } from '../../domain/billing/types';
import type {
  AccessLevel,
  AccessWarning,
} from '../../domain/authorization/effectiveState';
import type { FeatureSet } from '../../domain/authorization/featureAvailability';
import {
  effectiveAccessService,
  type EffectiveAccessService,
} from './EffectiveAccessService';

/** Rotas do fluxo de onboarding (draft permitido). */
export const ONBOARDING_PATHS: readonly string[] = [
  '/onboarding/provision',
  '/onboarding/welcome',
  '/onboarding/shop-setup',
  '/onboarding/operational-setup',
];

/** Rota de bloqueio para tenant suspenso/arquivado (comportamento preservado). */
export const BLOCKED_ROUTE = '/pending-approval';

// ─── Input / Output ──────────────────────────────────────────────

export interface NavigationStateInput {
  tenantStatus: TenantStatus | null;
  subscriptionStatus?: SubscriptionStatus | null;
  plan: TenantPlan | null;
  /** Pathname atual (para decidir rotas de onboarding). */
  pathname: string;
  isSuperAdmin?: boolean;
}

export interface NavigationState {
  accessLevel: AccessLevel;
  allowed: boolean;
  /** Rota de redirecionamento (null = navegação liberada). */
  redirectTo: string | null;
  warnings: AccessWarning[];
  enabledFeatures: FeatureSet;
}

// ─── Service ─────────────────────────────────────────────────────

export interface AuthorizationService {
  getNavigationState(input: NavigationStateInput): NavigationState;
  /** Conveniência: retorna apenas o redirect (ou null). */
  resolveRoute(input: NavigationStateInput): string | null;
}

export class AuthorizationServiceImpl implements AuthorizationService {
  constructor(
    private readonly effectiveAccess: EffectiveAccessService = effectiveAccessService,
  ) {}

  getNavigationState(input: NavigationStateInput): NavigationState {
    const state = this.effectiveAccess.resolve({
      tenantStatus: input.tenantStatus,
      subscriptionStatus: input.subscriptionStatus ?? null,
      plan: input.plan,
    });

    // Superadmin: bypass total de restrição de estado (como hoje em App.tsx).
    if (input.isSuperAdmin) {
      return { ...state, accessLevel: 'full', allowed: true, redirectTo: null, warnings: [] };
    }

    // Pré-tenant (login sem tenant provisionado): sem redirect — o fluxo de
    // provision (pendingRegistration) orquestra o roteamento.
    if (input.tenantStatus === null) {
      return { ...state, allowed: true, redirectTo: null };
    }

    switch (state.accessLevel) {
      case 'onboarding':
        return {
          ...state,
          allowed: true,
          redirectTo: ONBOARDING_PATHS.includes(input.pathname) ? null : '/onboarding/welcome',
        };
      case 'none':
        return { ...state, allowed: false, redirectTo: BLOCKED_ROUTE };
      case 'full':
      case 'restricted':
      case 'readonly':
        return { ...state, allowed: true, redirectTo: null };
      default:
        // Fail-fast (ADR-013 §4.7): novo nível exige regra de navegação explícita.
        throw new Error(
          `[SMG][APPLICATION][AUTHORIZATION] nível sem regra de navegação: ${String(state.accessLevel)}`,
        );
    }
  }

  resolveRoute(input: NavigationStateInput): string | null {
    return this.getNavigationState(input).redirectTo;
  }
}

export const authorizationService = new AuthorizationServiceImpl();
