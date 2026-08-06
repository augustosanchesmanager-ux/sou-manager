/**
 * [SMG][APPLICATION][TEAM_INVITATION] TeamInvitationService
 *
 * RESPONSABILIDADE: Orquestra o ciclo de vida de convites de equipe
 * (Team Onboarding 6.0.3), espelhando TenantProvisioningService.
 *   - O Application Service É o responsável pelas decisões de negócio
 *   - As RPCs fazem apenas o trabalho transacional (validações de integridade)
 *   - Quem decide validar, publicar eventos e coordenar o fluxo é o Service
 *
 * FLUXO:
 *   invite  : valida → repository.create (RPC invite_team_member) → publica StaffInvited
 *   accept  : repository.accept (RPC accept_invite) → publica StaffAccepted
 *   revoke  : repository.revoke (RPC revoke_invite)
 *   resend  : repository.resend (RPC resend_invite) → devolve novo token p/ envio
 *   list    : repository.listForTenant (RPC list_team_invitations)
 *
 * NÃO FAZ:
 *   - Envio de email (Edge Function invite-team-member, canal SMTP da Auth)
 *   - Renderização de UI
 */

import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type { StaffAcceptedEvent, StaffInvitedEvent } from '../domain/events/types';
import { invitationRepository } from '../domain/invitation/repository';
import type { InvitationRepository } from '../domain/invitation/repository';
import type {
  AcceptInviteResult,
  InviteForUser,
  InvitePublic,
  InviteRole,
  InvitationView,
} from '../domain/invitation/types';

// ─── RPC Client (escopo public — convites sao tabela compartilhada) ──
function getRpcClient() {
  return createSupabaseClient('team_invitations', 'barber');
}

// ─── Types ───────────────────────────────────────────────────────

export interface InviteTeamMemberRequest {
  tenantId: string;
  email: string;
  role: InviteRole;
}

// ─── Validation (Regra de Negócio) ──────────────────────────────

const INVITABLE_ROLES: InviteRole[] = ['barber', 'receptionist'];

function validateInvite(req: InviteTeamMemberRequest): void {
  if (!req.tenantId) {
    throw new Error('tenantId é obrigatório');
  }
  const email = (req.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Email inválido');
  }
  if (!INVITABLE_ROLES.includes(req.role)) {
    throw new Error(`Papel não convidável. Permitidos: ${INVITABLE_ROLES.join(', ')}`);
  }
}

// ─── Service (Orquestrador) ─────────────────────────────────────

export class TeamInvitationServiceImpl {
  private repo: InvitationRepository;

  constructor(repo: InvitationRepository = invitationRepository) {
    this.repo = repo;
  }

  /**
   * Cria um convite e publica o evento StaffInvited.
   * A RPC invite_team_member valida chamador, D2 (papel), D3 (limite por plano)
   * e deduplicacao de pendentes — tudo transacional no banco.
   */
  async invite(req: InviteTeamMemberRequest): Promise<InvitationView> {
    validateInvite(req);

    const invitation = await this.repo.create({
      tenantId: req.tenantId,
      email: (req.email || '').trim().toLowerCase(),
      role: req.role,
    });

    await appEventBus.publish(createEvent<StaffInvitedEvent>({
      eventType: 'StaffInvited',
      aggregateId: invitation.id,
      aggregateType: 'invitation',
      payload: {
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        email: invitation.email,
        role: invitation.role,
      },
      metadata: {
        tenantId: invitation.tenantId,
        source: 'TeamInvitationService',
      },
    }));

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      resendCount: invitation.resendCount,
      invitedBy: invitation.invitedBy,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
    };
  }

  /**
   * Aceita o convite. A RPC accept_invite cria profiles + staff + user_tenants
   * atomicamente (R1). Publica StaffAccepted apos sucesso.
   */
  async accept(token: string, firstName: string, lastName: string): Promise<AcceptInviteResult> {
    if (!token || token.trim() === '') {
      throw new Error('Token do convite é obrigatório');
    }
    const result = await this.repo.accept(token.trim(), firstName || '', lastName || '');

    await appEventBus.publish(createEvent<StaffAcceptedEvent>({
      eventType: 'StaffAccepted',
      aggregateId: token.trim(),
      aggregateType: 'invitation',
      payload: {
        invitationId: token.trim(),
        tenantId: result.tenantId,
        staffId: result.staffId,
        role: result.role,
        email: '',
      },
      metadata: {
        tenantId: result.tenantId,
        userId: result.staffId,
        source: 'TeamInvitationService',
      },
    }));

    return result;
  }

  async revoke(invitationId: string): Promise<void> {
    if (!invitationId) throw new Error('invitationId é obrigatório');
    await this.repo.revoke(invitationId);
  }

  /** Carrega convite público (sem auth) para a tela de aceite. */
  async getByToken(token: string): Promise<InvitePublic | null> {
    if (!token || token.trim() === '') {
      throw new Error('Token do convite é obrigatório');
    }
    return this.repo.getByToken(token.trim());
  }

  async resend(invitationId: string): Promise<InvitationView> {
    if (!invitationId) throw new Error('invitationId é obrigatório');
    const invitation = await this.repo.resend(invitationId);
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      resendCount: invitation.resendCount,
      invitedBy: invitation.invitedBy,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
    };
  }

  async list(): Promise<InvitationView[]> {
    return this.repo.listForTenant();
  }

  async listForCurrentUser(): Promise<InviteForUser[]> {
    return this.repo.listForCurrentUser();
  }

  /** Exposto para testes (DI) — evita mock global do appEventBus. */
  getRepository(): InvitationRepository {
    return this.repo;
  }
}

export const teamInvitationService = new TeamInvitationServiceImpl();
