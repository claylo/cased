# Flow-to-SVG Design -- Build-Time Flow Diagram Renderer

**Status:** Approved
**Date:** 2026-04-06
**Supersedes:** Rendering pipeline section of `2026-03-23-flow-diagram-design.md` (Pikchr pipeline replaced with direct SVG generation)

## Problem

The terrain map (rough.js canvas) visualizes file sizes in a grid -- structure, not story. Readers need to see how a request/process moves through the code and where findings attach. The canvas rendering also breaks in presentation mode (cloneNode doesn't copy canvas pixel data).

## Solution

`src/viewer/flow-to-svg.js` -- a pure function that takes a narrative's flow steps and findings, returns an SVG string. Imported by `build-report.mjs` at build time. The SVG inlines directly in the HTML, replacing the terrain map canvas section.

## Architecture

### Module

```
src/viewer/flow-to-svg.js
  export function flowToSvg(flow, findings) -> string
```

- `flow` -- array of step objects from a single narrative's `flow` field
- `findings` -- the narrative's `findings` array (lookup concern/title by slug)
- Returns a complete `<svg>` element as a string
- Pure function, no dependencies, no side effects

### Integration with build-report.mjs

`build-report.mjs` calls `flowToSvg()` inside `renderNarrative()` when the narrative has a `flow` array. The SVG is placed after the thesis paragraph, before the finding articles. Narratives without `flow` render as they do today (no diagram).

Replaces:
- `terrainHtml` constant in `assembleReport()` (line 399)
- `terrain-map.js` is removed from `viewer.js` imports
- `#terrain-map` section is removed from the content assembly
- `roughjs` dependency can be removed (rough-notation stays for annotations)

### Build pipeline position

```
findings.yaml
  +-- flow steps per narrative
      +-- flowToSvg(flow, findings)
          +-- SVG string
              +-- inlined in narrative <section> HTML at build time
```

No runtime dependency. SVG clones correctly in presentation mode.

## Orientation Logic

Count spine steps (steps where `spine !== false`).

- <= 4 spine steps: horizontal layout
- > 4 spine steps: vertical layout

## Geometry

All constants derived from the approved prototypes (`example/flow-prototype.svg` and `example/flow-horizontal.svg`).

### Vertical layout

| Constant | Value | Notes |
|----------|-------|-------|
| Spine x | 150 | Fixed |
| Step spacing | 60px | Vertical distance between steps |
| Label x | 140 | Right-aligned (`text-anchor: end`) |
| Label font-size | 11 | |
| Connector start x | 157 | Past shape right edge |
| Stem x | 195 | Vertical stem alongside finding text |
| Finding text x | 205 | Left-aligned |
| Finding title font-size | 10 | font-weight 600 |
| Finding desc font-size | 8.5 | italic, fill #6b7280 |
| Finding badge font-size | 7.5 | font-weight 500, letter-spacing 0.5 |
| ViewBox width | 440 | Fixed |
| ViewBox height | computed | `(spineSteps.length - 1) * 60 + 48` (24px top + 24px bottom padding) |

### Horizontal layout

| Constant | Value | Notes |
|----------|-------|-------|
| Spine y | 50 | Fixed |
| Step spacing | 120px | Horizontal distance between steps |
| Label y | 38 | Centered above (`text-anchor: middle`) |
| Label font-size | 11 | |
| Connector end y | 72 | Vertical line from shape down |
| Finding text y start | 84 | Centered below (`text-anchor: middle`) |
| Finding title font-size | 10 | |
| Finding desc font-size | 8.5 | italic, fill #6b7280 |
| Finding badge font-size | 7.5 | |
| Chain ref y | 115 | Horizontal dashed line between finding areas |
| ViewBox height | 130 | Fixed |
| ViewBox width | computed | `(spineSteps.length - 1) * 120 + 100` (50px left + 50px right padding) |

## Shape Vocabulary

All shapes drawn at uniform visual weight. `type` defaults to `process` if omitted.

| type | SVG | Attributes |
|------|-----|------------|
| `start` | `<circle>` | r=4, fill=#1a1a1a |
| `end` | 2x `<circle>` | outer r=4 fill=#1a1a1a, inner r=2 fill=#fffff8 |
| `process` | `<circle>` | r=4, fill=#fffff8, stroke=#1a1a1a, stroke-width=1.5 |
| `decision` | `<rect>` rotated 45deg | 8x8, fill=#fffff8, stroke=#1a1a1a, stroke-width=1.5 |
| `input` | `<polygon>` | parallelogram, fill=#fffff8, stroke=#1a1a1a, stroke-width=1.5 |
| `store` | ellipse + lines + ellipse | cylinder, fill=#fffff8, stroke=#1a1a1a, stroke-width=1.5 |
| `ref` | `<circle>` | r=3, fill=#6b7280 |

## Color Mapping

Connector stroke weight and color encode concern severity. Text color matches connector.

| Concern | Connector stroke | Width | Text fill |
|---------|-----------------|-------|-----------|
| critical | #dc2626 | 2.5 | #dc2626 |
| significant | #dc2626 | 1.5 | #dc2626, badge rgba(220,38,38,0.7) |
| moderate | #1a1a1a | 1.5 | #1a1a1a, badge #6b7280 |
| advisory | #6b7280 | 1 | #6b7280 |
| note | #6b7280 | 1 | #6b7280 |

## Finding Annotations

Each flow step can have `findings: [slug1, slug2]`. The function looks up each slug in the narrative's findings array to get `concern` and `title`.

### Vertical layout
- Horizontal connector from shape right edge to stem x (195)
- Vertical stem runs the height of the finding text block
- Text left-aligned at x=205: title, description (italic), badge
- Multiple findings per step stack vertically

### Horizontal layout
- Vertical connector from shape bottom down to y=72
- Text centered below: title, description (italic), badge
- Multiple findings per step stack vertically below

## Chain References

Dashed line connecting finding stems where `chain_references.enables` or `chain_references.enabled_by` relationships exist between findings attached to different flow steps.

- Vertical layout: vertical dashed line between stems (x=195)
- Horizontal layout: horizontal dashed line at y=115
- Stroke: #6b7280, width 1, dasharray 3,2
- Label: relationship type ("enables"), font-size 7, fill #6b7280

## Flow Schema

Already defined in `2026-03-23-flow-diagram-design.md`, section "Schema addition: flow on narratives". No changes needed. Key fields per step:

```yaml
- id: step-id          # unique within flow
  label: Step label    # displayed text
  type: process        # shape type (default: process)
  findings: [slug]     # finding slugs attached to this step
  spine: false         # optional: off-spine branch step
  no: step-id          # optional: decision branch target
  next: step-id        # optional: override sequential flow
```

## Scope

### In scope
- `flow-to-svg.js` module with `flowToSvg()` export
- Integration into `build-report.mjs` (`renderNarrative`)
- Add `flow` data to example `findings.yaml`
- Tests for SVG generation

### Out of scope (future work)
- Off-spine branch rendering (`spine: false` steps)
- Decision branch connectors (`no:` targets)
- Loop-back arrows (`next:` overrides)
- Removal of terrain map (separate task after flow is working)
- Schema file updates (findings.schema.json, findings-schema.yaml.md)

## Reference Materials

- `example/flow-prototype.svg` -- approved vertical prototype
- `example/flow-horizontal.svg` -- approved horizontal prototype
- `.superpowers/brainstorm/65203-1774280995/symbol-style-v2.html` -- March Option A mockup
- `record/superpowers/specs/2026-03-23-flow-diagram-design.md` -- original design spec (schema sections still valid, rendering pipeline section superseded)
