# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Base: `main`
Current completed version: `0.5.0`
Phase 5 PR: `#6` merged
Phase 5 merge commit: `54b480c9158d5e8cbfe1c18ec320f011fd006abd`
Phase 5 final head: `b9a252baf3a74114da2ed85740bd4d87e5333c58`
Phase 5 final CI: run `35597501079` — success

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
- `Refresh from EasyEDA` UI.

### Phase 4 — selection synchronization

- Clear and re-apply selection using only verified PCB/SCH APIs.
- Maximum 100 validated primitive IDs, max 256 characters each.
- UI cannot type arbitrary primitive IDs; it only reuses IDs read from validated EasyEDA state.
- Successful mutations read back a fresh EasyEDA snapshot.

### Phase 5 — validated editor navigation

Merged in PR #6 as `54b480c9158d5e8cbfe1c18ec320f011fd006abd`.

Implemented:

- Read validated open-tab/split-screen state.
- Identify the current active EasyEDA tab.
- Activate another already-open validated tab.
- Fit all primitives in EasyEDA.
- Fit the current selection in EasyEDA.
- Refresh editor state after tab activation.
- Refresh document snapshot after tab activation; stale document state is discarded if the follow-up read fails.
- Version bumped to `0.5.0`.

Verified APIs:

- `eda.dmt_EditorControl.getSplitScreenTree()`
- `eda.dmt_EditorControl.activateDocument(tabId)`
- `eda.dmt_EditorControl.zoomToAllPrimitives(tabId)`
- `eda.dmt_EditorControl.zoomToSelectedPrimitives(tabId)`
- `eda.dmt_SelectControl.getCurrentDocumentInfo()`

Safety limits:

- maximum 32 tabs
- maximum 16 split-screen nodes
- ID length max 256
- tab title max 128
- inputs sent back to EasyEDA come only from validated editor state and are JSON-serialized
- no open/close/save/geometry mutation was added in Phase 5

Final Phase 5 verification:

- exact head `b9a252baf3a74114da2ed85740bd4d87e5333c58`
- CI run `35597501079`
- conclusion `success`
- PR #6 mergeable before merge
- merged successfully

## Phase 6 target — current-project document browser

Goal: let the iPad open schematic pages and PCBs from the **already-current project** even when those documents are not already open as editor tabs.

This is intentionally narrower than project switching. Do **not** call `eda.dmt_Project.openProject()` in this phase because the official documentation warns that opening another project can directly lose unsaved changes in the previously open project.

### Verified official data source

`eda.dmt_Project.getCurrentProjectInfo(): Promise<IDMT_ProjectItem | undefined>`

`IDMT_ProjectItem.data` contains project document data including:

- `IDMT_SchematicItem`
- `IDMT_PcbItem`
- `IDMT_BoardItem`
- `IDMT_PanelItem`

For Phase 6, only these non-destructive document targets are planned initially:

- schematic pages from `IDMT_SchematicItem.page[]`
- PCB items from `IDMT_PcbItem`

Official identifiers:

- `IDMT_SchematicPageItem.uuid` — schematic sheet UUID
- `IDMT_PcbItem.uuid` — PCB UUID
- `EDMT_ItemType.SCHEMATIC_PAGE = 'Schematic Page'`
- `EDMT_ItemType.PCB = 'PCB'`

### Verified official open-document API

Namespace: `eda.dmt_EditorControl`

- `openDocument(documentUuid: string, splitScreenId?: string): Promise<string | undefined>`

Phase 6 will not pass a guessed split-screen ID. Initial implementation should call only `openDocument(documentUuid)` for a document UUID that came from the validated current-project browser state.

### Phase 6 safety rules

- Never accept arbitrary typed document UUIDs from the UI.
- Browser may only open UUIDs present in the latest validated current-project document list.
- Bound the number of returned documents before rendering.
- Bound UUID/name lengths.
- Serialize UUIDs with `JSON.stringify` before command generation.
- Do not call `openProject`, `closeDocument`, `save`, split-screen mutations, or geometry/property mutation APIs.
- After `openDocument` succeeds, read back fresh editor state and fresh EasyEDA snapshot before updating trusted local state.
- If any read-back fails, do not pretend the requested document became the trusted active state.

## Phase 6 status

- [x] Phase 5 merged and final CI verified.
- [x] Research `DMT_Project.getCurrentProjectInfo()` and detailed project-tree contract.
- [x] Verify schematic/page and PCB UUID contracts.
- [x] Verify `DMT_EditorControl.openDocument(documentUuid, splitScreenId?)` exists.
- [x] Explicitly reject `DMT_Project.openProject()` for Phase 6 due documented unsaved-data-loss risk.
- [ ] Create Phase 6 branch from current `main`.
- [ ] Add bounded current-project document parser/API.
- [ ] Add validated `openCurrentProjectDocument(uuid)` command.
- [ ] Add tests before UI integration.
- [ ] Add iPad Current Project Documents UI only after API/tests are green.
- [ ] Update README/version/HANDOFF, final CI, merge.

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

Create a new Phase 6 branch from current `main`, implement and test a bounded current-project document list plus validated `openDocument(documentUuid)` workflow, then run CI before adding the iPad project-document browser UI.
