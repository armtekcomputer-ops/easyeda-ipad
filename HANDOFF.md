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

The browser must never receive arbitrary privileged EasyEDA internals directly. The existing `gateway.execute(code)` transport remains the execution path, but PWA code calls a typed command layer that emits narrowly-scoped EasyEDA API snippets.

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
- other enum values exist; unknown/unhandled values remain numeric

### PCB document metadata

- `eda.dmt_Pcb.getCurrentPcbInfo()` -> `IDMT_PcbItem | undefined`
- verified fields used by our normalizer: `uuid`, `name`, `parentProjectUuid`, optional `parentBoardName`

### Schematic document metadata

- `eda.dmt_Schematic.getCurrentSchematicInfo()`
- `eda.dmt_Schematic.getCurrentSchematicPageInfo()`
- verified schematic fields used: `uuid`, `name`, `parentProjectUuid`, optional `parentBoardName`
- verified page fields used: `uuid`, `name`, `parentSchematicUuid`

### Selection — PCB / footprint

Namespace: `eda.pcb_SelectControl`.

Read APIs used:

- `getAllSelectedPrimitives_PrimitiveId()`
- `getAllSelectedPrimitives()`

Verified write APIs exist (`clearSelected`, `doSelectPrimitives`, `doCrossProbeSelect`) but remain disabled in this milestone.

### Selection — schematic

Namespace: `eda.sch_SelectControl`.

Read APIs used:

- `getAllSelectedPrimitives_PrimitiveId()`
- `getAllSelectedPrimitives()`

Verified write APIs exist but remain disabled.

### Primitive/property access

- Schematic generic getter exists: `eda.sch_Primitive.getPrimitiveByPrimitiveId(id)`.
- PCB `PCB_Primitive` current reference does not expose a generic equivalent, so the first milestone uses selected primitive objects returned by `pcb_SelectControl`.

### Undo / redo status

No public undo/redo API was found in the current official API-skill reference. Do not implement or guess it.

## Phase 3 implementation completed on current branch

- [x] Research official EasyEDA API names and supported operations.
- [x] Add `src/lib/easyeda-api.ts` typed read-only command layer.
- [x] Add `EasyEdaApi.getSnapshot()` using only verified read APIs.
- [x] Normalize current document, project, PCB/schematic metadata, selected IDs, and selected primitive summaries.
- [x] Cap selected IDs at 100 and primitive summaries at 20.
- [x] Limit primitive summaries to shallow scalar fields only, max 16 fields and 256 characters per string.
- [x] Validate every returned snapshot in the browser before rendering.
- [x] Add Vitest command-generation/validation tests.
- [x] Add `npm test` to CI.
- [ ] Wire snapshot refresh/state into the PWA UI.
- [ ] Run CI on a PR and fix failures.
- [ ] Update README and merge first read-only integration when green.

## Files changed in Phase 3 so far

- `HANDOFF.md`
- `src/lib/easyeda-api.ts`
- `src/lib/easyeda-api.test.ts`
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

Re-read this HANDOFF, then update the PWA to instantiate `EasyEdaApi` over the existing gateway, add a `Refresh from EasyEDA` action available only when connected, show document/project/context/selection snapshot status in the inspector, and surface validation/API errors without exposing secrets or raw execute code.