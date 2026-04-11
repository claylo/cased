# Handoff: AGENTS.md briefing and schema validation pipeline

**Date:** 2026-04-10
**Branch:** main
**State:** Green

> Green = both PRs merged, 31/31 tests pass, schema validator runs from all three entry points (source, build, skill install), scrat audit validates clean end-to-end.

## Where things stand

Two features shipped and merged to main in the same session: `feat(viewer): add AGENTS.md remediation briefing to audit output` (#17) and `feat(schemas): canonical schema pipeline with validation` (#18). Every audit directory now gets a self-contained `AGENTS.md` written next to `report.html` so any agent picking up remediation work has pre-computed context. Schemas for `recon.yaml` and `findings.yaml` are now load-bearing: `bash src/schemas/build-schemas.sh` validates examples with `jsonschema-cli` on the local build, and `node build-report.js validate <audit-directory>` uses `ajv` to check audits on any machine running the skill.

The "lay of the land" recon pre-runner — the session's original target before the schema drift derailed it — is **not yet started**. The schema pipeline was a prerequisite: the recon script needs a stable shape to emit against, and the shape was incoherent (reference doc disagreed with `recon.schema.json` disagreed with the committed example).

## Decisions made

- **AGENTS.md written at audit build time, not lazily.** It is pure instruction, has no state to stage, and having it there gives agents the briefing even before Phase 5 is invoked. Written by `build-report.mjs` from `src/viewer/agents-md-template.md`, interpolating audit title, slug, date, finding count, and a pre-rendered finding list grouped by narrative.
- **AGENTS.md omits Clay-specific git workflow opinions.** Describes *what the entry needs*, not *how to get the commit*. Keeps the cased skill portable for non-Clay users.
- **JSON Schema Draft 2020-12 with `additionalProperties: false`** on every nested object. Catches stale fields from refactors that would otherwise silently propagate.
- **Bash + `jsonschema-cli` for the build pipeline; `ajv` + `ajv-formats` for the shipped validator subcommand.** Same schemas, two consumers. Bash drives the drift guard on Clay's machine; `ajv` ships with the skill so agents can self-check before assembly.
- **`validate` is a subcommand of `build-report.js`, not a separate script.** Exit codes separated: `1` for validation errors (fix your YAML), `2` for infrastructure errors (schemas not found).
- **Fresh canonical example is scrat 2026-04-09, not regenerated from the old colophon example.** Dates in `src/schemas/{recon,findings}.example.yaml` are quoted to survive both YAML 1.1 (`yj`) and YAML 1.2 (node `yaml` lib) parsing.
- **SKILL.md Phase 3 split** into 3a (schema validation via `build-report.js validate`) and 3b (evidence review via the reviewer agent). Both required, schema validation runs first.
- **`src/schemas/` is the single source of truth**, copied into `skills/cased/references/` by `build-schemas.sh`. Source files: schema JSON, example YAML, markdown header, markdown footer per domain.

## What's next

1. **Recon pre-runner script** at `src/recon/recon` (bash, agreed placement) plus `src/recon/recon-to-yaml.mjs` (node converter). Emits `recon.yaml` conforming to `src/schemas/recon.schema.json`. Hard dependency in Phase 1 of SKILL.md. Keep separate from crustoleum's `scripts/run-tools`. Key transcript findings: 14 of 19 orchestrator commands in the scrat+crustoleum audit session are pre-scriptable; the per-file sparkline loop (15 hotspots × 12 months = 180 git forks) is the most expensive pattern; detection signal is `Cargo.toml` with `[workspace]` table, using `cargo metadata --no-deps --format-version 1` for authoritative workspace members.
2. **Old colophon example cleanup.** `example/2026-03-21-current-repo-review/recon.yaml` is deliberately schema-invalid (it's in the old flat shape) and serves as the active drift-detector fixture in `test/build-report.test.mjs` ("catches drift in the old colophon example"). When the recon pre-runner ships, regenerate this example in the new shape and update the drift test to use a different intentionally-broken fixture.
3. **Fix viewer.js resolution in build-report.mjs.** The `viewerJsCandidates` list at `src/viewer/build-report.mjs:744` does not look in `build/viewer.js`, so running from source embeds a 1 KB stub instead of the 25 KB iife bundle. Running via `build/build-report.js` picks up the right bundle because its `scriptDir` is already `build/`. Flagged in the previous handoff; still unfixed.
4. **Widen `resolveSchemaDir` test coverage.** Current tests only verify the source layout. Add fixtures for the `build/` and `skills/cased/scripts/` layouts so the three candidate paths are all exercised.

## Landmines

- **`ajv` CJS→ESM import needs `.default` unwrapping.** In `src/viewer/build-report.mjs`: `import Ajv2020 from 'ajv/dist/2020.js'` then `new Ajv2020.default(...)`. Same for `addFormats.default(ajv)`. Without the unwrap, `Ajv2020 is not a constructor`.
- **Schema path resolution has 5 candidates across 3 layouts.** `resolveSchemaDir` at `src/viewer/build-report.mjs:52` handles source (`src/viewer`), bundled (`build/`), and skill install (`skills/cased/scripts/`). Tests only cover the source layout — the other two are verified only by manual smoke tests run this session.
- **`example/2026-03-21-current-repo-review/recon.yaml` is intentionally schema-invalid.** Do not "fix" it by running the validator and updating fields. It is the fixture for the "catches drift" test. If you regenerate it, also update the test to point at a different intentionally-broken fixture.
- **`build-schemas.sh` hard-requires `node`, `jq`, and `jsonschema-cli`** (the cargo-installed Rust binary at `~/.cargo/bin/jsonschema-cli`). The node part uses `src/schemas/yaml-to-json.mjs` + the `yaml` npm package so YAML parsing matches the shipped skill exactly (1.2 semantics, no date-quoting gymnastics). `scripts/build-viewer.sh` invokes `build-schemas.sh` as the first step, so anyone without those tools cannot rebuild the viewer bundle. The shipped skill uses `ajv` instead and has no such requirement.
- **`realpathSync(process.argv[1])` in the `build-report.mjs` CLI guard** explodes under `node -e` because `argv[1]` is undefined. Use a standalone `.mjs` file for any ad-hoc imports-and-calls testing instead of `-e`.
