/**
 * [SMG][DOMAIN][APPOINTMENT] barrel
 *
 * Domínio de agendamentos: tipos, repositório.
 */

export * from './types';
export { appointmentRepository, RepositoryError } from './repository';
export type { AppointmentRepository } from './repository';
