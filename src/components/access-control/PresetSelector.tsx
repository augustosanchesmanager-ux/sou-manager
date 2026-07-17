import React, { useState } from 'react';
import type { PermissionPreset, PermissionRole } from '../../lib/permissions/types';
import { getPresetsByRole } from '../../lib/permissions/presets';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';

interface PresetSelectorProps {
  role: PermissionRole;
  onApply: (permissionKeys: string[]) => void;
}

const PresetSelector: React.FC<PresetSelectorProps> = ({ role, onApply }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PermissionPreset | null>(null);
  const presets = getPresetsByRole(role);

  if (presets.length === 0) return null;

  const handleSelect = (preset: PermissionPreset) => {
    setPendingPreset(preset);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingPreset) {
      onApply(pendingPreset.permissions);
    }
    setIsConfirmOpen(false);
    setPendingPreset(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleSelect(preset)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            {preset.name}
          </button>
        ))}
      </div>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => { setIsConfirmOpen(false); setPendingPreset(null); }}
        title="Aplicar Preset"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setIsConfirmOpen(false); setPendingPreset(null); }}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              Aplicar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
          Tem certeza que deseja aplicar o preset <strong>{pendingPreset?.name}</strong>?
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {pendingPreset?.description}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
          Esta acao ira substituir todas as permissoes atuais deste perfil.
        </p>
      </Modal>
    </>
  );
};

export default PresetSelector;
