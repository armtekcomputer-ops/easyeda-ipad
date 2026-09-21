# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/editor-navigation`
Base: `main`
Phase 4 PR: `#4` merged
Phase 4 merge commit: `84b59faff36af02ea4e33aba8f7eb806873b46a4`
Phase 4 final head: `c96f0455c56bf60d53ac1920d75f9056a7dc1605`
Phase 4 final CI: run `35594979703` — success

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

## Completed phases

### Phase 1–2

- iPad-first PWA shell with touch/Pencil viewport foundation.
- Cloudflare Worker + Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Separate iPad/VPS authentication secrets.

### Phase 3 — validated read-only EasyEDA state

- Typed `EasyEdaApi` command layer.
- Current document/project/PCB/schematic/selection snapshot.
- Browser-side schema validation and bounded primitive summaries.
- `Refresh from EasyEDA` UI.
- PR #3 merged with CI green.

### Phase 4 — selection synchronization

- Verified selection APIs only:
  - `eda.pcb_SelectControl.clearSelected()`
  - `eda.pcb_SelectControl.doSelectPrimitives(primitiveIds)`
  - `eda.sch_SelectControl.clearSelected()`
  - `eda.sch_SelectControl.doSelectPrimitives(primitiveIds)`
- Active document dispatch via `eda.dmt_SelectControl.getCurrentDocumentInfo()` inside the mutation command.
- Maximum 100 validated primitive IDs, max 256 characters each, trimmed and de-duplicated.
- UI cannot type arbitrary primitive IDs; it can only reuse IDs from validated EasyEDA state.
- Successful selection mutations read back a fresh snapshot before local state changes.
- PR #4 merged as `84b59faff36af02ea4e33aba8f7eb806873b46a4` after final head CI run `35594979703` passed.

## Phase 5 goal — editor navigation

Add non-destructive iPad control over the EasyEDA editor itself before introducing geometry/property mutations.

Scope for this phase:

- Read the currently open editor tab/split-screen state.
- Identify the active EasyEDA tab.
- Activate an already-open EasyEDA document tab.
- Fit all primitives in a validated tab.
- Fit the current selection in a validated tab.

Explicitly out of scope:

- close document
- open document/library document
- create/move/merge split screens
- save
- move/rotate primitives
- property editing
- routing/wire creation
- undo/redo

## Verified official Phase 5 APIs

Verified from `easyeda/easyeda-api-skill`.

Namespace: `eda.dmt_EditorControl`

- `getSplitScreenTree(): Promise<IDMT_EditorSplitScreenItem | undefined>`
- `activateDocument(tabId: string): Promise<boolean>`
- `zoomToAllPrimitives(tabId?: string): Promise<{ left: number; right: number; top: number; bottom: number } | false>`
- `zoomToSelectedPrimitives(tabId?: string): Promise<{ left: number; right: number; top: number; bottom: number } | false>`

Current active tab is correlated using the already-verified:

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`

Relevant official data contracts:

`IDMT_EditorSplitScreenItem`

- `id: string`
- `tabs?: Array<IDMT_EditorTabItem>`
- `children?: Array<IDMT_EditorSplitScreenItem>`
- `tabs` and `children` do not coexist on the same node.

`IDMT_EditorTabItem`

- `tabId: string`
- `title: string`
- `documentType: EDMT_EditorDocumentType`
- `draggable: boolean`
- `isAbleDelete: boolean`

## Phase 5 safety limits

- Maximum 32 tabs returned to the browser.
- Maximum 16 split-screen nodes traversed.
- Tab/split-screen IDs are limited to 256 characters.
- Tab titles are limited to 128 characters.
- All external EasyEDA editor state is schema-validated before UI use.
- Tab IDs sent back to EasyEDA are trimmed, non-empty, length-bounded, and serialized with `JSON.stringify`.
- Phase 5 navigation operations never call save/open/close/move/split-screen mutation APIs.
- Tab activation reads back fresh editor state before it is trusted locally.
- Viewport fit commands do not change PCB/schematic document data.

## Phase 5 implementation status

- [x] Confirm Phase 4 final head CI `35594979703` passed and PR #4 is merged.
- [x] Create branch `feat/editor-navigation` from Phase 4 merge commit.
- [x] Verify official editor state/tab contracts and navigation signatures.
- [x] Add `src/lib/easyeda-editor.ts`.
- [x] Add bounded editor state parser.
- [x] Add `EasyEdaEditorApi.getState()`.
- [x] Add `EasyEdaEditorApi.activateTab(tabId)` with read-back after success.
- [x] Add `EasyEdaEditorApi.fitAll(tabId)`.
- [x] Add `EasyEdaEditorApi.fitSelection(tabId)`.
- [x] Add tests for command generation, tab-ID serialization/validation, bounded editor-state validation, activation read-back, and fit-selection behavior.
- [ ] Open Phase 5 PR and run CI on the current API/test head.
- [ ] Fix any CI/typecheck/test failures before UI integration.
- [ ] Add iPad Editor Navigation UI only after API/tests are green.
- [ ] Refresh both editor state and EasyEDA snapshot after tab activation.
- [ ] Disable Fit Selection when no validated selection exists.
- [ ] Update README for Phase 5 behavior.
- [ ] Bump package version to `0.5.0` after Phase 5 UI is complete.
- [ ] Run final CI and merge only if the exact latest head is green and mergeable.

## Phase 5 files currently changed

- `HANDOFF.md`
- `src/lib/easyeda-editor.ts`
- `src/lib/easyeda-editor.test.ts`

## Safety / correctness rules carried forward

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- No secrets or gateway URLs in generated EasyEDA code.
- Treat all EasyEDA response values as untrusted until browser-side validation succeeds.
- Never assume a write/navigation succeeded locally when a documented read-back is available.
- Keep each phase narrowly scoped; do not combine unrelated mutation families into one PR.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Open a Phase 5 PR from `feat/editor-navigation` to `main`, let CI validate the new editor API/tests, inspect the exact head result, fix failures if any, then proceed to the Editor Navigation UI only after that head is green.
