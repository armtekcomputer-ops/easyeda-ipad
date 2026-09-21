# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/easyeda-api-integration`
Base: `main`
PR: `#3`
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

## Phase 3 goal

Replace the demo-only workspace behavior with real EasyEDA Pro API-backed operations, beginning with a strictly read-only state snapshot.

The existing `gateway.execute(code)` transport remains the execution path. PWA code calls a typed command layer that emits narrowly-scoped EasyEDA API snippets and validates every response before rendering.

## Verified official EasyEDA API surface

Verified from the official `easyeda/easyeda-api-skill` API references/examples.

### Current document / project

- `eda.dmt_SelectControl.getCurrentDocumentInfo()`
- `eda.dmt_Project.getCurrentProjectInfo()`

Verified editor document types used:

- `SCHEMATIC_PAGE = 1`
- `PCB = 3`
- `FOOTPRINT = 4`

### PCB metadata

- `eda.dmt_Pcb.getCurrentPcbInfo()`
- normalized fields: `uuid`, `name`, `parentProjectUuid`, optional `parentBoardName`

### Schematic metadata

- `eda.dmt_Schematic.getCurrentSchematicInfo()`
- `eda.dmt_Schematic.getCurrentSchematicPageInfo()`
- normalized schematic fields: `uuid`, `name`, `parentProjectUuid`, optional `parentBoardName`
- normalized page fields: `uuid`, `name`, `parentSchematicUuid`

### Selection

PCB/footprint namespace: `eda.pcb_SelectControl`

- `getAllSelectedPrimitives_PrimitiveId()`
- `getAllSelectedPrimitives()`

Schematic namespace: `eda.sch_SelectControl`

- `getAllSelectedPrimitives_PrimitiveId()`
- `getAllSelectedPrimitives()`

Selection mutation APIs exist but are deliberately disabled in this milestone.

### Undo / redo

No public undo/redo API was found in the current official API-skill references. Do not implement or guess it.

## Phase 3 implementation

- [x] Research official EasyEDA API names and supported operations.
- [x] Add `src/lib/easyeda-api.ts` typed read-only command layer.
- [x] Add `EasyEdaApi.getSnapshot()` using only verified read APIs.
- [x] Normalize current document, project, PCB/schematic metadata, selected IDs, and selected primitive summaries.
- [x] Cap selected IDs at 100 and primitive summaries at 20.
- [x] Limit primitive summaries to shallow scalar fields only, max 16 fields and 256 characters per string.
- [x] Validate every returned snapshot in the browser before rendering.
- [x] Add Vitest command-generation/validation tests.
- [x] Add `npm test` to CI.
- [x] Wire snapshot refresh/state into the PWA UI.
- [x] Replace misleading top-level write controls with `Refresh from EasyEDA` for this read-only milestone.
- [x] Show document type, project/context, selection count/first ID, and capture timestamp.
- [x] Surface API/validation errors without showing tokens or generated code.
- [x] Open PR #3.
- [x] First PR #3 CI run (`35592936289`) passed tests, PWA build, Worker typecheck, Wrangler dry-run, and both companion syntax checks.
- [x] Update README with Phase 3 behavior and verified API list.
- [ ] Verify CI on the latest documentation/HANDOFF head.
- [ ] Merge PR #3 when latest head is green.

## Files changed in Phase 3

- `HANDOFF.md`
- `README.md`
- `src/lib/easyeda-api.ts`
- `src/lib/easyeda-api.test.ts`
- `src/App.tsx`
- `package.json` (version `0.3.0`, Vitest/test script)
- `.github/workflows/ci.yml` (runs tests before build)

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

Re-read this HANDOFF. Check GitHub Actions for the latest branch head after README/HANDOFF changes. If green, verify PR #3 mergeability and squash-merge it into `main`. Then start a fresh branch/HANDOFF loop for the next verified capability rather than adding writes to this read-only PR.