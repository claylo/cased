# Handoff: HTML viewer v2 design and implementation plan

**Date:** 2026-03-21
**Branch:** `feat/html-viewer`
**State:** Yellow

> Yellow = v1 report still works, spec and plan are written but no implementation code for v2 yet. Ready to execute.

## Where things stand

The v1 HTML report viewer works end-to-end but has visual issues (unnecessary borders, no syntax highlighting, inert summary pills). This session produced a complete v2 design spec and an 11-task implementation plan. No v2 code has been written yet — the next step is execution via subagent-driven-development.

**Spec:** `record/superpowers/specs/2026-03-21-html-viewer-v2-design.md`
**Plan:** `record/superpowers/plans/2026-03-21-html-viewer-v2.md`

## Decisions made

- **Expressive-code with custom Shiki plugin** — stock `plugin-shiki` uses dynamic `import()` that prevents rolldown CJS bundling. Custom plugin (`src/viewer/shiki-plugin.js`, ~60 lines) adapts a pre-built HighlighterCore via the `performSyntaxAnalysis` hook. Keeps text-markers, frames, line-numbers plugins.
- **Shiki grammars bundled into build-report.js** — `@shikijs/core` + JS regex engine + static imports for ~24 languages. No WASM, no dynamic imports. Build-report.js grows by 1-3MB but stays self-contained.
- **Schema additions** — `evidence_lang` and `evidence_markers` fields added to findings. Markers use `mark`/`ins`/`del` types mapped to EC's meta string syntax.
- **Tufte-inspired aesthetics** — cream background `#fffff8`, restrained heading weights, sidenotes for chain references in a 55/45 text/margin column split. Desktop-only.
- **Variable font weight as hierarchy** — both Atkinson fonts have weight axes (~200-800). Finding title weight varies by concern level (600 for significant, 500 for moderate, 400 for advisory). `@font-face` declarations need `font-weight: 200 800`.
- **Kill decorative borders** — left-border on findings removed. Whitespace + weight + EC line markers carry hierarchy.
- **Simplified annotations** — rough-notation on badges and thesis only. Removed bracket/circle/advisory annotations.
- **Summary pills scroll-to-first** on click.

## What's next

1. **Execute the plan via subagent-driven-development.** The plan has 11 tasks. Start with Task 1 (install deps, update schema). Use `superpowers:subagent-driven-development` skill.
2. **Key verification points:** After Task 2, verify Shiki plugin imports resolve. After Task 4, verify EC renders evidence blocks. After Task 10, verify rolldown bundles the full dependency tree.
3. **After execution:** Open the report in browser, visually verify cream background, syntax highlighting, sidenotes, weight hierarchy. Compare against v1 screenshots in `browser/2026-03-22/session-1774141739525/`.

## Landmines

- **`toHtml` import path is uncertain.** Try `@expressive-code/core/hast`, then `@expressive-code/core`, then `hast-util-to-html`. Task 1 Step 1 has a verification command.
- **`src/viewer/style.css` is the CSS source of truth**, not `src/cased/templates/style.css`. The build script copies from viewer to cased. Edit the wrong file and changes get overwritten.
- **`assembleReport()` becomes async.** CLI entry point must use async IIFE — top-level await is not available in CJS rolldown output.
- **The `renderNarrative` function signature changes** — now takes 3 args `(narrative, slugToTitle, ec)` and returns `{ html, styles }` instead of a string. Existing tests must update.
- **Per-block EC styles must be collected** from each `renderEvidence` call and aggregated into the final CSS. If discarded, some EC plugins may produce unstyled output.
