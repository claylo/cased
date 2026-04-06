# HTML Viewer v2 — Design Spec

## Overview

Rethink of the HTML report viewer's visual design and code rendering. The v1 viewer is functional but has unnecessary ink (left borders on findings), missing syntax highlighting, and underutilized annotation capabilities. This spec covers integrating expressive-code with a custom Shiki plugin, simplifying the visual treatment of findings, and making the summary pills functional.

Terrain map redesign is out of scope — it gets its own design session.

## Decisions

- **Expressive-code with custom Shiki plugin** — not raw Shiki, not client-side highlighting
- **Schema changes are fine** — no releases yet, get it right
- **Summary pills scroll-to-first** — not filter, not stripped
- **Whitespace-only finding separation** — no borders, no decorative ink
- **Annotation simplification** — fewer rough-notation annotations, each more meaningful
- **github-light theme** — starting point for syntax highlighting palette
- **Atkinson Hyperlegible** — keep both Next and Mono, use variable weight for hierarchy
- **Tufte-inspired aesthetics** — cream background `#fffff8`, restrained headings, sidenotes for chain references
- **Desktop-only** — no mobile breakpoints. Mobile users read the markdown on GitHub. The HTML report is for sitting down at a computer and reading carefully.
- **The output is the brand** — the report should look like nothing else in the code audit space. The difficulty of sidenotes is the point — it's what makes the output worth sharing.

## Architecture

### Expressive-code integration

The blocker with stock expressive-code is that `@expressive-code/plugin-shiki` uses dynamic `import()` for Shiki engine creation and grammar loading. This prevents rolldown from bundling it into a single CJS file for the skill zip.

Solution: a custom plugin (`src/viewer/shiki-plugin.js`, ~60 lines) that replaces `plugin-shiki`. It:

1. Accepts a pre-built `HighlighterCore` instance (created with static grammar imports + JS regex engine)
2. Uses the `performSyntaxAnalysis` hook (same hook as plugin-shiki)
3. Calls `codeToTokensBase()` on the pre-built highlighter
4. Maps tokens to `InlineStyleAnnotation` objects (identical to what plugin-shiki does)
5. Names itself `'Shiki'` so expressive-code doesn't auto-add the default plugin

This preserves full compatibility with expressive-code's other plugins:
- `plugin-text-markers` — `mark`/`ins`/`del` line and word highlighting
- `plugin-frames` — file path title tabs
- `plugin-line-numbers` — gutter line numbers

### Build pipeline

```
DEV TIME (this repo):
  @shikijs/core + static grammar imports + createJavaScriptRegexEngine()
       ↓
  shiki-plugin.js (custom EC plugin, accepts pre-built highlighter)
       ↓
  build-report.mjs (initializes EC with custom plugin + text-markers + frames + line-numbers)
       ↓
  rolldown bundles everything → dist/build-report.js (single CJS, no dynamic imports)
       ↓
  skill zip ships dist/build-report.js + viewer.js + template + CSS + fonts

SKILL RUNTIME (user's project):
  node build-report.js <audit-dir>
       ↓
  Reads YAML → renders evidence through EC at build time → inlines highlighted HTML + EC CSS
       ↓
  report.html (syntax-highlighted code, no runtime Shiki dependency)
```

### Async transition

`ExpressiveCode.render()`, `ec.getBaseStyles()`, and `ec.getThemeStyles()` are all async. The current `assembleReport()` is synchronous. Changes:

- `assembleReport()` becomes `async assembleReport()`
- The EC instance is created once and passed in (or created inside `assembleReport`)
- CLI entry point wraps in an async IIFE: `(async () => { ... })()` — top-level await is not available in CJS output

This was already a known constraint from v1 (see landmine in handoff re: top-level await in CJS).

### EC CSS extraction

After creating the EC instance and rendering all evidence blocks, extract page-level styles:

```javascript
const baseStyles = await ec.getBaseStyles()    // ~16KB, static
const themeStyles = await ec.getThemeStyles()   // ~3KB, theme CSS variables
const jsModules = await ec.getJsModules()       // ~2.5KB, copy button + tabindex
```

These are inlined into the HTML template:
- `baseStyles` + `themeStyles` appended to the `<!-- SLOT:style -->` block after `style.css`
- `jsModules` content appended to the `<!-- SLOT:viewer -->` block after `viewer.js`

Per-block styles from `render()` results are typically empty but should be collected and inlined too.

### Rolldown bundling notes

`@expressive-code/core` itself does not use dynamic imports — it's safe for CJS bundling. The dynamic import problem is isolated to `plugin-shiki`, which we replace.

`@shikijs/core` with `createJavaScriptRegexEngine()` is pure JS (no WASM, no dynamic imports). Static grammar imports are plain ESM modules exporting TextMate grammar JSON. All bundleable.

Estimated bundle size impact for static grammar imports (~24 languages): 1-3MB added to `dist/build-report.js`. This is acceptable — the file already contains the bundled YAML parser and runs as a local CLI tool, not a download.

### Shiki grammar selection

Statically imported grammars for common audit targets:

```
rust, javascript, typescript, python, go, java, c, cpp,
ruby, php, swift, kotlin, toml, yaml, json, bash, shell,
sql, css, html, markdown, dockerfile, makefile, xml
```

Unknown languages fall back to plain text (same as current behavior). More grammars can be added by adding static imports — no architecture change needed.

## Schema changes

### findings.yaml — new optional fields per finding

```yaml
findings:
  - slug: curate-validation-suppresses-unresolved
    title: "Curate Validation Suppresses Unresolved Without Suggestion"
    concern: significant
    locations:
      - path: crates/colophon/src/commands/curate.rs
        line_start: 58
        line_end: 66
    evidence: |
      let report =
          colophon_core::validate::validate_locations(terms, &terms.source_dir, source_extensions);
      if !report.suggestions.is_empty() {
          eprintln!(
              "Validation: {} resolved, {} unresolved",
              report.resolved, report.unresolved
          );
      }
    # NEW: optional language override (inferred from locations[0].path extension if absent)
    evidence_lang: rust
    # NEW: optional line markers for evidence blocks
    evidence_markers:
      - lines: "3"          # 1-indexed within the evidence block
        type: del            # del (problematic), mark (notable), ins (suggested)
        label: "silent path" # optional label on first line of range
      - lines: "3-7"
        type: mark
```

### JSON schema updates

Add to `findings.schema.json` under each finding's properties:

```json
"evidence_lang": {
  "type": "string",
  "description": "Language identifier for syntax highlighting. Inferred from locations[0].path extension if absent."
},
"evidence_markers": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "lines": { "type": "string", "description": "Line or range, e.g. '3' or '3-7'" },
      "type": { "type": "string", "enum": ["mark", "ins", "del"] },
      "label": { "type": "string", "description": "Optional label shown on first line of range" }
    },
    "required": ["lines", "type"]
  }
}
```

## Typography

### Variable font weight hierarchy

Both Atkinson Hyperlegible Next (proportional) and Atkinson Hyperlegible Mono have continuous weight axes (~200-800). Use weight as the primary tool for directing attention — heavier text draws the eye, lighter text recedes. No borders or background colors needed.

**Fix required:** The `@font-face` declarations must include `font-weight: 200 800` for both fonts. Currently omitted — Chrome infers the range but other browsers may not.

```css
@font-face {
  font-family: 'Atkinson Hyperlegible Next';
  src: url(...) format('woff2');
  font-weight: 200 800;
  font-display: swap;
}
```

**Proportional text (Next):**

| Element | Weight | Why |
|---|---|---|
| H1 (audit title) | 600 | Anchors the page, restrained — size does the work |
| H2 (narrative title) | 500 | Section headers, subordinate to H1 |
| Assessment paragraph | 450 | Executive summary — slightly heavier than body |
| H3 finding title — critical/significant | 600 | Visually heavier = more important |
| H3 finding title — moderate | 500 | Present but lighter |
| H3 finding title — advisory/note | 400 | Same as body — doesn't demand attention |
| Body text (mechanism, remediation) | 400 | Normal reading weight |
| Thesis/verdict | 300 italic | Author's voice — commentary, not data |
| Meta text (date, commit, scope) | 300 | Clearly secondary |
| Summary pills | 500 | Slightly heavier than body, clickable affordance |
| Sidenotes (chain refs, effort) | 300 | Margin content, clearly supplementary |

The finding title weight *is* the severity signal. A reader scanning the page sees heavier titles and knows where to focus — the badge is the label, the weight is the emphasis.

**Monospace text (Mono):**

| Element | Weight | Why |
|---|---|---|
| Code in evidence blocks | 400 | Normal, consistent weight — syntax highlighting provides differentiation via color |
| Line numbers in gutter | 300 | Reference, not content — should recede |
| Inline `code` in prose | 400 | Same as body code |

Keep code weight consistent — using weight variation inside code would fight syntax highlighting's color-based differentiation.

## Visual design changes

### Finding treatment

**Remove:**
- `border-left: 3px solid` on `article.finding` and all `data-concern` variants
- `padding-left: 1rem` on `article.finding` (was indent from border)
- `<code class="location">` elements from `.finding-meta` (redundant with EC title tab)

**Add:**
- `margin-bottom: 3rem` on `article.finding` (whitespace separation)
- Evidence blocks rendered by expressive-code with title tab showing file path + line range

**Hierarchy through content, not decoration:**
- Critical/significant findings have `del`-marked lines (red gutter) — visually heavier
- Moderate findings have `mark`-marked lines (neutral highlight) — lighter
- Advisory/note findings may have no markers — lightest

### Evidence block rendering

Each finding's evidence renders through expressive-code at build time:

```
ExpressiveCode.render({
  code: finding.evidence,
  language: finding.evidence_lang || inferLangFromPath(finding.locations[0]?.path),
  meta: buildMetaString(finding.evidence_markers),
  props: {
    title: formatLocationTitle(finding.locations[0]),
    showLineNumbers: true
  }
})
```

Output replaces the current `<pre class="evidence"><code>...</code></pre>` with expressive-code's `<div class="expressive-code"><figure>...</figure></div>`.

**Helper functions:**

```javascript
// Map file extension to Shiki language identifier
function inferLangFromPath(path) {
  // Identity mappings: .js→javascript, .py→python, .go→go, .java→java, etc.
  // Exceptions: .rs→rust, .mjs/.cjs→javascript, .tsx→tsx, .yml→yaml
  // Returns 'txt' if extension is unrecognized or path is undefined
}

// Format the title tab shown on the evidence code block
function formatLocationTitle(location) {
  // Returns "path:line_start-line_end", e.g. "crates/colophon/src/commands/curate.rs:58-66"
  // If line_end is absent, just "path:line_start"
  // If location is undefined, returns empty string (EC renders no title tab)
}

// Convert evidence_markers array to EC meta string
function buildMetaString(markers) {
  // Input:  [{ lines: "3", type: "del", label: "silent path" }, { lines: "3-7", type: "mark" }]
  // Output: 'del={3} "silent path" mark={3-7}'
  // EC meta syntax: type={lines} "optional label"
  // If markers is undefined/empty, returns empty string
}
```

**Multiple locations:** The `evidence` field is a single string — one EC code block per finding. Title tab shows `locations[0]`. If a finding has multiple locations, the others are visible in the remediation ledger. Findings with empty `locations: []` render with no title tab and plain text (no language inference).

### Color palette update

Shift from neutral cool gray to Tufte-inspired warm cream:

| Token | Old | New | Usage |
|---|---|---|---|
| `--c-bg` | `#fafafa` | `#fffff8` | Background — warm paper, not cold screen |
| `--c-black` | `#1a1a1a` | `#111` | Primary text — marginally warmer |
| `--c-mid` | `#6b7280` | `#6b7280` | No change — already warm enough |
| `--c-light` | `#d1d5db` | `#d1d5db` | No change |
| `--c-red` | `#dc2626` | `#dc2626` | No change |
| `--c-green` | `#059669` | `#059669` | No change |

### Sidenotes

Chain references, effort estimates, and temporal context are supplementary information that enriches a finding without interrupting the reading flow. They go in the right margin as sidenotes, following Tufte's pattern.

**Layout model:**

The main text column narrows to ~55% of the container width. The right 45% is reserved for sidenotes. This matches Tufte CSS's proportions and our current `max-width: 48rem` content width maps to roughly a 55% column on a typical monitor.

```css
/* Container widens to accommodate margins */
main#report {
  max-width: 72rem;
  padding: 2rem 2rem 2rem 12%;
}

/* Main text stays in a ~55% column */
article.finding,
section.narrative > h2,
section.narrative > p,
.summary-bar,
header {
  max-width: 40rem;
}

/* Sidenotes float into the right margin */
.sidenote {
  float: right;
  clear: right;
  margin-right: -45%;
  width: 40%;
  font-size: 0.85rem;
  font-weight: 300;
  line-height: 1.4;
  color: var(--c-mid);
}
```

**What goes in sidenotes:**
- **Chain references** — "Enables: [Finding Title]", "Enabled by: [Finding Title]". These are currently inline `.chains` divs. Move them to `<span class="sidenote">` elements positioned alongside the finding.
- **Effort estimates** — if present in the finding data.
- **Temporal sparklines** — if monthly_commits data exists, the sparkline renders in the margin rather than crowding the finding-meta line.

**What stays inline:**
- Concern badge — primary metadata, needs to be immediately visible and is the rough-notation animation target.
- Evidence code blocks — these are full-width content, not margin material.

**Build-time HTML generation:** `renderFinding()` emits sidenote `<span>` elements after the finding title, positioned by CSS float. No JavaScript needed for sidenote layout — it's pure CSS.

**Sidenote numbering:** Not needed. Tufte uses numbered sidenotes as footnote replacements. Our sidenotes are contextual metadata attached to specific findings — the spatial proximity to the finding is the reference, not a number.

### CSS changes

**Expressive-code styles:**
- EC base styles (~16KB) and theme styles (~3KB) inlined into `<style>` alongside `style.css`
- Override EC's code font to use Atkinson Hyperlegible Mono:
  ```css
  .expressive-code pre, .expressive-code code {
    font-family: 'Atkinson Hyperlegible Mono', ui-monospace, monospace;
  }
  ```

**Removed styles:**
- `article.finding` border-left rules (all concern variants)
- `pre.evidence` styles (replaced by EC output)
- `.remediation pre` left-border accent (same unnecessary-ink reasoning)

**Updated styles:**
- `article.finding` — `margin-bottom: 3rem`, no border, no padding-left
- `main#report` — wider container to accommodate sidenote margin
- All text-bearing elements — explicit `font-weight` per the typography table
- Color tokens — cream background, warmer text

### Rough-notation annotations

**Kept (scroll-triggered, fire once):**

| Element | Annotation | Color |
|---|---|---|
| `.concern-badge[data-concern="critical"]` | `box` | `#dc2626` |
| `.concern-badge[data-concern="significant"]` | `underline` | `#dc2626` |
| `.concern-badge[data-concern="moderate"]` | `underline` | `#1a1a1a` |
| `p.thesis` | `highlight` | `#f3f4f6` |

**Removed:**
- `bracket` on `pre.evidence` — EC's line markers handle visual emphasis now
- `circle` on `a.chain-ref` — decorative ink that doesn't inform
- Advisory/note badge annotations — low severity doesn't need a flourish

### Summary pills

Click scrolls to the first finding of that concern level:

```javascript
pill.addEventListener('click', () => {
  const target = document.querySelector(`article.finding[data-concern="${level}"]`);
  target?.scrollIntoView({ behavior: 'smooth' });
});
```

Add `cursor: pointer`, `role="button"`, and `tabindex="0"` for accessibility.

## Quick fixes (bundled into this pass)

- **Terrain map labels** — use crate-relative paths (`curate/mod.rs` not `mod.rs`). Change label generation in `terrain-map.js` to use the last two path segments when the filename is ambiguous (e.g., `mod.rs`, `lib.rs`, `main.rs`).
- **`renderProse()` improvements** — add bold (`**text**` → `<strong>`) and links (`[text](url)` → `<a>`). Three regex replacements, not a full markdown parser. Apply markdown-ish transformations first, then `escHtml()` the remaining text segments — otherwise escaped `&quot;` in URLs would break link detection.

## Out of scope

- Presentation mode fixes (after scroll mode is solid)
- Terrain map redesign (separate design session)
- Remediation code blocks through expressive-code (v3)
- Dark mode
- Mobile breakpoints — this report is for desktop. Mobile users read the markdown on GitHub.

## Source files affected

| File | Change |
|---|---|
| `src/viewer/shiki-plugin.js` | **New.** Custom EC plugin (~60 lines) |
| `src/viewer/build-report.mjs` | Integrate EC, render evidence at build time, async CLI entry, fix @font-face weight range, sidenote HTML generation, wider layout |
| `src/viewer/annotations.js` | Simplify annotation rules |
| `src/viewer/viewer.js` | Add summary pill click handlers |
| `src/viewer/terrain-map.js` | Fix ambiguous labels |
| `src/cased/templates/style.css` | Cream background, weight hierarchy, sidenote layout, remove borders, EC overrides |
| `src/cased/references/findings.schema.json` | Add `evidence_markers`, `evidence_lang` |
| `example/2026-03-21-current-repo-review/findings.yaml` | Add marker data to example |
| `package.json` | Add `@expressive-code/core`, `@shikijs/core`, `@expressive-code/plugin-text-markers`, `@expressive-code/plugin-frames`, `@expressive-code/plugin-line-numbers` |
| `scripts/build-viewer.sh` | Update rolldown config for new deps |
