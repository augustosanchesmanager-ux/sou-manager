/**
 * [SMG][DOMAIN][EVENTS] UpcasterRegistry
 *
 * Registry for event upcasters that transform events between versions.
 * Supports chaining: v1 → v2 → v3 (latest).
 *
 * DESIGN DECISIONS:
 *   - Upcasters are pure transformations (no side effects)
 *   - Chaining is automatic: find the path from source version to latest
 *   - Upcasting happens at read time (EventStore → Upcaster → EventBus)
 *   - Original events are never modified (immutable)
 *
 * USAGE:
 *   const registry = createUpcasterRegistry();
 *   registry.register(checkoutV1ToV2);
 *   const latest = registry.upcastToLatest(envelope);
 */

import type { EventEnvelope } from './envelope';

// ─── Upcaster Interface ─────────────────────────────────────────

export interface EventUpcaster {
  readonly eventType: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  canHandle(event: EventEnvelope): boolean;
  upcast(event: EventEnvelope): EventEnvelope;
}

// ─── Registry Interface ─────────────────────────────────────────

export interface UpcasterRegistry {
  register(upcaster: EventUpcaster): void;
  getUpcasters(eventType: string): EventUpcaster[];
  getUpcaster(eventType: string, fromVersion: number): EventUpcaster | undefined;
  upcastToLatest(event: EventEnvelope): EventEnvelope;
  upcastToVersion(event: EventEnvelope, targetVersion: number): EventEnvelope;
  hasUpcasters(eventType: string): boolean;
  getVersionChain(eventType: string, fromVersion: number, toVersion: number): EventUpcaster[];
}

// ─── Factory ─────────────────────────────────────────────────────

export const createUpcasterRegistry = (): UpcasterRegistry => {
  const upcasters = new Map<string, EventUpcaster[]>();

  const findChain = (eventType: string, fromVersion: number, toVersion: number): EventUpcaster[] => {
    const available = upcasters.get(eventType) ?? [];
    if (available.length === 0) return [];

    const chain: EventUpcaster[] = [];
    let currentVersion = fromVersion;

    while (currentVersion < toVersion) {
      const next = available.find(u => u.fromVersion === currentVersion);
      if (!next) break;
      chain.push(next);
      currentVersion = next.toVersion;
    }

    return chain;
  };

  return {
    register(upcaster: EventUpcaster): void {
      const existing = upcasters.get(upcaster.eventType) ?? [];
      const alreadyRegistered = existing.some(
        u => u.fromVersion === upcaster.fromVersion && u.toVersion === upcaster.toVersion,
      );
      if (alreadyRegistered) {
        throw new Error(
          `Upcaster for '${upcaster.eventType}' v${upcaster.fromVersion}→v${upcaster.toVersion} already registered.`,
        );
      }
      upcasters.set(upcaster.eventType, [...existing, upcaster]);
    },

    getUpcasters(eventType: string): EventUpcaster[] {
      return upcasters.get(eventType) ?? [];
    },

    getUpcaster(eventType: string, fromVersion: number): EventUpcaster | undefined {
      return upcasters.get(eventType)?.find(u => u.fromVersion === fromVersion);
    },

    upcastToLatest(event: EventEnvelope): EventEnvelope {
      const available = upcasters.get(event.eventType) ?? [];
      if (available.length === 0) return event;

      let current = event;
      let safety = 0;

      while (safety < 20) {
        const next = available.find(u => u.fromVersion === current.eventTypeVersion);
        if (!next) break;
        current = next.upcast(current);
        safety++;
      }

      return current;
    },

    upcastToVersion(event: EventEnvelope, targetVersion: number): EventEnvelope {
      if (event.eventTypeVersion >= targetVersion) return event;

      const chain = findChain(event.eventType, event.eventTypeVersion, targetVersion);
      let current = event;

      for (const upcaster of chain) {
        current = upcaster.upcast(current);
      }

      return current;
    },

    hasUpcasters(eventType: string): boolean {
      return (upcasters.get(eventType) ?? []).length > 0;
    },

    getVersionChain(eventType: string, fromVersion: number, toVersion: number): EventUpcaster[] {
      return findChain(eventType, fromVersion, toVersion);
    },
  };
};
