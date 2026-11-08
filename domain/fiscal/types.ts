/**
 * [SMG][DOMAIN][FISCAL] types
 *
 * Entidades e contratos para o Motor de Conformidade Fiscal sem Atrito (NFS-e).
 * Permite emissão assíncrona e desacoplada de Notas Fiscais de Serviços
 * para barbearias em conformidade com as legislações municipais e padrão nacional.
 */

export type FiscalTaxRegime = 'mei' | 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

export type FiscalEnvironment = 'production' | 'homologation' | 'sandbox';

export type FiscalProviderType = 'focus_nfe' | 'plug_notas' | 'nuvem_fiscal' | 'mock_sandbox';

export type FiscalInvoiceStatus =
  | 'pending'     // Aguardando envio/processamento na fila
  | 'processing'  // Transmitido ao provedor/prefeitura
  | 'issued'      // Emitida e autorizada com sucesso
  | 'rejected'    // Rejeitada pela prefeitura/validação
  | 'cancelled';  // Cancelada pelo prestador

export interface FiscalSettings {
  id?: string;
  tenant_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_municipal: string;
  cnae: string;
  item_lista_servico: string; // Ex: '14.01' (Serviços de cuidados pessoais, estética, corte de cabelo)
  codigo_tributacao_municipio?: string | null;
  regime_tributario: FiscalTaxRegime;
  aliquota_iss: number; // Percentual (ex: 2.00 para 2%)
  iss_retido: boolean;
  auto_issue_on_close: boolean; // Emissão automática ao finalizar a comanda
  environment: FiscalEnvironment;
  provider: FiscalProviderType;
  api_token?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ComandaFiscalInvoice {
  id: string;
  tenant_id: string;
  comanda_id: string;
  client_id?: string | null;
  client_name: string;
  client_document?: string | null; // CPF ou CNPJ do tomador
  client_email?: string | null;
  client_phone?: string | null;
  numero_nfse?: string | null;
  codigo_verificacao?: string | null;
  status: FiscalInvoiceStatus;
  valor_servicos: number;
  valor_deducoes: number;
  valor_iss: number;
  aliquota_iss: number;
  discriminacao_servicos: string;
  xml_url?: string | null;
  pdf_url?: string | null;
  erro_mensagem?: string | null;
  idempotency_key: string;
  created_at: string;
  issued_at?: string | null;
}

export interface IssueNfseInput {
  tenantId: string;
  comandaId: string;
  clientId?: string | null;
  clientName?: string;
  clientDocument?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  valorServicos: number;
  discriminacaoServicos?: string;
}

export interface FiscalDashboardKPIs {
  totalIssued: number;
  totalPending: number;
  totalRejected: number;
  totalAmountIssued: number;
  averageIssPercentage: number;
}
