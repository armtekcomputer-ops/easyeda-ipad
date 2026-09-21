import { afterEach, describe, expect, it, vi } from 'vitest';
import { PendingRelayTracker } from './relay-pending.mjs';

afterEach(() => {
  vi.useRealTimers();
});

describe('PendingRelayTracker', () => {
  it('rejects duplicate IDs and enforces the max in-flight bound', () => {
    const tracker = new PendingRelayTracker({ maxInFlight: 2, ttlMs: 10_000 });

    expect(tracker.add('a', { localGeneration: 1, cloudGeneration: 1 })).toBe('accepted');
    expect(tracker.add('a', { localGeneration: 1, cloudGeneration: 1 })).toBe('duplicate');
    expect(tracker.add('b', { localGeneration: 1, cloudGeneration: 1 })).toBe('accepted');
    expect(tracker.add('c', { localGeneration: 1, cloudGeneration: 1 })).toBe('full');
    expect(tracker.size).toBe(2);

    tracker.clear();
  });

  it('expires requests after the configured TTL and removes them', () => {
    vi.useFakeTimers();
    const expired = [];
    const tracker = new PendingRelayTracker({
      maxInFlight: 2,
      ttlMs: 1_000,
      onExpire: (entry) => expired.push(entry),
    });

    tracker.add('request-1', { localGeneration: 2, cloudGeneration: 3 });
    vi.advanceTimersByTime(999);
    expect(expired).toEqual([]);
    expect(tracker.size).toBe(1);

    vi.advanceTimersByTime(1);
    expect(expired).toEqual([{
      id: 'request-1',
      meta: { localGeneration: 2, cloudGeneration: 3 },
    }]);
    expect(tracker.size).toBe(0);
  });

  it('does not let a stale generation consume a newer request with the same ID', () => {
    const tracker = new PendingRelayTracker({ maxInFlight: 2, ttlMs: 10_000 });
    tracker.add('route-id', { localGeneration: 7, cloudGeneration: 9 });

    expect(tracker.take('route-id', { localGeneration: 6, cloudGeneration: 9 })).toBeNull();
    expect(tracker.take('route-id', { localGeneration: 7, cloudGeneration: 8 })).toBeNull();
    expect(tracker.size).toBe(1);

    expect(tracker.take('route-id', { localGeneration: 7, cloudGeneration: 9 })).toEqual({
      localGeneration: 7,
      cloudGeneration: 9,
    });
    expect(tracker.size).toBe(0);
  });

  it('drains only requests owned by a disconnected generation', () => {
    const tracker = new PendingRelayTracker({ maxInFlight: 4, ttlMs: 10_000 });
    tracker.add('old-1', { localGeneration: 1, cloudGeneration: 4 });
    tracker.add('old-2', { localGeneration: 1, cloudGeneration: 4 });
    tracker.add('current', { localGeneration: 2, cloudGeneration: 4 });

    const drained = tracker.drain((meta) => meta.localGeneration === 1);
    expect(drained.map((entry) => entry.id).sort()).toEqual(['old-1', 'old-2']);
    expect(tracker.size).toBe(1);
    expect(tracker.take('current', { localGeneration: 2, cloudGeneration: 4 })).not.toBeNull();
  });
});
