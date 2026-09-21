import { DurableObject } from 'cloudflare:workers';
import {
  bearerToken,
  encodeRelayRoute,
  isRecord,
  isWebSocketUpgrade,
  parseRelayMessage,
  parseRelayRoute,
  relayCodeBytesWithinLimit,
  relayFrameBytesWithinLimit,
  safeEqual,
  validSession,
  type RelayMessage,
} from './protocol';

interface Bindings {
  ASSETS: Fetcher;
  SESSIONS: DurableObjectNamespace;
  IPAD_TOKEN: string;
  VPS_TOKEN: string;
}

type Role = 'ipad' | 'vps';

type SocketAttachment = {
  role: Role;
  clientId: string;
  connectedAt: number;
  edaConnected?: boolean;
  localBridgePort?: number | null;
};

const SERVICE_ID = 'easyeda-bridge';

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function sessionStub(env: Bindings, session: string): Promise<DurableObjectStub> {
  const id = env.SESSIONS.idFromName(session);
  return env.SESSIONS.get(id);
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        service: 'easyeda-ipad-cloud',
        status: 'ok',
        timestamp: Date.now(),
      });
    }

    const statusMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/status$/);
    if (statusMatch) {
      const session = decodeURIComponent(statusMatch[1]);
      if (!validSession(session)) return json({ error: 'Invalid session' }, { status: 400 });
      if (!env.IPAD_TOKEN) return json({ error: 'IPAD_TOKEN is not configured' }, { status: 503 });
      if (!safeEqual(bearerToken(request, url), env.IPAD_TOKEN)) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const stub = await sessionStub(env, session);
      return stub.fetch(new Request('https://session.internal/status'));
    }

    if (url.pathname === '/ws/ipad' || url.pathname === '/ws/vps') {
      if (!isWebSocketUpgrade(request)) return json({ error: 'WebSocket upgrade required' }, { status: 426 });

      const role: Role = url.pathname.endsWith('/vps') ? 'vps' : 'ipad';
      const session = url.searchParams.get('session') ?? 'default';
      if (!validSession(session)) return json({ error: 'Invalid session' }, { status: 400 });

      const expected = role === 'vps' ? env.VPS_TOKEN : env.IPAD_TOKEN;
      if (!expected) return json({ error: `${role === 'vps' ? 'VPS_TOKEN' : 'IPAD_TOKEN'} is not configured` }, { status: 503 });
      if (!safeEqual(bearerToken(request, url), expected)) return json({ error: 'Unauthorized' }, { status: 401 });

      const stub = await sessionStub(env, session);
      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete('token');
      const headers = new Headers(request.headers);
      headers.set('x-easyeda-role', role);
      headers.set('x-easyeda-session', session);
      headers.delete('authorization');

      return stub.fetch(new Request(cleanUrl.toString(), {
        method: 'GET',
        headers,
      }));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Bindings>;

export class EasyEdaSession extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      const sockets = this.ctx.getWebSockets();
      const vps = this.roleSockets('vps')[0];
      const companion = vps ? this.attachment(vps) : null;
      const ipadClients = sockets.filter((socket) => this.attachment(socket)?.role === 'ipad').length;
      return json({
        service: 'easyeda-ipad-session',
        status: 'ok',
        vpsConnected: Boolean(vps),
        edaConnected: companion?.edaConnected ?? false,
        localBridgePort: companion?.localBridgePort ?? null,
        ipadClients,
        timestamp: Date.now(),
      });
    }

    const role = request.headers.get('x-easyeda-role');
    if (role !== 'ipad' && role !== 'vps') return json({ error: 'Invalid relay role' }, { status: 403 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'WebSocket upgrade required' }, { status: 426 });
    }

    if (role === 'vps') {
      for (const socket of this.roleSockets('vps')) {
        try { socket.close(4001, 'Replaced by a newer PC companion connection'); } catch { /* no-op */ }
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: SocketAttachment = {
      role,
      clientId: crypto.randomUUID(),
      connectedAt: Date.now(),
      ...(role === 'vps' ? { edaConnected: false, localBridgePort: null } : {}),
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    if (role === 'ipad') {
      this.send(server, {
        type: 'handshake',
        service: SERVICE_ID,
        clientType: 'ipad',
        via: 'cloudflare-worker',
        vpsConnected: this.roleSockets('vps').length > 0,
        timestamp: Date.now(),
      });
      this.sendRelayStatus(server);
    } else {
      this.send(server, {
        type: 'handshake',
        service: 'easyeda-ipad-cloud-relay',
        clientType: 'vps',
        timestamp: Date.now(),
      });
      this.broadcastRelayStatus();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') {
      this.send(socket, { type: 'error', error: 'Binary frames are not supported', timestamp: Date.now() });
      return;
    }
    if (!relayFrameBytesWithinLimit(raw)) {
      socket.close(1009, 'Message too large');
      return;
    }

    const message = parseRelayMessage(raw);
    if (!message) {
      this.send(socket, { type: 'error', error: 'Invalid message envelope', timestamp: Date.now() });
      return;
    }

    const attachment = this.attachment(socket);
    if (!attachment) {
      socket.close(1011, 'Missing connection state');
      return;
    }

    if (message.type === 'ping') {
      this.send(socket, { type: 'pong', id: message.id, timestamp: Date.now() });
      return;
    }

    if (attachment.role === 'ipad') {
      this.handleIpadMessage(socket, attachment, message);
      return;
    }

    this.handleVpsMessage(socket, attachment, message);
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    const role = this.attachment(socket)?.role;
    try { socket.close(code, reason); } catch { /* runtime may already have closed it */ }
    if (role === 'vps') this.broadcastRelayStatus();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const role = this.attachment(socket)?.role;
    try { socket.close(1011, 'WebSocket error'); } catch { /* no-op */ }
    if (role === 'vps') this.broadcastRelayStatus();
  }

  private handleIpadMessage(socket: WebSocket, attachment: SocketAttachment, message: RelayMessage): void {
    if (message.type !== 'execute') return;
    if (!message.id || typeof message.id !== 'string' || typeof message.code !== 'string') {
      this.send(socket, { type: 'error', id: message.id, error: 'Invalid execute request', timestamp: Date.now() });
      return;
    }
    if (!relayCodeBytesWithinLimit(message.code)) {
      this.send(socket, { type: 'error', id: message.id, error: 'Execute payload is too large', timestamp: Date.now() });
      return;
    }

    const vps = this.roleSockets('vps')[0];
    if (!vps) {
      this.send(socket, { type: 'error', id: message.id, error: 'PC companion is not connected', timestamp: Date.now() });
      return;
    }

    const routeId = encodeRelayRoute({ clientId: attachment.clientId, originalId: message.id });
    if (!routeId) {
      this.send(socket, { type: 'error', id: message.id, error: 'Invalid relay route', timestamp: Date.now() });
      return;
    }

    this.send(vps, {
      type: 'execute',
      id: routeId,
      code: message.code,
      timestamp: Date.now(),
    });
  }

  private handleVpsMessage(socket: WebSocket, attachment: SocketAttachment, message: RelayMessage): void {
    if (message.type === 'vps-status') {
      const updated: SocketAttachment = {
        ...attachment,
        edaConnected: Boolean(message.edaConnected),
        localBridgePort: message.localBridgePort ?? null,
      };
      socket.serializeAttachment(updated);
      this.broadcastRelayStatus();
      return;
    }

    if ((message.type !== 'result' && message.type !== 'error') || typeof message.id !== 'string') return;

    const route = parseRelayRoute(message.id);
    if (!route) return;

    const target = this.roleSockets('ipad').find((candidate) => this.attachment(candidate)?.clientId === route.clientId);
    if (!target) return;

    this.send(target, {
      ...message,
      id: route.originalId,
      timestamp: Date.now(),
    });
  }

  private attachment(socket: WebSocket): SocketAttachment | null {
    const value = socket.deserializeAttachment() as unknown;
    if (!isRecord(value)) return null;
    if (value.role !== 'ipad' && value.role !== 'vps') return null;
    if (typeof value.clientId !== 'string' || value.clientId.length === 0 || value.clientId.length > 128) return null;
    if (typeof value.connectedAt !== 'number' || !Number.isFinite(value.connectedAt)) return null;
    if (value.edaConnected !== undefined && typeof value.edaConnected !== 'boolean') return null;
    if (
      value.localBridgePort !== undefined
      && value.localBridgePort !== null
      && (typeof value.localBridgePort !== 'number'
        || !Number.isInteger(value.localBridgePort)
        || value.localBridgePort < 1
        || value.localBridgePort > 65_535)
    ) return null;
    return {
      role: value.role,
      clientId: value.clientId,
      connectedAt: value.connectedAt,
      ...(value.edaConnected !== undefined ? { edaConnected: value.edaConnected } : {}),
      ...(value.localBridgePort !== undefined ? { localBridgePort: value.localBridgePort } : {}),
    };
  }

  private roleSockets(role: Role): WebSocket[] {
    return this.ctx.getWebSockets().filter((socket) => this.attachment(socket)?.role === role);
  }

  private send(socket: WebSocket, payload: unknown): void {
    try { socket.send(JSON.stringify(payload)); } catch { /* peer may have disconnected */ }
  }

  private sendRelayStatus(socket: WebSocket): void {
    const vps = this.roleSockets('vps')[0];
    const companion = vps ? this.attachment(vps) : null;
    this.send(socket, {
      type: 'relay-status',
      vpsConnected: Boolean(vps),
      edaConnected: companion?.edaConnected ?? false,
      localBridgePort: companion?.localBridgePort ?? null,
      timestamp: Date.now(),
    });
  }

  private broadcastRelayStatus(): void {
    for (const ipad of this.roleSockets('ipad')) this.sendRelayStatus(ipad);
  }
}
