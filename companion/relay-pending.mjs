export class PendingRelayTracker {
  constructor({
    maxInFlight = 64,
    ttlMs = 35_000,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    onExpire = () => {},
  } = {}) {
    if (!Number.isInteger(maxInFlight) || maxInFlight < 1) throw new Error('maxInFlight must be a positive integer');
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('ttlMs must be positive');
    this.maxInFlight = maxInFlight;
    this.ttlMs = ttlMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onExpire = onExpire;
    this.entries = new Map();
  }

  get size() {
    return this.entries.size;
  }

  add(id, meta) {
    if (typeof id !== 'string' || id.length === 0) return 'invalid';
    if (this.entries.has(id)) return 'duplicate';
    if (this.entries.size >= this.maxInFlight) return 'full';

    const token = Symbol(id);
    const timer = this.setTimer(() => {
      const current = this.entries.get(id);
      if (!current || current.token !== token) return;
      this.entries.delete(id);
      this.onExpire({ id, meta: current.meta });
    }, this.ttlMs);
    timer?.unref?.();

    this.entries.set(id, { token, timer, meta });
    return 'accepted';
  }

  take(id, expected = {}) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (!this.matches(entry.meta, expected)) return null;

    this.clearTimer(entry.timer);
    this.entries.delete(id);
    return entry.meta;
  }

  drain(predicate = () => true) {
    const drained = [];
    for (const [id, entry] of this.entries) {
      if (!predicate(entry.meta, id)) continue;
      this.clearTimer(entry.timer);
      this.entries.delete(id);
      drained.push({ id, meta: entry.meta });
    }
    return drained;
  }

  clear() {
    this.drain();
  }

  matches(meta, expected) {
    for (const [key, value] of Object.entries(expected)) {
      if (meta?.[key] !== value) return false;
    }
    return true;
  }
}
