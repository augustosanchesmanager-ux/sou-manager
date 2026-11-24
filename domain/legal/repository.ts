/**
 * [SMG][DOMAIN][LEGAL] repository
 *
 * RESPONSABILIDADE: Consulta e registro imutável de aceites eletrônicos
 * na tabela `public.legal_acceptances` (Issue #384 / GTM-008).
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSharedSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import { RepositoryError } from '../shared/errors';
import type { LegalDocumentType } from '../../src/lib/legal/documents';

export interface LegalAcceptanceRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  document_type: LegalDocumentType;
  document_version: string;
  accepted_at: string;
  user_agent?: string | null;
}

export class LegalRepositoryImpl extends SupabaseRepository {
  constructor(db: DatabaseClient = createSharedSupabaseClient()) {
    super('legal_acceptances', db);
  }

  async listByTenant(tenantId: string): Promise<LegalAcceptanceRecord[]> {
    const { data, error } = await this.db
      .from('legal_acceptances')
      .select('id, tenant_id, user_id, document_type, document_version, accepted_at, user_agent')
      .eq('tenant_id', tenantId)
      .order('accepted_at', { ascending: false });

    if (error) {
      throw new RepositoryError(
        `Erro ao listar aceites jurídicos: ${error.message}`,
        'legal_acceptances',
        error
      );
    }

    return (data as LegalAcceptanceRecord[] | null) ?? [];
  }

  async recordAcceptance(
    documentType: LegalDocumentType,
    documentVersion: string
  ): Promise<void> {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const { error } = await this.db.rpc('record_legal_acceptance', {
      p_document_type: documentType,
      p_document_version: documentVersion,
      p_user_agent: userAgent,
    });

    if (error) {
      throw new RepositoryError(
        `Erro ao registrar aceite jurídico: ${error.message}`,
        'legal_acceptances',
        error
      );
    }
  }
}

export const legalRepository = new LegalRepositoryImpl();
