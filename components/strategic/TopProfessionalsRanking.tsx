import React from 'react';

interface Professional {
  id: string;
  name: string;
  appointments: number;
  avatar?: string;
}

interface TopProfessionalsRankingProps {
  professionals: Professional[];
  onProfessionalClick?: (id: string) => void;
  maxItems?: number;
}

export const TopProfessionalsRanking: React.FC<TopProfessionalsRankingProps> = ({
  professionals,
  onProfessionalClick,
  maxItems = 5,
}) => {
  const displayProfessionals = professionals.slice(0, maxItems);
  const maxAppointments = Math.max(...professionals.map(p => p.appointments), 1);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorClass = (index: number) => {
    const colors = [
      'bg-[#007BFF]',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-sky-500',
      'bg-slate-500',
    ];
    return colors[index] || 'bg-slate-400';
  };

  if (!professionals || professionals.length === 0) {
    return (
      <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#BDEFFF] bg-[#EAF7FF] text-[#007BFF] dark:border-[#14304A] dark:bg-[#0D2238] dark:text-[#00D2FF]">
            <span className="material-symbols-outlined">content_cut</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Equipe</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">Atendimentos por profissional</h3>
          </div>
        </div>
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9EAF5] bg-[#F7FBFE] p-6 text-center dark:border-[#14304A] dark:bg-[#0B1828]">
          <span className="material-symbols-outlined mb-2 text-3xl text-slate-300">groups</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Sem atendimentos finalizados no período</p>
          <p className="mt-1 text-xs text-slate-500">O ranking aparece quando a equipe conclui serviços na agenda.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#BDEFFF] bg-[#EAF7FF] text-[#007BFF] dark:border-[#14304A] dark:bg-[#0D2238] dark:text-[#00D2FF]">
            <span className="material-symbols-outlined">content_cut</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Equipe</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">Atendimentos por profissional</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onProfessionalClick?.('all')}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#007BFF] transition hover:bg-[#EAF7FF] dark:text-[#00D2FF] dark:hover:bg-[#0D2238]"
        >
          Ver equipe
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>

      <div className="space-y-3">
        {displayProfessionals.map((professional, index) => (
          <button
            key={professional.id}
            type="button"
            onClick={() => onProfessionalClick?.(professional.id)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-[#F7FBFE] p-3 text-left transition hover:border-[#00D2FF]/50 hover:bg-[#EAF7FF] focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/30 dark:border-border-dark dark:bg-[#0B1828] dark:hover:border-[#00D2FF]/40"
          >
            <div className="relative">
              {professional.avatar ? (
                <img
                  src={professional.avatar}
                  alt={professional.name}
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <div className={`flex size-9 items-center justify-center rounded-full text-xs font-bold text-white ${getColorClass(index)}`}>
                  {getInitials(professional.name)}
                </div>
              )}
              {index < 3 && (
                <div className={`absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full text-[8px] font-black text-white ${getColorClass(index)}`}>
                  {index + 1}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {professional.name}
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                {professional.appointments} atendimento(s) finalizado(s)
              </p>
            </div>

            <div className="w-20 text-right">
              <p className="text-sm font-black text-[#003366] dark:text-white">
                {professional.appointments}
              </p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#007BFF]"
                  style={{ width: `${Math.max(8, (professional.appointments / maxAppointments) * 100)}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
