import React from 'react';

export const TeamStatusCard: React.FC<{
  activeStaffPercent: number;
  staffCount: number;
}> = ({ activeStaffPercent, staffCount }) => (
  <div className="card-boutique p-6 flex flex-col justify-center items-center">
    <p className="text-slate-500 text-[10px] font-bold uppercase mb-4 self-start tracking-widest">Equipe Ativa</p>
    <div className="relative size-24">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-slate-200 dark:text-slate-800"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="text-primary"
          strokeDasharray={`${activeStaffPercent}, 100`}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white display-font">{activeStaffPercent.toFixed(0)}%</span>
      </div>
    </div>
    <p className="mt-4 text-[10px] font-bold text-accent uppercase tracking-wider">Online Agora</p>
    <p className="text-[10px] text-slate-500 mt-1 uppercase">{staffCount} colaboradores</p>
  </div>
);

