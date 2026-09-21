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
- Typed EasyEDA Pro document snapshot integration
- Validated current document/project/PCB/schematic/selection state
- Bounded selection payloads before data is rendered on iPad
- Narrowly-scoped EasyEDA selection synchronization for PCB, footprint, and schematic documents
- Selection writes restricted to validated primitive IDs already read from EasyEDA
- Validated EasyEDA editor-tab navigation
- Activate already-open EasyEDA tabs from the iPad
- Fit all primitives or the current selection in the active EasyEDA tab
- GitHub Actions tests, build, Worker typecheck, and Wrangler validation

## Phase 3: read-only EasyEDA state

After connecting the PWA, tap **Refresh from EasyEDA**. The PWA sends a narrowly-scoped read command through the existing secure relay and displays a validated snapshot containing:

- current editor document type and document UUID
- current project identity/name when available
- current PCB metadata when a PCB is active
- current schematic and schematic-page metadata when a schematic page is active
- selected primitive IDs
- a bounded shallow scalar summary of selected primitive objects

The Phase 3 snapshot path is read-only. It does not call save, move/rotate, wire/route, undo, or redo APIs.

The typed command layer lives in:

```text
src/lib/easyeda-api.ts
```

Safety limits applied to every snapshot:

- selected IDs: maximum 100 returned to the browser
- primitive summaries: maximum 20
- primitive summary fields: maximum 16 shallow scalar fields
- summary strings: maximum 256 characters
- returned data is schema-validated in the browser before UI rendering

The command-generation and validation behavior is covered by Vitest:

```bash
npm test
```

### Official APIs used by the snapshot

Current document/project:

```text
eda.dmt_SelectControl.getCurrentDocumentInfo()
eda.dmt_Project.getCurrentProjectInfo()
```

PCB:

```text
eda.dmt_Pcb.getCurrentPcbInfo()
eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()
eda.pcb_SelectControl.getAllSelectedPrimitives()
```

Schematic:

```text
eda.dmt_Schematic.getCurrentSchematicInfo()
eda.dmt_Schematic.getCurrentSchematicPageInfo()
eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId()
eda.sch_SelectControl.getAllSelectedPrimitives()
```

These names were verified against the official `easyeda/easyeda-api-skill` reference. The project does not guess undocumented method names. In particular, no public undo/redo API was found in the current official reference, so undo/redo is not implemented.

## Phase 4: validated selection synchronization

Phase 4 adds the first write capability, intentionally limited to active selection state.

The Selection Sync panel can:

- clear the active EasyEDA selection
- re-apply primitive IDs already present in the latest validated snapshot
- read EasyEDA state back immediately after every successful mutation

The UI does **not** accept arbitrary typed primitive IDs. Selection writes are generated only from validated IDs already returned by EasyEDA.

### Official mutation APIs used

PCB / footprint:

```text
eda.pcb_SelectControl.clearSelected()
eda.pcb_SelectControl.doSelectPrimitives(primitiveIds)
```

Schematic / symbol:

```text
eda.sch_SelectControl.clearSelected()
eda.sch_SelectControl.doSelectPrimitives(primitiveIds)
```

The active editor type is checked inside the same execute request using:

```text
eda.dmt_SelectControl.getCurrentDocumentInfo()
```

Supported mutation document types are schematic page (`1`), PCB (`3`), and footprint (`4`). Other document types fail without calling a selection mutation API.

### Selection write safety rules

- maximum 100 primitive IDs per request
- IDs are trimmed and must be non-empty strings
- maximum primitive ID length is 256 characters
- duplicate IDs are removed before execution
- validated arrays are embedded using `JSON.stringify`, not raw quoted-string concatenation
- mutation responses are schema-validated in the browser
- a successful mutation is never assumed locally; the PWA immediately calls `getSnapshot()` and uses that fresh validated result
- failed or unsupported mutations do not trigger an assumed local state update

The official PCB/SCH event listener references state that these listeners are extension-only and standalone script calls throw. Because this project executes standalone code through the Run API Gateway, Phase 4 uses explicit read-back rather than registering selection-change event listeners or inventing a polling API.

## Phase 5: validated editor navigation

Phase 5 adds non-destructive control over the already-open EasyEDA editor tabs before any geometry/property editing is introduced.

The Editor Navigation panel can:

- read the official EasyEDA split-screen/tab tree
- identify the current active tab by correlating it with the current document
- switch to another already-open validated EasyEDA tab
- fit all primitives in the active EasyEDA tab
- fit the current selection in the active EasyEDA tab

Tab activation reads back fresh editor state before the browser trusts the new active tab. The PWA then refreshes the EasyEDA document snapshot so the inspector follows the newly active document.

### Official editor APIs used

```text
eda.dmt_EditorControl.getSplitScreenTree()
eda.dmt_EditorControl.activateDocument(tabId)
eda.dmt_EditorControl.zoomToAllPrimitives(tabId)
eda.dmt_EditorControl.zoomToSelectedPrimitives(tabId)
eda.dmt_SelectControl.getCurrentDocumentInfo()
```

The official editor contracts used are `IDMT_EditorSplitScreenItem` and `IDMT_EditorTabItem`.

### Editor navigation safety rules

- maximum 32 validated editor tabs returned to the browser
- maximum 16 split-screen nodes traversed
- tab and split-screen IDs are limited to 256 characters
- tab titles are limited to 128 characters
- tab IDs sent back to EasyEDA are trimmed, length-bounded, and serialized using `JSON.stringify`
- the UI can choose only IDs already present in validated editor state
- Phase 5 does not call `openDocument`, `closeDocument`, split-screen mutation, save, move, rotate, routing, property-edit, undo, or redo APIs
- viewport fit commands do not modify schematic/PCB document data

The editor command/validation layer lives in:

```text
src/lib/easyeda-editor.ts
```

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

Tests:

```bash
npm test
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
7. Tap **Refresh from EasyEDA** to read the current EasyEDA document and editor-tab state.
8. Use **Editor Navigation** to switch among already-open validated tabs or fit the EasyEDA viewport.
9. For supported PCB/footprint/schematic documents, use **Selection Sync** to re-apply validated snapshot IDs or clear the active EasyEDA selection.

The token is not compiled into the PWA. The current UI keeps the iPad token in browser `sessionStorage`, so it is cleared when that browser session is discarded.

The inspector reports three independent connection states plus validated EasyEDA/editor state:

- PWA -> Cloudflare gateway connection
- Cloudflare -> VPS agent connection
- VPS agent -> local EasyEDA bridge connection
- current document/project/context/selection snapshot
- open EasyEDA editor tabs and active tab
- selection synchronization availability for the current document type

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
- EasyEDA values returned to the PWA are treated as untrusted and validated before rendering.
- Selection write inputs are bounded and generated only from validated snapshot IDs.
- Editor-navigation inputs are bounded and generated only from validated open-tab IDs.

## Current scope

The transport, Cloudflare/VPS deployment path, iPad interaction shell, validated EasyEDA state snapshot, selection synchronization, and validated editor-tab navigation are implemented. The visual PCB/schematic canvas is still a touch-oriented preview rather than a full remote clone of the EasyEDA editor. Additional editing commands will be added incrementally only after their public EasyEDA APIs are verified and covered by tests.

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
