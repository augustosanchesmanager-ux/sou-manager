import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_LEGAL_DOCUMENTS,
  REQUIRED_ONBOARDING_DOCUMENTS,
} from '../../src/lib/legal/documents';

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261124190500_security_fix_gtm008_legal_acceptances.sql'
);

describe('GTM-008 (#384) Legal & LGPD compliance MVP', () => {
  it('should_define_append_only_legal_acceptances_table_with_rls_and_rpc', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.legal_acceptances');
    expect(sql).toContain('REVOKE ALL ON TABLE public.legal_acceptances FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('GRANT SELECT, INSERT ON TABLE public.legal_acceptances TO authenticated;');
    expect(sql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*legal_acceptances/i);
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_legal_acceptance');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.record_legal_acceptance');
  });

  it('should_require_explicit_unchecked_legal_consent_in_register_and_expose_legal_center_route', () => {
    const registerSource = fs.readFileSync(path.join(ROOT, 'pages/Register.tsx'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');

    expect(registerSource).toContain('const [acceptedLegal, setAcceptedLegal] = useState(false);');
    expect(registerSource).toContain('disabled={loading || !acceptedLegal}');
    expect(registerSource).toContain('to="/legal"');
    expect(appSource).toContain('<Route path="/legal" element={<LegalCenter />} />');
  });

  it('should_provide_versioned_terms_and_privacy_documents', () => {
    expect(CURRENT_LEGAL_DOCUMENTS.length).toBeGreaterThanOrEqual(2);
    expect(REQUIRED_ONBOARDING_DOCUMENTS.map((d) => d.type)).toEqual(
      expect.arrayContaining(['terms_of_service', 'privacy_policy'])
    );
    for (const doc of CURRENT_LEGAL_DOCUMENTS) {
      expect(doc.version.length).toBeGreaterThan(0);
      expect(doc.sections.length).toBeGreaterThan(0);
    }
  });
});
