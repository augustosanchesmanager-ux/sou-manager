import React from 'react';
import { WalletCards } from 'lucide-react';

interface EmptyStateFinanceProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyStateFinance: React.FC<EmptyStateFinanceProps> = ({ title, description, actionLabel, onAction }) => {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 dark:border-border-dark bg-white/80 dark:bg-card-dark/70 p-10 text-center">
      <div className="mx-auto size-14 rounded-2xl bg-slate-100 dark:bg-white/5 grid place-items-center text-slate-500 dark:text-slate-300">
        <WalletCards size={24} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </section>
  );
};

export default EmptyStateFinance;
