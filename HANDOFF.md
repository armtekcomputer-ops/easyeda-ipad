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
- Successful selection mutation always reads back through `getSnapshot()`.
- PR #4 merged after exact-head green CI.
- Package version on `main`: `0.4.0`.

## Phase 5 goal

Add a narrowly-scoped transform capability for **one selected device component at a time** in active PCB and schematic-page documents.

Do **not** implement transform for arbitrary primitive types, footprint-editor primitives, multi-component transforms, routing, wire creation, arbitrary property editing, save, undo, redo, delete, copy/paste, or document creation in this phase.

## Verified official transform APIs

Research source: official `easyeda/easyeda-api-skill` references/examples only.

### PCB device components

Namespace: `eda.pcb_PrimitiveComponent`.

Verified:

- `get(primitiveIds: string): Promise<IPCB_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | IPCB_PrimitiveComponent, property): Promise<IPCB_PrimitiveComponent | undefined>` — BETA
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`
- `getState_PrimitiveLock(): boolean`

Transform fields used: `x`, `y`, `rotation`. Lock is read but never changed.

### Schematic device components

Namespace: `eda.sch_PrimitiveComponent`.

Verified:

- `get(primitiveIds: string): Promise<ISCH_PrimitiveComponent | undefined>`
- `modify(primitiveId: string | ISCH_PrimitiveComponent, property): Promise<ISCH_PrimitiveComponent | undefined>` — BETA
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`

Transform fields used: `x`, `y`, `rotation`. Mirror exists but is not changed.

### No generic all-primitive transform

No documented editor mutation API was found that safely moves/rotates every primitive type. `SYS_Math.translate/rotate` is geometry math, not an editor mutation API. Phase 5 therefore does not dispatch across tracks/pads/vias/text/pins/arcs or manipulate raw primitive structures.

### Units and labeling

Official docs:

- PCB coordinate unit: 1 mil
- schematic coordinate unit: 0.01 inch = 10 mil
- rotation: degrees; positive = counter-clockwise

One UI nudge is fixed to 0.254 mm:

- PCB = 10 native units
- schematic = 1 native unit

The searched references did not explicitly establish a shared visual Y-axis direction, so UI labels are coordinate-based rather than up/down:

- X − 0.254 mm
- X + 0.254 mm
- Y − 0.254 mm
- Y + 0.254 mm
- Rotation −90°
- Rotation +90°

### Single-component atomicity

The documented `modify(...)` API mutates one component and no atomic batch transform API was found. Multi-selection is rejected before write so the first transform feature cannot partially modify a group.

Supported document types:

- PCB = 3
- SCHEMATIC_PAGE = 1

FOOTPRINT = 4 is deliberately excluded.

## Phase 5 implementation status

- [x] Record exact verified transform API signatures and semantics.
- [x] Scope to PCB + schematic, exactly one device component at a time.
- [x] Add `src/lib/easyeda-transform.ts` as a separate typed layer over the existing gateway executor.
- [x] Operations: `x-negative`, `x-positive`, `y-negative`, `y-positive`, `rotate-negative`, `rotate-positive`.
- [x] Reuse validated primitive-ID normalization and require exactly one distinct ID before generating write code.
- [x] Check current document inside the same execute request.
- [x] Resolve the ID through the correct documented component `get(id)` API before mutation.
- [x] Reject locked PCB components before mutation.
- [x] Read current X/Y/rotation only through documented state accessors and require finite values.
- [x] Calculate one new absolute property value from the fixed delta.
- [x] Perform at most one documented `modify(...)` call per transform request.
- [x] Treat `modify(...)` returning `undefined` as mutation failure.
- [x] Add compact versioned transform result validation and bounded failure reasons.
- [x] `EasyEdaComponentTransformApi.transform()` reads a fresh validated snapshot only after success.
- [x] Add Vitest coverage for generated API usage, exact-one selection, unit constants, PCB/SCH X/Y/rotation math, locked/non-component/invalid-state/unsupported preflight, result validation, and snapshot read-back.
- [x] Wire transform API into the iPad inspector.
- [x] Transform controls use only the latest validated `snapshot.selection.ids` and require exactly one ID.
- [x] Transform controls support only PCB/schematic-page document types.
- [x] Refresh, Selection Sync, and Component Transform mutually disable one another while a write/read is active.
- [x] UI snapshot state is replaced only by the fresh validated read-back returned after successful transform.
- [x] Transform failures use the existing sanitized API error display.
- [x] Add separate `src/transform.css` responsive grid styles without changing the main stylesheet.
- [ ] Open PR #5 and run CI.
- [ ] Fix every CI failure before docs/version finalization.
- [ ] Update README/package version/HANDOFF after green code/UI CI.
- [ ] Verify CI on the final documentation/version head.
- [ ] Merge PR #5 only when the exact latest head is green.

## Files changed so far in Phase 5

- `HANDOFF.md`
- `src/lib/easyeda-transform.ts`
- `src/lib/easyeda-transform.test.ts`
- `src/App.tsx`
- `src/transform.css`
- `src/main.tsx`

## Safety / correctness rules

- Use only the exact documented component APIs above.
- Never infer a generic transform API or dispatch arbitrary primitive types.
- Operate only when latest validated snapshot contains exactly one distinct selected ID.
- Reuse primitive-ID validation: trimmed, non-empty, max 256 characters.
- Reject zero/multiple IDs before write code is generated.
- Verify ID resolves via documented component `get(id)` before mutation.
- Reject PCB locked components before write.
- Fixed nudge = 0.254 mm; no arbitrary numeric input.
- Fixed rotation = ±90°.
- Check active document inside same execute request.
- Read current component state through documented getters only.
- Perform at most one `modify(...)` call.
- After success, use fresh `getSnapshot()` read-back.
- Preflight failure performs zero mutation calls.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Re-read this HANDOFF, compare `feat/primitive-transform` to `main`, open PR #5 for the component transform milestone, and let GitHub Actions validate Vitest, TypeScript/Vite, Worker types, Wrangler dry-run, and companion syntax. Fix all failures on this branch before touching README/package version.