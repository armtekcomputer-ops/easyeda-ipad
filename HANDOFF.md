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

This phase stays limited to selection state. Do not add move/rotate/property edits/routing/save/undo/redo here.

## Verified official selection mutation API

Verified from the official `easyeda/easyeda-api-skill` references.

### PCB / footprint

Namespace: `eda.pcb_SelectControl`

- `clearSelected(): Promise<boolean>`
  - BETA
  - clears the active PCB/footprint selection
- `doSelectPrimitives(primitiveIds: string | Array<string>): Promise<boolean>`
  - BETA
  - selects primitives by primitive ID

### Schematic / symbol

Namespace: `eda.sch_SelectControl`

- `clearSelected(): boolean`
  - synchronous return
- `doSelectPrimitives(primitiveIds: string | Array<string>): Promise<boolean>`
  - selects primitives by primitive ID

### Active document dispatch

The selection control classes are documented for their editor domains (`PCB & footprint` and `Schematic & symbol`) and expose no document argument. Existing official guidance requires the correct document to be active before using a domain API. Phase 4 therefore dispatches based on the already validated current document type from `getSnapshot()` and does not invent a document selector argument.

Supported document types for mutation in this phase:

- `SCHEMATIC_PAGE = 1` -> `eda.sch_SelectControl`
- `PCB = 3` -> `eda.pcb_SelectControl`
- `FOOTPRINT = 4` -> `eda.pcb_SelectControl`

Other document types must fail before mutation.

## Selection event research

Official event classes exist, including PCB cross-probe/primitive events and SCH primitive events. However the official reference explicitly states these listeners are **extension-only** and calling them from a standalone script environment always throws an error.

The current gateway executes standalone code through `/execute`, so Phase 4 must **not** register these event listeners.

Decision: after every successful selection mutation, explicitly call `getSnapshot()` and use that validated read-back as the UI source of truth. No polling or guessed event API.

## Planned Phase 4 deliverables

- [x] Record exact verified selection mutation signatures in this HANDOFF.
- [ ] Add `EasyEdaApi.clearSelection()` with document-type dispatch.
- [ ] Add `EasyEdaApi.selectPrimitiveIds(ids)` with conservative validation and ID count limit.
- [ ] Never interpolate raw IDs into executable source; embed only JSON-serialized validated arrays.
- [ ] Return/validate a small mutation result and immediately refresh the read-only snapshot after success.
- [ ] Add tests proving generated commands only call verified selection APIs.
- [ ] Add iPad UI controls for selection sync using IDs already present in validated snapshot state.
- [x] Prefer explicit refresh because documented event listeners are extension-only.
- [ ] Open a separate PR, run CI, update README/HANDOFF, and merge only when current head is green.

## Safety / correctness rules

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- Maximum selection request: 100 primitive IDs.
- Every ID must be a trimmed, non-empty string no longer than 256 characters.
- Duplicate IDs must be removed before execution.
- Generated code must embed IDs using `JSON.stringify` output from the validated array; never concatenate IDs into quoted source fragments.
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

Implement the narrow mutation layer in `src/lib/easyeda-api.ts`: `clearSelection()` and `selectPrimitiveIds(ids)`, both using current-document validation/dispatch and returning a fresh validated snapshot only after the documented mutation reports success. Add command-generation, validation, input-limit, deduplication, and unsupported-document tests before changing the UI.