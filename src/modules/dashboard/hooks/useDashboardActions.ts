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

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getAppointmentDurationHours = (service: any) =>
  Math.round((toPositiveNumber(service?.duration ?? service?.duration_minutes, 30) / 60) * 10) / 10;

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
        const [serviceRes, staffRes, clientRes] = await Promise.all([
          supabase
            .from('services')
            .select('id, name, price, duration, duration_minutes, active, is_active')
            .eq('tenant_id', tenantId)
            .eq('id', payload.serviceId)
            .maybeSingle(),
          supabase
            .from('staff')
            .select('id, name, status')
            .eq('tenant_id', tenantId)
            .eq('id', payload.staffId)
            .maybeSingle(),
          payload.clientId
            ? supabase
              .from('clients')
              .select('id, name, phone')
              .eq('tenant_id', tenantId)
              .eq('id', payload.clientId)
              .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (serviceRes.error || !serviceRes.data) {
          throw serviceRes.error || new Error('Servico invalido para este tenant.');
        }

        if (staffRes.error || !staffRes.data) {
          throw staffRes.error || new Error('Profissional invalido para este tenant.');
        }

        if (clientRes.error) {
          throw clientRes.error;
        }

        const service = serviceRes.data;
        const staff = staffRes.data;
        const client = clientRes.data;
        const serviceIsActive =
          typeof service.active === 'boolean'
            ? service.active
            : typeof service.is_active === 'boolean'
              ? service.is_active
              : true;

        if (!serviceIsActive) {
          throw new Error('Servico inativo para este tenant.');
        }

        if (`${staff.status || 'active'}`.toLowerCase() !== 'active') {
          throw new Error('Profissional inativo para este tenant.');
        }

        const clientName = payload.clientName.trim() || client?.name?.trim() || '';
        if (!clientName) {
          throw new Error('Nome do cliente e obrigatorio.');
        }

        const startTime = new Date(payload.startTime);
        if (Number.isNaN(startTime.getTime())) {
          throw new Error('Horario do agendamento invalido.');
        }

        const duration = getAppointmentDurationHours(service);
        const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
        const servicePrice = Number(service.price || 0) || 0;

        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            tenant_id: tenantId,
            client_id: payload.clientId || null,
            service_id: payload.serviceId,
            staff_id: payload.staffId,
            client_name: clientName,
            client_phone: client?.phone || '',
            service_name: service.name,
            staff_name: staff.name,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration,
            price: servicePrice,
            status: 'confirmed',
          })
          .select('id, status')
          .single();

        if (appointmentError || !appointment) {
          throw appointmentError || new Error('Erro ao criar agendamento.');
        }

        const { data: comanda, error: comandaError } = await supabase
          .from('comandas')
          .insert({
            tenant_id: tenantId,
            appointment_id: appointment.id,
            client_id: payload.clientId || null,
            staff_id: payload.staffId,
            status: 'open',
            total: servicePrice,
          })
          .select('id')
          .single();

        if (comandaError || !comanda) {
          throw comandaError || new Error('Erro ao criar comanda do agendamento.');
        }

        const { data: comandaItem, error: comandaItemError } = await supabase
          .from('comanda_items')
          .insert({
            tenant_id: tenantId,
            comanda_id: comanda.id,
            service_id: payload.serviceId,
            product_name: service.name,
            quantity: 1,
            unit_price: servicePrice,
            staff_id: payload.staffId,
          })
          .select('id')
          .single();

        if (comandaItemError || !comandaItem) {
          throw comandaItemError || new Error('Erro ao criar item da comanda.');
        }

        return normalizeQuickAppointmentResult({
          appointment_id: appointment.id,
          comanda_id: comanda.id,
          comanda_item_id: comandaItem.id,
          service_price: servicePrice,
          appointment_status: appointment.status || 'confirmed',
        });
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
