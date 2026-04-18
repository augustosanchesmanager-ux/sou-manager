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

export const normalizePlanServiceCredits = (
  value: unknown,
  fallbackTotal = 0,
): ServiceCreditsEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const serviceId = `${entry.service_id || ''}`.trim();
        const serviceName = `${entry.service_name || ''}`.trim();
        const credits = toNonNegativeNumber(entry.credits);

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
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const serviceId = `${entry.service_id || ''}`.trim();
        const serviceName = `${entry.service_name || ''}`.trim();
        const available = toNonNegativeNumber(entry.available);
        const used = toNonNegativeNumber(entry.used);

        if (!serviceId || !serviceName || (available <= 0 && used <= 0)) {
          return null;
        }

        return {
          service_id: serviceId,
          service_name: serviceName,
          available,
          used,
        };
      })
      .filter((entry): entry is ServiceBalanceEntry => entry !== null);
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

export const getTotalPlannedCredits = (entries: ServiceCreditsEntry[]): number =>
  entries.reduce((total, entry) => total + toNonNegativeNumber(entry.credits), 0);

export const getTotalAvailableCredits = (entries: ServiceBalanceEntry[]): number =>
  entries.reduce((total, entry) => total + toNonNegativeNumber(entry.available), 0);

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
