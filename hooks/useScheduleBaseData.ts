import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Types
export interface ServiceData {
  id: string;
  name: string;
  duration: number;
  buffer?: number;
  price?: number;
}

export interface StaffData {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export interface ClientData {
  id: string;
  name: string;
  phone: string;
}

export interface PromotionData {
  id: string;
  title: string;
  target_type: 'all' | 'service' | 'product';
  target_id: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date: string;
}

interface ScheduleBaseData {
  staff: StaffData[];
  services: ServiceData[];
  clients: ClientData[];
  promotions: PromotionData[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

// Cache simple em memória (invalida após 5 minutos)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cachedData: ScheduleBaseData | null = null;

export const useScheduleBaseData = () => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<ScheduleBaseData>({
    staff: [],
    services: [],
    clients: [],
    promotions: [],
    loading: false,
    error: null,
    lastFetched: null,
  });

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!tenantId) {
      setData(prev => ({ ...prev, staff: [], services: [], clients: [], promotions: [], error: null }));
      return;
    }

    // Verificar cache
    if (!forceRefresh && cachedData && cachedData.lastFetched && Date.now() - cachedData.lastFetched < CACHE_TTL) {
      setData({ ...cachedData, loading: false });
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Query única para buscar todos os dados base (sem fallbacks)
      // Se falhar, usamos dados vazios (o sistema ainda funciona, apenas sem alguns dados opcionais)
      const [staffRes, servicesRes, clientsRes, promoRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, name, role, avatar')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .in('role', ['Barber', 'Manager']),
        
        supabase
          .from('services')
          .select('id, name, duration, buffer, price')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('name'),
        
        supabase
          .from('clients')
          .select('id, name, phone')
          .eq('tenant_id', tenantId)
          .order('name'),
        
        supabase
          .from('promotions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('created_at', { ascending: false }),
      ]);

      // Filtrar promoções válidas
      const now = new Date();
      const validPromos = (promoRes.data || []).filter((p: PromotionData) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      });

      const newData: ScheduleBaseData = {
        staff: staffRes.data || [],
        services: servicesRes.data || [],
        clients: clientsRes.data || [],
        promotions: validPromos,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      };

      // Atualizar cache
      cachedData = newData;

      setData(newData);
    } catch (err) {
      console.error('Erro ao buscar dados base da agenda:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      
      const errorData: ScheduleBaseData = {
        staff: [],
        services: [],
        clients: [],
        promotions: [],
        loading: false,
        error: errorMessage,
        lastFetched: null,
      };
      
      setData(errorData);
    }
  }, [tenantId]);

  const invalidateCache = useCallback(() => {
    cachedData = null;
  }, []);

  return {
    ...data,
    fetchData,
    invalidateCache,
  };
};

// Hook para invalidar cache globalmente (útil após criar/editar serviço, cliente, etc.)
export const invalidateScheduleCache = () => {
  cachedData = null;
};