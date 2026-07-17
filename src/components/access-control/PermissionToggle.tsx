import React, { useState } from 'react';
import type { PermissionDefinition, PermissionRole } from '../../lib/permissions/types';
import { getPermissionByKey } from '../../lib/permissions/definitions';

interface PermissionToggleProps {
  permission: PermissionDefinition;
  enabled: boolean;
  role: PermissionRole;
  allPermissions: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({
  permission,
  enabled,
  role,
  allPermissions,
  onToggle,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isForbidden = permission.forbidden?.includes(role);

  if (isForbidden) return null;

  const missingDeps =
    permission.dependencies?.filter((dep) => !allPermissions[dep]) || [];
  const hasMissingDeps = missingDeps.length > 0;

  const depLabels = missingDeps.map((dep) => {
    const def = getPermissionByKey(dep);
    return def?.label || dep;
  });

  return (
    <div
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] group transition-colors"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
            {permission.label}
          </span>
          {hasMissingDeps && (
            <span className="material-symbols-outlined text-amber-500 text-sm flex-shrink-0" title={`Depende de: ${depLabels.join(', ')}`}>
              warning
            </span>
          )}
        </div>
        {showTooltip && (
          <div className="mt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {permission.description}
            </p>
            {hasMissingDeps && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Depende de: {depLabels.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(permission.key, !enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-card-dark ${
          enabled
            ? 'bg-primary'
            : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export default PermissionToggle;
