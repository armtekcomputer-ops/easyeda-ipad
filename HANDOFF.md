# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/cloudflare-vps-handoff-loop`
Base: `main`

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

## Phase 2 deliverables

- [x] Add `wrangler.jsonc` with static assets + Durable Object binding/export.
- [x] Add Worker code with:
  - `/api/health`
  - `/api/session/:session/status`
  - `/ws/ipad?session=...&token=...`
  - `/ws/vps?session=...&token=...`
- [x] Add Durable Object relay:
  - authenticate role before upgrading
  - one active VPS socket per session
  - zero or more iPad sockets
  - forward `execute` iPad -> VPS
  - route `result`/`error` VPS -> originating iPad
  - forward relay/VPS status events
  - enforce payload size limit
  - preserve client routing across hibernation using WebSocket attachments and self-contained relay IDs
- [ ] Add `companion/cloud-agent.mjs`:
  - scan `127.0.0.1:49620-49629`
  - connect outbound to Cloudflare `/ws/vps`
  - relay execute/result/error
  - reconnect with backoff
- [ ] Update PWA defaults/settings for Cloudflare hosted mode.
- [ ] Add npm scripts for Worker dev/deploy and cloud agent.
- [ ] Update README with VPS + Cloudflare deployment steps and secrets.
- [ ] Extend CI to generate/check Worker types, typecheck Worker, and syntax-check cloud agent.
- [ ] Open PR, run CI, fix failures, merge when green.

## Files added in current branch

- `wrangler.jsonc`
- `worker/tsconfig.json`
- `worker/index.ts`
- `HANDOFF.md`

## Security requirements

- Never put VPS secret into PWA assets.
- iPad token is user-supplied/runtime configuration, not hardcoded into bundle.
- Reject non-WebSocket upgrades on `/ws/*`.
- Validate `session` names with a conservative allowlist.
- Max executable code payload: 128 KiB.
- Worker should not log tokens or execute payload contents.
- Prefer `wss://` in production.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md` with completed work and next action.
2. Re-read `HANDOFF.md`.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Implement `companion/cloud-agent.mjs` for VPS outbound WSS relay to Cloudflare.