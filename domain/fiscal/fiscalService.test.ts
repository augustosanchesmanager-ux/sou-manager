import { beforeEach, describe, expect, it } from 'vitest';
import { FiscalRepository } from './fiscalRepository';
import { FiscalService } from './fiscalService';
import { MockFiscalProvider } from './providers/mockFiscalProvider';
import type { FiscalSettings } from './types';

describe('FiscalService & MockFiscalProvider', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let repo: FiscalRepository;
  let provider: MockFiscalProvider;
  let service: FiscalService;

  const validSettings: FiscalSettings = {
    tenant_id: tenantId,
    cnpj: '12.345.678/0001-90',
    razao_social: 'SMG Barber Shop LTDA',
    nome_fantasia: 'SMG Barbearia Premium',
    inscricao_municipal: '12345678',
    cnae: '9602-5/01',
    item_lista_servico: '14.01',
    regime_tributario: 'simples_nacional',
    aliquota_iss: 2.0,
    iss_retido: false,
    auto_issue_on_close: true,
    environment: 'sandbox',
    provider: 'mock_sandbox',
  };

  beforeEach(() => {
    repo = new FiscalRepository();
    repo.clearInMemory();
    provider = new MockFiscalProvider();
    service = new FiscalService(repo, provider);
  });

  it('should_save_and_retrieve_fiscal_settings', async () => {
    // Act
    await service.saveSettings(validSettings);
    const retrieved = await service.getSettings(tenantId);

    // Assert
    expect(retrieved).not.toBeNull();
    expect(retrieved?.cnpj).toBe('12.345.678/0001-90');
    expect(retrieved?.regime_tributario).toBe('simples_nacional');
    expect(retrieved?.auto_issue_on_close).toBe(true);
  });

  it('should_issue_nfse_successfully_with_correct_iss_calculation', async () => {
    // Arrange
    await service.saveSettings(validSettings);

    // Act
    const invoice = await service.issueNfse({
      tenantId,
      comandaId: 'cmd-100',
      clientName: 'Gabriel Sampaio',
      clientDocument: '123.456.789-00',
      valorServicos: 150.0,
    });

    // Assert
    expect(invoice.status).toBe('issued');
    expect(invoice.numero_nfse).toBeDefined();
    expect(invoice.codigo_verificacao).toContain('SMG-');
    expect(invoice.valor_servicos).toBe(150.0);
    expect(invoice.aliquota_iss).toBe(2.0);
    expect(invoice.valor_iss).toBe(3.0); // 2% de 150 = 3.00
    expect(invoice.pdf_url).toBeDefined();
  });

  it('should_respect_idempotency_and_not_duplicate_issued_invoice', async () => {
    // Arrange
    await service.saveSettings(validSettings);

    const firstCall = await service.issueNfse({
      tenantId,
      comandaId: 'cmd-duplicate-check',
      clientName: 'Cliente Teste',
      valorServicos: 100.0,
    });

    // Act: Segunda chamada com mesma comanda
    const secondCall = await service.issueNfse({
      tenantId,
      comandaId: 'cmd-duplicate-check',
      clientName: 'Cliente Teste',
      valorServicos: 100.0,
    });

    // Assert
    expect(secondCall.id).toBe(firstCall.id);
    expect(secondCall.numero_nfse).toBe(firstCall.numero_nfse);
  });

  it('should_reject_invoice_when_provider_cnpj_is_invalid', async () => {
    // Arrange: CNPJ inválido
    await service.saveSettings({
      ...validSettings,
      cnpj: '123', // inválido
    });

    // Act
    const invoice = await service.issueNfse({
      tenantId,
      comandaId: 'cmd-invalid-cnpj',
      valorServicos: 80.0,
    });

    // Assert
    expect(invoice.status).toBe('rejected');
    expect(invoice.erro_mensagem).toContain('CNPJ do prestador inválido');
  });

  it('should_retry_rejected_invoice_and_succeed_after_settings_are_fixed', async () => {
    // Arrange: Inicia com CNPJ inválido
    await service.saveSettings({
      ...validSettings,
      cnpj: '123',
    });

    const failed = await service.issueNfse({
      tenantId,
      comandaId: 'cmd-retry-test',
      valorServicos: 90.0,
    });
    expect(failed.status).toBe('rejected');

    // Corrigir configurações
    await service.saveSettings(validSettings);

    // Act: Reemitir nota
    const retried = await service.retryInvoice(tenantId, failed.id);

    // Assert
    expect(retried.status).toBe('issued');
    expect(retried.numero_nfse).toBeDefined();
    expect(retried.erro_mensagem).toBeNull();
  });

  it('should_calculate_dashboard_kpis_accurately', async () => {
    // Arrange
    await service.saveSettings(validSettings);

    await service.issueNfse({
      tenantId,
      comandaId: 'cmd-kpi-1',
      valorServicos: 100.0,
    });

    await service.issueNfse({
      tenantId,
      comandaId: 'cmd-kpi-2',
      valorServicos: 200.0,
    });

    // Act
    const kpis = await service.getDashboardKPIs(tenantId);

    // Assert
    expect(kpis.totalIssued).toBe(2);
    expect(kpis.totalAmountIssued).toBe(300.0);
    expect(kpis.averageIssPercentage).toBe(2.0);
    expect(kpis.totalRejected).toBe(0);
  });
});
