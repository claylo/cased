# Handoff: Recon pre-runner spec + plan, plus supporting fixes

**Date:** 2026-04-11
**Branch:** `feat/recon-prerunner`
**State:** Green

> Green = all 31 tests pass, no broken code on any touched branch, recon plan is ready to execute in a fresh session.

## Where things stand

Three focused pieces landed in this session: the crustoleum `findings-schema.yaml.md` reference was brought back in sync with cased's canonical schema (merged to crustoleum `main`); the viewer.js source-mode resolution bug in `src/viewer/build-report.mjs` that embedded a 1 KB stub instead of the 25 KB bundle was fixed and merged via PR #20; and the recon pre-runner was designed, spec'd, and turned into a 12-task implementation plan. The recon script itself does not exist yet — the plan is the deliverable of this session, and implementation will run in a new session.

## Decisions made

- **Crustoleum findings reference: surgical inline patch.** Added 10 lines documenting `evidence_lang` and `evidence_markers[]` between `evidence` and `mechanism` in `crustoleum/skills/crustoleum/references/findings-schema.yaml.md`. Agents were already emitting both fields; the reference doc was the only thing stale. `findings.schema.json` was byte-identical across repos, so no schema change was needed.
- **viewer.js resolution fix: prepend `build/viewer.js`.** `src/viewer/build-report.mjs:777` now checks `repoRoot/build/viewer.js` first so source-mode picks up the rolldown IIFE bundle instead of the source entry point. Dead `dist/viewer.js` and `viewer.iife.js` candidates removed. Verified across all three run contexts (source, build, skill-install). Shipped in PR #20.
- **Recon pre-runner scope: aggressive.** Script emits every `recon.schema.json` section except `boundaries` (schema-marked judgment-driven). Sparkline computation stays inside the script to preserve the single-git-log-pass win.
- **Recon division of labor: bash orchestrates, node assembles.** `src/recon/recon` runs shell tools and writes raw outputs to a mktemp'd temp dir; `src/recon/recon-to-yaml.mjs` parses raw outputs, builds the recon object, validates via ajv, emits YAML. Temp dir is the inspectable API between the two halves.
- **Recon language support: Rust-only.** No pluggable detector, no generic fallback. Exit 2 on any non-Rust target; SKILL.md Phase 1 falls back to hand-gathering in that case.
- **Recon invocation: positional args, no cwd assumption.** `bash src/recon/recon <target-project-dir> <audit-dir>`. Copy-paste shape for the orchestrator's `Bash` tool call.

Full design rationale for the recon decisions lives in `record/superpowers/specs/2026-04-10-recon-prerunner-design.md`.

## What's next

1. **Execute the recon plan in a new session.** Use `superpowers:subagent-driven-development` against `record/superpowers/plans/2026-04-10-recon-prerunner.md`. 12 tasks: Task 1 creates fixtures, Tasks 2-7 are the TDD core for the node parsers and CLI entry point, Task 8 is the bash orchestrator, Tasks 9-11 are justfile/SKILL.md/build-viewer.sh integration, Task 12 is a manual smoke test against crustoleum. Branch is already created; spec and plan are already committed.
2. **Resolve the `additionalProperties: false` discrepancy in `src/schemas/findings.schema.json`.** The 2026-04-10-2142 handoff describes this constraint as present on every nested object, but the file has zero `additionalProperties` constraints anywhere. That's why crustoleum agents' `criterion` and `surface` fields pass validation silently. `src/schemas/recon.schema.json` correctly has the constraints. Decide: tighten the findings schema to match the handoff, or correct the handoff description. Flagged in two prior sessions and not resolved.
3. **Regenerate the drift fixture after recon ships.** `example/2026-03-21-current-repo-review/recon.yaml` is intentionally schema-invalid and serves as the "catches drift" test fixture in `test/build-report.test.mjs`. After the recon pre-runner produces a real schema-valid example, update the drift test to point at a different intentionally-broken fixture and regenerate this example file with the new shape.

## Landmines

- **BSD `date` vs. GNU `date`.** The bash recon script (Task 8 in the plan) uses `date -v-12m` and `date -v-30d` for the window arithmetic. These are BSD-only. On Linux the script will fail. Mac-first is the target per Clay's defaults, but any CI or Linux port needs conditional date logic.
- **ajv CJS→ESM `.default` unwrap.** `new Ajv2020.default(...)` and `addFormats.default(ajv)` are required to construct the validator. Without the `.default`, node throws `Ajv2020 is not a constructor`. This pattern lives in `src/viewer/build-report.mjs:52` and will live in the new `src/recon/recon-to-yaml.mjs` validation function. The `.default` is load-bearing — removing it breaks construction.
- **Schema drift between cased and crustoleum is manual.** There is no automated sync between `src/schemas/findings.schema.json` and `crustoleum/skills/crustoleum/references/findings.schema.json`. A change in one requires a matching edit in the other. The 2026-04-08-2014 handoff flagged this; the viewer.js and recon work did not address it.
- **Imports in `src/recon/recon-to-yaml.mjs` must land in the file's top-level import block.** The plan adds functions across seven tasks, each of which introduces new imports from `node:fs`, `node:path`, `node:url`, `ajv`, `ajv-formats`, and `yaml`. A strict append-only execution produces duplicate `import ... from 'node:path'` lines. The plan's File Structure section includes an "Import management" note; follow it when executing each task.
- **Fresh `.bito.yaml` is untracked.** The session-start hook created `.bito.yaml` at the cased repo root during this session. It is intentionally not staged in any commit. If you want it tracked, stage it deliberately.
- **`feat/recon-prerunner` contains docs only so far.** The spec is committed; the plan will be committed shortly after this handoff. No code under `src/recon/` exists yet. Starting implementation means creating the directory and adding files per the plan, on this same branch.
