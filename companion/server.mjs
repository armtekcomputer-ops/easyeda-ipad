import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

const LOCAL_BRIDGE_HOST = '127.0.0.1';
const LOCAL_PORT_START = 49620;
const LOCAL_PORT_END = 49629;
const LISTEN_HOST = process.env.EASYEDA_IPAD_HOST || '0.0.0.0';
const LISTEN_PORT = Number(process.env.EASYEDA_IPAD_PORT || 49700);
const ALLOWED_ORIGIN = process.env.EASYEDA_IPAD_ALLOWED_ORIGIN || '';
const TOKEN_FILE = join(homedir(), '.easyeda-ipad-token');
const SERVICE_ID = 'easyeda-bridge';
const MAX_CODE_BYTES = 128 * 1024;

function loadToken() {
  if (process.env.EASYEDA_IPAD_TOKEN) return process.env.EASYEDA_IPAD_TOKEN.trim();
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();

  const token = randomBytes(24).toString('base64url');
  writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  try { chmodSync(TOKEN_FILE, 0o600); } catch { /* Windows ignores POSIX mode */ }
  return token;
}

const pairingToken = loadToken();

function secureTokenEquals(candidate) {
  const expected = Buffer.from(pairingToken);
  const received = Buffer.from(candidate || '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function localAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

let localBridge = null;
let localBridgePort = null;
let reconnectTimer = null;
const pending = new Map();
const clients = new Set();

function sendJson(ws, payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function scheduleLocalReconnect(delay = 2000) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectLocalBridge().catch(() => scheduleLocalReconnect());
  }, delay);
}

function tryLocalPort(port) {
  return new Promise((resolve) => {
    let settled = false;
    const ws = new WebSocket(`ws://${LOCAL_BRIDGE_HOST}:${port}/ipad-companion`);
    const timer = setTimeout(() => finish(null), 900);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!result) ws.close();
      resolve(result);
    };

    ws.once('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'handshake' && message.service === SERVICE_ID) {
          finish(ws);
          return;
        }
      } catch { /* ignore invalid handshake */ }
      finish(null);
    });
    ws.once('error', () => finish(null));
  });
}

async function connectLocalBridge() {
  if (localBridge?.readyState === WebSocket.OPEN) return;

  for (let port = LOCAL_PORT_START; port <= LOCAL_PORT_END; port += 1) {
    const ws = await tryLocalPort(port);
    if (!ws) continue;

    localBridge = ws;
    localBridgePort = port;
    console.log(`[companion] Connected to local EasyEDA bridge on 127.0.0.1:${port}`);

    ws.on('message', onLocalBridgeMessage);
    ws.on('close', () => {
      if (localBridge === ws) {
        localBridge = null;
        localBridgePort = null;
        rejectAllPending('Local EasyEDA bridge disconnected');
        broadcastStatus();
        scheduleLocalReconnect();
      }
    });
    ws.on('error', () => {});
    broadcastStatus();
    return;
  }

  console.log('[companion] EasyEDA bridge not found on ports 49620-49629; retrying…');
  scheduleLocalReconnect(2500);
}

function onLocalBridgeMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if ((message.type === 'result' || message.type === 'error') && message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    sendJson(request.client, {
      ...message,
      id: request.originalId,
    });
  }
}

function rejectAllPending(reason) {
  for (const [relayId, request] of pending) {
    sendJson(request.client, {
      type: 'error',
      id: request.originalId,
      error: reason,
      timestamp: Date.now(),
    });
    pending.delete(relayId);
  }
}

function broadcastStatus() {
  for (const client of clients) {
    sendJson(client, {
      type: 'companion-status',
      edaConnected: localBridge?.readyState === WebSocket.OPEN,
      localBridgePort,
      timestamp: Date.now(),
    });
  }
}

const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      service: 'easyeda-ipad-companion',
      status: 'ok',
      edaConnected: localBridge?.readyState === WebSocket.OPEN,
      localBridgePort,
      ipadClients: clients.size,
      timestamp: Date.now(),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    socket.destroy();
    return;
  }

  const originAllowed = !ALLOWED_ORIGIN || req.headers.origin === ALLOWED_ORIGIN;
  const tokenAllowed = secureTokenEquals(url.searchParams.get('token'));
  if (url.pathname !== '/ipad' || !originAllowed || !tokenAllowed) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  const clientId = randomUUID();
  clients.add(ws);

  sendJson(ws, {
    type: 'handshake',
    service: SERVICE_ID,
    clientType: 'ipad',
    via: 'easyeda-ipad-companion',
    edaConnected: localBridge?.readyState === WebSocket.OPEN,
    timestamp: Date.now(),
  });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'ping') {
      sendJson(ws, { type: 'pong', id: message.id, timestamp: Date.now() });
      return;
    }

    if (message.type !== 'execute') return;
    if (typeof message.code !== 'string' || !message.id) {
      sendJson(ws, { type: 'error', id: message.id, error: 'Invalid execute request', timestamp: Date.now() });
      return;
    }

    if (Buffer.byteLength(message.code, 'utf8') > MAX_CODE_BYTES) {
      sendJson(ws, { type: 'error', id: message.id, error: 'Execute payload is too large', timestamp: Date.now() });
      return;
    }

    if (!localBridge || localBridge.readyState !== WebSocket.OPEN) {
      sendJson(ws, { type: 'error', id: message.id, error: 'EasyEDA bridge is not connected', timestamp: Date.now() });
      return;
    }

    const relayId = `${clientId}:${randomUUID()}`;
    pending.set(relayId, { client: ws, originalId: message.id });
    sendJson(localBridge, {
      type: 'execute',
      id: relayId,
      code: message.code,
      timestamp: Date.now(),
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    for (const [relayId, request] of pending) {
      if (request.client === ws) pending.delete(relayId);
    }
  });
});

httpServer.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log('');
  console.log('EasyEDA iPad Companion');
  console.log(`Listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`Pairing token: ${pairingToken}`);
  for (const address of localAddresses()) {
    console.log(`iPad URL: ws://${address}:${LISTEN_PORT}/ipad?token=${pairingToken}`);
  }
  if (ALLOWED_ORIGIN) console.log(`Allowed Origin: ${ALLOWED_ORIGIN}`);
  console.log('');
});

connectLocalBridge().catch(() => scheduleLocalReconnect());
