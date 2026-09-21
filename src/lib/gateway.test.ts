import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyEdaGatewayClient, GATEWAY_RELIABILITY, type GatewayStatus } from './gateway';

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
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

function lastSent(socket: FakeWebSocket): Record<string, unknown> {
  const raw = socket.sent.at(-1);
  if (!raw) throw new Error('Expected a sent WebSocket frame');
  return JSON.parse(raw) as Record<string, unknown>;
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
    client.connect('ws://gateway.test');
    const first = FakeWebSocket.instances[0];
    first.open();
    first.serverMessage({
      type: 'handshake',
      service: 'easyeda-bridge',
      via: 'cloudflare-worker',
      vpsConnected: true,
      edaConnected: true,
      localBridgePort: 49620,
    });

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

    client.connect('ws://gateway.test');
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.serverMessage({
      type: 'handshake',
      service: 'easyeda-bridge',
      via: 'cloudflare-worker',
      vpsConnected: true,
    });
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
});
