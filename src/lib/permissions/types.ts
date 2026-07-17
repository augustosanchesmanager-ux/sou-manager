export type PermissionRole = 'Barber' | 'Receptionist';

export type PermissionModule =
  | 'schedule'
  | 'clients'
  | 'services'
  | 'financial'
  | 'team'
  | 'reports'
  | 'communication';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  module: PermissionModule;
  dependencies?: string[];
  forbidden?: PermissionRole[];
}

export interface PermissionState {
  permission_key: string;
  enabled: boolean;
}

export interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  role: PermissionRole;
  permissions: string[];
}

export interface RolePermissionsState {
  role: PermissionRole;
  permissions: Record<string, boolean>;
}

export interface PermissionChange {
  permission_key: string;
  old_enabled: boolean;
  new_enabled: boolean;
}

export interface PermissionAuditEntry {
  id: string;
  tenant_id: string;
  role: string;
  permission_key: string;
  old_enabled: boolean | null;
  new_enabled: boolean;
  changed_by: string;
  changed_at: string;
}
