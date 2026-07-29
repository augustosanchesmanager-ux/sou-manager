import { expect } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Asserts that a repository method was called exactly N times.
 */
export const expectCalledTimes = (
  mock: Mock,
  times: number,
  label?: string,
) => {
  expect(mock).toHaveBeenCalledTimes(times);
};

/**
 * Asserts that a repository method was called with specific arguments.
 */
export const expectCalledWith = (
  mock: Mock,
  ...args: unknown[]
) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

/**
 * Asserts that a repository method was NOT called.
 */
export const expectNotCalled = (mock: Mock, label?: string) => {
  if (label) {
    expect(mock, `Expected ${label} not to be called`).not.toHaveBeenCalled();
  } else {
    expect(mock).not.toHaveBeenCalled();
  }
};

/**
 * Asserts that a repository method was called at least once.
 */
export const expectCalled = (mock: Mock, label?: string) => {
  if (label) {
    expect(mock, `Expected ${label} to be called`).toHaveBeenCalled();
  } else {
    expect(mock).toHaveBeenCalled();
  }
};

/**
 * Asserts that a Supabase from() was called with a specific table.
 */
export const expectTableCalled = (
  fromMock: Mock,
  table: string,
  times?: number,
) => {
  const calls = fromMock.mock.calls.filter((call) => call[0] === table);
  if (times !== undefined) {
    expect(calls.length).toBe(times);
  } else {
    expect(calls.length).toBeGreaterThan(0);
  }
};

/**
 * Asserts that a Supabase rpc() was called with a specific function name.
 */
export const expectRpcCalled = (
  rpcMock: Mock,
  fn: string,
  params?: Record<string, unknown>,
) => {
  expect(rpcMock).toHaveBeenCalledWith(fn, params ? expect.objectContaining(params) : expect.anything());
};

/**
 * Asserts that a Supabase rpc() was NOT called.
 */
export const expectRpcNotCalled = (rpcMock: Mock) => {
  expect(rpcMock).not.toHaveBeenCalled();
};
