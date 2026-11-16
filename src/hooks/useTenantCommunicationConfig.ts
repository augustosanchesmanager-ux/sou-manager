import { useEffect, useState } from 'react';
import { tenantSettingsRepository } from '../../domain/tenantSettings/repository';
import { useTenantOptional } from '../context/TenantContext';
import { buildPublicBookingUrl } from '../utils/whatsappHub';

export interface TenantCommunicationConfig {
  barbershopName: string;
  bookingSlug: string;
  bookingUrl: string;
  googleReviewUrl: string | null;
  loading: boolean;
}

interface CachedCommunicationRecord {
  displayName: string | null;
  slug: string | null;
  googleReviewUrl: string | null;
}

const configCache = new Map<string, CachedCommunicationRecord>();

export function invalidateTenantCommunicationCache(tenantId?: string | null): void {
  if (tenantId) {
    configCache.delete(tenantId);
    return;
  }
  configCache.clear();
}

export function useTenantCommunicationConfig(
  explicitTenantId?: string | null,
): TenantCommunicationConfig {
  const tenantContext = useTenantOptional();
  const effectiveTenantId = explicitTenantId ?? tenantContext?.tenantId ?? null;
  const fallbackSlug = tenantContext?.tenantSlug || 'sua-barbearia';
  const fallbackName = tenantContext?.tenant?.name || 'nossa barbearia';

  const cached = effectiveTenantId ? configCache.get(effectiveTenantId) : undefined;
  const [record, setRecord] = useState<CachedCommunicationRecord | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(effectiveTenantId && !cached));

  useEffect(() => {
    if (!effectiveTenantId) {
      setRecord(null);
      setLoading(false);
      return;
    }

    const existing = configCache.get(effectiveTenantId);
    if (existing) {
      setRecord(existing);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    tenantSettingsRepository
      .getOnlineBookingSettings(effectiveTenantId)
      .then((settings) => {
        if (cancelled) return;
        const nextRecord: CachedCommunicationRecord = {
          displayName: settings?.display_name ?? null,
          slug: settings?.slug ?? null,
          googleReviewUrl: settings?.google_review_url ?? null,
        };
        configCache.set(effectiveTenantId, nextRecord);
        setRecord(nextRecord);
      })
      .catch(() => {
        if (cancelled) return;
        setRecord({
          displayName: null,
          slug: null,
          googleReviewUrl: null,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveTenantId]);

  const effectiveSlug = record?.slug || fallbackSlug;
  const barbershopName = record?.displayName || fallbackName;

  return {
    barbershopName,
    bookingSlug: effectiveSlug,
    bookingUrl: buildPublicBookingUrl(effectiveSlug),
    googleReviewUrl: record?.googleReviewUrl || null,
    loading,
  };
}
