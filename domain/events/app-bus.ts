/**
 * [SMG][DOMAIN][EVENTS] Application Event Bus
 *
 * Event bus global da aplicação.
 * Services importam diretamente (mesmo padrão do supabase).
 *
 * Uso:
 *   import { appEventBus } from '../domain/events/app-bus';
 *   appEventBus.publish(createEvent({ ... }));
 */

import { InMemoryEventBus } from './memory-bus';
import type { EventBus } from './bus';

/** Singleton — mesmo padrão do supabase client. */
export const appEventBus: EventBus = new InMemoryEventBus({ maxLogSize: 500 });
