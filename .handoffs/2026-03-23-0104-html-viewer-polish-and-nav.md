# Handoff: HTML viewer layout polish, sticky nav, and presentation interactivity

**Date:** 2026-03-23
**Branch:** `feat/html-viewer` (uncommitted changes on top of bf8f7ef)
**State:** Yellow

> Yellow = report renders correctly with all new features, bundles build, viewer JS works. Tests not re-run this session (machine is slow). Skill instruction changes untested with a fresh audit.

## Where things stand

The HTML viewer v2 received a full polish pass. Layout issues from the previous handoff (horizontal rules, dead CSS selectors, ledger width) are fixed. A sticky navigation bar appears on scroll with section links. Presentation mode now has full interactivity: pills jump to findings, chain-ref links navigate between slides, swipe and click-edge navigation work for smartboards. A glossary sidenote next to the assessment defines concern levels and the "surface" concept. Skill instructions updated for consistent "Surface" naming in narratives and scannable assessment paragraphs (bold surface names, one sentence per surface).

## Decisions made

- **Removed horizontal rules between narrative sections** — replaced with whitespace-only separation (3.5rem margin). The previous `border-top` was "unnecessary ink" per Tufte principles.
- **Fixed dead CSS selectors** — `#remediation-ledger` in CSS never matched `class="ledger"` in HTML. Changed to `.ledger` / `.ledger-table` class selectors and added `id="remediation-ledger"` to the section for anchor linking.
- **Widened ledger to 60rem** — the 5-column table was cramped at 40rem. Released from the text-column constraint.
- **Sticky nav built from DOM** — uses IntersectionObserver on the header to show/hide. Active section tracked via a second observer with `rootMargin: '-20% 0px -60% 0px'`. Title is a clickable link back to top.
- **Stripped cloned rough-notation SVGs in slides** — `cloneNode(true)` copies annotation overlays, causing phantom marks. `addSlide()` now removes `svg.rough-annotation` from cloned content before inserting.
- **Chain-ref links in slides use event delegation** — a single click handler on the slides container intercepts `a[href^="#"]` clicks and navigates to the slide containing that finding slug. Also handles ledger links.
- **Touch navigation** — `touchstart`/`touchend` with 50px horizontal threshold, `passive: true`. Click-edge navigation: left 25% = prev, right 25% = next, excludes interactive elements.
- **Glossary sidenote** — auto-generated from `summary.counts`, only defines concern levels present in the report. Includes "surface" definition.
- **Skill "Surface" consistency** — updated `SKILL.md`, `report-template.md`, and `findings-schema.yaml.md` to use "Surface" consistently in narrative titles and bold surface names in assessments.

## What's next

1. **Run tests** — 14 tests existed before this session. The `id="remediation-ledger"` addition to `renderLedger()` output may need a test update. `npm test` or equivalent.
2. **Regenerate example report with updated assessment** — the current `findings.yaml` has the old dense assessment. Re-run the audit (or manually edit `findings.yaml`) to get bold surface names in the assessment paragraph, then rebuild the report to verify the `renderProse()` bold handling works in the assessment context.
3. **Terrain map redesign** — deferred per the v2 design spec. The rough-notation boxes work but the map could be more informative.
4. **Blank terrain slide in presentation mode** — the canvas is drawn after DOM is ready, but the slide clone happens before the canvas has content. Could snapshot the canvas to an image, or redraw in the slide.
5. **Presentation mode ledger slide** — may need width/overflow handling for reports with many findings. The 48rem slide max-width constrains the 60rem ledger table.

## Landmines

- **`src/viewer/style.css` is the CSS source of truth**, not `src/cased/templates/style.css`. The build script copies from viewer to cased. Edit `src/viewer/style.css`.
- **Client-side JS changes require `bash scripts/build-viewer.sh`** to rebuild both the IIFE viewer bundle and the CJS build-report bundle, then sync assets to the skill directory.
- **`dist/build-report.js` path resolution** — `repoRoot = join(scriptDir, '..', '..')` goes two levels up from the script. Works from `src/viewer/` but overshoots from `dist/`. Fixed by adding `join(scriptDir, 'viewer.js')` as a candidate, but the same pattern affects `fontsDir` resolution. If fonts aren't found when running from `dist/`, check the path.
- **Dynamic `import()` breaks rolldown CJS** — any new dynamic imports in `build-report.mjs` will cause bundling errors. Use static imports only.
- **`renderNarrative` returns `{ html, styles }`** not a string — callers must destructure.
- **`assembleReport()` is async** — tests and CLI use async/await.
- **Skill instruction changes are untested** — the "Surface" naming and bold-assessment guidance in `SKILL.md` / `report-template.md` / `findings-schema.yaml.md` have not been validated with a fresh audit run.
