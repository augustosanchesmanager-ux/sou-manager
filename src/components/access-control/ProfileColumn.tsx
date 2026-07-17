import React from 'react';
import type { PermissionModule, PermissionRole } from '../../lib/permissions/types';
import { getPermissionsByModule } from '../../lib/permissions/definitions';
import ModuleSection from './ModuleSection';

interface ProfileColumnProps {
  role: PermissionRole;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  permissions: Record<string, boolean>;
  onToggle: (key: string, enabled: boolean) => void;
  modules: PermissionModule[];
  activeCount: number;
  totalCount: number;
}

const ProfileColumn: React.FC<ProfileColumnProps> = ({
  role,
  label,
  subtitle,
  icon,
  color,
  permissions,
  onToggle,
  modules,
  activeCount,
  totalCount,
}) => {
  const visibleModules = modules.filter((mod) => {
    const modulePerms = getPermissionsByModule(mod);
    return modulePerms.some((p) => !p.forbidden?.includes(role));
  });

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <span className="material-symbols-outlined text-white text-xl">{icon}</span>
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">{label}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle} &middot; {activeCount}/{totalCount} ativos
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {visibleModules.map((mod) => (
          <ModuleSection
            key={mod}
            module={mod}
            role={role}
            permissions={permissions}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default ProfileColumn;
