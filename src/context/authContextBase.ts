import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthSessionData {
  session: Session | null;
  user: User | null;
}

export const AuthSessionContext = createContext<AuthSessionData | undefined>(undefined);

export const useAuthSession = (): AuthSessionData => {
  const ctx = useContext(AuthSessionContext);
  if (ctx === undefined) {
    throw new Error('useAuthSession must be used within an AuthProvider');
  }
  return ctx;
};
