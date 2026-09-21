# EasyEDA iPad — HANDOFF

Last updated: 2026-09-22 (Asia/Bangkok)

## Coordination

`WORKBOARD.md` on remote `main` is the canonical coordination board. Every coding chat must read remote-main `AGENTS.md`, this file, and `WORKBOARD.md` before claiming work. Open PRs are not merged capabilities. Do not edit paths reserved by another task, do not merge stale branch-local coordination files, and do not claim CI as live-device validation.

## Repository source of truth

- Repository: `armtekcomputer-ops/easyeda-ipad`
- Base branch: `main`
- Package version on the reviewed main line: `0.6.0`
- Latest application integration: EDIT-006 PR #19 merged as `ebe35749ae41c23294298cabac7d65672d53760b`
- EDIT-006 final PR head: `35660f4693bd16a7fd253da1d71419ec37d69da3`
- EDIT-006 exact-head CI: run `35640383362` succeeded
- COORD-002 PR #20 merged as `e176768768d64663b7431f7faa193baa5e9c4e06`
- COORD-002 final PR head: `2018c64f5354b3212578c93f03dac8c1e80f6fb5`
- COORD-002 exact-head CI: run `35639346673` succeeded

## Accepted architecture — implemented on main

```text
iPad PWA
  |
  | HTTPS / WSS
  v
Cloudflare Worker + Static Assets
  |
  v
Durable Object session relay
  ^
  | outbound WSS only
  |
PC companion running beside EasyEDA Pro
  |
  | loopback only
  v
Official EasyEDA API Gateway / bridge
127.0.0.1:49620-49629
```

Required Cloudflare resources are Worker, Static Assets, Durable Objects, and Worker secrets. No VPS, Cloudflare Container, D1, KV, R2, or Queue is required by the accepted path.

Legacy internal identifiers such as `VPS_TOKEN`, `EASYEDA_VPS_TOKEN`, `/ws/vps`, `vpsConnected`, and `companion/cloud-agent.mjs` remain compatibility names only. Visible product terminology uses **PC companion**.

## Merged capabilities

### Phase 1–2 — iPad shell and transport foundation

- iPad-first PWA shell with touch/Pencil viewport foundation.
- Cloudflare Worker + Durable Object relay foundation.
- Direct/LAN companion fallback.

### Phase 3 — trusted read state

- Typed read-only EasyEDA snapshot command layer.
- Current document/project/PCB/schematic/selection state.
- Browser-side schema validation and bounded primitive summaries.

### Phase 4 — guarded selection writes

- Selection clear/re-apply using verified PCB/SCH APIs.
- UI reuses validated primitive IDs rather than arbitrary typed IDs.
- Writes require the same validated document type, UUID, and tab ID that produced the trusted snapshot.
- Trusted state is invalidated before uncertain writes and restored only after successful read-back.

### Phase 5 — editor navigation

- Validated editor/split-screen state.
- Activate already-open validated tabs.
- Fit all primitives or current selection.
- Uncertain navigation outcomes invalidate trusted state until refresh.

### Phase 6 — current-project document browsing

- Bounded current-project schematic-page/PCB discovery.
- Top-level and Board-contained document discovery.
- No arbitrary document UUID input.
- Membership revalidation immediately before `openDocument`.
- Activation and trusted-state read-back after opening.
- Project switching remains intentionally disabled because of unsaved-change risk.

### CORE-008 / Phase 7 — hardening and read-only component inspector

PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`.

- R1 document identity guard for selection mutations.
- R2 trusted-state invalidation on uncertain mutation/navigation outcomes.
- R3 service-worker `/api/*` and `/ws/*` isolation from app-shell caching.
- R4 bounded/validated envelopes across Worker, browser gateway, direct companion, and cloud companion.
- PC companion cloud path uses outbound WSS and loopback-only EasyEDA bridge access.
- Exactly-one selected PCB/footprint primitive can be inspected read-only after live `documentType + uuid + tabId` identity validation.
- Inspector validates and displays primitive ID, designator, name, X/Y, rotation, layer, lock state, and capture time.

`pcb_PrimitiveComponent.get()` is documented as BETA; the inspector itself remains read-only.

### REL-005 — transport reliability

PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90`; final exact-head CI `35621474276` succeeded on `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24`.

- Browser handshake deadline 8 seconds, heartbeat every 15 seconds, 10-second pong watchdog, reconnect backoff 1→15 seconds, and manual-disconnect retry suppression.
- Connection loss rejects pending browser requests and resets status before reconnect.
- Cloud companion has a 5-second relay handshake deadline and heartbeat/pong watchdog.
- Worker retains `edaConnected` and `localBridgePort` in Durable Object WebSocket attachment state and restores status immediately to newly connected iPads.
- Cloud companion bounds pending relay requests to 64, uses a 35-second TTL, rejects duplicate IDs, applies connection-generation guards, and drains pending work on disconnect/shutdown.

### Integrated review queue

| Task | PR | Merge commit |
| --- | --- | --- |
| VIEW-001 | #9 | `34847b05cf979bc5e16b2f4a5394e3ba6390bae7` |
| BUILD-008 | #10 | `1e301302095d0d7582c981e24c9a083bd258ebca` |
| TEST-008 | #13 | `4d8ae2101b80a38faeefef12b89eb6fb0f55817b` |
| UX-007 | #14 | `21d9e0b16424cbe7e63fa74e60403257151ca753` |
| EDIT-005 command layer | #15 | `ab4364e7769ca7be3be4e26f935c503180142f88` |
| COORD-002 | #20 | `e176768768d64663b7431f7faa193baa5e9c4e06` |
| EDIT-006 transform UI | #19 | `ebe35749ae41c23294298cabac7d65672d53760b` |

- BUILD-008 provides lockfile-backed installs and CI using `npm ci`.
- TEST-008 covers auth/routing/disconnect/malformed-frame behavior and UTF-8 payload bounds, including the browser-side 128 KiB execute-code limit.
- UX-007 makes the local canvas explicitly a preview/control surface and hides unsupported mock editing tools.
- VIEW-001 is research only at `docs/research/real-board-viewer.md`; it does not authorize or implement a trusted full-board renderer.
- PR #5 was closed without merge and superseded by the guarded EDIT-005/EDIT-006 path.

### EDIT-005 + EDIT-006 — guarded single-component transforms

EDIT-005 PR #15 provides the guarded command layer. EDIT-006 PR #19 wires it into the current iPad inspector without restoring the stale PR #5 UI.

Merged UI behavior:

- fixed-step X−/X+/Y−/Y+ movement and ±90° rotation;
- controls enabled only when exactly one selected component is trusted;
- only PCB and schematic component mutation is supported; footprint mutation is excluded;
- the transform request checks trusted `documentType + uuid + tabId` inside the same execute request before component lookup/mutation;
- PCB locked components are rejected by the command layer;
- transform busy state participates in the global interaction lock;
- trusted snapshot/component state is discarded before the write;
- successful mutation restores state only through a fresh snapshot read-back;
- uncertain/failing outcomes leave trusted state invalid and require Refresh from EasyEDA before another write;
- no free-form primitive IDs, arbitrary coordinates, routing, wire/via/text editing, save/create/delete, or full-board mutation was added;
- the existing preview/control-surface UX, selection sync, component inspector, editor navigation, project-document browser, and Cloudflare/direct connection modes remain in place.

PR #19 final functional diff was `src/App.tsx` only (+113/−3). Exact-head CI run `35640383362` succeeded on `35660f4693bd16a7fd253da1d71419ec37d69da3`. CI is not live-device validation.

## Remaining work

### DEPLOY-001 — initial Cloudflare deployment

Cloudflare has **not yet been deployed** for this project. Repository code/config is pre-deploy ready; deployment itself still needs to be performed.

The current `main` has a green push CI on commit `080f5080e96bd573d72c00f2ad568e09768e9e25`, including tests, web build, Worker typecheck, `wrangler deploy --dry-run`, and companion syntax checks.

Initial deployment requires only account-side/runtime setup:

- authenticate Wrangler to the intended Cloudflare account;
- create different production secrets for `IPAD_TOKEN` and `VPS_TOKEN` (legacy binding name for the PC companion secret);
- deploy the existing Worker + Static Assets + Durable Object configuration;
- record the generated `workers.dev` or custom-domain URL and exact deployed commit;
- verify `/api/health` and authenticated session status.

Do not record or commit the real secret values.

### LIVE-001 / issue #18 — external real-device gate

LIVE-001 starts only after the initial Cloudflare deployment succeeds. It cannot be completed from CI or repository inspection alone.

Required live evidence:

- real iPad browser/PWA;
- deployed Cloudflare Worker + Durable Object;
- PC companion beside EasyEDA Pro;
- local official EasyEDA API Gateway/bridge;
- exact tested app/main commit, iPadOS/browser version, EasyEDA Pro version, and API Gateway/extension context;
- connection/reconnect, snapshot, selection, tab navigation, project-document browsing, component inspection, and guarded transform behavior;
- recovery cases including companion offline/reconnect, bridge unavailable/recovered, document/tab switch between trusted read and action, and malformed/expired session where practical.

Do not record real tokens or sensitive deployment values. CI cannot satisfy LIVE-001.

## Security / trust model

- Keep the EasyEDA bridge loopback-only on `127.0.0.1:49620-49629`.
- Do not expose legacy companion port `49700` publicly.
- Use separate iPad and companion secrets.
- The raw execute relay is a privileged trusted-operator path; read-only inspector constraints do not make the backend an enforced read-only permission boundary.
- Session names are routing identifiers, not per-user authorization boundaries.
- Do not commit or copy real tokens into HANDOFF, issues, screenshots, or logs.
- BETA EasyEDA component APIs remain narrowly scoped and guarded by live document identity checks.

## Deployment state

`docs/DEPLOYMENT_PC_COMPANION.md` is merged and documents Worker + Durable Object + outbound PC companion deployment/rollback.

The repository implementation is integrated through EDIT-006 and pre-deploy checks are green. **No Cloudflare production deployment has been performed yet.** No open PR remains after PR #19.

## Next action

Perform the initial Cloudflare deployment from current `main`, set the two Worker secrets, verify the Worker health/session endpoints, then perform LIVE-001 on the real device stack.

## Completion rules

- Update `WORKBOARD.md` at each ownership/status milestone.
- Record exact tested commit SHA and CI run for merged changes.
- Do not claim live-device validation from CI.
- Never merge stale branch copies of `WORKBOARD.md`.
