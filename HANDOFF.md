# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/easyeda-api-integration`
Base: `main`
Phase 2 merge commit: `8e95794f8189edf2cd064145afb874a2bf21152a`

This file is the operational handoff. Continue work from this file first, not from chat memory.

## Current architecture

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

## Completed Phase 2

- Cloudflare-hosted PWA + Durable Object relay.
- Separate `IPAD_TOKEN` and `VPS_TOKEN` authentication.
- VPS outbound-only cloud agent.
- Direct/LAN fallback companion retained.
- Cloudflare/VPS/EasyEDA status reporting in the PWA.
- Wrangler deployment flow and CI validation.
- PR #2 merged successfully after green CI.

## Phase 3 goal

Replace the demo-only workspace behavior with real EasyEDA Pro API-backed operations.

The browser must never receive arbitrary privileged EasyEDA internals directly. The existing `gateway.execute(code)` transport remains the execution path, but PWA code should call a small typed command layer that emits narrowly-scoped EasyEDA API snippets.

## Phase 3 deliverables

- [ ] Research official EasyEDA Pro API names and supported operations from official SDK/skill repositories.
- [ ] Create `src/lib/easyeda-api.ts` typed command layer.
- [ ] Implement read-only document snapshot command first:
  - current document/editor type
  - current project/document identifiers where available
  - selected objects where supported
  - basic board/schematic state needed by UI
- [ ] Add a PWA `Refresh from EasyEDA` action and state panel.
- [ ] Implement selection synchronization if supported.
- [ ] Map safe editing commands incrementally:
  - undo/redo
  - select
  - move/rotate
  - property updates
  - wire/route only after exact API support is verified
- [ ] Add unit/shape validation around messages returned by EasyEDA.
- [ ] Add CI tests for command generation that do not require a live EasyEDA instance.
- [ ] Update README/HANDOFF and open PR only after the first read-only integration is green.

## Safety / correctness rules

- Use only documented EasyEDA public APIs or APIs explicitly exposed by the official SDK/skill.
- Do not guess API method names.
- Start read-only before adding writes.
- Keep generated execute snippets short and deterministic.
- Never include Cloudflare/VPS secrets inside generated EasyEDA code.
- Treat all returned EasyEDA values as untrusted structured data and validate before rendering.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Research the official EasyEDA API surface for current editor/document state, selection, undo/redo, and object/property access. Record exact supported method names before writing any Phase 3 command code.