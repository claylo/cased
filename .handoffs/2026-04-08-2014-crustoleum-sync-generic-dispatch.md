# Handoff: Crustoleum schema sync and generic agent dispatch

**Date:** 2026-04-08
**Branch:** `main`
**State:** Yellow

> Yellow = both repos committed and clean, schema aligned, but the full end-to-end pipeline (crustoleum agents → findings.yaml → build-report.js → HTML report) has not been tested on a real Rust project since the schema changes.

## Where things stand

Crustoleum's 6 agents now output findings matching cased's canonical schema (`start_line`/`end_line`, `temporal`, `chains`, `effort`). Cased's SKILL.md now has a proper dispatch table for its 6 generic analysis agents on the non-domain-skill path. Both repos are committed on `main`.

## Decisions made

- **Two copies of the findings schema** — `findings.schema.json` and `findings-schema.yaml.md` copied to crustoleum's `references/`. Agents validate locally via `${CLAUDE_SKILL_DIR}/references/findings.schema.json`. If the schema changes in cased, crustoleum needs a manual sync.
- **Three always-dispatch generic agents** — `security`, `error-handling`, `code-quality` apply to every codebase. Three conditional: `performance` (hot paths), `api-design` (public APIs), `dependencies` (external deps present).
- **Evidence rules expanded in crustoleum agents** — from `<verbatim code quote>` to the full cased rules (no added comments, no elisions, narrow range instead, redaction for secrets).

## What's next

1. **End-to-end Rust audit** — run cased on a Rust project (yamalgam is the existing test case) and verify the full pipeline: crustoleum agent dispatch → correct `findings.yaml` schema → `build-report.js` → HTML report with working line numbers, sparklines, and flow diagrams.
2. **Generic agent end-to-end** — run cased on a non-Rust project to verify the new dispatch table works: agent classification, parallel dispatch, findings collection.
3. **Nav UX for large reports** — the yamalgam audit (27 findings, 6 surfaces) showed the nav bar needs a second tier. Surface-level nav that expands to show findings.
4. **Flow coverage guidance** — SKILL.md should nudge agents to author flows for every process-oriented narrative, not just the obvious one.

## Landmines

- **Schema drift risk** — two copies of findings schema now exist (cased `src/cased/references/` and crustoleum `skills/crustoleum/references/`). A schema change in cased that isn't propagated to crustoleum will cause silent field mismatches. There is no automated sync.
- **The yamalgam report from the previous session** (`~/source/claylo/yamalgam/record/audits/2026-04-08-full-workspace/report.html`) was generated with the old schema. It demonstrates evidence contamination (agent-added comments in code blocks) that the new evidence rules are designed to prevent. Re-run it to validate the fix.
- **Crustoleum `check-tools` and `run-tools` scripts** — Clay noted these "need work" in an earlier session. They haven't been touched in this session.
