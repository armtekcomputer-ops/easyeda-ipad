# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/selection-sync`
Base: `main`
Phase 3 merge commit: `ee30dad2c0e67fe3adc65b1c2ca31627bd17c5c5`

This file is the operational handoff. Continue work from this file first, not from chat memory.

## Current architecture

```text
iPad PWA
  |
  | HTTPS/WSS
  v
Cloudflare Worker + Durable Object relay
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

## Completed through Phase 3

- Cloudflare-hosted PWA and Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Typed `EasyEdaApi` command layer over the existing gateway transport.
- Read-only snapshot of current document/project/PCB/schematic/selection state.
- Browser-side validation and bounded primitive summaries.
- `Refresh from EasyEDA` UI.
- Tests and CI green; PR #3 merged.

## Phase 4 goal

Add the first narrowly-scoped write capability: selection synchronization between iPad and the active EasyEDA editor.

This phase must stay limited to selection state. Do not add move/rotate/property edits/routing/save/undo/redo here.

## Required research before code

Re-verify exact signatures and semantics from official API references for both PCB/footprint and schematic:

- `clearSelected()`
- `doSelectPrimitives(...)`
- return types / async behavior
- supported input primitive ID format
- whether selection APIs operate on the currently active document or require another selector

Also verify whether there is a documented selection-change event that can be subscribed to. If no safe/public event exists, use explicit refresh after mutation rather than inventing polling/event APIs.

## Planned Phase 4 deliverables

- [ ] Record exact verified selection mutation signatures in this HANDOFF.
- [ ] Add `EasyEdaApi.clearSelection()` with document-type dispatch.
- [ ] Add `EasyEdaApi.selectPrimitiveIds(ids)` with conservative validation and ID count limit.
- [ ] Never interpolate raw IDs into executable source; pass IDs using JSON serialization inside generated code.
- [ ] Return/validate a small mutation result and immediately refresh the read-only snapshot after success.
- [ ] Add tests proving generated commands only call verified selection APIs.
- [ ] Add iPad UI controls for selection sync using IDs already present in validated snapshot state.
- [ ] Prefer explicit refresh if no documented selection event is verified.
- [ ] Open a separate PR, run CI, update README/HANDOFF, and merge only when current head is green.

## Safety / correctness rules

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- Maximum selection request: 100 primitive IDs.
- Every ID must be a non-empty string with a conservative length bound before execution.
- Generated code must embed IDs via `JSON.stringify` output, not string concatenation into quoted source fragments.
- No secrets or gateway URLs in generated EasyEDA code.
- If document type is unsupported, fail without mutation.
- After write success, read state back through `getSnapshot()` rather than assuming local state.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Research exact official `PCB_SelectControl` and `SCH_SelectControl` mutation signatures (`clearSelected`, `doSelectPrimitives`) and search for any documented selection-change event. Record verified facts here before writing Phase 4 code.