/**
 * [SMG][BILLING] featureFlagsCache
 *
 * Cache de sessão desacoplado de React/AuthContext para evitar import circular
 * entre `context/AuthContext.tsx` e `src/hooks/useFeatureFlags.ts` (Issue #387).
 */

import type { FeatureSet } from '../../../domain/billing/featureKey';

export const featureFlagsResolutionCache = new Map<string, FeatureSet>();

/** Limpa o cache de feature flags (invocado em signOut / troca de sessão). */
export function clearFeatureFlagsCache(): void {
  featureFlagsResolutionCache.clear();
}
