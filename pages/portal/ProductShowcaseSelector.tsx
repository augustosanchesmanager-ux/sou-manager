import React, { useEffect, useState, useCallback } from 'react';
import type { ShowcaseProductItem } from '../../domain/tenantSettings/types';

export interface ProductShowcaseSelectorProps {
  selectedProducts: ShowcaseProductItem[];
  onChangeProducts: (nextProducts: ShowcaseProductItem[]) => void;
  onSearchCatalog: (query: string) => Promise<ShowcaseProductItem[]>;
  disabled?: boolean;
}

const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));

export const reorderArrayItems = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
};

export const ProductShowcaseSelector: React.FC<ProductShowcaseSelectorProps> = ({
  selectedProducts,
  onChangeProducts,
  onSearchCatalog,
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [catalogResults, setCatalogResults] = useState<ShowcaseProductItem[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedIdsSet = new Set(selectedProducts.map((p) => p.id));

  const runSearch = useCallback(
    async (query: string) => {
      setSearching(true);
      setSearchError(null);
      try {
        const items = await onSearchCatalog(query);
        setCatalogResults(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar produtos.';
        setSearchError(message);
      } finally {
        setSearching(false);
      }
    },
    [onSearchCatalog],
  );

  useEffect(() => {
    if (!isModalOpen) return;
    const timer = window.setTimeout(() => {
      void runSearch(searchQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isModalOpen, searchQuery, runSearch]);

  const handleMoveUp = (index: number) => {
    if (index <= 0 || disabled) return;
    onChangeProducts(reorderArrayItems(selectedProducts, index, index - 1));
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedProducts.length - 1 || disabled) return;
    onChangeProducts(reorderArrayItems(selectedProducts, index, index + 1));
  };

  const handleRemove = (productId: string) => {
    if (disabled) return;
    onChangeProducts(selectedProducts.filter((item) => item.id !== productId));
  };

  const handleToggleProductInModal = (product: ShowcaseProductItem) => {
    if (disabled) return;
    if (selectedIdsSet.has(product.id)) {
      onChangeProducts(selectedProducts.filter((item) => item.id !== product.id));
    } else {
      onChangeProducts([...selectedProducts, product]);
    }
  };

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null) return;
    const reordered = reorderArrayItems(selectedProducts, draggedIndex, targetIndex);
    onChangeProducts(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-neutral-950/70 border border-slate-200 dark:border-neutral-800">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-neutral-200">
            Produtos em Destaque ({selectedProducts.length})
          </p>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
            Arraste os cards ou use as setas para definir a ordem exata de exibição na vitrine pública.
          </p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setSearchQuery('');
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">add_shopping_cart</span>
          <span>Selecionar Produtos</span>
        </button>
      </div>

      {/* Selected Products Ordered List */}
      {selectedProducts.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-neutral-800 text-center space-y-2 bg-slate-50/40 dark:bg-neutral-950/30">
          <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-neutral-600">
            inventory_2
          </span>
          <p className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
            Nenhum produto selecionado para a vitrine Home Care.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">
            Clique em &ldquo;Selecionar Produtos&rdquo; para buscar itens do estoque da unidade.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5" role="list" aria-label="Produtos selecionados para a vitrine">
          {selectedProducts.map((product, index) => {
            const isDragging = draggedIndex === index;
            const isDragTarget = dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={product.id}
                role="listitem"
                draggable={!disabled}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isDragging
                    ? 'opacity-50 border-[#B88A44] bg-amber-500/5'
                    : isDragTarget
                      ? 'border-[#B88A44] ring-1 ring-[#B88A44] bg-amber-500/10'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/80 hover:border-slate-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Drag Handle + Position Badge */}
                  <div
                    className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-500 cursor-grab active:cursor-grabbing select-none"
                    title="Arraste para reordenar"
                  >
                    <span className="material-symbols-outlined text-lg">drag_indicator</span>
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-400">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Product Thumbnail */}
                  <div className="size-11 rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-lg text-[#B88A44]">
                        shopping_bag
                      </span>
                    )}
                  </div>

                  {/* Title & Price */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-extrabold text-[#B88A44]">
                        {formatBRL(product.sale_price)}
                      </span>
                      {product.description && (
                        <span className="text-[11px] text-slate-400 dark:text-neutral-500 truncate hidden sm:inline">
                          • {product.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order & Remove Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    onClick={() => handleMoveUp(index)}
                    aria-label={`Mover ${product.name} para cima`}
                    title="Mover para cima"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:border-[#B88A44] hover:text-[#B88A44] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                  </button>

                  <button
                    type="button"
                    disabled={disabled || index === selectedProducts.length - 1}
                    onClick={() => handleMoveDown(index)}
                    aria-label={`Mover ${product.name} para baixo`}
                    title="Mover para baixo"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:border-[#B88A44] hover:text-[#B88A44] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                  </button>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemove(product.id)}
                    aria-label={`Remover ${product.name} da vitrine`}
                    title="Remover da vitrine"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-colors cursor-pointer ml-1"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Search Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-showcase-modal-title"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <h3
                  id="product-showcase-modal-title"
                  className="text-base font-black text-slate-900 dark:text-white"
                >
                  Catálogo de Produtos (Home Care)
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Busque produtos ativos da sua barbearia para exibir na vitrine de agendamento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar modal de produtos"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Real-time Search Input */}
            <div className="p-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-900/50">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto por nome (ex: Pomada, Óleo, Shampoo)..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#B88A44]"
                />
              </div>
            </div>

            {/* Results List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {searching ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="size-6 rounded-full border-2 border-[#B88A44]/30 border-t-[#B88A44] animate-spin" />
                  <span className="text-xs">Consultando estoque da unidade...</span>
                </div>
              ) : searchError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 text-center">
                  {searchError}
                </div>
              ) : catalogResults.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-300">
                    Nenhum produto ativo encontrado.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                    Verifique se há produtos cadastrados e ativos no módulo de Estoque/Produtos.
                  </p>
                </div>
              ) : (
                catalogResults.map((product) => {
                  const isSelected = selectedIdsSet.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-[#B88A44] bg-[#B88A44]/10'
                          : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-slate-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-10 rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 flex items-center justify-center shrink-0">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-base text-[#B88A44]">
                              shopping_bag
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {product.name}
                          </p>
                          <p className="text-xs font-extrabold text-[#B88A44]">
                            {formatBRL(product.sale_price)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleProductInModal(product)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white hover:bg-red-600'
                            : 'bg-[#B88A44] text-neutral-950 hover:bg-[#a37838]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isSelected ? 'check' : 'add'}
                        </span>
                        <span>{isSelected ? 'Na Vitrine' : 'Adicionar'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-slate-50 dark:bg-neutral-900/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                {selectedProducts.length}{' '}
                {selectedProducts.length === 1 ? 'produto selecionado' : 'produtos selecionados'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-[#B88A44] text-white dark:text-neutral-950 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductShowcaseSelector;
