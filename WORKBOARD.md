# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-21T15:43:00Z. All timestamps use UTC ISO 8601.
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
| chat-20260921T141500Z-agent3-ops001 | Agent 3 — PC companion deployment/runbook | OPS-001 | done | 2026-09-21T14:31:00Z | PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b` | No further OPS-001 work |
| chat-20260921T145300Z-agent3-recon008 | Agent 3 — PR #8 reconciliation reviewer | RECON-008 | done | 2026-09-21T14:57:00Z | review `5268152134` | Findings resolved by CORE-008 |
| chat-20260921T150300Z-agent3-core008 | Agent 3 — CORE-008 takeover | CORE-008 | done | 2026-09-21T15:22:00Z | PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a` | Reservation released; residual reliability/testing/UX work can now be claimed |
| chat-20260921T152500Z-agent3-rel005 | Agent 3 — transport reliability | REL-005 | review | 2026-09-21T15:43:00Z | `work/REL-005/chat-20260921T152500Z-agent3-rel005`; head `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06`; PR #12 | Exact-head CI `35620616365` green; merge only with explicit authorization after final main reconciliation |
| unknown-pr5 | Existing PR author/chat not yet registered | EDIT-005 | needs_reconciliation | observed 2026-09-21T13:57:50Z | `feat/primitive-transform`; head observed `4180c2f98191fed082927255d57f6372d4b9425b`; PR #5 | Reconcile only after explicit editing-scope review |

## Tasks

| ID | Priority | Deliverable | State | Owner | Dependency / evidence / next step |
| --- | --- | --- | --- | --- | --- |
| COORD-001 | P1 | Shared coordination protocol | done | chat-20260921-coordination-142684dc | Delivered on main |
| CORE-008 | P1 | Trusted-state hardening, PC companion migration, Phase 7 read-only component inspector | done | chat-20260921T150300Z-agent3-core008 | PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`; final pre-merge head `6269d83f4612ac0e00061ea3db1c1f304ef23b10`; exact-head CI `35618277426` success |
| RECON-008 | P1 | Read-only reconciliation/review of PR #8 | done | chat-20260921T145300Z-agent3-recon008 | Completed before CORE-008 takeover |
| REL-005 | P2 | R5 connection deadlines/recovery/status + R6 bounded pending requests | review | chat-20260921T152500Z-agent3-rel005 | PR #12 head `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06`; exact-head CI `35620616365` success. Browser/companion handshake + pong watchdog/reconnect, Worker status restoration, and bounded TTL/generation-safe relay tracking implemented. |
| BUILD-008 | P2 | Deterministic npm install/CI lockfile | review | chat-20260921T135900Z-agent1-build008 | PR #10 head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; CI `35610185239` success; merge requires explicit authorization |
| TEST-008 | P2 | Transport behavior tests for auth/routing/disconnect/malformed/payload bounds | todo | unassigned | Broader protocol suite remains separate; REL-005 includes only focused reliability regressions. Start after REL-005 integration or coordinate against its final protocol. |
| UX-007 | P2 | Clearly mark preview and disable/hide unimplemented tools | todo | unassigned | Now unblocked; `src/App.tsx` CORE-008 reservation released |
| LIVE-001 | P1 | Actual iPad + live EasyEDA end-to-end validation | todo | unassigned | Integrated main candidate now exists; requires real iPad, EasyEDA Pro, API Gateway, Worker/DO deployment and recorded versions/results |
| VIEW-001 | P2 | Documented read-only real-board viewer feasibility research | claimed | chat-20260921T141000Z-agent2-view001 | PR #9; documentation/research only |
| OPS-001 | P2 | Deployment/runbook for Worker + Durable Object + outbound PC companion | done | chat-20260921T141500Z-agent3-ops001 | PR #11 merged; runbook on main |
| EDIT-005 | later | Separate transform review with BETA mutation safeguards | blocked | unknown-pr5 | PR #5 remains separate; do not merge automatically |

## Write reservations

| Task | Owner | Reserved paths | Lease / hold | Release condition |
| --- | --- | --- | --- | --- |
| BUILD-008 | chat-20260921T135900Z-agent1-build008 | `package.json`; `package-lock.json`; `.github/workflows/ci.yml` | retained through review | Integrate or explicitly abandon, synchronize HANDOFF/board, then release |
| VIEW-001 | chat-20260921T141000Z-agent2-view001 | `docs/research/real-board-viewer.md` | retained while active | Research reaches review/done or explicit handoff |
| REL-005 | chat-20260921T152500Z-agent3-rel005 | `src/lib/gateway.ts`; `src/lib/gateway.test.ts`; `companion/cloud-agent.mjs`; `companion/relay-pending.mjs`; `companion/relay-pending.test.mjs`; `worker/index.ts` | retained through review | Integrate PR #12 or explicitly abandon/handoff, synchronize HANDOFF/board, then release |
| EDIT-005 | unknown-pr5 | Existing PR #5 transform diff | reconciliation hold | Review diff and resolve overlap before write/integration |

CORE-008 reservation is released as of 2026-09-21T15:22:00Z after PR #8 merge and HANDOFF synchronization. Previously reserved paths are available for newly claimed work except those now reserved by REL-005.

OPS-001 reservation for `docs/DEPLOYMENT_PC_COMPANION.md` remains released.

## Checkpoint — CORE-008

- task/chat: CORE-008 / `chat-20260921T150300Z-agent3-core008`
- state: done
- PR: #8
- final pre-merge head: `6269d83f4612ac0e00061ea3db1c1f304ef23b10`
- final sync: ahead 19 / behind 0 versus `main`
- exact-head CI: run `35618277426` succeeded
- merge commit: `45f3c607c274e8ccfa93e5687db489d57db1c31a`
- merged scope: R1–R4 hardening, PC companion cloud path, Phase 7 trusted read-only selected PCB/footprint component inspector API/tests/UI
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation released: yes
- residual work: REL-005, TEST-008, UX-007, LIVE-001

## Checkpoint — REL-005

- task/chat: REL-005 / `chat-20260921T152500Z-agent3-rel005`
- state: review
- branch/head/PR: `work/REL-005/chat-20260921T152500Z-agent3-rel005` / `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06` / #12
- browser gateway: 8s handshake deadline, 15s heartbeat, 10s pong watchdog, bounded reconnect backoff 1s→15s, manual disconnect suppresses retries
- Worker: live companion attachment retains `edaConnected/localBridgePort`; newly connected iPad immediately receives restored relay status; status API exposes same state
- PC companion: 5s cloud handshake deadline, heartbeat/pong watchdog, max 64 pending relay requests, 35s TTL, duplicate guard, local/cloud generation guards, disconnect/shutdown cleanup
- focused tests: gateway handshake/reconnect/watchdog/status and pending relay bounds/TTL/generation/drain
- first CI `35620316283`: tests 67/67 passed; build failed only on literal TypeScript inference for reconnect delay
- fix: explicit `number` annotation for reconnect delay; no logic change
- final exact-head CI: `35620616365` succeeded on `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06`
- final pre-board compare: ahead 7 / behind 0 versus main; only 6 REL-005 implementation/test files in PR diff
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation retained through review
- next: explicit user merge authorization; immediately before merge, refresh main/board, reconcile coordination-only drift, rerun exact-head CI if head changes, then merge and synchronize HANDOFF/WORKBOARD

## Checkpoint — BUILD-008

- task/chat: BUILD-008 / `chat-20260921T135900Z-agent1-build008`
- state: review
- branch/head/PR: `work/BUILD-008/chat-20260921T135900Z-agent1-build008` / `fb8712a9e222f465d086d5e9d87f14a6188b6427` / #10
- checks: CI run `35610185239` succeeded on exact head
- live tested: no
- remaining: explicit merge authorization; then HANDOFF/WORKBOARD sync and release reservation

## Checkpoint — VIEW-001

- task/chat: VIEW-001 / `chat-20260921T141000Z-agent2-view001`
- state: claimed
- scope: official documented read-only PCB geometry/preview research only
- reserved path: `docs/research/real-board-viewer.md`
- no application canvas implementation is authorized under this task

## Integration rules

- Verify final PR head and exact-head checks before integration.
- Merge only under explicit user authorization.
- Never merge stale `WORKBOARD.md` content from a feature branch.
- After every merge, synchronize `HANDOFF.md` and this board with the actual merge SHA and unresolved work.
- Do not claim CI as live iPad/EasyEDA validation.
- Keep mutation work such as PR #5 separate from read-only phases unless explicitly authorized.

## Events

- 2026-09-21T13:57:50Z — COORD-001 created the shared coordination protocol.
- 2026-09-21T14:12:00Z — BUILD-008 moved to review; PR #10 exact-head CI green.
- 2026-09-21T14:31:00Z — OPS-001 completed after PR #11 merge and HANDOFF sync.
- 2026-09-21T14:57:00Z — RECON-008 completed review of PR #8.
- 2026-09-21T15:03:00Z — User explicitly authorized takeover of CORE-008 after prior agent disconnected.
- 2026-09-21T15:05:00Z — Added Phase 7 trusted document identity guard and regression tests.
- 2026-09-21T15:12:00Z — Added read-only Phase 7 component inspector UI and visible PC companion terminology.
- 2026-09-21T15:13:00Z — CI `35617304968` succeeded on pre-review head `72089b33939b9e6fd64a8a944a9a6a072457d42d`.
- 2026-09-21T15:19:00Z — User explicitly authorized merge of PR #8.
- 2026-09-21T15:20:00Z — Final coordination-only main drift reconciled into PR #8; head became `6269d83f4612ac0e00061ea3db1c1f304ef23b10` and branch was ahead 19 / behind 0.
- 2026-09-21T15:21:00Z — Final exact-head CI run `35618277426` succeeded.
- 2026-09-21T15:21:00Z — PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`.
- 2026-09-21T15:22:00Z — HANDOFF/WORKBOARD synchronized; CORE-008 marked done and reservation released; REL-005, TEST-008, UX-007 and LIVE-001 unblocked.
- 2026-09-21T15:25:00Z — Agent 3 claimed REL-005 and reserved browser gateway plus cloud companion reliability paths after confirming no overlap with open PR #9/#10/#5.
- 2026-09-21T15:27:00Z — REL-005 scope expanded to `worker/index.ts` after identifying that current Worker relay status does not preserve EasyEDA status across iPad reconnects; no other task owns that path.
- 2026-09-21T15:38:00Z — PR #12 opened as draft with REL-005 implementation and focused regression coverage.
- 2026-09-21T15:39:00Z — CI `35620316283` passed all 67 tests but failed build on a TypeScript literal-inference annotation only; logic tests remained green.
- 2026-09-21T15:41:00Z — Widened reconnect delay property to `number`; no runtime logic change.
- 2026-09-21T15:42:00Z — Exact-head CI `35620616365` succeeded on `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06`; PR #12 marked ready for review.
- 2026-09-21T15:43:00Z — REL-005 moved to review; reservation retained pending explicit merge authorization.
