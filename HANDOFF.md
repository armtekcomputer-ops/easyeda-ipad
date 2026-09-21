# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/current-project-documents`
Base: `main`
Current branch version: `0.6.0`
Phase 5 PR: `#6` merged
Phase 5 merge commit: `54b480c9158d5e8cbfe1c18ec320f011fd006abd`
Phase 6 PR: `#7` open

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

## Completed capabilities through Phase 5

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

Merged in PR #6 as `54b480c9158d5e8cbfe1c18ec320f011fd006abd` after exact-head CI run `35597501079` succeeded.

Implemented:

- Read validated open-tab/split-screen state.
- Identify the current active EasyEDA tab.
- Activate another already-open validated tab.
- Fit all primitives in EasyEDA.
- Fit the current selection in EasyEDA.
- Refresh editor/document state after tab activation.

## Phase 6 — current-project document browser

Goal: let the iPad open schematic pages and PCBs from the **already-current project** even when those documents are not already open as editor tabs.

This phase intentionally does **not** expose project switching. The official `eda.dmt_Project.openProject()` documentation warns that opening another project can directly lose unsaved changes in the previously open project.

### Verified official APIs/contracts

Data source:

- `eda.dmt_Project.getCurrentProjectInfo(): Promise<IDMT_ProjectItem | undefined>`
- `IDMT_ProjectItem.data`
- `IDMT_SchematicItem.page[]`
- `IDMT_SchematicPageItem.uuid`
- `IDMT_PcbItem.uuid`
- `IDMT_BoardItem.schematic`
- `IDMT_BoardItem.pcb`

Open/focus:

- `eda.dmt_EditorControl.openDocument(documentUuid: string, splitScreenId?: string): Promise<string | undefined>`
- `eda.dmt_EditorControl.activateDocument(tabId: string): Promise<boolean>`

Phase 6 calls `openDocument(documentUuid)` without a guessed split-screen ID. The returned validated tab ID is passed through the existing editor navigation layer so the requested document becomes active, then trusted state is read back.

### Implemented Phase 6 command layer

File:

```text
src/lib/easyeda-project-documents.ts
```

Implemented:

- bounded current-project document state
- top-level PCB collection
- top-level schematic-page collection
- Board-contained PCB and schematic-page collection
- only `pcb` and `schematic-page` targets are exposed
- maximum 128 documents
- UUID length max 256
- document/project display name max 128
- duplicate document UUID rejection
- strict browser-side result type validation; malformed numeric/object UUID/tab IDs are rejected rather than coerced
- `openCurrentProjectDocument(uuid)` re-reads the current project inside the same execute command
- requested UUID must still be in that bounded current-project list before `openDocument` is called
- UUID source is validated and JSON-serialized
- no `openProject`, `closeDocument`, save, split-screen mutation, or geometry/property mutation API is called

Tests:

```text
src/lib/easyeda-project-documents.test.ts
```

Coverage includes command API names, absence of unsafe APIs, JSON serialization, UUID bounds, document-count bounds, duplicate rejection, malformed result types, stale document rejection, and successful validated tab-ID return.

### Implemented Phase 6 iPad UI

`src/App.tsx` now:

- loads document snapshot, editor state, and current-project documents together on Refresh
- clears mixed local state if the comprehensive refresh fails
- provides a Current Project Documents selector built only from validated state
- has no free-form document UUID input
- validates selector membership again before issuing the open request
- after `openDocument`, activates the returned validated tab
- reads back fresh editor state, EasyEDA snapshot, and current-project documents before committing trusted local state
- clears potentially stale local state when the document was opened but follow-up activation/read-back fails
- refreshes current-project documents when a normal editor tab activation can change project context
- prevents selection/editor/project-document operations from running concurrently

`src/styles.css` includes touch-friendly styling for the validated document/tab selectors.

### Phase 6 CI history

API/test foundation head `79412aa518743f740c7509b5d859f95140d326da`:

- CI run `35597890356` — success

Strict result parser/test head `1b08dc046b22573fefdf724f6d74fd1bd5a0d231`:

- CI run `35598136586` — success
- tests, PWA build, Worker typecheck, Wrangler validation, direct companion syntax, and VPS agent syntax all passed

UI head `355d20c710be0c2ef774e29710c748ae6c418f07`:

- CI run `35598385763` — success
- tests, PWA build, Worker typecheck, Wrangler validation, direct companion syntax, and VPS agent syntax all passed

Documentation/style/version commits were added after that UI CI run, so the exact latest head still requires a final green CI run before merge.

## Phase 6 status

- [x] Phase 5 merged and final CI verified.
- [x] Create Phase 6 branch `feat/current-project-documents`.
- [x] Research current-project tree contracts.
- [x] Verify schematic-page and PCB UUID contracts.
- [x] Verify `openDocument(documentUuid, splitScreenId?)`.
- [x] Explicitly reject `openProject()` for this phase due documented unsaved-data-loss risk.
- [x] Add bounded current-project document parser/API.
- [x] Add validated `openCurrentProjectDocument(uuid)` command with in-command membership revalidation.
- [x] Add tests before UI integration.
- [x] Harden result parser to reject malformed types and re-run CI.
- [x] Add iPad Current Project Documents UI only after API/tests were green.
- [x] Add selector styling.
- [x] Update README for Phase 6.
- [x] Bump package version to `0.6.0`.
- [x] Update this HANDOFF.
- [ ] Verify CI on the exact latest Phase 6 head.
- [ ] Confirm PR #7 is mergeable on that exact head.
- [ ] Merge PR #7 only after final green CI.
- [ ] After merge, update `main` HANDOFF and start the next narrow capability on a new branch.

## Phase 6 files changed

- `HANDOFF.md`
- `README.md`
- `package.json`
- `src/App.tsx`
- `src/styles.css`
- `src/lib/easyeda-project-documents.ts`
- `src/lib/easyeda-project-documents.test.ts`

## Safety / correctness rules carried forward

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- No secrets or gateway URLs in generated EasyEDA code.
- Treat all EasyEDA response values as untrusted until browser-side validation succeeds.
- Never accept arbitrary IDs/UUIDs for write/navigation actions when a validated source list exists.
- Revalidate mutation targets inside the command immediately before a mutation where practical.
- Never assume a write/navigation succeeded locally when documented read-back is available.
- Keep each phase narrowly scoped; do not combine unrelated mutation families into one PR.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Identify the exact latest PR #7 head after style/README/version/HANDOFF updates, verify its GitHub Actions CI run is `success`, confirm PR #7 is mergeable, then merge. After merge, update HANDOFF on `main` before choosing the next capability.
