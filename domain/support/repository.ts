/**
 * [SMG][DOMAIN][SUPPORT] repository
 *
 * RESPONSABILIDADE: Gerencia chamados de suporte e mensagens
 *   (tabelas `support_tickets` e `ticket_messages` em `public`).
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 *   - DatabaseClient injetado via construtor (testável sem Supabase)
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSharedSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';

export { RepositoryError } from '../shared/errors';

export type SupportTicketStatus = 'open' | 'responded' | 'awaiting_response' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high';

export interface SupportTicket {
  id: string;
  user_id: string;
  tenant_id?: string | null;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  tenant_id?: string | null;
  message: string;
  created_at: string;
}

export interface ListTicketsOptions {
  userId?: string;
  tenantId?: string;
  limit?: number;
}

export interface CreateSupportTicketInput {
  user_id: string;
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  tenant_id?: string | null;
}

export interface CreateTicketMessageInput {
  ticket_id: string;
  sender_id: string;
  message: string;
  tenant_id?: string | null;
}

class SupportRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('support_tickets', db ?? createSharedSupabaseClient());
  }

  async listTickets(options: ListTicketsOptions = {}): Promise<SupportTicket[]> {
    try {
      let query = this.from()
        .select('*')
        .order('created_at', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options.tenantId) {
        query = query.eq('tenant_id', options.tenantId);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;
      return this.extractData<SupportTicket[]>(result, 'Erro ao listar chamados') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar chamados');
    }
  }

  async countOpenTickets(): Promise<number> {
    try {
      const result = await this.from()
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
      if (result.error) {
        this.extractData(result, 'Erro ao contar chamados abertos');
      }
      return result.count ?? 0;
    } catch (err) {
      this.throwOnError(err, 'Erro ao contar chamados abertos');
    }
  }

  async createTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
    try {
      const result = await this.from()
        .insert({
          user_id: input.user_id,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          status: 'open',
          tenant_id: input.tenant_id ?? null,
        })
        .select()
        .single();
      const data = this.extractData<SupportTicket | null>(result, 'Erro ao abrir chamado');
      return this.requireData(data, 'Erro ao abrir chamado');
    } catch (err) {
      this.throwOnError(err, 'Erro ao abrir chamado');
    }
  }

  async updateTicketStatus(id: string, status: SupportTicketStatus): Promise<void> {
    try {
      const result = await this.from()
        .update({ status })
        .eq('id', id);
      this.extractData(result, 'Erro ao atualizar status do chamado');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status do chamado');
    }
  }

  async listMessages(ticketId: string): Promise<TicketMessage[]> {
    try {
      const result = await this.db
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      return this.extractData<TicketMessage[]>(result, 'Erro ao listar mensagens do chamado') ?? [];
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar mensagens do chamado');
    }
  }

  async createMessage(input: CreateTicketMessageInput): Promise<TicketMessage> {
    try {
      const payload: Record<string, unknown> = {
        ticket_id: input.ticket_id,
        sender_id: input.sender_id,
        message: input.message,
      };
      if (input.tenant_id !== undefined) {
        payload.tenant_id = input.tenant_id;
      }

      const result = await this.db
        .from('ticket_messages')
        .insert(payload)
        .select()
        .single();
      const data = this.extractData<TicketMessage | null>(result, 'Erro ao enviar mensagem do chamado');
      return this.requireData(data, 'Erro ao enviar mensagem do chamado');
    } catch (err) {
      this.throwOnError(err, 'Erro ao enviar mensagem do chamado');
    }
  }
}

export const supportRepository = new SupportRepositoryImpl();
export { SupportRepositoryImpl };
