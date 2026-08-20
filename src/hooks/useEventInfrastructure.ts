/**
 * [SMG][PLATFORM][EVENTS][HOOKS] useEventInfrastructure
 *
 * TD-001 B1: Initializes read-only event infrastructure on mount.
 * Disposes on unmount (React cleanup).
 */

import { useEffect } from 'react';
import {
  initializeEventInfrastructure,
  disposeEventInfrastructure,
} from '../bootstrap/eventInfrastructure';

export const useEventInfrastructure = (): void => {
  useEffect(() => {
    initializeEventInfrastructure();

    return () => {
      disposeEventInfrastructure();
    };
  }, []);
};
