# EasyEDA iPad

An experimental iPad-first web/PWA client for workflows built around the official EasyEDA Pro extension APIs and API Gateway.

> This project is not a fork of the proprietary EasyEDA Pro editor source code. It is an independent touch-first client that integrates with the public EasyEDA Pro SDK/API Gateway where supported.

## Recommended architecture: VPS + Cloudflare

```text
iPad Safari / Home Screen PWA
            |
            | HTTPS / WSS
            v
Cloudflare Worker + Static Assets
            |
            v
Durable Object session relay
            ^
            | outbound WSS
            |
VPS Cloud Agent
            |
            | localhost only
            v
Official EasyEDA Bridge
127.0.0.1:49620-49629
            |
            v
EasyEDA Pro + API Gateway on VPS
```

The VPS initiates the Internet connection to Cloudflare. You do **not** need to expose EasyEDA bridge ports `49620-49629` or the legacy companion port `49700` to the Internet.

## Features

- iPad Safari and Home Screen PWA shell
- Responsive portrait/landscape workspace
- 44px+ touch targets and safe-area support
- Apple Pencil-aware pointer detection
- Pinch-to-zoom and multi-touch pan foundation
- Keyboard/trackpad-friendly controls
- Cloudflare Workers Static Assets hosting
- Durable Object WebSocket relay with hibernation-compatible connection state
- Separate iPad and VPS authentication secrets
- One logical Durable Object per EasyEDA session
- VPS outbound WebSocket cloud agent
- Automatic scan of the official local bridge ports `49620-49629`
- Direct/LAN companion mode retained as a fallback
- GitHub Actions build and Worker validation

## Requirements

### Cloudflare side

- Cloudflare account with Workers enabled
- Node.js 22+
- npm
- Wrangler authentication for deployment

### VPS side

- Linux VPS capable of running your EasyEDA Pro/API Gateway workflow
- Node.js 22+
- EasyEDA Pro running with the official Run API Gateway/bridge workflow available locally
- Local bridge reachable on one of `127.0.0.1:49620-49629`

If your EasyEDA Pro setup requires a graphical desktop/WebGL environment, the VPS must provide that graphical session. The cloud agent itself is headless and only needs Node.js.

## Install

```bash
npm install
```

Local PWA development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Deploy PWA + relay to Cloudflare Workers

Authenticate Wrangler:

```bash
npx wrangler login
```

Create two different strong secrets. Do not reuse them.

```bash
npx wrangler secret put IPAD_TOKEN
npx wrangler secret put VPS_TOKEN
```

`IPAD_TOKEN` is entered by the user in the PWA at runtime. `VPS_TOKEN` must remain only on the VPS and in Cloudflare's secret store.

Deploy:

```bash
npm run cf:deploy
```

The project deploys the Vite `dist/` directory as Workers Static Assets and routes `/api/*` and `/ws/*` through the Worker. A SQLite-backed Durable Object named `EasyEdaSession` handles each relay session.

Useful commands:

```bash
npm run worker:types
npm run worker:typecheck
npm run cf:dev
npx wrangler deploy --dry-run
```

Health endpoint after deployment:

```text
https://YOUR-WORKER.workers.dev/api/health
```

## Run the VPS cloud agent

On the VPS, clone the same repository and install dependencies:

```bash
git clone https://github.com/armtekcomputer-ops/easyeda-ipad.git
cd easyeda-ipad
npm install
```

Set the Worker URL and VPS-only secret:

```bash
export EASYEDA_CLOUD_URL="https://YOUR-WORKER.workers.dev"
export EASYEDA_VPS_TOKEN="YOUR_VPS_TOKEN"
export EASYEDA_SESSION="default"
npm run cloud-agent
```

Expected startup flow:

```text
EasyEDA iPad VPS Cloud Agent
Session: default
Local bridge: 127.0.0.1:49620-49629
Cloud mode: outbound WebSocket only
[cloud-agent] EasyEDA bridge connected on 127.0.0.1:4962X
[cloud-agent] Cloudflare relay connected
```

The agent reconnects to both the local EasyEDA bridge and Cloudflare automatically with backoff.

## Optional systemd service on VPS

Create `/etc/systemd/system/easyeda-ipad-agent.service`:

```ini
[Unit]
Description=EasyEDA iPad Cloud Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/opt/easyeda-ipad
Environment=EASYEDA_CLOUD_URL=https://YOUR-WORKER.workers.dev
Environment=EASYEDA_VPS_TOKEN=YOUR_VPS_TOKEN
Environment=EASYEDA_SESSION=default
ExecStart=/usr/bin/npm run cloud-agent
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now easyeda-ipad-agent
sudo systemctl status easyeda-ipad-agent
```

Prefer a systemd credentials mechanism or protected environment file instead of placing production secrets directly in a world-readable unit file.

## Connect from iPad

1. Open the deployed Worker URL in Safari.
2. Optionally use **Add to Home Screen**.
3. Select **Cloudflare + VPS** mode.
4. Enter the same session used by the VPS agent, normally `default`.
5. Enter `IPAD_TOKEN`.
6. Tap **Connect**.

The token is not compiled into the PWA. The current UI keeps the iPad token in browser `sessionStorage`, so it is cleared when that browser session is discarded.

The inspector reports three independent states:

- PWA -> Cloudflare gateway connection
- Cloudflare -> VPS agent connection
- VPS agent -> local EasyEDA bridge connection

## Session model

Each `session` name maps to one Durable Object instance.

Allowed session names:

```text
A-Z a-z 0-9 _ -
```

Maximum length: 64 characters.

Each session supports:

- one active VPS agent connection (a newer VPS connection replaces the older one)
- multiple iPad clients
- request routing back to the originating iPad client

## Worker API

Public health check:

```text
GET /api/health
```

Authenticated session status:

```text
GET /api/session/:session/status
Authorization: Bearer <IPAD_TOKEN>
```

WebSocket endpoints:

```text
/ws/ipad?session=default&token=<IPAD_TOKEN>
/ws/vps?session=default&token=<VPS_TOKEN>
```

Production traffic should use `https://` and `wss://`.

## Direct/LAN fallback mode

The original Phase 1 companion is still available for trusted local networks:

```bash
npm run companion
```

It listens on port `49700` by default and prints a token-protected iPad WebSocket URL. Never expose this port directly to the public Internet.

Environment overrides:

- `EASYEDA_IPAD_TOKEN`
- `EASYEDA_IPAD_HOST`
- `EASYEDA_IPAD_PORT`
- `EASYEDA_IPAD_ALLOWED_ORIGIN`

## Security

EasyEDA API execution is powerful. Treat the relay as a privileged control path.

- Never expose local EasyEDA bridge ports `49620-49629` publicly.
- Never put `VPS_TOKEN` in frontend code, `.env` files committed to Git, or the PWA bundle.
- Use separate `IPAD_TOKEN` and `VPS_TOKEN` values.
- Rotate secrets if a device is lost or credentials are disclosed.
- Use HTTPS/WSS in production.
- Keep VPS SSH and OS packages patched.
- The Worker rejects invalid session names and WebSocket role tokens.
- Execute payloads are limited to 128 KiB.
- The relay does not intentionally log tokens or execute payload contents.

## Current scope

The transport and iPad interaction shell are now structured for VPS + Cloudflare operation. The PCB/schematic shown in the workspace remains a UI prototype; Phase 3 needs to map the touch tools and panels to supported EasyEDA Pro APIs.

## Handoff workflow

`HANDOFF.md` is the operational source of truth for continuing development. The intended loop is:

1. Read `HANDOFF.md`.
2. Complete the next action.
3. Update `HANDOFF.md`.
4. Re-read it before the next milestone.

## Upstream references

- https://github.com/easyeda/pro-api-sdk
- https://github.com/easyeda/eext-run-api-gateway
- https://github.com/easyeda/easyeda-api-skill
