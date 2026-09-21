# Real PCB viewer — official API feasibility research

Task: VIEW-001  
Agent: `chat-20260921T141000Z-agent2-view001`  
Date: 2026-09-21

## Question

Can the iPad PWA replace its current static/demo PCB preview with a faithful read-only board view using only documented EasyEDA Pro Extension APIs, without introducing mutation or undocumented editor internals?

## Conclusion

**Not as a production-safe full-board geometry reader with the currently documented API surface.**

EasyEDA documents rich PCB primitive objects and read-only scalar/shape getters, but the APIs needed to enumerate or fetch those primitive objects (`get`, `getAll`, `getAllPrimitiveId`, unified BBox/board-line helpers, manufacture exports) are explicitly marked **BETA**, with the official warning that they may change and should not be used in production. The state getters on an already-obtained primitive are useful and often not individually marked BETA, but obtaining a complete board's primitives still crosses a BETA API boundary.

Therefore the recommended near-term architecture is:

1. keep the current production-like iPad surface honest and clearly label the existing canvas as preview/demo until a supported source exists;
2. do not silently promote BETA primitive enumeration into the trusted production path;
3. if the project explicitly accepts an experimental viewer later, isolate it behind a capability/feature flag, read-only command, strict document identity guard, bounded primitive counts/payload sizes, schema validation, and no mutation methods;
4. re-check the official API on each EasyEDA version before promoting that experimental path.

## Official evidence

### 1. Primitive enumeration is available, but BETA

Official `PCB_PrimitiveComponent.getAll()` returns all device primitives and is explicitly marked BETA / not for production:

- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitivecomponent.getall.html

The same pattern exists for geometry-bearing primitive classes, including lines, fills, pads, vias, regions, images, strings, and others. Examples:

- `PCB_PrimitiveLine.getAll()` — https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitiveline.getall.html
- `PCB_PrimitiveFill.getAll()` — https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitivefill.getall.html
- `PCB_PrimitivePad.get()` / class methods — https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitivepad.html
- `PCB_PrimitiveVia.getAll()` — https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitivevia.getall.html
- API quick reference maintained by EasyEDA — https://github.com/easyeda/easyeda-api-skill/blob/main/references/_quick-reference.md

This is the main blocker for a production-safe full-board viewer: there is no documented non-BETA bulk primitive snapshot API identified in this research.

### 2. Once a primitive object exists, useful read-only state is documented

`IPCB_PrimitiveLine` exposes getters for start/end coordinates, line width, layer, net, primitive ID/type and lock state. Mutation methods (`setState_*`, `done`, reset) are separately marked BETA and are unnecessary for a viewer:

- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitiveline.html

`IPCB_PrimitivePad` exposes read getters for X/Y, rotation, layer, pad/hole shape, pad number/type, net, lock state and related pad geometry:

- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivepad.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivepad.getstate_pad.html

`IPCB_PrimitivePour` exposes a read getter for its complex polygon plus layer/net/line-width/pour metadata:

- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivepour.html

`IPCB_PrimitivePoured` exposes the copper fill regions; each fill entry has a `path: IPCB_ComplexPolygon`:

- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivepoured.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivepouredpourfill.html

Components expose read state such as X/Y, rotation, name, designator/pads/model metadata:

- https://prodocs.easyeda.com/en/api/reference/pro-api.ipcb_primitivecomponent.html

These getters make an experimental renderer technically plausible, but they do not remove the BETA dependency needed to discover/fetch the objects.

### 3. Unified geometry helpers are also BETA

`PCB_Primitive.getPrimitivesBBox()` can calculate a bounding box for primitive IDs/objects, and `getPrimitiveBoardLine()` can obtain a primitive board line. The official class marks these helpers BETA:

- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitive.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitive.getprimitivesbbox.html

So these helpers should not be treated as a stable production escape hatch.

### 4. Coordinate conversion itself has a documented non-BETA path

`PCB_Document.getCanvasOrigin()`, `convertCanvasOriginToDataOrigin()` and the inverse conversion are documented document-level helpers. The docs explain that API coordinates use the data origin while the EasyEDA front-end displays coordinates relative to the canvas origin:

- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_document.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_document.getcanvasorigin.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_document.convertcanvasorigintodataorigin.html

This is useful for a future viewer: rendering should preserve raw data coordinates internally and apply an explicit validated transform for display rather than assuming the EasyEDA canvas origin is zero.

### 5. Export-based alternatives are not currently a stable API solution

EasyEDA Pro's UI supports PCB PDF/image and SVG-related export workflows, but the Extension API manufacture/export methods investigated here are BETA. For example `PCB_ManufactureData.getGerberFile()` and `getPdfFile()` carry the same official BETA/not-for-production warning:

- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_manufacturedata.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_manufacturedata.getgerberfile.html
- https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_manufacturedata.getpdffile.html

The normal editor UI can export PDF/images and SVG in supported user workflows, but this research did not identify a documented stable Extension API that returns a complete PCB raster/SVG preview suitable for the PWA:

- https://prodocs.easyeda.com/en/pcb/export-pdf-image/
- https://prodocs.easyeda.com/en/panel/export-svg/

Using undocumented editor DOM/canvas capture, private endpoints, file-source internals, or browser automation would violate this project's existing rule to use exact documented public APIs only and is therefore not recommended.

## Experimental read-only viewer design, if BETA use is explicitly approved later

This is a feasibility design only, **not authorization to implement it**.

### Trusted command boundary

A future command should accept expected validated document identity, not arbitrary document/primitive IDs. Immediately before reading geometry it should re-read current document identity/type and reject if the active document changed. Only PCB/footprint document types should be accepted.

### Bounded primitive snapshot

Query an explicit allow-list of primitive classes needed for rendering rather than exposing a generic evaluator. Candidate classes are component, pad, via, line/arc/polyline, fill/region, pour/poured, string/attribute, image and dimension. Apply strict per-class and total primitive caps before serializing. Reject non-finite coordinates and overlong strings/arrays/polygon paths.

### Read-only getter allow-list

Only invoke documented getters required for rendering. Do not expose or call `create`, `delete`, `modify`, `setState_*`, `done`, `reset`, routing, rebuild, conversion or save APIs.

### Browser-side validation

Treat the bridge response as untrusted. Parse into a versioned discriminated geometry schema, bound nesting/path lengths and numeric ranges, and discard the entire snapshot on malformed/unknown required data rather than partially trusting it.

### Rendering model

Normalize to a small internal scene model such as line/arc/path/circle/text/component-bounds with explicit layer and primitive ID. Preserve EasyEDA data-origin coordinates, calculate the viewer transform locally, and keep selection/navigation IDs linked only to the same validated snapshot generation.

### Refresh strategy

Prefer explicit refresh and post-navigation refresh first. Do not add continuous polling until payload size and live EasyEDA behavior are measured. A future event-driven refresh should use documented events only and still revalidate document identity.

## Acceptance assessment

| Requirement | Result |
| --- | --- |
| Official documented APIs exist to read useful PCB primitive state | Yes |
| Official documented APIs exist to enumerate/fetch full-board primitive objects | Yes, but BETA |
| Stable/non-BETA documented full-board geometry snapshot identified | **No** |
| Stable documented complete PCB image/SVG Extension API identified | **No** |
| Technically feasible experimental read-only renderer | Yes |
| Recommended for current production-like trusted path | **No, not until BETA use is explicitly accepted or a stable API appears** |

## Recommendation for project planning

Mark VIEW-001 research complete with **“feasible experimentally, blocked for production-safe implementation by BETA enumeration/export APIs.”**

The next product-safe step is UX-007 (make the current preview/demo nature explicit) after its existing dependency/ownership is reconciled. If the user later authorizes experimental BETA use, create a separate task/phase with its own API compatibility policy, hard payload limits, fixtures/tests and EasyEDA-version validation rather than folding it into the existing Phase 7 inspector PR.
