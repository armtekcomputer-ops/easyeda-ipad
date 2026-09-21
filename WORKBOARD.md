# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-21T15:03:00Z. All timestamps use UTC ISO 8601.
This file tracks ownership and unfinished work; `HANDOFF.md` tracks verified product state and decisions.

## Required workflow

1. Read remote `main` copies of `AGENTS.md`, `HANDOFF.md`, and this file before choosing or editing a task.
2. Inspect current `main` and open PRs; do not trust branch-local coordination files.
3. Register a unique chat ID and claim exact write paths before editing.
4. Use a separate branch/worktree per task.
5. Re-fetch this board before each edit batch, scope expansion, push, review, or merge.
6. A 409/422/non-fast-forward means the claim/update failed; re-fetch and reconcile rather than retrying stale content.
7. Open PRs are not merged capabilities.
8. Do not write paths reserved by another task.
9. Before ending a turn, publish current state, branch/head/PR, checks, blockers, and exact next action.

## Status model

`todo → claimed → in_progress → review → done`

Use `blocked`, `paused`, or `needs_reconciliation` when appropriate. An expired lease does not grant automatic takeover; inspect the branch/PR first.

## Chat registry

| Chat ID | Role | Task | State | Last update | Branch / checkpoint | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| chat-20260921-coordination-142684dc | Coordination documentation | COORD-001 | done | 2026-09-21T13:57:50Z | main | Future chats follow board protocol |
| chat-20260921T135900Z-agent1-build008 | Agent 1 — reproducible build/CI | BUILD-008 | review | 2026-09-21T14:12:00Z | `work/BUILD-008/chat-20260921T135900Z-agent1-build008`; head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; PR #10 | CI green; integrate only with explicit merge authorization, then sync HANDOFF/WORKBOARD |
| chat-20260921T141000Z-agent2-view001 | Agent 2 — real-board viewer research | VIEW-001 | claimed | 2026-09-21T14:10:00Z | `work/VIEW-001/chat-20260921T141000Z-agent2-view001`; PR #9 | Complete research-only feasibility work without application-code changes |
| chat-20260921T141500Z-agent3-ops001 | Agent 3 — PC companion deployment/runbook | OPS-001 | done | 2026-09-21T14:31:00Z | PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b`; HANDOFF refreshed on main | No further OPS-001 work; reservation released |
| chat-20260921T145300Z-agent3-recon008 | Agent 3 — PR #8 reconciliation reviewer | RECON-008 | done | 2026-09-21T14:57:00Z | review-only; PR review `5268152134`; no CORE-008 code writes | Findings transferred to active CORE-008 owner |
| chat-20260921T150300Z-agent3-core008 | Agent 3 — CORE-008 takeover | CORE-008 | in_progress | 2026-09-21T15:03:00Z | inherited `feat/pcb-component-inspector`; head `d6d8a6213d1504d8e63e0e7b373a969711b34b1d`; PR #8 | Add document identity guard + regression tests, reconcile current main, run fresh exact-head CI |
| unknown-pr5 | Existing PR author/chat not yet registered | EDIT-005 | needs_reconciliation | observed 2026-09-21T13:57:50Z | `feat/primitive-transform`; head observed `4180c2f98191fed082927255d57f6372d4b9425b`; PR #5 | Reconcile before any transform integration |

## Tasks

| ID | Priority | Deliverable | State | Owner | Dependency / evidence / next step |
| --- | --- | --- | --- | --- | --- |
| COORD-001 | P1 | Shared coordination protocol | done | chat-20260921-coordination-142684dc | Delivered on main |
| CORE-008 | P1 | Reconcile PR #8 trusted-state corrections, PC companion migration, Phase 7 foundation | in_progress | chat-20260921T150300Z-agent3-core008 | User explicitly authorized takeover after prior agent disconnected. R1-R4 hardening present. Add expected `documentType + uuid + tabId` guard and regression test to Phase 7 inspector, then reconcile current main and run fresh exact-head CI before merge. |
| RECON-008 | P1 | Read-only reconciliation/review of PR #8 against current main | done | chat-20260921T145300Z-agent3-recon008 | Review `5268152134` published; findings handed to active CORE-008 owner. |
| REL-005 | P2 | R5 connection deadlines/recovery/status + R6 bounded pending requests | blocked | unassigned | Wait for CORE-008 integration; claim only residual gaps. R5 still lacks handshake deadline/pong watchdog/automatic recovery; R6 still lacks TTL/max in-flight cleanup for `pendingRelayIds`. |
| BUILD-008 | P2 | Deterministic npm install/CI lockfile | review | chat-20260921T135900Z-agent1-build008 | PR #10 head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; CI run `35610185239` success |
| TEST-008 | P2 | Transport behavior tests for auth/routing/disconnect/malformed/payload bounds | blocked | unassigned | Wait for CORE-008 protocol stabilization |
| UX-007 | P2 | Clearly mark preview and disable/hide unimplemented tools | blocked | unassigned | `src/App.tsx` currently overlaps CORE-008 |
| LIVE-001 | P1 | Actual iPad + live EasyEDA end-to-end validation | blocked | unassigned | Requires integrated candidate and real devices/services |
| VIEW-001 | P2 | Documented read-only real-board viewer feasibility research | claimed | chat-20260921T141000Z-agent2-view001 | PR #9; documentation/research only |
| OPS-001 | P2 | Deployment/runbook for Worker + Durable Object + outbound PC companion | done | chat-20260921T141500Z-agent3-ops001 | PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b`; CI `35611613116` success; HANDOFF synchronized |
| EDIT-005 | later | Separate transform review with BETA mutation safeguards | blocked | unknown-pr5 | PR #5; do not merge automatically |

## Write reservations

| Task | Owner | Reserved paths | Lease / hold | Release condition |
| --- | --- | --- | --- | --- |
| BUILD-008 | chat-20260921T135900Z-agent1-build008 | `package.json`; `package-lock.json`; `.github/workflows/ci.yml` | retained through review | Integrate or explicitly abandon, synchronize HANDOFF/board, then release |
| VIEW-001 | chat-20260921T141000Z-agent2-view001 | `docs/research/real-board-viewer.md` | retained while active | Research reaches review/done or explicit handoff |
| CORE-008 | chat-20260921T150300Z-agent3-core008 | `companion/cloud-agent.mjs`; `companion/server.mjs`; `public/sw.js`; `src/App.tsx`; `src/lib/easyeda-pcb-component.ts`; `src/lib/easyeda-pcb-component.test.ts`; `src/lib/easyeda-safe-selection.ts`; `src/lib/easyeda-safe-selection.test.ts`; `src/lib/gateway.ts`; `worker/index.ts` | active takeover authorized by user | Integrate PR #8 or explicitly hand off, synchronize HANDOFF/board, then release |
| EDIT-005 | unknown-pr5 | Existing PR #5 transform diff | reconciliation hold | Review diff and resolve overlap before write/integration |

`RECON-008` was review-only and reserved no application file. Its task branch remains a coordination checkpoint only and must not be used to modify CORE-008 code.

`OPS-001` reservation for `docs/DEPLOYMENT_PC_COMPANION.md` is released as of 2026-09-21T14:31:00Z after PR #11 merge and HANDOFF synchronization.

## Checkpoint — BUILD-008

- task/chat: BUILD-008 / `chat-20260921T135900Z-agent1-build008`
- state: review
- branch/head/PR: `work/BUILD-008/chat-20260921T135900Z-agent1-build008` / `fb8712a9e222f465d086d5e9d87f14a6188b6427` / #10
- scope: lockfile + deterministic CI install only
- checks: CI run `35610185239` succeeded on exact head
- live tested: no
- remaining: authorized integration; then HANDOFF/WORKBOARD sync and release reservations

## Checkpoint — VIEW-001

- task/chat: VIEW-001 / `chat-20260921T141000Z-agent2-view001`
- state: claimed
- scope: official documented read-only PCB geometry/preview research only
- reserved path: `docs/research/real-board-viewer.md`
- no application canvas implementation is authorized under this task

## Checkpoint — OPS-001

- task/chat: OPS-001 / `chat-20260921T141500Z-agent3-ops001`
- state: done
- branch/head/PR: `work/OPS-001/chat-20260921T141500Z-agent3-ops001` / `bdb931466bee39e3441cb8fe0607afa10a9a404f` / #11
- exact-head CI: run `35611613116` succeeded
- merge commit: `a33f2d9ec66e993c69d1d1288bb579f83248a15b`
- merged deliverable: `docs/DEPLOYMENT_PC_COMPANION.md`
- live tested: no; documentation only
- HANDOFF synchronization commit: `423b5bf6527798b3d87b8c2ee3639039691afa7d`
- reservation released: yes
- remaining: none for OPS-001

## Checkpoint — RECON-008

- task/chat: RECON-008 / `chat-20260921T145300Z-agent3-recon008`
- state: done
- task branch: `work/RECON-008/chat-20260921T145300Z-agent3-recon008` (coordination checkpoint only; no PR/code changes)
- reviewed PR/head: #8 / `d6d8a6213d1504d8e63e0e7b373a969711b34b1d`
- GitHub review: `5268152134`
- exact-head CI already present: run `35601180677` succeeded on the old base
- current-main delta since PR merge-base: only `AGENTS.md`, `HANDOFF.md`, `WORKBOARD.md`, `docs/DEPLOYMENT_PC_COMPANION.md`; no application-code overlap observed
- confirmed R1 selection identity guard, R2 trusted-state invalidation, R3 service-worker API bypass, and R4 envelope validation are present in PR #8
- Phase 7 component inspector is read-only and mutation APIs are absent from its tests
- blocking correctness finding for Phase 7 UI: inspector does not compare live `uuid/tabId` against the trusted document identity; same primitive ID in another PCB/footprint could be read as if it were the original document
- deferred REL-005 findings remain: no gateway handshake deadline/pong watchdog/automatic recovery; `pendingRelayIds` has no TTL/max in-flight cleanup while bridge stays connected
- legacy `vps` identifiers remain compatibility names; they do not imply a VPS requirement
- no live iPad/EasyEDA validation performed by this review
- next: active CORE-008 owner implements the guard and reconciles the PR

## Checkpoint — CORE-008 takeover

- task/chat: CORE-008 / `chat-20260921T150300Z-agent3-core008`
- state: in_progress
- inherited branch/head/PR: `feat/pcb-component-inspector` / `d6d8a6213d1504d8e63e0e7b373a969711b34b1d` / #8
- takeover reason: prior agent lost connection; user explicitly authorized this chat to continue PR #8
- reservations: all existing CORE-008 paths transferred from `unknown-pr8`
- first correction: add trusted document identity (`documentType + uuid + tabId`) to read-only PCB component inspection and regression-test document switching with the same primitive ID
- integration requirement: reconcile current main and obtain fresh exact-head CI before merge
- live tested: no

## Integration rules

- Verify final PR head and exact-head checks before integration.
- Merge only under explicit user authorization.
- Never merge stale `WORKBOARD.md` content from a feature branch.
- After every merge, synchronize `HANDOFF.md` and this board with the actual merge SHA and unresolved work.
- Do not claim CI as live iPad/EasyEDA validation.
- Keep mutation work such as PR #5 separate from read-only phases unless explicitly authorized.

## Events

- 2026-09-21T13:57:50Z — COORD-001 created the shared coordination protocol.
- 2026-09-21T13:59:00Z — Agent 1 claimed BUILD-008.
- 2026-09-21T14:10:00Z — Agent 2 claimed VIEW-001.
- 2026-09-21T14:12:00Z — BUILD-008 moved to review; PR #10 exact-head CI green.
- 2026-09-21T14:15:00Z — Agent 3 claimed OPS-001 after read-only reconciliation of PR #8.
- 2026-09-21T14:22:00Z — OPS-001 moved to review; PR #11 opened.
- 2026-09-21T14:24:00Z — PR #11 exact-head CI run `35611613116` succeeded.
- 2026-09-21T14:29:00Z — User explicitly authorized merge of PR #11.
- 2026-09-21T14:30:00Z — PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b`.
- 2026-09-21T14:31:00Z — HANDOFF synchronized and OPS-001 reservation released; task marked done.
- 2026-09-21T14:53:00Z — Agent 3 started RECON-008 review-only reconciliation of PR #8; no takeover of CORE-008 paths.
- 2026-09-21T14:54:00Z — Confirmed PR #8 is diverged from current main; PR body updated to block stale-base merge pending owner reconciliation and fresh CI.
- 2026-09-21T14:56:00Z — Confirmed current-main delta since PR #8 merge-base is coordination/docs only, with no application-code overlap.
- 2026-09-21T14:57:00Z — Published PR #8 review `5268152134`; recorded Phase 7 document-identity correctness gap and completed RECON-008 without modifying CORE-008 code paths.
- 2026-09-21T15:03:00Z — User reported the prior PR #8 agent disconnected and explicitly authorized Agent 3 to take over CORE-008; ownership and reservations transferred to `chat-20260921T150300Z-agent3-core008`.