# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/cloudflare-vps-handoff-loop`
Base: `main`
PR: `#2`

This file is the operational handoff. Continue work from this file first, not from chat memory.

## Current goal

Run EasyEDA Pro on a VPS, while hosting the iPad PWA and secure relay on Cloudflare Workers.

Target topology:

```text
iPad PWA
  |
  | HTTPS/WSS
  v
Cloudflare Worker + Static Assets
  |
  v
Durable Object session relay
  ^
  | outbound WSS
  |
VPS Agent
  |
  | localhost
  v
EasyEDA bridge 127.0.0.1:49620-49629
  |
  v
EasyEDA Pro on VPS
```

## Existing implementation on main

- React + TypeScript + Vite iPad-first PWA shell.
- Touch/Pencil gesture foundation.
- EasyEDA-compatible browser WebSocket gateway client.
- `companion/server.mjs` for direct LAN mode.
- GitHub Actions CI already builds the web app and syntax-checks companion.
- Phase 1 was merged via PR #1.

## Important protocol facts

- Official EasyEDA bridge scans/listens on ports `49620-49629` on loopback.
- EasyEDA-side service handshake uses `service: "easyeda-bridge"`.
- Agent requests use `{ type: "execute", id, code }` and receive `result`/`error`.
- Do NOT expose the EasyEDA local execute endpoint directly to the public Internet.

## Cloudflare design decisions

- Host Vite `dist/` using Workers Static Assets.
- Route `/api/*`, `/ws/*` through Worker first.
- Use one Durable Object per logical `session`.
- Use Durable Object WebSocket Hibernation API (`ctx.acceptWebSocket`) so idle sockets can hibernate.
- Use separate secrets for iPad and VPS roles (`IPAD_TOKEN`, `VPS_TOKEN`).
- VPS initiates outbound WSS to Cloudflare; Cloudflare never needs inbound access to the VPS local bridge.
- Default session ID: `default`.
- Wrangler config uses the 2026 declarative Durable Object `exports` model with SQLite storage.
- PWA Cloud mode builds a same-origin `/ws/ipad` WSS URL at runtime; the iPad token is entered by the user and stored only in `sessionStorage`.

## Phase 2 deliverables

- [x] Add `wrangler.jsonc` with static assets + Durable Object binding/export.
- [x] Add Worker code with `/api/health`, authenticated session status, `/ws/ipad`, and `/ws/vps`.
- [x] Add Durable Object relay with role authentication, one-VPS/multi-iPad routing, status events, payload limits, and hibernation-safe client attachments.
- [x] Add `companion/cloud-agent.mjs` with local bridge discovery, outbound Cloudflare WSS, bidirectional execute/result/error relay, status reporting, and reconnect backoff.
- [x] Update PWA for Cloudflare hosted mode while retaining Direct/LAN fallback.
- [x] Add npm scripts for Worker type generation/dev/deploy and cloud agent.
- [x] Update README with VPS + Cloudflare deployment, Worker secrets, cloud agent, iPad connection flow, systemd example, and security guidance.
- [x] Extend CI to build PWA, generate/typecheck Worker types, run Wrangler deploy dry-run, and syntax-check both companion modes.
- [x] Open PR #2.
- [ ] Get CI green, fix every failure, then merge.

## CI loop history

### Run 1 on PR #2

- Failed in `actions/setup-node` before dependencies/build.
- Cause: `cache: npm` requires a lockfile but this repository currently has no `package-lock.json`.
- Fix committed: remove npm caching from `setup-node` so CI can reach the actual build/type/Wrangler checks.

## Files added or changed in current branch

- `HANDOFF.md`
- `wrangler.jsonc`
- `worker/tsconfig.json`
- `worker/index.ts`
- `companion/cloud-agent.mjs`
- `package.json`
- `README.md`
- `.github/workflows/ci.yml`
- `src/App.tsx`
- `src/lib/gateway.ts`
- `src/styles.css`

## Security requirements

- Never put VPS secret into PWA assets.
- iPad token is user-supplied/runtime configuration, not hardcoded into bundle.
- Reject non-WebSocket upgrades on `/ws/*`.
- Validate `session` names with a conservative allowlist.
- Max executable code payload: 128 KiB.
- Worker should not log tokens or execute payload contents.
- Prefer `wss://` in production.

## Known implementation note

A temporary stylesheet overwrite regression occurred during development and was corrected in the same branch by restoring the complete stylesheet from `main` and reapplying only the Cloud mode control additions.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md` with completed work and next action.
2. Re-read `HANDOFF.md`.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Wait for the new PR #2 CI run triggered by commit `408d1b68a9c51a60e43880897c03b099ed7a99de`. Inspect the first failing step if any, fix it on this branch, update/re-read this HANDOFF, and repeat until CI is green.