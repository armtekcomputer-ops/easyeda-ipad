# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Coordination

`WORKBOARD.md` on remote `main` is the canonical multi-chat coordination board. Every coding chat must read `AGENTS.md`, this file, and `WORKBOARD.md` before claiming work. Open PRs are not merged capabilities. Do not edit paths reserved by another task.

## Repository source of truth

- Repository: `armtekcomputer-ops/easyeda-ipad`
- Base branch: `main`
- Package version on the reviewed main line: `0.6.0`
- Phase 6 PR #7 merged as `a6941a74093dddf54fb1848293c17d4273d532a4`
- Phase 6 exact-head CI run `35598740884` succeeded
- OPS-001 PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b`
- OPS-001 exact-head CI run `35611613116` succeeded on `bdb931466bee39e3441cb8fe0607afa10a9a404f`

## Architecture status

### Accepted target architecture

The accepted target removes VPS and Cloudflare Containers:

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

Cloudflare resources required by the target design are Workers, Workers Static Assets, Durable Objects, and Worker secrets. No VPS, Cloudflare Container, D1, KV, R2, or Queue is required by the documented target path.

### Important implementation distinction

PR #11 merged **documentation only**. It does not mean PR #8's PC-companion transport migration or P1 code hardening has been merged into `main`.

The detailed deployment/rollback runbook is now on `main` at:

```text
docs/DEPLOYMENT_PC_COMPANION.md
```

Until the transport rename/migration is integrated, legacy internal identifiers such as `VPS_TOKEN`, `EASYEDA_VPS_TOKEN`, `/ws/vps`, `vpsConnected`, and `cloud-agent.mjs` may still exist. They are compatibility identifiers, not a requirement to deploy a VPS.

## Merged product capabilities through Phase 6

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
- Successful selection mutations read back a fresh snapshot.

### Phase 5

- Validated editor/split-screen state.
- Activate already-open validated tabs.
- Fit all primitives or current selection.

### Phase 6

- Bounded current-project schematic-page/PCB discovery.
- Top-level and Board-contained document discovery.
- No arbitrary document UUID input.
- Membership revalidation immediately before `openDocument`.
- Activation and trusted-state read-back after opening.
- Project switching remains intentionally disabled because of unsaved-change risk documented by EasyEDA.

## Open integration work

### CORE-008 / PR #8

Open PR #8: `feat: harden trusted EasyEDA state and move relay to PC companion`.

Observed head during OPS-001 reconciliation:

```text
d6d8a6213d1504d8e63e0e7b373a969711b34b1d
```

Exact-head CI run `35601180677` succeeded.

Read-only reconciliation found that PR #8 contains:

- R1 document identity guard for selection mutations;
- R2 trusted-state invalidation on uncertain mutation/navigation outcomes;
- R3 service-worker API/auth cache isolation;
- R4 bounded/non-null message-envelope validation across Worker/gateway/companions;
- Phase 7 selected PCB component inspector command/parser foundation;
- Phase 7 tests proving the inspector path is read-only and does not call mutation APIs;
- target PC-companion architecture work in progress.

Do not count these items as merged `main` capabilities until PR #8 is integrated. Phase 7 UI integration is still incomplete in the observed PR state.

### BUILD-008 / PR #10

PR #10 is in review with exact-head CI run `35610185239` successful on `fb8712a9e222f465d086d5e9d87f14a6188b6427`.

It adds reproducible npm dependency resolution and CI use of `npm ci`. It remains separate from transport behavioral tests.

### VIEW-001 / PR #9

Agent 2 owns the read-only real-board viewer feasibility research. The work must stay research/documentation only unless explicitly expanded later.

### EDIT-005 / PR #5

PR #5 contains component transform work and remains separate. It uses write/mutation behavior and must not be merged merely because CI passes. Reconcile it only after CORE-008 integration and an explicit editing scope review.

## Review findings and current ownership

| ID | Status | Current interpretation |
| --- | --- | --- |
| R1 | addressed in PR #8, unmerged | Selection commands need expected document type/UUID/tab identity guards. |
| R2 | addressed in PR #8, unmerged | Uncertain mutation/navigation outcomes must invalidate trusted state until refresh. |
| R3 | addressed in PR #8, unmerged | Service worker must not cache authenticated/API responses as app shell state. |
| R4 | addressed in PR #8, unmerged | Transport messages require object/type/size validation before property access. |
| R5 | pending | Add handshake deadline, recovery/watchdog/status behavior after CORE-008 reconciliation. |
| R6 | pending | Bound pending relay requests with TTL/max in-flight/generation-safe cleanup. |
| R7 | pending | Clearly mark the local preview and disable/hide unimplemented editor tools. |
| R8 build | PR #10 review | Lockfile + deterministic CI install. |
| R8 transport tests | pending | Add behavioral auth/routing/disconnect/malformed/payload-bound coverage. |

## Phase 7 — selected PCB component inspector

Target: read-only inspection of exactly one selected PCB/footprint component/device.

Verified API surface includes:

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`
- `eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()`
- `eda.pcb_PrimitiveComponent.get(primitiveId)`
- component scalar getters for ID, designator, name, X, Y, rotation, lock state, and layer

`pcb_PrimitiveComponent.get()` is documented as BETA. Phase 7 therefore remains read-only. `modify(...)` and other geometry/property mutations are excluded from Phase 7.

Observed PR #8 state:

- API command/parser foundation: implemented in PR #8, not merged
- read-only tests: implemented in PR #8, not merged
- iPad component inspector UI: still incomplete
- final README/version/HANDOFF integration: pending PR #8 integration

## Real-board viewer

The current iPad canvas on merged `main` is still a preview/demo representation rather than a verified rendering of live PCB/schematic geometry. Do not describe it as a full remote EasyEDA editor.

VIEW-001 is researching whether documented public EasyEDA APIs support a safe read-only real-board viewer. BETA geometry enumeration must not be promoted into the trusted production path without an explicit decision and bounded validation.

## Security / trust model

- Keep the EasyEDA bridge loopback-only on `127.0.0.1:49620-49629`.
- Do not expose legacy companion port `49700` publicly.
- Use separate iPad and companion secrets.
- The current raw execute relay is a privileged trusted-operator path; Phase 7 being read-only does not make the backend an enforced read-only permission boundary.
- Session names are routing identifiers, not per-user authorization boundaries.
- Do not commit or copy real tokens into HANDOFF, issues, screenshots, or logs.

## Deployment state

OPS-001 documentation is merged. It includes:

- exact required Cloudflare resources;
- PC companion startup guidance;
- secret handling;
- Worker health/session checks;
- iPad connection steps;
- end-to-end acceptance checklist;
- staged rollout;
- rollback guidance;
- troubleshooting for legacy `vps` compatibility names.

This is documentation, not evidence of a production deployment. No live iPad + EasyEDA end-to-end validation was claimed by OPS-001.

## Next actions

1. Reconcile/integrate CORE-008 / PR #8 before starting duplicate R1–R4 or Phase 7 implementation.
2. Integrate BUILD-008 / PR #10 only under explicit merge authorization, then synchronize HANDOFF/WORKBOARD.
3. Complete VIEW-001 research without changing application code.
4. After CORE-008 integration, claim residual R5/R6/R7/TEST-008 tasks on the shared board.
5. Perform LIVE-001 only against an integrated candidate and record actual iPad/EasyEDA versions and results.
6. Keep PR #5 transform work separate until explicitly reviewed for BETA mutation safeguards.

## Completion rules

- Update `WORKBOARD.md` at each ownership/status milestone.
- Record exact tested commit SHA and CI run for merged changes.
- Do not claim live-device validation from CI.
- Do not merge stale branch copies of `WORKBOARD.md`.
- Preserve the distinction between accepted target architecture, open PR implementation, and merged `main` behavior.
