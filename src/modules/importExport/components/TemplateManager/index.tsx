import React, { useState, useEffect, useCallback } from 'react';
import type { ImportExportTemplate, EntityType } from '../../types';
import { useTemplates } from '../../hooks';
import { getEntityConfig } from '../../config';

interface TemplateManagerProps {
  entity?: EntityType;
  onSelectTemplate?: (template: ImportExportTemplate) => void;
  onClose?: () => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  entity,
  onSelectTemplate,
  onClose,
}) => {
  const { templates, loading, error, fetchTemplates, deleteTemplate, updateTemplate } = useTemplates();
  const [filterEntity, setFilterEntity] = useState<EntityType | undefined>(entity);
  const [filterDirection, setFilterDirection] = useState<'import' | 'export' | 'both' | undefined>(undefined);
  const [showGlobal, setShowGlobal] = useState(true);

  useEffect(() => {
    void fetchTemplates(filterEntity);
  }, [fetchTemplates, filterEntity]);

  const filteredTemplates = templates.filter(t => {
    if (filterEntity && t.entity !== filterEntity) return false;
    if (filterDirection && t.direction !== filterDirection && t.direction !== 'both') return false;
    if (!showGlobal && t.tenant_id === null) return false;
    return true;
  });

  const handleToggleActive = useCallback(async (template: ImportExportTemplate) => {
    await updateTemplate(template.id, { is_active: !template.is_active });
  }, [updateTemplate]);

  const handleSetDefault = useCallback(async (template: ImportExportTemplate) => {
    const others = templates.filter(t =>
      t.entity === template.entity &&
      t.direction === template.direction &&
      t.id !== template.id
    );

    for (const t of others) {
      if (t.is_default) {
        await updateTemplate(t.id, { is_default: false });
      }
    }

    await updateTemplate(template.id, { is_default: true });
  }, [templates, updateTemplate]);

  const handleDelete = useCallback(async (template: ImportExportTemplate) => {
    if (!confirm(`Excluir template "${template.name}"?`)) return;
    await deleteTemplate(template.id);
  }, [deleteTemplate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">
            Templates de Importação
          </h3>
          <p className="text-xs text-slate-500">
            Gerencie modelos de importação para cada entidade
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterEntity ?? ''}
            onChange={e => setFilterEntity(e.target.value ? e.target.value as EntityType : undefined)}
            className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Todas Entidades</option>
            <option value="clients">Clientes</option>
            <option value="products">Produtos</option>
            <option value="services">Serviços</option>
          </select>

          <button
            onClick={() => setShowGlobal(!showGlobal)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              showGlobal
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
            }`}
          >
            {showGlobal ? 'Global + Tenant' : 'Só Tenant'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && filteredTemplates.length === 0 && (
          <div className="text-center py-8 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-border-dark">
            <span className="material-symbols-outlined text-4xl text-slate-300">folder_open</span>
            <p className="text-sm text-slate-500 mt-2">Nenhum template encontrado</p>
          </div>
        )}

        {filteredTemplates.map(template => {
          const config = getEntityConfig(template.entity as EntityType);
          return (
            <div
              key={template.id}
              className={`bg-white dark:bg-card-dark rounded-xl border ${
                template.is_default
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : 'border-slate-200 dark:border-border-dark'
              } p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      {template.name}
                    </h4>
                    {template.is_default && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full">
                        Padrão
                      </span>
                    )}
                    {template.tenant_id === null && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase rounded-full">
                        Global
                      </span>
                    )}
                    {!template.is_active && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black uppercase rounded-full">
                        Inativo
                      </span>
                    )}
                  </div>

                  {template.description && (
                    <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">category</span>
                      {config.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      {template.direction}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">folder</span>
                      {template.formats?.join(', ') ?? 'csv'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">layers</span>
                      v{template.version}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {Object.keys(template.column_mapping ?? {}).length} colunas
                    </span>
                    {template.required_columns?.length > 0 && (
                      <>
                        <span className="text-slate-200">|</span>
                        <span className="text-[10px] font-black uppercase text-red-400">
                          {template.required_columns.length} obrigatórias
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!template.is_default && (
                    <button
                      onClick={() => void handleSetDefault(template)}
                      className="p-2 text-slate-400 hover:text-primary transition-colors"
                      title="Definir como padrão"
                    >
                      <span className="material-symbols-outlined text-sm">star</span>
                    </button>
                  )}

                  <button
                    onClick={() => void handleToggleActive(template)}
                    className={`p-2 transition-colors ${
                      template.is_active
                        ? 'text-slate-400 hover:text-amber-500'
                        : 'text-amber-500 hover:text-emerald-500'
                    }`}
                    title={template.is_active ? 'Inativar' : 'Ativar'}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {template.is_active ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>

                  {onSelectTemplate && (
                    <button
                      onClick={() => onSelectTemplate(template)}
                      className="p-2 text-slate-400 hover:text-primary transition-colors"
                      title="Usar template"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                    </button>
                  )}

                  <button
                    onClick={() => void handleDelete(template)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateManager;