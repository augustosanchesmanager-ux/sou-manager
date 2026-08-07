/**
 * [SMG][DOMAIN][BILLING] featureKey — catálogo tipado de FeatureKeys
 *
 * FONTE ÚNICA dos 20 FeatureKey do licenciamento (gate de plano).
 * Corresponde 1:1 às linhas da tabela `features` (migration
 * 20260806090000_phase_6_0_5_2_plans_catalog.sql) — a sincronia é garantida
 * por teste de regressão (BD ↔ TS).
 *
 * Taxonomias distintas (não confundir):
 *   - `FeatureKey` (aqui, 20): capacidade/gate de plano (licenciamento).
 *   - `AppModuleSlug` (domain/shared/app.ts, 21): módulo de rota/UI por app.
 *   Uma feature mapeia para um-ou-mais módulos; o seed de `features` usa
 *   exclusivamente `FeatureKey`.
 *
 * Domínio puro — zero dependência de Supabase/React.
 */

export const FEATURE_KEYS = [
  // Core
  'appointments',
  'pos',
  'clients',
  'services',
  'products',
  'team',
  'dashboard',
  // Financial
  'finance',
  'cash_closing',
  'commissions',
  'receivables',
  'expenses',
  // Engagement
  'chef_club',
  'vouchers',
  'promotions',
  // Integration
  'api',
  'whatsapp',
  'marketplace',
  // Admin
  'multi_unit',
  'bi',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Conjunto de features habilitadas (ordem importa para o resolver). */
export type FeatureSet = readonly FeatureKey[];
