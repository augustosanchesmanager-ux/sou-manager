import React, { useState } from 'react';
import type { PermissionDefinition, PermissionModule, PermissionRole } from '../../lib/permissions/types';
import { MODULE_LABELS, MODULE_ICONS, getPermissionsByModule, getModulePermissionsCount } from '../../lib/permissions/definitions';
import PermissionToggle from './PermissionToggle';

interface ModuleSectionProps {
  module: PermissionModule;
  role: PermissionRole;
  permissions: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
}

const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  role,
  permissions,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const modulePerms = getPermissionsByModule(module);
  const visiblePerms = modulePerms.filter((p) => !p.forbidden?.includes(role));
  const { total, active } = getModulePermissionsCount(module, permissions);

  if (visiblePerms.length === 0) return null;

  const allVisibleEnabled = visiblePerms.every((p) => permissions[p.key]);
  const someVisibleEnabled = visiblePerms.some((p) => permissions[p.key]) && !allVisibleEnabled;

  const handleToggleAll = () => {
    const newState = !allVisibleEnabled;
    for (const perm of visiblePerms) {
      onToggle(perm.key, newState);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">
            {MODULE_ICONS[module]}
          </span>
          <span className="font-bold text-sm text-slate-900 dark:text-white">
            {MODULE_LABELS[module]}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {active}/{visiblePerms.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleAll();
            }}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
          >
            {allVisibleEnabled ? 'Desmarcar tudo' : 'Marcar tudo'}
          </button>
          <span
            className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-2 space-y-0.5">
          {visiblePerms.map((perm) => (
            <PermissionToggle
              key={perm.key}
              permission={perm}
              enabled={!!permissions[perm.key]}
              role={role}
              allPermissions={permissions}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleSection;
