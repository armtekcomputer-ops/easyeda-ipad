import { describe, expect, it } from 'vitest';
import {
  RELAY_LIMITS,
  bearerToken,
  encodeRelayRoute,
  isWebSocketUpgrade,
  parseRelayMessage,
  parseRelayRoute,
  relayCodeBytesWithinLimit,
  relayFrameBytesWithinLimit,
  safeEqual,
  validSession,
} from './protocol';

describe('Worker relay authentication helpers', () => {
  it('compares tokens exactly and handles different byte lengths', () => {
    expect(safeEqual('secret-token', 'secret-token')).toBe(true);
    expect(safeEqual('secret-token', 'secret-token-x')).toBe(false);
    expect(safeEqual('secret-token', 'SECRET-token')).toBe(false);
    expect(safeEqual('é', 'e')).toBe(false);
  });

  it('prefers a Bearer token and otherwise falls back to the query token', () => {
    const bearerRequest = new Request('https://example.test/ws/ipad?token=query-token', {
      headers: { authorization: 'Bearer header-token' },
    });
    expect(bearerToken(bearerRequest, new URL(bearerRequest.url))).toBe('header-token');

    const queryRequest = new Request('https://example.test/ws/ipad?token=query-token');
    expect(bearerToken(queryRequest, new URL(queryRequest.url))).toBe('query-token');
  });

  it('accepts only bounded routing session names and WebSocket upgrades', () => {
    expect(validSession('default_1-test')).toBe(true);
    expect(validSession('')).toBe(false);
    expect(validSession('bad/session')).toBe(false);
    expect(validSession('x'.repeat(RELAY_LIMITS.sessionLength + 1))).toBe(false);

    expect(isWebSocketUpgrade(new Request('https://example.test', { headers: { upgrade: 'WebSocket' } }))).toBe(true);
    expect(isWebSocketUpgrade(new Request('https://example.test'))).toBe(false);
  });
});

describe('Worker relay route envelopes', () => {
  it('round-trips a valid client/original request route', () => {
    const encoded = encodeRelayRoute({ clientId: 'ipad-client-1', originalId: 'request-9' });
    expect(encoded).not.toBeNull();
    expect(parseRelayRoute(encoded!)).toEqual({ clientId: 'ipad-client-1', originalId: 'request-9' });
  });

  it('rejects malformed and overlong routes', () => {
    expect(parseRelayRoute('{not-json')).toBeNull();
    expect(parseRelayRoute(JSON.stringify({ clientId: '', originalId: 'ok' }))).toBeNull();
    expect(parseRelayRoute(JSON.stringify({ clientId: 'ok', originalId: '' }))).toBeNull();
    expect(encodeRelayRoute({ clientId: 'x'.repeat(RELAY_LIMITS.routeClientIdLength + 1), originalId: 'ok' })).toBeNull();
    expect(encodeRelayRoute({ clientId: 'ok', originalId: 'x'.repeat(RELAY_LIMITS.messageIdLength + 1) })).toBeNull();
  });
});

describe('Worker relay message validation', () => {
  it('accepts a bounded execute envelope', () => {
    expect(parseRelayMessage(JSON.stringify({
      type: 'execute',
      id: 'request-1',
      code: 'return 1;',
      timestamp: 1,
    }))).toMatchObject({ type: 'execute', id: 'request-1', code: 'return 1;' });
  });

  it('rejects malformed JSON, invalid status fields, and overlong strings', () => {
    expect(parseRelayMessage('{')).toBeNull();
    expect(parseRelayMessage('[]')).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ type: 'x'.repeat(65) }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ id: 'x'.repeat(RELAY_LIMITS.messageIdLength + 1) }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ error: 'x'.repeat(RELAY_LIMITS.errorLength + 1) }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ edaConnected: 'yes' }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ localBridgePort: 0 }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ localBridgePort: 70000 }))).toBeNull();
    expect(parseRelayMessage(JSON.stringify({ timestamp: Number.NaN }))).toBeNull();
  });

  it('enforces frame and execute payload byte limits, including multibyte input', () => {
    expect(relayCodeBytesWithinLimit('a'.repeat(RELAY_LIMITS.codeBytes))).toBe(true);
    expect(relayCodeBytesWithinLimit('a'.repeat(RELAY_LIMITS.codeBytes + 1))).toBe(false);
    expect(relayCodeBytesWithinLimit('é'.repeat(RELAY_LIMITS.codeBytes / 2))).toBe(true);
    expect(relayCodeBytesWithinLimit('é'.repeat(RELAY_LIMITS.codeBytes / 2 + 1))).toBe(false);

    expect(relayFrameBytesWithinLimit('a'.repeat(RELAY_LIMITS.frameBytes))).toBe(true);
    expect(relayFrameBytesWithinLimit('a'.repeat(RELAY_LIMITS.frameBytes + 1))).toBe(false);
    expect(parseRelayMessage(' '.repeat(RELAY_LIMITS.frameBytes + 1))).toBeNull();
  });
});
