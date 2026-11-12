import type React from 'react';
import { useEffect, useState } from 'react';
import { Star, Quote } from 'lucide-react';
import {
  fetchPublicCachedReviews,
  type PublicCachedReview,
} from '../../../../lib/reviews/qualityService';

interface PublicSocialProofSectionProps {
  tenantId: string;
  primaryColor?: string;
}

export const PublicSocialProofSection: React.FC<PublicSocialProofSectionProps> = ({
  tenantId,
  primaryColor = '#B88A44',
}) => {
  const [reviews, setReviews] = useState<PublicCachedReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const items = await fetchPublicCachedReviews(tenantId);
      if (!cancelled) {
        setReviews(items);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (reviews.length === 0) return null;

  return (
    <section
      className="mt-6 pt-5 border-t border-neutral-800/80 space-y-3"
      aria-label="Avaliações verificadas de clientes"
    >
      <div className="flex items-center justify-between">
        <div>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: primaryColor }}
          >
            Prova Social · Google Reviews
          </span>
          <h3 className="text-sm font-extrabold text-white mt-0.5">
            O que nossos clientes dizem
          </h3>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-bold text-[#F3E5AB]">
          <Star className="w-3.5 h-3.5 fill-[#B88A44] text-[#B88A44]" />
          <span>5.0</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reviews.slice(0, 4).map((review) => (
          <article
            key={review.id}
            className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 space-y-2 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5]
                    .filter((starNumber) => starNumber <= review.rating)
                    .map((starNumber) => (
                      <Star
                        key={`${review.id}-star-${starNumber}`}
                        className="w-3 h-3 fill-[#B88A44] text-[#B88A44]"
                      />
                    ))}
                </div>
                <Quote className="w-3.5 h-3.5 text-neutral-700" />
              </div>
              {review.comment && (
                <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
                  “{review.comment}”
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-[11px]">
              <span className="font-bold text-[#F3E5AB] truncate">{review.author_name}</span>
              {review.relative_time_description && (
                <span className="text-neutral-500 shrink-0">
                  {review.relative_time_description}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
