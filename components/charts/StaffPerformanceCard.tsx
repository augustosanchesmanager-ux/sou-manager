import React from 'react';
import { SparkLineChart } from './SparkLineChart';
import { TrendBadge } from './TrendBadge';

interface StaffMember {
  id: string;
  name: string;
  avatar?: string;
  revenue: number;
  revenuePrevious?: number;
  appointments: number;
  avgTicket: number;
  trendData?: number[];
}

interface StaffPerformanceCardProps {
  staff: StaffMember;
  rank: number;
  onClick?: () => void;
}

const RANK_COLORS = [
  'bg-[#B88A44]',
  'bg-slate-400',
  'bg-[#7A5528]',
];

export const StaffPerformanceCard: React.FC<StaffPerformanceCardProps> = ({
  staff,
  rank,
  onClick,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const revenueGrowth = staff.revenuePrevious 
    ? ((staff.revenue - staff.revenuePrevious) / staff.revenuePrevious) * 100 
    : 0;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div 
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#262A33]
        bg-white dark:bg-[#1A1A1D] p-4 
        transition-all duration-200 hover:border-[#007BFF]/35 hover:shadow-md
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Rank Badge */}
      <div className="absolute -top-2 -right-2 z-10">
        <div className={`
          size-7 rounded-full flex items-center justify-center shadow-sm
          ${rank <= 3 ? RANK_COLORS[rank - 1] : 'bg-slate-200 dark:bg-slate-700'}
        `}>
          {rank <= 3 ? (
            <span className={`material-symbols-outlined text-white text-sm`}>
              {rank === 1 ? 'emoji_events' : rank === 2 ? 'military_tech' : 'workspace_premium'}
            </span>
          ) : (
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">
              {rank}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          {staff.avatar ? (
            <img 
              src={staff.avatar} 
              alt={staff.name}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100 dark:ring-slate-800"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#007BFF]/10 flex items-center justify-center ring-2 ring-slate-100 dark:ring-slate-800">
              <span className="text-[#007BFF] font-bold text-sm">
                {getInitials(staff.name)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                {staff.name}
              </h4>
              <p className="text-xs text-slate-500">
                {staff.appointments} atendimentos
              </p>
            </div>
            
            {revenueGrowth !== 0 && (
              <TrendBadge value={revenueGrowth} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-bold text-slate-500">
              Faturamento
            </p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(staff.revenue)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">
              Ticket Médio
            </p>
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">
              {formatCurrency(staff.avgTicket)}
            </p>
          </div>
        </div>

        {/* Sparkline */}
        {staff.trendData && staff.trendData.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-500 mb-2">
              Tendência
            </p>
            <SparkLineChart 
              data={staff.trendData}
              color={revenueGrowth >= 0 ? '#10B981' : '#EF4444'}
              width={180}
              height={28}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPerformanceCard;
