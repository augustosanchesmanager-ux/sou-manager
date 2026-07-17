import React from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import type { PermissionRole } from '../../lib/permissions/types';
import { PERMISSION_DEFINITIONS, MODULE_LABELS } from '../../lib/permissions/definitions';

interface PermissionPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  role: PermissionRole;
  permissions: Record<string, boolean>;
}

const PermissionPreview: React.FC<PermissionPreviewProps> = ({
  isOpen,
  onClose,
  role,
  permissions,
}) => {
  const enabledPerms = PERMISSION_DEFINITIONS.filter(
    (p) => permissions[p.key] && !p.forbidden?.includes(role)
  );

  const groupedByModule = enabledPerms.reduce(
    (acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, typeof enabledPerms>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: Perfil ${role === 'Barber' ? 'Barbeiro' : 'Recepcionista'}`}
      maxWidth="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Este perfil teria acesso as seguintes funcionalidades:
        </p>

        {Object.entries(groupedByModule).map(([module, perms]) => (
          <div key={module}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {MODULE_LABELS[module as keyof typeof MODULE_LABELS]}
            </h4>
            <ul className="space-y-1">
              {perms.map((perm) => (
                <li key={perm.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                  {perm.label}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {enabledPerms.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
            Nenhuma permissao ativa para este perfil.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default PermissionPreview;
