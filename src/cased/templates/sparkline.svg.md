# Sparkline SVG Template

Sparklines are tiny inline data graphics (Tufte's invention) showing
temporal context for a finding. They appear in the finding's metadata
line at text height (~14px).

## What They Show

Each sparkline represents 12 months of commit activity for the file
containing the finding. The rightmost point is the most recent month.
This tells the reader at a glance:

- **Active file, recent finding**: high recent bars — someone is
  working here, the finding is in living code
- **Dead file, old finding**: flat line — this code is forgotten,
  the finding has been here a long time
- **Spike pattern**: a burst of activity then silence — might be
  a feature push that was never revisited
- **Steady activity**: consistent bars — well-maintained code

## SVG Structure

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 80 16"
     role="img"
     aria-label="Commit activity: {summary}">

  <!-- Bars: one per month, 12 total -->
  <!-- x spacing: 6px per bar, 1px gap = ~80px total -->
  <!-- y: scaled to max_commits in the dataset -->

  <rect x="0"  y="{16 - bar_h}" width="5" height="{bar_h}"
        style="fill: #6b7280;" />
  <rect x="7"  y="{16 - bar_h}" width="5" height="{bar_h}"
        style="fill: #6b7280;" />
  <rect x="14" y="{16 - bar_h}" width="5" height="{bar_h}"
        style="fill: #6b7280;" />
  <!-- ... 12 bars total ... -->

  <!-- Optional: highlight the most recent month differently -->
  <rect x="77" y="{16 - bar_h}" width="5" height="{bar_h}"
        style="fill: #1a1a1a;" />
</svg>
```

## Alternative: Line Sparkline

For files with smoother activity patterns, a line sparkline may
read better:

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 80 16"
     role="img"
     aria-label="Commit activity: {summary}">

  <polyline
    points="{x0},{y0} {x1},{y1} ... {x11},{y11}"
    style="fill: none;
           stroke: #6b7280;
           stroke-width: 1.5;
           stroke-linecap: round;
           stroke-linejoin: round;" />

  <!-- Dot on most recent data point -->
  <circle cx="{x11}" cy="{y11}" r="2"
          style="fill: #1a1a1a;" />
</svg>
```

## Scaling

```
max_val = max(monthly_commits)
if max_val == 0:
    # All bars are zero height — render a flat baseline
    bar_h = 1 for all months

for each month i (0-11):
    bar_h = (commits[i] / max_val) * 14   # max bar height = 14px
    bar_h = max(bar_h, 0.5)               # minimum visible height
    x = i * 7                             # 5px bar + 2px gap
    y = 16 - bar_h
```

## Choosing Bar vs Line

- **Bar**: When activity is sparse (many zero months). Bars make
  the gaps visible.
- **Line**: When activity is continuous. Lines show trend better.

Default to bars. The agent should switch to lines only if all 12
months have non-zero values.

## File Naming

Sparklines are saved as `assets/sparkline-{finding-slug}.svg` in the audit directory.

## Embedding

In the rendered markdown, sparklines appear inline:

```markdown
**significant** · `src/auth.rs:42-67` · effort: small ·
<img src="assets/sparkline-jwt-no-expiry.svg" height="14"
     alt="12-month commit activity" />
```

The `height="14"` keeps the sparkline at text height. GitHub will
render this inline with the surrounding text.

## Fonts

Sparklines are pure data graphics — no text elements, so no font
dependency. If text annotations are added (e.g., axis labels), use
`font-family: 'Atkinson Hyperlegible Mono', monospace` from the
bundled variable fonts in `templates/fonts/`.

## Rendering Pipeline

The sparkline Pikchr template is at `templates/sparkline.pikchr`
(demonstrates the bar pattern at readable scale). Actual sparklines
for audit reports are generated programmatically as raw SVG — they
are simple enough not to need Pikchr.

To rasterize with proper font rendering (if text is present):

```bash
resvg --use-fonts-dir templates/fonts/ sparkline-{slug}.svg sparkline-{slug}.png
```
