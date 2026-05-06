import { useState, useCallback } from 'react';
import type { EntityType, FileFormat } from '../types';
import { generateXLSX, exportToXLSX } from '../utils/xlsxParser';
import { generateCSVContent } from '../utils/csvParser';

export interface ExportFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(async (
    entity: EntityType,
    format: FileFormat,
    data: Record<string, unknown>[],
    headers: string[],
    columnMapping: Record<string, string>,
    filename: string,
  ) => {
    if (data.length === 0) {
      setError('No data to export');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      if (format === 'xlsx') {
        generateXLSX(data, headers, columnMapping, `${filename}.xlsx`);
      } else {
        const csvContent = generateCSVContent(headers, data, columnMapping);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    exportData,
  };
}