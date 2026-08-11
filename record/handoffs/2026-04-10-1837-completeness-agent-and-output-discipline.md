# Handoff: Completeness agent, flow fixes, and output discipline

**Date:** 2026-04-10
**Branch:** main
**State:** Green

> Green = both repos clean, all changes committed and merged. The rebar report was rebuilt as verification and renders cleanly.

## Where things stand

This session covered four threads, all committed to main in both cased and crustoleum. Evidence-marker brackets were removed from the viewer (line highlights alone carry the signal now). A new `completeness` agent ships in both repos — it asks whether documented features and public APIs deliver on their stated purpose, with an era-appropriate expectations check that uses `date +"%Y"` to self-update. The flow-diagram renderer lost its broken horizontal layout and now always renders vertical, with decision labels auto-appending `?` and "yes" moved to the left of the spine. Both SKILL.md files gained Output Discipline sections instructing the orchestrator to work silently and stay out of the agents' source-reading lane.

## Decisions made

- **Completeness is its own agent, not bolted onto code-quality or api-design.** The rubric-based agents evaluate code *correctness* within a surface. Completeness evaluates code *utility* across surfaces — a different analysis mode that needs its own rubric. For crustoleum it's Surface 14 (5 criteria), bringing the total to 89 across 14 surfaces.
- **Era-appropriate expectations use shell substitution.** Criterion FC-4 (cased) and 14.4 (crustoleum) reference `date +"%Y"` directly, so the same rubric text picks up current-year ecosystem assumptions automatically. No annual rubric maintenance.
- **Horizontal flow layout is removed, not deprecated.** The previous threshold-based approach (`spineSteps.length <= 4` → horizontal) was producing overlapping labels on the rebar audit. Vertical layout handles text-heavy flowcharts strictly better — labels live to the left of the spine with unlimited horizontal room.
- **Decision labels auto-normalize.** `flowToSvg` now appends `?` to any `type: decision` step whose label doesn't already end in one. Agents don't need to remember this rule.
- **Orchestrator does not read project source during Phase 2.** Explicit rule added to both SKILL.md files: the orchestrator classifies from recon data and manifest files, dispatches agents, waits, assembles. Reading `.rs`, `.ts`, `.py` files during Phase 2 is a violation — that's what agents do.
- **Bracketed action notation for silent operations.** Borrowed from superpowers: `[Dispatch 5 agents]`, `[Waiting for results]`, `[Collect findings]`. The model treats these as stage directions and performs them without narrating. Only phase transitions, dispatch summaries, and failures get spoken aloud.

## What's next

1. **End-to-end Rust audit.** Run cased+crustoleum on a Rust project and validate the whole pipeline: completeness agent, orchestrator output discipline, division of labor, and the vertical flow rendering. No real audit has exercised the completeness agent yet.
2. **End-to-end generic audit.** Same validation for the non-Rust dispatch path. Completeness dispatches unconditionally in both modes.
3. **Schema drift between repos.** `findings.schema.json` still lives in both `skills/cased/references/` and `~/source/claylo/crustoleum/skills/crustoleum/references/` with no automated sync. This has been a landmine across multiple sessions.
4. **Nav UX for large reports.** Still open from prior sessions. The yamalgam audit (27 findings, 6 surfaces) needs a second-tier navigation approach. Not touched this session.

## Landmines

- **Completeness agent is theorized but unvalidated.** The rubric reads cleanly and the dispatch tables are wired, but no real audit has tested the agent's findings quality. First end-to-end run should watch specifically for: (a) overlap with api-design findings, (b) whether the era-appropriate check produces useful output or vague wishlists.
- **`date +"%Y"` substitution relies on the agent running it.** If an agent's tooling doesn't execute the shell substitution, the rubric text will reference the literal string. Worth verifying the first time it runs.
- **Rebuilding the viewer bundle is mandatory after editing `src/viewer/*.js`.** `bash scripts/build-viewer.sh` regenerates both `build/viewer.js` and `skills/cased/templates/viewer.js`. Skipping this produces reports with stale behavior — a trap hit during this session when the example report showed old bracket code until rebuilt.
- **"Division of labor" rule is prose, not enforced.** The SKILL.md instruction "Do NOT read `.rs`, `.ts`, `.py` source files during Phase 2" is guidance, not a hard constraint. An orchestrator that ignores it won't be stopped.
- **Example report rebuild cascade.** Editing `src/viewer/*.js` → rebuild bundle → rebuild example report (`node skills/cased/scripts/build-report.js example/2026-03-21-current-repo-review`) → verify diff is only the intended change. If other stale reports exist in the project, they won't auto-refresh.
