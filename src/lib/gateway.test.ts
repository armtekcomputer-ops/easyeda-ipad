import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EasyEdaGatewayClient,
  GATEWAY_LIMITS,
  GATEWAY_RELIABILITY,
  type GatewayStatus,
} from './gateway';

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
  }

  serverMessage(payload: unknown): void {
    this.serverRaw(JSON.stringify(payload));
  }

  serverRaw(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

function lastSent(socket: FakeWebSocket): Record<string, unknown> {
  const raw = socket.sent.at(-1);
  if (!raw) throw new Error('Expected a sent WebSocket frame');
  return JSON.parse(raw) as Record<string, unknown>;
}

function connectAndHandshake(client: EasyEdaGatewayClient): FakeWebSocket {
  client.connect('ws://gateway.test');
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error('Expected gateway socket');
  socket.open();
  socket.serverMessage({
    type: 'handshake',
    service: 'easyeda-bridge',
    via: 'cloudflare-worker',
    vpsConnected: true,
    edaConnected: true,
    localBridgePort: 49620,
  });
  return socket;
}

describe('EasyEdaGatewayClient reliability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('closes a connection that never handshakes and reconnects with bounded backoff', () => {
    const client = new EasyEdaGatewayClient();
    client.connect('ws://gateway.test');

    expect(client.state).toBe('connecting');
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.handshakeTimeoutMs);
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED);
    expect(client.state).toBe('disconnected');

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.reconnectInitialMs);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(client.state).toBe('connecting');

    client.disconnect();
  });

  it('uses a pong watchdog and automatically recovers a half-open connection', () => {
    const client = new EasyEdaGatewayClient();
    const first = connectAndHandshake(client);

    expect(client.state).toBe('connected');

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.heartbeatIntervalMs);
    const ping = lastSent(first);
    expect(ping.type).toBe('ping');
    expect(typeof ping.id).toBe('string');

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.pongTimeoutMs);
    expect(first.readyState).toBe(FakeWebSocket.CLOSED);
    expect(client.state).toBe('disconnected');

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.reconnectInitialMs);
    expect(FakeWebSocket.instances).toHaveLength(2);
    client.disconnect();
  });

  it('accepts the expected pong, restores status, and disables retries after manual disconnect', () => {
    const client = new EasyEdaGatewayClient();
    const statuses: GatewayStatus[] = [];
    client.addEventListener('statuschange', (event) => {
      statuses.push((event as CustomEvent<GatewayStatus>).detail);
    });

    const socket = connectAndHandshake(client);
    socket.serverMessage({
      type: 'relay-status',
      vpsConnected: true,
      edaConnected: true,
      localBridgePort: 49621,
    });

    expect(statuses.at(-1)).toMatchObject({
      vpsConnected: true,
      edaConnected: true,
      localBridgePort: 49621,
    });

    vi.advanceTimersByTime(GATEWAY_RELIABILITY.heartbeatIntervalMs);
    const ping = lastSent(socket);
    socket.serverMessage({ type: 'pong', id: ping.id, timestamp: Date.now() });
    vi.advanceTimersByTime(GATEWAY_RELIABILITY.pongTimeoutMs);

    expect(client.state).toBe('connected');
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);

    client.disconnect();
    vi.advanceTimersByTime(GATEWAY_RELIABILITY.reconnectMaxMs * 2);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('routes result and error replies only to the matching pending request', async () => {
    const client = new EasyEdaGatewayClient();
    const socket = connectAndHandshake(client);

    const success = client.execute<{ ok: boolean }>('return true;');
    const successFrame = lastSent(socket);
    expect(successFrame.type).toBe('execute');
    socket.serverMessage({ type: 'result', id: successFrame.id, result: { ok: true } });
    await expect(success).resolves.toEqual({ ok: true });

    const failure = client.execute('throw new Error("no")');
    const failureFrame = lastSent(socket);
    socket.serverMessage({ type: 'error', id: 'unrelated', error: 'wrong request' });
    socket.serverMessage({ type: 'error', id: failureFrame.id, error: 'relay failed' });
    await expect(failure).rejects.toThrow('relay failed');

    client.disconnect();
  });

  it('rejects every pending request when the transport disconnects', async () => {
    const client = new EasyEdaGatewayClient();
    const socket = connectAndHandshake(client);

    const first = client.execute('return 1;');
    const second = client.execute('return 2;');
    socket.close(1006, 'network lost');

    await expect(first).rejects.toThrow('Gateway connection closed');
    await expect(second).rejects.toThrow('Gateway connection closed');
    expect(client.state).toBe('disconnected');

    client.disconnect();
  });

  it('ignores malformed, unknown, and oversized inbound frames without corrupting a live session', () => {
    const client = new EasyEdaGatewayClient();
    const socket = connectAndHandshake(client);

    socket.serverRaw('{not-json');
    socket.serverMessage({ type: 'unknown-message', id: 'x' });
    socket.serverMessage({ type: 'relay-status', edaConnected: 'yes' });
    socket.serverRaw('x'.repeat(GATEWAY_LIMITS.frameBytes + 1));

    expect(client.state).toBe('connected');
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);

    client.disconnect();
  });

  it('answers peer pings and preserves the ping request ID', () => {
    const client = new EasyEdaGatewayClient();
    const socket = connectAndHandshake(client);

    socket.serverMessage({ type: 'ping', id: 'peer-ping-7', timestamp: Date.now() });
    expect(lastSent(socket)).toMatchObject({ type: 'pong', id: 'peer-ping-7' });

    client.disconnect();
  });

  it('rejects oversized execute code locally by UTF-8 bytes and sends no frame', async () => {
    const client = new EasyEdaGatewayClient();
    const socket = connectAndHandshake(client);

    await expect(client.execute('a'.repeat(GATEWAY_LIMITS.executeCodeBytes + 1))).rejects.toThrow(/exceeds/i);
    await expect(client.execute('é'.repeat(GATEWAY_LIMITS.executeCodeBytes / 2 + 1))).rejects.toThrow(/exceeds/i);
    expect(socket.sent).toHaveLength(0);

    const boundary = client.execute('a'.repeat(GATEWAY_LIMITS.executeCodeBytes));
    const frame = lastSent(socket);
    expect(frame.type).toBe('execute');
    socket.serverMessage({ type: 'result', id: frame.id, result: 'ok' });
    await expect(boundary).resolves.toBe('ok');

    client.disconnect();
  });
});
