# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-21T13:57:50.073Z. All timestamps use UTC ISO 8601.
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

- Lease: normally 60 minutes from the latest heartbeat. Store claimed_at, updated_at, lease_until and checkpoint. No background heartbeat is implied while a chat is inactive.
- claimed/in_progress/review retain write reservations. blocked/paused must explicitly state whether reservations are retained; retained reservations also need a lease.
- Expiry means “needs reconciliation”, not automatic permission to take over. Inspect branch/PR commits and checkpoint first. Record a takeover reason and predecessor, then acquire a new claim atomically. If recent activity or ambiguous ownership remains, choose independent work.
- A resumed old owner must refresh first; if ownership changed, stop writing and hand over its branch/commit.
- done requires the intended deliverable accepted/merged as applicable, evidence and HANDOFF update; an open PR is review, not done. Release reservations explicitly.
- No secrets, tokens or private chat transcripts in this board.

## Chat registry

| Chat ID | Role | Task | State | Last update | Branch / checkpoint | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| chat-20260921-coordination-142684dc | Coordination documentation | COORD-001 | done | 2026-09-21T13:57:50.073Z | main; WORKBOARD + HANDOFF + AGENTS delivered together | Future chats register themselves and reconcile PR #8 |
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
| BUILD-008 | P2 | R8 reproducible dependency install and CI lockfile usage | todo | unassigned | Check latest PR diffs before claiming; proposed package.json, package-lock.json, .github/workflows/ci.yml | Separate branch; clean install/build evidence |
| TEST-008 | P2 | R8 transport behavior tests: auth, routing, disconnect, malformed/bounded payloads | blocked | unassigned | CORE-008 protocol stabilization; coordinate new test paths with BUILD-008 | Define exact test files before claim |
| UX-007 | P2 | R7 mark preview and disable unimplemented tools | blocked | unassigned | CORE-008 owns src/App.tsx | Refresh diff, then claim residual UI work |
| LIVE-001 | P1 | Device/end-to-end checklist and actual iPad + EasyEDA results with versions/commit | blocked | unassigned | Integrated candidate and available real devices/services | Document actual results; never infer live success from CI |
| VIEW-001 | P2 | Research documented read-only geometry/preview support; record sources and feasibility | todo | unassigned | Research can run in parallel; proposed docs/research/real-board-viewer.md only | No canvas implementation until scope/API verified |
| OPS-001 | P2 | Deployment/runbook aligned with actual accepted architecture and rollback | blocked | unassigned | CORE-008 architecture decision | Reconcile PC companion vs historical VPS docs; no Containers introduced |
| EDIT-005 | later | Separate transform review with BETA API safeguards | blocked | unknown-pr5 | PR #5; explicit editing scope and CORE-008 integration first | Do not merge automatically |

## Write reservations

| Task | Owner | Reserved paths | Lease | Release condition |
| --- | --- | --- | --- | --- |
| CORE-008 | unknown-pr8 | companion/cloud-agent.mjs; companion/server.mjs; public/sw.js; src/App.tsx; src/lib/easyeda-pcb-component.ts; src/lib/easyeda-pcb-component.test.ts; src/lib/easyeda-safe-selection.ts; src/lib/easyeda-safe-selection.test.ts; src/lib/gateway.ts; worker/index.ts | unknown — reconciliation hold, not a timed claim | Owner registers current scope or explicit documented reconciliation |
| EDIT-005 | unknown-pr5 | Existing PR #5 diff requires fresh inspection before touching transform scope; known possible overlap with CORE-008 is unresolved | unknown — reconciliation hold | Review diff and resolve ownership before any write |

WORKBOARD.md uses per-update SHA coordination, not a long lease. HANDOFF.md, README.md, AGENTS.md, package/version files, lockfiles and CI/config are shared hotspots: claim them explicitly before substantive edits. The initial documentation bootstrap is released on publication. Product PR handoff changes must be reconciled against latest main; never overwrite another chat's sections.

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
