import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-white/10 dark:bg-white/5">
    <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-white/10">
      <Inbox className="h-5 w-5 text-slate-400" />
    </div>
    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
    <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

export default EmptyState;
