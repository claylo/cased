# Handoff: Schema unification, generic agents, evidence integrity rules

**Date:** 2026-04-07
**Branch:** `main` (committed through #9 and #10; uncommitted: agents, evidence rules, SKILL.md updates)
**State:** Yellow

> Yellow = build-report.js works through symlinked skill path, reports render correctly, but generic agents are untested and evidence integrity rules need validation via a real audit run.

## Where things stand

The findings schema is unified: JSON schema, YAML markdown spec, renderer code, and example data all use the same field names (`start_line`/`end_line`, `temporal`, `chains`). The build script now generates sparkline SVGs and the report HTML from a single `node build-report.js <dir>` command -- agents no longer produce SVGs. Six generic analysis agents (security, error-handling, api-design, performance, dependencies, code-quality) are drafted but not wired into the SKILL.md dispatch logic.

## Decisions made

- **No backwards compatibility for field names** -- legacy names (`temporal_context`, `chain_references`, `line_start`/`line_end`) removed everywhere. Pre-release, no consumers to break.
- **Sparkline SVG generation moved into build-report.js** -- agents write `temporal.monthly_commits` in findings.yaml; the build script generates and inlines the SVGs. Eliminates Phase 3 (Visualization) from the skill workflow.
- **Evidence must be verbatim source code** -- no agent-added comments, no `// ...` elisions. Annotations go in `evidence_markers`. This rule is now in SKILL.md, the schema doc, and all agent prompts.
- **Generic agents use effort levels** -- `ultrathink` for security (proof obligations), `high` for error-handling/api-design/performance, default for dependencies/code-quality.
- **Flow diagram CSS: max-width 66rem** -- spans text column + sidebar for Tufte margin layout. Left-label clipping fixed with `padLeft: 60` extending viewBox into negative x.
- **parseRecon relaxed** -- no longer gatekeeps on a `files` array. Recon data is embedded as-is in the report blob.

## What's next

1. **Wire generic agents into SKILL.md dispatch** -- the agent prompts exist in `src/cased/agents/` but Phase 2 doesn't reference them for the non-domain-skill path. Add a dispatch table similar to the crustoleum integration.
2. **Update crustoleum agent output templates** -- still uses `line_start`/`line_end` and lacks verbatim evidence rules. Mechanical update across 6 agents in `~/source/claylo/crustoleum/`.
3. **Navigation UX for large reports** -- yamalgam audit (27 findings, 6 surfaces) showed the nav bar needs a second tier. Click a surface, see its findings.
4. **Flow coverage guidance** -- yamalgam had one flow for six surfaces. SKILL.md should nudge agents to consider flows for every narrative, not just the obvious one.
5. **Validate evidence rules** -- re-run an audit with the updated SKILL.md and verify agents produce verbatim evidence without inline annotations.

## Landmines

- **Always test `build-report.js` through the symlinked skill path** (`/Users/clay/.claude/skills/cased/scripts/build-report.js`), not the source path. Symlink resolution, template paths, and font paths all differ. The source path masks real deployment bugs.
- **Crustoleum agents are out of sync with cased's schema** -- they still use `line_start`/`line_end` and `chain_references`. The `skills: [cased]` injection gives them the SKILL.md text but the local output template wins for structure.
- **`skills:` frontmatter in agent definitions injects skill SKILL.md content into agent context** -- it is NOT cross-skill file path resolution. Agents can read the injected text but cannot resolve `${CASED_SKILL_DIR}` paths from another skill.
- **Six new agent files are untracked** -- `src/cased/agents/{api-design,code-quality,dependencies,error-handling,performance,security}.md`. Need to be staged and committed with the SKILL.md and schema updates.
- **The yamalgam report at `~/source/claylo/yamalgam/record/audits/2026-04-08-full-workspace/report.html`** demonstrates both the scale navigation problem and the evidence contamination issue (agent-added comments in code blocks). Good test case for validating fixes.
