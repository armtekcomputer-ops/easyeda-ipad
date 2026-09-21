# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-21T14:24:00Z. All timestamps use UTC ISO 8601.
This file tracks ownership and unfinished work; HANDOFF.md tracks verified product state and decisions.
This is a cooperative protocol, not an automatic lock service or live chat monitor. Unregistered chats are unknown, not idle.

## Start every chat here

1. Read remote main AGENTS.md, HANDOFF.md and this file; inspect current main and open PRs. Do not trust a feature branch copy.
2. Choose a unique chat ID such as `chat-YYYYMMDDTHHMMSSZ-short-random`. Record a human-readable role. Do not invent another chat's identity.
3. Reconcile existing PR work before selecting a task. A task being in this backlog is not new implementation authorization.
4. Claim a task and all intended write paths on remote main using the optimistic update protocol below. Only start editing after successful write and read-back confirm your ownership.
5. Use a separate branch/worktree per task: `work/<task-id>/<chat-id>`. Read-only review may overlap; write ownership may not.
6. Refresh the board before each edit batch, scope expansion, push, review or merge. Renew the lease while actively working, about every 20 minutes and at milestones.
7. Before ending a turn, record completed work, remaining work, blockers, branch/head/PR and exact next action. Pause explicitly if waiting for user input.

## Atomic claim/update protocol

- Fetch latest remote main WORKBOARD.md and its blob SHA.
- Check task owner, lease, dependencies and every reserved path. Reserve paths for new files too. A directory reservation covers its descendants; never use vague overlapping scopes.
- Change only your records and append the event; preserve all other rows. Write through GitHub Contents API with the fetched SHA, or an equivalent commit based on the fetched main HEAD pushed without force.
- A 409/422 or non-fast-forward is a failed claim: re-fetch, re-check all reservations, and reapply only still-valid changes. Never retry an old whole-file body blindly.
- If the response is lost, read back remote state before retrying. A local edit, pending PR, or failed write is not a claim.
- Re-read remote file after success. Start only if task ID, chat ID, scope and lease match.
- All claims and heartbeat updates go directly to this canonical main file. Never maintain independent boards on task branches. Before merging a feature PR remove any stale WORKBOARD.md changes from its diff.
- If branch protection prevents direct coordination updates, stop claiming work and record/report the blocker; establish an approved shared coordination branch before implementation. Do not silently use per-chat boards.
- These rules serialize board updates but do not enforce filesystem locks. Every participating chat must follow them.

## Status and lease rules

`todo → claimed → in_progress → review → done`.
Use `blocked` for dependencies/problems, `paused` for deliberate suspension, `needs_reconciliation` for unregistered existing work, and `cancelled` for abandoned work with reason.

- Lease: normally 60 minutes from the latest heartbeat. Store claimed_at, updated_at and lease_until and checkpoint. No background heartbeat is implied while a chat is inactive.
- claimed/in_progress/review retain write reservations. blocked/paused must explicitly state whether reservations are retained; retained reservations also need a lease.
- Expiry means “needs reconciliation”, not automatic permission to take over. Inspect branch/PR commits and checkpoint first. Record a takeover reason and predecessor, then acquire a new claim atomically. If recent activity or ambiguous ownership remains, choose independent work.
- A resumed old owner must refresh first; if ownership changed, stop writing and hand over its branch/commit.
- done requires the intended deliverable accepted/merged as applicable, evidence and HANDOFF update; an open PR is review, not done. Release reservations explicitly.
- No secrets, tokens or private chat transcripts in this board.

## Chat registry

| Chat ID | Role | Task | State | Last update | Branch / checkpoint | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| chat-20260921-coordination-142684dc | Coordination documentation | COORD-001 | done | 2026-09-21T13:57:50.073Z | main; WORKBOARD + HANDOFF + AGENTS delivered together | Future chats register themselves and reconcile PR #8 |
| chat-20260921T135900Z-agent1-build008 | Agent 1 — reproducible build/CI | BUILD-008 | review | 2026-09-21T14:12:00Z | `work/BUILD-008/chat-20260921T135900Z-agent1-build008`; head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; PR #10 | PR #10 final CI is green; keep reservations through review, integrate only with merge authorization, then update HANDOFF and release |
| chat-20260921T141000Z-agent2-view001 | Agent 2 — real-board viewer research | VIEW-001 | claimed | 2026-09-21T14:10:00Z | planned `work/VIEW-001/chat-20260921T141000Z-agent2-view001`; main `d0ff0a15670537f6276908d296d918674b2cf499` | Research official documented read-only PCB geometry/preview APIs; write feasibility report only |
| chat-20260921T141500Z-agent3-ops001 | Agent 3 — PC companion deployment/runbook | OPS-001 | review | 2026-09-21T14:24:00Z | `work/OPS-001/chat-20260921T141500Z-agent3-ops001`; head `bdb931466bee39e3441cb8fe0607afa10a9a404f`; PR #11 | Exact-head CI run `35611613116` succeeded; keep reservation through review, integrate only with merge authorization |
| unknown-pr8 | Existing PR author/chat not yet registered | CORE-008 | needs_reconciliation | observed 2026-09-21T13:57:50.073Z | feat/pcb-component-inspector; observed d6d8a6213d1504d8e63e0e7b373a969711b34b1d | Owner self-registers and publishes scope/checkpoint; refresh PR head |
| unknown-pr5 | Existing PR author/chat not yet registered | EDIT-005 | needs_reconciliation | observed 2026-09-21T13:57:50.073Z | feat/primitive-transform; observed 4180c2f98191fed082927255d57f6372d4b9425b | Reconcile before any later transform work |

Observed PR timestamps above are observation times, not heartbeats. Unknown entries have no invented lease and must not be treated as abandoned.

## Tasks and unfinished work

Initial tasks come from HANDOFF review R1–R8 and live open PR metadata; completion of application work has not been re-audited in this documentation task.

| ID | Priority | Deliverable / acceptance | State | Owner | Dependencies / overlap | Branch / evidence / next step |
| --- | --- | --- | --- | --- | --- | --- |
| COORD-001 | P1 | Shared board, entry instructions and handoff protocol | done | chat-20260921-coordination-142684dc | Documentation only | main; verify published files |
| CORE-008 | P1 | Reconcile PR #8 inspector, trusted-state corrections and PC companion scope against R1–R4; record outstanding gaps and exact-head checks | needs_reconciliation | unknown-pr8 | Existing implementation; reserve scope below until reconciled | PR #8; do not start duplicate Phase 7/R1–R4 implementation |
| REL-005 | P2 | R5 connection deadlines/recovery/status and R6 bounded pending requests; check what PR #8 already covers first | blocked | unassigned | CORE-008, overlapping gateway/agent/UI | Claim only residual gaps after reconciliation |
| BUILD-008 | P2 | R8 reproducible dependency install and CI lockfile usage | review | chat-20260921T135900Z-agent1-build008 | No path overlap with current PR #8/#5; refreshed against Agent 2 coordination update before PR | PR #10; head `fb8712a9e222f465d086d5e9d87f14a6188b6427`; CI run `35610185239` success; merge/HANDOFF/release remain |
| TEST-008 | P2 | R8 transport behavior tests: auth, routing, disconnect, malformed/bounded payloads | blocked | unassigned | CORE-008 protocol stabilization; coordinate new test paths with BUILD-008 | Define exact test files before claim |
| UX-007 | P2 | R7 mark preview and disable unimplemented tools | blocked | unassigned | CORE-008 owns src/App.tsx | Refresh diff, then claim residual UI work |
| LIVE-001 | P1 | Device/end-to-end checklist and actual iPad + EasyEDA results with versions/commit | blocked | unassigned | Integrated candidate and available real devices/services | Document actual results; never infer live success from CI |
| VIEW-001 | P2 | Research documented read-only geometry/preview support; record sources and feasibility | claimed | chat-20260921T141000Z-agent2-view001 | Research only; no overlap with CORE-008 or BUILD-008 | Branch from main `d0ff0a15670537f6276908d296d918674b2cf499`; write `docs/research/real-board-viewer.md`; no canvas implementation |
| OPS-001 | P2 | Deployment/runbook aligned with actual accepted architecture and rollback | review | chat-20260921T141500Z-agent3-ops001 | PR #8 explicitly records accepted PC companion architecture; docs-only scope avoids CORE-008 code paths | PR #11 head `bdb931466bee39e3441cb8fe0607afa10a9a404f`; one docs file only; exact-head CI run `35611613116` success; merge/HANDOFF/release remain |
| EDIT-005 | later | Separate transform review with BETA API safeguards | blocked | unknown-pr5 | PR #5; explicit editing scope and CORE-008 integration first | Do not merge automatically |

## Write reservations

| Task | Owner | Reserved paths | Lease | Release condition |
| --- | --- | --- | --- | --- |
| BUILD-008 | chat-20260921T135900Z-agent1-build008 | package.json; package-lock.json; .github/workflows/ci.yml | 2026-09-21T15:12:00Z | PR #10 integrated or explicitly abandoned, checkpoint/HANDOFF synchronized, then paths released |
| VIEW-001 | chat-20260921T141000Z-agent2-view001 | docs/research/real-board-viewer.md | 2026-09-21T15:10:00Z | Research report reaches review/done and path is explicitly released or handed off |
| OPS-001 | chat-20260921T141500Z-agent3-ops001 | docs/DEPLOYMENT_PC_COMPANION.md | 2026-09-21T15:24:00Z | PR #11 integrated or explicitly abandoned, checkpoint/HANDOFF synchronized, then path released |
| CORE-008 | unknown-pr8 | companion/cloud-agent.mjs; companion/server.mjs; public/sw.js; src/App.tsx; src/lib/easyeda-pcb-component.ts; src/lib/easyeda-pcb-component.test.ts; src/lib/easyeda-safe-selection.ts; src/lib/easyeda-safe-selection.test.ts; src/lib/gateway.ts; worker/index.ts | unknown — reconciliation hold, not a timed claim | Owner registers current scope or explicit documented reconciliation |
| EDIT-005 | unknown-pr5 | Existing PR #5 diff requires fresh inspection before touching transform scope; known possible overlap with CORE-008 is unresolved | unknown — reconciliation hold | Review diff and resolve ownership before any write |

WORKBOARD.md uses per-update SHA coordination, not a long lease. HANDOFF.md, README.md, AGENTS.md, package/version files, lockfiles and CI/config are shared hotspots: claim them explicitly before substantive edits. The initial documentation bootstrap is released on publication. Product PR handoff changes must be reconciled against latest main; never overwrite another chat's sections.

## Task checkpoint — BUILD-008

- task_id / chat_id / role: BUILD-008 / chat-20260921T135900Z-agent1-build008 / Agent 1 — reproducible build/CI
- status / priority / authorized_scope: review / P2 / R8 dependency lockfile and CI deterministic install only; transport behavior tests remain TEST-008
- base_main_sha / branch / head_sha / PR: refreshed through `a317aa3a070bfa70d7139c4cb95feabbb6537863` / `work/BUILD-008/chat-20260921T135900Z-agent1-build008` / `fb8712a9e222f465d086d5e9d87f14a6188b6427` / #10
- write_paths (exact paths or explicit directory prefixes): package.json; package-lock.json; .github/workflows/ci.yml
- dependencies / acceptance: no overlap in current PR #8/#5 file lists; clean lockfile install; CI uses committed lockfile via `npm ci`; existing tests/build/Worker checks green
- claimed_at / updated_at / lease_until: 2026-09-21T13:59:00Z / 2026-09-21T14:12:00Z / 2026-09-21T15:12:00Z
- completed / remaining: generated and committed npm lockfile v3; permanent CI uses setup-node npm cache + `npm ci --no-audit --no-fund`; branch refreshed with current main coordination; PR #10 opened; exact-head pull-request CI passed. Remaining: authorized integration, HANDOFF update with merge evidence, release reservations
- checks (command, result, tested SHA; live tested yes/no): GitHub Actions run `35610185239` on head `fb8712a9e222f465d086d5e9d87f14a6188b6427`: npm ci success; npm test success; npm run build success; npm run worker:typecheck success; wrangler dry-run success; companion/server syntax success; companion/cloud-agent syntax success. Live tested no
- blocker / reservation retained yes/no: waiting for merge authorization/integration / yes
- next_action: mark PR #10 ready for review; do not merge without merge authorization; after merge update HANDOFF + WORKBOARD and release package/lockfile/CI reservations
- predecessor / takeover_reason (if any): none
- handoff_section / merge_commit / released_at: pending integration / none / none

## Task checkpoint — VIEW-001

- task_id / chat_id / role: VIEW-001 / chat-20260921T141000Z-agent2-view001 / Agent 2 — real-board viewer research
- status / priority / authorized_scope: claimed / P2 / official documented read-only PCB geometry/preview research only; no application canvas implementation
- base_main_sha / branch / head_sha / PR: d0ff0a15670537f6276908d296d918674b2cf499 / planned `work/VIEW-001/chat-20260921T141000Z-agent2-view001` / none yet / none
- write_paths (exact paths or explicit directory prefixes): docs/research/real-board-viewer.md
- dependencies / acceptance: research can run independently; cite official EasyEDA sources; distinguish documented stable/BETA/unsupported paths; recommend bounded read-only feasibility
- claimed_at / updated_at / lease_until: 2026-09-21T14:10:00Z / 2026-09-21T14:10:00Z / 2026-09-21T15:10:00Z
- completed / remaining: board/open reservations reviewed; remaining official API research, report, branch/PR/checkpoint
- checks (command, result, tested SHA; live tested yes/no): coordination inspection only; live tested no
- blocker / reservation retained yes/no: none / yes
- next_action: create branch; research official EasyEDA APIs; write feasibility report without touching application code
- predecessor / takeover_reason (if any): none
- handoff_section / merge_commit / released_at: none / none / none

## Task checkpoint — OPS-001

- task_id / chat_id / role: OPS-001 / chat-20260921T141500Z-agent3-ops001 / Agent 3 — PC companion deployment/runbook
- status / priority / authorized_scope: review / P2 / documentation for accepted Worker + Durable Object + outbound PC companion architecture only; no application code, no deployment, no Containers, no VPS
- base_main_sha / branch / head_sha / PR: `16f8289af7affca0f44a5bb950025f7f482c0afe` / `work/OPS-001/chat-20260921T141500Z-agent3-ops001` / `bdb931466bee39e3441cb8fe0607afa10a9a404f` / #11
- write_paths (exact paths or explicit directory prefixes): docs/DEPLOYMENT_PC_COMPANION.md
- dependencies / acceptance: architecture decision is explicit in open PR #8; runbook describes Cloudflare resources actually required, secrets, PC companion startup, iPad flow, verification, staged rollout, rollback and clearly excludes Cloudflare Containers/VPS
- claimed_at / updated_at / lease_until: 2026-09-21T14:15:00Z / 2026-09-21T14:24:00Z / 2026-09-21T15:24:00Z
- completed / remaining: reconciled PR #8 read-only; created 410-line runbook; branch is one commit ahead and changes only `docs/DEPLOYMENT_PC_COMPANION.md`; PR #11 opened; exact-head CI passed. Remaining: authorized integration, HANDOFF update/release after merge
- checks (command, result, tested SHA; live tested yes/no): PR #8 head `d6d8a6213d1504d8e63e0e7b373a969711b34b1d` CI run `35601180677` success; compare main→OPS branch shows one added docs file / 410 additions; PR #11 CI run `35611613116` completed successfully on head `bdb931466bee39e3441cb8fe0607afa10a9a404f`; live tested no
- blocker / reservation retained yes/no: waiting for review/integration / yes
- next_action: do not merge without merge authorization; after merge update HANDOFF + WORKBOARD and release docs path
- predecessor / takeover_reason (if any): none; independent docs task based on recorded architecture decision
- handoff_section / merge_commit / released_at: pending integration / none / none

## Per-task checkpoint template

Copy into a task detail section when claiming:

- task_id / chat_id / role:
- status / priority / authorized_scope:
- base_main_sha / branch / head_sha / PR:
- write_paths (exact paths or explicit directory prefixes):
- dependencies / acceptance:
- claimed_at / updated_at / lease_until:
- completed / remaining:
- checks (command, result, tested SHA; live tested yes/no):
- blocker / reservation retained yes/no:
- next_action:
- predecessor / takeover_reason (if any):
- handoff_section / merge_commit / released_at:

## Integration and handoff

- One chat at a time claims an integration task for the candidate PR and shared docs. Verify ownership, dependencies, latest main, final PR head and relevant checks before integration.
- Merge only within existing user authorization; this board does not grant deployment or unrelated editing permission.
- Resolve overlaps deliberately. Never overwrite another branch or force-push main; do not mark R1–R8 complete merely because a PR title mentions hardening.
- After integration, update this board and HANDOFF with actual merge SHA, evidence, unresolved work and next owner/task. If only one update succeeds, record the pending synchronization and finish it before claiming another task.
- HANDOFF contains product facts and architecture; this board owns task allocation. Historical review snapshots remain dated historical evidence.

## Events

- 2026-09-21T13:57:50.073Z: COORD-001 bootstrapped shared coordination from main and open PRs #8/#5. Only documentation changed. Existing chats are unregistered; no claim about their live activity or application completion.
- 2026-09-21T13:59:00Z: Agent 1 registered as `chat-20260921T135900Z-agent1-build008` and claimed BUILD-008 after confirming current PR #8/#5 file lists do not touch package manifest/lockfile/CI paths. Reserved package.json, package-lock.json and .github/workflows/ci.yml for 60 minutes.
- 2026-09-21T14:10:00Z: Agent 2 registered as `chat-20260921T141000Z-agent2-view001` and claimed VIEW-001 for official read-only PCB geometry/preview research only. Reserved `docs/research/real-board-viewer.md` for 60 minutes; no application code paths reserved.
- 2026-09-21T14:12:00Z: Agent 1 moved BUILD-008 to review. PR #10 head `fb8712a9e222f465d086d5e9d87f14a6188b6427` changes only `.github/workflows/ci.yml` and `package-lock.json`; pull-request CI run `35610185239` completed successfully. Reservations retained pending authorized integration/HANDOFF synchronization.
- 2026-09-21T14:15:00Z: Agent 3 registered as `chat-20260921T141500Z-agent3-ops001` and claimed OPS-001 for a docs-only PC companion deployment/runbook. Read-only reconciliation of PR #8 confirmed R1–R4 hardening plus Phase 7 inspector API/test foundation at head `d6d8a6213d1504d8e63e0e7b373a969711b34b1d`, with CI run `35601180677` success; no PR #8 code paths were claimed or edited.
- 2026-09-21T14:22:00Z: Agent 3 moved OPS-001 to review. PR #11 head `bdb931466bee39e3441cb8fe0607afa10a9a404f` changes only `docs/DEPLOYMENT_PC_COMPANION.md`; CI run `35611613116` is queued. Reservation retained pending final CI and authorized integration/HANDOFF synchronization.
- 2026-09-21T14:24:00Z: Agent 3 verified exact-head PR #11 CI run `35611613116` completed successfully on `bdb931466bee39e3441cb8fe0607afa10a9a404f`. OPS-001 remains in review with its docs reservation retained pending authorized integration and HANDOFF synchronization.
