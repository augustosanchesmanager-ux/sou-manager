import React from 'react';
import { Link } from 'react-router-dom';

interface ClientBaseCardProps {
  totalClients: number;
  loading?: boolean;
}

export const ClientBaseCard: React.FC<ClientBaseCardProps> = ({
  totalClients,
  loading,
}) => {
  if (loading) {
    return (
      <div className="bg-card border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary-dark">group</span>
          <h4 className="font-bold text-ink text-sm">Base de clientes</h4>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gold-pale rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary-dark">group</span>
        <h4 className="font-bold text-ink text-sm">Base de clientes</h4>
      </div>

      <div className="space-y-2">
        <p className="text-2xl font-black tabular-nums tracking-[-0.02em] text-ink">
          {totalClients}
        </p>
        <p className="text-xs text-ink-soft">
          {totalClients === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
        </p>
      </div>

      <Link
        to="/clients"
        className="mt-3 inline-flex items-center gap-1 text-xs font-black text-primary hover:text-primary-dark transition-colors touch-manipulation focus:outline-none focus-visible:underline"
      >
        Ver clientes →
      </Link>
    </div>
  );
};

export default ClientBaseCard;