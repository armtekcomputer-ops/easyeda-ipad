# EasyEDA iPad

An experimental iPad-first web/PWA client and interaction layer for workflows built around the official EasyEDA Pro extension APIs and API Gateway.

> This project is not a fork of the proprietary EasyEDA Pro editor source code. It is an independent touch-first client that integrates with the public EasyEDA Pro SDK/API Gateway where supported.

## Phase 1 features

- iPad Safari and Home Screen PWA shell
- Responsive portrait/landscape workspace
- 44px+ touch targets and safe-area support
- Apple Pencil-aware pointer detection
- Pinch-to-zoom and multi-touch pan foundation
- Keyboard/trackpad-friendly controls
- EasyEDA-compatible WebSocket agent client
- Authenticated Desktop Companion relay
- Automatic scan of the official local bridge ports `49620-49629`
- GitHub Actions build validation

## Why a Desktop Companion is required

The official EasyEDA bridge server currently listens on `127.0.0.1`, so an iPad on the LAN cannot connect to it directly. The companion keeps the official bridge local to the desktop and exposes a separate token-protected WebSocket endpoint for the iPad.

```text
┌──────────────────────────────┐
│ iPad Safari / Home Screen PWA│
│ Touch + Pencil workspace     │
└──────────────┬───────────────┘
               │ authenticated WebSocket over trusted LAN
               ▼
┌──────────────────────────────┐
│ EasyEDA iPad Desktop Companion│
│ default :49700               │
└──────────────┬───────────────┘
               │ loopback only
               ▼
┌──────────────────────────────┐
│ Official EasyEDA Bridge      │
│ 127.0.0.1:49620-49629        │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ EasyEDA Pro + API Gateway    │
└──────────────────────────────┘
```

## Development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Desktop Companion

1. Start the official EasyEDA bridge/API Gateway workflow on the desktop that runs EasyEDA Pro.
2. In this repository, install dependencies and start the companion:

```bash
npm install
npm run companion
```

3. On first launch the companion creates a random pairing token in `~/.easyeda-ipad-token` and prints one or more LAN URLs similar to:

```text
ws://192.168.1.20:49700/ipad?token=YOUR_PAIRING_TOKEN
```

4. Open the iPad web app and paste that complete URL into **Gateway URL**.
5. Tap **Connect**.

You can override companion settings with environment variables:

- `EASYEDA_IPAD_TOKEN` — fixed pairing token
- `EASYEDA_IPAD_HOST` — listen host, default `0.0.0.0`
- `EASYEDA_IPAD_PORT` — listen port, default `49700`
- `EASYEDA_IPAD_ALLOWED_ORIGIN` — optional exact browser Origin restriction

## Security

EasyEDA API execution is powerful. Treat the companion as a development/control endpoint.

- Use it only on a trusted LAN or behind a trusted VPN/reverse proxy.
- Never expose port `49700` directly to the public Internet.
- Keep the pairing token private.
- For Internet use, terminate TLS at a trusted reverse proxy and use `wss://`.
- The official EasyEDA bridge remains bound to desktop loopback and is not exposed by this project.

## Current scope

Phase 1 provides the iPad interaction shell and bridge transport. The PCB/schematic shown in the workspace is a UI prototype, not a replacement rendering engine for EasyEDA Pro yet.

Next phases:

1. Read current EasyEDA document/project state through the public API.
2. Map touch tools to supported schematic/PCB API commands.
3. Add component/library search and insertion.
4. Add selection/property editing and undo/redo command integration.
5. Add secure `wss://` pairing/deployment profiles.
6. Add installable app icons, offline fallback, and iPad hardware QA.

## Upstream references

- https://github.com/easyeda/pro-api-sdk
- https://github.com/easyeda/eext-run-api-gateway
- https://github.com/easyeda/easyeda-api-skill
