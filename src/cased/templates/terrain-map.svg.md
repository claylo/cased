# Terrain Map SVG Template

The terrain map is a force-directed or hierarchical graph showing the
codebase's module structure with finding density overlaid. It is the
single most important visualization in the report — the reader's first
impression.

## Design Principles

- **Grayscale-first**: Must be fully readable in grayscale. Color is
  accent only (the red for critical findings, green for clean modules).
- **No labels on edges**: Edge meaning is implicit from structure.
  Module names label nodes.
- **Finding density = stroke weight**: Modules with more findings have
  thicker borders. This is the "smallest effective difference" — the
  eye sees weight without needing a legend.
- **Size = code volume**: Node area is proportional to line count.
  Not radius — *area*. (r = sqrt(lines / π / scale_factor))
- **Clean geometry**: Rounded rectangles for modules. Simple straight
  lines or gentle curves for edges. No drop shadows, no gradients,
  no 3D effects.

## SVG Structure

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 700 400"
     role="img"
     aria-label="Codebase terrain map">

  <!-- Background: transparent (inherits page background) -->

  <!-- Edges first (behind nodes) -->
  <line x1="..." y1="..." x2="..." y2="..."
        style="stroke: #d1d5db; stroke-width: {coupling_weight};" />

  <!-- Module nodes -->
  <g transform="translate({x}, {y})">
    <!-- Node body -->
    <rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}"
          rx="4" ry="4"
          style="fill: #fafafa;
                 stroke: #1a1a1a;
                 stroke-width: {finding_density_stroke};" />

    <!-- Module name -->
    <text x="0" y="4"
          style="font-family: 'Atkinson Hyperlegible Next', sans-serif;
                 font-size: 11px;
                 fill: #1a1a1a;
                 text-anchor: middle;">
      {module_name}
    </text>

    <!-- Finding count (if > 0), tucked into top-right corner -->
    <text x="{w/2 - 6}" y="{-h/2 + 12}"
          style="font-family: 'Atkinson Hyperlegible Next', sans-serif;
                 font-size: 9px;
                 fill: #6b7280;
                 text-anchor: end;">
      {finding_count}
    </text>
  </g>

  <!-- Legend (minimal, bottom-right) -->
  <g transform="translate(600, 370)">
    <text style="font-family: 'Atkinson Hyperlegible Next', sans-serif;
                 font-size: 9px; fill: #6b7280;">
      node size ∝ code volume
    </text>
    <text y="12"
          style="font-family: 'Atkinson Hyperlegible Next', sans-serif;
                 font-size: 9px; fill: #6b7280;">
      border weight ∝ finding density
    </text>
  </g>
</svg>
```

## Layout Algorithm

Since SVG is static, the agent must compute positions. Use a simple
approach:

1. **Rank modules by size** (line count, descending).
2. **Place the largest module at center**.
3. **Place connected modules** at positions radiating outward, with
   distance inversely proportional to coupling weight.
4. **Avoid overlap**: ensure minimum 20px gap between node edges.

For small projects (< 8 modules), a manual layout is fine. For larger
projects, use a grid with logical grouping (e.g., modules on the same
trust boundary are adjacent).

## Stroke Width Mapping

Map finding density to stroke width:

| Findings in module | Stroke width |
|--------------------|--------------|
| 0                  | 1            |
| 1                  | 2            |
| 2-3                | 3            |
| 4-6                | 4            |
| 7+                 | 5            |

The maximum stroke width is 5px. This is deliberate — Tufte's
"smallest effective difference." Five levels is enough.

## Accent Color Rules

- Default node fill: `#fafafa` (near-white)
- Node with critical findings: fill stays `#fafafa`, but a thin
  inner border of `#dc2626` appears (1px, inside the main stroke)
- Node with zero findings: fill shifts to `#f0fdf4` (very faint green,
  barely perceptible — just enough to notice when scanning)
- Edge color: always `#d1d5db`
- Text: always `#1a1a1a` for names, `#6b7280` for secondary labels

## Size Calculation

Given a list of modules with line counts:

```
scale = 700 / (max_lines * 3)   # rough scaling factor
for each module:
    area = lines * scale
    w = sqrt(area) * 1.6         # slightly wider than tall
    h = sqrt(area)
    w = clamp(w, 60, 200)        # minimum and maximum sizes
    h = clamp(h, 36, 120)
```

## Fonts

All text uses the **Atkinson Hyperlegible** font family, bundled in
`templates/fonts/` as variable font files (SIL Open Font License):

- `AtkinsonHyperlegibleNextVF-Variable.ttf` — labels, legends, annotations
- `AtkinsonHyperlegibleMonoVF-Variable.ttf` — code identifiers (if used)

Set `font-family: 'Atkinson Hyperlegible Next', sans-serif` on all
`<text>` elements. The sans-serif fallback covers environments where
the font is unavailable.

## Rendering Pipeline

The terrain map Pikchr source is at `templates/terrain-map.pikchr`.
To produce the final SVG or PNG:

```bash
# 1. Render Pikchr to raw SVG (via MCP tool or pikchr CLI)
pikchr terrain-map.pikchr > terrain-map-raw.svg

# 2. Post-process: inject font-family into text elements
sed 's/<text /<text font-family="Atkinson Hyperlegible Next, sans-serif" /g' \
    terrain-map-raw.svg > terrain-map.svg

# 3. Rasterize with resvg using bundled fonts
resvg --use-fonts-dir templates/fonts/ terrain-map.svg terrain-map.png
```

The `resvg` step resolves the Atkinson Hyperlegible fonts at render
time, producing pixel-perfect output regardless of the viewer's
installed fonts.
