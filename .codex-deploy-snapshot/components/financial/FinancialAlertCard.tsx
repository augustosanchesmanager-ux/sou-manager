import React from 'react';
import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';

interface FinancialAlertCardProps {
  title: string;
  description: string;
  level: 'high' | 'medium' | 'ok';
}

const styles = {
  high: {
    icon: <AlertTriangle size={16} />,
    container: 'border-rose-500/25 bg-rose-500/8 text-rose-700 dark:text-rose-200',
  },
  medium: {
    icon: <Bell size={16} />,
    container: 'border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-200',
  },
  ok: {
    icon: <CheckCircle2 size={16} />,
    container: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-200',
  },
};

const FinancialAlertCard: React.FC<FinancialAlertCardProps> = ({ title, description, level }) => {
  const current = styles[level];

  return (
    <article className={`rounded-xl border p-3 ${current.container}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{current.icon}</span>
        <div>
          <h4 className="text-sm font-bold">{title}</h4>
          <p className="text-xs opacity-90 mt-1">{description}</p>
        </div>
      </div>
    </article>
  );
};

export default FinancialAlertCard;
