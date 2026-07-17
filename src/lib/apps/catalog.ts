import type { AppSlug } from '../supabase/schemas';
import { getPublicHostnameForApp } from './publicUrl';

export interface AccessAppDefinition {
  slug: AppSlug;
  name: string;
  shortName: string;
  description: string;
  audience: string;
  status: 'active' | 'coming-soon';
}

export const ACCESS_APPS: AccessAppDefinition[] = [
  {
    slug: 'barber',
    name: 'SMG Barber',
    shortName: 'Barber',
    description: 'Sistema operacional da SMG para barbearias, com agenda, PDV, equipe e recorrencia.',
    audience: 'Barbearias e operacao de atendimento',
    status: 'active',
  },
  {
    slug: 'auto',
    name: 'SMG AutoControl',
    shortName: 'AutoControl',
    description: 'Sistema operacional da SMG para o ecossistema AutoControl com acesso dedicado por subdominio.',
    audience: 'Operacoes e processos AutoControl',
    status: 'active',
  },
  {
    slug: 'club',
    name: 'SMG Club',
    shortName: 'Club',
    description: 'Sistema operacional da SMG para clubes, assinaturas, beneficios e relacionamento continuo.',
    audience: 'Clubes, recorrencia e membership',
    status: 'active',
  },
  {
    slug: 'estetica',
    name: 'SMG Estética',
    shortName: 'Estética',
    description: 'Gestão para clínicas, studios e profissionais de estética.',
    audience: 'Clínicas, studios e profissionais de estética',
    status: 'active',
  },
];

export const getAccessApp = (appSlug: AppSlug): AccessAppDefinition =>
  ACCESS_APPS.find((app) => app.slug === appSlug) || ACCESS_APPS[0];

export const getAccessAppUrl = (appSlug: AppSlug): string =>
  `https://${getPublicHostnameForApp(appSlug)}`;
