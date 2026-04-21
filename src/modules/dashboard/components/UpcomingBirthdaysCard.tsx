import React from 'react';
import type { UpcomingBirthday } from '../types';

export const UpcomingBirthdaysCard: React.FC<{
  upcomingBirthdays: UpcomingBirthday[];
  onNavigateClients: () => void;
}> = ({ upcomingBirthdays, onNavigateClients }) => (
  <div className="card-boutique p-6">
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-pink-500">cake</span>
        <h3 className="font-bold text-slate-900 dark:text-white">Aniversariantes Próximos</h3>
      </div>
      <button onClick={onNavigateClients} className="text-pink-500 text-xs font-bold uppercase tracking-wider hover:text-pink-600 dark:hover:text-pink-400 transition-colors">
        Ver Mês
      </button>
    </div>

    <div className="space-y-4">
      {upcomingBirthdays.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Nenhum aniversariante próximo.</p>
      ) : (
        upcomingBirthdays.map((person, index) => (
          <div key={`${person.id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            {person.avatar ? (
              <img src={person.avatar} alt={person.name} className="size-10 rounded-full border border-slate-200 dark:border-white/5 object-cover shrink-0" />
            ) : (
              <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-slate-400">person</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{person.name}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${person.daysUntil === 0 ? 'bg-pink-500 text-white' : 'text-pink-500 bg-pink-500/10'}`}>
                  {person.daysUntil === 0 ? 'Hoje' : person.displayDate}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[10px] text-slate-400">history</span>
                <p className="text-[10px] text-slate-500 truncate">Ultima visita: {person.lastVisitText}</p>
              </div>
            </div>
            {(person.status === 'overdue' || person.daysUntil === 0) && (
              <button
                onClick={() => window.open(`https://wa.me/55${person.phone.replace(/\D/g, '')}`, '_blank')}
                title="Enviar Oferta no WhatsApp"
                className="size-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
              </button>
            )}
          </div>
        ))
      )}
    </div>
  </div>
);

