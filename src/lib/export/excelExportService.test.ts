import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('../supabase/client', () => ({
  getSharedClient: () => ({
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  }),
}));

import {
  buildFallbackCsvBlob,
  requestAsyncExcelExport,
  type ExcelColumnSpec,
} from './excelExportService';

describe('excelExportService (Sugestão 7.2 — Async Edge Function + Storage Presigned URL)', () => {
  const columns: ExcelColumnSpec[] = [
    { key: 'short_id', header: 'Comanda', type: 'string' },
    { key: 'client_name', header: 'Cliente', type: 'string' },
    { key: 'total', header: 'Valor Total (R$)', type: 'currency' },
  ];

  const rows = [
    { short_id: '#CMD001', client_name: 'Guilherme Rodrigues', total: 95.5 },
    { short_id: '#CMD002', client_name: 'Rubens Sanchez', total: 70 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_return_signed_url_and_row_count_when_edge_function_succeeds', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        signedUrl: 'https://ushsnmlbeurfvlkieiln.supabase.co/storage/v1/object/sign/exports/tenant/relatorio.xlsx?token=abc',
        fileName: 'relatorio_vendas.xlsx',
        rowCount: 2,
      },
      error: null,
    });

    const result = await requestAsyncExcelExport({
      reportType: 'sales',
      title: 'Relatório de Vendas',
      fileName: 'relatorio_vendas.xlsx',
      columns,
      rows,
    });

    expect(mockInvoke).toHaveBeenCalledWith('import-export', {
      body: expect.objectContaining({
        reportType: 'sales',
        title: 'Relatório de Vendas',
        fileName: 'relatorio_vendas.xlsx',
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.signedUrl).toContain('/storage/v1/object/sign/exports/');
    expect(result.fileName).toBe('relatorio_vendas.xlsx');
    expect(result.rowCount).toBe(2);
    expect(result.fallbackUsed).toBeUndefined();
  });

  it('should_format_brazilian_csv_with_bom_when_building_fallback_blob', () => {
    const csv = buildFallbackCsvBlob(columns, rows);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Comanda";"Cliente";"Valor Total (R$)"');
    expect(csv).toContain('"#CMD001";"Guilherme Rodrigues";"95,50"');
    expect(csv).toContain('"#CMD002";"Rubens Sanchez";"70,00"');
  });

  it('should_use_resilient_fallback_when_edge_function_returns_error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge functions indisponiveis no modo local.' },
    });

    const result = await requestAsyncExcelExport({
      reportType: 'sales',
      title: 'Relatório de Vendas',
      fileName: 'relatorio_vendas.xlsx',
      columns,
      rows,
    });

    expect(result.ok).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fileName).toBe('relatorio_vendas.csv');
    expect(result.rowCount).toBe(2);
  });

  it('should_not_fall_back_when_edge_function_denies_authorization', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('User profile is not active. Export denied.'), {
        name: 'FunctionsHttpError',
        context: { status: 403 },
      }),
    });

    const result = await requestAsyncExcelExport({
      reportType: 'sales',
      title: 'Relatório de Vendas',
      fileName: 'relatorio_vendas.xlsx',
      columns,
      rows,
    });

    // Regra: erro de autorização não pode ser convertido em exportação "ok"
    expect(result.ok).toBe(false);
    expect(result.fallbackUsed).toBeUndefined();
    expect(result.error).toContain('not active');
  });

  it('should_not_fall_back_when_edge_function_fails_on_server_side', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('Failed to upload Excel to Storage'), {
        name: 'FunctionsHttpError',
        context: { status: 500 },
      }),
    });

    const result = await requestAsyncExcelExport({
      reportType: 'sales',
      title: 'Relatório de Vendas',
      fileName: 'relatorio_vendas.xlsx',
      columns,
      rows,
    });

    expect(result.ok).toBe(false);
    expect(result.fallbackUsed).toBeUndefined();
    expect(result.error).toContain('Failed to upload Excel to Storage');
  });

  it('should_fall_back_when_edge_function_is_not_deployed', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('Requested function was not found'), {
        name: 'FunctionsHttpError',
        context: { status: 404 },
      }),
    });

    const result = await requestAsyncExcelExport({
      reportType: 'clients',
      title: 'Base de Clientes',
      fileName: 'base_clientes.xlsx',
      columns,
      rows,
    });

    expect(result.ok).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fileName).toBe('base_clientes.csv');
  });
});
