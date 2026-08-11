# Handoff: Flow diagram visual design iteration

**Date:** 2026-04-05
**Branch:** `main` (previous `feat/html-viewer` polish work merged this session)
**State:** Yellow

> Yellow = design prototype exists as SVG files, not yet implemented in the build pipeline. No code changes to commit. All 14 tests pass.

## Where things stand

The flow diagram visual design has been refined through iterative SVG prototyping. The vertical layout is close to final — Hybrid Minimal style (option C from the March 23 brainstorm) with Tufte-inspired annotation arrows. Pikchr was ruled out as the rendering engine due to text alignment limitations; direct SVG generation in JS is the path forward.

## Decisions made

- **Pikchr is out** — mixed-size text alignment is broken (`small` changes bounding box computation, `.w at` gives different x positions). Direct SVG generation in `flow-to-svg.js` replaces the `flow-to-pikchr.js` plan from the original spec.
- **Annotation arrows, not branch connectors** — findings use thin gray lines with filled wedge arrowheads (Tufte critique style, see p.133 of "Visual Display of Quantitative Information"). Arrows point FROM the observation TO the flow step. Light gray (`#d0d0d0`), same weight as spine — colored text carries emphasis, not connectors.
- **Colors match report palette** — significant = `#dc2626`, moderate = `#444`. Only critical/significant get color. Derived from `src/viewer/style.css` CSS variables.
- **Shape vocabulary confirmed at small scale** — start (solid circle), process (hollow circle), decision (hollow diamond, white-filled, square proportions), end (bull's-eye). All shapes same visual weight.
- **Spine bounded by start/end** — line starts at bottom of first dot, ends at top of bull's-eye outer ring.
- **Labels left, findings right** — step labels right-aligned left of spine (consistent x anchor), finding annotations left-aligned right of spine.

## What's next

1. **Resolve horizontal/short-flow placement** — the spec says <=4 steps renders horizontally. Clay pushed back on "sidenote" placement (too small) and mentioned "spill over to the sidebar" but the exact layout is unresolved. Clarify before implementing.
2. **Build `flow-to-svg.js`** — codegen module: takes flow YAML array, returns SVG string. Geometry is fixed (shape sizes, spacing, text positions), so this is straightforward string interpolation. Wire into `build-report.mjs`.
3. **Add `flow` array to schema** — update `findings-schema.yaml.md` with the flow step schema from `record/superpowers/specs/2026-03-23-flow-diagram-design.md`.
4. **Test with the example audit** — add flow data to `example/2026-03-21-current-repo-review/findings.yaml` and rebuild the report.
5. **Remove terrain map** — delete `terrain-map.js`, remove canvas section from build, remove roughjs terrain dependency (keep rough-notation for annotations).

## Landmines

- **Prototype SVGs are untracked** — `example/flow-prototype.svg` (vertical, current best) and `example/flow-horizontal.svg` (rough horizontal attempt) are working files, not committed.
- **The original brainstorm mockups are gone** — Clay deleted `.superpowers/brainstorm/` which had the option A/B/C SVG mockups. The only surviving reference is a screenshot: `~/Dropbox/Screenshots/Screenshot 2026-03-23 at 11.55.54 AM.png`.
- **The reference SVG is NOT the target** — `ref/request_flow_audit_concept.svg` is a traditional full-size flowchart. The target is Hybrid Minimal (option C) — small shapes, external labels, no text inside shapes. Don't confuse them.
- **Design spec is partially stale** — `record/superpowers/specs/2026-03-23-flow-diagram-design.md` references Pikchr rendering pipeline and `flow-to-pikchr.js`. The schema and shape vocabulary sections are still valid; the rendering pipeline section needs updating.
