import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('OpenAPI Specification & Developer Documentation (Phase 8)', () => {
  const openApiPath = path.resolve(process.cwd(), 'docs/api/openapi.yaml');
  const guidePath = path.resolve(process.cwd(), 'docs/api/PUBLIC_API_DEVELOPER_GUIDE.md');

  it('should_exist_and_contain_content_in_designated_locations', () => {
    expect(fs.existsSync(openApiPath)).toBe(true);
    expect(fs.existsSync(guidePath)).toBe(true);

    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    expect(openApiContent.length).toBeGreaterThan(500);
    expect(guideContent.length).toBeGreaterThan(500);
  });

  it('should_declare_openapi_version_3_1_0_and_official_metadata', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    expect(openApiContent).toContain('openapi: 3.1.0');
    expect(openApiContent).toContain('title: SMG Barber — Public API');
    expect(openApiContent).toContain('version: 1.0.0');
  });

  it('should_specify_production_and_sandbox_servers', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    expect(openApiContent).toContain('https://api.soumanager.com');
    expect(openApiContent).toContain('https://sandbox.api.soumanager.com');
  });

  it('should_define_all_six_public_api_routes', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    const expectedPaths = [
      '/v1/health:',
      '/v1/auth/verify:',
      '/v1/appointments:',
      '/v1/comandas:',
      '/v1/services:',
      '/v1/products:',
    ];

    for (const p of expectedPaths) {
      expect(openApiContent).toContain(p);
    }
  });

  it('should_support_get_and_post_for_appointments_and_comandas', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    // Appointments section
    const appointmentsSection = openApiContent.split('/v1/appointments:')[1].split('/v1/comandas:')[0];
    expect(appointmentsSection).toContain('get:');
    expect(appointmentsSection).toContain('post:');

    // Comandas section
    const comandasSection = openApiContent.split('/v1/comandas:')[1].split('/v1/services:')[0];
    expect(comandasSection).toContain('get:');
    expect(comandasSection).toContain('post:');
  });

  it('should_define_security_schemes_for_bearer_and_x_api_key', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    expect(openApiContent).toContain('BearerAuth:');
    expect(openApiContent).toContain('ApiKeyAuth:');
    expect(openApiContent).toContain('name: X-API-Key');
  });

  it('should_define_all_core_domain_schemas', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    const expectedSchemas = [
      'VerifyAuthResponse:',
      'Appointment:',
      'AppointmentsListResponse:',
      'CreateAppointmentRequest:',
      'Comanda:',
      'ComandaItem:',
      'ComandasListResponse:',
      'CreateComandaRequest:',
      'ServiceItem:',
      'ServicesListResponse:',
      'ProductItem:',
      'ProductsListResponse:',
      'ErrorResponse:',
      'WebhookEventPayload:',
    ];

    for (const s of expectedSchemas) {
      expect(openApiContent).toContain(s);
    }
  });

  it('should_define_webhooks_and_event_types', () => {
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

    expect(openApiContent).toContain('webhooks:');
    expect(openApiContent).toContain('appointmentCreated:');
    expect(openApiContent).toContain('comandaClosed:');
  });

  it('developer_guide_should_cover_essential_integration_aspects', () => {
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    // Multi-tenant & security
    expect(guideContent).toContain('Isolamento Multi-Tenant Estrito');
    expect(guideContent).toContain('Derivação Autoritativa de Preços');
    expect(guideContent).toContain('smg_test_');
    expect(guideContent).toContain('smg_live_');

    // Scopes
    expect(guideContent).toContain('appointments:read');
    expect(guideContent).toContain('appointments:write');
    expect(guideContent).toContain('comandas:read');
    expect(guideContent).toContain('comandas:write');
    expect(guideContent).toContain('catalog:read');

    // Webhooks & HMAC verification
    expect(guideContent).toContain('X-SMG-Signature');
    expect(guideContent).toContain('HMAC-SHA256');
    expect(guideContent).toContain('replay attack');
    expect(guideContent).toContain('timingSafeEqual');

    // Code examples
    expect(guideContent).toContain('curl');
    expect(guideContent).toContain('TypeScript');
    expect(guideContent).toContain('Python');
  });
});
