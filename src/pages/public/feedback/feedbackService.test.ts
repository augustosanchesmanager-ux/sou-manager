import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRoleLabelPtBr,
  buildGoogleWriteReviewUrl,
  getPublicFeedbackContext,
  submitPublicReview,
} from './feedbackService';
import * as clientModule from '../../../../services/supabaseClient';

describe('feedbackService — Universal Staff & Establishment Review Funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_format_all_tenant_staff_roles_in_portuguese', () => {
    expect(getRoleLabelPtBr('Manager')).toBe('Gerente Operacional');
    expect(getRoleLabelPtBr('manager')).toBe('Gerente Operacional');
    expect(getRoleLabelPtBr('Receptionist')).toBe('Recepção');
    expect(getRoleLabelPtBr('receptionist')).toBe('Recepção');
    expect(getRoleLabelPtBr('Barber')).toBe('Barbeiro');
    expect(getRoleLabelPtBr(null)).toBe('Barbeiro');
  });

  it('should_build_google_write_review_url_when_place_id_is_present', () => {
    expect(buildGoogleWriteReviewUrl('ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    );
    expect(buildGoogleWriteReviewUrl('   ')).toBeNull();
    expect(buildGoogleWriteReviewUrl(null)).toBeNull();
  });

  it('should_load_public_feedback_context_including_all_staff_roles', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        tenant_id: 'tenant-1',
        name: 'Sanchez Barber',
        slug: 'sanchez',
        logo_url: null,
        primary_color: '#B88A44',
        google_place_id: 'place-123',
        is_review_funnel_active: true,
        staff: [
          { id: 'st-1', name: 'Carla', role: 'Receptionist', avatar: null },
          { id: 'st-2', name: 'Rubinho', role: 'Manager', avatar: null },
          { id: 'st-3', name: 'Luan', role: 'Barber', avatar: null },
        ],
      },
      error: null,
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    const ctx = await getPublicFeedbackContext('sanchez', 'tok-1');
    expect(mockRpc).toHaveBeenCalledWith('get_public_feedback_context', {
      p_tenant_identifier: 'sanchez',
      p_token: 'tok-1',
    });
    expect(ctx?.staff).toHaveLength(3);
    expect(ctx?.staff.map((s) => s.role)).toEqual(['Receptionist', 'Manager', 'Barber']);
  });

  it('should_submit_public_review_for_any_staff_member_and_return_google_redirect_on_promoter_score', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        review_id: 'rev-1',
        rating: 5,
        review_scope: 'staff',
        should_redirect_google: true,
        google_review_url: 'https://search.google.com/local/writereview?placeid=place-123',
      },
      error: null,
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    const result = await submitPublicReview({
      tenant_identifier: 'sanchez',
      rating: 5,
      review_scope: 'staff',
      staff_id: 'st-1',
      comment: 'Recepção impecável!',
      public_token: 'tok-1',
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'submit_public_review',
      expect.objectContaining({
        p_tenant_identifier: 'sanchez',
        p_rating: 5,
        p_review_scope: 'staff',
        p_staff_id: 'st-1',
        p_comment: 'Recepção impecável!',
      }),
    );
    expect(result.should_redirect_google).toBe(true);
    expect(result.google_review_url).toContain('place-123');
  });
});
