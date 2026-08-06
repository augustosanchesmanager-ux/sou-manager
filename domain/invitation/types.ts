/**
 * [SMG][DOMAIN][INVITATION] types
 *
 * Tipos centrais do domínio de convites de equipe (Team Onboarding 6.0.3).
 *
 * Contrato de roles (R6): apenas Barber e Receptionist sao convidaveis (D2).
 * O banco garante via CHECK em team_invitations.
 */

export type InviteRole = 'barber' | 'receptionist';

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/** Registro completo do convite (inclui token — nunca exposto via REST). */
export interface Invitation {
  id: string;
  tenantId: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  token: string;
  expiresAt: string;
  invitedBy?: string | null;
  acceptedAt?: string | null;
  resendCount: number;
  createdAt: string;
}

/** Visão segura para a UI do gestor (sem token). */
export interface InvitationView {
  id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  expiresAt: string;
  resendCount: number;
  invitedBy?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
}

/** Convite público (tela de aceite) — dados minimos do tenant. */
export interface InvitePublic {
  id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  expiresAt: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

/** Convites pendentes do usuario autenticado (fallback sem token na URL). */
export interface InviteForUser extends InvitePublic {}

export interface AcceptInviteResult {
  tenantId: string;
  role: InviteRole;
  staffId: string;
}
