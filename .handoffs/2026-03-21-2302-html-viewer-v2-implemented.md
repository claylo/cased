# Handoff: HTML viewer v2 — implemented, needs layout polish

**Date:** 2026-03-21
**Branch:** `feat/html-viewer` (27 commits ahead of main)
**State:** Yellow

> Yellow = report renders correctly with all v2 features, tests pass (14/14), rolldown bundles. Visual layout has rough edges (horizontal rules, spacing) that need a polish pass.

## Where things stand

The HTML viewer v2 is implemented end-to-end. Evidence blocks render with syntax-highlighted Rust (via expressive-code + custom Shiki plugin), line numbers match source file positions, `del`/`mark` line markers highlight problematic code, chain references float as sidenotes in the right margin, and the Tufte-inspired cream background + variable font weight hierarchy are in place. The rolldown-bundled `dist/build-report.js` (3.3MB, self-contained) produces a 272KB single-file report.

## Decisions made

- **Custom EC Shiki plugin** (`src/viewer/shiki-plugin.js`) — adapts a pre-built HighlighterCore to EC's `performSyntaxAnalysis` hook. 24 languages bundled via static imports from `@shikijs/langs`. JS regex engine (no WASM). See spec: `record/superpowers/specs/2026-03-21-html-viewer-v2-design.md`
- **`ExpressiveCodeEngine`** not `ExpressiveCode` — the core export name differs from docs. Theme import must be static (not dynamic `import()`) for rolldown CJS compat.
- **`@shikijs/engine-javascript`** is a separate package, not a subpath of `@shikijs/core`.
- **Schema extended** — `evidence_lang` and `evidence_markers` added to findings. See `findings.schema.json`.
- **Desktop-only** — no mobile breakpoints. Sidenotes use CSS float into right margin (55/45 split).

## What's next

1. **Layout polish pass** — horizontal rules between narrative sections look like unnecessary ink. Spacing between findings, sections, and the ledger needs visual tuning. Open the report in browser and iterate with CSS changes to `src/viewer/style.css`.
2. **Rebuild viewer.js bundle** — `bash scripts/build-viewer.sh` to pick up annotation simplification, pill scroll, and terrain label fixes in the client-side IIFE bundle.
3. **Presentation mode** — untested with the new layout. The wider container + sidenotes may break slide rendering.
4. **Ledger table** — still uses the old narrow layout. Could benefit from the same width treatment as findings.
5. **Terrain map redesign** — deferred to its own design session per spec.

## Landmines

- **`src/viewer/style.css` is the CSS source of truth**, not `src/cased/templates/style.css`. The build script copies from viewer to cased. Edit `src/viewer/style.css`.
- **Client-side JS changes (annotations, pills, terrain) require `bash scripts/build-viewer.sh`** to rebuild the IIFE bundle. The report inlines `dist/viewer.js`, not the ESM source files.
- **`assembleReport()` is async** — tests and CLI use async/await. The CJS rolldown output wraps the CLI in an async IIFE.
- **Dynamic `import()` breaks rolldown CJS** — the github-light theme import was already fixed (static import), but any new dynamic imports in build-report.mjs will cause the same rolldown error.
- **`renderNarrative` returns `{ html, styles }`** not a string — callers must destructure.
