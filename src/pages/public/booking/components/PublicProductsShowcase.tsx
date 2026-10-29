/**
 * PublicProductsShowcase - Vitrine de Produtos Recomendados (Home Care) na página pública de agendamento.
 * Renderiza carrossel/grade responsivo de produtos selecionados pelo gestor, respeitando a cor primária dinâmica (--brand-primary).
 */

import type React from 'react';
import { ShoppingBag, Sparkles } from 'lucide-react';
import type { PublicShowcaseProduct } from '../hooks/types';

interface PublicProductsShowcaseProps {
  products: PublicShowcaseProduct[];
  formatPriceBRL: (price: number) => string;
  primaryColor?: string;
}

export const PublicProductsShowcase: React.FC<PublicProductsShowcaseProps> = ({
  products,
  formatPriceBRL,
  primaryColor = '#B88A44',
}) => {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Vitrine de Produtos Home Care"
      className="space-y-2.5 pt-2 pb-1 border-t border-neutral-800/80"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag
              className="w-4 h-4 flex-shrink-0"
              style={{ color: primaryColor }}
            />
            Vitrine Home Care
          </h2>
          <p className="text-[11px] text-neutral-400">
            Produtos selecionados disponíveis para retirada na barbearia
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
          style={{
            color: primaryColor,
            borderColor: `${primaryColor}40`,
            backgroundColor: `${primaryColor}15`,
          }}
        >
          <Sparkles className="w-3 h-3" />
          Recomendados
        </span>
      </div>

      {/* Horizontal Carousel / Responsive Grid */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
        {products.map((product) => (
          <article
            key={product.id}
            className="snap-start flex-shrink-0 w-44 sm:w-48 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 overflow-hidden flex flex-col justify-between transition-all shadow-sm"
          >
            <div>
              {/* Product Image or Luxury Placeholder */}
              <div className="relative h-28 w-full bg-neutral-900 border-b border-neutral-800/80 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-600 gap-1">
                    <ShoppingBag
                      className="w-7 h-7 opacity-80"
                      style={{ color: primaryColor }}
                    />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                      Home Care
                    </span>
                  </div>
                )}
              </div>

              {/* Product Title & Description */}
              <div className="p-3 space-y-1">
                <h3
                  className="text-xs font-bold text-white line-clamp-1"
                  title={product.name}
                >
                  {product.name}
                </h3>
                {product.description ? (
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-snug">
                    {product.description}
                  </p>
                ) : (
                  <p className="text-[10px] text-neutral-500 italic">
                    Consulte disponibilidade na recepção
                  </p>
                )}
              </div>
            </div>

            {/* Price Footer */}
            <div className="px-3 pb-3 pt-1 flex items-center justify-between">
              <span
                className="text-xs font-black tracking-tight"
                style={{ color: primaryColor }}
              >
                {formatPriceBRL(product.price)}
              </span>
              <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                Na loja
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
