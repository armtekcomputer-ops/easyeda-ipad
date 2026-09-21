# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-21T18:22:00Z. All timestamps use UTC ISO 8601.
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
| chat-20260921T152500Z-agent3-rel005 | Agent 3 — transport reliability | REL-005 | done | 2026-09-21T15:50:00Z | PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90`; final head `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24` | Reservation released; TEST-008 can target merged protocol |
| chat-20260921T155400Z-agent3-test008 | Agent 3 — transport behavior coverage | TEST-008 | review | 2026-09-21T16:02:00Z | `work/TEST-008/chat-20260921T155400Z-agent3-test008`; head `a5052249ba636568615ff3b082218bcb5402e15c`; PR #13 | Exact-head CI `35622810269` green; merge only with explicit authorization after final main reconciliation |
| chat-20260921T160500Z-agent3-ux007 | Agent 3 — preview/control-surface UX honesty | UX-007 | review | 2026-09-21T16:11:00Z | `work/UX-007/chat-20260921T160500Z-agent3-ux007`; head `565c19372ea60770a6d6ab620845e7a34213c2ec`; PR #14 | Exact-head CI `35623710644` green; merge only with explicit authorization after final main reconciliation |
| unknown-pr5 | Existing PR author/chat not yet registered | EDIT-005 | needs_reconciliation | observed 2026-09-21T13:57:50Z | `feat/primitive-transform`; head observed `4180c2f98191fed082927255d57f6372d4b9425b`; PR #5 | Reconcile only after explicit editing-scope review |
| chatgpt-auto-easyeda-20260921T181200Z | Autonomous verification cycle | COORD-002 | review | 2026-09-21T18:15:10Z | resumes `work/COORD-002/chatgpt-auto-easyeda-20260921T180639Z`; head `1984167878d9f251ee00d2d4c47c441cddafef23`; PR #20 | Exact-head CI green; PR ready for review; wait for explicit merge authorization |
| chatgpt-auto-easyeda-20260921T182200Z | Autonomous reconciliation cycle | COORD-002 | in_progress | 2026-09-21T18:22:00Z | resumes `work/COORD-002/chatgpt-auto-easyeda-20260921T180639Z`; PR #20 | Reconcile current main drift into PR branch, rerun exact-head CI, then checkpoint review state; do not merge without explicit authorization |

## Tasks

| ID | Priority | Deliverable | State | Owner | Dependency / evidence / next step |
| --- | --- | --- | --- | --- | --- |
| COORD-001 | P1 | Shared coordination protocol | done | chat-20260921-coordination-142684dc | Delivered on main |
| CORE-008 | P1 | Trusted-state hardening, PC companion migration, Phase 7 read-only component inspector | done | chat-20260921T150300Z-agent3-core008 | PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`; final pre-merge head `6269d83f4612ac0e00061ea3db1c1f304ef23b10`; exact-head CI `35618277426` success |
| RECON-008 | P1 | Read-only reconciliation/review of PR #8 | done | chat-20260921T145300Z-agent3-recon008 | Completed before CORE-008 takeover |
| REL-005 | P2 | R5 connection deadlines/recovery/status + R6 bounded pending requests | done | chat-20260921T152500Z-agent3-rel005 | PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90`; final exact-head CI `35621474276` success on `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24`; reservation released |
| BUILD-008 | P2 | Deterministic npm install/CI lockfile | review | chat-20260921T135900Z-agent1-build008 | PR #10 head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; CI `35610185239` success; merge requires explicit authorization |
| TEST-008 | P2 | Transport behavior tests for auth/routing/disconnect/malformed/payload bounds | review | chat-20260921T155400Z-agent3-test008 | PR #13 head `a5052249ba636568615ff3b082218bcb5402e15c`; CI `35622810269` success with 80 tests. Worker auth/routing/envelope/byte-bound coverage and gateway disconnect/reply/malformed-frame coverage added; gateway now rejects >128 KiB execute code locally. |
| UX-007 | P2 | Clearly mark preview and disable/hide unimplemented tools | review | chat-20260921T160500Z-agent3-ux007 | PR #14 head `565c19372ea60770a6d6ab620845e7a34213c2ec`; exact-head CI `35623710644` success. Mock drawing rail hidden, canvas explicitly labeled Preview / control surface, unsupported editing stays in EasyEDA Pro. |
| LIVE-001 | P1 | Actual iPad + live EasyEDA end-to-end validation | todo | unassigned | Integrated main candidate exists; requires real iPad, EasyEDA Pro, API Gateway, Worker/DO deployment and recorded versions/results |
| VIEW-001 | P2 | Documented read-only real-board viewer feasibility research | claimed | chat-20260921T141000Z-agent2-view001 | PR #9; documentation/research only |
| OPS-001 | P2 | Deployment/runbook for Worker + Durable Object + outbound PC companion | done | chat-20260921T141500Z-agent3-ops001 | PR #11 merged; runbook on main |
| EDIT-005 | later | Separate transform review with BETA mutation safeguards | blocked | unknown-pr5 | PR #5 remains separate; do not merge automatically |

## Write reservations

| Task | Owner | Reserved paths | Lease / hold | Release condition |
| --- | --- | --- | --- | --- |
| BUILD-008 | chat-20260921T135900Z-agent1-build008 | `package.json`; `package-lock.json`; `.github/workflows/ci.yml` | retained through review | Integrate or explicitly abandon, synchronize HANDOFF/board, then release |
| VIEW-001 | chat-20260921T141000Z-agent2-view001 | `docs/research/real-board-viewer.md` | retained while active | Research reaches review/done or explicit handoff |
| TEST-008 | chat-20260921T155400Z-agent3-test008 | `src/lib/gateway.ts`; `src/lib/gateway.test.ts`; `worker/index.ts`; `worker/protocol.ts`; `worker/protocol.test.ts` | retained through review | Integrate PR #13 or explicitly abandon/handoff, synchronize HANDOFF/board, then release |
| UX-007 | chat-20260921T160500Z-agent3-ux007 | `src/styles.css` | retained through review | Integrate PR #14 or explicitly abandon/handoff, synchronize HANDOFF/board, then release |
| EDIT-005 | unknown-pr5 | Existing PR #5 transform diff | reconciliation hold | Review diff and resolve overlap before write/integration |

REL-005 reservation is released as of 2026-09-21T15:50:00Z after PR #12 merge and HANDOFF synchronization. TEST-008 retains its five review paths. UX-007 changed only `src/styles.css`; `src/App.tsx` is released and available for other tasks.

CORE-008 and OPS-001 reservations remain released.

## Checkpoint — CORE-008

- task/chat: CORE-008 / `chat-20260921T150300Z-agent3-core008`
- state: done
- PR: #8
- final pre-merge head: `6269d83f4612ac0e00061ea3db1c1f304ef23b10`
- exact-head CI: run `35618277426` succeeded
- merge commit: `45f3c607c274e8ccfa93e5687db489d57db1c31a`
- merged scope: R1–R4 hardening, PC companion cloud path, Phase 7 trusted read-only selected PCB/footprint component inspector API/tests/UI
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation released: yes

## Checkpoint — REL-005

- task/chat: REL-005 / `chat-20260921T152500Z-agent3-rel005`
- state: done
- PR: #12
- final pre-merge head: `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24`
- final exact-head CI: run `35621474276` succeeded
- merge commit: `319d83c518fe1bf166b0e5339bea331d9bd0eb90`
- merged browser gateway: 8s handshake deadline, 15s heartbeat, 10s pong watchdog, reconnect backoff 1s→15s, manual disconnect retry suppression
- merged Worker: retained companion `edaConnected/localBridgePort` and immediate status restoration to newly/reconnected iPad clients
- merged PC companion: 5s cloud handshake deadline, heartbeat/pong watchdog, max 64 pending relay requests, 35s TTL, duplicate guard, local/cloud generation guards, disconnect/shutdown cleanup
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation released: yes

## Checkpoint — TEST-008

- task/chat: TEST-008 / `chat-20260921T155400Z-agent3-test008`
- state: review
- branch/head/PR: `work/TEST-008/chat-20260921T155400Z-agent3-test008` / `a5052249ba636568615ff3b082218bcb5402e15c` / #13
- changed files: `src/lib/gateway.ts`, `src/lib/gateway.test.ts`, `worker/index.ts`, `worker/protocol.ts`, `worker/protocol.test.ts`
- Worker coverage: token equality, Bearer/query token selection, session/upgrade checks, route envelope round-trip/rejection, malformed status/envelope validation, UTF-8 frame/code bounds
- gateway coverage: result/error ID routing, unrelated IDs ignored, pending rejection on disconnect, malformed/unknown/oversized inbound frames, peer ping/pong, existing REL-005 watchdog/reconnect behavior
- boundary fix: browser rejects execute code above 128 KiB by UTF-8 bytes before sending; Worker limit is unchanged
- exact-head CI: run `35622810269` succeeded; 9 test files / 80 tests passed, web build passed, Worker types/typecheck passed, Wrangler dry-run passed, companion syntax checks passed
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation retained through review
- next: explicit user merge authorization; refresh main/board and reconcile coordination-only drift before merge, rerunning exact-head CI if head changes

## Checkpoint — UX-007

- task/chat: UX-007 / `chat-20260921T160500Z-agent3-ux007`
- state: review
- branch/head/PR: `work/UX-007/chat-20260921T160500Z-agent3-ux007` / `565c19372ea60770a6d6ab620845e7a34213c2ec` / #14
- changed files: `src/styles.css` only; `src/App.tsx` was not modified and its reservation is released
- hides legacy mock tool rail including Select/Wire/Route/Via/Text visual affordances
- expands preview canvas, adds visible Preview / control surface labels, and states that drawing/routing/vias/text/move/rotate remain in EasyEDA Pro on the PC
- demo-board traces are visually dimmed/dashed to avoid implying live editable geometry
- exact-head CI: run `35623710644` succeeded; tests/build/Worker typecheck/Wrangler dry-run/companion syntax checks passed
- live tested: no; CI is not live iPad/EasyEDA validation
- reservation retained on `src/styles.css` only through review
- next: explicit user merge authorization; refresh main/board and reconcile coordination-only drift before merge, rerunning exact-head CI if head changes

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
- Never merge stale branch copies of `WORKBOARD.md`.
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
- 2026-09-21T15:21:00Z — Final exact-head CI run `35618277426` succeeded and PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a`.
- 2026-09-21T15:22:00Z — HANDOFF/WORKBOARD synchronized; CORE-008 marked done and reservation released.
- 2026-09-21T15:25:00Z — Agent 3 claimed REL-005 and reserved browser gateway plus cloud companion reliability paths.
- 2026-09-21T15:27:00Z — REL-005 scope expanded to `worker/index.ts` for reconnect status restoration.
- 2026-09-21T15:38:00Z — PR #12 opened as draft with REL-005 implementation and focused regression coverage.
- 2026-09-21T15:39:00Z — CI `35620316283` passed all 67 tests but failed build on a TypeScript literal-inference annotation only.
- 2026-09-21T15:41:00Z — Widened reconnect delay property to `number`; no runtime logic change.
- 2026-09-21T15:42:00Z — Exact-head CI `35620616365` succeeded on `fdbafbc9a184dacb09fb5e6e32038dba40bc0e06`; PR #12 marked ready for review.
- 2026-09-21T15:43:00Z — REL-005 moved to review.
- 2026-09-21T15:48:00Z — Final coordination-only drift reconciled into PR #12; head became `e6bc586e84c1b03fcdbac1f1e6d7630ee48cdb24`, ahead 8 / behind 0.
- 2026-09-21T15:49:00Z — Final exact-head CI `35621474276` succeeded.
- 2026-09-21T15:49:00Z — PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90` under explicit user authorization.
- 2026-09-21T15:50:00Z — HANDOFF/WORKBOARD synchronized; REL-005 marked done and reservation released; TEST-008 ready to claim.
- 2026-09-21T15:54:00Z — Agent 3 claimed TEST-008 and reserved transport protocol/test paths; BUILD-008 package/lockfile/CI paths remain untouched.
- 2026-09-21T16:00:00Z — PR #13 opened as draft with five TEST-008 files; companion production files were not changed.
- 2026-09-21T16:01:00Z — Exact-head CI `35622810269` succeeded on `a5052249ba636568615ff3b082218bcb5402e15c`; 80 tests passed and all build/typecheck/dry-run/syntax steps were green.
- 2026-09-21T16:02:00Z — TEST-008 moved to review; reservation narrowed to the five changed files pending explicit merge authorization.
- 2026-09-21T16:05:00Z — Agent 3 claimed UX-007 and reserved `src/App.tsx` + `src/styles.css`; TEST-008 transport review remains isolated.
- 2026-09-21T16:08:00Z — PR #14 opened as draft; implementation touched only `src/styles.css`.
- 2026-09-21T16:10:00Z — Exact-head CI `35623710644` succeeded on `565c19372ea60770a6d6ab620845e7a34213c2ec`.
- 2026-09-21T16:11:00Z — UX-007 moved to review; `src/App.tsx` released, `src/styles.css` retained through review.

## COORD-002 current reconciliation

- Owner/run: `chatgpt-auto-easyeda-20260921T180639Z`; owner family: `chatgpt-auto-easyeda`.
- State: review; source issue: #17.
- Reserved exact paths: `HANDOFF.md`; `WORKBOARD.md` coordination updates only. Preserve unrelated owners and records.
- Branch: `work/COORD-002/chatgpt-auto-easyeda-20260921T180639Z`.
- Scope: reconcile verified merged PRs #9/#10/#13/#14/#15 and superseded #5; record open EDIT-006 #19 and pending LIVE-001 #18. No application code.
- Existing reservations remain held until main HANDOFF is synchronized and a fresh board update explicitly releases them.
- Next: prepare HANDOFF correction on task branch and open a draft PR; keep WORKBOARD updates on remote main only.

### COORD-002 checkpoint — 2026-09-21T18:09:06Z

- Run: `chatgpt-auto-easyeda-20260921T180639Z`; no active edit batch remains.
- Draft PR: #20; head: `1984167878d9f251ee00d2d4c47c441cddafef23`.
- Checks: GitHub PR merge/head records verified; inspected diff is HANDOFF.md only (+30/-31). CI not yet verified; no live test.
- Blocker/next: review PR #20 and check current-head CI; integrate only with applicable authorization, then synchronize this canonical board's task rows and release reconciled reservations. Do not recreate the PR. HANDOFF reservation retained through review.
- Verified merged: #9/#10/#13/#14/#15. #5 closed without merge, superseded by #15. #19 remains open; LIVE-001 #18 still lacks live evidence. Historical task rows above are not ready-to-claim work; their reservations remain on reconciliation hold until main HANDOFF is synchronized.

### COORD-002 resumed run — 2026-09-21T18:12:30Z

- Run: `chatgpt-auto-easyeda-20260921T181200Z`; owner family `chatgpt-auto-easyeda`.
- Resumes the existing COORD-002 reservation only; no takeover of another owner and no application-code paths claimed.
- Exact claimed paths for this run: `HANDOFF.md`; `WORKBOARD.md` coordination updates only.
- Branch/PR retained: `work/COORD-002/chatgpt-auto-easyeda-20260921T180639Z` / PR #20. Do not create a duplicate branch or PR.
- Current observations before edit batch: PR #20 head `1984167878d9f251ee00d2d4c47c441cddafef23`; exact-head CI run `35636536973` succeeded. PR #19 head `d01945d42d64609c424ce8ac49cab4118df2335a`; exact-head CI run `35634849924` succeeded. Neither CI result is live iPad/EasyEDA validation.
- Next: update PR #20 review metadata/checkpoint only; no merge without applicable explicit authorization. Preserve HANDOFF reservation until reconciliation is integrated and main board is synchronized.

### COORD-002 checkpoint — 2026-09-21T18:15:10Z

- Task/owner/run: COORD-002 / `chatgpt-auto-easyeda` / `chatgpt-auto-easyeda-20260921T181200Z`.
- Status: review.
- Branch/head/PR: `work/COORD-002/chatgpt-auto-easyeda-20260921T180639Z` / `1984167878d9f251ee00d2d4c47c441cddafef23` / https://github.com/armtekcomputer-ops/easyeda-ipad/pull/20.
- Verified checks: exact-head CI run `35636536973` succeeded; PR diff remains `HANDOFF.md` only (+30/-31); merged/closure records for #9/#10/#13/#14/#15/#5 reconciled; EDIT-006 PR #19 exact-head CI run `35634849924` succeeded on `d01945d42d64609c424ce8ac49cab4118df2335a`.
- PR #20 is now ready for review and GitHub reports it mergeable. It was not merged or deployed in this run.
- Live validation: none; CI does not count as real iPad/EasyEDA validation.
- Blockers/retained reservations: explicit merge authorization is required; retain `HANDOFF.md` and coordination-only `WORKBOARD.md` reservation until main HANDOFF reconciliation is integrated and the canonical board is synchronized.
- Exact next action: after explicit merge authorization, refresh `main`, WORKBOARD and PR #20 head/checks, merge only if still current, then update HANDOFF/WORKBOARD with actual merge SHA, release reconciled completed-task reservations, and close #17 when consistent.

### COORD-002 resumed run — 2026-09-21T18:22:00Z

- Task/owner/run: COORD-002 / `chatgpt-auto-easyeda` / `chatgpt-auto-easyeda-20260921T182200Z`.
- Status: in_progress; resumes the existing owner-family reservation only.
- Exact claimed paths: `HANDOFF.md`; `WORKBOARD.md` coordination updates only. No application-code paths are claimed.
- Current main: `c167bd4242260be5d8be8adbc3fc01d96c85140b`. PR #20 head remains `1984167878d9f251ee00d2d4c47c441cddafef23`, but compare now reports ahead 1 / behind 3 and GitHub reports `mergeable: false`.
- Existing exact-head CI `35636536973` succeeded on the old PR head, but must not be treated as exact-head validation after branch synchronization.
- Next edit batch: reconcile current main into the existing PR #20 branch without force-push, preserve the HANDOFF-only functional diff, then verify the new exact head and CI. No merge/deploy without explicit authorization.
