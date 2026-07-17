import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSION_DEFINITIONS } from './definitions';
import { fetchRolePermissions, saveRolePermissions, resetRolePermissions } from './service';
import type { PermissionRole } from './types';

interface UsePermissionsReturn {
  Barber: Record<string, boolean>;
  Receptionist: Record<string, boolean>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadPermissions: () => Promise<void>;
  updatePermission: (role: PermissionRole, key: string, enabled: boolean) => void;
  applyPreset: (role: PermissionRole, permissionKeys: string[]) => void;
  copyPermissions: (fromRole: PermissionRole, toRole: PermissionRole) => void;
  saveAll: () => Promise<void>;
  resetToDefault: (role: PermissionRole) => Promise<void>;
  hasUnsavedChanges: boolean;
  getActiveCount: (role: PermissionRole) => number;
}

const ALL_KEYS = PERMISSION_DEFINITIONS.map((p) => p.key);

export function usePermissions(): UsePermissionsReturn {
  const { tenantId } = useAuth();
  const [barberPerms, setBarberPerms] = useState<Record<string, boolean>>({});
  const [receptionistPerms, setReceptionistPerms] = useState<Record<string, boolean>>({});
  const [originalBarber, setOriginalBarber] = useState<Record<string, boolean>>({});
  const [originalReceptionist, setOriginalReceptionist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadPermissions = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [barberData, receptionistData] = await Promise.all([
        fetchRolePermissions(tenantId, 'Barber'),
        fetchRolePermissions(tenantId, 'Receptionist'),
      ]);

      const normalize = (data: Record<string, boolean>): Record<string, boolean> => {
        const result: Record<string, boolean> = {};
        for (const key of ALL_KEYS) {
          result[key] = data[key] ?? false;
        }
        return result;
      };

      const normalizedBarber = normalize(barberData);
      const normalizedReceptionist = normalize(receptionistData);

      setBarberPerms(normalizedBarber);
      setReceptionistPerms(normalizedReceptionist);
      setOriginalBarber(normalizedBarber);
      setOriginalReceptionist(normalizedReceptionist);
      loadedRef.current = true;
    } catch (err) {
      setError('Erro ao carregar permissoes.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadPermissions();
    }
  }, [loadPermissions]);

  const updatePermission = useCallback((role: PermissionRole, key: string, enabled: boolean) => {
    if (role === 'Barber') {
      setBarberPerms((prev) => ({ ...prev, [key]: enabled }));
    } else {
      setReceptionistPerms((prev) => ({ ...prev, [key]: enabled }));
    }
  }, []);

  const applyPreset = useCallback((role: PermissionRole, permissionKeys: string[]) => {
    const newPerms: Record<string, boolean> = {};
    for (const key of ALL_KEYS) {
      newPerms[key] = permissionKeys.includes(key);
    }
    if (role === 'Barber') {
      setBarberPerms(newPerms);
    } else {
      setReceptionistPerms(newPerms);
    }
  }, []);

  const copyPermissions = useCallback((fromRole: PermissionRole, toRole: PermissionRole) => {
    const source = fromRole === 'Barber' ? barberPerms : receptionistPerms;
    if (toRole === 'Barber') {
      setBarberPerms({ ...source });
    } else {
      setReceptionistPerms({ ...source });
    }
  }, [barberPerms, receptionistPerms]);

  const saveAll = useCallback(async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        saveRolePermissions(tenantId, 'Barber', barberPerms),
        saveRolePermissions(tenantId, 'Receptionist', receptionistPerms),
      ]);
      setOriginalBarber(barberPerms);
      setOriginalReceptionist(receptionistPerms);
    } catch (err) {
      setError('Erro ao salvar permissoes.');
      console.error(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [tenantId, barberPerms, receptionistPerms]);

  const resetToDefault = useCallback(async (role: PermissionRole) => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      await resetRolePermissions(tenantId, role);
      await loadPermissions();
    } catch (err) {
      setError('Erro ao redefinir permissoes.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [tenantId, loadPermissions]);

  const hasUnsavedChanges =
    JSON.stringify(barberPerms) !== JSON.stringify(originalBarber) ||
    JSON.stringify(receptionistPerms) !== JSON.stringify(originalReceptionist);

  const getActiveCount = useCallback(
    (role: PermissionRole): number => {
      const perms = role === 'Barber' ? barberPerms : receptionistPerms;
      return Object.values(perms).filter(Boolean).length;
    },
    [barberPerms, receptionistPerms]
  );

  return {
    Barber: barberPerms,
    Receptionist: receptionistPerms,
    loading,
    saving,
    error,
    loadPermissions,
    updatePermission,
    applyPreset,
    copyPermissions,
    saveAll,
    resetToDefault,
    hasUnsavedChanges,
    getActiveCount,
  };
}
