import React from 'react';

interface Professional {
  id: string;
  name: string;
  revenue: number;
  appointments: number;
  avatar?: string;
}

interface TopProfessionalsRankingProps {
  professionals: Professional[];
  onProfessionalClick?: (id: string) => void;
  maxItems?: number;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export const TopProfessionalsRanking: React.FC<TopProfessionalsRankingProps> = ({
  professionals,
  onProfessionalClick,
  maxItems = 5,
}) => {
  const displayProfessionals = professionals.slice(0, maxItems);
  const maxRevenue = Math.max(...professionals.map(p => p.revenue), 1);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorClass = (index: number) => {
    const colors = [
      'bg-amber-500',
      'bg-slate-400',
      'bg-amber-700',
      'bg-slate-300',
      'bg-slate-500',
    ];
    return colors[index] || 'bg-slate-400';
  };

  if (!professionals || professionals.length === 0) {
    return (
      <div className="card-boutique p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">groups</span>
          Top Profissionais
        </h3>
        <div className="py-8 text-center text-slate-400 text-sm">
          Nenhum dado de profissionais
        </div>
      </div>
    );
  }

  return (
    <div className="card-boutique p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">groups</span>
          Top Profissionais
        </h3>
        <button 
          onClick={() => onProfessionalClick?.('all')}
          className="text-xs text-primary hover:text-primary/80 font-bold"
        >
          Ver todos →
        </button>
      </div>

      <div className="space-y-3">
        {displayProfessionals.map((professional, index) => (
          <div
            key={professional.id}
            onClick={() => onProfessionalClick?.(professional.id)}
            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
              index === 0 ? 'bg-amber-50 dark:bg-amber-900/10' : ''
            }`}
          >
            <div className="relative">
              {professional.avatar ? (
                <img 
                  src={professional.avatar} 
                  alt={professional.name}
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <div className={`size-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${getColorClass(index)}`}>
                  {getInitials(professional.name)}
                </div>
              )}
              {index < 3 && (
                <div className={`absolute -top-1 -left-1 size-4 rounded-full flex items-center justify-center text-[8px] font-black text-white ${getColorClass(index)}`}>
                  {index + 1}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {professional.name}
              </p>
              <p className="text-[10px] text-slate-500">
                {professional.appointments} atendimentos
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {formatCurrency(professional.revenue)}
              </p>
              <div className="w-16 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full mt-1">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(professional.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};