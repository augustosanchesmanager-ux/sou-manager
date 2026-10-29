/**
 * [SMG][DOMAIN][TENANT_SETTINGS] repository
 *
 * RESPONSABILIDADE: Acesso a dados das tabelas tenant_settings,
 *   online_booking_settings e busca de produtos do tenant para vitrine.
 *   Operações: getByTenantId, upsert, updateWorkingHours,
 *              getOnlineBookingSettings, upsertOnlineBookingSettings,
 *              searchTenantProducts, getTenantProductsByIds.
 *
 * NÃO FAZ:
 *   - Criação do tenant (Application Service)
 *   - Ativação do tenant (usa RPC complete_onboarding)
 *   - Validações de negócio (Application Service)
 *
 * DEPENDÊNCIAS: Supabase via SupabaseRepository base
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient, createSharedSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type {
  TenantSettings,
  CreateTenantSettingsInput,
  OnlineBookingSettingsRecord,
  UpsertOnlineBookingSettingsInput,
  ShowcaseProductItem,
  BookingThemeMode,
} from './types';

export { RepositoryError } from '../shared/errors';

export const DEFAULT_BRAND_PRIMARY_COLOR = '#B88A44';

export const sanitizeBookingSlug = (raw: string): string => {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const sanitizeHexColor = (raw: string | null | undefined): string => {
  if (!raw) return DEFAULT_BRAND_PRIMARY_COLOR;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  return DEFAULT_BRAND_PRIMARY_COLOR;
};

const isTableNotFoundOrEmptyError = (err: unknown): { notFoundRow: boolean; missingTable: boolean } => {
  if (!err || typeof err !== 'object') {
    return { notFoundRow: false, missingTable: false };
  }
  const code = String((err as Record<string, unknown>).code ?? '');
  const message = String((err as Record<string, unknown>).message ?? '');
  const notFoundRow = code === 'PGRST116';
  const missingTable =
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('online_booking_settings') && (message.includes('does not exist') || message.includes('schema cache'));
  return { notFoundRow, missingTable };
};

const toTenantSettings = (row: Record<string, unknown>): TenantSettings => ({
  id: row.id as string,
  tenant_id: row.tenant_id as string,
  chair_count: (row.chair_count as number) ?? null,
  business_hours: (row.business_hours as TenantSettings['business_hours']) ?? null,
  phone: (row.phone as string) ?? null,
  cnpj: (row.cnpj as string) ?? null,
  address_street: (row.address_street as string) ?? null,
  address_number: (row.address_number as string) ?? null,
  address_city: (row.address_city as string) ?? null,
  address_state: (row.address_state as string) ?? null,
  address_zip: (row.address_zip as string) ?? null,
  timezone: (row.timezone as string) ?? 'America/Sao_Paulo',
  currency: (row.currency as string) ?? 'BRL',
  appointment_interval_minutes: (row.appointment_interval_minutes as number) ?? 30,
  default_appointment_duration_minutes: (row.default_appointment_duration_minutes as number) ?? 60,
  booking_horizon_days: (row.booking_horizon_days as number) ?? 30,
  staff_owned_schedule: (row.staff_owned_schedule as boolean) ?? true,
  work_start_time: (row.work_start_time as string) ?? null,
  work_end_time: (row.work_end_time as string) ?? null,
  booking_enabled: (row.booking_enabled as boolean) ?? null,
  instagram_url: (row.instagram_url as string) ?? null,
  whatsapp_number: (row.whatsapp_number as string) ?? null,
  maps_url: (row.maps_url as string) ?? null,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
});

const toOnlineBookingSettings = (row: Record<string, unknown>): OnlineBookingSettingsRecord => ({
  id: typeof row.id === 'string' ? row.id : undefined,
  tenant_id: String(row.tenant_id ?? ''),
  is_active: row.is_active !== undefined && row.is_active !== null ? Boolean(row.is_active) : true,
  display_name: typeof row.display_name === 'string' ? row.display_name : null,
  slug: typeof row.slug === 'string' ? row.slug : null,
  display_address: typeof row.display_address === 'string' ? row.display_address : null,
  logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
  cover_banner_url: typeof row.cover_banner_url === 'string' ? row.cover_banner_url : null,
  primary_color: sanitizeHexColor(typeof row.primary_color === 'string' ? row.primary_color : null),
  theme_mode: row.theme_mode === 'light' ? 'light' : 'dark',
  slogan: typeof row.slogan === 'string' ? row.slogan : null,
  about_text: typeof row.about_text === 'string' ? row.about_text : null,
  show_products: Boolean(row.show_products),
  featured_product_ids: Array.isArray(row.featured_product_ids)
    ? row.featured_product_ids.filter((id): id is string => typeof id === 'string')
    : [],
  featured_service_ids: Array.isArray(row.featured_service_ids)
    ? row.featured_service_ids.filter((id): id is string => typeof id === 'string')
    : [],
  phone_whatsapp: typeof row.phone_whatsapp === 'string' ? row.phone_whatsapp : null,
  instagram_url: typeof row.instagram_url === 'string' ? row.instagram_url : null,
  google_maps_url: typeof row.google_maps_url === 'string' ? row.google_maps_url : null,
  weekly_schedule:
    row.weekly_schedule && typeof row.weekly_schedule === 'object'
      ? (row.weekly_schedule as Record<string, unknown>)
      : null,
  automations_config:
    row.automations_config && typeof row.automations_config === 'object'
      ? (row.automations_config as Record<string, unknown>)
      : null,
  created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
  updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
});

const toShowcaseProductItem = (row: Record<string, unknown>): ShowcaseProductItem => ({
  id: String(row.id ?? ''),
  tenant_id: String(row.tenant_id ?? ''),
  name: String(row.name ?? row.commercial_name ?? ''),
  description: typeof row.description === 'string' ? row.description : null,
  sale_price: Number(row.sale_price ?? row.price ?? 0),
  image_url: typeof row.image_url === 'string' ? row.image_url : null,
  stock_quantity: Number(row.stock_quantity ?? 0),
  active: row.active !== undefined ? Boolean(row.active) : true,
});

const buildFallbackOnlineSettingsFromTenantSettings = (
  tenantId: string,
  ts: TenantSettings | null,
): OnlineBookingSettingsRecord | null => {
  if (!ts) return null;
  const bh = (ts.business_hours ?? {}) as Record<string, unknown>;
  const branding = (bh._branding ?? {}) as Record<string, unknown>;
  const composedAddress = [ts.address_street, ts.address_number, ts.address_city, ts.address_state]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

  return {
    tenant_id: tenantId,
    is_active: ts.booking_enabled ?? true,
    display_name: typeof branding.display_name === 'string' ? branding.display_name : null,
    slug: typeof branding.slug === 'string' ? branding.slug : null,
    display_address:
      typeof branding.display_address === 'string'
        ? branding.display_address
        : composedAddress || null,
    logo_url: typeof branding.logo_url === 'string' ? branding.logo_url : null,
    cover_banner_url:
      typeof branding.cover_banner_url === 'string'
        ? branding.cover_banner_url
        : typeof branding.cover_url === 'string'
          ? branding.cover_url
          : null,
    primary_color: sanitizeHexColor(
      typeof branding.primary_color === 'string' ? branding.primary_color : null,
    ),
    theme_mode: (branding.theme_mode === 'light' ? 'light' : 'dark') as BookingThemeMode,
    slogan: typeof branding.slogan === 'string' ? branding.slogan : null,
    about_text: typeof branding.about_text === 'string' ? branding.about_text : null,
    show_products: Boolean(branding.show_products),
    featured_product_ids: Array.isArray(branding.featured_product_ids)
      ? branding.featured_product_ids.filter((id): id is string => typeof id === 'string')
      : [],
    featured_service_ids: Array.isArray(branding.featured_service_ids)
      ? branding.featured_service_ids.filter((id): id is string => typeof id === 'string')
      : [],
    phone_whatsapp: ts.whatsapp_number ?? null,
    instagram_url: ts.instagram_url ?? null,
    google_maps_url: ts.maps_url ?? null,
    weekly_schedule: bh,
    automations_config: null,
  };
};

class TenantSettingsRepositoryImpl extends SupabaseRepository {
  private readonly sharedDb: DatabaseClient;
  private readonly productsDb: DatabaseClient;

  constructor(db?: DatabaseClient) {
    const resolvedDb = db ?? createSupabaseClient('tenant_settings', 'barber');
    super('tenant_settings', resolvedDb);
    this.sharedDb = db ?? createSharedSupabaseClient();
    this.productsDb = db ?? createSupabaseClient('products', 'barber');
  }

  async getByTenantId(tenantId: string): Promise<TenantSettings | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData(result, 'Erro ao buscar configurações do tenant');
      return data ? toTenantSettings(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'PGRST116') {
        return null;
      }
      this.throwOnError(err, 'Erro ao buscar configurações do tenant');
    }
  }

  async upsert(input: CreateTenantSettingsInput): Promise<TenantSettings> {
    try {
      const result = await this.from()
        .upsert({
          tenant_id: input.tenant_id,
          chair_count: input.chair_count ?? null,
          business_hours: input.business_hours ?? null,
          phone: input.phone ?? null,
          cnpj: input.cnpj ?? null,
          address_street: input.address_street ?? null,
          address_number: input.address_number ?? null,
          address_city: input.address_city ?? null,
          address_state: input.address_state ?? null,
          address_zip: input.address_zip ?? null,
          timezone: input.timezone ?? 'America/Sao_Paulo',
          currency: input.currency ?? 'BRL',
          appointment_interval_minutes: input.appointment_interval_minutes ?? 30,
          default_appointment_duration_minutes: input.default_appointment_duration_minutes ?? 60,
          booking_horizon_days: input.booking_horizon_days ?? 30,
          staff_owned_schedule: input.staff_owned_schedule ?? true,
        }, { onConflict: 'tenant_id' })
        .select()
        .single();
      const data = this.extractData(result, 'Erro ao salvar configurações do tenant');
      return toTenantSettings(data as Record<string, unknown>);
    } catch (err) {
      this.throwOnError(err, 'Erro ao salvar configurações do tenant');
    }
  }

  async updateWorkingHours(
    tenantId: string,
    hours: {
      work_start_time: string;
      work_end_time: string;
      booking_enabled?: boolean;
      instagram_url?: string | null;
      whatsapp_number?: string | null;
      maps_url?: string | null;
      business_hours?: TenantSettings['business_hours'] | Record<string, unknown>;
    }
  ): Promise<TenantSettings> {
    if (!tenantId || !tenantId.trim()) {
      throw new Error('Identificador do tenant é obrigatório para atualizar as configurações.');
    }

    try {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        work_start_time: hours.work_start_time,
        work_end_time: hours.work_end_time,
        booking_enabled: hours.booking_enabled ?? true,
        updated_at: new Date().toISOString(),
      };

      if (hours.instagram_url !== undefined) {
        payload.instagram_url = hours.instagram_url;
      }
      if (hours.whatsapp_number !== undefined) {
        payload.whatsapp_number = hours.whatsapp_number;
      }
      if (hours.maps_url !== undefined) {
        payload.maps_url = hours.maps_url;
      }
      if (hours.business_hours !== undefined) {
        payload.business_hours = hours.business_hours;
      }

      const result = await this.from()
        .upsert(payload, { onConflict: 'tenant_id' })
        .select()
        .single();
      const data = this.extractData(result, 'Erro ao salvar configurações de agendamento');
      return toTenantSettings(data as Record<string, unknown>);
    } catch (err) {
      this.throwOnError(err, 'Erro ao salvar configurações de agendamento');
    }
  }

  async getOnlineBookingSettings(tenantId: string): Promise<OnlineBookingSettingsRecord | null> {
    if (!tenantId || !tenantId.trim()) {
      return null;
    }

    const legacySettings = await this.getByTenantId(tenantId);
    const fallback = buildFallbackOnlineSettingsFromTenantSettings(tenantId, legacySettings);

    try {
      const obsQuery = (this.sharedDb.from('online_booking_settings') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      const result = await obsQuery;
      if (result.error) {
        const { notFoundRow, missingTable } = isTableNotFoundOrEmptyError(result.error);
        if (notFoundRow || missingTable) {
          return fallback;
        }
        this.throwOnError(result.error, 'Erro ao buscar configurações da vitrine online');
      }

      if (!result.data) {
        return fallback;
      }

      const parsed = toOnlineBookingSettings(result.data as Record<string, unknown>);

      // Merge fallback fields if table row has empty schedule/social links
      if (fallback) {
        return {
          ...parsed,
          display_address: parsed.display_address ?? fallback.display_address,
          logo_url: parsed.logo_url ?? fallback.logo_url,
          cover_banner_url: parsed.cover_banner_url ?? fallback.cover_banner_url,
          slogan: parsed.slogan ?? fallback.slogan,
          about_text: parsed.about_text ?? fallback.about_text,
          phone_whatsapp: parsed.phone_whatsapp ?? fallback.phone_whatsapp,
          instagram_url: parsed.instagram_url ?? fallback.instagram_url,
          google_maps_url: parsed.google_maps_url ?? fallback.google_maps_url,
          weekly_schedule: parsed.weekly_schedule ?? fallback.weekly_schedule,
        };
      }

      return parsed;
    } catch (err) {
      const { notFoundRow, missingTable } = isTableNotFoundOrEmptyError(err);
      if (notFoundRow || missingTable) {
        return fallback;
      }
      this.throwOnError(err, 'Erro ao buscar configurações da vitrine online');
    }
  }

  async upsertOnlineBookingSettings(
    input: UpsertOnlineBookingSettingsInput
  ): Promise<OnlineBookingSettingsRecord> {
    if (!input.tenant_id || !input.tenant_id.trim()) {
      throw new Error('Identificador do tenant é obrigatório para salvar as configurações.');
    }

    const sanitizedSlug = input.slug ? sanitizeBookingSlug(input.slug) : null;
    const sanitizedColor = sanitizeHexColor(input.primary_color);
    const themeMode: BookingThemeMode = input.theme_mode === 'light' ? 'light' : 'dark';
    const featuredProductIds = Array.isArray(input.featured_product_ids)
      ? input.featured_product_ids
      : [];
    const featuredServiceIds = Array.isArray(input.featured_service_ids)
      ? input.featured_service_ids
      : [];

    // Mirror branding & showcase metadata inside business_hours for full compatibility
    const businessHoursPayload: Record<string, unknown> = {
      ...(input.weekly_schedule ?? {}),
      _branding: {
        display_name: input.display_name?.trim() || null,
        slug: sanitizedSlug || null,
        display_address: input.display_address?.trim() || null,
        cover_url: input.cover_banner_url?.trim() || null,
        cover_banner_url: input.cover_banner_url?.trim() || null,
        logo_url: input.logo_url?.trim() || null,
        primary_color: sanitizedColor,
        theme_mode: themeMode,
        slogan: input.slogan?.trim() || null,
        about_text: input.about_text?.trim() || null,
        show_products: Boolean(input.show_products),
        featured_product_ids: featuredProductIds,
        featured_service_ids: featuredServiceIds,
      },
    };

    // 1. Keep tenant_settings synchronized for slots & legacy readers
    await this.updateWorkingHours(input.tenant_id, {
      work_start_time: input.work_start_time ?? '08:00:00',
      work_end_time: input.work_end_time ?? '20:00:00',
      booking_enabled: input.is_active,
      instagram_url: input.instagram_url ?? null,
      whatsapp_number: input.phone_whatsapp ?? null,
      maps_url: input.google_maps_url ?? null,
      business_hours: businessHoursPayload,
    });

    // 2. Upsert into online_booking_settings
    const obsPayload: Record<string, unknown> = {
      tenant_id: input.tenant_id,
      is_active: input.is_active,
      display_name: input.display_name?.trim() || null,
      slug: sanitizedSlug || null,
      display_address: input.display_address?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      cover_banner_url: input.cover_banner_url?.trim() || null,
      primary_color: sanitizedColor,
      theme_mode: themeMode,
      slogan: input.slogan?.trim() || null,
      about_text: input.about_text?.trim() || null,
      show_products: Boolean(input.show_products),
      featured_product_ids: featuredProductIds,
      featured_service_ids: featuredServiceIds,
      phone_whatsapp: input.phone_whatsapp ?? null,
      instagram_url: input.instagram_url ?? null,
      google_maps_url: input.google_maps_url ?? null,
      weekly_schedule: businessHoursPayload,
      automations_config: input.automations_config ?? {
        reminders_24h_2h: true,
        reactive_waitlist: true,
      },
      updated_at: new Date().toISOString(),
    };

    try {
      const result = await (this.sharedDb.from('online_booking_settings') as any)
        .upsert(obsPayload, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (result.error) {
        const { missingTable } = isTableNotFoundOrEmptyError(result.error);
        if (missingTable) {
          return toOnlineBookingSettings(obsPayload);
        }
        const errCode = String((result.error as { code?: string }).code ?? '');
        if (errCode === '23505') {
          throw new Error('Este identificador (slug) já está em uso por outra barbearia. Escolha outro.');
        }
        this.throwOnError(result.error, 'Erro ao salvar configurações da vitrine online');
      }

      return toOnlineBookingSettings((result.data ?? obsPayload) as Record<string, unknown>);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Este identificador (slug)')) {
        throw err;
      }
      const { missingTable } = isTableNotFoundOrEmptyError(err);
      if (missingTable) {
        return toOnlineBookingSettings(obsPayload);
      }
      this.throwOnError(err, 'Erro ao salvar configurações da vitrine online');
    }
  }

  async searchTenantProducts(tenantId: string, searchQuery = ''): Promise<ShowcaseProductItem[]> {
    if (!tenantId || !tenantId.trim()) {
      return [];
    }

    try {
      let queryBuilder = (this.productsDb.from('products') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name', { ascending: true });

      const trimmedQuery = searchQuery.trim();
      if (trimmedQuery && typeof queryBuilder.ilike === 'function') {
        queryBuilder = queryBuilder.ilike('name', `%${trimmedQuery}%`);
      }

      const result = await queryBuilder;
      const rows = this.extractData<Record<string, unknown>[]>(
        result,
        'Erro ao buscar produtos do catálogo',
      );
      const mapped = (rows ?? []).map(toShowcaseProductItem);

      // Client-side filter fallback for local demo client when ilike is not emulated
      if (trimmedQuery) {
        const lower = trimmedQuery.toLowerCase();
        return mapped.filter(
          (item) =>
            item.name.toLowerCase().includes(lower) ||
            Boolean(item.description?.toLowerCase().includes(lower)),
        );
      }

      return mapped;
    } catch (err) {
      this.throwOnError(err, 'Erro ao buscar produtos do catálogo');
    }
  }

  async getTenantProductsByIds(
    tenantId: string,
    productIds: string[],
  ): Promise<ShowcaseProductItem[]> {
    if (!tenantId || !tenantId.trim() || productIds.length === 0) {
      return [];
    }

    try {
      const allProducts = await this.searchTenantProducts(tenantId, '');
      const byId = new Map<string, ShowcaseProductItem>();
      allProducts.forEach((p) => byId.set(p.id, p));

      return productIds
        .map((id) => byId.get(id))
        .filter((item): item is ShowcaseProductItem => Boolean(item));
    } catch (err) {
      this.throwOnError(err, 'Erro ao carregar produtos selecionados da vitrine');
    }
  }
}

export interface TenantSettingsRepository {
  getByTenantId(tenantId: string): Promise<TenantSettings | null>;
  upsert(input: CreateTenantSettingsInput): Promise<TenantSettings>;
  updateWorkingHours(
    tenantId: string,
    hours: {
      work_start_time: string;
      work_end_time: string;
      booking_enabled?: boolean;
      instagram_url?: string | null;
      whatsapp_number?: string | null;
      maps_url?: string | null;
      business_hours?: TenantSettings['business_hours'] | Record<string, unknown>;
    }
  ): Promise<TenantSettings>;
  getOnlineBookingSettings(tenantId: string): Promise<OnlineBookingSettingsRecord | null>;
  upsertOnlineBookingSettings(
    input: UpsertOnlineBookingSettingsInput
  ): Promise<OnlineBookingSettingsRecord>;
  searchTenantProducts(tenantId: string, searchQuery?: string): Promise<ShowcaseProductItem[]>;
  getTenantProductsByIds(tenantId: string, productIds: string[]): Promise<ShowcaseProductItem[]>;
}

export const tenantSettingsRepository: TenantSettingsRepository = new TenantSettingsRepositoryImpl();
