import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHANGELOG_VERSION,
  CHANGELOG_STORAGE_KEY,
  CHANGELOG_ITEMS,
  hasUnseenChangelog,
  markChangelogSeen,
} from './changelog';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

describe('changelog persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should_report_unseen_when_nothing_was_persisted', () => {
    // Arrange + Act
    const result = hasUnseenChangelog();

    // Assert
    expect(result).toBe(true);
  });

  it('should_report_seen_when_persisted_version_matches_current', () => {
    // Arrange
    localStorage.setItem(CHANGELOG_STORAGE_KEY, CHANGELOG_VERSION);

    // Act
    const result = hasUnseenChangelog();

    // Assert
    expect(result).toBe(false);
  });

  it('should_report_unseen_when_persisted_version_is_older', () => {
    // Arrange
    localStorage.setItem(CHANGELOG_STORAGE_KEY, '0.0.1');

    // Act
    const result = hasUnseenChangelog();

    // Assert
    expect(result).toBe(true);
  });

  it('should_persist_current_version_when_marked_as_seen', () => {
    // Act
    const stored = markChangelogSeen();

    // Assert
    expect(stored).toBe(true);
    expect(localStorage.getItem(CHANGELOG_STORAGE_KEY)).toBe(CHANGELOG_VERSION);
    expect(hasUnseenChangelog()).toBe(false);
  });

  it('should_report_unseen_when_storage_is_unavailable', () => {
    // Arrange
    vi.stubGlobal('localStorage', undefined);

    // Act + Assert
    expect(hasUnseenChangelog()).toBe(true);
    expect(markChangelogSeen()).toBe(false);
  });
});

describe('changelog content', () => {
  it('should_expose_seven_items_when_version_is_current', () => {
    expect(CHANGELOG_ITEMS).toHaveLength(7);
    for (const item of CHANGELOG_ITEMS) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('should_expose_version_with_semver_shape_when_read', () => {
    expect(CHANGELOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CHANGELOG_STORAGE_KEY).toBe('smg_last_seen_changelog');
  });
});
