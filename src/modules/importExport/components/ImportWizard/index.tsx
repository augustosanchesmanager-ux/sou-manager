import React, { useState, useCallback } from 'react';
import type { EntityType, ImportExportTemplate, ParsedRow, ColumnMapping } from '../../types';
import { getEntityConfig, detectColumnMapping } from '../../config';
import { parseCSVFile, mapAndValidateRows } from '../../utils/csvParser';
import { parseXLSX } from '../../utils/xlsxParser';
import { validateFileSize, validateRowCount } from '../../utils/validators';
import { downloadCSVTemplate } from '../../utils/xlsxParser';
import StepUpload from './StepUpload';
import StepMapping from './StepMapping';
import StepPreview from './StepPreview';
import StepConfirm from './StepConfirm';
import StepResult from './StepResult';

export type WizardStep = 'upload' | 'mapping' | 'preview' | 'confirm' | 'result';

export interface WizardState {
  step: WizardStep;
  entity: EntityType;
  template: ImportExportTemplate | null;
  file: File | null;
  headers: string[];
  parsedRows: ParsedRow[];
  columnMapping: ColumnMapping;
  importOnlyValid: boolean;
  createStockMovements: boolean;
  jobId: string | null;
  result: {
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: { rowNumber: number; message: string }[];
  } | null;
}

const initialState: WizardState = {
  step: 'upload',
  entity: 'clients',
  template: null,
  file: null,
  headers: [],
  parsedRows: [],
  columnMapping: {},
  importOnlyValid: true,
  createStockMovements: false,
  jobId: null,
  result: null,
};

interface ImportWizardProps {
  entity: EntityType;
  onComplete: (result: WizardState['result']) => void;
  onCancel: () => void;
  initialTemplate?: ImportExportTemplate | null;
}

const ImportWizard: React.FC<ImportWizardProps> = ({
  entity,
  onComplete,
  onCancel,
  initialTemplate = null,
}) => {
  const [state, setState] = useState<WizardState>({
    ...initialState,
    entity,
    template: initialTemplate,
  });

  const handleFileSelected = useCallback(async (file: File) => {
    if (!validateFileSize(file.size)) {
      alert('Arquivo muito grande. Máximo: 5MB');
      return;
    }

    try {
      let result;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        result = await parseXLSX(file);
      } else {
        result = await parseCSVFile(file);
      }

      if (!validateRowCount(result.rows.length)) {
        alert(' muitas linhas. Máximo: 10.000 linhas');
        return;
      }

      const config = getEntityConfig(entity);
      const autoMapping = detectColumnMapping(result.headers, entity);

      setState(prev => ({
        ...prev,
        file,
        headers: result.headers,
        parsedRows: result.rows.map(r => ({
          rowNumber: r.rowNumber,
          original: r.data,
          normalized: null,
          errors: [],
          warnings: [],
          status: 'pending',
        })),
        columnMapping: Object.keys(autoMapping).length > 0 ? autoMapping : {},
        step: Object.keys(autoMapping).length > 0 ? 'preview' : 'mapping',
      }));
    } catch (err) {
      alert(`Erro ao processar arquivo: ${(err as Error).message}`);
    }
  }, [entity]);

  const handleTemplateSelected = useCallback((template: ImportExportTemplate | null) => {
    setState(prev => ({ ...prev, template }));
  }, []);

  const handleMappingComplete = useCallback((mapping: ColumnMapping) => {
    const config = getEntityConfig(state.entity);
    const normalized = mapAndValidateRows(
      state.parsedRows.map(r => ({ rowNumber: r.rowNumber, data: r.original })),
      mapping,
      config.normalizationRules,
      config.requiredColumns,
    );

    setState(prev => ({
      ...prev,
      columnMapping: mapping,
      parsedRows: normalized,
      step: 'preview',
    }));
  }, [state.parsedRows, state.entity]);

  const handlePreviewConfirm = useCallback(() => {
    setState(prev => ({ ...prev, step: 'confirm' }));
  }, []);

  const handleImportExecute = useCallback(async () => {
    if (!state.jobId || !state.file) return;

    setState(prev => ({ ...prev, step: 'result' }));
  }, [state.jobId, state.file]);

  const handleResultComplete = useCallback((result: WizardState['result']) => {
    setState(prev => ({ ...prev, result }));
    onComplete(result);
  }, [onComplete]);

  const handleBack = useCallback(() => {
    setState(prev => {
      switch (prev.step) {
        case 'mapping':
          return { ...prev, step: 'upload', columnMapping: {}, parsedRows: [] };
        case 'preview':
          return { ...prev, step: 'mapping' };
        case 'confirm':
          return { ...prev, step: 'preview' };
        case 'result':
          return { ...prev, step: 'confirm' };
        default:
          return prev;
      }
    });
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const config = getEntityConfig(state.entity);
    const headers = [...config.requiredColumns, ...config.optionalColumns];
    downloadCSVTemplate(headers, `${state.entity}_template.csv`);
  }, [state.entity]);

  const validRows = state.parsedRows.filter(r => r.status === 'valid').length;
  const invalidRows = state.parsedRows.filter(r => r.status === 'invalid').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-border-dark">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase text-sm">
              Importar {getEntityConfig(state.entity).labelPlural}
            </h3>
            <p className="text-xs text-slate-500">
              {state.file?.name ?? 'Sem arquivo selecionado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['upload', 'mapping', 'preview', 'confirm', 'result'].map((s, idx) => {
            const stepIndex = ['upload', 'mapping', 'preview', 'confirm', 'result'].indexOf(state.step);
            const isActive = s === state.step;
            const isPast = idx < stepIndex;

            return (
              <React.Fragment key={s}>
                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-black ${
                  isActive ? 'bg-primary text-white' :
                  isPast ? 'bg-emerald-500 text-white' :
                  'bg-slate-200 dark:bg-white/10 text-slate-500'
                }`}>
                  {isPast ? <span className="material-symbols-outlined text-sm">check</span> : idx + 1}
                </div>
                {idx < 4 && (
                  <div className={`h-0.5 w-6 ${isPast ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Baixar Modelo
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {state.step === 'upload' && (
          <StepUpload
            entity={state.entity}
            template={state.template}
            onFileSelected={handleFileSelected}
            onTemplateSelected={handleTemplateSelected}
          />
        )}

        {state.step === 'mapping' && (
          <StepMapping
            entity={state.entity}
            headers={state.headers}
            columnMapping={state.columnMapping}
            onMappingComplete={handleMappingComplete}
            onBack={handleBack}
          />
        )}

        {state.step === 'preview' && (
          <StepPreview
            entity={state.entity}
            parsedRows={state.parsedRows}
            validRows={validRows}
            invalidRows={invalidRows}
            onConfirm={handlePreviewConfirm}
            onBack={handleBack}
          />
        )}

        {state.step === 'confirm' && (
          <StepConfirm
            validRows={validRows}
            invalidRows={invalidRows}
            importOnlyValid={state.importOnlyValid}
            createStockMovements={state.createStockMovements}
            onImportExecute={handleImportExecute}
            onBack={handleBack}
            onChangeImportOnlyValid={(v) => setState(prev => ({ ...prev, importOnlyValid: v }))}
            onChangeCreateStockMovements={(v) => setState(prev => ({ ...prev, createStockMovements: v }))}
          />
        )}

        {state.step === 'result' && state.jobId && (
          <StepResult
            jobId={state.jobId}
            entity={state.entity}
            rows={state.parsedRows}
            importOnlyValid={state.importOnlyValid}
            createStockMovements={state.createStockMovements}
            onComplete={handleResultComplete}
          />
        )}
      </div>
    </div>
  );
};

export default ImportWizard;