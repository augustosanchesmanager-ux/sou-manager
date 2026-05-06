import React, { useState, useCallback, useMemo } from 'react';
import type { EntityType, ColumnMapping } from '../../../types';
import { getEntityConfig, detectColumnMapping } from '../../config';

interface StepMappingProps {
  entity: EntityType;
  headers: string[];
  columnMapping: ColumnMapping;
  onMappingComplete: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

const StepMapping: React.FC<StepMappingProps> = ({
  entity,
  headers,
  columnMapping: initialMapping,
  onMappingComplete,
  onBack,
}) => {
  const config = getEntityConfig(entity);
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    if (Object.keys(initialMapping).length > 0) return initialMapping;
    return detectColumnMapping(headers, entity);
  });

  const unmappedHeaders = useMemo(
    () => headers.filter(h => !mapping[h]),
    [headers, mapping],
  );

  const entityFields = useMemo(
    () => [...config.requiredColumns, ...config.optionalColumns],
    [config],
  );

  const handleMappingChange = useCallback((header: string, field: string) => {
    setMapping(prev => {
      const next = { ...prev };

      const existingField = next[header];
      if (existingField) {
        const prevHeader = Object.keys(next).find(k => next[k] === field && k !== header);
        if (prevHeader) {
          delete next[prevHeader];
        }
      }

      if (field) {
        next[header] = field;
      } else {
        delete next[header];
      }

      return next;
    });
  }, []);

  const handleAutoDetect = useCallback(() => {
    const detected = detectColumnMapping(headers, entity);
    setMapping(detected);
  }, [headers, entity]);

  const handleSubmit = useCallback(() => {
    const missingRequired = config.requiredColumns.filter(
      col => !Object.values(mapping).includes(col),
    );

    if (missingRequired.length > 0) {
      alert(`Colunas obrigatórias não mapeadas: ${missingRequired.join(', ')}`);
      return;
    }

    onMappingComplete(mapping);
  }, [mapping, config.requiredColumns, onMappingComplete]);

  const isValid = config.requiredColumns.every(col =>
    Object.values(mapping).includes(col),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-black text-slate-900 dark:text-white uppercase text-sm">
            Mapear Colunas
          </h4>
          <p className="text-xs text-slate-500">
            Associe as colunas do arquivo às campos do sistema
          </p>
        </div>

        <button
          onClick={handleAutoDetect}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-500/20 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">auto_fix_high</span>
          Auto-detectar
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
        <div className="grid grid-cols-[1fr_48px_1fr] gap-4 p-4 bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
          <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Coluna do Arquivo</span>
          <span></span>
          <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Campo do Sistema</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {headers.map(header => (
            <div key={header} className="grid grid-cols-[1fr_48px_1fr] gap-4 p-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                  {header}
                </span>
                {config.requiredColumns.some(col => {
                  const mappedCol = Object.entries(mapping).find(([, v]) => v === col)?.[0];
                  return mappedCol === header;
                }) && (
                  <span className="size-5 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-[10px] font-black text-red-500">*</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
              </div>

              <select
                value={mapping[header] ?? ''}
                onChange={e => handleMappingChange(header, e.target.value)}
                className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">Selecione...</option>
                {entityFields.map(field => {
                  const isUsed = Object.entries(mapping).some(
                    ([k, v]) => v === field && k !== header,
                  );
                  return (
                    <option key={field} value={field} disabled={isUsed}>
                      {field} {isUsed ? '(já usado)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      </div>

      {unmappedHeaders.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Colunas não mapeadas
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                {unmappedHeaders.length} coluna(s) não serão processadas:{' '}
                {unmappedHeaders.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/20 rounded-xl">
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            Status do Mapeamento
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">
            {config.requiredColumns.filter(col => Object.values(mapping).includes(col)).length} de{' '}
            {config.requiredColumns.length} colunas obrigatórias mapeadas
          </p>
        </div>
        <div className={`size-8 rounded-full flex items-center justify-center ${
          isValid ? 'bg-emerald-500' : 'bg-amber-500'
        }`}>
          <span className="material-symbols-outlined text-white text-sm">
            {isValid ? 'check' : 'warning'}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm"
        >
          Voltar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1 py-3 px-6 bg-primary text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Validar Dados
        </button>
      </div>
    </div>
  );
};

export default StepMapping;