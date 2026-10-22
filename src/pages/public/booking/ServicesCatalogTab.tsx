/**
 * ServicesCatalogTab - Catalog view of all available barber services.
 * Features high-contrast typography, category filter pills, and quick modal trigger.
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { Clock, Tag, Search, Scissors, ChevronRight } from 'lucide-react';
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
        <Scissors className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
        <h3 className="font-bold text-white text-base">Nenhum serviço cadastrado</h3>
        <p className="text-xs text-neutral-400 mt-1">Esta barbearia ainda não disponibilizou serviços online.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Categories Bar */}
      <div className="space-y-2.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por corte, barba, combo..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
              }`}
            >
              Todos ({services.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-neutral-950 shadow-md'
                    : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Services Vitrine */}
      <ul className="space-y-2.5 list-none p-0 m-0" aria-label="Catálogo de Serviços">
        {filteredServices.map((service) => {
          const isSelected = selectedIds.includes(service.id);

          return (
            <li key={service.id}>
              <button
                type="button"
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 shadow-md'
                    : 'bg-neutral-900 border-neutral-800 hover:border-amber-500/50'
                }`}
                onClick={() => onSelectService(service)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white truncate">{service.name}</h3>
                    {service.category && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400">
                        {service.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="flex items-center gap-1 text-neutral-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {service.duration} min
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-extrabold tabular-nums">
                      <Tag className="w-3.5 h-3.5" />
                      {formatPriceBRL(service.price)}
                    </span>
                  </div>
                </div>

                <span
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 border border-neutral-700 text-white hover:border-amber-500 hover:text-amber-400'
                  }`}
                >
                  <span>{isSelected ? 'Selecionado' : 'Ver detalhes'}</span>
                  <ChevronRight size={13} />
                </span>
              </button>
            </li>
          );
        })}

        {filteredServices.length === 0 && (
          <p className="text-center text-xs text-neutral-400 py-8">
            Nenhum serviço encontrado para &quot;{search}&quot;.
          </p>
        )}
      </ul>
    </div>
  );
};
