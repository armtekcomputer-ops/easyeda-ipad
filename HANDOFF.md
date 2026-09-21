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

## Verified official EasyEDA API surface

Verified from the official `easyeda/easyeda-api-skill` API references and examples. Do not rename or infer alternatives.

### Current document / project

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`
  - returns `IDMT_EditorDocumentItem | undefined`
  - verified properties: `documentType`, `uuid`, `tabId`, optional `parentProjectUuid`, optional `parentLibraryUuid`
  - API is marked BETA
- `eda.dmt_Project.getCurrentProjectInfo()`
  - returns `IDMT_ProjectItem | undefined`

Verified `EDMT_EditorDocumentType` values needed for first integration:

- `SCHEMATIC_PAGE = 1`
- `PCB = 3`
- `FOOTPRINT = 4`
- other enum values exist; unknown/unhandled values must remain numeric rather than being guessed

### PCB document metadata

- `eda.dmt_Pcb.getCurrentPcbInfo()`
  - returns `IDMT_PcbItem | undefined`

### Schematic document metadata

- `eda.dmt_Schematic.getCurrentSchematicInfo()`
- `eda.dmt_Schematic.getCurrentSchematicPageInfo()`
- `eda.dmt_Schematic.getCurrentSchematicAllSchematicPagesInfo()`
  - all marked BETA in current reference

### Selection — PCB

Namespace verified as `eda.pcb_SelectControl`.

Read APIs:

- `getAllSelectedPrimitives_PrimitiveId(): Promise<Array<string>>`
- `getAllSelectedPrimitives(): Promise<Array<IPCB_Primitive>>`
- `getCurrentMousePosition(): Promise<{x:number,y:number} | undefined>`

Write/selection-control APIs verified but NOT enabled in first read-only milestone:

- `clearSelected()`
- `doSelectPrimitives(primitiveIds)`
- `doCrossProbeSelect(...)`

### Selection — schematic

Namespace verified as `eda.sch_SelectControl`.

Read APIs:

- `getAllSelectedPrimitives_PrimitiveId(): Promise<Array<string>>`
- `getAllSelectedPrimitives(): Promise<Array<ISCH_Primitive>>`
- `getCurrentMousePosition(): Promise<{x:number,y:number} | undefined>`

Write/selection-control APIs verified but NOT enabled in first read-only milestone:

- `clearSelected()`
- `doSelectPrimitives(primitiveIds)`
- `doCrossProbeSelect(...)`

### Primitive/property access

Schematic:

- `eda.sch_Primitive.getPrimitiveByPrimitiveId(id)` returns `ISCH_Primitive | undefined`
- `eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id)` is BETA
- `eda.sch_Primitive.getPrimitivesBBox(...)` is BETA

PCB:

- `eda.pcb_Primitive.getPrimitivesBBox(...)` is verified
- the current `PCB_Primitive` class reference does not expose a generic `getPrimitiveByPrimitiveId`; use selected primitive objects from `pcb_SelectControl.getAllSelectedPrimitives()` for the first milestone rather than inventing a getter

### Editor controls verified for later work

`eda.dmt_EditorControl` exposes documented operations including `activateDocument`, `openDocument`, zoom/fit helpers, and split-screen management. These are not needed for the first read-only snapshot.

### Undo / redo status

No public undo/redo method was found in the current official API-skill references/search. Search for `undo` only found unrelated document-log wording; search for `redo` returned no API. Therefore **do not implement undo/redo yet**.

## Phase 3 deliverables

- [x] Research official EasyEDA Pro API names and supported operations from official SDK/skill repositories.
- [ ] Create `src/lib/easyeda-api.ts` typed command layer.
- [ ] Implement read-only document snapshot command first:
  - current document/editor type
  - current project/document identifiers where available
  - current PCB or schematic metadata where applicable
  - selected primitive IDs and a bounded/normalized selected primitive summary
- [ ] Add a PWA `Refresh from EasyEDA` action and state panel.
- [ ] Implement selection synchronization only after first snapshot integration is stable.
- [ ] Map safe editing commands incrementally:
  - selection APIs are verified but remain disabled initially
  - move/rotate/property updates require exact class-specific APIs to be researched before implementation
  - wire/route only after exact API support is verified
  - undo/redo blocked until public APIs are found
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
- Bound selected object data returned to the browser; avoid transporting an unbounded whole-document object graph.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Create `src/lib/easyeda-api.ts` with a typed, read-only `getSnapshot()` command generator/executor. It must use only the verified methods above, normalize the result, cap selected primitive summaries, validate the returned shape in the browser, and add tests for generated code/validation before wiring it into the UI.