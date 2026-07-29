import type { ExpectationResult } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Asserts that a mock function was called with arguments that suggest
 * a rollback was attempted (e.g., a delete call after an insert failure).
 */
export const expectRollbackAttempted = (
  deleteMock: Mock,
  tableName: string,
): ExpectationResult => {
  const calls = deleteMock.mock.calls.filter(
    (call) => call[0] === tableName || call[0]?.table === tableName,
  );
  return {
    pass: calls.length > 0,
    message: () =>
      calls.length > 0
        ? `Expected no rollback on ${tableName}, but found ${calls.length} delete call(s)`
        : `Expected rollback on ${tableName} (delete call), but none was made`,
  };
};

/**
 * Asserts that NO rollback was attempted on any table.
 */
export const expectNoRollback = (
  deleteMock: Mock,
): ExpectationResult => {
  const calls = deleteMock.mock.calls;
  return {
    pass: calls.length === 0,
    message: () =>
      calls.length === 0
        ? `Expected no rollback, but found ${calls.length} delete call(s)`
        : `Expected no rollback, but found ${calls.length} delete call(s): ${JSON.stringify(calls)}`,
  };
};

/**
 * Asserts that a rollback was complete (all items restored).
 */
export const expectRollbackComplete = (
  insertMock: Mock,
  expectedCount: number,
): ExpectationResult => {
  const calls = insertMock.mock.calls;
  const totalInserted = calls.reduce((sum, call) => {
    const items = Array.isArray(call[0]) ? call[0] : [call[0]];
    return sum + items.length;
  }, 0);
  return {
    pass: totalInserted === expectedCount,
    message: () =>
      totalInserted === expectedCount
        ? `Expected rollback to restore ${expectedCount} items, but restored ${totalInserted}`
        : `Expected rollback to restore ${expectedCount} items, but restored ${totalInserted}`,
  };
};
