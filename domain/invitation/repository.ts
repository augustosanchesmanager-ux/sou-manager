/**
 * [SMG][DOMAIN][INVITATION] repository
 *
 * RESPONSABILIDADE: Gerencia o agregado Invitation (tabela team_invitations).
 *   Todas as escritas acontecem via RPC SECURITY DEFINER (padrao user_tenants):
 *     - invite_team_member  (valida chamador + D2 role + D3 limite por plano)
 *     - accept_invite       (cria profiles + staff + user_tenants atomicamente)
 *     - revoke_invite       (marca revoked)
 *     - resend_invite       (rotaciona token + renova expiracao)
 *     - list_team_invitations (lista do tenant, sem token)
 *     - list_invites_for_current_user (convites pendentes do usuario)
 *   Leitura publica via get_invite_by_token (sem auth).
 *
 * NÃO FAZ:
 *   - Validações de negócio (Application Service)
 *   - Envio de email (Edge Function invite-team-member)
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type {
  AcceptInviteResult,
  Invitation,
  InviteForUser,
  InvitePublic,
  InviteRole,
  InvitationView,
} from './types';

export { RepositoryError } from '../shared/errors';

const toInvitation = (row: Record<string, unknown>): Invitation => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  email: row.email as string,
  role: row.role as InviteRole,
  status: row.status as Invitation['status'],
  token: row.token as string,
  expiresAt: row.expires_at as string,
  invitedBy: (row.invited_by as string) ?? null,
  acceptedAt: (row.accepted_at as string) ?? null,
  resendCount: (row.resend_count as number) || 0,
  createdAt: row.created_at as string,
});

const toInvitationView = (row: Record<string, unknown>): InvitationView => ({
  id: row.id as string,
  email: row.email as string,
  role: row.role as InviteRole,
  status: row.status as InvitationView['status'],
  expiresAt: row.expires_at as string,
  resendCount: (row.resend_count as number) || 0,
  invitedBy: (row.invited_by as string) ?? null,
  createdAt: row.created_at as string,
  acceptedAt: (row.accepted_at as string) ?? null,
});

const toInvitePublic = (row: Record<string, unknown>): InvitePublic => ({
  id: row.id as string,
  email: row.email as string,
  role: row.role as InviteRole,
  status: row.status as InvitePublic['status'],
  expiresAt: row.expires_at as string,
  tenantId: row.tenant_id as string,
  tenantName: row.tenant_name as string,
  tenantSlug: row.tenant_slug as string,
});

export interface CreateInviteInput {
  tenantId: string;
  email: string;
  role: InviteRole;
}

export interface InvitationRepository {
  create(input: CreateInviteInput): Promise<Invitation>;
  getByToken(token: string): Promise<InvitePublic | null>;
  accept(token: string, firstName: string, lastName: string): Promise<AcceptInviteResult>;
  revoke(invitationId: string): Promise<void>;
  resend(invitationId: string): Promise<Invitation>;
  listForTenant(): Promise<InvitationView[]>;
  listForCurrentUser(): Promise<InviteForUser[]>;
}

class InvitationRepositoryImpl extends SupabaseRepository implements InvitationRepository {
  constructor(db?: DatabaseClient) {
    super('team_invitations', db ?? createSupabaseClient('team_invitations', 'barber'));
  }

  async create(input: CreateInviteInput): Promise<Invitation> {
    try {
      const result = await this.db.rpc('invite_team_member', {
        p_tenant_id: input.tenantId,
        p_email: input.email,
        p_role: input.role,
      });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown>>(
        result,
        'Erro ao criar convite',
      );
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw this.requireData(null as never, 'Erro ao criar convite');
      return toInvitation(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao criar convite');
    }
  }

  async getByToken(token: string): Promise<InvitePublic | null> {
    try {
      const result = await this.db.rpc('get_invite_by_token', { p_token: token });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown> | null>(
        result,
        'Erro ao buscar convite',
      );
      if (!data) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? toInvitePublic(row) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar convite');
    }
  }

  async accept(token: string, firstName: string, lastName: string): Promise<AcceptInviteResult> {
    try {
      const result = await this.db.rpc('accept_invite', {
        p_token: token,
        p_first_name: firstName,
        p_last_name: lastName,
      });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown>>(
        result,
        'Erro ao aceitar convite',
      );
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw this.requireData(null as never, 'Erro ao aceitar convite');
      return {
        tenantId: row.tenant_id as string,
        role: row.role as InviteRole,
        staffId: row.staff_id as string,
      };
    } catch (err) {
      this.throwOnError(err, 'Erro ao aceitar convite');
    }
  }

  async revoke(invitationId: string): Promise<void> {
    try {
      const result = await this.db.rpc('revoke_invite', { p_invitation_id: invitationId });
      this.extractData(result, 'Erro ao revogar convite');
    } catch (err) {
      this.throwOnError(err, 'Erro ao revogar convite');
    }
  }

  async resend(invitationId: string): Promise<Invitation> {
    try {
      const result = await this.db.rpc('resend_invite', { p_invitation_id: invitationId });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown>>(
        result,
        'Erro ao reenviar convite',
      );
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw this.requireData(null as never, 'Erro ao reenviar convite');
      return toInvitation(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao reenviar convite');
    }
  }

  async listForTenant(): Promise<InvitationView[]> {
    try {
      const result = await this.db.rpc('list_team_invitations', {});
      const data = this.extractData<Record<string, unknown>[] | null>(
        result,
        'Erro ao listar convites',
      );
      return (data ?? []).map(toInvitationView);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar convites');
    }
  }

  async listForCurrentUser(): Promise<InviteForUser[]> {
    try {
      const result = await this.db.rpc('list_invites_for_current_user', {});
      const data = this.extractData<Record<string, unknown>[] | null>(
        result,
        'Erro ao listar convites do usuário',
      );
      return (data ?? []).map(toInvitePublic as (r: Record<string, unknown>) => InviteForUser);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar convites do usuário');
    }
  }
}

export const invitationRepository: InvitationRepository = new InvitationRepositoryImpl();
