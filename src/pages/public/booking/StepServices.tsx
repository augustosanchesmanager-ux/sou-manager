/**
 * StepServices - Service selection with styled checkbox rows.
 * Multi-select: name, duration badge, price. Selected: gold border + check icon.
 */

import React from 'react';
import { Check, Clock, Tag } from 'lucide-react';
import type { PublicService } from './hooks/types';

interface StepServicesProps {
  services: PublicService[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  isLoading?: boolean;
}

const StepServices: React.FC<StepServicesProps> = ({
  services,
  selectedIds,
  onToggle,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando serviços">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-line/50 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <Tag className="w-12 h-12 mx-auto text-line mb-3" />
        <p className="text-ink-soft">Nenhum serviço disponível no momento</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2" role="list" aria-label="Serviços disponíveis">
      {services.map((service) => {
        const isSelected = selectedIds.includes(service.id);

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onToggle(service.id)}
            className={`w-full relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              isSelected
                ? 'border-primary bg-gold-pale/50 dark:bg-gold-soft/20'
                : 'border-line bg-white dark:bg-card-dark hover:border-primary/30'
            }`}
            aria-pressed={isSelected}
            aria-label={`${service.name}, ${service.duration} min, ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}. ${isSelected ? 'Selecionado' : 'Não selecionado'}`}
          >
            {/* Check indicator */}
            <div className="flex-shrink-0">
              {isSelected ? (
                <div className="size-6 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-night" />
                </div>
              ) : (
                <div className="size-6 rounded-full border-2 border-line flex items-center justify-center" />
              )}
            </div>

            {/* Service info */}
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-ink truncate">{service.name}</h3>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-ink-soft font-medium tabular-nums">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {service.duration} min
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-ink tabular-nums">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                </span>
                {service.category && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-ink-soft bg-line/50 uppercase tracking-wide">
                    {service.category}
                  </span>
                )}
              </div>
            </div>

            {/* Selected accent bar */}
            {isSelected && (
              <div className="absolute inset-0 border-2 border-primary rounded-2xl pointer-events-none" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default StepServices;