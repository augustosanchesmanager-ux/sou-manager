import { supabase, getPublicAnonymousClient } from '../../../services/supabaseClient';

export interface QualityDashboardSummary {
  total_reviews: number;
  avg_rating: number;
  promoters_count: number;
  detractors_count: number;
  pending_recovery_count: number;
  resolved_count: number;
}

export interface StaffQualityPerformance {
  staff_id: string;
  staff_name: string;
  role: string;
  avatar: string | null;
  reviews_count: number;
  avg_rating: number;
  promoters_count: number;
  detractors_count: number;
  retention_rate: number;
}

export interface RecoveryInboxItem {
  id: string;
  review_scope: 'establishment' | 'staff';
  rating: number;
  comment: string | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'archived';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  staff_id: string | null;
  staff_name: string | null;
  staff_role: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_ltv: number;
}

export interface QualityDashboardMetrics {
  summary: QualityDashboardSummary;
  staff_performance: StaffQualityPerformance[];
  recovery_inbox: RecoveryInboxItem[];
}

export interface PublicCachedReview {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  comment: string | null;
  relative_time_description: string | null;
  published_at: string | null;
}

export interface ClientCrmFrictionAlert {
  lifetimeValue: number;
  isVip: boolean;
  hasFriction: boolean;
  lastLowRating: number | null;
  lastComment: string | null;
  lastResolutionNote: string | null;
  lastReviewStatus: string | null;
  lastReviewDate: string | null;
}

export const VIP_LTV_THRESHOLD = 1000;

export async function fetchQualityDashboardMetrics(
  tenantId: string,
  days = 30,
): Promise<QualityDashboardMetrics> {
  const { data, error } = await supabase.rpc('get_quality_dashboard_metrics', {
    p_tenant_id: tenantId,
    p_days: days,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao carregar métricas de qualidade.');
  }

  const parsed = (data || {}) as Partial<QualityDashboardMetrics>;
  return {
    summary: {
      total_reviews: Number(parsed.summary?.total_reviews ?? 0),
      avg_rating: Number(parsed.summary?.avg_rating ?? 0),
      promoters_count: Number(parsed.summary?.promoters_count ?? 0),
      detractors_count: Number(parsed.summary?.detractors_count ?? 0),
      pending_recovery_count: Number(parsed.summary?.pending_recovery_count ?? 0),
      resolved_count: Number(parsed.summary?.resolved_count ?? 0),
    },
    staff_performance: Array.isArray(parsed.staff_performance) ? parsed.staff_performance : [],
    recovery_inbox: Array.isArray(parsed.recovery_inbox) ? parsed.recovery_inbox : [],
  };
}

export async function resolveTenantReview(
  reviewId: string,
  resolutionNote: string,
  status: 'pending' | 'in_progress' | 'resolved' | 'archived' = 'resolved',
): Promise<void> {
  const { error } = await supabase.rpc('resolve_tenant_review', {
    p_review_id: reviewId,
    p_resolution_note: resolutionNote,
    p_status: status,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao salvar resolução do atendimento.');
  }
}

export async function fetchPublicCachedReviews(tenantId: string): Promise<PublicCachedReview[]> {
  if (!tenantId) return [];
  try {
    const anon = getPublicAnonymousClient();
    const { data, error } = await anon
      .from('tenant_reviews_cache')
      .select(
        'id, author_name, author_photo_url, rating, comment, relative_time_description, published_at',
      )
      .eq('tenant_id', tenantId)
      .eq('is_visible', true)
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(6);

    if (error || !Array.isArray(data)) return [];
    return data as PublicCachedReview[];
  } catch {
    return [];
  }
}

export async function fetchClientCrmFrictionAlert(
  tenantId: string,
  clientId: string,
  fallbackTotalSpent = 0,
): Promise<ClientCrmFrictionAlert> {
  try {
    const [clientRes, reviewRes] = await Promise.all([
      supabase
        .from('clients')
        .select('lifetime_value, total_spent')
        .eq('tenant_id', tenantId)
        .eq('id', clientId)
        .maybeSingle(),
      supabase
        .from('tenant_reviews')
        .select('rating, comment, resolution_note, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .lte('rating', 3)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cData = (clientRes.data || {}) as { lifetime_value?: number; total_spent?: number };
    const ltv = Math.max(
      Number(cData.lifetime_value ?? 0),
      Number(cData.total_spent ?? 0),
      Number(fallbackTotalSpent || 0),
    );

    const rData = reviewRes.data as {
      rating?: number;
      comment?: string | null;
      resolution_note?: string | null;
      status?: string | null;
      created_at?: string | null;
    } | null;

    return {
      lifetimeValue: ltv,
      isVip: ltv > VIP_LTV_THRESHOLD,
      hasFriction: Boolean(rData && typeof rData.rating === 'number' && rData.rating <= 3),
      lastLowRating: rData?.rating ?? null,
      lastComment: rData?.comment ?? null,
      lastResolutionNote: rData?.resolution_note ?? null,
      lastReviewStatus: rData?.status ?? null,
      lastReviewDate: rData?.created_at ?? null,
    };
  } catch {
    return {
      lifetimeValue: fallbackTotalSpent,
      isVip: fallbackTotalSpent > VIP_LTV_THRESHOLD,
      hasFriction: false,
      lastLowRating: null,
      lastComment: null,
      lastResolutionNote: null,
      lastReviewStatus: null,
      lastReviewDate: null,
    };
  }
}
