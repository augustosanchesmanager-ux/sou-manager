import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { setActiveAppContext } from '../lib/supabase/client';
import {
  appSupportsModule,
  type AppModuleSlug,
  type AppSlug,
  DEFAULT_APP_SLUG,
  resolveSchemaForApp,
  SHARED_SCHEMA,
  type SupabaseSchemaName,
} from '../lib/supabase/schemas';
import { resolveApp } from '../middleware/resolveApp';

export interface AppContextValue {
  appSlug: AppSlug;
  schema: SupabaseSchemaName;
  coreSchema: typeof SHARED_SCHEMA;
  hostname: string;
  isFallback: boolean;
  matchedBy: 'env-map' | 'subdomain' | 'hostname' | 'fallback';
  isResolved: boolean;
  supportsModule: (moduleSlug: AppModuleSlug) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const getInitialState = (): AppContextValue => ({
  appSlug: DEFAULT_APP_SLUG,
  schema: resolveSchemaForApp(DEFAULT_APP_SLUG),
  coreSchema: SHARED_SCHEMA,
  hostname: 'localhost',
  isFallback: true,
  matchedBy: 'fallback',
  isResolved: false,
  supportsModule: (moduleSlug) => appSupportsModule(DEFAULT_APP_SLUG, moduleSlug),
});

const resolveContextFromWindow = (): AppContextValue => {
  if (typeof window === 'undefined') {
    return getInitialState();
  }

  const resolvedApp = resolveApp(window.location.hostname);
  return {
    appSlug: resolvedApp.appSlug,
    schema: resolveSchemaForApp(resolvedApp.appSlug),
    coreSchema: SHARED_SCHEMA,
    hostname: resolvedApp.hostname,
    isFallback: resolvedApp.isFallback,
    matchedBy: resolvedApp.matchedBy,
    isResolved: true,
    supportsModule: (moduleSlug) => appSupportsModule(resolvedApp.appSlug, moduleSlug),
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppContextValue>(() => resolveContextFromWindow());

  useEffect(() => {
    const nextState = resolveContextFromWindow();
    setState((currentState) => {
      if (
        currentState.appSlug === nextState.appSlug &&
        currentState.schema === nextState.schema &&
        currentState.hostname === nextState.hostname &&
        currentState.isFallback === nextState.isFallback &&
        currentState.matchedBy === nextState.matchedBy
      ) {
        return currentState;
      }

      return nextState;
    });
  }, []);

  useEffect(() => {
    setActiveAppContext({
      appSlug: state.appSlug,
      schema: state.schema,
      hostname: state.hostname,
    });
  }, [state.appSlug, state.hostname, state.schema]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      supportsModule: (moduleSlug) => appSupportsModule(state.appSlug, moduleSlug),
    }),
    [state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
};

export const useAppOptional = (): AppContextValue | undefined => useContext(AppContext);
