# Handoff: Audit directory naming convention — add hour

**Date:** 2026-04-25
**Branch:** main (merged from `fix/audits-per-day`)
**State:** Green

## Where things stand

PR #30 landed. Audit directory naming convention changed from `YYYY-MM-DD-{scope-slug}` to `YYYY-MM-DD-HH-{scope-slug}`, allowing multiple audits per day without collision. `renderAgentsMd` in `build-report.mjs` now derives `auditSlug` from `basename(auditDir)` instead of reconstructing it from findings fields. 93 tests pass; bundle rebuilt clean.

## Decisions made

- **Hourly granularity, not minute.** Audits take ~30 minutes to run, so `HH` is sufficient. Keeps directory names readable (`2026-04-12-14-full-crate` vs `2026-04-12-1435-full-crate`).

- **Derive slug from directory basename, not from findings fields.** The previous approach concatenated `audit_date` + `scope`, but `scope` in findings.yaml can be either a kebab slug or a full descriptive sentence depending on what the agent writes. Using `basename(auditDir)` is always correct because the directory name *is* the slug.

- **No schema change to findings.yaml.** The hour lives in the directory name only. `audit_date` remains a `format: date` field. No new `audit_hour` or `audit_time` field needed.

## What's next

1. **Issue #2 — Sparklines missing from `report.html`.** Carried forward from the 2026-04-12 handoff. Entry points: `src/viewer/build-report.mjs` sparkline-insertion logic.

2. **Flow annotation stacking polish.** When a step has 3+ findings, stacked titles overlap the step label. Geometry details in the 2026-04-12 handoff.

3. **Existing audits in other repos use the old `YYYY-MM-DD-slug` convention.** No migration needed — `build-report.mjs` derives the slug from whichever directory it's pointed at. Old directories work as-is.

## Landmines

- **The SKILL.md first-line text was changed from "Let's take a look with" to "Firing up" in the same working tree.** This was a deliberate, pre-existing edit by Clay that shipped alongside the naming convention changes in PR #30. It is intentional, not accidental drift.

- **`just check-bundle` will report drift on any uncommitted edit under `skills/cased/`.** This is expected during WIP. Rebuild with `just build-viewer` before committing.

- **Bundled `skills/cased/scripts/build-report.js` must stay in sync with `src/viewer/build-report.mjs`.** The `just build-viewer` step handles this, but forgetting it will cause the shipped skill to use stale code. The `check-bundle` recipe catches it post-hoc.
