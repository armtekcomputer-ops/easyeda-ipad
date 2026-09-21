# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/primitive-transform`
Base: `main`
Phase 4 merge commit: `84b59faff36af02ea4e33aba8f7eb806873b46a4`

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

## Completed through Phase 4

- Cloudflare-hosted PWA and Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Typed `EasyEdaApi` command layer over the existing gateway transport.
- Validated read-only snapshot of current document/project/PCB/schematic/selection state.
- Bounded primitive summaries and browser-side response validation.
- Selection synchronization for PCB/footprint/schematic using only verified public APIs.
- Selection writes accept only validated snapshot IDs; maximum 100 IDs, max 256 characters each, trim/dedupe, JSON serialization.
- Successful selection mutation always reads back through `getSnapshot()`.
- PR #4 merged after the exact latest head passed tests, TypeScript/Vite, Worker typecheck, Wrangler dry-run, and companion checks.
- Package version on `main`: `0.4.0`.

## Phase 5 goal

Add a narrowly-scoped transform capability for **one selected device component at a time** in active PCB and schematic-page documents.

Do **not** implement transform for arbitrary primitive types, footprint-editor primitives, multi-component transforms, routing, wire creation, arbitrary property editing, save, undo, redo, delete, copy/paste, or document creation in this phase.

## Official API research findings

Research source: official `easyeda/easyeda-api-skill` references/examples only.

### No generic all-primitive transform API

Searches for generic `movePrimitive(s)` / `rotatePrimitive(s)` / translate operations did not find a documented editor mutation API that safely transforms every primitive type. `SYS_Math.translate/rotate` only transforms polygon geometry in memory and is not an editor mutation API.

Many primitive classes expose type-specific `modify(...)` methods. To avoid unsafe type dispatch across tracks, pads, text, arcs, vias, pins, etc., Phase 5 is restricted to the verified **device component** APIs.

### PCB device components

Namespace: `eda.pcb_PrimitiveComponent` (`PCB & footprint / device primitive class`).

Verified methods used for Phase 5:

- `get(primitiveIds: string): Promise<IPCB_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | IPCB_PrimitiveComponent, property): Promise<IPCB_PrimitiveComponent | undefined>` — BETA

Verified `modify` transform fields:

- `x?: number`
- `y?: number`
- `rotation?: number`
- `primitiveLock?: boolean` also exists, but Phase 5 will not change lock state

Verified component state accessors available on the returned component:

- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`
- `getState_PrimitiveLock(): boolean`

The component object also exposes the documented async mutation pattern (`toAsync()`, `setState_X/Y/Rotation()`, `done()`), and the official skill gives an example of this pattern. Phase 5 will use the simpler documented `modify(...)` API after reading the current component state; it will not manipulate raw object fields.

PCB locked components must be rejected before mutation when `getState_PrimitiveLock()` is true.

### Schematic device components

Namespace: `eda.sch_PrimitiveComponent` (`Schematic & symbol / device primitive class`).

Verified methods used for Phase 5:

- `get(primitiveIds: string): Promise<ISCH_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | ISCH_PrimitiveComponent, property): Promise<ISCH_PrimitiveComponent | undefined>` — BETA

Verified `modify` transform fields include:

- `x?: number`
- `y?: number`
- `rotation?: number`
- `mirror?: boolean` also exists, but Phase 5 will not change mirror state

Verified component state accessors:

- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`

### Coordinate and rotation units

Official EasyEDA documentation states:

- PCB/footprint canvas coordinate unit: **1 mil**
- schematic/symbol canvas coordinate unit: **0.01 inch = 10 mil**
- rotation angles are in **degrees**
- positive rotation is **counter-clockwise**

For a consistent physical nudge in the iPad UI, Phase 5 uses a fixed **0.254 mm** movement step:

- PCB: 10 native units = 10 mil = 0.254 mm
- schematic: 1 native unit = 0.01 inch = 0.254 mm

Rotation controls use fixed `+90°` / `-90°` deltas.

### Coordinate-axis labeling decision

The official references searched for Phase 5 confirm units but did not provide a sufficiently explicit statement about the visual positive/negative Y direction for both editor domains. Phase 5 therefore does **not** label Y mutations as “up/down” or attach directional arrow semantics.

The UI exposes deterministic coordinate operations only:

- `X − 0.254 mm`
- `X + 0.254 mm`
- `Y − 0.254 mm`
- `Y + 0.254 mm`

This avoids guessing canvas-axis semantics. Rotation is safe to label `−90°` / `+90°` because the official docs explicitly state positive rotation is counter-clockwise.

### Absolute vs relative semantics

`modify(...)` accepts component property values (`x`, `y`, `rotation`) rather than delta arguments. Phase 5 implements a relative transform by:

1. retrieving the one selected component with `get(id)`,
2. reading current `getState_X/Y/Rotation()`,
3. calculating one bounded new absolute value,
4. calling `modify(id, { x })`, `modify(id, { y })`, or `modify(id, { rotation })` with only the field required for that operation.

No raw component object fields are mutated.

### Active document and supported domains

Phase 5 checks `eda.dmt_SelectControl.getCurrentDocumentInfo()` inside the same execute request before component lookup/mutation.

Supported document types:

- `PCB = 3` -> `eda.pcb_PrimitiveComponent`
- `SCHEMATIC_PAGE = 1` -> `eda.sch_PrimitiveComponent`

`FOOTPRINT = 4` is intentionally excluded from this phase. Although the PCB API family is also used by the footprint editor, Phase 5 specifically transforms **device component instances**, and a footprint-editor selection is not assumed to represent a device component.

### Single-component atomicity decision

The verified `PrimitiveComponent.modify(...)` APIs mutate one component at a time, and no documented atomic batch/transaction transform API was found. A multi-component loop could therefore partially mutate earlier components if a later `modify(...)` failed.

To avoid partial writes, Phase 5 requires **exactly one validated selected primitive ID**. The command rejects zero IDs and multi-selection before calling any component API. It then verifies that the selected ID resolves to a device component before the single write.

For PCB, the resolved component must also be unlocked before mutation.

## Phase 5 implementation decision

Phase 5 supports one selected PCB or schematic device component:

- nudge X by one fixed ±0.254 mm step
- nudge Y by one fixed ±0.254 mm step
- rotate by ±90°

It does not support arbitrary numeric text input or multi-selection. The UI operates only on the one ID from the latest validated snapshot.

## Phase 5 safety rules

- Use only the exact documented component APIs above.
- Never infer a generic transform API or dispatch arbitrary primitive types.
- Operate only when the latest validated snapshot contains exactly one selected ID.
- Reuse existing primitive-ID validation: trimmed, non-empty, max 256 characters.
- Reject zero or multiple IDs before generating a write command.
- Verify the ID resolves through the documented component `get(id)` API before mutation.
- Reject PCB locked components before the write.
- Movement is fixed to one 0.254 mm UI step per request; no arbitrary coordinate input in this phase.
- Rotation delta is fixed to ±90° per request.
- Check active document type inside the same execute request before lookup/mutation.
- Generated code embeds only the validated serialized ID and a fixed finite delta.
- Read current state through documented `getState_X/Y/Rotation()` accessors.
- Return and browser-validate a compact mutation result.
- Treat `modify(...)` returning `undefined` as mutation failure.
- After successful mutation, call `getSnapshot()` and use that fresh validated read-back as the source of truth.
- If document/component/lock/state preflight fails, perform zero mutation calls.

## Planned Phase 5 deliverables

- [x] Record exact verified transform API signatures/semantics in this HANDOFF.
- [x] Decide scope: PCB + schematic **one device component at a time**.
- [ ] Add typed component-transform command builders and response validation.
- [ ] Add component preflight, locked-PCB rejection, finite-state checks, and document-type dispatch.
- [ ] Add tests proving only verified `pcb_PrimitiveComponent` / `sch_PrimitiveComponent` APIs are called and zero/multi/non-component/locked selection causes zero writes.
- [ ] Add iPad X−/X+/Y−/Y+/rotate controls enabled only for exactly one validated snapshot selection ID.
- [ ] Read back state after every successful transform.
- [ ] Open a separate PR, run CI, update README/version/HANDOFF, and merge only when latest head is green.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Implement a typed single-component transform module for fixed coordinate operations X−/X+/Y−/Y+ by one physical 0.254 mm step and rotation ±90°. The execute command must verify the active document, resolve the one validated ID through the correct component `get(id)` API, reject locked PCB components, read finite current X/Y/rotation state, perform exactly one documented `modify(...)` call, validate its result, and trigger `getSnapshot()` only after success. Add focused Vitest coverage before changing the UI.