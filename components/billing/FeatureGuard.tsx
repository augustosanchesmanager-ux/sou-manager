/**
 * [SMG][COMPONENT] FeatureGuard — gate de plano (6.0.5.3) para rotas e UI.
 *
 * Decide pela flag EFETIVA do tenant (`can(feature)` via useFeatureFlags):
 * habilitada → renderiza o conteúdo; desabilitada → `UpgradePrompt`
 * (D-6.0.5.3-5 / D-6.0.5.5-2 — nunca 403 genérico, sempre orienta o upgrade).
 *
 * Composição no App.tsx: ProtectedRoute (perfil) → ModuleRoute (app) →
 * FeatureGuard (plano). O enforcement real permanece no backend (RPCs com
 * guarda) — o guard é conveniência de UI.
 */

import React from 'react';
import { useFeatureFlags } from '../../src/hooks/useFeatureFlags';
import type { FeatureKey } from '../../domain/billing/featureKey';
import UpgradePrompt from './UpgradePrompt';

interface FeatureGuardProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

const FeatureGuard: React.FC<FeatureGuardProps> = ({ feature, children }) => {
  const { can } = useFeatureFlags();

  if (!can(feature)) {
    return <UpgradePrompt feature={feature} />;
  }

  return <>{children}</>;
};

export default FeatureGuard;
