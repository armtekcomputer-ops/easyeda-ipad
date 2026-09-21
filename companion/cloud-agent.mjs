import { WebSocket } from 'ws';

const LOCAL_HOST = '127.0.0.1';
const LOCAL_PORT_START = 49620;
const LOCAL_PORT_END = 49629;
const SERVICE_ID = 'easyeda-bridge';
const CLOUD_SERVICE_ID = 'easyeda-ipad-cloud-relay';
const SESSION_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CODE_BYTES = 128 * 1024;

const cloudBaseUrl = (process.env.EASYEDA_CLOUD_URL || '').trim();
const vpsToken = (process.env.EASYEDA_VPS_TOKEN || '').trim();
const session = (process.env.EASYEDA_SESSION || 'default').trim();

if (!cloudBaseUrl) {
  console.error('[cloud-agent] EASYEDA_CLOUD_URL is required, for example https://easyeda-ipad.example.workers.dev');
  process.exit(1);
}
if (!vpsToken) {
  console.error('[cloud-agent] EASYEDA_VPS_TOKEN is required');
  process.exit(1);
}
if (!SESSION_RE.test(session)) {
  console.error('[cloud-agent] EASYEDA_SESSION must match [A-Za-z0-9_-] and be 1-64 characters');
  process.exit(1);
}

function buildCloudUrl() {
  const url = new URL(cloudBaseUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : url.protocol === 'https:' ? 'wss:' : url.protocol;
  url.pathname = '/ws/vps';
  url.search = '';
  url.searchParams.set('session', session);
  url.searchParams.set('token', vpsToken);
  return url.toString();
}

function sendJson(socket, payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

let localSocket = null;
let localPort = null;
let localGeneration = 0;
let localRetryTimer = null;
let localRetryMs = 1_000;

let cloudSocket = null;
let cloudGeneration = 0;
let cloudRetryTimer = null;
let cloudRetryMs = 1_000;

const pendingRelayIds = new Set();
let stopping = false;

function statusPayload() {
  return {
    type: 'vps-status',
    edaConnected: localSocket?.readyState === WebSocket.OPEN,
    localBridgePort: localPort,
    timestamp: Date.now(),
  };
}

function sendStatusToCloud() {
  sendJson(cloudSocket, statusPayload());
}

function clearTimer(timer) {
  if (timer) clearTimeout(timer);
}

function scheduleLocalReconnect() {
  if (stopping || localRetryTimer) return;
  const delay = Math.min(localRetryMs, 15_000);
  localRetryMs = Math.min(localRetryMs * 2, 15_000);
  localRetryTimer = setTimeout(() => {
    localRetryTimer = null;
    void connectLocalBridge();
  }, delay);
}

function scheduleCloudReconnect() {
  if (stopping || cloudRetryTimer) return;
  const jitter = Math.floor(Math.random() * 500);
  const delay = Math.min(cloudRetryMs, 30_000) + jitter;
  cloudRetryMs = Math.min(cloudRetryMs * 2, 30_000);
  cloudRetryTimer = setTimeout(() => {
    cloudRetryTimer = null;
    connectCloud();
  }, delay);
}

function tryLocalPort(port, generation) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(`ws://${LOCAL_HOST}:${port}/ipad-cloud-agent`);
    const timeout = setTimeout(() => finish(null), 1_200);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!result) {
        try { socket.close(); } catch { /* no-op */ }
      }
      resolve(result);
    };

    socket.once('message', (raw) => {
      if (generation !== localGeneration) return finish(null);
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'handshake' && message.service === SERVICE_ID) return finish(socket);
      } catch { /* invalid handshake */ }
      finish(null);
    });
    socket.once('error', () => finish(null));
    socket.once('close', () => finish(null));
  });
}

async function connectLocalBridge() {
  if (stopping || localSocket?.readyState === WebSocket.OPEN) return;
  const generation = ++localGeneration;

  for (let port = LOCAL_PORT_START; port <= LOCAL_PORT_END; port += 1) {
    if (generation !== localGeneration || stopping) return;
    const socket = await tryLocalPort(port, generation);
    if (!socket) continue;
    if (generation !== localGeneration || stopping) {
      try { socket.close(); } catch { /* no-op */ }
      return;
    }

    localSocket = socket;
    localPort = port;
    localRetryMs = 1_000;
    console.log(`[cloud-agent] EasyEDA bridge connected on 127.0.0.1:${port}`);

    socket.on('message', (raw) => onLocalMessage(socket, raw));
    socket.on('close', () => onLocalClosed(socket));
    socket.on('error', () => {});
    sendStatusToCloud();
    return;
  }

  console.log('[cloud-agent] EasyEDA bridge not found on 49620-49629; retrying');
  localSocket = null;
  localPort = null;
  sendStatusToCloud();
  scheduleLocalReconnect();
}

function onLocalMessage(socket, raw) {
  if (socket !== localSocket) return;
  let message;
  try { message = JSON.parse(raw.toString()); } catch { return; }

  if (message.type === 'ping') {
    sendJson(socket, { type: 'pong', id: message.id, timestamp: Date.now() });
    return;
  }

  if ((message.type === 'result' || message.type === 'error') && typeof message.id === 'string') {
    pendingRelayIds.delete(message.id);
    sendJson(cloudSocket, message);
  }
}

function onLocalClosed(socket) {
  if (socket !== localSocket) return;
  console.warn('[cloud-agent] EasyEDA bridge disconnected');
  localSocket = null;
  localPort = null;

  for (const id of pendingRelayIds) {
    sendJson(cloudSocket, {
      type: 'error',
      id,
      error: 'EasyEDA bridge disconnected on VPS',
      timestamp: Date.now(),
    });
  }
  pendingRelayIds.clear();
  sendStatusToCloud();
  scheduleLocalReconnect();
}

function connectCloud() {
  if (stopping || cloudSocket?.readyState === WebSocket.OPEN || cloudSocket?.readyState === WebSocket.CONNECTING) return;
  const generation = ++cloudGeneration;
  const url = buildCloudUrl();
  console.log(`[cloud-agent] Connecting Cloudflare relay for session "${session}"`);

  const socket = new WebSocket(url);
  cloudSocket = socket;
  let verified = false;

  socket.on('message', (raw) => {
    if (socket !== cloudSocket || generation !== cloudGeneration) return;
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }

    if (!verified) {
      if (message.type === 'handshake' && message.service === CLOUD_SERVICE_ID) {
        verified = true;
        cloudRetryMs = 1_000;
        console.log('[cloud-agent] Cloudflare relay connected');
        sendStatusToCloud();
        return;
      }
      console.error('[cloud-agent] Invalid Cloudflare relay handshake');
      socket.close(1008, 'Invalid relay handshake');
      return;
    }

    if (message.type === 'ping') {
      sendJson(socket, { type: 'pong', id: message.id, timestamp: Date.now() });
      return;
    }

    if (message.type !== 'execute') return;
    if (typeof message.id !== 'string' || typeof message.code !== 'string') {
      sendJson(socket, { type: 'error', id: message.id, error: 'Invalid execute request', timestamp: Date.now() });
      return;
    }
    if (Buffer.byteLength(message.code, 'utf8') > MAX_CODE_BYTES) {
      sendJson(socket, { type: 'error', id: message.id, error: 'Execute payload is too large', timestamp: Date.now() });
      return;
    }
    if (!localSocket || localSocket.readyState !== WebSocket.OPEN) {
      sendJson(socket, { type: 'error', id: message.id, error: 'EasyEDA bridge is not connected on VPS', timestamp: Date.now() });
      return;
    }

    pendingRelayIds.add(message.id);
    sendJson(localSocket, {
      type: 'execute',
      id: message.id,
      code: message.code,
      timestamp: Date.now(),
    });
  });

  socket.on('close', (code) => {
    if (socket !== cloudSocket) return;
    cloudSocket = null;
    verified = false;
    if (!stopping) {
      console.warn(`[cloud-agent] Cloudflare relay disconnected (${code}); reconnecting`);
      scheduleCloudReconnect();
    }
  });

  socket.on('error', (error) => {
    if (socket === cloudSocket) console.warn(`[cloud-agent] Cloudflare relay error: ${error.message}`);
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[cloud-agent] ${signal}: shutting down`);
  clearTimer(localRetryTimer);
  clearTimer(cloudRetryTimer);
  localRetryTimer = null;
  cloudRetryTimer = null;
  try { cloudSocket?.close(1000, 'Agent shutting down'); } catch { /* no-op */ }
  try { localSocket?.close(1000, 'Agent shutting down'); } catch { /* no-op */ }
  setTimeout(() => process.exit(0), 100).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('EasyEDA iPad VPS Cloud Agent');
console.log(`Session: ${session}`);
console.log('Local bridge: 127.0.0.1:49620-49629');
console.log('Cloud mode: outbound WebSocket only');

void connectLocalBridge();
connectCloud();
