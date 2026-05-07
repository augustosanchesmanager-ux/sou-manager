export interface ServiceCreditsEntry {
  service_id: string;
  service_name: string;
  credits: number;
}

export interface ServiceBalanceEntry {
  service_id: string;
  service_name: string;
  available: number;
  used: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNonNegativeNumber = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    const text = `${value || ''}`.trim();
    if (text) return text;
  }

  return '';
};

export const normalizePlanServiceCredits = (
  value: unknown,
  fallbackTotal = 0,
): ServiceCreditsEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const serviceId = firstString(entry.service_id, entry.serviceId);
        const serviceName = firstString(entry.service_name, entry.serviceName, entry.name, serviceId);
        const credits = toNonNegativeNumber(entry.credits ?? entry.available ?? entry.available_credits ?? entry.availableCredits);

        if (!serviceId || !serviceName || credits <= 0) {
          return null;
        }

        return {
          service_id: serviceId,
          service_name: serviceName,
          credits,
        };
      })
      .filter((entry): entry is ServiceCreditsEntry => entry !== null);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([serviceId, entry]) => {
        if (isRecord(entry)) {
          const normalizedServiceId = firstString(entry.service_id, entry.serviceId, serviceId);
          const serviceName = firstString(entry.service_name, entry.serviceName, entry.name, normalizedServiceId);
          const credits = toNonNegativeNumber(entry.credits ?? entry.available ?? entry.available_credits ?? entry.availableCredits);

          if (!normalizedServiceId || !serviceName || credits <= 0) return null;

          return {
            service_id: normalizedServiceId,
            service_name: serviceName,
            credits,
          };
        }

        const credits = toNonNegativeNumber(entry);
        if (!serviceId || credits <= 0) return null;

        return {
          service_id: serviceId,
          service_name: serviceId,
          credits,
        };
      })
      .filter((entry): entry is ServiceCreditsEntry => entry !== null);

    if (entries.length > 0) {
      return entries;
    }
  }

  const legacyCredits = toNonNegativeNumber(fallbackTotal);
  if (legacyCredits <= 0) {
    return [];
  }

  return [
    {
      service_id: '',
      service_name: 'Credito geral',
      credits: legacyCredits,
    },
  ];
};

export const normalizeCreditBalances = (
  value: unknown,
  fallbackAvailable = 0,
  fallbackUsed = 0,
): ServiceBalanceEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeServiceBalanceEntry(entry))
      .filter((entry): entry is ServiceBalanceEntry => entry !== null);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([serviceId, entry]) => {
        if (isRecord(entry)) {
          return normalizeServiceBalanceEntry({
            ...entry,
            service_id: firstString(entry.service_id, entry.serviceId, serviceId),
            service_name: firstString(entry.service_name, entry.serviceName, entry.name, serviceId),
          });
        }

        return normalizeServiceBalanceEntry({
          service_id: serviceId,
          service_name: serviceId,
          available: entry,
          used: 0,
        });
      })
      .filter((entry): entry is ServiceBalanceEntry => entry !== null);

    if (entries.length > 0) {
      return entries;
    }
  }

  const available = toNonNegativeNumber(fallbackAvailable);
  const used = toNonNegativeNumber(fallbackUsed);
  if (available <= 0 && used <= 0) {
    return [];
  }

  return [
    {
      service_id: '',
      service_name: 'Credito geral',
      available,
      used,
    },
  ];
};

export const normalizeServiceBalanceEntry = (value: unknown): ServiceBalanceEntry | null => {
  if (!isRecord(value)) return null;

  const serviceId = firstString(value.service_id, value.serviceId);
  const serviceName = firstString(value.service_name, value.serviceName, value.name, serviceId);
  const available = toNonNegativeNumber(value.available ?? value.available_credits ?? value.availableCredits ?? value.credits);
  const used = toNonNegativeNumber(value.used ?? value.used_credits ?? value.usedCredits);

  if (!serviceId || !serviceName || (available <= 0 && used <= 0)) {
    return null;
  }

  return {
    service_id: serviceId,
    service_name: serviceName,
    available,
    used,
  };
};

export const getTotalPlannedCredits = (entries: ServiceCreditsEntry[]): number =>
  entries.reduce((total, entry) => total + toNonNegativeNumber(entry.credits), 0);

export const getTotalAvailableCredits = (entries: ServiceBalanceEntry[]): number =>
  entries.reduce((total, entry) => total + toNonNegativeNumber(entry.available), 0);

export const getTotalUsedCredits = (entries: ServiceBalanceEntry[]): number =>
  entries.reduce((total, entry) => total + toNonNegativeNumber(entry.used), 0);

export const getAvailableCreditsForService = (
  entries: ServiceBalanceEntry[],
  serviceId?: string,
): number => {
  const normalizedServiceId = `${serviceId || ''}`.trim();
  const exactMatch = entries.find((entry) => entry.service_id === normalizedServiceId && normalizedServiceId);
  if (exactMatch) {
    return exactMatch.available;
  }

  const fallback = entries.find((entry) => !entry.service_id);
  return fallback?.available || 0;
};

export const getPlanCreditsForService = (
  entries: ServiceCreditsEntry[],
  serviceId?: string,
): number => {
  const normalizedServiceId = `${serviceId || ''}`.trim();
  const exactMatch = entries.find((entry) => entry.service_id === normalizedServiceId && normalizedServiceId);
  if (exactMatch) {
    return exactMatch.credits;
  }

  const fallback = entries.find((entry) => !entry.service_id);
  return fallback?.credits || 0;
};

export const buildServiceBalancesFromPlan = (
  entries: ServiceCreditsEntry[],
): ServiceBalanceEntry[] =>
  entries
    .filter((entry) => entry.credits > 0)
    .map((entry) => ({
      service_id: entry.service_id,
      service_name: entry.service_name,
      available: entry.credits,
      used: 0,
    }));
