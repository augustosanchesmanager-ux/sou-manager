import { useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getScopedClient } from '../lib/supabase/client';
import { useApp, useAppOptional } from '../context/AppContext';

export const useResolvedClient = (): SupabaseClient<any> => {
  const { appSlug } = useApp();

  return useMemo(() => {
    return getScopedClient(appSlug);
  }, [appSlug]);
};

export const useResolvedClientOrNull = (): SupabaseClient<any> | null => {
  const appContext = useAppOptional();

  if (!appContext?.appSlug) {
    return null;
  }

  return useMemo(() => {
    return getScopedClient(appContext.appSlug);
  }, [appContext.appSlug]);
};