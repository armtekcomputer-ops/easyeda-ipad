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
- Final PR #8 pre-merge head: `6269d83f4612ac0e00061ea3db1c1f304ef23b10`
- Final PR #8 exact-head CI run `35618277426` succeeded

## Accepted architecture — now implemented on main

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

Legacy internal wire/config identifiers such as `VPS_TOKEN`, `EASYEDA_VPS_TOKEN`, `/ws/vps`, `vpsConnected`, and `companion/cloud-agent.mjs` remain compatibility names only. Visible product terminology now uses **PC companion**.

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
- Selection writes now require the same validated document type, UUID, and tab ID that produced the trusted snapshot.
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

## Remaining work

### REL-005 — now unblocked

Residual transport reliability work after CORE-008:

- R5: handshake deadline, pong watchdog, bounded reconnect/recovery, and status restoration.
- R6: TTL/max-in-flight/generation-safe cleanup for pending relay requests.

### TEST-008 — now unblocked

Add transport behavior tests for:

- auth;
- routing;
- disconnect handling;
- malformed frames;
- payload bounds;
- timeout/recovery behavior after REL-005 stabilizes the protocol.

### UX-007 — now unblocked

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

PR #8 implementation is now also merged, so the documented PC-companion architecture and the main application behavior are aligned. This still does not prove a production deployment or live iPad/EasyEDA validation.

## Next actions

1. Claim and implement REL-005 without duplicating already-merged R1–R4 work.
2. Add TEST-008 after/with protocol stabilization.
3. Claim UX-007 now that `src/App.tsx` is no longer reserved by CORE-008.
4. Integrate BUILD-008 / PR #10 only under explicit merge authorization.
5. Complete VIEW-001 research independently.
6. Perform LIVE-001 against the integrated main candidate and record real iPad/EasyEDA versions/results.
7. Keep PR #5 mutation work separate until explicitly reviewed.

## Completion rules

- Update `WORKBOARD.md` at each ownership/status milestone.
- Record exact tested commit SHA and CI run for merged changes.
- Do not claim live-device validation from CI.
- Never merge stale branch copies of `WORKBOARD.md`.
