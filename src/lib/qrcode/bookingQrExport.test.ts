import { describe, it, expect } from 'vitest';
import {
  buildTenantPublicBookingUrl,
  buildCounterPlacardHtml,
} from './bookingQrExport';

describe('bookingQrExport — Automatic Tenant Booking QR Code utilities', () => {
  it('should_build_general_tenant_public_booking_url_when_no_staff_is_selected', () => {
    const url = buildTenantPublicBookingUrl({
      slug: 'sanchez-barber',
      baseUrl: 'https://barber.soumanager.com',
      staffId: null,
    });

    expect(url).toBe('https://barber.soumanager.com/#/agendar/sanchez-barber');
  });

  it('should_ignore_all_or_any_staff_id_and_return_general_booking_url', () => {
    const urlAll = buildTenantPublicBookingUrl({
      slug: 'sanchez-barber',
      baseUrl: 'https://barber.soumanager.com/',
      staffId: 'all',
    });
    const urlAny = buildTenantPublicBookingUrl({
      slug: 'sanchez-barber',
      baseUrl: 'https://barber.soumanager.com/',
      staffId: 'any',
    });

    expect(urlAll).toBe('https://barber.soumanager.com/#/agendar/sanchez-barber');
    expect(urlAny).toBe('https://barber.soumanager.com/#/agendar/sanchez-barber');
  });

  it('should_append_staff_query_param_when_specific_barber_is_chosen_by_tenant', () => {
    const url = buildTenantPublicBookingUrl({
      slug: 'sanchez-barber',
      baseUrl: 'https://barber.soumanager.com',
      staffId: 'staff-uuid-123',
    });

    expect(url).toBe(
      'https://barber.soumanager.com/#/agendar/sanchez-barber?staff=staff-uuid-123',
    );
  });

  it('should_generate_counter_placard_html_with_barbershop_name_and_optional_barber', () => {
    const html = buildCounterPlacardHtml({
      shopName: 'Barbearia Sanchez Prime',
      bookingUrl: 'https://barber.soumanager.com/#/agendar/sanchez-prime?staff=ygor',
      svgMarkup: '<svg id="qr-test"></svg>',
      barberName: 'Ygor Yuri',
      primaryColor: '#B88A44',
      slogan: 'Tradição e estilo',
      address: 'Av. Paulista, 1000',
    });

    expect(html).toContain('Barbearia Sanchez Prime');
    expect(html).toContain('Profissional: <strong>Ygor Yuri</strong>');
    expect(html).toContain('<svg id="qr-test"></svg>');
    expect(html).toContain('https://barber.soumanager.com/#/agendar/sanchez-prime?staff=ygor');
    expect(html).toContain('Tradição e estilo');
    expect(html).toContain('Av. Paulista, 1000');
  });

  it('should_escape_html_entities_in_counter_placard_to_prevent_xss', () => {
    const html = buildCounterPlacardHtml({
      shopName: 'Barber <script>alert(1)</script>',
      bookingUrl: 'https://barber.soumanager.com/#/agendar/test',
      svgMarkup: '<svg></svg>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Barber &lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
