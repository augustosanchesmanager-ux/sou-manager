import { supabase, getScopedClient } from './supabaseClient';
import type { WaitlistEntry, CreateWaitlistInput, WaitlistStatus } from '../src/types/waitlist';

export const waitlistService = {
  async listWaitlist(tenantId: string, date?: string): Promise<WaitlistEntry[]> {
    if (!tenantId) return [];

    const client = getScopedClient('barber');
    let query = client
      .from('waitlist')
      .select(`
        id,
        tenant_id,
        client_id,
        service_id,
        preferred_staff_id,
        desired_date,
        start_time_range,
        end_time_range,
        status,
        notified_at,
        created_at,
        clients:client_id (name, phone),
        services:service_id (name),
        staff:preferred_staff_id (name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('desired_date', date);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[WAITLIST_SERVICE] Error listing waitlist:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      client_id: row.client_id,
      client_name: row.clients?.name || 'Cliente',
      client_phone: row.clients?.phone || null,
      service_id: row.service_id,
      service_name: row.services?.name || null,
      preferred_staff_id: row.preferred_staff_id,
      preferred_staff_name: row.staff?.name || null,
      desired_date: row.desired_date,
      start_time_range: row.start_time_range,
      end_time_range: row.end_time_range,
      status: row.status as WaitlistStatus,
      notified_at: row.notified_at,
      created_at: row.created_at,
    }));
  },

  async countWaiting(tenantId: string, date?: string): Promise<number> {
    if (!tenantId) return 0;
    const client = getScopedClient('barber');
    let query = client
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'waiting');

    if (date) {
      query = query.eq('desired_date', date);
    }

    const { count, error } = await query;
    if (error) {
      console.warn('[WAITLIST_SERVICE] Error counting waitlist:', error);
      return 0;
    }
    return count ?? 0;
  },

  async createEntry(tenantId: string, input: CreateWaitlistInput): Promise<WaitlistEntry> {
    if (!tenantId) throw new Error('Tenant ID obrigatório');

    const client = getScopedClient('barber');
    const { data, error } = await client
      .from('waitlist')
      .insert({
        tenant_id: tenantId,
        client_id: input.client_id,
        service_id: input.service_id || null,
        preferred_staff_id: input.preferred_staff_id || null,
        desired_date: input.desired_date,
        start_time_range: input.start_time_range || null,
        end_time_range: input.end_time_range || null,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      console.error('[WAITLIST_SERVICE] Error inserting waitlist entry:', error);
      throw error;
    }

    return data as WaitlistEntry;
  },

  async updateStatus(tenantId: string, id: string, status: WaitlistStatus): Promise<void> {
    if (!tenantId) throw new Error('Tenant ID obrigatório');

    const client = getScopedClient('barber');
    const updates: Record<string, any> = { status };
    if (status === 'notified') {
      updates.notified_at = new Date().toISOString();
    }

    const { error } = await client
      .from('waitlist')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[WAITLIST_SERVICE] Error updating waitlist status:', error);
      throw error;
    }
  },

  async deleteEntry(tenantId: string, id: string): Promise<void> {
    if (!tenantId) throw new Error('Tenant ID obrigatório');

    const client = getScopedClient('barber');
    const { error } = await client
      .from('waitlist')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[WAITLIST_SERVICE] Error deleting waitlist entry:', error);
      throw error;
    }
  },
};
