# EasyEDA iPad — HANDOFF

Last updated: 2026-09-21 (Asia/Bangkok)

## Project source of truth

Repository: `armtekcomputer-ops/easyeda-ipad`
Branch in progress: `feat/selection-sync`
Base: `main`
PR: `#4`
Phase 3 merge commit: `ee30dad2c0e67fe3adc65b1c2ca31627bd17c5c5`

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

## Completed through Phase 3

- Cloudflare-hosted PWA and Durable Object relay.
- VPS outbound cloud agent and Direct/LAN fallback.
- Typed `EasyEdaApi` command layer over the existing gateway transport.
- Read-only snapshot of current document/project/PCB/schematic/selection state.
- Browser-side validation and bounded primitive summaries.
- `Refresh from EasyEDA` UI.
- Tests and CI green; PR #3 merged.

## Phase 4 goal

Add the first narrowly-scoped write capability: selection synchronization between iPad and the active EasyEDA editor.

This phase stays limited to selection state. Do not add move/rotate/property edits/routing/save/undo/redo here.

## Verified official selection mutation API

Verified from the official `easyeda/easyeda-api-skill` references.

### PCB / footprint

Namespace: `eda.pcb_SelectControl`

- `clearSelected(): Promise<boolean>`
  - BETA
  - clears the active PCB/footprint selection
- `doSelectPrimitives(primitiveIds: string | Array<string>): Promise<boolean>`
  - BETA
  - selects primitives by primitive ID

### Schematic / symbol

Namespace: `eda.sch_SelectControl`

- `clearSelected(): boolean`
  - synchronous return
- `doSelectPrimitives(primitiveIds: string | Array<string>): Promise<boolean>`
  - selects primitives by primitive ID

### Active document dispatch

The selection control classes are documented for their editor domains (`PCB & footprint` and `Schematic & symbol`) and expose no document argument. Existing official guidance requires the correct document to be active before using a domain API. Phase 4 dispatches based on `eda.dmt_SelectControl.getCurrentDocumentInfo()` inside the same execute request as the mutation, avoiding a race with tab changes and avoiding invented selector arguments.

Supported document types for mutation in this phase:

- `SCHEMATIC_PAGE = 1` -> `eda.sch_SelectControl`
- `PCB = 3` -> `eda.pcb_SelectControl`
- `FOOTPRINT = 4` -> `eda.pcb_SelectControl`

Other document types fail before mutation.

## Selection event research

Official event classes exist, including PCB cross-probe/primitive events and SCH primitive events. The official reference states these listeners are extension-only and calling them from a standalone script environment always throws an error.

The current gateway executes standalone code through `/execute`, so Phase 4 does not register these event listeners.

Decision: after every successful selection mutation, explicitly call `getSnapshot()` and use that validated read-back as the UI source of truth. No polling or guessed event API.

## Phase 4 implementation status

- [x] Record exact verified selection mutation signatures in this HANDOFF.
- [x] Add `EasyEdaApi.clearSelection()` with in-command current-document dispatch.
- [x] Add `EasyEdaApi.selectPrimitiveIds(ids)` with conservative validation and ID count limit.
- [x] Maximum request is 100 primitive IDs.
- [x] IDs are trimmed, must be non-empty strings, max 256 characters, and are de-duplicated in order.
- [x] Generated selection code embeds only `JSON.stringify` output from the validated ID array.
- [x] Mutation command returns a compact versioned result with `operation`, `ok`, `documentType`, `requested`, and bounded failure reason.
- [x] Browser validates the mutation result before trusting it.
- [x] Successful mutation immediately calls `getSnapshot()` and returns the fresh validated snapshot.
- [x] Failed/unsupported mutation does not perform a read-back or update assumed local state.
- [x] Add tests covering exact verified API calls, JSON serialization, input limits, trimming/deduplication, malformed results, read-back after success, and unsupported-document failure.
- [x] Add iPad Selection Sync controls using only validated snapshot IDs.
- [x] UI does not accept arbitrary typed primitive IDs.
- [x] Selection controls are disabled while disconnected, refreshing, mutating, unsupported, or when the requested action has no IDs/selection.
- [x] Successful UI mutation replaces local snapshot state only with the fresh validated read-back returned by `EasyEdaApi`.
- [x] Mutation failures use the existing sanitized snapshot/API error display.
- [x] Add inspector styling for disabled actions, selection action grouping, bounded/truncated values, and API errors.
- [x] Prefer explicit refresh because documented event listeners are extension-only.
- [x] Open PR #4.
- [x] First PR #4 CI run `35594764722` passed tests, PWA build, Worker typecheck, Wrangler dry-run, direct companion syntax, and VPS cloud-agent syntax.
- [x] Update README with Phase 4 behavior and verified mutation APIs.
- [x] Bump package version to `0.4.0`.
- [ ] Verify CI on the latest README/version/HANDOFF head.
- [ ] Merge PR #4 only when the latest head is green.

## Files changed in Phase 4

- `HANDOFF.md`
- `README.md`
- `package.json`
- `src/lib/easyeda-api.ts`
- `src/lib/easyeda-selection.test.ts`
- `src/App.tsx`
- `src/styles.css`

## CI history

### PR #4 run 1

GitHub Actions run `35594764722` completed successfully on code/UI head `0dd444f6bd423e651f597856978488c25d6f6441`.

Passed:

- dependency installation
- EasyEDA command-layer tests
- PWA TypeScript/Vite build
- Worker type generation/typecheck
- Wrangler deploy dry-run / config validation
- direct companion syntax check
- VPS cloud-agent syntax check

Documentation/version/HANDOFF commits were added after that run, so the latest head must still receive a green CI result before merge.

## Safety / correctness rules

- Use only exact documented public APIs from official EasyEDA repositories/references.
- Never guess method names or argument shapes.
- Maximum selection request: 100 primitive IDs.
- Every ID must be a trimmed, non-empty string no longer than 256 characters.
- Duplicate IDs are removed before execution.
- Generated code embeds IDs using `JSON.stringify` output from the validated array; never concatenate IDs into quoted source fragments.
- No secrets or gateway URLs in generated EasyEDA code.
- If document type is unsupported, fail without mutation.
- After write success, read state back through `getSnapshot()` rather than assuming local state.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Re-read this HANDOFF, identify the latest PR #4 head SHA after README/package/HANDOFF updates, wait for its GitHub Actions CI run, and merge PR #4 only if that exact head is green and mergeable. After merge, start a new branch/HANDOFF loop for the next capability rather than extending this selection-only PR.