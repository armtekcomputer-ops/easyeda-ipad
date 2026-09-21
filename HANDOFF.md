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

### Integrated review queue — verified 2026-09-21 UTC

Reviewed application baseline: `ab4364e7769ca7be3be4e26f935c503180142f88`. Later coordination commits do not change application behavior.

| Task | Merged PR | Final PR head | Merge commit |
| --- | --- | --- | --- |
| BUILD-008 | [#10](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/10) | `fb8712a9e222f465d086d5e9d87f14a6188b6427` | `1e301302095d0d7582c981e24c9a083bd258ebca` |
| TEST-008 | [#13](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/13) | `a5052249ba636568615ff3b082218bcb5402e15c` | `4d8ae2101b80a38faeefef12b89eb6fb0f55817b` |
| UX-007 | [#14](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/14) | `565c19372ea60770a6d6ab620845e7a34213c2ec` | `21d9e0b16424cbe7e63fa74e60403257151ca753` |
| VIEW-001 | [#9](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/9) | `e1562af6078aa6031a8225e9f1be264ff05ad08e` | `34847b05cf979bc5e16b2f4a5394e3ba6390bae7` |
| EDIT-005 | [#15](https://github.com/armtekcomputer-ops/easyeda-ipad/pull/15) | `d2d2ff40c83acf0e3be522e7152b631f028cc456` | `ab4364e7769ca7be3be4e26f935c503180142f88` |

- BUILD-008: lockfile-backed installs and CI using npm ci are merged.
- TEST-008: transport auth/routing/disconnect/malformed-frame and UTF-8 payload-bound coverage is merged, including the browser-side 128 KiB execute-code limit.
- UX-007: the local canvas is explicitly a preview/control surface; unsupported mock editing tools are hidden.
- VIEW-001: feasibility research is merged at `docs/research/real-board-viewer.md`. This is research, not a live full-board renderer. BETA geometry enumeration is not promoted to the trusted production path.
- EDIT-005: PR #15 adds a guarded command layer for a single PCB/schematic component, excluding footprint mutation. It checks documentType + uuid + tabId inside the execute request before lookup/mutation, rejects locked PCB components, bounds each action to one fixed nudge/rotation, and requires successful read-back. This later phase is separate from the read-only Phase 7 inspector.
- PR #5 is closed without merge and superseded by #15. Do not revive its stale App/HANDOFF branch.
- These merge facts were checked through GitHub PR records; no new test run or live-device validation is implied.

## Remaining work

### COORD-002 / issue #17

This correction reconciles HANDOFF with the integrated review queue. WORKBOARD stays canonical on remote main and must never be replaced by a stale feature-branch copy. After this correction reaches main, refresh PRs/board, update the affected task rows, and explicitly release only the reconciled completed-task reservations. Preserve historical events and other owners.

### EDIT-006 / issue #16 / PR #19

At verification, PR #19 remains open at head `d01945d42d64609c424ce8ac49cab4118df2335a`, branch `work/EDIT-006/inspector-transform-ui`. It proposes inspector controls for the merged transform layer. Open PR code is not a merged UI capability. Do not duplicate or take over its implementation. Re-fetch its current head and CI before review/integration; merge requires applicable explicit authorization.

### LIVE-001 / issue #18

Actual iPad + deployed Worker/Durable Object + PC companion + EasyEDA Pro/API Gateway end-to-end validation is pending. Record app SHA, device/browser and EasyEDA versions, connection/recovery and trusted-state behavior. Test transform UI only after EDIT-006 is integrated. No deployed endpoint, real-device session or live evidence was available in this coordination run. CI does not satisfy this gate.

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

1. Integrate the COORD-002 HANDOFF correction only with applicable authorization, then reconcile remote main WORKBOARD and release completed-task reservations. Do not merge branch-local WORKBOARD.
2. Review the existing EDIT-006 PR #19 against its current head and actual CI; do not create another transform UI PR.
3. Complete LIVE-001 with real devices and record results in issue #18.
4. Keep any future full-board BETA viewer work in a separately authorized scope.

## Completion rules

- Update `WORKBOARD.md` at each ownership/status milestone.
- Record exact tested commit SHA and CI run for merged changes.
- Do not claim live-device validation from CI.
- Never merge stale branch copies of `WORKBOARD.md`.
