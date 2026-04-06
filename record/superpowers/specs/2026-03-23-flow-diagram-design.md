# Flow Diagram Design — Replacing the Terrain Map

**Status:** In progress — core decisions made, needs iteration on real audits before implementation
**Date:** 2026-03-23
**Branch:** `feat/html-viewer`

## Problem

The rough.js terrain map visualizes file sizes in a grid with dependency edges.
It's not useful — it shows structure but not flow. Readers need to see how
a request/process moves through the code and where findings attach. The canvas
rendering also breaks in presentation mode (cloneNode doesn't copy canvas pixel data).

## Solution

Replace the terrain map with **per-narrative flow diagrams**: a happy-path
spine with findings branching off at the decision/step where they apply.

## Design Decisions

### Visual style: Hybrid Minimal (Option A layout)

- **Thin spine** — subtle gray line connecting steps vertically (or horizontally)
- **Fixed-size shapes** — standard flowchart semantics at uniform 16px scale,
  labels external to the shape (the Tufte insight: shape conveys type, label
  conveys content, neither forces the other to resize)
- **Labels left of spine**, findings branch right (vertical layout)
- **Labels above/below spine**, findings branch down (horizontal layout)
- Connector **weight and color encode concern level** (thick red = critical,
  thinner = lower severity, matching existing palette)
- **Chain references** as dashed vertical lines between finding stems
- **No boxes around findings** — just text hanging off a vertical stem

### Shape vocabulary

| `type` value | Shape            | When to use                              |
|-------------|------------------|------------------------------------------|
| `start`     | Solid circle     | Entry point (auto-added if first step)   |
| `end`       | Bull's-eye       | Terminus (solid with hollow center)      |
| `process`   | Hollow circle    | Default. Code step that executes.        |
| `decision`  | Hollow diamond   | Conditional branch, guard, match arm     |
| `input`     | Parallelogram    | Data arriving: request, message, file    |
| `store`     | Cylinder         | DB access, cache, persistent write       |
| `ref`       | Gray dot         | Off-page connector / cross-flow ref      |

### Adaptive placement

- **<= 4 steps** — horizontal layout, placed as a **sidenote** (floated right, Tufte-style)
- **> 4 steps** — vertical layout, placed **full-width after the thesis**

### Schema addition: `flow` on narratives

```yaml
narratives:
  - slug: auth-surface
    title: The Authentication Surface
    flow:
      - id: connect
        label: WS connect
        type: start
      - id: token
        label: Token presented
        type: input
      - id: verify
        label: Verify signature?
        type: decision
        no: reject              # branch target (step id)
        findings: [jwt-no-sig-check]
      - id: extract
        label: Extract claims
        findings: [session-id-forgeable]
      - id: valid
        label: Valid JSON?
        type: decision
        no: retry
      - id: deliver
        label: Deliver message
      - id: done
        type: end

      # Off-spine branches
      - id: reject
        label: Close connection
        type: end
        spine: false
      - id: retry
        label: Log & wait
        next: token             # loops back
        spine: false
```

**Rules:**

1. Steps are ordered — default flow is sequential (the spine)
2. `type` defaults to `process` if omitted
3. `spine: false` steps are off the main axis (branches)
4. `no:` on a decision names the branch target; "yes" is always next spine step
5. `next:` overrides default sequential flow (for loops, merges)
6. `findings: [slug]` maps findings to the step where they attach
7. If `findings` is omitted, positional fallback matches by order

### Rendering pipeline: Flow YAML → Pikchr → SVG

The renderer generates **Pikchr source** from the flow YAML at build time.
Pikchr handles layout, attachment points, edge routing, and shape rendering.
Output is SVG that inlines directly into the HTML.

**Why Pikchr:**

- Deterministic: same input always produces same SVG
- Already has the shape vocabulary (box, circle, diamond, cylinder)
- Attachment points (`.n`, `.s`, `.e`, `.w`) solve connector routing
- Relative positioning (`right of`, `below`) handles layout
- No runtime dependency — SVG is static in the HTML
- Solves the canvas clone problem (SVG clones correctly in slides)
- MCP server available for development/testing

**Build pipeline:**

```
findings.yaml
  +-- flow steps per narrative
      +-- codegen: flow-to-pikchr.js
          +-- Pikchr source string
              +-- pikchr render -> SVG string
                  +-- inline in HTML at build time
```

**What this replaces:**

- `terrain-map.js` (rough.js canvas rendering)
- `#terrain-map` section (single canvas before narratives)
- Canvas-related code in `viewer.js`
- rough.js and roughjs dependencies (for terrain only — annotations still use rough-notation)

## Open Questions

1. **Finding-to-step mapping ergonomics** — explicit `findings: [slug]` on flow
   steps vs `flow_step:` on findings vs positional matching. Current design
   uses explicit on flow steps. Needs real-audit validation.

2. **Branching complexity ceiling** — the current schema handles linear spine
   with simple branches and loops. Complex merge/split patterns may need
   additional primitives. Defer until a real audit needs it.

3. **Pikchr styling limits** — Pikchr's color/styling is limited compared to
   raw SVG. May need post-processing on the SVG output to apply the full
   concern-level color vocabulary (stroke weights, fills). Need to test.

4. **Horizontal layout in Pikchr** — Pikchr defaults to `down` for flow
   direction; `right` is supported. Need to verify the label positioning
   works correctly in horizontal mode.

5. **Interaction with presentation mode** — flow diagrams should become their
   own slides. SVG clones correctly (unlike canvas), but sizing within the
   48rem slide max-width needs testing.

## Reference Materials

- `ref/request_flow_audit_concept.svg` — hand-authored concept SVG showing the target design
- `example/flow.txt` — ASCII sketch of the same flow
- `.superpowers/brainstorm/` — visual companion mockups from this session
- Flowchart shapes screenshot discussed during brainstorming (Whimsical reference)

## Not in Scope

- Terrain map redesign (replaced entirely by flow diagrams)
- Rough.js removal (rough-notation still used for annotations)
- Changes to recon.yaml schema
