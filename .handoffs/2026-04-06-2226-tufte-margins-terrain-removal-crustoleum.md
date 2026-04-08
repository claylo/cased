# Handoff: Tufte margin layout, terrain map removal, crustoleum integration

**Date:** 2026-04-06
**Branch:** `main`
**State:** Yellow

> Yellow = all 47 flow-to-svg tests + 15 build-report tests pass, report renders correctly, but the cased skill needs a real end-to-end run to verify the SKILL.md changes land correctly (HTML report build, flow authoring, crustoleum dispatch).

## Where things stand

The flow diagram renderer now uses a Tufte-inspired layout: findings sit in a right margin column with diagonal hairline connectors pointing to their flow steps. Off-spine branches (`spine: false`, `no:`, `next:`) are fully implemented. The terrain map is removed from all code paths. The cased SKILL.md now references crustoleum for Rust reviews and includes the HTML report build command. Crustoleum's 6 agent output formats are aligned with cased's `findings.yaml` schema.

## Decisions made

- **Tufte margin layout for findings** — findings moved from inline (right of spine) to a right margin column. Diagonal hairline connectors with arrowheads point FROM finding TO step. Eliminates overlap between finding annotations and branch connectors.
- **Findings offset up 50 SVG units** — creates diagonal connector lines that avoid crossing horizontal flow elements.
- **Terrain map fully removed** — deleted `terrain-map.js`, removed from viewer.js, build-report.mjs, slides.js, both style.css files, and SKILL.md. `roughjs` stays in package.json (sparklines still uses it).
- **Verdict slides removed** — verdict text appended to last finding slide instead of getting a duplicate-title slide.
- **Flow diagram added to slides** — renders as its own slide between narrative intro and findings.
- **Crustoleum output aligned to cased schema** — `diagnosis` -> `mechanism`, `fix_direction` -> `remediation`, `location` string -> `locations` array, added `slug`/`title`/`evidence_lang`.
- **`effort: ultrathink`** added to crustoleum's `safety-auditor` and `concurrency` agents only — those two involve proof obligations (unsafe soundness, deadlock reasoning) where shallow reasoning produces dangerous false negatives.
- **HTML report is the primary deliverable** — SKILL.md Phase 4 now includes `node "${CLAUDE_SKILL_DIR}/scripts/build-report.js" <audit-dir>`.

## What's next

1. **End-to-end test of updated SKILL.md** — run cased on a real project and verify: (a) flow diagrams are authored in findings.yaml, (b) HTML report is generated, (c) crustoleum agents are dispatched when available with correct output format. This is the most important validation.
2. **CSS for `.flow-diagram`** — the SVG still stretches to container width with no constraint. Add `max-width` rules in `src/viewer/style.css:330+` to match the text column.
3. **Schema file updates** — `findings.schema.json` needs the `flow` array added (the YAML markdown schema is done, the JSON schema is not).
4. **Crustoleum scripts** — Clay noted `run-tools` and `check-tools` scripts need work; different commands aren't all working.

## Landmines

- **Crustoleum changes are in `~/source/claylo/crustoleum`, not in cased** — the agent output format changes and `effort: ultrathink` additions are in a separate repo. They are uncommitted.
- **Clay also modified crustoleum agents via linter** — reference file paths now use `${CLAUDE_SKILL_DIR}` prefix (e.g., `${CLAUDE_SKILL_DIR}/references/unsafe-and-memory.md`). These changes are intentional.
- **The SKILL.md has never produced a successful HTML report in a real run** — the build command was just added this session. Treat the first real run as a smoke test, not a validation.
- **`findings-schema.yaml.md` uses `start_line`/`end_line` but example data uses `line_start`/`line_end`** — there's a naming mismatch between the schema doc and the actual example findings.yaml. The viewer code should be checked to see which it actually reads.
- **V.padY changed from 24 to 80** — this affects viewBox height for all vertical flows. Tests are updated but any code that computes vertical layout outside of `flow-to-svg.js` would break.
