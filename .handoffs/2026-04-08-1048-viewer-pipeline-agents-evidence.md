# Handoff: Viewer pipeline, generic agents, evidence integrity

**Date:** 2026-04-08
**Branch:** `main`
**State:** Yellow

> Yellow = all code committed and build-report.js works through symlinked skill path, but generic agents are not yet wired into SKILL.md dispatch, evidence integrity rules are untested in a real audit, and navigation UX needs work for large reports.

## Where things stand

The build pipeline is solid: `node build-report.js <dir>` generates sparkline SVGs, renders flow diagrams, syntax-highlights evidence, and produces a self-contained HTML report. Agents write `findings.yaml` and run one command. Schema is unified across JSON schema, YAML markdown spec, renderer, and example data — no legacy field names remain. Six generic analysis agents exist in `src/cased/agents/` but are not yet referenced from the SKILL.md dispatch path.

## Decisions made

- **No backwards compat for field names** — `start_line`/`end_line`, `temporal`, `chains` everywhere. Legacy names removed.
- **Build-time sparkline generation** — `build-report.js` generates SVG sparklines from `temporal.monthly_commits`. Agents never touch SVGs. Phase 3 (Visualization) collapsed into Phase 2.
- **Evidence must be verbatim** — no agent-added comments, no `// ...` elisions. Annotations go in `evidence_markers`. Rule is in SKILL.md, schema doc, and all agent prompts.
- **`skills:` frontmatter injects SKILL.md text, not file paths** — domain skills like crustoleum get cased's rules via context injection, but local output templates need manual alignment.
- **Generic agent effort levels** — `ultrathink` for security, `high` for error-handling/api-design/performance, default for dependencies/code-quality.
- **Flow diagram layout** — `padLeft: 60` fixes left-label clipping; `.flow-diagram` at `max-width: 66rem` spans text column + sidebar.

## What's next

1. **Wire generic agents into SKILL.md dispatch** — Phase 2 needs a dispatch table for the non-domain-skill path, similar to the crustoleum integration block at `src/cased/SKILL.md:79-109`.
2. **Update crustoleum agent output templates** — 6 agents in `~/source/claylo/crustoleum/skills/crustoleum/agents/` still use `line_start`/`line_end` and lack verbatim evidence rules.
3. **Navigation UX for large reports** — yamalgam audit (27 findings, 6 surfaces) needs a second-tier nav. Click a surface in the nav bar, see its findings.
4. **Flow coverage guidance** — yamalgam had 1 flow for 6 surfaces. SKILL.md should nudge agents to author flows for every process-oriented narrative.
5. **Validate evidence rules** — re-run an audit and verify agents produce clean verbatim evidence. The yamalgam report at `~/source/claylo/yamalgam/record/audits/2026-04-08-full-workspace/report.html` is the test case.

## Landmines

- **Test `build-report.js` through the symlink** — always use `/Users/clay/.claude/skills/cased/scripts/build-report.js`, not the source path. Three bugs were masked by testing through source only (symlink resolution, template paths, recon validation).
- **Crustoleum agents are out of sync** — still use old field names and don't have verbatim evidence rules. The `skills: [cased]` injection gives them SKILL.md text but local output templates override for structure.
- **The yamalgam report shows evidence contamination** — `skip_value` finding has agent-added comments and `// ...` elision in the evidence block, breaking line number accuracy. This is the motivating example for the evidence rules.
- **`parseRecon` no longer validates structure** — it accepts any valid YAML. If future rendering depends on specific recon fields, validation will need to be re-added.
