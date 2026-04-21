import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

type PeriodOption = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type CompareOption = 'yesterday' | 'week_ago' | 'month_ago';

interface DashboardHeaderProps {
  period: PeriodOption;
  onPeriodChange: (period: PeriodOption) => void;
  compare: CompareOption;
  onCompareChange: (compare: CompareOption) => void;
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta Semana',
  month: 'Este Mês',
  custom: 'Personalizado',
};

const COMPARE_LABELS: Record<CompareOption, string> = {
  yesterday: 'vs Ontem',
  week_ago: 'vs Semana Passada',
  month_ago: 'vs Mês Passado',
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  period,
  onPeriodChange,
  compare,
  onCompareChange,
}) => {
  const { user } = useAuth() || {};
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { icon: 'wb_sunny', text: 'Bom dia' };
    if (hour < 18) return { icon: 'wb_twilight', text: 'Boa tarde' };
    return { icon: 'nights_stay', text: 'Boa noite' };
  }, []);

  const firstName = user?.user_metadata?.first_name || 'Chef';
  const tenantName = user?.user_metadata?.tenant_name || 'Minha Barbearia';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-xl">{greeting.icon}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {greeting.text}, {firstName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tenantName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsPeriodOpen(!isPeriodOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            {PERIOD_LABELS[period]}
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
          
          {isPeriodOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    onPeriodChange(key as PeriodOption);
                    setIsPeriodOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    period === key 
                      ? 'bg-primary/10 text-primary dark:text-primary font-medium' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {period === key && <span className="mr-2">✓</span>}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setIsCompareOpen(!isCompareOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">trending_up</span>
            {COMPARE_LABELS[compare]}
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
          
          {isCompareOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
              {Object.entries(COMPARE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    onCompareChange(key as CompareOption);
                    setIsCompareOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    compare === key 
                      ? 'bg-primary/10 text-primary dark:text-primary font-medium' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {compare === key && <span className="mr-2">✓</span>}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;