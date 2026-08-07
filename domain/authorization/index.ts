/**
 * [SMG][DOMAIN][AUTHORIZATION] barrel
 *
 * Camada de autorização (Estado Efetivo, ADR-013 §2.4) — Fase 6.0.5.1.
 * Domínio puro: resolve features (resolver, não catálogo) e avalia acesso
 * (policy sem conhecimento de flags). Orquestração vive em application/.
 */

export * from './effectiveState';
export * from './featureAvailability';
export * from './accessPolicy';
