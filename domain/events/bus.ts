/**
 * [SMG][DOMAIN][EVENTS] EventBus
 *
 * Interface abstrata para publicação e assinatura de eventos de domínio.
 *
 * GARANTIAS:
 *   - Sem dependência de framework (React, etc.)
 *   - Sem dependência de infraestrutura (Supabase, etc.)
 *   - Apenas contrato de eventos puro
 *   - Type-safe via discriminated union
 *
 * Uso:
 *   const bus = createEventBus();
 *   bus.subscribe('CheckoutCompleted', async (event) => { ... });
 *   await bus.publish({ eventType: 'CheckoutCompleted', ... });
 */

import type { DomainEvent, EventType, SystemEvent } from './types';

export type EventHandler<T extends SystemEvent = SystemEvent> = (
  event: T,
) => Promise<void> | void;

export interface EventBus {
  /**
   * Publica um evento. Todos os handlers registrados para o tipo
   * serão executados. Erros em handlers NÃO propagam.
   */
  publish(event: SystemEvent): Promise<void>;

  /**
   * Registra um handler para um tipo específico de evento.
   * Retorna uma função de unsubscribe.
   */
  subscribe<T extends SystemEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>,
  ): () => void;

  /**
   * Registra um handler para TODOS os eventos.
   * Útil para logging, métricas, e auditoria.
   */
  subscribeAll(handler: EventHandler<SystemEvent>): () => void;

  /**
   * Remove todos os handlers registrados.
   */
  clear(): void;

  /**
   * Retorna o número de handlers registrados (para debug/testes).
   */
  handlerCount(eventType?: EventType): number;
}
