import { WebSocket } from 'ws';
import { PendingRelayTracker } from './relay-pending.mjs';

const LOCAL_HOST = '127.0.0.1';
const LOCAL_PORT_START = 49620;
const LOCAL_PORT_END = 49629;
const SERVICE_ID = 'easyeda-bridge';
const CLOUD_SERVICE_ID = 'easyeda-ipad-cloud-relay';
const SESSION_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CODE_BYTES = 128 * 1024;
const MAX_FRAME_BYTES = MAX_CODE_BYTES + 16 * 1024;
const MAX_ID_LENGTH = 2048;
const MAX_ERROR_LENGTH = 4096;
const CLOUD_HANDSHAKE_TIMEOUT_MS = 5_000;
const CLOUD_HEARTBEAT_INTERVAL_MS = 15_000;
const CLOUD_PONG_TIMEOUT_MS = 10_000;
const MAX_PENDING_RELAY_REQUESTS = 64;
const RELAY_REQUEST_TTL_MS = 35_000;

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
  if (socket?.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalBoundedString(record, key, maxLength) {
  const value = record[key];
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function parseMessage(raw) {
  const text = raw.toString();
  if (Buffer.byteLength(text, 'utf8') > MAX_FRAME_BYTES) return null;

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (value.type !== undefined && (typeof value.type !== 'string' || value.type.length > 64)) return null;
  if (!optionalBoundedString(value, 'id', MAX_ID_LENGTH)) return null;
  if (!optionalBoundedString(value, 'service', 128)) return null;
  if (!optionalBoundedString(value, 'code', MAX_CODE_BYTES)) return null;
  if (!optionalBoundedString(value, 'error', MAX_ERROR_LENGTH)) return null;
  if (value.edaConnected !== undefined && typeof value.edaConnected !== 'boolean') return null;
  if (
    value.localBridgePort !== undefined
    && value.localBridgePort !== null
    && (!Number.isInteger(value.localBridgePort) || value.localBridgePort < 1 || value.localBridgePort > 65_535)
  ) return null;
  if (value.timestamp !== undefined && (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp))) return null;
  return value;
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
let cloudHandshakeTimer = null;
let cloudHeartbeatTimer = null;
let cloudPongTimer = null;
let cloudPingId = null;

let stopping = false;

const pendingRelayIds = new PendingRelayTracker({
  maxInFlight: MAX_PENDING_RELAY_REQUESTS,
  ttlMs: RELAY_REQUEST_TTL_MS,
  onExpire: ({ id, meta }) => {
    if (stopping || meta.cloudGeneration !== cloudGeneration || meta.localGeneration !== localGeneration) return;
    sendJson(cloudSocket, {
      type: 'error',
      id,
      error: `EasyEDA bridge request timed out after ${RELAY_REQUEST_TTL_MS}ms on PC companion`,
      timestamp: Date.now(),
    });
  },
});

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

function clearCloudHandshakeTimer() {
  clearTimer(cloudHandshakeTimer);
  cloudHandshakeTimer = null;
}

function stopCloudHeartbeat() {
  if (cloudHeartbeatTimer) clearInterval(cloudHeartbeatTimer);
  clearTimer(cloudPongTimer);
  cloudHeartbeatTimer = null;
  cloudPongTimer = null;
  cloudPingId = null;
}

function startCloudHeartbeat(socket, generation) {
  stopCloudHeartbeat();
  cloudHeartbeatTimer = setInterval(() => {
    if (stopping || socket !== cloudSocket || generation !== cloudGeneration || socket.readyState !== WebSocket.OPEN) return;
    if (cloudPingId !== null) return;

    const id = `companion-${generation}-${Date.now()}`;
    cloudPingId = id;
    sendJson(socket, { type: 'ping', id, timestamp: Date.now() });
    cloudPongTimer = setTimeout(() => {
      if (socket !== cloudSocket || generation !== cloudGeneration || cloudPingId !== id) return;
      console.warn('[cloud-agent] Cloudflare relay heartbeat timed out; reconnecting');
      try { socket.close(4000, 'Relay heartbeat timeout'); } catch { /* no-op */ }
    }, CLOUD_PONG_TIMEOUT_MS);
    cloudPongTimer.unref?.();
  }, CLOUD_HEARTBEAT_INTERVAL_MS);
  cloudHeartbeatTimer.unref?.();
}

function acceptCloudPong(message) {
  if (!message.id || message.id !== cloudPingId) return;
  clearTimer(cloudPongTimer);
  cloudPongTimer = null;
  cloudPingId = null;
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
  cloudRetryTimer.unref?.();
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
      const message = parseMessage(raw);
      if (message?.type === 'handshake' && message.service === SERVICE_ID) return finish(socket);
      return finish(null);
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

    socket.on('message', (raw) => onLocalMessage(socket, generation, raw));
    socket.on('close', () => onLocalClosed(socket, generation));
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

function onLocalMessage(socket, generation, raw) {
  if (socket !== localSocket || generation !== localGeneration) return;
  const message = parseMessage(raw);
  if (!message) return;

  if (message.type === 'ping') {
    sendJson(socket, { type: 'pong', id: message.id, timestamp: Date.now() });
    return;
  }

  if ((message.type === 'result' || message.type === 'error') && typeof message.id === 'string') {
    const meta = pendingRelayIds.take(message.id, {
      localGeneration: generation,
      cloudGeneration,
    });
    if (!meta) return;
    sendJson(cloudSocket, message);
  }
}

function onLocalClosed(socket, generation) {
  if (socket !== localSocket || generation !== localGeneration) return;
  console.warn('[cloud-agent] EasyEDA bridge disconnected');
  localSocket = null;
  localPort = null;

  const failed = pendingRelayIds.drain((meta) => meta.localGeneration === generation);
  for (const { id, meta } of failed) {
    if (meta.cloudGeneration !== cloudGeneration) continue;
    sendJson(cloudSocket, {
      type: 'error',
      id,
      error: 'EasyEDA bridge disconnected on PC companion',
      timestamp: Date.now(),
    });
  }
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

  clearCloudHandshakeTimer();
  stopCloudHeartbeat();
  cloudHandshakeTimer = setTimeout(() => {
    if (stopping || socket !== cloudSocket || generation !== cloudGeneration || verified) return;
    console.warn('[cloud-agent] Cloudflare relay handshake timed out; reconnecting');
    try { socket.close(4000, 'Relay handshake timeout'); } catch { /* no-op */ }
  }, CLOUD_HANDSHAKE_TIMEOUT_MS);
  cloudHandshakeTimer.unref?.();

  socket.on('message', (raw) => {
    if (socket !== cloudSocket || generation !== cloudGeneration) return;
    const message = parseMessage(raw);
    if (!message) {
      console.warn('[cloud-agent] Ignoring malformed Cloudflare relay message');
      return;
    }

    if (!verified) {
      if (message.type === 'handshake' && message.service === CLOUD_SERVICE_ID) {
        verified = true;
        clearCloudHandshakeTimer();
        cloudRetryMs = 1_000;
        console.log('[cloud-agent] Cloudflare relay connected');
        sendStatusToCloud();
        startCloudHeartbeat(socket, generation);
        return;
      }
      console.error('[cloud-agent] Invalid Cloudflare relay handshake');
      try { socket.close(1008, 'Invalid relay handshake'); } catch { /* no-op */ }
      return;
    }

    if (message.type === 'ping') {
      sendJson(socket, { type: 'pong', id: message.id, timestamp: Date.now() });
      return;
    }

    if (message.type === 'pong') {
      acceptCloudPong(message);
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
      sendJson(socket, { type: 'error', id: message.id, error: 'EasyEDA bridge is not connected on PC companion', timestamp: Date.now() });
      return;
    }

    const meta = { localGeneration, cloudGeneration: generation };
    const tracking = pendingRelayIds.add(message.id, meta);
    if (tracking === 'duplicate') {
      sendJson(socket, { type: 'error', id: message.id, error: 'Duplicate in-flight relay request ID', timestamp: Date.now() });
      return;
    }
    if (tracking === 'full') {
      sendJson(socket, { type: 'error', id: message.id, error: 'PC companion has too many in-flight EasyEDA requests', timestamp: Date.now() });
      return;
    }
    if (tracking !== 'accepted') {
      sendJson(socket, { type: 'error', id: message.id, error: 'Invalid relay request ID', timestamp: Date.now() });
      return;
    }

    const sent = sendJson(localSocket, {
      type: 'execute',
      id: message.id,
      code: message.code,
      timestamp: Date.now(),
    });
    if (!sent) {
      pendingRelayIds.take(message.id, meta);
      sendJson(socket, { type: 'error', id: message.id, error: 'EasyEDA bridge became unavailable on PC companion', timestamp: Date.now() });
    }
  });

  socket.on('close', (code) => {
    if (socket !== cloudSocket || generation !== cloudGeneration) return;
    cloudSocket = null;
    verified = false;
    clearCloudHandshakeTimer();
    stopCloudHeartbeat();
    pendingRelayIds.drain((meta) => meta.cloudGeneration === generation);
    if (!stopping) {
      console.warn(`[cloud-agent] Cloudflare relay disconnected (${code}); reconnecting`);
      scheduleCloudReconnect();
    }
  });

  socket.on('error', (error) => {
    if (socket === cloudSocket && generation === cloudGeneration) console.warn(`[cloud-agent] Cloudflare relay error: ${error.message}`);
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[cloud-agent] ${signal}: shutting down`);
  clearTimer(localRetryTimer);
  clearTimer(cloudRetryTimer);
  clearCloudHandshakeTimer();
  stopCloudHeartbeat();
  pendingRelayIds.clear();
  localRetryTimer = null;
  cloudRetryTimer = null;
  try { cloudSocket?.close(1000, 'Agent shutting down'); } catch { /* no-op */ }
  try { localSocket?.close(1000, 'Agent shutting down'); } catch { /* no-op */ }
  setTimeout(() => process.exit(0), 100).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('EasyEDA iPad PC Companion Cloud Agent');
console.log(`Session: ${session}`);
console.log('Local bridge: 127.0.0.1:49620-49629');
console.log('Cloud mode: outbound WebSocket only');

void connectLocalBridge();
connectCloud();
