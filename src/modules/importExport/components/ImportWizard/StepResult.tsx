import React, { useEffect, useState } from 'react';
import type { WizardState } from './index';
import * as api from '../../services/importExportApi';
import type { EntityType } from '../../types';

interface StepResultProps {
  jobId: string | null;
  entity: EntityType;
  rows: WizardState['parsedRows'];
  importOnlyValid: boolean;
  createStockMovements: boolean;
  onComplete: (result: WizardState['result']) => void;
}

interface CommitResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

const StepResult: React.FC<StepResultProps> = ({
  jobId,
  entity,
  rows,
  importOnlyValid,
  createStockMovements,
  onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    const executeCommit = async () => {
      if (!jobId) {
        setError('Job ID não encontrado');
        setLoading(false);
        return;
      }

      try {
        const validRows = rows.filter(r => r.status === 'valid').map(r => ({
          ...r.normalized,
          _rowNumber: r.rowNumber,
        }));

        const validationRes = await api.validateImport(
          entity,
          jobId,
          validRows.filter(r => r !== null) as Record<string, unknown>[],
        );

        const commitRes = await api.commitImport(entity, jobId, {
          createStockMovements,
          importOnlyValid,
        });

        setResult({
          success: commitRes.success,
          createdCount: commitRes.createdCount,
          updatedCount: commitRes.updatedCount,
          skippedCount: commitRes.skippedCount,
          failedCount: commitRes.failedCount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao executar importação');
        setResult({
          success: false,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: rows.length,
        });
      } finally {
        setLoading(false);
      }
    };

    void executeCommit();
  }, [jobId, entity, rows, importOnlyValid, createStockMovements]);

  useEffect(() => {
    if (!loading && result) {
      onComplete({
        ...result,
        errors: [],
      });
    }
  }, [loading, result, onComplete]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative size-16">
          <div className="absolute inset-0 border-4 border-slate-200 dark:border-white/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-slate-900 dark:text-white uppercase">
            Processando Importação
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Gravando dados no banco de dados...
          </p>
        </div>
        <div className="w-full max-w-md bg-slate-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className={`size-16 rounded-full flex items-center justify-center ${
        result?.success ? 'bg-emerald-500' : 'bg-red-500'
      }`}>
        <span className="material-symbols-outlined text-3xl text-white">
          {result?.success ? 'check' : 'error'}
        </span>
      </div>

      <div className="text-center">
        <p className="text-xl font-black text-slate-900 dark:text-white uppercase">
          {result?.success ? 'Importação Concluída' : 'Importação Falhou'}
        </p>
        <p className="text-sm text-slate-500 mt-2">
          {result?.success
            ? 'Seus dados foram importados com sucesso.'
            : 'Ocorreu um erro durante a importação.'}
        </p>
      </div>

      {error && (
        <div className="w-full max-w-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-2">
            Erro
          </p>
          <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="w-full max-w-md bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
          <div className="space-y-3">
            {result.createdCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Criados</span>
                <span className="text-sm font-black text-emerald-500">{result.createdCount}</span>
              </div>
            )}
            {result.updatedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Atualizados</span>
                <span className="text-sm font-black text-blue-500">{result.updatedCount}</span>
              </div>
            )}
            {result.skippedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Ignorados</span>
                <span className="text-sm font-black text-amber-500">{result.skippedCount}</span>
              </div>
            )}
            {result.failedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Falhas</span>
                <span className="text-sm font-black text-red-500">{result.failedCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm"
        >
          Nova Importação
        </button>
        <button
          onClick={() => onComplete({
            success: result?.success ?? false,
            createdCount: result?.createdCount ?? 0,
            updatedCount: result?.updatedCount ?? 0,
            skippedCount: result?.skippedCount ?? 0,
            failedCount: result?.failedCount ?? 0,
            errors: [],
          })}
          className="flex-1 py-3 px-6 bg-primary text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-lg shadow-primary/20"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default StepResult;