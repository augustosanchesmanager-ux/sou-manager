import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import type { ExportPayload } from '../../utils/export/types';
import { exportToCsv } from '../../utils/export/csvExporter';
import { exportToPdf } from '../../utils/export/pdfExporter';

export interface ExportActionsDropdownProps<T = any> {
  getPayload: () => ExportPayload<T> | Promise<ExportPayload<T>>;
  baseFilename: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ExportActionsDropdown: React.FC<ExportActionsDropdownProps> = ({
  getPayload,
  baseFilename,
  label = 'Exportar',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<'csv' | 'pdf' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora do componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fecha o menu com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExportCsv = async () => {
    try {
      setIsExporting('csv');
      const payload = await getPayload();
      exportToCsv(payload, baseFilename);
      setIsOpen(false);
    } catch (err) {
      console.error('Falha ao exportar CSV:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting('pdf');
      const payload = await getPayload();
      await exportToPdf(payload, baseFilename);
      setIsOpen(false);
    } catch (err) {
      console.error('Falha ao exportar PDF:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const isLoading = isExporting !== null;

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 border border-[#B88A44]/40 bg-[#141210] hover:bg-[#1E1B18] hover:border-[#B88A44] text-[#F5F5F0] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-[#B88A44]/50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-[#B88A44] animate-spin" />
        ) : (
          <Download className="w-4 h-4 text-[#B88A44]" />
        )}
        <span>{isLoading ? 'Exportando...' : label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#2D2A26] bg-[#141210] p-1.5 shadow-2xl z-50 backdrop-blur-md focus:outline-none animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-[#2D2A26]/80 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B88A44]">
              Formatos de Exportação
            </span>
          </div>

          {/* Opção Excel / CSV */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleExportCsv}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-xs transition-colors hover:bg-[#201C18] text-[#F5F5F0] disabled:opacity-50 group"
          >
            <div className="mt-0.5 p-1.5 rounded-md bg-[#1C1814] border border-[#2D2A26] text-[#B88A44] group-hover:border-[#B88A44]/50 transition-colors">
              {isExporting === 'csv' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#B88A44]" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="font-medium text-[#F5F5F0] group-hover:text-[#D4A359] transition-colors">
                Planilha Excel (.CSV)
              </div>
              <div className="text-[10px] text-stone-400 leading-tight mt-0.5">
                Compatível com Excel e Google Sheets (UTF-8)
              </div>
            </div>
          </button>

          {/* Opção Documento / PDF */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleExportPdf}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-xs transition-colors hover:bg-[#201C18] text-[#F5F5F0] disabled:opacity-50 group"
          >
            <div className="mt-0.5 p-1.5 rounded-md bg-[#1C1814] border border-[#2D2A26] text-[#B88A44] group-hover:border-[#B88A44]/50 transition-colors">
              {isExporting === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#B88A44]" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="font-medium text-[#F5F5F0] group-hover:text-[#D4A359] transition-colors">
                Documento (.PDF)
              </div>
              <div className="text-[10px] text-stone-400 leading-tight mt-0.5">
                Formato executivo pronto para impressão
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportActionsDropdown;
