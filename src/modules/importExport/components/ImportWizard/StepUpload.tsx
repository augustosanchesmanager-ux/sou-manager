import React, { useState, useCallback } from 'react';
import type { EntityType, ImportExportTemplate } from '../../../types';

interface StepUploadProps {
  entity: EntityType;
  template: ImportExportTemplate | null;
  onFileSelected: (file: File) => void;
  onTemplateSelected: (template: ImportExportTemplate | null) => void;
}

const StepUpload: React.FC<StepUploadProps> = ({
  entity,
  template,
  onFileSelected,
  onTemplateSelected,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!validExtensions.includes(extension)) {
        alert('Por favor, selecione um arquivo CSV ou Excel (.xlsx, .xls)');
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelected(file);
    }
  }, [onFileSelected]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className={`w-full max-w-lg p-8 border-2 border-dashed rounded-2xl transition-all ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-slate-300 dark:border-border-dark hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-slate-400">upload_file</span>
          </div>

          <div className="text-center">
            <p className="font-bold text-slate-900 dark:text-white">
              Arraste o arquivo aqui ou clique para selecionar
            </p>
            <p className="text-sm text-slate-500 mt-1">
              CSV, XLSX ou XLS (máx. 5MB, 10.000 linhas)
            </p>
          </div>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload-input"
          />

          <label
            htmlFor="file-upload-input"
            className="px-6 py-3 bg-primary text-white rounded-xl font-black text-sm uppercase tracking-wider cursor-pointer hover:bg-blue-600 transition-colors"
          >
            Selecionar Arquivo
          </label>

          {selectedFile && (
            <div className="flex items-center gap-2 mt-2">
              <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {selectedFile.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs font-black uppercase text-slate-500 mb-2 tracking-widest">
          Modelo de Colunas
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
          Para evitar erros, baixe o modelo de colunas referente à{' '}
          <span className="font-bold">{entity}</span> e preencha antes de importar.
        </p>
      </div>
    </div>
  );
};

export default StepUpload;