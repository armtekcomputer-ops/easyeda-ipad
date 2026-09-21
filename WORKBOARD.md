# Shared multi-chat work board

Canonical source: `armtekcomputer-ops/easyeda-ipad`, branch `main`, path `WORKBOARD.md`.
Updated: 2026-09-22T00:00:00Z. All timestamps use UTC ISO 8601.
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

## Current authoritative state

Historical records remain in Git history and earlier revisions. This section is the current coordination source of truth.

| ID | Priority | Deliverable | State | Owner | Evidence / next step |
| --- | --- | --- | --- | --- | --- |
| COORD-001 | P1 | Shared coordination protocol | done | chat-20260921-coordination-142684dc | Delivered on main |
| CORE-008 | P1 | Trusted-state hardening, PC companion migration, Phase 7 read-only component inspector | done | chat-20260921T150300Z-agent3-core008 | PR #8 merged as `45f3c607c274e8ccfa93e5687db489d57db1c31a` |
| REL-005 | P2 | Transport reliability | done | chat-20260921T152500Z-agent3-rel005 | PR #12 merged as `319d83c518fe1bf166b0e5339bea331d9bd0eb90` |
| BUILD-008 | P2 | Deterministic npm install/CI lockfile | done | chat-20260921T135900Z-agent1-build008 | PR #10 merged as `1e301302095d0d7582c981e24c9a083bd258ebca` |
| TEST-008 | P2 | Transport behavior tests | done | chat-20260921T155400Z-agent3-test008 | PR #13 merged as `4d8ae2101b80a38faeefef12b89eb6fb0f55817b` |
| UX-007 | P2 | Preview/control-surface UX honesty | done | chat-20260921T160500Z-agent3-ux007 | PR #14 merged as `21d9e0b16424cbe7e63fa74e60403257151ca753` |
| VIEW-001 | P2 | Read-only real-board viewer feasibility research | done | chat-20260921T141000Z-agent2-view001 | PR #9 merged as `34847b05cf979bc5e16b2f4a5394e3ba6390bae7` |
| OPS-001 | P2 | Deployment/runbook for Worker + Durable Object + outbound PC companion | done | chat-20260921T141500Z-agent3-ops001 | PR #11 merged as `a33f2d9ec66e993c69d1d1288bb579f83248a15b` |
| EDIT-005 | later | Guarded transform command layer | done | historical | PR #15 merged as `ab4364e7769ca7be3be4e26f935c503180142f88`; stale PR #5 closed/superseded |
| COORD-002 | P1 | Reconcile merged review queue | done | chatgpt-auto-easyeda | PR #20 merged as `e176768768d64663b7431f7faa193baa5e9c4e06` |
| EDIT-006 | P1 | Guarded component transform UI | done | chatgpt-auto-easyeda | PR #19 merged as `ebe35749ae41c23294298cabac7d65672d53760b`; exact-head CI `35640383362` succeeded |
| DEPLOY-001 | P1 | Initial Cloudflare deployment | todo | unassigned | Repository/config pre-deploy checks are green. Deploy current main to Cloudflare, set `IPAD_TOKEN` and `VPS_TOKEN`, record URL + commit, verify `/api/health` and authenticated session status. |
| LIVE-001 | P1 | Actual iPad + live EasyEDA end-to-end validation | blocked | unassigned | Blocked on DEPLOY-001. After deployment, validate real iPad + Worker/DO + PC companion + EasyEDA Pro/API Gateway. CI is not live validation. |

## Current write reservations

No repository code path is currently reserved. DEPLOY-001 is an external/account-side deployment operation; do not commit secret values.

## Deployment readiness checkpoint — 2026-09-22

- Current pre-deploy main before documentation-only correction: `080f5080e96bd573d72c00f2ad568e09768e9e25`.
- Push CI run `35640891560` succeeded on that commit.
- CI includes `npm ci`, tests, web build, Worker type generation/typecheck, `wrangler deploy --dry-run`, and both companion syntax checks.
- `wrangler.jsonc` declares Worker entrypoint, Static Assets, SPA fallback, Worker-first `/api/*` and `/ws/*`, `SESSIONS` Durable Object binding, declarative SQLite Durable Object export, and observability.
- `package-lock.json` is present and CI uses deterministic `npm ci`.
- `.env` and `.env.*` are ignored; production secrets must be configured in Cloudflare, not committed.
- Cloudflare production deployment has **not** been performed yet.
- Exact next action: deploy current `main` using Wrangler/Cloudflare, configure `IPAD_TOKEN` and `VPS_TOKEN`, record the deployment URL and exact deployed commit, verify health/status, then unblock LIVE-001.
