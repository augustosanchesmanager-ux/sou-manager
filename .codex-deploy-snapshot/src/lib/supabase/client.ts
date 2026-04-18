import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type AppSlug,
  DEFAULT_APP_SLUG,
  type SupabaseSchemaName,
  getSchemaForTable,
  resolveSchemaForApp,
  SHARED_SCHEMA,
} from './schemas';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
const LOCAL_DEMO_STORAGE_KEY = 'soumanager.local.demo.session';
const LOCAL_DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const LOCAL_DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000101';
const LOCAL_DEMO_EMAIL = 'teste@soumanager.local';
const LOCAL_DEMO_PASSWORD = '12345678';

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL_SESSION';
type AuthChangeCallback = (event: AuthChangeEvent, session: any) => void;

const isLocalBrowserHost = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
};

const isLocalDemoEnabled = (): boolean => !hasSupabaseEnv && isLocalBrowserHost();

const getDemoTenantRecord = () => ({
  id: LOCAL_DEMO_TENANT_ID,
  name: 'Sou Manager Demo',
  slug: 'sou-manager-demo',
  app_slug: DEFAULT_APP_SLUG,
  active: true,
  created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
});

const getDemoUser = () => ({
  id: LOCAL_DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: LOCAL_DEMO_EMAIL,
  email_confirmed_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  phone: '',
  confirmed_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    first_name: 'Teste',
    last_name: 'Local',
    full_name: 'Teste Local',
    role: 'manager',
    shop_name: 'Sou Manager Demo',
    tenant_id: LOCAL_DEMO_TENANT_ID,
  },
  identities: [],
  created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
});

const buildDemoSession = () => ({
  access_token: 'local-demo-access-token',
  refresh_token: 'local-demo-refresh-token',
  expires_in: 60 * 60 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  token_type: 'bearer',
  user: getDemoUser(),
});

const readDemoSession = () => {
  if (!isLocalDemoEnabled() || typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LOCAL_DEMO_STORAGE_KEY) === '1' ? buildDemoSession() : null;
};

const writeDemoSession = (enabled: boolean) => {
  if (!isLocalDemoEnabled() || typeof window === 'undefined') {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(LOCAL_DEMO_STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(LOCAL_DEMO_STORAGE_KEY);
  }
};

const authSubscribers = new Map<string, AuthChangeCallback>();

const notifyAuthSubscribers = (event: AuthChangeEvent, session: any) => {
  authSubscribers.forEach((callback) => {
    callback(event, session);
  });
};

const createLocalDemoQueryBuilder = (table: string) => {
  const filters: Record<string, unknown> = {};

  const resolveRows = () => {
    const demoTenant = getDemoTenantRecord();

    switch (table) {
      case 'profiles':
        if (filters.id === LOCAL_DEMO_USER_ID) {
          return [{
            id: LOCAL_DEMO_USER_ID,
            tenant_id: LOCAL_DEMO_TENANT_ID,
            role: 'manager',
            status: 'active',
            full_name: 'Teste Local',
            created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
            updated_at: new Date().toISOString(),
          }];
        }
        return [];
      case 'staff':
        return [];
      case 'user_tenants':
        if (filters.user_id === LOCAL_DEMO_USER_ID) {
          return [{
            tenant_id: LOCAL_DEMO_TENANT_ID,
            role: 'manager',
            is_primary: true,
          }];
        }
        return [];
      case 'tenants':
        if (Array.isArray(filters.id) && filters.id.includes(LOCAL_DEMO_TENANT_ID)) {
          return [demoTenant];
        }
        return [];
      case 'usage_logs':
      case 'alerts':
      case 'notification_channels':
        return [];
      default:
        return [];
    }
  };

  const resolveResult = () => Promise.resolve({ data: resolveRows(), error: null });

  const builder = {
    select() {
      return builder;
    },
    eq(field: string, value: unknown) {
      filters[field] = value;
      return builder;
    },
    in(field: string, values: unknown[]) {
      filters[field] = values;
      return builder;
    },
    order() {
      return resolveResult();
    },
    maybeSingle() {
      const rows = resolveRows();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    single() {
      const rows = resolveRows();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
      return resolveResult().then(onFulfilled, onRejected);
    },
  };

  return builder;
};

const createLocalDemoClient = (): SupabaseClient => {
  const auth = {
    getSession: async () => ({ data: { session: readDemoSession() }, error: null }),
    onAuthStateChange: (callback: AuthChangeCallback) => {
      const id = `${Date.now()}-${Math.random()}`;
      authSubscribers.set(id, callback);
      Promise.resolve().then(() => callback('INITIAL_SESSION', readDemoSession()));
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authSubscribers.delete(id);
            },
          },
        },
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isLocalDemoEnabled()) {
        return {
          data: { user: null, session: null },
          error: new Error('Supabase nao configurado neste ambiente.'),
        };
      }

      if (normalizedEmail !== LOCAL_DEMO_EMAIL || password !== LOCAL_DEMO_PASSWORD) {
        return {
          data: { user: null, session: null },
          error: new Error('Invalid login credentials'),
        };
      }

      writeDemoSession(true);
      const session = buildDemoSession();
      notifyAuthSubscribers('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    },
    signOut: async () => {
      writeDemoSession(false);
      notifyAuthSubscribers('SIGNED_OUT', null);
      return { error: null };
    },
    signUp: async () => ({
      data: { user: null, session: null },
      error: new Error('Cadastro remoto indisponivel no modo local. Use o acesso de teste.'),
    }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: getDemoUser() }, error: null }),
    getUser: async () => ({ data: { user: readDemoSession()?.user ?? null }, error: null }),
  };

  const client = {
    auth,
    from: (table: string) => createLocalDemoQueryBuilder(table),
    schema: () => client,
    rpc: async (fn: string) => {
      if (fn === 'get_auth_access_context' && readDemoSession()) {
        return {
          data: {
            tenant_id: LOCAL_DEMO_TENANT_ID,
            access_role: 'manager',
            profile_status: 'active',
            is_super_admin: false,
          },
          error: null,
        };
      }

      return { data: null, error: new Error('RPC indisponivel no modo local.') };
    },
  };

  return client as unknown as SupabaseClient;
};

const baseClient = hasSupabaseEnv
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createLocalDemoClient();

interface ActiveAppState {
  appSlug: AppSlug;
  schema: SupabaseSchemaName;
  hostname: string;
}

let activeAppState: ActiveAppState = {
  appSlug: DEFAULT_APP_SLUG,
  schema: resolveSchemaForApp(DEFAULT_APP_SLUG),
  hostname: 'localhost',
};

const schemaClientCache = new Map<SupabaseSchemaName, SupabaseClient>();
const scopedClientCache = new Map<AppSlug, SupabaseClient>();

const getOrCreateSchemaClient = (schema: SupabaseSchemaName): SupabaseClient => {
  if (schema === SHARED_SCHEMA) {
    return baseClient;
  }

  const cachedClient = schemaClientCache.get(schema);
  if (cachedClient) {
    return cachedClient;
  }

  const schemaClient = baseClient.schema(schema);
  schemaClientCache.set(schema, schemaClient);
  return schemaClient;
};

export const setActiveAppContext = (nextState: ActiveAppState): void => {
  activeAppState = nextState;
};

export const getActiveAppContext = (): ActiveAppState => activeAppState;

export const getSharedClient = (): SupabaseClient => baseClient;

export const getSchemaClient = (schema: SupabaseSchemaName): SupabaseClient =>
  getOrCreateSchemaClient(schema);

const createScopedClient = (appSlug: AppSlug): SupabaseClient => {
  const targetClient = getSchemaClient(resolveSchemaForApp(appSlug));

  return new Proxy(targetClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => getClientForTable(table, appSlug).from(table);
      }

      if (prop === 'schema') {
        return (schema: SupabaseSchemaName) => getSchemaClient(schema);
      }

      if (prop === 'rpc') {
        return (...args: unknown[]) =>
          (getSharedClient().rpc as (...rpcArgs: unknown[]) => unknown)(...args);
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient;
};

export const getScopedClient = (appSlug: AppSlug = activeAppState.appSlug): SupabaseClient => {
  const cachedClient = scopedClientCache.get(appSlug);
  if (cachedClient) {
    return cachedClient;
  }

  const scopedClient = createScopedClient(appSlug);
  scopedClientCache.set(appSlug, scopedClient);
  return scopedClient;
};

export const getClientForTable = (
  table: string,
  appSlug: AppSlug = activeAppState.appSlug,
): SupabaseClient => {
  const schema = getSchemaForTable(table, appSlug);
  return getSchemaClient(schema);
};

export const supabase = new Proxy(baseClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => getClientForTable(table).from(table);
    }

    if (prop === 'schema') {
      return (schema: SupabaseSchemaName) => getSchemaClient(schema);
    }

    if (prop === 'rpc') {
      return (...args: unknown[]) =>
        (getSharedClient().rpc as (...rpcArgs: unknown[]) => unknown)(...args);
    }

    return Reflect.get(target, prop, receiver);
  },
}) as SupabaseClient;
