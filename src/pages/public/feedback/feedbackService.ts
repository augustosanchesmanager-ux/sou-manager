import { getPublicAnonymousClient } from '../../../../services/supabaseClient';

export interface PublicFeedbackStaffMember {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
}

export interface PublicFeedbackContext {
  tenant_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  google_place_id: string | null;
  is_review_funnel_active: boolean;
  staff: PublicFeedbackStaffMember[];
}

export interface SubmitPublicReviewInput {
  tenant_identifier: string;
  rating: number;
  review_scope: 'establishment' | 'staff';
  staff_id?: string | null;
  comment?: string | null;
  public_token?: string | null;
  appointment_id?: string | null;
  client_id?: string | null;
  source_channel?: string;
  redirected_to_google?: boolean;
}

export interface SubmitPublicReviewResult {
  review_id: string;
  rating: number;
  review_scope: 'establishment' | 'staff';
  should_redirect_google: boolean;
  google_review_url: string | null;
}

export function getRoleLabelPtBr(role: string | null | undefined): string {
  const normalized = (role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Gerente Operacional';
  if (normalized === 'receptionist') return 'Recepção';
  return 'Barbeiro';
}

export function buildGoogleWriteReviewUrl(googlePlaceId: string | null | undefined): string | null {
  const clean = (googlePlaceId || '').trim();
  if (!clean) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(clean)}`;
}

export async function getPublicFeedbackContext(
  tenantIdentifier: string,
  token?: string | null,
): Promise<PublicFeedbackContext | null> {
  const client = getPublicAnonymousClient();
  const { data, error } = await client.rpc('get_public_feedback_context', {
    p_tenant_identifier: tenantIdentifier,
    p_token: token ?? null,
  });

  if (error || !data) {
    return null;
  }

  const parsed = data as Partial<PublicFeedbackContext>;
  return {
    tenant_id: String(parsed.tenant_id ?? ''),
    name: String(parsed.name ?? 'Barbearia'),
    slug: String(parsed.slug ?? tenantIdentifier),
    logo_url: parsed.logo_url ?? null,
    primary_color: parsed.primary_color || '#B88A44',
    google_place_id: parsed.google_place_id ?? null,
    is_review_funnel_active: Boolean(parsed.is_review_funnel_active ?? true),
    staff: Array.isArray(parsed.staff) ? parsed.staff : [],
  };
}

export async function submitPublicReview(
  input: SubmitPublicReviewInput,
): Promise<SubmitPublicReviewResult> {
  const client = getPublicAnonymousClient();
  const { data, error } = await client.rpc('submit_public_review', {
    p_tenant_identifier: input.tenant_identifier,
    p_rating: input.rating,
    p_review_scope: input.review_scope,
    p_staff_id: input.staff_id ?? null,
    p_comment: input.comment ?? null,
    p_public_token: input.public_token ?? null,
    p_appointment_id: input.appointment_id ?? null,
    p_client_id: input.client_id ?? null,
    p_source_channel: input.source_channel ?? 'whatsapp',
    p_redirected_to_google: Boolean(input.redirected_to_google),
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível registrar sua avaliação.');
  }

  const parsed = data as Partial<SubmitPublicReviewResult>;
  return {
    review_id: String(parsed.review_id ?? ''),
    rating: Number(parsed.rating ?? input.rating),
    review_scope: parsed.review_scope === 'staff' ? 'staff' : 'establishment',
    should_redirect_google: Boolean(parsed.should_redirect_google),
    google_review_url: parsed.google_review_url ?? null,
  };
}
