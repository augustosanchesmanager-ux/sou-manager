import React, { useMemo } from 'react';
import type { EntityType, ParsedRow } from '../../../types';
import { getEntityConfig } from '../../config';
import { generateErrorCSV } from '../../utils/csvParser';

interface StepPreviewProps {
  entity: EntityType;
  parsedRows: ParsedRow[];
  validRows: number;
  invalidRows: number;
  onConfirm: () => void;
  onBack: () => void;
}

const StepPreview: React.FC<StepPreviewProps> = ({
  entity,
  parsedRows,
  validRows,
  invalidRows,
  onConfirm,
  onBack,
}) => {
  const config = getEntityConfig(entity);

  const displayRows = useMemo(() => {
    return parsedRows.slice(0, 100);
  }, [parsedRows]);

  const totalRows = parsedRows.length;
  const hasInvalid = invalidRows > 0;

  const handleDownloadErrors = () => {
    const csv = generateErrorCSV(parsedRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entity}_import_errors.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-black text-slate-900 dark:text-white uppercase text-sm">
          Validação dos Dados
        </h4>
        <p className="text-xs text-slate-500">
          Revise os dados antes de importar
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-500">table</span>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{totalRows}</p>
              <p className="text-xs text-slate-500 font-bold uppercase">Total de Linhas</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-500">check_circle</span>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-500">{validRows}</p>
              <p className="text-xs text-slate-500 font-bold uppercase">Linhas Válidas</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-full flex items-center justify-center ${hasInvalid ? 'bg-red-500/10' : 'bg-slate-100 dark:bg-white/5'}`}>
              <span className={`material-symbols-outlined ${hasInvalid ? 'text-red-500' : 'text-slate-400'}`}>error</span>
            </div>
            <div>
              <p className={`text-2xl font-black ${hasInvalid ? 'text-red-500' : 'text-slate-400'}`}>
                {invalidRows}
              </p>
              <p className="text-xs text-slate-500 font-bold uppercase">Linhas Inválidas</p>
            </div>
          </div>
        </div>
      </div>

      {hasInvalid && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500">warning</span>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                Algumas linhas contêm erros
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                Você pode importar apenas as linhas válidas ou corrigir o arquivo e tentar novamente.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadErrors}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Baixar Erros
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/5 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">Linha</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                {Object.keys(parsedRows[0]?.original ?? {}).slice(0, 5).map(key => (
                  <th key={key} className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    {key}
                  </th>
                ))}
                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {displayRows.map(row => (
                <tr key={row.rowNumber} className={`${row.status === 'invalid' ? 'bg-red-50 dark:bg-red-900/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                  <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {row.rowNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      row.status === 'valid'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {row.status === 'valid' ? 'Válida' : 'Inválida'}
                    </span>
                  </td>
                  {Object.entries(row.original).slice(0, 5).map(([key, val]) => (
                    <td key={key} className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                      {String(val ?? '')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {row.errors.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {row.errors.slice(0, 2).map((err, idx) => (
                          <span key={idx} className="text-[10px] text-red-500 font-bold">
                            {err.field}: {err.message}
                          </span>
                        ))}
                        {row.errors.length > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{row.errors.length - 2} mais...
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalRows > 100 && (
          <div className="p-3 bg-slate-50 dark:bg-white/5 text-center">
            <p className="text-xs text-slate-500">
              Mostrando 100 de {totalRows} linhas. Todas as {totalRows} linhas serão importadas.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm"
        >
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={validRows === 0}
          className="flex-1 py-3 px-6 bg-primary text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasInvalid ? `Importar Apenas ${validRows} Válidas` : `Confirmar Importação (${validRows})`}
        </button>
      </div>
    </div>
  );
};

export default StepPreview;