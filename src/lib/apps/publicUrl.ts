import { type AppSlug } from '../supabase/schemas';

const DEFAULT_PUBLIC_APP_HOSTS: Record<AppSlug, string> = {
  barber: 'barber.soumanager.com',
  club: 'club.soumanager.com',
  auto: 'autocontrol.soumanager.com',
};

const INSTITUTIONAL_HOSTS = new Set(['soumanager.com', 'www.soumanager.com']);

const normalizeHostname = (hostname: string | null | undefined): string =>
  (hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

const parsePublicHostnameMap = (): Partial<Record<AppSlug, string>> => {
  const raw = import.meta.env.VITE_APP_PUBLIC_HOSTNAME_MAP;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Partial<Record<AppSlug, string>>>((acc, [appSlug, hostname]) => {
      if (appSlug === 'barber' || appSlug === 'club' || appSlug === 'auto') {
        acc[appSlug] = normalizeHostname(hostname);
      }

      return acc;
    }, {});
  } catch (error) {
    console.warn('Invalid VITE_APP_PUBLIC_HOSTNAME_MAP. Falling back to default public app hosts.', error);
    return {};
  }
};

const PUBLIC_APP_HOSTS: Record<AppSlug, string> = {
  ...DEFAULT_PUBLIC_APP_HOSTS,
  ...parsePublicHostnameMap(),
};

const normalizeHashPath = (hashPath: string): string => {
  const sanitized = (hashPath || '').trim();
  if (!sanitized) {
    return '/dashboard';
  }

  const withoutHash = sanitized.startsWith('#') ? sanitized.slice(1) : sanitized;
  return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`;
};

export const isInstitutionalHostname = (hostname: string | null | undefined): boolean =>
  INSTITUTIONAL_HOSTS.has(normalizeHostname(hostname));

export const getPublicHostnameForApp = (appSlug: AppSlug): string => PUBLIC_APP_HOSTS[appSlug];

export const buildAppUrl = (
  appSlug: AppSlug,
  hashPath = '/dashboard',
  currentLocation: Pick<Location, 'protocol'> = window.location,
): string => {
  const protocol = currentLocation.protocol === 'http:' ? 'http:' : 'https:';
  return `${protocol}//${getPublicHostnameForApp(appSlug)}/#${normalizeHashPath(hashPath)}`;
};
