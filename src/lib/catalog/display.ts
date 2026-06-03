import { resolveAppFromHostname } from '../../middleware/resolveApp';
import type { AppSlug } from '../supabase/schemas';

type CatalogLike = {
  id?: string | null;
  name?: string | null;
  internal_name?: string | null;
  internalName?: string | null;
  commercial_name?: string | null;
  commercialName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  description?: string | null;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
};

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

const ESTETICA_DEMO_SERVICE_NAMES: Record<string, string> = {
  'demo-service-1': 'Limpeza de pele',
  'demo-service-2': 'Design de sobrancelhas',
  'Corte masculino': 'Limpeza de pele',
  'Corte Masculino': 'Limpeza de pele',
  'Sanchez Signature Cut': 'Limpeza de pele',
  Barba: 'Design de sobrancelhas',
  'Ritual de Barba Prime': 'Design de sobrancelhas',
};

const resolveDisplayAppSlug = (appSlug?: string | null): AppSlug => {
  if (appSlug === 'estetica' || appSlug === 'barber' || appSlug === 'auto' || appSlug === 'club') {
    return appSlug;
  }

  if (typeof window === 'undefined') {
    return 'barber';
  }

  return resolveAppFromHostname(window.location.hostname);
};

export function getEsteticaDemoServiceName(value?: string | null, appSlug?: string | null): string {
  const cleaned = cleanText(value);
  if (!cleaned || resolveDisplayAppSlug(appSlug) !== 'estetica') {
    return cleaned;
  }

  return ESTETICA_DEMO_SERVICE_NAMES[cleaned] || cleaned;
}

export function getCatalogInternalName(item?: CatalogLike | null): string {
  if (!item) return '';

  return (
    cleanText(item.internal_name) ||
    cleanText(item.internalName) ||
    cleanText(item.name) ||
    ''
  );
}

export function getCatalogDisplayName(item?: CatalogLike | null, appSlug?: string | null): string {
  if (!item) return '';

  const displayName = (
    cleanText(item.display_name) ||
    cleanText(item.displayName) ||
    cleanText(item.commercial_name) ||
    cleanText(item.commercialName) ||
    cleanText(item.name) ||
    cleanText(item.internal_name) ||
    cleanText(item.internalName) ||
    ''
  );

  if (resolveDisplayAppSlug(appSlug) !== 'estetica') {
    return displayName;
  }

  const demoNameById = item.id ? ESTETICA_DEMO_SERVICE_NAMES[item.id] : '';
  return demoNameById || getEsteticaDemoServiceName(displayName, appSlug);
}

export function usesCommercialName(item?: CatalogLike | null): boolean {
  if (!item) return false;

  const commercialName =
    cleanText(item.commercial_name) || cleanText(item.commercialName);

  const internalName =
    cleanText(item.internal_name) ||
    cleanText(item.internalName) ||
    cleanText(item.name);

  return Boolean(commercialName && commercialName !== internalName);
}

export function getCatalogSearchText(item?: CatalogLike | null): string {
  if (!item) return '';

  return [
    getCatalogDisplayName(item),
    item.name,
    item.internal_name,
    item.internalName,
    item.display_name,
    item.displayName,
    item.commercial_name,
    item.commercialName,
    item.description,
    item.category,
    item.sku,
    item.barcode,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
