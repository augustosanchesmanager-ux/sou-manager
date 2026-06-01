type CatalogLike = {
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

export function getCatalogInternalName(item?: CatalogLike | null): string {
  if (!item) return '';

  return (
    cleanText(item.internal_name) ||
    cleanText(item.internalName) ||
    cleanText(item.name) ||
    ''
  );
}

export function getCatalogDisplayName(item?: CatalogLike | null): string {
  if (!item) return '';

  return (
    cleanText(item.display_name) ||
    cleanText(item.displayName) ||
    cleanText(item.commercial_name) ||
    cleanText(item.commercialName) ||
    cleanText(item.name) ||
    cleanText(item.internal_name) ||
    cleanText(item.internalName) ||
    ''
  );
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