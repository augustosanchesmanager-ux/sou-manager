/**
 * [SMG][DOMAIN][COMMISSION] barrel
 *
 * Domínio de comissões: cálculo, participantes, formatação, tipos, records.
 * Funções puras + repository (com dependência de Supabase via DI).
 */

export * from './types';
export * from './calculate';
export * from './participants';
export * from './format';
export * from './commissionRecordTypes';
export { CommissionRecordRepository, commissionRecordRepository } from './commissionRecordRepository';
