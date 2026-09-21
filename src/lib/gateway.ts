export type GatewayState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type GatewayStatus = {
  via?: string;
  vpsConnected?: boolean;
  edaConnected?: boolean;
  localBridgePort?: number | null;
};

type GatewayMessageType = 'handshake' | 'execute' | 'result' | 'error' | 'ping' | 'pong' | 'companion-status' | 'relay-status';

type GatewayMessage = {
  type: GatewayMessageType;
  id?: string;
  service?: string;
  clientType?: string;
  result?: unknown;
  error?: string;
  via?: string;
  vpsConnected?: boolean;
  edaConnected?: boolean;
  localBridgePort?: number | null;
  timestamp?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: number;
};

export const GATEWAY_RELIABILITY = Object.freeze({
  handshakeTimeoutMs: 8_000,
  heartbeatIntervalMs: 15_000,
  pongTimeoutMs: 10_000,
  reconnectInitialMs: 1_000,
  reconnectMaxMs: 15_000,
});

const GATEWAY_MESSAGE_TYPES = new Set<GatewayMessageType>([
  'handshake',
  'execute',
  'result',
  'error',
  'ping',
  'pong',
  'companion-status',
  'relay-status',
]);
const MAX_GATEWAY_FRAME_BYTES = 160 * 1024;
const MAX_ID_LENGTH = 1024;
const MAX_STATUS_TEXT_LENGTH = 2048;
const textEncoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalBoundedString(record: Record<string, unknown>, key: string, maxLength: number): boolean {
  const value = record[key];
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function parseGatewayMessage(raw: unknown): GatewayMessage | null {
  if (typeof raw !== 'string' || textEncoder.encode(raw).byteLength > MAX_GATEWAY_FRAME_BYTES) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value) || typeof value.type !== 'string' || !GATEWAY_MESSAGE_TYPES.has(value.type as GatewayMessageType)) {
    return null;
  }
  if (!optionalBoundedString(value, 'id', MAX_ID_LENGTH)) return null;
  if (!optionalBoundedString(value, 'service', 128)) return null;
  if (!optionalBoundedString(value, 'clientType', 128)) return null;
  if (!optionalBoundedString(value, 'error', MAX_STATUS_TEXT_LENGTH)) return null;
  if (!optionalBoundedString(value, 'via', 128)) return null;
  if (value.vpsConnected !== undefined && typeof value.vpsConnected !== 'boolean') return null;
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

  return value as GatewayMessage;
}

export class EasyEdaGatewayClient extends EventTarget {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private stateValue: GatewayState = 'disconnected';
  private heartbeatTimer: number | null = null;
  private handshakeTimer: number | null = null;
  private pongTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private outstandingPingId: string | null = null;
  private targetUrl: string | null = null;
  private reconnectEnabled = false;
  private reconnectDelayMs = GATEWAY_RELIABILITY.reconnectInitialMs;

  get state(): GatewayState {
    return this.stateValue;
  }

  connect(url: string): void {
    this.reconnectEnabled = false;
    this.targetUrl = null;
    this.clearReconnectTimer();

    const previousSocket = this.socket;
    this.socket = null;
    this.stopConnectionTimers();
    try { previousSocket?.close(1000, 'Replacing gateway connection'); } catch { /* no-op */ }
    this.rejectPending(new Error('Gateway connection replaced'));

    this.targetUrl = url;
    this.reconnectEnabled = true;
    this.reconnectDelayMs = GATEWAY_RELIABILITY.reconnectInitialMs;
    this.dispatchStatus({ vpsConnected: false, edaConnected: false, localBridgePort: null });
    this.openSocket();
  }

  disconnect(): void {
    this.reconnectEnabled = false;
    this.targetUrl = null;
    this.clearReconnectTimer();

    const socket = this.socket;
    this.socket = null;
    this.stopConnectionTimers();
    try { socket?.close(1000, 'Gateway disconnected'); } catch { /* no-op */ }
    this.rejectPending(new Error('Gateway disconnected'));
    this.setState('disconnected');
    this.dispatchStatus({ vpsConnected: false, edaConnected: false, localBridgePort: null });
  }

  async execute<T = unknown>(code: string, timeoutMs = 30_000): Promise<T> {
    if (!this.socket || this.stateValue !== 'connected') {
      throw new Error('Gateway is not connected');
    }

    const id = crypto.randomUUID();
    const payload = {
      type: 'execute',
      id,
      code,
      timestamp: Date.now(),
    };

    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });

      this.socket?.send(JSON.stringify(payload));
    });
  }

  private openSocket(): void {
    if (!this.reconnectEnabled || !this.targetUrl) return;
    this.clearReconnectTimer();
    this.setState('connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.targetUrl);
    } catch {
      this.setState('error');
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    this.startHandshakeDeadline(socket);

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return;
      this.handleMessage(socket, event);
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopConnectionTimers();
      this.rejectPending(new Error('Gateway connection closed'));
      this.setState('disconnected');
      this.dispatchStatus({ vpsConnected: false, edaConnected: false, localBridgePort: null });
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      if (this.socket !== socket) return;
      this.setState('error');
      try { socket.close(); } catch { /* close event drives retry */ }
    });
  }

  private handleMessage(socket: WebSocket, event: MessageEvent): void {
    const message = parseGatewayMessage(event.data);
    if (!message) return;

    if (message.type === 'handshake') {
      if (message.service !== 'easyeda-bridge') {
        this.setState('error');
        try { socket.close(1008, 'Invalid gateway handshake'); } catch { /* no-op */ }
        return;
      }
      this.clearHandshakeTimer();
      this.reconnectDelayMs = GATEWAY_RELIABILITY.reconnectInitialMs;
      this.setState('connected');
      this.dispatchStatus({
        via: message.via,
        vpsConnected: message.vpsConnected,
        edaConnected: message.edaConnected,
        localBridgePort: message.localBridgePort,
      });
      this.startHeartbeat(socket);
      return;
    }

    if (message.type === 'relay-status' || message.type === 'companion-status') {
      this.dispatchStatus({
        via: message.via,
        vpsConnected: message.vpsConnected,
        edaConnected: message.edaConnected,
        localBridgePort: message.localBridgePort,
      });
      return;
    }

    if (message.type === 'ping') {
      socket.send(JSON.stringify({
        type: 'pong',
        id: message.id,
        timestamp: Date.now(),
      }));
      return;
    }

    if (message.type === 'pong') {
      if (message.id && message.id === this.outstandingPingId) this.clearPongTimer();
      return;
    }

    if ((message.type === 'result' || message.type === 'error') && message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      window.clearTimeout(pending.timer);
      this.pending.delete(message.id);

      if (message.type === 'error') {
        pending.reject(new Error(message.error ?? 'Unknown gateway error'));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private startHandshakeDeadline(socket: WebSocket): void {
    this.clearHandshakeTimer();
    this.handshakeTimer = window.setTimeout(() => {
      if (this.socket !== socket || this.stateValue !== 'connecting') return;
      this.setState('error');
      try { socket.close(4000, 'Gateway handshake timeout'); } catch { /* no-op */ }
    }, GATEWAY_RELIABILITY.handshakeTimeoutMs);
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer !== null) {
      window.clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private startHeartbeat(socket: WebSocket): void {
    this.clearHeartbeatTimer();
    this.clearPongTimer();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket !== socket || socket.readyState !== WebSocket.OPEN || this.stateValue !== 'connected') return;
      if (this.outstandingPingId !== null) return;

      const id = `ipad-${crypto.randomUUID()}`;
      this.outstandingPingId = id;
      socket.send(JSON.stringify({
        type: 'ping',
        id,
        timestamp: Date.now(),
      }));
      this.pongTimer = window.setTimeout(() => {
        if (this.socket !== socket || this.outstandingPingId !== id) return;
        this.setState('error');
        try { socket.close(4000, 'Gateway heartbeat timeout'); } catch { /* no-op */ }
      }, GATEWAY_RELIABILITY.pongTimeoutMs);
    }, GATEWAY_RELIABILITY.heartbeatIntervalMs);
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearPongTimer(): void {
    if (this.pongTimer !== null) {
      window.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.outstandingPingId = null;
  }

  private stopConnectionTimers(): void {
    this.clearHandshakeTimer();
    this.clearHeartbeatTimer();
    this.clearPongTimer();
  }

  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || !this.targetUrl || this.reconnectTimer !== null) return;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, GATEWAY_RELIABILITY.reconnectMaxMs);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private dispatchStatus(status: GatewayStatus): void {
    this.dispatchEvent(new CustomEvent<GatewayStatus>('statuschange', { detail: status }));
  }

  private setState(next: GatewayState): void {
    if (this.stateValue === next) return;
    this.stateValue = next;
    this.dispatchEvent(new CustomEvent<GatewayState>('statechange', { detail: next }));
  }
}
