import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { LoadingOverlay } from '../components/ui/Loading/LoadingOverlay';
import { getLoadingMessage, type LoadingMessageKey } from '../lib/loadingMessages';

interface LoadingState {
  isLoading: boolean;
  message: string | null;
  queue: Array<{ id: string; message: string }>;
}

interface LoadingContextType extends LoadingState {
  showLoading: (message: LoadingMessageKey | string, duration?: number) => void;
  hideLoading: () => void;
  hideAll: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    message: null,
    queue: [],
  });

  const showLoading = useCallback((message: LoadingMessageKey | string, duration?: number) => {
    const id = generateId();
    const msg = getLoadingMessage(message);

    setState((prev) => {
      const newQueue = [...prev.queue, { id, message: msg }];
      return {
        isLoading: true,
        message: msg,
        queue: newQueue,
      };
    });

    if (duration && duration > 0) {
      setTimeout(() => {
        setState((prev) => {
          const newQueue = prev.queue.filter((item) => item.id !== id);
          return {
            isLoading: newQueue.length > 0,
            message: newQueue.length > 0 ? newQueue[newQueue.length - 1].message : null,
            queue: newQueue,
          };
        });
      }, duration);
    }
  }, []);

  const hideLoading = useCallback(() => {
    setState((prev) => {
      const newQueue = prev.queue.slice(0, -1);
      return {
        isLoading: newQueue.length > 0,
        message: newQueue.length > 0 ? newQueue[newQueue.length - 1].message : null,
        queue: newQueue,
      };
    });
  }, []);

  const hideAll = useCallback(() => {
    setState({
      isLoading: false,
      message: null,
      queue: [],
    });
  }, []);

  useEffect(() => {
    if (state.queue.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [state.queue.length]);

  return (
    <LoadingContext.Provider
      value={{
        ...state,
        showLoading,
        hideLoading,
        hideAll,
      }}
    >
      {children}
      {state.isLoading && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <LoadingOverlay
            message={state.message || 'Carregando...'}
            showBackdrop={true}
            spinnerProps={{ size: 'xl', color: 'primary' }}
          />
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const useLoadingOptional = (): LoadingContextType | undefined => useContext(LoadingContext);
