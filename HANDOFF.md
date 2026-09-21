# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Base: `main`
Current completed version: `0.6.0`
Phase 6 PR: `#7` merged
Phase 6 merge commit: `a6941a74093dddf54fb1848293c17d4273d532a4`
Phase 6 final head: `fee123c1d74d5807cf70734840eec571fb72b9d7`
Phase 6 final CI: run `35598740884` — success

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

## Completed capabilities

### Phase 1–2 — transport and iPad shell

- iPad-first PWA shell with touch/Pencil viewport foundation.
- Cloudflare Worker + Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Separate iPad/VPS authentication secrets.

### Phase 3 — validated read-only EasyEDA state

- Typed `EasyEdaApi` command layer.
- Current document/project/PCB/schematic/selection snapshot.
- Browser-side schema validation and bounded primitive summaries.

### Phase 4 — selection synchronization

- Clear and re-apply selection using only verified PCB/SCH APIs.
- UI cannot type arbitrary primitive IDs; it reuses validated IDs read from EasyEDA.
- Successful mutations read back a fresh snapshot.

### Phase 5 — validated editor navigation

- Read validated open-tab/split-screen state.
- Activate another already-open validated tab.
- Fit all primitives or the current selection.
- Refresh trusted editor/document state after activation.
- Merged in PR #6.

### Phase 6 — current-project document browser

Merged in PR #7 as `a6941a74093dddf54fb1848293c17d4273d532a4` after exact-head CI run `35598740884` succeeded.

Implemented:

- bounded current-project schematic-page/PCB discovery
- top-level and Board-contained document discovery
- no arbitrary document UUID input
- membership revalidation immediately before `openDocument`
- `openDocument(documentUuid)` without guessed split-screen ID
- activation of the returned validated tab
- editor/snapshot/project-document read-back before local state is trusted
- strict rejection of malformed response types
- maximum 128 documents, UUID max 256 chars, names max 128 chars
- version `0.6.0`

Project switching remains intentionally disabled because official `openProject()` documentation warns that unsaved changes in the previously open project can be lost.

## Phase 7 target — selected PCB component inspector

Goal: make the iPad inspector useful for real PCB editing workflows without introducing geometry mutation yet.

Phase 7 is read-only. It will inspect exactly one currently selected PCB/footprint **component/device** and expose a bounded validated component state such as:

- primitive ID
- designator
- name
- X coordinate
- Y coordinate
- rotation
- locked state
- layer as a bounded scalar display value when safely representable

### Verified official APIs

Selection/document guard:

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`
- `eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()`

Component lookup:

- `eda.pcb_PrimitiveComponent.get(primitiveId): Promise<IPCB_PrimitiveComponent | undefined>`

Component state getters on `IPCB_PrimitiveComponent`:

- `getState_PrimitiveId(): string`
- `getState_Designator(): string | undefined`
- `getState_Name(): string | undefined`
- `getState_X(): number`
- `getState_Y(): number`
- `getState_Rotation(): number`
- `getState_PrimitiveLock(): boolean`
- `getState_Layer(): TPCB_LayersOfComponent`

Important: `pcb_PrimitiveComponent.get()` is documented as a **BETA** API. Phase 7 therefore remains read-only. The documented BETA `modify(...)` API must not be introduced in this phase.

### Phase 7 safety design

- Only PCB (`documentType = 3`) and footprint (`documentType = 4`) contexts are accepted.
- UI supplies only a primitive ID already present in the latest validated EasyEDA selection snapshot.
- Command re-reads current document type and current selected IDs before component lookup.
- Exactly one selected ID is required.
- Selected ID must equal the expected validated ID supplied by the browser.
- If lookup returns `undefined`, treat the selected primitive as not a component; do not guess another primitive class.
- Read only scalar getters needed for the inspector.
- Bound strings and reject non-finite numeric coordinates/rotation.
- No `modify`, `setState_*`, `done`, delete, create, save, route, or geometry mutation API.

## Phase 7 status

- [x] Phase 6 merged and final exact-head CI verified.
- [x] Verify `PCB_PrimitiveComponent.get()` and scalar component getters.
- [x] Confirm `modify(...)` exists but is BETA and explicitly exclude it from Phase 7.
- [ ] Create Phase 7 branch from current `main`.
- [ ] Add bounded selected-component inspector command/parser.
- [ ] Add tests proving only read APIs are called and mutation APIs are absent.
- [ ] Run CI before UI integration.
- [ ] Add iPad component inspector UI only after API/tests are green.
- [ ] Update README/version/HANDOFF, final CI, merge.

## Safety / correctness rules carried forward

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- No secrets or gateway URLs in generated EasyEDA code.
- Treat all EasyEDA response values as untrusted until browser-side validation succeeds.
- Never accept arbitrary IDs/UUIDs for navigation or future write actions when a validated source list exists.
- Revalidate command targets against live EasyEDA state immediately before acting where practical.
- Never assume a write/navigation succeeded locally when documented read-back is available.
- Do not promote documented BETA mutation APIs into production-like UI without a separate explicitly scoped phase and stronger safeguards.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Create `feat/pcb-component-inspector` from current `main`, add a strictly read-only selected-component API/parser/tests, run CI, then integrate the inspector UI only if that exact API/test head is green.
