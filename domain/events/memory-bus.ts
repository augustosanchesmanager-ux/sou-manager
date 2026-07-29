/**
 * [SMG][DOMAIN][EVENTS] InMemoryEventBus
 *
 * Implementação em memória do EventBus.
 * Adequada para testes, desenvolvimento, e como default.
 *
 * GARANTIAS:
 *   - Handlers são executados sequencialmente (por tipo)
 *   - Erros em handlers são logados mas NÃO propagam
 *   - subscribe retorna função de unsubscribe
 *   - subscribeAll captura todos os eventos
 *
 * LIMITAÇÕES:
 *   - Eventos não persistem entre reinícios
 *   - Sem retry em handlers
 *   - Para produção com persistence, usar PersistentEventBus
 */

import type { EventBus, EventHandler } from './bus';
import type { SystemEvent, EventType } from './types';

type HandlerEntry = {
  eventType: EventType | '*';
  handler: EventHandler<SystemEvent>;
};

export class InMemoryEventBus implements EventBus {
  private handlers: HandlerEntry[] = [];
  private eventLog: SystemEvent[] = [];
  private maxLogSize: number;

  constructor(options?: { maxLogSize?: number }) {
    this.maxLogSize = options?.maxLogSize ?? 1000;
  }

  async publish(event: SystemEvent): Promise<void> {
    // Store in log for debugging/replay
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Collect matching handlers
    const matchingHandlers = this.handlers.filter(
      (entry) => entry.eventType === '*' || entry.eventType === event.eventType,
    );

    // Execute sequentially — errors don't propagate
    for (const entry of matchingHandlers) {
      try {
        await entry.handler(event);
      } catch (error) {
        console.error(
          `[SMG][EVENT_BUS] Handler error for ${event.eventType}:`,
          error,
        );
      }
    }
  }

  subscribe<T extends SystemEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>,
  ): () => void {
    const entry: HandlerEntry = {
      eventType,
      handler: handler as EventHandler<SystemEvent>,
    };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  subscribeAll(handler: EventHandler<SystemEvent>): () => void {
    const entry: HandlerEntry = {
      eventType: '*',
      handler,
    };
    this.handlers.push(entry);

    return () => {
      const index = this.handlers.indexOf(entry);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.handlers = [];
  }

  handlerCount(eventType?: EventType): number {
    if (!eventType) return this.handlers.length;
    return this.handlers.filter((e) => e.eventType === eventType).length;
  }

  /** Retorna log de eventos (para debug/testes). */
  getEventLog(): ReadonlyArray<SystemEvent> {
    return this.eventLog;
  }

  /** Limpa o log de eventos. */
  clearLog(): void {
    this.eventLog = [];
  }
}

/** Factory function — padrão do projeto. */
export const createEventBus = (options?: { maxLogSize?: number }): EventBus =>
  new InMemoryEventBus(options);
