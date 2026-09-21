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
- VPS outbound WebSocket cloud agent
- Direct/LAN companion mode retained as a fallback
- Typed and browser-validated EasyEDA document state
- Validated selection synchronization for PCB, footprint, and schematic documents
- Validated editor-tab navigation and EasyEDA viewport fit controls
- Validated browser for schematic pages and PCBs in the already-current EasyEDA project
- Open a validated current-project document without project switching
- Explicit read-back after navigation/open operations before local state is trusted
- GitHub Actions tests, PWA build, Worker typecheck, Wrangler validation, and companion syntax checks

## Phase 3: read-only EasyEDA state

After connecting the PWA, tap **Refresh from EasyEDA**. The PWA sends a narrowly-scoped read command through the existing secure relay and displays a validated snapshot containing:

- current editor document type and UUID
- current project identity/name when available
- current PCB metadata when a PCB is active
- current schematic and schematic-page metadata when a schematic page is active
- selected primitive IDs
- a bounded shallow scalar summary of selected primitive objects

The typed command layer lives in:

```text
src/lib/easyeda-api.ts
```

Safety limits include a maximum of 100 selected IDs, 20 primitive summaries, 16 shallow scalar fields per summary, and 256 characters per summary string. Returned data is schema-validated in the browser before rendering.

### Official APIs used by the snapshot

```text
eda.dmt_SelectControl.getCurrentDocumentInfo()
eda.dmt_Project.getCurrentProjectInfo()
eda.dmt_Pcb.getCurrentPcbInfo()
eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()
eda.pcb_SelectControl.getAllSelectedPrimitives()
eda.dmt_Schematic.getCurrentSchematicInfo()
eda.dmt_Schematic.getCurrentSchematicPageInfo()
eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId()
eda.sch_SelectControl.getAllSelectedPrimitives()
```

These names were verified against the official `easyeda/easyeda-api-skill` reference. The project does not guess undocumented method names.

## Phase 4: validated selection synchronization

The Selection Sync panel can clear the active EasyEDA selection or re-apply primitive IDs already present in the latest validated snapshot. The UI does **not** accept arbitrary typed primitive IDs.

### Official mutation APIs used

```text
eda.pcb_SelectControl.clearSelected()
eda.pcb_SelectControl.doSelectPrimitives(primitiveIds)
eda.sch_SelectControl.clearSelected()
eda.sch_SelectControl.doSelectPrimitives(primitiveIds)
eda.dmt_SelectControl.getCurrentDocumentInfo()
```

Supported mutation document types are schematic page (`1`), PCB (`3`), and footprint (`4`). Other document types fail without calling a selection mutation API.

Selection write safety rules:

- maximum 100 primitive IDs per request
- IDs are trimmed, non-empty, max 256 characters, and de-duplicated
- IDs are embedded using `JSON.stringify`
- mutation responses are schema-validated
- successful writes immediately read back a fresh validated snapshot

The official PCB/SCH event listener references state that those listeners are extension-only for this use case, so the standalone Run API Gateway path uses explicit read-back instead of inventing an event/polling API.

## Phase 5: validated editor navigation

The Editor Navigation panel can:

- read the official EasyEDA split-screen/tab tree
- identify the current active tab
- activate another already-open validated tab
- fit all primitives in the active EasyEDA tab
- fit the current selection in the active EasyEDA tab

### Official editor APIs used

```text
eda.dmt_EditorControl.getSplitScreenTree()
eda.dmt_EditorControl.activateDocument(tabId)
eda.dmt_EditorControl.zoomToAllPrimitives(tabId)
eda.dmt_EditorControl.zoomToSelectedPrimitives(tabId)
eda.dmt_SelectControl.getCurrentDocumentInfo()
```

The editor command/validation layer lives in:

```text
src/lib/easyeda-editor.ts
```

Safety rules include a maximum of 32 tabs, 16 split-screen nodes, 256-character IDs, and 128-character tab titles. The UI can send back only IDs already present in validated editor state.

## Phase 6: current-project document browser

Phase 6 lets the iPad open schematic pages and PCBs that belong to the **already-current EasyEDA project**, even when they are not already open as tabs.

The Current Project Documents panel:

- reads `IDMT_ProjectItem.data` from the current project
- collects top-level schematic pages and PCBs
- also collects schematic pages and PCBs nested inside `IDMT_BoardItem`
- exposes only the validated bounded document list to the UI
- allows the user to choose a document from that list; there is no arbitrary UUID text input
- re-reads the current project inside the open command and verifies the UUID is still present before calling `openDocument`
- activates the returned tab using the already-validated editor navigation layer
- reads back editor state, document snapshot, and current-project document state before trusting the new UI state

### Official Phase 6 APIs used

```text
eda.dmt_Project.getCurrentProjectInfo()
eda.dmt_EditorControl.openDocument(documentUuid)
eda.dmt_EditorControl.activateDocument(tabId)
```

The project-document command/validation layer lives in:

```text
src/lib/easyeda-project-documents.ts
```

Phase 6 safety limits:

- maximum 128 current-project documents
- document UUIDs limited to 256 characters
- document names limited to 128 characters
- project friendly name limited to 128 characters
- only schematic pages and PCBs are exposed
- UUIDs sent to EasyEDA come only from validated state and are JSON-serialized
- malformed result types are rejected rather than coerced
- the open command re-validates current-project membership immediately before mutation
- no `closeDocument`, save, split-screen mutation, geometry edit, property edit, routing, undo, or redo is introduced

### Why project switching is intentionally disabled

The official `eda.dmt_Project.openProject(projectUuid)` documentation warns that opening another project while the previously opened project has unsaved changes can directly lose those unsaved changes. Phase 6 therefore does **not** expose project switching and stays strictly inside the current project.

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

## Install and test

```bash
npm install
npm test
npm run build
```

Local PWA development:

```bash
npm run dev
```

Worker checks:

```bash
npm run worker:types
npm run worker:typecheck
npx wrangler deploy --dry-run
```

## Deploy PWA + relay to Cloudflare Workers

Authenticate Wrangler:

```bash
npx wrangler login
```

Create two different strong secrets:

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

Health endpoint:

```text
https://YOUR-WORKER.workers.dev/api/health
```

## Run the VPS cloud agent

```bash
git clone https://github.com/armtekcomputer-ops/easyeda-ipad.git
cd easyeda-ipad
npm install
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

Example `/etc/systemd/system/easyeda-ipad-agent.service`:

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
7. Tap **Refresh from EasyEDA** to read document, editor-tab, and current-project document state.
8. Use **Current Project Documents** to open a validated schematic page or PCB from the active project.
9. Use **Editor Navigation** to switch among already-open validated tabs or fit the EasyEDA viewport.
10. Use **Selection Sync** for supported documents to re-apply validated snapshot IDs or clear the active selection.

The current UI keeps the iPad token in browser `sessionStorage`; it is not compiled into the PWA bundle.

## Session model

Each `session` name maps to one Durable Object instance. Allowed names use `A-Z`, `a-z`, `0-9`, `_`, and `-`, with a maximum length of 64 characters.

Each session supports one active VPS agent connection and multiple iPad clients. A newer VPS connection replaces the older one, while request routing returns responses to the originating iPad client.

## Worker API

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

For trusted local networks:

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
- Never put `VPS_TOKEN` in frontend code, committed environment files, or the PWA bundle.
- Use separate `IPAD_TOKEN` and `VPS_TOKEN` values.
- Rotate secrets if a device is lost or credentials are disclosed.
- Use HTTPS/WSS in production.
- Keep VPS SSH and OS packages patched.
- Execute payloads are limited to 128 KiB.
- EasyEDA values returned to the PWA are treated as untrusted and validated before rendering.
- Selection writes use only validated snapshot IDs.
- Editor navigation uses only validated open-tab IDs.
- Current-project document opens use only validated current-project UUIDs and re-check membership inside the mutation command.
- Project switching remains disabled because of the documented unsaved-data-loss risk.

## Current scope

The transport, Cloudflare/VPS deployment path, iPad interaction shell, validated EasyEDA state snapshot, selection synchronization, editor-tab navigation, and current-project schematic/PCB browser are implemented. The visual PCB/schematic canvas is still a touch-oriented preview rather than a full remote clone of the EasyEDA editor. Additional editing commands will be added incrementally only after their public EasyEDA APIs are verified and covered by tests.

## Handoff workflow

`HANDOFF.md` is the operational source of truth for continuing development:

1. Read `HANDOFF.md`.
2. Complete the next action.
3. Update `HANDOFF.md`.
4. Re-read it before the next milestone.

## Upstream references

- https://github.com/easyeda/pro-api-sdk
- https://github.com/easyeda/eext-run-api-gateway
- https://github.com/easyeda/easyeda-api-skill
