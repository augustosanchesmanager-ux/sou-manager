/**
 * recurringScheduleService.ts
 * Serviço de infraestrutura para persistência e gestão de agendamentos recorrentes (Cadeira Cativa).
 * Localizado em src/modules/ para respeitar as regras do Architecture Guard.
 */

import { getClientForTable } from '../../../services/supabaseClient';

export interface CativaAppointmentInsertRow {
  tenant_id: string;
  client_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  service_ids?: string[] | null;
  service_names?: string[] | null;
  start_time: string;
  end_time: string;
  duration: number;
  total_price?: number;
  price?: number;
  status: 'pending' | 'confirmed' | string;
  is_recurring: boolean;
  notes?: string;
}

export const recurringScheduleService = {
  /**
   * 1. Insere em lote as datas futuras projetadas da série da Cadeira Cativa.
   */
  async insertProjectedAppointments(
    rows: CativaAppointmentInsertRow[],
    appSlug: any = 'barber'
  ): Promise<void> {
    if (!rows || rows.length === 0) return;

    const client = getClientForTable('appointments', appSlug);
    const { error } = await client.from('appointments').insert(rows as any);

    if (error) {
      console.error('[SMG][RECURRING_SCHEDULE] Erro ao inserir projeção de agendamentos:', error);
      throw new Error(`Erro ao salvar datas da cadeira cativa: ${error.message}`);
    }
  },

  /**
   * 2. Confirma a presença da semana para um agendamento de Cadeira Cativa (status -> 'confirmed').
   */
  async confirmCativaAppointment(
    tenantId: string,
    appointmentId: string,
    appSlug: any = 'barber'
  ): Promise<boolean> {
    if (!tenantId || !appointmentId) return false;

    const client = getClientForTable('appointments', appSlug);
    const { error } = await client
      .from('appointments')
      .update({
        status: 'confirmed',
        notes: 'Cadeira Cativa Confirmada',
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[SMG][RECURRING_SCHEDULE] Erro ao confirmar cadeira cativa:', error);
      return false;
    }
    return true;
  },

  /**
   * 3. Libera o horário da semana sem cancelar as demais semanas da série (status -> 'cancelled').
   */
  async releaseCativaAppointment(
    tenantId: string,
    appointmentId: string,
    appSlug: any = 'barber'
  ): Promise<boolean> {
    if (!tenantId || !appointmentId) return false;

    const client = getClientForTable('appointments', appSlug);
    const { error } = await client
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Liberado pelo cliente nesta semana',
        cancellation_type: 'client_request',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[SMG][RECURRING_SCHEDULE] Erro ao liberar horário da semana:', error);
      return false;
    }
    return true;
  },
};
