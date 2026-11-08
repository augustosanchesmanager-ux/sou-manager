/**
 * [SMG][DOMAIN][FISCAL] Mock Fiscal Provider
 *
 * Provedor de testes e sandbox para validação da esteira de emissão de NFS-e.
 * Simula a autorização de notas fiscais de serviço para barbearias,
 * atribuindo número sequencial, código de autenticidade e links de espelho de DANFSe.
 */

import type { ComandaFiscalInvoice, FiscalSettings, IssueNfseInput } from '../types';

export interface FiscalProviderResponse {
  success: boolean;
  numeroNfse?: string;
  codigoVerificacao?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  errorMessage?: string;
}

export class MockFiscalProvider {
  /**
   * Simula a emissão da NFS-e junto ao órgão fazendário / prefeitura
   */
  async issueInvoice(
    settings: FiscalSettings,
    invoice: ComandaFiscalInvoice,
  ): Promise<FiscalProviderResponse> {
    // Validação mínima de dados do prestador
    if (!settings.cnpj || settings.cnpj.replace(/\D/g, '').length !== 14) {
      return {
        success: false,
        errorMessage: 'CNPJ do prestador inválido ou não configurado nas configurações fiscais.',
      };
    }

    if (!settings.inscricao_municipal) {
      return {
        success: false,
        errorMessage: 'Inscrição Municipal do prestador é obrigatória para emissão de NFS-e.',
      };
    }

    // Simula tempo de rede/resposta assíncrona
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Se o valor for zero ou negativo, rejeita
    if (invoice.valor_servicos <= 0) {
      return {
        success: false,
        errorMessage: 'Valor do serviço deve ser maior que zero para emissão fiscal.',
      };
    }

    const randomSerial = Math.floor(100000 + Math.random() * 900000);
    const mockHash = Math.random().toString(36).substring(2, 10).toUpperCase();

    return {
      success: true,
      numeroNfse: `2026${randomSerial}`,
      codigoVerificacao: `SMG-${mockHash}`,
      pdfUrl: `https://danfse.soumanager.com/view/2026${randomSerial}`,
      xmlUrl: `https://danfse.soumanager.com/xml/2026${randomSerial}.xml`,
    };
  }
}
