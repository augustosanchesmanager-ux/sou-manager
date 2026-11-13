import { getSharedClient } from '../supabase/client';

export interface ExcelColumnSpec {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'currency' | 'date';
}

export interface ExcelSummaryRow {
  label: string;
  value: string | number;
  type?: 'currency' | 'number' | 'string';
}

export interface AsyncExcelExportOptions {
  tenantId?: string;
  reportType?: 'sales' | 'clients' | 'cashflow' | 'commissions' | 'schedule' | 'custom';
  title: string;
  subtitle?: string;
  sheetName?: string;
  fileName: string;
  columns: ExcelColumnSpec[];
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  summaryRows?: ExcelSummaryRow[];
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  };
}

export interface AsyncExcelExportResult {
  ok: boolean;
  signedUrl?: string;
  fileName: string;
  rowCount: number;
  fallbackUsed?: boolean;
  error?: string;
}

interface ExportTransportError extends Error {
  status?: number;
}

const UNAVAILABLE_STATUS_CODES = new Set([404, 502, 503, 504]);

/**
 * Classifica a falha da Edge Function.
 * Só é considerada indisponibilidade de transporte/infra (caso em que o CSV
 * local é aceitável como contingência). Erros de autorização, validação,
 * sessão ou falha do próprio servidor devem ser expostos ao usuário — nunca
 * convertidos em "exportação bem-sucedida".
 */
export function isEdgeFunctionUnavailable(err: unknown): boolean {
  const candidate = err as { status?: number; name?: string; message?: string } | null | undefined;

  if (typeof candidate?.status === 'number') {
    return UNAVAILABLE_STATUS_CODES.has(candidate.status);
  }
  if (candidate?.name === 'FunctionsFetchError' || candidate?.name === 'FunctionsRelayError') {
    return true;
  }
  return /unreachable|not deployed|indisponive|failed to send a request|failed to fetch|networkerror|load failed/i.test(
    String(candidate?.message ?? ''),
  );
}

function toExportTransportError(error: unknown): ExportTransportError {
  const raw = error as { message?: string; name?: string; status?: number; context?: { status?: number } };
  const wrapped = new Error(
    raw?.message || 'Falha ao invocar Edge Function import-export.',
  ) as ExportTransportError;
  if (raw?.name) wrapped.name = raw.name;
  const status = raw?.context?.status ?? raw?.status;
  if (typeof status === 'number') wrapped.status = status;
  return wrapped;
}

export function triggerBrowserDownload(url: string, fileName?: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = url;
  if (fileName) {
    link.setAttribute('download', fileName);
  }
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildFallbackCsvBlob(
  columns: ExcelColumnSpec[],
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
): string {
  const escapeCsv = (val: unknown): string => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headerLine = columns.map((c) => escapeCsv(c.header)).join(';');
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key];
        if (col.type === 'currency' && typeof raw === 'number') {
          return escapeCsv(raw.toFixed(2).replace('.', ','));
        }
        return escapeCsv(raw ?? '');
      })
      .join(';'),
  );
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

/**
 * Aciona a Edge Function `import-export` (Deno + ExcelJS) de forma assíncrona.
 * A função gera o arquivo `.xlsx`, faz upload no bucket privado `exports` do
 * Supabase Storage e retorna uma Presigned URL para download imediato sem travar
 * a main thread do React.
 */
export async function requestAsyncExcelExport(
  options: AsyncExcelExportOptions,
): Promise<AsyncExcelExportResult> {
  const client = getSharedClient();

  try {
    const { data, error } = await client.functions.invoke('import-export', {
      body: options,
    });

    if (error) {
      throw toExportTransportError(error);
    }

    const response = data as {
      ok?: boolean;
      signedUrl?: string;
      fileName?: string;
      rowCount?: number;
      error?: string;
    } | null;

    if (!response?.ok || !response.signedUrl) {
      throw new Error(response?.error || 'Resposta inválida da Edge Function de exportação.');
    }

    const finalName = response.fileName || options.fileName;
    triggerBrowserDownload(response.signedUrl, finalName);

    return {
      ok: true,
      signedUrl: response.signedUrl,
      fileName: finalName,
      rowCount: response.rowCount ?? options.rows.length,
    };
  } catch (err) {
    // Erro de autorização/validação/servidor: nunca mascarar como exportação bem-sucedida
    if (!isEdgeFunctionUnavailable(err)) {
      return {
        ok: false,
        fileName: options.fileName,
        rowCount: 0,
        error: err instanceof Error ? err.message : 'Erro desconhecido ao exportar planilha.',
      };
    }

    // Fallback resiliente para modo demo / offline sem travar a operação
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const csvContent = buildFallbackCsvBlob(options.columns, options.rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const fallbackName = options.fileName.replace(/\.xlsx$/i, '') + '.csv';
      triggerBrowserDownload(blobUrl, fallbackName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

      return {
        ok: true,
        fileName: fallbackName,
        rowCount: options.rows.length,
        fallbackUsed: true,
      };
    }

    return {
      ok: false,
      fileName: options.fileName,
      rowCount: 0,
      error: err instanceof Error ? err.message : 'Erro desconhecido ao exportar planilha.',
    };
  }
}
