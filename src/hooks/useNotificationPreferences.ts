import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsService } from '../services/notificationsService';
import type { NotificationPreference } from '../types/notifications';

export const useNotificationPreferences = () => {
  const { tenantId, user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId || !user) {
      setPreferences([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPreferences(await notificationsService.getPreferences());
    } catch (err: any) {
      console.error('Erro ao carregar preferências de notificação:', err);
      setError(err.message || 'Não foi possível carregar as preferências.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePreference = (type: NotificationPreference['type']) => {
    setPreferences((prev) =>
      prev.map((preference) =>
        preference.type === type
          ? { ...preference, enabled: !preference.enabled }
          : preference,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await notificationsService.setPreferences(
        preferences.map(({ type, enabled }) => ({ type, enabled })),
      );
      setPreferences(saved);
      return saved;
    } catch (err: any) {
      console.error('Erro ao salvar preferências de notificação:', err);
      const message = err.message || 'Não foi possível salvar as preferências.';
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  };

  return {
    preferences,
    loading,
    saving,
    error,
    refresh,
    togglePreference,
    save,
  };
};
