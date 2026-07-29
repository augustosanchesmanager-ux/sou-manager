import { vi } from 'vitest';

// ─── Types ────────────────────────────────────────────────────────

export type ChainResult = {
  data: unknown;
  error: unknown;
  count?: number;
};

type MockChain = Record<string, unknown> & {
  then: ReturnType<typeof vi.fn>;
};

// ─── Simple chain ─────────────────────────────────────────────────

export const createSimpleChain = (result: ChainResult = { data: null, error: null }): MockChain => {
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.like = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.contains = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  chain.and = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.single = vi.fn(() => makeThenable(result));
  chain.maybeSingle = vi.fn(() => makeThenable(result));

  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain as MockChain;
};

// ─── Comanda chain (method-aware) ─────────────────────────────────
// Tracks hasInsert for .single() and fromCallIndex for .maybeSingle()
// to distinguish verifyComandaOpenStatus from idempotency lookup.

export const createComandaChain = (
  opts: {
    insertResult?: ChainResult;
    verifyResult?: ChainResult;
    lookupResult?: ChainResult;
  },
  fromCallIndex = 0,
): MockChain => {
  const chain: Record<string, unknown> = {};
  let hasInsert = false;

  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => { hasInsert = true; return chain; });
  chain.delete = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);

  chain.single = vi.fn(() => {
    const result = hasInsert
      ? (opts.insertResult ?? { data: { id: 'new-comanda' }, error: null })
      : (opts.lookupResult ?? { data: { id: 'lookup-comanda' }, error: null });
    return makeThenable(result);
  });

  chain.maybeSingle = vi.fn(() => {
    const result = fromCallIndex === 0
      ? (opts.verifyResult ?? { data: { status: 'open' }, error: null })
      : (opts.lookupResult ?? { data: { id: 'lookup-comanda' }, error: null });
    return makeThenable(result);
  });

  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
  );

  return chain as MockChain;
};

// ─── Items call sequence (queue-based) ────────────────────────────
// syncItemsWithCompensation calls from('comanda_items') 4 times:
//   1. backup (select), 2. delete, 3. insert, 4. checkpoint (count)

export const createItemsCallSequence = (results: ChainResult[]) => {
  let idx = 0;
  return () => {
    const result = results[Math.min(idx, results.length - 1)];
    idx++;
    return createSimpleChain(result);
  };
};

// ─── Default items sequence for happy paths ───────────────────────

export const makeDefaultItemsSequence = (itemId = 'item-id-1', count = 1) =>
  createItemsCallSequence([
    { data: [], error: null },                                 // 1. backup
    { data: null, error: null },                               // 2. delete
    { data: [{ id: itemId }], error: null },                   // 3. insert
    { data: null, error: null, count },                        // 4. checkpoint
  ]);

// ─── Helpers ──────────────────────────────────────────────────────

const makeThenable = (value: unknown) => ({
  then: vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(value).then(resolve),
  ),
});

// ─── Mock DatabaseClient ──────────────────────────────────────────

export interface MockDatabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  _nextComandaChain: (opts: Parameters<typeof createComandaChain>[0]) => void;
  _setItemsSequence: (seq: ReturnType<typeof createItemsCallSequence>) => void;
  _setDefault: (result?: ChainResult) => void;
}

export const createMockDatabaseClient = (): MockDatabaseClient => {
  const client: MockDatabaseClient = {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _nextComandaChain: vi.fn(),
    _setItemsSequence: vi.fn(),
    _setDefault: vi.fn(),
  };

  let comandaCallIdx = 0;
  let itemsSequence: ReturnType<typeof createItemsCallSequence> | null = null;
  let defaultChain: ChainResult = { data: null, error: null };

  client.from.mockImplementation((table: string) => {
    if (table === 'comandas') {
      return createComandaChain(
        client._nextComandaChain.mock.calls[0]?.[0] ?? {},
        comandaCallIdx++,
      );
    }
    if (table === 'comanda_items' && itemsSequence) {
      return itemsSequence();
    }
    return createSimpleChain(defaultChain);
  });

  client._nextComandaChain.mockImplementation((opts) => opts);
  client._setItemsSequence.mockImplementation((seq) => { itemsSequence = seq; });
  client._setDefault.mockImplementation((result) => { defaultChain = result ?? { data: null, error: null }; });

  return client;
};
