# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Coordination

`WORKBOARD.md` on remote `main` is the canonical multi-chat coordination board. Every coding chat must read `AGENTS.md`, this file, and `WORKBOARD.md` before claiming work. Open PRs are not merged capabilities. Do not edit paths reserved by another task.

## Repository source of truth

- Repository: `armtekcomputer-ops/easyeda-ipad`
- Base branch: `main`
- Package version on the reviewed main line: `0.6.0`
- Phase 6 PR #7 merged as `a6941a74093dddf54fb1848293c17d4273d532a4`
- OPS-001 PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b`
- CORE-008 PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`
- REL-005 PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90`
- Final PR #12 pre-merge head: `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24`
- Final PR #12 exact-head CI run `35621474276` succeeded

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

Cloudflare resources required by this path are Worker, Static Assets, Durable Objects, and Worker secrets. No VPS, Cloudflare Container, D1, KV, R2, or Queue is required.

Legacy internal wire/config identifiers such as `VPS_TOKEN`, `EASYEDA_VPS_TOKEN`, `/ws/vps`, `vpsConnected`, and `companion/cloud-agent.mjs` remain compatibility names only. Visible product terminology uses **PC companion**.

## Merged capabilities

### Phase 1–2

- iPad-first PWA shell with touch/Pencil viewport foundation.
- Cloudflare Worker + Durable Object relay foundation.
- Direct/LAN companion fallback.

### Phase 3

- Typed read-only EasyEDA snapshot command layer.
- Current document/project/PCB/schematic/selection state.
- Browser-side schema validation and bounded primitive summaries.

### Phase 4

- Selection clear/re-apply using verified PCB/SCH APIs.
- UI reuses validated primitive IDs rather than arbitrary typed IDs.
- Selection writes require the same validated document type, UUID, and tab ID that produced the trusted snapshot.
- Trusted state is invalidated before uncertain writes and restored only after successful read-back.

### Phase 5

- Validated editor/split-screen state.
- Activate already-open validated tabs.
- Fit all primitives or current selection.
- Uncertain navigation outcomes invalidate trusted state until refresh.

### Phase 6

- Bounded current-project schematic-page/PCB discovery.
- Top-level and Board-contained document discovery.
- No arbitrary document UUID input.
- Membership revalidation immediately before `openDocument`.
- Activation and trusted-state read-back after opening.
- Project switching remains intentionally disabled because of unsaved-change risk.

### CORE-008 / Phase 7

PR #8 is merged on `main`.

Merged hardening:

- R1 — document identity guard for selection mutations.
- R2 — trusted-state invalidation on uncertain mutation/navigation outcomes.
- R3 — service-worker `/api/*` and `/ws/*` isolation from app-shell caching.
- R4 — bounded/validated message envelopes across Worker, browser gateway, direct companion, and cloud companion.
- PC companion cloud path with outbound WSS and loopback-only EasyEDA bridge access.

Merged selected PCB/footprint component inspector:

- read-only inspection of exactly one selected primitive;
- live document identity must match trusted `documentType + uuid + tabId` before component lookup;
- rejects switched documents even if the primitive ID is identical;
- validates primitive ID, designator, name, X/Y, rotation, lock state, and top/bottom layer;
- iPad inspector UI shows designator, name, primitive ID, X/Y, rotation, layer, lock state, and capture time;
- no `.modify`, `.create`, `.delete`, `.save`, geometry edit, move, rotate, or routing path is added by Phase 7.

`pcb_PrimitiveComponent.get()` is documented as BETA, so this capability remains read-only.

### REL-005 — transport reliability

PR #12 is merged on `main`.

Merged R5 reliability:

- browser gateway handshake deadline: 8 seconds;
- browser heartbeat every 15 seconds with a 10-second pong watchdog;
- bounded automatic reconnect backoff from 1 second up to 15 seconds;
- manual disconnect cancels retries;
- connection loss rejects pending browser requests and resets status before reconnect;
- cloud companion has a 5-second relay handshake deadline and its own heartbeat/pong watchdog;
- Worker retains the live companion `edaConnected` and `localBridgePort` status in the Durable Object WebSocket attachment;
- newly/reconnected iPad clients immediately receive current relay/EasyEDA status instead of waiting for the next companion status event;
- session status API reports the retained EasyEDA bridge state.

Merged R6 pending-request hardening:

- maximum 64 in-flight relay requests on the cloud companion;
- 35-second request TTL;
- duplicate in-flight request IDs rejected;
- local/cloud generation checks prevent stale replies from consuming requests belonging to a newer connection generation;
- pending requests are drained on local bridge/cloud disconnect and shutdown;
- focused regression coverage verifies bounds, TTL expiry, generation safety, reconnect/watchdog behavior, and status recovery.

Final exact-head CI for PR #12 was `35621474276` on `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24` and succeeded. CI is not live-device validation.

## Remaining work

### TEST-008 — ready to claim

Add broader transport behavior tests for:

- auth;
- routing;
- disconnect handling;
- malformed frames;
- payload bounds;
- protocol behavior across the now-merged REL-005 reconnect/timeout paths.

### UX-007 — ready to claim

Clarify that the local canvas is a preview/control surface rather than a complete live EasyEDA editor. Disable or hide unimplemented tools that could imply unsupported editing.

### BUILD-008 / PR #10

PR #10 remains separate and in review. It adds lockfile-backed reproducible npm installs and CI use of `npm ci`. Merge only with explicit authorization.

### VIEW-001 / PR #9

Research-only real-board viewer feasibility work remains separate. Do not promote BETA geometry enumeration to the trusted production path without an explicit decision and bounded validation.

### EDIT-005 / PR #5

Transform/mutation work remains separate and blocked pending an explicit editing-scope review. Do not merge automatically.

### LIVE-001

Actual iPad + EasyEDA Pro/API Gateway end-to-end validation is still pending. CI does not count as live-device validation.

## Security / trust model

- Keep the EasyEDA bridge loopback-only on `127.0.0.1:49620-49629`.
- Do not expose legacy companion port `49700` publicly.
- Use separate iPad and companion secrets.
- The raw execute relay is a privileged trusted-operator path; Phase 7 being read-only does not make the backend an enforced read-only permission boundary.
- Session names are routing identifiers, not per-user authorization boundaries.
- Do not commit or copy real tokens into HANDOFF, issues, screenshots, or logs.

## Deployment state

`docs/DEPLOYMENT_PC_COMPANION.md` is merged and documents Worker + Durable Object + outbound PC companion deployment/rollback.

The PC-companion architecture, CORE-008 implementation, and REL-005 reliability hardening are now merged on `main`. This still does not prove a production deployment or live iPad/EasyEDA validation.

## Next actions

1. Claim TEST-008 against the merged REL-005 protocol.
2. Claim UX-007 independently; `src/App.tsx` is available.
3. Integrate BUILD-008 / PR #10 only under explicit merge authorization.
4. Complete VIEW-001 research independently.
5. Perform LIVE-001 against the integrated main candidate and record real iPad/EasyEDA versions/results.
6. Keep PR #5 mutation work separate until explicitly reviewed.

## Completion rules

- Update `WORKBOARD.md` at each ownership/status milestone.
- Record exact tested commit SHA and CI run for merged changes.
- Do not claim live-device validation from CI.
- Never merge stale branch copies of `WORKBOARD.md`.
