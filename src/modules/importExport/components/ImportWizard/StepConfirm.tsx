import React from 'react';

interface StepConfirmProps {
  validRows: number;
  invalidRows: number;
  importOnlyValid: boolean;
  createStockMovements: boolean;
  onImportExecute: () => void;
  onBack: () => void;
  onChangeImportOnlyValid: (v: boolean) => void;
  onChangeCreateStockMovements: (v: boolean) => void;
}

const StepConfirm: React.FC<StepConfirmProps> = ({
  validRows,
  invalidRows,
  importOnlyValid,
  createStockMovements,
  onImportExecute,
  onBack,
  onChangeImportOnlyValid,
  onChangeCreateStockMovements,
}) => {
  const willImport = importOnlyValid ? validRows : validRows + (invalidRows > 0 ? invalidRows : 0);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-primary">task_alt</span>
      </div>

      <div className="text-center">
        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase">
          Confirmar Importação
        </h4>
        <p className="text-sm text-slate-500 mt-2">
          Revise as opções antes de confirmar
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Linhas válidas</span>
              <span className="text-sm font-black text-emerald-500">{validRows}</span>
            </div>
            {invalidRows > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Linhas inválidas</span>
                <span className="text-sm font-black text-red-500">{invalidRows}</span>
              </div>
            )}
            <div className="border-t border-slate-100 dark:border-white/5 pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total a importar</span>
              <span className="text-lg font-black text-primary">{willImport}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={importOnlyValid}
              onChange={e => onChangeImportOnlyValid(e.target.checked)}
              className="mt-1 size-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Importar apenas linhas válidas
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Linhas com erros serão ignoradas e não serão importadas.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={createStockMovements}
              onChange={e => onChangeCreateStockMovements(e.target.checked)}
              className="mt-1 size-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Criar movimentação de estoque
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Quando o estoque do produto mudar, registrar em histórico de movimentação.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 rounded-xl p-4 w-full max-w-md">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500">info</span>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Após confirmar, os dados serão processados e inseridos no banco. Esta ação pode levar alguns minutos dependendo da quantidade de registros.
          </p>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm"
        >
          Voltar
        </button>
        <button
          onClick={onImportExecute}
          className="flex-1 py-3 px-6 bg-primary text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-lg shadow-primary/20"
        >
          Confirmar Importação
        </button>
      </div>
    </div>
  );
};

export default StepConfirm;