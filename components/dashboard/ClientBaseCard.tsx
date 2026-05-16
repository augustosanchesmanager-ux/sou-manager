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
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-blue-500">group</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Base de clientes</h4>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-blue-500">group</span>
        <h4 className="font-bold text-slate-900 dark:text-white text-sm">Base de clientes</h4>
      </div>

      <div className="space-y-2">
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {totalClients}
        </p>
        <p className="text-xs text-slate-500">
          {totalClients === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
        </p>
      </div>

      <Link
        to="/clients"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
      >
        Ver clientes →
      </Link>
    </div>
  );
};

export default ClientBaseCard;