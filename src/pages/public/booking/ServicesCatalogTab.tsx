/**
 * ServicesCatalogTab - Catalog view of all available barber services.
 * Allows browsing full services with duration and pricing, selecting to book directly.
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { Clock, Tag, Check, Plus, Search, Scissors } from 'lucide-react';
import type { PublicService } from './hooks/types';

interface ServicesCatalogTabProps {
  services: PublicService[];
  selectedIds: string[];
  onSelectService: (service: PublicService) => void;
  formatPriceBRL: (price: number) => string;
}

export const ServicesCatalogTab: React.FC<ServicesCatalogTabProps> = ({
  services,
  selectedIds,
  onSelectService,
  formatPriceBRL,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchSearch =
        search.trim().length === 0 ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        Boolean(s.category?.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        selectedCategory === 'all' || s.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [services, search, selectedCategory]);

  if (services.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Scissors className="w-12 h-12 mx-auto text-ink-soft mb-3 opacity-40" />
        <h3 className="font-bold text-cream text-base">Nenhum serviço cadastrado</h3>
        <p className="text-xs text-ink-soft mt-1">Esta barbearia ainda não disponibilizou serviços online.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Categories Bar */}
      <div className="space-y-2.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar serviços..."
            className="w-full pl-10 pr-4 py-2.5 bg-card-dark border border-border-dark rounded-xl text-xs text-cream placeholder:text-ink-soft/60 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary text-night'
                  : 'bg-card-dark text-ink-soft hover:text-cream border border-border-dark'
              }`}
            >
              Todos ({services.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-night'
                    : 'bg-card-dark text-ink-soft hover:text-cream border border-border-dark'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Services List */}
      <ul className="space-y-2.5 list-none p-0 m-0" aria-label="Catálogo de Serviços">
        {filteredServices.map((service) => {
          const isSelected = selectedIds.includes(service.id);

          return (
            <div
              key={service.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-card-dark border-border-dark hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-cream truncate">{service.name}</h3>
                    {service.category && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-border-dark text-primary">
                        {service.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="flex items-center gap-1 text-ink-soft font-medium">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {service.duration} min
                    </span>
                    <span className="flex items-center gap-1 text-cream font-bold tabular-nums">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      {formatPriceBRL(service.price)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectService(service)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-night'
                      : 'bg-surface-dark border border-border-dark text-cream hover:border-primary hover:text-primary'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Selecionado
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Agendar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {filteredServices.length === 0 && (
          <p className="text-center text-xs text-ink-soft py-8">
            Nenhum serviço encontrado para &quot;{search}&quot;.
          </p>
        )}
      </ul>
    </div>
  );
};
