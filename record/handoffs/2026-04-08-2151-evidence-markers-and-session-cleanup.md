# Handoff: Evidence markers, rough-notation, and session cleanup

**Date:** 2026-04-08
**Branch:** `feat/evidence-markers` (uncommitted), plus `main` commits from earlier in session
**State:** Yellow

> Yellow = viewer builds, example report renders with brackets on marked code blocks, but no real audit has tested agent-produced evidence_markers yet. Crustoleum agent changes are uncommitted in `~/source/claylo/crustoleum`.

## Where things stand

This session covered three threads: crustoleum schema sync (committed on main in both repos), cased repo cleanup with phase reordering (committed on main), and evidence marker rendering (uncommitted on `feat/evidence-markers`). The viewer now draws rough-notation left-brackets on code blocks that contain `evidence_markers`, colored by the most severe marker type. Agents are told to always emit markers. The example report at `example/2026-03-21-current-repo-review/report.html` demonstrates all three marker types.

## Decisions made

- **Verification before assembly** — Phase 3 is now Verification, Phase 4 is Assembly. If verification disputes a finding, `findings.yaml` is corrected before the report is rendered once.
- **Bracket, not circle** — rough-notation circles need to draw outside the `pre` element's overflow boundary, which breaks horizontal scroll. Left-bracket on the `.expressive-code` wrapper avoids the clipping problem entirely. EC line highlights handle per-line coloring inside the code block.
- **evidence_markers default-on** — SKILL.md now says "always add evidence_markers" with the same burden-of-proof flip used for flow diagrams. Three marker types: `del` (red, "this is the problem"), `mark` (gray, "look here"), `ins` (green, "this is the fix").
- **Skill moved to `skills/cased/`** — for `npx skills` discovery. Symlink at `~/.claude/skills/cased` updated to match.
- **Schema copied to crustoleum** — `findings.schema.json` and `findings-schema.yaml.md` live in both repos. No automated sync.
- **Flow diagrams default-on** — same burden-of-proof flip. Agents must justify omitting a flow, not justify adding one.

## What's next

1. **Commit `feat/evidence-markers`** — 10 files changed in cased, 6 in crustoleum. Branch is ready for commit + PR.
2. **End-to-end Rust audit** — run cased on a Rust project to validate the full pipeline: crustoleum agents with markers → verified findings.yaml → HTML report with brackets + line highlights + flows.
3. **End-to-end generic audit** — run cased on a non-Rust project to test the generic agent dispatch table added this session.
4. **Nav UX for large reports** — still open from prior sessions. Yamalgam (27 findings, 6 surfaces) needs second-tier navigation.

## Landmines

- **Two repos have uncommitted changes** — cased on `feat/evidence-markers`, crustoleum on `main` (unstaged). The crustoleum changes add `evidence_markers` to all 6 agent output templates.
- **Schema drift** — `findings.schema.json` exists in both `skills/cased/references/` and `~/source/claylo/crustoleum/skills/crustoleum/references/`. No automated sync between them.
- **`overflow: visible` was tried and reverted** — if someone tries to make rough-notation circles work on individual `.ec-line` elements again, they'll hit the same `pre overflow:auto` clipping. The bracket approach is the deliberate workaround.
- **`build/` replaces `dist/`** — the old `dist/` directory may still exist locally. It's gitignored but stale. Safe to delete.
