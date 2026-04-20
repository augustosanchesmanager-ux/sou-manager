import { useCallback, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../services/supabaseClient';
import type {
  BusyState,
  DashboardClient,
  NewClientPayload,
  QuickAppointmentPayload,
  QuickAppointmentResult,
} from '../types';

const INITIAL_BUSY_STATE: BusyState = {
  creatingClient: false,
  creatingQuickAppointment: false,
  appointmentUpdateId: null,
};

const normalizeQuickAppointmentResult = (value: any): QuickAppointmentResult => {
  const result = Array.isArray(value) ? value[0] : value;

  return {
    appointment_id: result?.appointment_id || '',
    comanda_id: result?.comanda_id || '',
    comanda_item_id: result?.comanda_item_id || '',
    service_price: Number(result?.service_price || 0),
    appointment_status: result?.appointment_status || 'confirmed',
  };
};

export const useDashboardActions = () => {
  const { tenantId } = useAuth();
  const [busyState, setBusyState] = useState<BusyState>(INITIAL_BUSY_STATE);

  const createClient = useCallback(
    async (payload: NewClientPayload, options?: { existingClients?: DashboardClient[] }) => {
      if (!tenantId) {
        throw new Error('Tenant invalido para cadastrar cliente.');
      }

      const existingClient = options?.existingClients?.find(
        (client) => client.name.toLowerCase() === payload.name.toLowerCase() && client.phone === payload.phone,
      );
      if (existingClient) {
        throw new Error('Cliente ja existe!');
      }

      setBusyState((current) => ({ ...current, creatingClient: true }));
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name)}&background=random`,
            tenant_id: tenantId,
          })
          .select()
          .single();

        if (error || !data) {
          throw error || new Error('Erro ao cadastrar cliente.');
        }

        return data as DashboardClient;
      } finally {
        setBusyState((current) => ({ ...current, creatingClient: false }));
      }
    },
    [tenantId],
  );

  const createQuickAppointment = useCallback(
    async (payload: QuickAppointmentPayload) => {
      if (!tenantId) {
        throw new Error('Tenant invalido para criar agendamento.');
      }

      if (!payload.clientName.trim() || !payload.serviceId || !payload.staffId || !payload.startTime) {
        throw new Error('Preencha todos os campos.');
      }

      setBusyState((current) => ({ ...current, creatingQuickAppointment: true }));
      try {
        const { data, error } = await supabase.rpc('create_appointment_with_comanda', {
          p_tenant_id: tenantId,
          p_client_id: payload.clientId || null,
          p_client_name: payload.clientName.trim(),
          p_service_id: payload.serviceId,
          p_staff_id: payload.staffId,
          p_start_time: payload.startTime,
        });

        if (error || !data) {
          throw error || new Error('Erro ao criar agendamento.');
        }

        return normalizeQuickAppointmentResult(data);
      } finally {
        setBusyState((current) => ({ ...current, creatingQuickAppointment: false }));
      }
    },
    [tenantId],
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: 'cancelled' | 'completed') => {
      if (!tenantId) {
        throw new Error('Tenant invalido para atualizar agendamento.');
      }

      setBusyState((current) => ({ ...current, appointmentUpdateId: id }));
      try {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id).eq('tenant_id', tenantId);
        if (error) {
          throw error;
        }
      } finally {
        setBusyState((current) => ({ ...current, appointmentUpdateId: null }));
      }
    },
    [tenantId],
  );

  const completeAppointment = useCallback(
    async (id: string) => {
      await updateAppointmentStatus(id, 'completed');
    },
    [updateAppointmentStatus],
  );

  const cancelAppointment = useCallback(
    async (id: string) => {
      await updateAppointmentStatus(id, 'cancelled');
    },
    [updateAppointmentStatus],
  );

  return {
    createClient,
    createQuickAppointment,
    completeAppointment,
    cancelAppointment,
    busyState,
  };
};

