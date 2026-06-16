import { useEffect, useState } from 'react';
import type { OfflineConnectionState } from '../lib/offline/offlineTypes';

export interface OnlineStatusState {
  isOnline: boolean;
  connectionState: OfflineConnectionState;
  lastChangedAt: Date | null;
}

const getInitialOnlineStatus = (): boolean => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
};

export const useOnlineStatus = (): OnlineStatusState => {
  const [state, setState] = useState<OnlineStatusState>(() => {
    const isOnline = getInitialOnlineStatus();
    return {
      isOnline,
      connectionState: isOnline ? 'online' : 'offline',
      lastChangedAt: null,
    };
  });

  useEffect(() => {
    const updateStatus = () => {
      const isOnline = getInitialOnlineStatus();
      setState((current) => {
        if (current.isOnline === isOnline) {
          return current;
        }

        return {
          isOnline,
          connectionState: isOnline ? 'online' : 'offline',
          lastChangedAt: new Date(),
        };
      });
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return state;
};
