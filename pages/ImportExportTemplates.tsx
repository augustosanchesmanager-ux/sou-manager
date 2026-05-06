import React from 'react';
import TemplateManager from '../src/modules/importExport/components/TemplateManager';
import { useParams } from 'react-router-dom';

const ImportExportTemplates: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
      <div className="flex items-center gap-4">
        <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
          <span className="material-symbols-outlined text-primary text-3xl">description</span>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Templates de Importação
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Gerencie modelos de colunas para importação de dados
          </p>
        </div>
      </div>

      <TemplateManager />
    </div>
  );
};

export default ImportExportTemplates;