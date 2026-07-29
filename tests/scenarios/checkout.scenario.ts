import type { FinishRequest, CheckoutCartItem } from '../../application/checkout';
import {
  makeFinishRequest,
  makeCartItem,
  makePaidRequest,
  makePendingRequest,
  makeLegacyRequest,
  makeZeroCloseRequest,
  makeCreditRequest,
} from '../builders/checkout.builder';
import {
  createComandaChain,
  createItemsCallSequence,
  createSimpleChain,
  makeDefaultItemsSequence,
} from '../factories/mockDatabaseClient';
import type { ChainResult } from '../factories/mockDatabaseClient';

// ─── Scenario Result ──────────────────────────────────────────────

export interface CheckoutScenario {
  request: FinishRequest;
  idempotencyKey: string;
  comandaInsertResult: ChainResult;
  comandaVerifyResult: ChainResult;
  comandaLookupResult: ChainResult;
  itemsSequence: ReturnType<typeof createItemsCallSequence>;
  participantResult: ChainResult;
  defaultChainResult: ChainResult;
  comandaCallIndex: number;
  rpcResult: Record<string, unknown>;
}

// ─── Scenario Builders ────────────────────────────────────────────

export const makeSuccessfulPaidScenario = (overrides: Partial<FinishRequest> = {}): CheckoutScenario => ({
  request: makePaidRequest(50),
  idempotencyKey: 'idem-paid-success',
  comandaInsertResult: { data: { id: 'comanda-paid-1' }, error: null },
  comandaVerifyResult: { data: { status: 'open' }, error: null },
  comandaLookupResult: { data: { id: 'comanda-paid-1' }, error: null },
  itemsSequence: makeDefaultItemsSequence('item-paid-1'),
  participantResult: { data: null, error: null },
  defaultChainResult: { data: null, error: null },
  comandaCallIndex: 0,
  rpcResult: { success: true },
  ...overrides,
});

export const makePendingScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePendingRequest(50),
  idempotencyKey: 'idem-pending',
  comandaInsertResult: { data: { id: 'comanda-pending-1' }, error: null },
});

export const makeLegacyClubScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makeLegacyRequest(),
  idempotencyKey: 'idem-legacy',
  comandaInsertResult: { data: { id: 'comanda-legacy-1' }, error: null },
});

export const makeZeroCloseScenario = (
  origin: 'club_credit' | 'house_courtesy' | 'administrative_adjustment' = 'house_courtesy',
): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makeZeroCloseRequest(origin),
  idempotencyKey: 'idem-zero',
  comandaInsertResult: { data: { id: 'comanda-zero-1' }, error: null },
});

export const makeCreditScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makeCreditRequest(),
  idempotencyKey: 'idem-credit',
  comandaInsertResult: { data: { id: 'comanda-credit-1' }, error: null },
});

export const makeUpdatePathScenario = (comandaId = 'comanda-update-1'): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePaidRequest(50),
  idempotencyKey: 'idem-update',
  comandaInsertResult: { data: { id: comandaId }, error: null },
  comandaVerifyResult: { data: { status: 'open' }, error: null },
  comandaCallIndex: 0,
});

// ─── Failure Scenarios ────────────────────────────────────────────

export const makeItemsInsertFailureScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePaidRequest(50),
  idempotencyKey: 'idem-items-fail',
  comandaInsertResult: { data: { id: 'comanda-items-fail' }, error: null },
  itemsSequence: createItemsCallSequence([
    { data: [], error: null },                                        // backup
    { data: null, error: null },                                      // delete
    { data: [{ id: 'item-1' }], error: null },                       // insert returns 1
    { data: null, error: null, count: 0 },                           // checkpoint returns 0 (mismatch)
  ]),
});

export const makeItemsErrorScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePaidRequest(50),
  idempotencyKey: 'idem-items-err',
  comandaInsertResult: { data: { id: 'comanda-items-err' }, error: null },
  itemsSequence: createItemsCallSequence([
    { data: [], error: null },                                        // backup
    { data: null, error: null },                                      // delete
    { data: null, error: { message: 'insert failed' } },             // insert error
    { data: null, error: null, count: 0 },                           // checkpoint
  ]),
});

export const makeConcurrencyScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePaidRequest(50),
  idempotencyKey: 'idem-concurrency',
  comandaVerifyResult: { data: { status: 'paid' }, error: null },
});

export const makeIdempotencyScenario = (): CheckoutScenario => ({
  ...makeSuccessfulPaidScenario(),
  request: makePaidRequest(50),
  idempotencyKey: 'idem-dup',
  comandaInsertResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
  comandaLookupResult: { data: { id: 'existing-idem-comanda' }, error: null },
});

// ─── Helpers ──────────────────────────────────────────────────────

export const buildMockFromImplementation = (scenario: CheckoutScenario) => {
  let comandaCallIdx = scenario.comandaCallIndex;

  return (table: string) => {
    if (table === 'comandas') {
      return createComandaChain({
        insertResult: scenario.comandaInsertResult,
        verifyResult: scenario.comandaVerifyResult,
        lookupResult: scenario.comandaLookupResult,
      }, comandaCallIdx++);
    }
    if (table === 'comanda_items') return scenario.itemsSequence();
    if (table === 'service_execution_participants') {
      return createSimpleChain(scenario.participantResult);
    }
    return createSimpleChain(scenario.defaultChainResult);
  };
};
