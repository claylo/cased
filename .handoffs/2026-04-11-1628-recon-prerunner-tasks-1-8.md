# Handoff: Recon pre-runner, Tasks 1-8 complete, Tasks 9-12 pending

**Date:** 2026-04-11
**Branch:** `feat/recon-prerunner`
**State:** Green

> Green = 23/23 tests pass, `bash -n src/recon/recon` clean, branch has 8 focused commits ready for Tasks 9-12 to finish integration.

## Where things stand

The node side of the recon pre-runner is complete: `src/recon/recon-to-yaml.mjs` exports five parsers (`parseGitLog`, `parseTokei`, `parseMetadata`, `buildReconObject`, `validateRecon`) plus a guarded CLI entry point, backed by 23 tests and hand-authored fixtures at `test/fixtures/recon/`. The bash orchestrator at `src/recon/recon` runs `cargo metadata`, `tokei`, and a single `git log` pass into a mktemp'd directory, then `exec`s the node CLI. Tasks 9-12 (justfile recipe, SKILL.md update, build-viewer.sh bundling, crustoleum smoke test) remain.

## Decisions made

- **Plan bugs fixed during execution.** Three plan defects were caught and corrected:
  1. Task 2 sort tiebreak: plan snippet used ascending `localeCompare`, test asserted descending. Implementation matches the test (reverse alphabetical). `src/recon/recon-to-yaml.mjs:83`.
  2. Task 7 imports: plan used `stringify as yamlStringify`, `pathDirname`/`pathJoin` aliases, and a dynamic `await import('node:fs')` for `existsSync`. Sanctioned deviation to match `src/viewer/build-report.mjs` conventions — default `import YAML from 'yaml'`, unaliased `dirname`/`join`, static imports. Six-line import block at `src/recon/recon-to-yaml.mjs:11-16`.
  3. Task 8 git-repo preflight: plan had no guard for `git rev-parse HEAD` against a non-git Rust project. Added `git rev-parse --is-inside-work-tree` check at `src/recon/recon` right after `cd "$TARGET"`, exits 3 with a friendly message.
- **Code quality follow-ups as SendMessage fixes.** Tasks 2, 3, 4, 5, 8 each had a small documentation or defensive-guard follow-up sent to the original implementer via `SendMessage` rather than a new agent spawn. Kept commits clean and avoided re-review cycles.
- **Schema additionalProperties discipline.** `buildReconObject` uses explicit `{name: mod.name, path: mod.path, ...countPerModule(...)}` instead of `{...mod}` to drop `parseMetadata`'s intermediate `manifest_path` field. Task 6's validation confirms the built object passes `recon.schema.json` with zero errors.

## What's next

1. **Task 9 — `justfile` recipe.** Append a `recon target audit_dir` recipe wrapping `bash src/recon/recon {{target}} {{audit_dir}}`. Plan: `record/superpowers/plans/2026-04-10-recon-prerunner.md` Task 9 section. Mechanical.
2. **Task 10 — `skills/cased/SKILL.md` Phase 1 update.** Replace the hand-gathering prose in the Reconnaissance section with the pre-runner invocation (`bash ${CLAUDE_SKILL_DIR}/scripts/recon <target> <audit-dir>`). Keep the non-Rust fallback language. Plan: Task 10 section.
3. **Task 11 — `scripts/build-viewer.sh` bundling.** Add `cp src/recon/recon skills/cased/scripts/recon` and `cp src/recon/recon-to-yaml.mjs skills/cased/scripts/recon-to-yaml.mjs`, then `chmod +x skills/cased/scripts/recon`. Verify `skills/cased/references/recon.schema.json` is already copied by `src/schemas/build-schemas.sh`. Plan: Task 11 section.
4. **Task 12 — Manual smoke test.** Run `bash src/recon/recon /Users/clay/source/claylo/crustoleum /tmp/cased-recon-smoke`, verify exit 0, inspect emitted `recon.yaml` for `meta.project`, module list, dependencies, and hotspot sparklines. Then `rm -rf /tmp/cased-recon-smoke`. Plan: Task 12 section.
5. **Continue using `superpowers:subagent-driven-development`.** Task list is already populated (TaskCreate records 9-12 are pending). Re-dispatch implementers with full task text embedded in the prompt; run the two-stage review (spec compliance → code quality) after each.

## Landmines

- **Tokei is installed (14.0.0 at `/opt/homebrew/bin/tokei`).** Clay installed it mid-session during Task 1. Task 12 requires it.
- **`commit.txt` is gitignored.** Implementers write `commit.txt` at repo root; Clay runs `gtxt` (`git commit -F commit.txt && rm commit.txt`). Never run `git commit` directly. Never stage `commit.txt`. The file won't appear in `git status` because of the ignore rule — verify its existence with `ls commit.txt`.
- **`.bito.yaml` is untracked and should stay untracked** unless explicitly requested. Session-start hook created it during the prior session. Don't stage it during Tasks 9-11.
- **BSD `date -v-` is macOS-only.** `src/recon/recon` uses `date -v-12m` and `date -v-30d`. Do not "improve" this with Linux compatibility — Clay's target is macOS per his defaults, and supporting both platforms is explicitly out of scope.
- **`exec node ...` as the final line of `src/recon/recon` is load-bearing.** It replaces the bash process with node so exit code 4 (validation failure) propagates up to the SKILL.md caller. Don't change `exec` to plain `node`.
- **`Ajv2020.default` and `addFormats.default` are load-bearing.** CJS→ESM unwrap. Without `.default`, ajv construction throws `Ajv2020 is not a constructor`. Pattern lives at `src/recon/recon-to-yaml.mjs:357-358` and at `src/viewer/build-report.mjs:84-85`.
- **Task 12 may surface issues the fixtures don't.** Synthetic fixtures cover 8 commits / 10 files. Real crustoleum has hundreds of files, potentially unusual author names, and long commit history. Watch for: parseGitLog regex failures on unicode authors, parseTokei handling of languages beyond Rust/Toml, large recon.yaml output size. If issues arise, fix in the appropriate earlier task — do not paper over at the smoke-test layer.
- **`additionalProperties: false` is set on every object in `recon.schema.json`.** Any extra field introduced in Tasks 9-12 that reaches the validator will fail validation. The discipline applied in `buildReconObject` must be preserved; no `{...spread}` patterns on intermediate parser outputs.
- **`src/schemas/findings.schema.json` does NOT have `additionalProperties: false`.** This is a known discrepancy flagged in the prior handoff (`2026-04-11-0003-recon-spec-plan-and-fixes.md`). Out of scope for this branch but worth knowing if you encounter findings-related work while finishing recon.
