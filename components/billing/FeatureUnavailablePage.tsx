/**
 * [SMG][COMPONENT] FeatureUnavailablePage — página reutilizável de recurso
 * indisponível no plano atual.
 *
 * 6.0.5.5 (D-6.0.5.3-5 / D-6.0.5.5-2): passou a ser um ALIAS de
 * `UpgradePrompt` (fallback do `FeatureGuard`). Mantém o nome público para
 * compatibilidade de imports — a UI única vive em UpgradePrompt.
 */

export { default } from './UpgradePrompt';
