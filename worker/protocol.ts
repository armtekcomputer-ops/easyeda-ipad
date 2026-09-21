export type RelayRoute = {
  clientId: string;
  originalId: string;
};

export type RelayMessage = {
  type?: string;
  id?: string;
  code?: string;
  result?: unknown;
  error?: string;
  edaConnected?: boolean;
  localBridgePort?: number | null;
  timestamp?: number;
};

export const RELAY_LIMITS = Object.freeze({
  codeBytes: 128 * 1024,
  frameBytes: 128 * 1024 + 16 * 1024,
  messageIdLength: 2048,
  errorLength: 4096,
  routeClientIdLength: 128,
  sessionLength: 64,
});

const SESSION_RE = /^[A-Za-z0-9_-]{1,64}$/;
const encoder = new TextEncoder();

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalBoundedString(record: Record<string, unknown>, key: string, maxLength: number): boolean {
  const value = record[key];
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

export function relayFrameBytesWithinLimit(raw: string): boolean {
  return encoder.encode(raw).byteLength <= RELAY_LIMITS.frameBytes;
}

export function relayCodeBytesWithinLimit(code: string): boolean {
  return encoder.encode(code).byteLength <= RELAY_LIMITS.codeBytes;
}

export function safeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function parseRelayMessage(raw: string): RelayMessage | null {
  if (!relayFrameBytesWithinLimit(raw)) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (value.type !== undefined && (typeof value.type !== 'string' || value.type.length > 64)) return null;
  if (!optionalBoundedString(value, 'id', RELAY_LIMITS.messageIdLength)) return null;
  if (!optionalBoundedString(value, 'code', RELAY_LIMITS.codeBytes)) return null;
  if (!optionalBoundedString(value, 'error', RELAY_LIMITS.errorLength)) return null;
  if (value.edaConnected !== undefined && typeof value.edaConnected !== 'boolean') return null;
  if (
    value.localBridgePort !== undefined
    && value.localBridgePort !== null
    && (typeof value.localBridgePort !== 'number'
      || !Number.isInteger(value.localBridgePort)
      || value.localBridgePort < 1
      || value.localBridgePort > 65_535)
  ) return null;
  if (value.timestamp !== undefined && (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp))) return null;

  return value;
}

export function encodeRelayRoute(route: RelayRoute): string | null {
  if (typeof route.clientId !== 'string' || route.clientId.length === 0 || route.clientId.length > RELAY_LIMITS.routeClientIdLength) return null;
  if (typeof route.originalId !== 'string' || route.originalId.length === 0 || route.originalId.length > RELAY_LIMITS.messageIdLength) return null;
  return JSON.stringify(route);
}

export function parseRelayRoute(value: string): RelayRoute | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.clientId !== 'string' || parsed.clientId.length === 0 || parsed.clientId.length > RELAY_LIMITS.routeClientIdLength) return null;
  if (typeof parsed.originalId !== 'string' || parsed.originalId.length === 0 || parsed.originalId.length > RELAY_LIMITS.messageIdLength) return null;
  return { clientId: parsed.clientId, originalId: parsed.originalId };
}

export function bearerToken(request: Request, url: URL): string {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return url.searchParams.get('token') ?? '';
}

export function validSession(value: string | null): value is string {
  return typeof value === 'string' && SESSION_RE.test(value);
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}
