import type { ServiceExecutionParticipant } from '../../src/types/executionParticipants';

let _participantSeq = 0;

export const resetParticipantSeq = () => { _participantSeq = 0; };

export const makeServiceExecutionParticipant = (
  overrides: Partial<ServiceExecutionParticipant> = {},
): ServiceExecutionParticipant => ({
  id: `sep-${++_participantSeq}`,
  comanda_item_id: 'item-1',
  professional_id: 'prof-1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_revenue: true,
  affects_commission: true,
  tenant_id: 'tenant-1',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makePrimaryParticipant = (
  overrides: Partial<ServiceExecutionParticipant> = {},
) =>
  makeServiceExecutionParticipant({ role: 'primary', ...overrides });

export const makeAssistantParticipant = (
  overrides: Partial<ServiceExecutionParticipant> = {},
) =>
  makeServiceExecutionParticipant({
    role: 'assistant',
    payout_type: 'fixed',
    payout_value: 10,
    ...overrides,
  });

export const makeCoExecutorParticipant = (
  overrides: Partial<ServiceExecutionParticipant> = {},
) =>
  makeServiceExecutionParticipant({
    role: 'co_executor',
    payout_type: 'percentage',
    payout_value: 50,
    ...overrides,
  });
