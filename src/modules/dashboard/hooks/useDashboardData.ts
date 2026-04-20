import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { fetchDashboardData } from '../queries';
import { EMPTY_DASHBOARD_DATA } from '../selectors';
import type { DashboardData } from '../types';

export const useDashboardData = () => {
  const { tenantId, user } = useAuth();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) {
      setData(EMPTY_DASHBOARD_DATA);
      setError('Tenant invalido para carregar dashboard.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextData = await fetchDashboardData({ tenantId, userId: user?.id });
      setData(nextData);
      setError(null);
    } catch (nextError: any) {
      console.error('Failed to load dashboard data', nextError);
      setData(EMPTY_DASHBOARD_DATA);
      setError(nextError?.message || 'Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
};

