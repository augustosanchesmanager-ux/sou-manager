/**
 * [SMG][DOMAIN][FISCAL] fiscalService
 *
 * Serviço de orquestração do Motor de Conformidade Fiscal sem Atrito (NFS-e).
 * Trata o ciclo de vida da nota: cálculo de ISS, validação de regras de barbearia,
 * emissão com garantia de idempotência e desacoplamento do checkout.
 */

import { FiscalRepository, fiscalRepository } from './fiscalRepository';
import { MockFiscalProvider } from './providers/mockFiscalProvider';
import type {
  ComandaFiscalInvoice,
  FiscalDashboardKPIs,
  FiscalSettings,
  IssueNfseInput,
} from './types';

export class FiscalService {
  constructor(
    private readonly repo: FiscalRepository = fiscalRepository,
    private readonly provider: MockFiscalProvider = new MockFiscalProvider(),
  ) {}

  /**
   * Obtém as configurações fiscais do tenant
   */
  async getSettings(tenantId: string): Promise<FiscalSettings | null> {
    return this.repo.getSettings(tenantId);
  }

  /**
   * Salva configurações fiscais
   */
  async saveSettings(settings: FiscalSettings): Promise<FiscalSettings> {
    return this.repo.saveSettings(settings);
  }

  /**
   * Emite NFS-e para uma comanda com garantia estrita de idempotência
   */
  async issueNfse(input: IssueNfseInput): Promise<ComandaFiscalInvoice> {
    const { tenantId, comandaId, valorServicos } = input;
    const idempotencyKey = `nfse_${tenantId}_${comandaId}`;

    // 1. Verificar idempotência
    const existing = await this.repo.findByIdempotencyKey(tenantId, idempotencyKey);
    if (existing && existing.status === 'issued') {
      return existing;
    }

    // 2. Carregar configurações fiscais do prestador
    const settings = await this.repo.getSettings(tenantId);
    if (!settings) {
      throw new Error('Configurações fiscais do estabelecimento não encontradas.');
    }

    // 3. Cálculo de impostos municipais
    const aliquotaIss = settings.aliquota_iss || 2.0;
    const valorIss = Math.round(((valorServicos * aliquotaIss) / 100) * 100) / 100;

    const invoiceId = existing?.id || crypto.randomUUID();
    const invoiceDraft: ComandaFiscalInvoice = {
      id: invoiceId,
      tenant_id: tenantId,
      comanda_id: comandaId,
      client_id: input.clientId || null,
      client_name: input.clientName || 'Consumidor Final',
      client_document: input.clientDocument || null,
      client_email: input.clientEmail || null,
      client_phone: input.clientPhone || null,
      numero_nfse: null,
      codigo_verificacao: null,
      status: 'processing',
      valor_servicos: valorServicos,
      valor_deducoes: 0,
      valor_iss: valorIss,
      aliquota_iss: aliquotaIss,
      discriminacao_servicos:
        input.discriminacaoServicos ||
        'Serviços de cuidados pessoais, corte de cabelo e estética masculina (Item 14.01)',
      idempotency_key: idempotencyKey,
      created_at: existing?.created_at || new Date().toISOString(),
      issued_at: null,
    };

    // Salva status processing
    await this.repo.saveInvoice(invoiceDraft);

    // 4. Chamada ao provedor fazendário
    try {
      const response = await this.provider.issueInvoice(settings, invoiceDraft);

      if (response.success && response.numeroNfse) {
        const authorized: ComandaFiscalInvoice = {
          ...invoiceDraft,
          status: 'issued',
          numero_nfse: response.numeroNfse,
          codigo_verificacao: response.codigoVerificacao || null,
          pdf_url: response.pdfUrl || null,
          xml_url: response.xmlUrl || null,
          issued_at: new Date().toISOString(),
          erro_mensagem: null,
        };
        return await this.repo.saveInvoice(authorized);
      } else {
        const rejected: ComandaFiscalInvoice = {
          ...invoiceDraft,
          status: 'rejected',
          erro_mensagem: response.errorMessage || 'Falha ao autorizar NFS-e na prefeitura.',
        };
        return await this.repo.saveInvoice(rejected);
      }
    } catch (err: any) {
      const failed: ComandaFiscalInvoice = {
        ...invoiceDraft,
        status: 'rejected',
        erro_mensagem: err.message || 'Erro de comunicação com o serviço tributário.',
      };
      return await this.repo.saveInvoice(failed);
    }
  }

  /**
   * Tenta reemitir uma nota fiscal que foi rejeitada ou falhou
   */
  async retryInvoice(tenantId: string, invoiceId: string): Promise<ComandaFiscalInvoice> {
    const invoices = await this.repo.listInvoices(tenantId);
    const invoice = invoices.find((i) => i.id === invoiceId);

    if (!invoice) {
      throw new Error('Nota fiscal não encontrada para reprocessamento.');
    }

    if (invoice.status === 'issued') {
      return invoice;
    }

    return this.issueNfse({
      tenantId: invoice.tenant_id,
      comandaId: invoice.comanda_id,
      clientId: invoice.client_id,
      clientName: invoice.client_name,
      clientDocument: invoice.client_document,
      clientEmail: invoice.client_email,
      clientPhone: invoice.client_phone,
      valorServicos: invoice.valor_servicos,
      discriminacaoServicos: invoice.discriminacao_servicos,
    });
  }

  /**
   * Lista histórico de notas fiscais do tenant
   */
  async listInvoices(tenantId: string): Promise<ComandaFiscalInvoice[]> {
    return this.repo.listInvoices(tenantId);
  }

  /**
   * Obtém métricas do painel fiscal
   */
  async getDashboardKPIs(tenantId: string): Promise<FiscalDashboardKPIs> {
    return this.repo.getDashboardKPIs(tenantId);
  }
}

export const fiscalService = new FiscalService();
