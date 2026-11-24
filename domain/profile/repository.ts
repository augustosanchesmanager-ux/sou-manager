/**
 * [SMG][DOMAIN][PROFILE] repository
 *
 * RESPONSABILIDADE: Gerencia perfis, solicitações de acesso, audit_logs
 *   e consultas administrativas/cross-tenant (Admin e SuperAdmin).
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 *   - DatabaseClient injetado via construtor (testável sem Supabase)
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSharedSupabaseClient, createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AppSlug } from '../shared/app';

export { RepositoryError } from '../shared/errors';

export type ProfileStatus = 'active' | 'pending' | 'suspended';

export interface ProfileAdminRow {
  id: string;
  tenant_id: string | null;
  full_name: string | null;
  email?: string | null;
  role: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ProfileBasicRow {
  id: string;
  tenant_id: string | null;
  created_at: string;
}

export interface PendingProfileRow {
  id: string;
  tenant_id: string | null;
  created_at: string;
  status: string;
}

export interface ShopProfileRow {
  id: string;
  tenant_id: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
  tenants?: { plan?: string | null } | null;
}

export interface TenantAdminRow {
  id: string;
  name: string;
  slug: string;
  plan?: string | null;
  status: string;
  created_at: string;
}

export interface PlanChangeRequestRow {
  id: string;
  user_id: string;
  current_plan: string | null;
  requested_plan: string | null;
  status: string;
  created_at: string;
}

export interface AlertAdminRow {
  id: string;
  resource_type: string;
  message: string;
  level: string;
  usage_pct: number | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
  tenant_id: string | null;
}

export interface AccessRequestRow {
  id: string;
  tenant_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

export interface StaffAdminBasicRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  tenant_id: string;
  created_at: string;
}

export interface CrossTenantTransactionRow {
  id: string;
  type: string;
  amount: number;
  date: string;
  tenant_id: string | null;
}

class ProfileRepositoryImpl extends SupabaseRepository {
  private readonly appSlug: AppSlug;
  private readonly hasInjectedDb: boolean;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('profiles', db ?? createSharedSupabaseClient());
    this.appSlug = appSlug;
    this.hasInjectedDb = Boolean(db);
  }

  private domainDb(table: string): DatabaseClient {
    return this.hasInjectedDb ? this.db : createSupabaseClient(table, this.appSlug);
  }

  async countProfiles(): Promise<number> {
    try {
      const result = await this.from()
        .select('id', { count: 'exact', head: true });
      if (result.error) {
        this.extractData(result, 'Erro ao contar perfis');
      }
      return result.count ?? 0;
    } catch (err) {
      this.throwOnError(err, 'Erro ao contar perfis');
    }
  }

  async listAllProfiles(limit = 200): Promise<ProfileAdminRow[]> {
    try {
      const result = await this.from()
        .select('id, tenant_id, full_name, email, role, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      return this.extractData<ProfileAdminRow[]>(result, 'Erro ao listar perfis') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar perfis');
    }
  }

  async listProfilesBasic(): Promise<ProfileBasicRow[]> {
    try {
      const result = await this.from()
        .select('id, tenant_id, created_at');
      return this.extractData<ProfileBasicRow[]>(result, 'Erro ao listar perfis básicos') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar perfis básicos');
    }
  }

  async listShopsWithPlan(): Promise<ShopProfileRow[]> {
    try {
      const result = await this.from()
        .select('id, tenant_id, onboarding_completed, created_at, tenants(plan)')
        .order('created_at', { ascending: false });
      return this.extractData<ShopProfileRow[]>(result, 'Erro ao listar barbearias') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar barbearias');
    }
  }

  async listPendingProfiles(): Promise<PendingProfileRow[]> {
    try {
      const result = await this.from()
        .select('id, tenant_id, created_at, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return this.extractData<PendingProfileRow[]>(result, 'Erro ao listar cadastros pendentes') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar cadastros pendentes');
    }
  }

  async updateProfileStatus(id: string, status: ProfileStatus): Promise<void> {
    try {
      const result = await this.from()
        .update({ status })
        .eq('id', id);
      this.extractData(result, 'Erro ao atualizar status do perfil');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status do perfil');
    }
  }

  async listTenants(limit = 200): Promise<TenantAdminRow[]> {
    try {
      const result = await this.db
        .from('tenants')
        .select('id, name, slug, plan, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      return this.extractData<TenantAdminRow[]>(result, 'Erro ao listar empresas') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar empresas');
    }
  }

  async listAccessRequests(limit = 100): Promise<AccessRequestRow[]> {
    try {
      const result = await this.db
        .from('access_requests')
        .select('id, tenant_name, owner_name, email, phone, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      return this.extractData<AccessRequestRow[]>(result, 'Erro ao listar solicitações de acesso') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar solicitações de acesso');
    }
  }

  async listAuditLogs(limit = 100): Promise<AuditLogRow[]> {
    try {
      const result = await this.db
        .from('audit_logs')
        .select('id, table_name, record_id, action, old_data, new_data, changed_by, changed_at, tenant_id')
        .order('changed_at', { ascending: false })
        .limit(limit);
      return this.extractData<AuditLogRow[]>(result, 'Erro ao listar logs de auditoria') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar logs de auditoria');
    }
  }

  async listPlanChangeRequests(limit = 100): Promise<PlanChangeRequestRow[]> {
    try {
      const result = await this.db
        .from('plan_change_requests')
        .select('id, user_id, current_plan, requested_plan, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      return this.extractData<PlanChangeRequestRow[]>(result, 'Erro ao listar solicitações de plano') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar solicitações de plano');
    }
  }

  async listAlerts(limit = 100): Promise<AlertAdminRow[]> {
    try {
      const result = await this.db
        .from('alerts')
        .select('id, resource_type, message, level, usage_pct, resolved_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      return this.extractData<AlertAdminRow[]>(result, 'Erro ao listar alertas') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar alertas');
    }
  }

  async countAllStaff(): Promise<number> {
    try {
      const result = await this.db
        .from('staff')
        .select('id', { count: 'exact', head: true });
      if (result.error) {
        this.extractData(result, 'Erro ao contar equipe');
      }
      return result.count ?? 0;
    } catch (err) {
      this.throwOnError(err, 'Erro ao contar equipe');
    }
  }

  async listStaffTenantIds(tenantIds: string[]): Promise<Array<{ tenant_id: string }>> {
    if (tenantIds.length === 0) return [];
    try {
      const result = await this.db
        .from('staff')
        .select('tenant_id')
        .in('tenant_id', tenantIds);
      return this.extractData<Array<{ tenant_id: string }>>(result, 'Erro ao listar equipe por tenant') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar equipe por tenant');
    }
  }

  async listAllStaffBasic(): Promise<StaffAdminBasicRow[]> {
    try {
      const result = await this.db
        .from('staff')
        .select('id, name, email, role, status, tenant_id, created_at');
      return this.extractData<StaffAdminBasicRow[]>(result, 'Erro ao listar usuários da equipe') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar usuários da equipe');
    }
  }

  async countClientsByTenant(tenantId: string): Promise<number> {
    try {
      const result = await this.domainDb('clients')
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (result.error) {
        this.extractData(result, 'Erro ao contar clientes do tenant');
      }
      return result.count ?? 0;
    } catch (err) {
      this.throwOnError(err, 'Erro ao contar clientes do tenant');
    }
  }

  async countAppointmentsByTenant(tenantId: string): Promise<number> {
    try {
      const result = await this.domainDb('appointments')
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (result.error) {
        this.extractData(result, 'Erro ao contar agendamentos do tenant');
      }
      return result.count ?? 0;
    } catch (err) {
      this.throwOnError(err, 'Erro ao contar agendamentos do tenant');
    }
  }

  async sumAllIncomeTransactions(): Promise<number> {
    try {
      const result = await this.domainDb('transactions')
        .from('transactions')
        .select('amount')
        .eq('type', 'income');
      const rows = this.extractData<Array<{ amount: number | null }>>(result, 'Erro ao somar receitas') ?? [];
      return rows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } catch (err) {
      this.throwOnError(err, 'Erro ao somar receitas');
    }
  }

  async listIncomeTransactionsByTenants(tenantIds: string[]): Promise<Array<{ tenant_id: string; amount: number | null }>> {
    if (tenantIds.length === 0) return [];
    try {
      const result = await this.domainDb('transactions')
        .from('transactions')
        .select('tenant_id, amount')
        .in('tenant_id', tenantIds)
        .eq('type', 'income');
      return this.extractData<Array<{ tenant_id: string; amount: number | null }>>(result, 'Erro ao listar receitas por tenant') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar receitas por tenant');
    }
  }

  async listRecentTransactionsCrossTenant(limit = 500): Promise<CrossTenantTransactionRow[]> {
    try {
      const result = await this.domainDb('transactions')
        .from('transactions')
        .select('id, type, amount, date, tenant_id')
        .order('date', { ascending: false })
        .limit(limit);
      return this.extractData<CrossTenantTransactionRow[]>(result, 'Erro ao listar transações recentes') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar transações recentes');
    }
  }

  async superadminUpdateTenantStatus(
    tenantId: string,
    status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled',
    reason?: string
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.db.rpc('superadmin_update_tenant_status', {
        p_tenant_id: tenantId,
        p_status: status,
        p_reason: reason ?? null,
      });
      return this.extractData<Record<string, unknown>>(result, 'Erro ao atualizar status da empresa') ?? {};
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status da empresa');
    }
  }

  async superadminExtendTenantTrial(
    tenantId: string,
    extraDays: number
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.db.rpc('superadmin_extend_tenant_trial', {
        p_tenant_id: tenantId,
        p_extra_days: extraDays,
      });
      return this.extractData<Record<string, unknown>>(result, 'Erro ao estender trial da empresa') ?? {};
    } catch (err) {
      this.throwOnError(err, 'Erro ao estender trial da empresa');
    }
  }

  async superadminChangeTenantPlan(
    tenantId: string,
    targetPlan: 'free' | 'pro' | 'premium'
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.db.rpc('superadmin_change_tenant_plan', {
        p_tenant_id: tenantId,
        p_target_plan: targetPlan,
      });
      return this.extractData<Record<string, unknown>>(result, 'Erro ao alterar plano da empresa') ?? {};
    } catch (err) {
      this.throwOnError(err, 'Erro ao alterar plano da empresa');
    }
  }

  async superadminDecideProfileStatus(
    profileId: string,
    status: ProfileStatus
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.db.rpc('superadmin_decide_profile_status', {
        p_profile_id: profileId,
        p_status: status,
      });
      return this.extractData<Record<string, unknown>>(result, 'Erro ao atualizar status do usuário') ?? {};
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status do usuário');
    }
  }

  async superadminRespondSupportTicket(
    ticketId: string,
    response: string,
    status: 'open' | 'responded' | 'closed' = 'responded'
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.db.rpc('superadmin_respond_support_ticket', {
        p_ticket_id: ticketId,
        p_response: response,
        p_status: status,
      });
      return this.extractData<Record<string, unknown>>(result, 'Erro ao responder ticket de suporte') ?? {};
    } catch (err) {
      this.throwOnError(err, 'Erro ao responder ticket de suporte');
    }
  }
}

export const profileRepository = new ProfileRepositoryImpl();
export { ProfileRepositoryImpl };
