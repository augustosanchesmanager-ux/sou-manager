/**
 * [SMG][DOMAIN][FISCAL] fiscalRepository
 *
 * Repositório desacoplado para persistência de configurações fiscais
 * e notas fiscais de serviço (NFS-e) por comanda e por tenant.
 */

import { getClientForTable } from '../../services/supabaseClient';
import type { ComandaFiscalInvoice, FiscalDashboardKPIs, FiscalSettings } from './types';

// Fallback in-memory para testes e demo mode
const inMemoryFiscalSettings = new Map<string, FiscalSettings>();
const inMemoryFiscalInvoices = new Map<string, ComandaFiscalInvoice>();

export class FiscalRepository {
  /**
   * Limpa a memória interna (útil para isolamento em testes)
   */
  clearInMemory(): void {
    inMemoryFiscalSettings.clear();
    inMemoryFiscalInvoices.clear();
  }

  /**
   * Obtém as configurações fiscais do tenant
   */
  async getSettings(tenantId: string): Promise<FiscalSettings | null> {
    if (!tenantId) return null;

    if (inMemoryFiscalSettings.has(tenantId)) {
      return inMemoryFiscalSettings.get(tenantId)!;
    }

    try {
      const client = getClientForTable('tenant_settings');
      const { data, error } = await client
        .from('fiscal_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) {
        // Fallback default se não existir cadastro ainda
        const fallback: FiscalSettings = {
          tenant_id: tenantId,
          cnpj: '',
          razao_social: '',
          nome_fantasia: '',
          inscricao_municipal: '',
          cnae: '9602-5/01',
          item_lista_servico: '14.01',
          regime_tributario: 'simples_nacional',
          aliquota_iss: 2.0,
          iss_retido: false,
          auto_issue_on_close: false,
          environment: 'sandbox',
          provider: 'mock_sandbox',
        };
        return fallback;
      }

      return data as FiscalSettings;
    } catch {
      return inMemoryFiscalSettings.get(tenantId) || null;
    }
  }

  /**
   * Salva ou atualiza as configurações fiscais do tenant
   */
  async saveSettings(settings: FiscalSettings): Promise<FiscalSettings> {
    const tenantId = settings.tenant_id;
    const enriched = {
      ...settings,
      updated_at: new Date().toISOString(),
      created_at: settings.created_at || new Date().toISOString(),
    };

    inMemoryFiscalSettings.set(tenantId, enriched);

    try {
      const client = getClientForTable('tenant_settings');
      const { data, error } = await client
        .from('fiscal_settings')
        .upsert(enriched, { onConflict: 'tenant_id' })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return data as FiscalSettings;
      }
    } catch {
      // Ignora erro no client e preserva in-memory
    }

    return enriched;
  }

  /**
   * Salva uma nota fiscal emitida ou pendente
   */
  async saveInvoice(invoice: ComandaFiscalInvoice): Promise<ComandaFiscalInvoice> {
    inMemoryFiscalInvoices.set(invoice.id, invoice);

    try {
      const client = getClientForTable('comandas');
      const { data, error } = await client
        .from('comanda_fiscal_invoices')
        .upsert(invoice, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return data as ComandaFiscalInvoice;
      }
    } catch {
      // Fallback in-memory
    }

    return invoice;
  }

  /**
   * Busca nota fiscal pela chave de idempotência
   */
  async findByIdempotencyKey(tenantId: string, key: string): Promise<ComandaFiscalInvoice | null> {
    for (const inv of inMemoryFiscalInvoices.values()) {
      if (inv.tenant_id === tenantId && inv.idempotency_key === key) {
        return inv;
      }
    }

    try {
      const client = getClientForTable('comandas');
      const { data, error } = await client
        .from('comanda_fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', key)
        .maybeSingle();

      if (!error && data) {
        return data as ComandaFiscalInvoice;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Lista todas as notas fiscais do tenant
   */
  async listInvoices(tenantId: string): Promise<ComandaFiscalInvoice[]> {
    const memoryItems = Array.from(inMemoryFiscalInvoices.values()).filter(
      (inv) => inv.tenant_id === tenantId,
    );

    try {
      const client = getClientForTable('comandas');
      const { data, error } = await client
        .from('comanda_fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as ComandaFiscalInvoice[];
      }
    } catch {
      // Fallback
    }

    return memoryItems.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  /**
   * Calcula KPIs fiscais do tenant
   */
  async getDashboardKPIs(tenantId: string): Promise<FiscalDashboardKPIs> {
    const invoices = await this.listInvoices(tenantId);

    const issuedInvoices = invoices.filter((i) => i.status === 'issued');
    const totalIssued = issuedInvoices.length;
    const totalPending = invoices.filter((i) => i.status === 'pending' || i.status === 'processing').length;
    const totalRejected = invoices.filter((i) => i.status === 'rejected').length;

    const totalAmountIssued = Math.round(
      issuedInvoices.reduce((acc, curr) => acc + (curr.valor_servicos || 0), 0) * 100,
    ) / 100;

    const avgIss =
      totalIssued > 0
        ? Math.round(
            (issuedInvoices.reduce((acc, curr) => acc + (curr.aliquota_iss || 0), 0) /
              totalIssued) *
              100,
          ) / 100
        : 0;

    return {
      totalIssued,
      totalPending,
      totalRejected,
      totalAmountIssued,
      averageIssPercentage: avgIss,
    };
  }
}

export const fiscalRepository = new FiscalRepository();
