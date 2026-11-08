import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fiscalService } from './fiscalService';
import { triggerAsyncFiscalEmission } from './fiscalTrigger';

describe('FiscalTrigger', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_not_trigger_when_valor_is_zero_or_negative', async () => {
    const issueSpy = vi.spyOn(fiscalService, 'issueNfse');

    await triggerAsyncFiscalEmission({
      tenantId,
      comandaId: 'cmd-zero',
      valorTotal: 0,
    });

    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('should_not_issue_when_auto_issue_on_close_is_disabled', async () => {
    vi.spyOn(fiscalService, 'getSettings').mockResolvedValue({
      tenant_id: tenantId,
      cnpj: '12345678000190',
      razao_social: 'Teste',
      nome_fantasia: 'Teste',
      inscricao_municipal: '123',
      cnae: '9602-5/01',
      item_lista_servico: '14.01',
      regime_tributario: 'simples_nacional',
      aliquota_iss: 2.0,
      iss_retido: false,
      auto_issue_on_close: false, // DESABILITADO
      environment: 'sandbox',
      provider: 'mock_sandbox',
    });

    const issueSpy = vi.spyOn(fiscalService, 'issueNfse');

    await triggerAsyncFiscalEmission({
      tenantId,
      comandaId: 'cmd-disabled',
      valorTotal: 85,
    });

    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('should_trigger_issueNfse_when_auto_issue_on_close_is_enabled', async () => {
    vi.spyOn(fiscalService, 'getSettings').mockResolvedValue({
      tenant_id: tenantId,
      cnpj: '12.345.678/0001-90',
      razao_social: 'Barbearia Modelo',
      nome_fantasia: 'Barbearia Modelo',
      inscricao_municipal: '987654',
      cnae: '9602-5/01',
      item_lista_servico: '14.01',
      regime_tributario: 'simples_nacional',
      aliquota_iss: 2.0,
      iss_retido: false,
      auto_issue_on_close: true, // HABILITADO
      environment: 'sandbox',
      provider: 'mock_sandbox',
    });

    const issueSpy = vi.spyOn(fiscalService, 'issueNfse').mockResolvedValue({
      id: 'inv-1',
      tenant_id: tenantId,
      comanda_id: 'cmd-enabled',
      client_name: 'Felipe Ramos',
      status: 'issued',
      numero_nfse: '2026123456',
      valor_servicos: 95,
      valor_deducoes: 0,
      valor_iss: 1.9,
      aliquota_iss: 2.0,
      discriminacao_servicos: 'Serviços',
      idempotency_key: `nfse_${tenantId}_cmd-enabled`,
      created_at: new Date().toISOString(),
    });

    await triggerAsyncFiscalEmission({
      tenantId,
      comandaId: 'cmd-enabled',
      valorTotal: 95,
      clientName: 'Felipe Ramos',
    });

    // Aguardar o microtask assíncrono disparado
    await new Promise((r) => setTimeout(r, 10));

    expect(issueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        comandaId: 'cmd-enabled',
        valorServicos: 95,
        clientName: 'Felipe Ramos',
      }),
    );
  });
});
