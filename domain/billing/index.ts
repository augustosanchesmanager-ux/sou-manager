/**
 * [SMG][DOMAIN][BILLING] barrel
 *
 * Domínio de billing (Lifecycle Billing 6.0.4.4).
 * Engine/limites são puros (sem Supabase); persistência via repositório.
 */

export * from './types';
export * from './billingEngine';
export * from './limits';
export * from './repository';
export * from './supabaseBillingRepository';
