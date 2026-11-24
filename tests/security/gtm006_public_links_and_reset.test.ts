import { describe, expect, it } from 'vitest';
import {
  buildPublicBookingUrl,
  buildResetPasswordRedirectUrl,
  resolveBookingRedirectPath,
} from '../../src/lib/apps/publicUrl';

describe('GTM-006: Public links, booking redirect & HashRouter reset URL', () => {
  it('should_interpolate_tenant_slug_in_booking_redirect', () => {
    expect(resolveBookingRedirectPath('sanchez-barber')).toBe('/agendar/sanchez-barber');
    expect(resolveBookingRedirectPath('  dom-ze  ')).toBe('/agendar/dom-ze');
    expect(resolveBookingRedirectPath('')).toBe('/');
    expect(resolveBookingRedirectPath(null)).toBe('/');
  });

  it('should_build_canonical_hashrouter_public_booking_url', () => {
    expect(buildPublicBookingUrl('https://barber.soumanager.com', 'sanchez-barber')).toBe(
      'https://barber.soumanager.com/#/agendar/sanchez-barber',
    );
    expect(buildPublicBookingUrl('https://barber.soumanager.com/', 'sanchez-barber')).toBe(
      'https://barber.soumanager.com/#/agendar/sanchez-barber',
    );
    expect(buildPublicBookingUrl('https://barber.soumanager.com', null)).toBe('');
  });

  it('should_include_hash_prefix_in_password_reset_redirect_url', () => {
    expect(buildResetPasswordRedirectUrl('https://barber.soumanager.com')).toBe(
      'https://barber.soumanager.com/#/reset-password',
    );
    expect(buildResetPasswordRedirectUrl('https://barber.soumanager.com/')).toBe(
      'https://barber.soumanager.com/#/reset-password',
    );
  });
});
