# Handoff: Flow diagram design brainstorm — terrain map replacement

**Date:** 2026-03-23
**Branch:** `feat/html-viewer` (uncommitted changes from previous session still present)
**State:** Yellow

> Yellow = design spec written but not yet implemented. No code changes this session. All 14 tests pass. Previous session's uncommitted changes are still on the branch.

## Where things stand

The terrain map is being replaced with per-narrative flow diagrams. A brainstorming session produced a complete design spec covering visual style, schema additions, shape vocabulary, and rendering pipeline. The design uses Pikchr for layout and SVG generation at build time. No implementation work has started — this session was design-only.

## Decisions made

- **Visual style: Hybrid Minimal** — thin spine, fixed-size flowchart shapes (hollow circles, diamonds, parallelograms, cylinders), labels external to shapes. Labels left of spine, findings branch right with colored stems.
- **Adaptive placement** — <=4 flow steps renders as horizontal sidenote (Tufte-style), >4 renders full-width after the narrative thesis.
- **Schema: `flow` array on narratives** — each step has `id`, `label`, `type` (defaults to `process`), optional `no:` for decision branches, `findings: [slug]` for mapping. Off-spine steps marked `spine: false`.
- **Rendering: YAML → Pikchr → SVG** — build-time codegen generates Pikchr source from flow YAML, Pikchr renders to SVG, SVG inlines in HTML. No canvas, no runtime dependency. Solves the presentation-mode clone bug for free.
- **Shape vocabulary** — `start` (solid circle), `end` (bull's-eye), `process` (hollow circle), `decision` (diamond), `input` (parallelogram), `store` (cylinder), `ref` (gray dot).

## What's next

1. **Run real audits with flow data** — the schema addition and finding-to-step mapping need validation against several different projects before implementation. Clay has projects to test against.
2. **Pikchr prototype** — test whether Pikchr's color/styling is sufficient for concern-level encoding (stroke weights, fills). May need SVG post-processing.
3. **Implement `flow-to-pikchr.js`** — codegen module that takes flow YAML and produces Pikchr source. Wire into `build-report.mjs` replacing `terrainHtml`.
4. **Remove terrain map** — delete `terrain-map.js`, remove canvas section from build, remove rough.js/roughjs terrain dependency (keep rough-notation for annotations).
5. **Commit previous session's changes** — the uncommitted polish/nav work from the 0104 handoff is still on the branch.

## Landmines

- **Previous session's changes are uncommitted** — 11 files changed (nav bar, slides interactivity, CSS polish, skill instructions). These are from the `2026-03-23-0104` handoff session and should be committed before starting flow diagram implementation.
- **Design spec location** — `record/superpowers/specs/2026-03-23-flow-diagram-design.md` (not `docs/` — the `for-the-record` hook enforces this).
- **Visual companion mockups** — `.superpowers/brainstorm/` contains the session's SVG mockups showing the style evolution. Reference material for implementation.
- **Pikchr MCP server** — available for development/testing. Pikchr docs are at `~/source/reference/pikchr/`.
- **`ref/request_flow_audit_concept.svg`** — the hand-authored concept SVG that inspired this design. Shows the target: happy-path spine with findings branching at decision points.
