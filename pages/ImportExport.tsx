import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { getEntityConfig, getEntityLabelPlural } from '../src/modules/importExport/config';
import type { EntityType } from '../src/modules/importExport/types';
import ImportWizard from '../src/modules/importExport/components/ImportWizard';
import { useTemplates } from '../src/modules/importExport/hooks';
import { downloadCSVTemplate } from '../src/modules/importExport/utils/xlsxParser';

const ImportExport: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { accessRole } = useAuth();
  const { templates, fetchTemplates } = useTemplates();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('clients');

  const entities: EntityType[] = ['products', 'services', 'clients'];

  const handleImport = (entity: EntityType) => {
    setSelectedEntity(entity);
    setShowWizard(true);
  };

  const handleDownloadTemplate = (entity: EntityType) => {
    const config = getEntityConfig(entity);
    const headers = [...config.requiredColumns, ...config.optionalColumns];
    downloadCSVTemplate(headers, `${entity}_template.csv`);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    navigate('/import-export', { replace: true });
  };

  const handleImportComplete = (result: unknown) => {
    console.log('Import completed:', result);
    setShowWizard(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
      <div className="flex items-center gap-4">
        <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
          <span className="material-symbols-outlined text-primary text-3xl">upload_file</span>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Importar / Exportar
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Importar dados de CSV ou Excel, ou exportar para CSV/XLSX
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {entities.map(entity => {
          const config = getEntityConfig(entity);
          const entityTemplates = templates.filter(t => t.entity === entity && t.is_active);

          return (
            <div
              key={entity}
              className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-xl hover:shadow-2xl transition-all"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="size-12 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-slate-500">
                      {entity === 'clients' ? 'group' : entity === 'products' ? 'inventory_2' : 'content_cut'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {entity}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-2">
                  {config.labelPlural}
                </h3>

                <p className="text-sm text-slate-500 mb-4">
                  {entity === 'clients' && 'Importar base de clientes com Nome, Telefone, Email e mais.'}
                  {entity === 'products' && 'Importar catálogo de produtos com preço, estoque e código.'}
                  {entity === 'services' && 'Importar serviços com nome, preço, duração e comissão.'}
                </p>

                {entityTemplates.length > 0 && (
                  <div className="mb-4 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    <p className="text-xs font-bold text-emerald-600 mb-1">
                      {entityTemplates.length} template(s) disponível(eis)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {entityTemplates.slice(0, 2).map(t => (
                        <span key={t.id} className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => handleImport(entity)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-blue-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Importar
                  </button>

                  <button
                    onClick={() => handleDownloadTemplate(entity)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Baixar Modelo CSV
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-border-dark p-6">
        <h4 className="font-black text-slate-900 dark:text-white uppercase text-sm mb-4">
          История Importações Recentes
        </h4>
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-4xl text-slate-300">history</span>
          <p className="text-sm text-slate-500 mt-2">Nenhuma importação reciente</p>
          <p className="text-xs text-slate-400">Suas importações aparecerão aqui</p>
        </div>
      </div>

      {showWizard && (
        <Modal
          isOpen={showWizard}
          onClose={handleCloseWizard}
          title={`Importar ${getEntityLabelPlural(selectedEntity)}`}
          maxWidth="4xl"
        >
          <div className="min-h-[500px]">
            <ImportWizard
              entity={selectedEntity}
              onComplete={handleImportComplete}
              onCancel={handleCloseWizard}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ImportExport;