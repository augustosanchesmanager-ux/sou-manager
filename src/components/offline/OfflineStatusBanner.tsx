import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const RECONNECTED_VISIBLE_MS = 6000;

const OfflineStatusBanner: React.FC = () => {
  const { isOnline, lastChangedAt } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline || !lastChangedAt) {
      setShowReconnected(false);
      return;
    }

    setShowReconnected(true);
    const timeoutId = window.setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isOnline, lastChangedAt]);

  if (isOnline && !showReconnected) {
    return null;
  }

  const bannerClass = isOnline
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';

  return (
    <div className={`border-b px-4 py-2 text-sm ${bannerClass}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">
            {isOnline ? 'cloud_done' : 'cloud_off'}
          </span>
          <span className="font-semibold">
            {isOnline
              ? 'Conexao restabelecida. As pendencias locais continuam em acompanhamento.'
              : 'Voce esta offline. O modo seguro mostra dados locais preparados, sem registrar vendas ou pagamentos.'}
          </span>
        </div>

        <Link
          to="/offline-sync"
          className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/70 dark:hover:bg-white/10 sm:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">sync_problem</span>
          Pendencias offline
        </Link>
      </div>
    </div>
  );
};

export default OfflineStatusBanner;
