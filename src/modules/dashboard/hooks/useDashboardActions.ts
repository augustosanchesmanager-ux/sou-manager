import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { getClientForTable, requireTenantContext, supabase } from '../../../../services/supabaseClient';
import { generateIdempotencyKey } from '@/src/utils/idempotency';
import { logSupabaseError } from '../../../../domain/shared/errors';
import { appointmentApplicationService } from '../../../../application/appointment';
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

const fetchServiceSafe = async (servicesClient: any, serviceId: string, tenantId: string) => {
  const primaryRes = await servicesClient
    .from('services')
    .select('id, name, price, duration, active')
    .eq('tenant_id', tenantId)
    .eq('id', serviceId)
    .maybeSingle();

  if (!primaryRes.error && primaryRes.data) {
    return { data: primaryRes.data, error: null };
  }

  const legacyRes = await servicesClient
    .from('services')
    .select('id, name, price, duration_minutes, is_active')
    .eq('tenant_id', tenantId)
    .eq('id', serviceId)
    .maybeSingle();

  return legacyRes;
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
  const { appSlug, schema, tenantId, user } = useAuth();
  const [busyState, setBusyState] = useState<BusyState>(INITIAL_BUSY_STATE);
  const quickAppointmentLockRef = useRef(false);
  const quickAppointmentIdempotencyKeyRef = useRef<string | null>(null);

  const getDomainClient = useCallback(() => {
    if (!appSlug || !schema) return null;
    const { tenantId: resolvedTenantId } = requireTenantContext({
      tenantId,
      appSlug,
      schema,
      table: 'clients',
      operation: 'dashboard actions',
    });
    return { client: getClientForTable('clients', appSlug), resolvedTenantId };
  }, [appSlug, schema, tenantId]);

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
        const domainClientInfo = getDomainClient();
        if (!domainClientInfo) throw new Error('Cliente invalido para este ambiente.');
        const { client, resolvedTenantId } = domainClientInfo;

        const { data, error } = await client
          .from('clients')
          .insert({
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name)}&background=random`,
            tenant_id: resolvedTenantId,
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
    [getDomainClient, tenantId],
  );

  const createQuickAppointment = useCallback(
    async (payload: QuickAppointmentPayload) => {
      if (!tenantId) {
        throw new Error('Tenant invalido para criar agendamento.');
      }

      if (!payload.clientName.trim() || !payload.serviceId || !payload.staffId || !payload.startTime) {
        throw new Error('Preencha todos os campos.');
      }

      if (quickAppointmentLockRef.current) {
        throw new Error('Agendamento ja esta sendo criado. Aguarde alguns segundos.');
      }
      quickAppointmentLockRef.current = true;

      if (!quickAppointmentIdempotencyKeyRef.current) {
        quickAppointmentIdempotencyKeyRef.current = generateIdempotencyKey('quick-appt');
      }

      const idempotencyKey = quickAppointmentIdempotencyKeyRef.current;

      setBusyState((current) => ({ ...current, creatingQuickAppointment: true }));
      try {
        if (!appSlug || !schema) throw new Error('App context invalido');
        const { tenantId: resolvedTenantId } = requireTenantContext({
          tenantId,
          appSlug,
          schema,
          table: 'appointments',
          operation: 'create quick appointment',
        });

        const servicesClient = getClientForTable('services', appSlug);

        const [serviceRes, staffRes, clientRes] = await Promise.all([
          fetchServiceSafe(servicesClient, payload.serviceId, resolvedTenantId),
          supabase
            .from('staff')
            .select('id, name, status')
            .eq('tenant_id', resolvedTenantId)
            .eq('id', payload.staffId)
            .maybeSingle(),
          payload.clientId
            ? getClientForTable('clients', appSlug)
                .from('clients')
                .select('id, name, phone')
                .eq('tenant_id', resolvedTenantId)
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
        const servicePrice = Number(service.price || 0) || 0;

        console.log('[idempotency]', idempotencyKey);
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_appointment_with_comanda', {
          p_tenant_id: resolvedTenantId,
          p_client_id: payload.clientId || null,
          p_client_name: clientName,
          p_client_phone: client?.phone || null,
          p_service_id: payload.serviceId,
          p_staff_id: payload.staffId,
          p_start_time: startTime.toISOString(),
          p_price: servicePrice,
          p_notes: null,
          p_idempotency_key: idempotencyKey,
        });

        console.log('[createQuickAppointment] rpcResult:', rpcResult, 'rpcError:', rpcError);

        if (rpcError || !rpcResult) {
          logSupabaseError('[useDashboardActions] Erro createQuickAppointment RPC', rpcError || new Error('Erro ao criar agendamento.'), {
            serviceId: payload.serviceId,
            staffId: payload.staffId,
            clientId: payload.clientId,
          });
          throw rpcError || new Error('Erro ao criar agendamento.');
        }

        return normalizeQuickAppointmentResult(rpcResult);
      } finally {
        setBusyState((current) => ({ ...current, creatingQuickAppointment: false }));
        quickAppointmentLockRef.current = false;
        quickAppointmentIdempotencyKeyRef.current = null;
      }
    },
    [appSlug, schema, tenantId],
  );

  const updateAppointmentStatus = useCallback(
    async (id: string, status: 'cancelled' | 'completed') => {
      if (!tenantId) {
        throw new Error('Tenant invalido para atualizar agendamento.');
      }

      setBusyState((current) => ({ ...current, appointmentUpdateId: id }));
      try {
        if (!appSlug || !schema) throw new Error('App context invalido');
        const { tenantId: resolvedTenantId } = requireTenantContext({
          tenantId,
          appSlug,
          schema,
          table: 'appointments',
          operation: 'update appointment status',
        });
        const appointmentsClient = getClientForTable('appointments', appSlug);
        const { error } = await appointmentsClient.from('appointments').update({ status }).eq('id', id).eq('tenant_id', resolvedTenantId);
        if (error) {
          throw error;
        }
      } finally {
        setBusyState((current) => ({ ...current, appointmentUpdateId: null }));
      }
    },
    [appSlug, schema, tenantId],
  );

  const completeAppointment = useCallback(
    async (id: string) => {
      await updateAppointmentStatus(id, 'completed');
    },
    [updateAppointmentStatus],
  );

  const cancelAppointment = useCallback(
    async (id: string) => {
      if (!tenantId) {
        throw new Error('Tenant invalido para cancelar agendamento.');
      }

      setBusyState((current) => ({ ...current, appointmentUpdateId: id }));
      try {
        await appointmentApplicationService.cancelAppointment({
          tenantId,
          appointmentId: id,
          cancellationType: 'client_request',
          userId: user?.id ?? '',
        });
      } finally {
        setBusyState((current) => ({ ...current, appointmentUpdateId: null }));
      }
    },
    [tenantId, user?.id],
  );

  return {
    createClient,
    createQuickAppointment,
    completeAppointment,
    cancelAppointment,
    busyState,
  };
};
