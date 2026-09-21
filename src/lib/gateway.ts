export type GatewayState = 'disconnected' | 'connecting' | 'connected' | 'error';

type GatewayMessage = {
  type: 'handshake' | 'execute' | 'result' | 'error' | 'ping' | 'pong';
  id?: string;
  service?: string;
  clientType?: string;
  result?: unknown;
  error?: string;
  timestamp?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: number;
};

export class EasyEdaGatewayClient extends EventTarget {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private stateValue: GatewayState = 'disconnected';
  private heartbeatTimer: number | null = null;

  get state(): GatewayState {
    return this.stateValue;
  }

  connect(url: string): void {
    this.disconnect();
    this.setState('connecting');

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('message', (event) => this.handleMessage(event));
    socket.addEventListener('close', () => {
      this.stopHeartbeat();
      this.rejectPending(new Error('Gateway connection closed'));
      this.setState('disconnected');
    });
    socket.addEventListener('error', () => this.setState('error'));
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.rejectPending(new Error('Gateway disconnected'));
    this.setState('disconnected');
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

  private handleMessage(event: MessageEvent<string>): void {
    let message: GatewayMessage;
    try {
      message = JSON.parse(event.data) as GatewayMessage;
    } catch {
      return;
    }

    if (message.type === 'handshake') {
      if (message.service !== 'easyeda-bridge') {
        this.setState('error');
        this.socket?.close();
        return;
      }
      this.setState('connected');
      this.startHeartbeat();
      return;
    }

    if (message.type === 'ping') {
      this.socket?.send(JSON.stringify({
        type: 'pong',
        id: message.id,
        timestamp: Date.now(),
      }));
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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({
        type: 'ping',
        id: `ipad-${Date.now()}`,
        timestamp: Date.now(),
      }));
    }, 15_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private setState(next: GatewayState): void {
    if (this.stateValue === next) return;
    this.stateValue = next;
    this.dispatchEvent(new CustomEvent<GatewayState>('statechange', { detail: next }));
  }
}
