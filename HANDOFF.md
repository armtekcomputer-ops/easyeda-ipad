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

Namespace: `eda.pcb_PrimitiveComponent`.

Verified methods used:

- `get(primitiveIds: string): Promise<IPCB_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | IPCB_PrimitiveComponent, property): Promise<IPCB_PrimitiveComponent | undefined>` — BETA
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`
- `getState_PrimitiveLock(): boolean`

Verified transform properties: `x`, `y`, `rotation`. Lock state is read but never changed.

### Schematic device components

Namespace: `eda.sch_PrimitiveComponent`.

Verified methods used:

- `get(primitiveIds: string): Promise<ISCH_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | ISCH_PrimitiveComponent, property): Promise<ISCH_PrimitiveComponent | undefined>` — BETA
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`

Verified transform properties: `x`, `y`, `rotation`. Mirror state exists but is not changed.

### Units and UI semantics

Official documentation:

- PCB coordinate unit: 1 mil
- schematic coordinate unit: 0.01 inch = 10 mil
- rotation: degrees; positive is counter-clockwise

Fixed physical nudge:

- PCB: 10 native units = 0.254 mm
- schematic: 1 native unit = 0.254 mm

The references searched did not explicitly establish a shared visual Y-axis direction, so UI labels remain coordinate-based rather than “up/down”:

- X − 0.254 mm
- X + 0.254 mm
- Y − 0.254 mm
- Y + 0.254 mm
- rotation −90° / +90°

### Single-component atomicity decision

`modify(...)` is a one-component mutation and no documented atomic batch transform API was found. Multi-selection is rejected before write to prevent partial mutation.

Phase 5 requires exactly one distinct validated selection ID. The execute command verifies the active document and resolves that ID through the correct component `get(id)` API before the only possible write. PCB locked components are rejected before write.

Supported document types:

- PCB = 3
- SCHEMATIC_PAGE = 1

FOOTPRINT = 4 is intentionally excluded.

## Phase 5 implementation status

- [x] Record exact verified transform API signatures/semantics in this HANDOFF.
- [x] Decide scope: PCB + schematic, one device component at a time.
- [x] Add `src/lib/easyeda-transform.ts` as a separate typed transform layer over the same gateway executor.
- [x] Add fixed operations: `x-negative`, `x-positive`, `y-negative`, `y-positive`, `rotate-negative`, `rotate-positive`.
- [x] Reuse validated primitive-ID normalization and require exactly one distinct ID.
- [x] Generated code checks current document inside the same execute request.
- [x] PCB path uses only `pcb_PrimitiveComponent.get/modify` and rejects locked components.
- [x] Schematic path uses only `sch_PrimitiveComponent.get/modify`.
- [x] Generated code reads current coordinate/rotation using documented state getters and requires finite state before calculating the new absolute value.
- [x] Generated code performs exactly one documented `modify(...)` call at most.
- [x] Footprint/unsupported documents fail before component lookup/write.
- [x] Add versioned compact transform result validation with bounded failure reasons.
- [x] `EasyEdaComponentTransformApi.transform()` reads a fresh validated snapshot only after success.
- [x] Add Vitest coverage for command generation, single-selection requirement, unit constants, PCB/SCH nudge/rotation calculations, locked/non-component/invalid-state/unsupported preflight, result validation, and read-back behavior.
- [ ] Add iPad X−/X+/Y−/Y+/rotate controls enabled only for exactly one validated snapshot selection ID in PCB or schematic-page documents.
- [ ] Open PR #5 and run CI.
- [ ] Fix every CI failure before docs/version finalization.
- [ ] Update README/package version/HANDOFF after green code/UI CI.
- [ ] Merge PR #5 only when the exact latest head is green.

## Files changed so far in Phase 5

- `HANDOFF.md`
- `src/lib/easyeda-transform.ts`
- `src/lib/easyeda-transform.test.ts`

## Safety / correctness rules

- Use only the exact documented component APIs above.
- Never infer a generic transform API or dispatch arbitrary primitive types.
- Operate only when the latest validated snapshot contains exactly one distinct selected ID.
- Reuse primitive-ID validation: trimmed, non-empty, max 256 characters.
- Reject zero/multiple IDs before write code is created.
- Verify the ID resolves through component `get(id)` before mutation.
- Reject PCB locked components before write.
- Movement is fixed to 0.254 mm per request; no arbitrary numeric input.
- Rotation delta is fixed to ±90°.
- Check active document type inside the same execute request.
- Embed only validated serialized ID and fixed numeric constants.
- Read current state only via documented state accessors.
- Treat `modify(...)` returning `undefined` as failure.
- After success, read state back with `getSnapshot()`.
- If document/component/lock/state preflight fails, perform zero mutation calls.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Re-read this HANDOFF, then wire `EasyEdaComponentTransformApi` into the iPad inspector. Controls must use only `snapshot.selection.ids`, require exactly one selected ID, support PCB/schematic-page documents only, disable during refresh/selection-sync/transform activity, replace snapshot state only with the fresh read-back returned after success, and route transform errors through the existing sanitized error display. Do not add arbitrary numeric inputs.