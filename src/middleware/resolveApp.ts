import {
  APP_SLUGS,
  type AppSlug,
  DEFAULT_APP_SLUG,
  normalizeAppSlug,
} from '../lib/supabase/schemas';

export interface ResolvedAppResult {
  appSlug: AppSlug;
  hostname: string;
  isFallback: boolean;
  matchedBy: 'env-map' | 'subdomain' | 'hostname' | 'fallback';
}

const normalizeHostname = (hostname: string | null | undefined): string =>
  (hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  hostname.endsWith('.localhost');

const parseHostnameMap = (): Record<string, AppSlug> => {
  const raw = import.meta.env.VITE_APP_HOSTNAME_MAP;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<string, AppSlug>>((acc, [hostname, appSlug]) => {
      const normalizedHostname = normalizeHostname(hostname);
      if (!normalizedHostname) {
        return acc;
      }

      acc[normalizedHostname] = normalizeAppSlug(appSlug);
      return acc;
    }, {});
  } catch (error) {
    console.warn('Invalid VITE_APP_HOSTNAME_MAP. Falling back to hostname heuristics.', error);
    return {};
  }
};

const ENV_HOSTNAME_MAP = parseHostnameMap();

const inferAppSlugFromLabels = (hostname: string): AppSlug | null => {
  const labels = hostname.split('.').filter(Boolean);
  const directLabelMatch = labels.find((label) => APP_SLUGS.includes(label as AppSlug));

  if (directLabelMatch) {
    return directLabelMatch as AppSlug;
  }

  const prefixMatch = labels.find((label) =>
    APP_SLUGS.some((appSlug) => label.startsWith(`${appSlug}-`)),
  );

  if (!prefixMatch) {
    return null;
  }

  const matchedSlug = APP_SLUGS.find((appSlug) => prefixMatch.startsWith(`${appSlug}-`));
  return matchedSlug || null;
};

export const resolveAppFromHostname = (hostname: string): AppSlug => {
  const resolved = resolveApp(hostname);
  return resolved.appSlug;
};

export const resolveApp = (hostname: string): ResolvedAppResult => {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname) {
    return {
      appSlug: DEFAULT_APP_SLUG,
      hostname: '',
      isFallback: true,
      matchedBy: 'fallback',
    };
  }

  const envMatch = ENV_HOSTNAME_MAP[normalizedHostname];
  if (envMatch) {
    return {
      appSlug: envMatch,
      hostname: normalizedHostname,
      isFallback: false,
      matchedBy: 'env-map',
    };
  }

  if (isLocalHostname(normalizedHostname)) {
    const localAppSlug = normalizeAppSlug(import.meta.env.VITE_LOCAL_APP_SLUG);
    return {
      appSlug: localAppSlug,
      hostname: normalizedHostname,
      isFallback: localAppSlug === DEFAULT_APP_SLUG,
      matchedBy: 'hostname',
    };
  }

  const labelMatch = inferAppSlugFromLabels(normalizedHostname);
  if (labelMatch) {
    return {
      appSlug: labelMatch,
      hostname: normalizedHostname,
      isFallback: false,
      matchedBy: 'subdomain',
    };
  }

  return {
    appSlug: DEFAULT_APP_SLUG,
    hostname: normalizedHostname,
    isFallback: true,
    matchedBy: 'fallback',
  };
};
