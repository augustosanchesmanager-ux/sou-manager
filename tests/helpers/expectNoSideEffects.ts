import { expect } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Asserts that a mock was NOT called with arguments that would indicate
 * a side effect (e.g., create/update/delete on an unrelated table).
 */
export const expectNoSideEffect = (
  mock: Mock,
  tableName: string,
) => {
  const calls = mock.mock.calls.filter(
    (call) => call[0] === tableName,
  );
  expect(calls).toHaveLength(0);
};

/**
 * Asserts that a set of mocks were all called exactly once.
 * Useful for verifying that a single operation triggered the expected set of side effects.
 */
export const expectExactlyOneSideEffect = (
  mocks: Mock[],
  labels: string[],
) => {
  expect(mocks.length).toBe(labels.length);
  mocks.forEach((mock, i) => {
    expect(mock, `Expected ${labels[i]} to be called exactly once`).toHaveBeenCalledTimes(1);
  });
};

/**
 * Asserts that NO mock in the set was called.
 * Useful for verifying that an early validation prevented all side effects.
 */
export const expectNoSideEffects = (
  mocks: Mock[],
  labels: string[],
) => {
  expect(mocks.length).toBe(labels.length);
  mocks.forEach((mock, i) => {
    expect(mock, `Expected ${labels[i]} not to be called`).not.toHaveBeenCalled();
  });
};

/**
 * Asserts that a mock's calls are in a specific order.
 * The mock should have been called at least once with each expected table.
 */
export const expectCallOrder = (
  mock: Mock,
  expectedOrder: string[],
) => {
  const actualOrder = mock.mock.calls.map((call) => call[0]);
  const filtered = actualOrder.filter((table) => expectedOrder.includes(table));
  expect(filtered).toEqual(expectedOrder);
};
