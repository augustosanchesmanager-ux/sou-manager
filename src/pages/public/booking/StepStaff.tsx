/**
 * StepStaff - Professional selection.
 * Highlighted "Qualquer Profissional Disponível" card + list of barbeiros.
 * Single select with avatar circle (initial or avatar_url).
 */

import React from 'react';
import { Zap, User, Check } from 'lucide-react';
import type { PublicStaff } from './hooks/types';

interface StepStaffProps {
  staff: PublicStaff[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  anyStaffId: string;
  isLoading?: boolean;
}

const StepStaff: React.FC<StepStaffProps> = ({
  staff,
  selectedId,
  onSelect,
  anyStaffId,
  isLoading,
}) => {
  const activeStaff = staff.filter((s) => s.status === 'active');

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando profissionais">
        <div className="animate-pulse">
          <div className="h-20 bg-line/50 rounded-xl" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-line/50 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (activeStaff.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 mx-auto text-line mb-3" />
        <p className="text-ink-soft">Nenhum profissional disponível no momento</p>
      </div>
    );
  }

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-4" role="list" aria-label="Profissionais disponíveis">
      {/* "Qualquer Profissional Disponível" option */}
      <button
        type="button"
        onClick={() => onSelect(anyStaffId)}
        className={`w-full relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          selectedId === anyStaffId
            ? 'border-primary bg-gold-pale/50 dark:bg-gold-soft/20'
            : 'border-line bg-white dark:bg-card-dark hover:border-primary/30'
        }`}
        aria-pressed={selectedId === anyStaffId}
        aria-label="Qualquer profissional disponível - o sistema escolhe quem estiver livre no horário"
      >
        <div className="flex-shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-bold text-ink">Qualquer Profissional Disponível</h3>
          <p className="text-sm text-ink-soft mt-0.5">
            O sistema escolhe quem estiver livre no horário selecionado
          </p>
        </div>

        {selectedId === anyStaffId && (
          <>
            <div className="flex-shrink-0 size-6 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-night" />
            </div>
            <div className="absolute inset-0 border-2 border-primary rounded-2xl pointer-events-none" aria-hidden="true" />
          </>
        )}
      </button>

      {/* Individual professionals */}
      <div className="space-y-3" role="list" aria-label="Barbeiros">
        {activeStaff.map((professional) => {
          const isSelected = selectedId === professional.id;

          return (
            <button
              key={professional.id}
              type="button"
              onClick={() => onSelect(professional.id)}
              className={`w-full relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                isSelected
                  ? 'border-primary bg-gold-pale/50 dark:bg-gold-soft/20'
                  : 'border-line bg-white dark:bg-card-dark hover:border-primary/30'
              }`}
              aria-pressed={isSelected}
              aria-label={`${professional.name}. ${isSelected ? 'Selecionado' : 'Não selecionado'}`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 size-12 rounded-xl overflow-hidden bg-line/50 flex items-center justify-center">
                {professional.avatar_url ? (
                  <img
                    src={professional.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="font-display font-bold text-lg text-ink-soft">
                    {getInitials(professional.name)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <h3 className="font-bold text-ink truncate">{professional.name}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Disponível
                </span>
              </div>

              {isSelected && (
                <>
                  <div className="flex-shrink-0 size-6 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-night" />
                  </div>
                  <div className="absolute inset-0 border-2 border-primary rounded-2xl pointer-events-none" aria-hidden="true" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StepStaff;