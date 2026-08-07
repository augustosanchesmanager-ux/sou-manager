/**
 * [SMG][APPLICATION][AUTHORIZATION] barrel
 *
 * Camada de orquestração da autorização (Estado Efetivo, ADR-013 §2.4).
 * EffectiveAccessService compõe Policy + Resolver; AuthorizationService é a
 * API pública de navegação para a UI (App.tsx não conhece regras).
 */

export * from './EffectiveAccessService';
export * from './AuthorizationService';
