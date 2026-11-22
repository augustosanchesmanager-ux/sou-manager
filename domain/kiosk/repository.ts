/**
 * [SMG][DOMAIN][KIOSK] repository
 *
 * RESPONSABILIDADE: Acesso a dados do módulo Kiosk (Totem + QR Code),
 * encapsulando consultas e mutações em tenants, tenant_addons,
 * kiosk_devices, kiosk_sessions, services, appointments,
 * feedback_barber e feedback_shop.
 */

import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { AppSlug } from '../shared/app';

export interface KioskTenantRecord {
  id: string;
  name: string | null;
  slug: string | null;
}

export interface KioskAddonRecord {
  status: 'enabled' | 'disabled';
  limits: {
    theme: string;
    max_devices: number;
    logo_url?: string;
    ambient_images?: string[];
    timeout_seconds?: number;
    [key: string]: any;
  } | null;
}

export interface KioskServiceRecord {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface KioskBookedSlot {
  start_time: string;
  end_time: string;
}

export interface KioskDeviceRecord {
  id: string;
  tenant_id?: string;
  name: string;
  theme: string;
  timeout_seconds: number;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface CreateKioskSessionInput {
  tenant_id: string;
  channel: 'totem' | 'qr';
  status: string;
  user_agent: string;
}

export interface SubmitBarberFeedbackInput {
  tenant_id: string;
  client_id: string;
  barber_id: string | null;
  session_id: string | null;
  rating: number;
  tags: string[];
  comment: string | null;
  source_channel: string;
}

export interface SubmitShopFeedbackInput {
  tenant_id: string;
  client_id: string;
  session_id: string | null;
  nps: number;
  reasons: string[];
  comment: string | null;
  marketing_opt_in: boolean;
  source_channel: string;
}

export interface CreateKioskAppointmentInput {
  tenant_id: string;
  client_id: string;
  staff_id: string | null;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  source: string;
  channel: string;
  notes: string;
}

export interface CreateKioskDeviceInput {
  tenant_id: string;
  name: string;
  theme: string;
  timeout_seconds: number;
  is_active: boolean;
}

export interface KioskAdminMetricsRaw {
  appointments: Array<{ channel: string | null }>;
  sessions: Array<{ status: string | null }>;
  barberFeedback: Array<{ rating: number | null }>;
  shopFeedback: Array<{ nps: number | null }>;
}

class KioskRepositoryImpl {
  constructor(private readonly appSlug: AppSlug = 'barber') {}

  private table(tableName: string) {
    return createSupabaseClient(tableName, this.appSlug).from(tableName);
  }

  async createSession(input: CreateKioskSessionInput): Promise<{ id: string } | null> {
    const { data } = await this.table('kiosk_sessions')
      .insert(input)
      .select('id')
      .single();
    return data ?? null;
  }

  async getTenantBySlug(slug: string): Promise<KioskTenantRecord | null> {
    const { data } = await this.table('tenants')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();
    return data ?? null;
  }

  async getTenantBySlugOrId(identifier: string): Promise<KioskTenantRecord | null> {
    const { data } = await this.table('tenants')
      .select('id, name, slug')
      .or(`slug.eq.${identifier},id.eq.${identifier}`)
      .single();
    return data ?? null;
  }

  async getTenantSlugById(tenantId: string): Promise<string | null> {
    const { data } = await this.table('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();
    return data?.slug ?? null;
  }

  async getTotemQrAddon(tenantId: string): Promise<KioskAddonRecord | null> {
    const { data } = await this.table('tenant_addons')
      .select('status, limits')
      .eq('tenant_id', tenantId)
      .eq('addon_key', 'TOTEM_QR')
      .single();
    return data ?? null;
  }

  async activateTotemQrAddon(tenantId: string, limits: Record<string, any>): Promise<void> {
    const { error } = await this.table('tenant_addons').upsert(
      {
        tenant_id: tenantId,
        addon_key: 'TOTEM_QR',
        status: 'enabled',
        activated_at: new Date().toISOString(),
        limits,
      },
      { onConflict: 'tenant_id,addon_key' }
    );
    if (error) throw error;
  }

  async disableTotemQrAddon(tenantId: string): Promise<void> {
    const { error } = await this.table('tenant_addons')
      .update({ status: 'disabled' })
      .eq('tenant_id', tenantId)
      .eq('addon_key', 'TOTEM_QR');
    if (error) throw error;
  }

  async updateTotemQrLimits(tenantId: string, limits: Record<string, any>): Promise<void> {
    await this.table('tenant_addons')
      .update({ limits })
      .eq('tenant_id', tenantId)
      .eq('addon_key', 'TOTEM_QR');
  }

  async listDevices(tenantId: string): Promise<KioskDeviceRecord[]> {
    const { data } = await this.table('kiosk_devices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async createDevice(input: CreateKioskDeviceInput): Promise<void> {
    await this.table('kiosk_devices').insert(input);
  }

  async toggleDeviceActive(deviceId: string, isActive: boolean): Promise<void> {
    await this.table('kiosk_devices')
      .update({ is_active: isActive })
      .eq('id', deviceId);
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.table('kiosk_devices').delete().eq('id', deviceId);
  }

  async getAdminMetricsRaw(tenantId: string): Promise<KioskAdminMetricsRaw> {
    const [apptResult, sessionResult, ratingResult, npsResult] = await Promise.all([
      this.table('appointments').select('channel').eq('tenant_id', tenantId).eq('source', 'kiosk'),
      this.table('kiosk_sessions').select('status').eq('tenant_id', tenantId),
      this.table('feedback_barber').select('rating').eq('tenant_id', tenantId),
      this.table('feedback_shop').select('nps').eq('tenant_id', tenantId),
    ]);

    return {
      appointments: apptResult.data || [],
      sessions: sessionResult.data || [],
      barberFeedback: ratingResult.data || [],
      shopFeedback: npsResult.data || [],
    };
  }

  async listActiveServices(tenantId: string): Promise<KioskServiceRecord[]> {
    const { data } = await this.table('services')
      .select('id, name, price, duration_minutes')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    return data || [];
  }

  async listBookedAppointmentSlots(
    tenantId: string,
    startIso: string,
    endIso: string,
    staffId?: string
  ): Promise<KioskBookedSlot[]> {
    let query = this.table('appointments')
      .select('start_time, end_time')
      .eq('tenant_id', tenantId)
      .gte('start_time', startIso)
      .lte('start_time', endIso)
      .in('status', ['confirmed', 'pending']);

    if (staffId) query = query.eq('staff_id', staffId);

    const { data } = await query;
    return data || [];
  }

  async createKioskAppointment(input: CreateKioskAppointmentInput): Promise<void> {
    await this.table('appointments').insert(input);
  }

  async submitBarberFeedback(input: SubmitBarberFeedbackInput): Promise<void> {
    await this.table('feedback_barber').insert(input);
  }

  async submitShopFeedback(input: SubmitShopFeedbackInput): Promise<void> {
    await this.table('feedback_shop').insert(input);
  }
}

export const kioskRepository = new KioskRepositoryImpl();
