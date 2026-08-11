# Handoff: Recon pre-runner closeout — all 12 tasks landed

**Date:** 2026-04-11
**Branch:** `main`
**State:** Green

> Green = tree clean, recon pre-runner end-to-end verified against a real Rust target, all 12 plan tasks confirmed in code.

## Where things stand

The recon pre-runner feature is complete and merged. Node parser, bash orchestrator, justfile recipe, SKILL.md Phase 1 update, and `build-viewer.sh` skill bundling all landed in PR [cased#21](https://github.com/claylo/cased/pull/21) (commit `557d646`). Fresh smoke test against the `yamalgam` workspace returned exit 0 with a 9.0KB schema-valid `recon.yaml`. Nothing outstanding on the recon branch; `feat/recon-prerunner` is gone (folded into the merge).

## Decisions made

- **Yamalgam is a better smoke-test target than crustoleum.** Crustoleum isn't a Rust project (no `Cargo.toml`) — the Tasks 1-8 handoff named it in error. The pre-runner's Rust-only exit 2 fired correctly. Yamalgam has 81 Rust files across 10 crates and a representative 12-month git history; use it for future pre-runner smoke tests in this repo.
- **No separate validation step after the pre-runner.** `src/recon/recon-to-yaml.mjs` validates `recon.yaml` internally against `recon.schema.json` via ajv before writing, and exits 4 on failure. Running `just validate` against a fresh pre-runner output is a false failure because `findings.yaml` doesn't exist yet — that artifact comes from later phases.
- **Recon work was squash-merged under the check-bundle PR title.** PR #21's title advertises only the `check-bundle` justfile recipe, but the squash commit bundles 3,912 lines covering the entire recon pre-runner (plan, spec, node parser, bash orchestrator, tests, fixtures, `Justfile` recipe, `SKILL.md` update, `scripts/build-viewer.sh` bundling, and both prior handoffs). Commit archaeology via `git log --oneline` will not surface the recon work — use `git ls-files` or read the `.handoffs/` chain instead.

## What's next

Scoped work for the recon pre-runner is done. When you return to cased:

1. **Pick the next feature from the backlog.** Open question: does Phase 2 (Analysis) need a similar pre-runner, or does the existing agent dispatch in `skills/cased/SKILL.md:119+` already handle it?
2. **Consider retiring the "run smoke test against crustoleum" guidance** anywhere it still appears in plans. Swap to yamalgam.
3. **`.bito.yaml` remains untracked at repo root.** Session-start hook regenerates it; keep it out of commits unless explicitly requested.

## Landmines

- **PR titles undersell squash contents in this repo.** Do not trust `git log --oneline` as an index of what landed. Use `git show --stat <sha>` or `git ls-files <expected-path>` to verify feature presence. The recon pre-runner is the canonical example: PR #21's title is `chore(justfile): add check-bundle recipe for shipped-file drift`, body mentions only check-bundle, but the squash contains all of Tasks 1-11.
- **`src/recon/recon` uses BSD-only `date -v-12m` / `date -v-30d`.** macOS-only by design per Clay's platform defaults. Do not "improve" with Linux compatibility.
- **`exec node ...` at the tail of `src/recon/recon` is load-bearing.** It replaces the bash process with node so exit 4 (validation failure) propagates to the caller. Changing `exec` to plain `node` will silently mask validation failures.
- **`Ajv2020.default` and `addFormats.default` are load-bearing CJS→ESM unwraps.** At `src/recon/recon-to-yaml.mjs:357-358` and `src/viewer/build-report.mjs:84-85`. Removing `.default` throws `Ajv2020 is not a constructor` at runtime.
- **`additionalProperties: false` is enforced on every object in `recon.schema.json`.** `buildReconObject` uses explicit field listing (`{name, path, ...countPerModule(...)}`) rather than `{...mod}` spread to avoid leaking `manifest_path` from `parseMetadata`. Preserve this discipline — any stray field at the parser boundary will fail validation.
- **`findings.schema.json` does NOT have `additionalProperties: false`.** Known discrepancy from the 2026-04-11-0003 handoff, out of scope for recon but worth knowing if findings-adjacent work comes up.
