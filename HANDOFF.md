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
- Successful selection mutation always reads state back through `getSnapshot()`.
- PR #4 merged after the exact latest head passed tests, TypeScript/Vite, Worker typecheck, Wrangler dry-run, and companion checks.
- Package version on `main`: `0.4.0`.

## Phase 5 goal

Add the next narrowly-scoped editing capability only if exact public EasyEDA APIs can be verified: move and/or rotate already-selected primitives.

Do **not** implement routing, wire creation, arbitrary property editing, save, undo, redo, delete, copy/paste, or document creation in this phase.

## Required research before code

Search the official `easyeda/easyeda-api-skill` references/examples for exact PCB/footprint and schematic APIs that can safely transform existing primitives.

Research specifically:

- move/translate primitive APIs
- rotate primitive APIs
- whether operations accept primitive IDs, primitive objects, or coordinates
- coordinate units and rotation units
- absolute vs relative movement semantics
- return types / async behavior
- whether APIs operate on the active document only
- whether generic transform APIs exist across primitive types or require class-specific methods
- whether move/rotate operations are marked BETA
- any documented constraints around locked primitives, components, nets, or parent/child primitives

## Phase 5 safety rules

- Use only exact documented public APIs from official EasyEDA repositories.
- Never infer a method name from UI behavior.
- Do not manipulate raw internal object structures unless a documented API explicitly requires them.
- Prefer one generic documented transform API over many primitive-type-specific mutation paths.
- Operate only on primitive IDs already present in validated EasyEDA snapshot state.
- Maximum transform request: 100 IDs.
- Bound numeric deltas/angles before generating execute code.
- Embed validated arrays/numbers through deterministic serialization, never raw UI string interpolation.
- Check the active document type inside the same execute request before mutation.
- Return and validate a compact mutation result.
- After successful mutation, call `getSnapshot()` and use that read-back as the source of truth.
- If public APIs differ substantially between PCB and schematic, implement only the domain that can be safely verified first rather than forcing symmetry.
- If no safe public transform API exists, do not implement a write workaround; record the limitation and select a different verified capability.

## Planned Phase 5 deliverables

- [ ] Record exact verified transform API signatures/semantics in this HANDOFF.
- [ ] Decide whether Phase 5 supports PCB, schematic, or both based on official API evidence.
- [ ] Add typed transform command builders and response validation.
- [ ] Add unit/input bounds and document-type dispatch.
- [ ] Add tests proving only verified transform APIs are called.
- [ ] Add iPad transform controls that operate only on validated snapshot selection IDs.
- [ ] Read back state after every successful mutation.
- [ ] Open a separate PR, run CI, update README/version/HANDOFF, and merge only when latest head is green.

## Loop rule

At each meaningful milestone:
1. Update this `HANDOFF.md`.
2. Re-read it.
3. Treat it as the only project-state source.
4. Continue to the next incomplete deliverable.

## Next action

Research the official EasyEDA API references for generic or primitive-specific move/translate and rotate operations in PCB/footprint and schematic domains. Record exact method names, arguments, units, and limitations before writing any Phase 5 mutation code.