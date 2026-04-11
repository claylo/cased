# Recon Pre-Runner Design

**Status**: Spec
**Date**: 2026-04-10
**Branch**: `feat/recon-prerunner`
**Depends on**: `src/schemas/recon.schema.json` (PR #18)
**Blocks**: SKILL.md Phase 1 update; next cased audit session

## Problem

Phase 1 of cased's SKILL.md tells the orchestrator agent to produce `recon.yaml`
by hand. In the recent scrat+crustoleum audit session, this meant the
orchestrator fired ~19 shell commands before dispatching any analysis agent.
The per-file sparkline loop alone accounted for 180 git forks — 15 hotspots
times 12 monthly ranges, each a separate `git log --since … --until …` call.

Two things are wrong with that.

**First**, it burns the orchestrator's token budget on deterministic work.
Fourteen of the nineteen commands are pure mechanical gathering: `cargo
metadata`, `tokei`, `git log`, file walking. None of them need judgment. They
belong in a script.

**Second**, it puts the orchestrator on the wrong side of the division-of-labor
rule established on 2026-04-09: **the orchestrator must not read source files;
only dispatched agents read source.** Grepping `Cargo.toml`, walking the
workspace, and parsing `cargo metadata` are all file-reading. The orchestrator
cannot do Phase 1 at all without violating the rule.

A pre-runner script solves both problems. It moves mechanical gathering out
of the orchestrator's context entirely, and it turns Phase 1 classification
into "read this YAML" instead of "grep these files."

## Decisions

Four decisions frame the design. Each was chosen from two or three
alternatives during brainstorming.

### 1. Scope: aggressive

The script populates every section of `recon.schema.json` except
`boundaries`, which the schema description marks as judgment-driven.

- `meta` — project, commit, timestamp, scope
- `structure` — root, total files/lines, languages, modules
- `dependencies` — manifest path, items (direct only)
- `churn` — period, hotspots with 12-month sparklines, 30-day recent activity

`boundaries` stays agent-owned. `structure.modules[].entry_points` is optional
in the schema and stays empty; agents can populate it if they need to.

**Why aggressive over minimal**: the sparkline performance win (180 forks → 1
pass) only lands if the script owns churn computation. Handing churn back to
the orchestrator puts the 180 forks back in the slow path.

### 2. Division of labor: bash orchestrates, node assembles

Two files:

- `src/recon/recon` — bash, ~150 lines, runs every shell command exactly once
- `src/recon/recon-to-yaml.mjs` — node, ~250 lines, parses raw outputs and
  builds the recon object

The bash script writes raw tool outputs to a temp directory. The node script
reads the temp directory, parses, constructs, validates against
`recon.schema.json`, and emits YAML.

**Why the temp dir as the API**: it makes failure points localizable. If the
script errors, you can inspect `$TMP/cased-recon-*` and see which tool
produced bad data versus which parser misread it. Raw outputs also survive
tool-version changes, so an archived temp dir can replay into the same
`recon.yaml` without re-running `cargo metadata`.

### 3. Language support: Rust-only

If `Cargo.toml` is missing from the target, the script exits 2 with a clear
message: `recon pre-runner: Rust projects only; no Cargo.toml in <path>`.

No pluggable detector, no generic fallback. Extending to JavaScript, Python,
or Go is a future decision made against a real second codebase, not a latent
abstraction built on speculation. Cased's SKILL.md already routes to
`crustoleum` only when `Cargo.toml` is present; the recon script's scope
mirrors that routing exactly.

### 4. Invocation: positional args, no cwd assumption

```
bash src/recon/recon <target-project-dir> <audit-dir>
```

The orchestrator copies this shape from SKILL.md Phase 1 into a `Bash` tool
call. No cd required, no `--target` / `--out` flags, no ambient state. The
script resolves both paths to absolute, cd's into the target internally, and
writes `<audit-dir>/recon.yaml` on success.

## Architecture

```
target-project/                        audit-dir/
      │                                      │
      │    [bash: src/recon/recon]           │
      │    cargo metadata --no-deps          │
      │    tokei --output json               │
      │    git log --since=12.months.ago     │
      │      -M --format=... --name-only     │ (ONE pass)
      │                                      │
      ▼                                      │
$TMPDIR/cased-recon-XXXX/                    │
  ├── metadata.json                          │
  ├── tokei.json                             │
  ├── git-log.raw                            │
  └── manifest.json  (commit, paths,         │
      │               window bounds)         │
      │                                      │
      │    [node: recon-to-yaml.mjs]         │
      │    parse → build → ajv validate      │
      │    yaml.stringify                    │
      ▼                                      │
      └──────────────► recon.yaml ◄──────────┘
```

The temp directory is the only interface between bash and node. Once the
node script exits, the temp directory is cleaned up by the trap in bash.

## Components

### `src/recon/recon` (bash)

**Responsibility**: run the tools, write the outputs. No parsing, no data
construction, no schema awareness.

**Contract**:

```
bash src/recon/recon <target-project-dir> <audit-dir>
```

**Exit codes**:

| Code | Meaning |
|------|---------|
| 0 | Success. `<audit-dir>/recon.yaml` written and validated. |
| 2 | Not a Rust project (no `Cargo.toml`). |
| 3 | Required tool missing, or a tool exited non-zero. |
| 4 | Validation failure (propagated from node). |

**Sequence**:

1. Resolve the script's own directory via `dirname "$0"` (kept in `$SCRIPT_DIR`
   for step 8).
2. Validate and resolve both arg paths to absolute.
3. Check required tools: `cargo`, `git`, `tokei`, `node`.
4. Confirm `Cargo.toml` in target; otherwise exit 2.
5. `mktemp -d` + `trap rm -rf` for cleanup on any exit.
6. `cd` into target.
7. Run mechanical tools sequentially:
   - `cargo metadata --no-deps --format-version 1 > $TMP/metadata.json`
   - `tokei --output json > $TMP/tokei.json`
   - `git log --since='12 months ago' -M --format='---%n%H %ai %an' --name-only > $TMP/git-log.raw`
8. Write `$TMP/manifest.json` with commit SHA, ISO timestamp, resolved target
   path, resolved audit dir, the 12-month window bounds (ISO-formatted), and
   the scope string (see Construction below for how scope is derived).
9. `exec node "$SCRIPT_DIR/recon-to-yaml.mjs" $TMP <audit-dir>/recon.yaml`.
10. On node success, print `wrote <audit-dir>/recon.yaml (<N>KB)` to stdout.

**Progress output**: one line to stdout per tool, prefixed with the tool name.
Errors to stderr only.

### `src/recon/recon-to-yaml.mjs` (node)

**Responsibility**: read raw outputs, construct the recon object, validate
against the schema, emit YAML. No shell invocations, no direct filesystem
traversal of the target.

**Contract**:

```
node src/recon/recon-to-yaml.mjs <tmp-dir> <out-yaml-path>
```

**Construction**:

- `meta.project` — from `cargo metadata`: the package whose `manifest_path`
  matches the workspace root, or the workspace root directory name if the
  root has no root package.
- `meta.commit` — from `manifest.json` (captured by bash via `git rev-parse
  HEAD`).
- `meta.timestamp` — from `manifest.json` (bash's start-of-run ISO 8601
  timestamp with timezone).
- `meta.scope` — from `manifest.json`: the bash script defaults this to
  `"full working tree at <short-sha>"` using the captured commit. The
  orchestrator can edit the emitted `recon.yaml` to replace scope with a
  narrative description (e.g., `"auth subsystem only"`) if the audit is
  scoped tighter than the whole repo.
- `structure.root / total_files / total_lines / languages[]` — from tokei
  JSON aggregate. `languages[].percentage` computed as `(language.lines /
  total_lines) * 100`, two decimal places.
- `structure.modules[]` — one per workspace member in `cargo metadata
  .packages`, filtered to members of `cargo metadata.workspace_members`.
  Each module gets `name` (package name), `path` (dir containing
  `manifest_path`), `files` and `lines` (filtered from tokei by path prefix).
  `entry_points` and `dependencies` (the internal module-to-module graph)
  are left empty — the schema marks them optional.
- `dependencies.manifest` — workspace root `Cargo.toml`.
- `dependencies.items[]` — every `(name, version, kind)` triple appearing in
  any workspace member's `dependencies[]`, deduplicated. **`version` is the
  declared version requirement** (e.g., `"^1.0"`, `"1.2"`), not a locked
  version: `cargo metadata --no-deps` intentionally omits the resolve graph,
  so `Cargo.lock` is not read and no concrete version is computed. The
  schema's `version: string` accommodates either form; requirement strings
  are the right level for recon's purpose (what the project depends on,
  not what's currently installed). `kind` mapping: `null`/`"normal"` →
  `"direct"`, `"dev"` → `"dev"`, `"build"` → `"build"`. Optional deps get
  `"optional"`. Workspace-internal deps are excluded. `latest_version`,
  `age_days`, and `notes` are left unset; discovering those requires network
  and belongs to a future enhancement.
- `churn.period` — the string `"last 12 months"`.
- `churn.hotspots[]` — top 15 files by commit count in the window. See
  [Data flow](#data-flow) below.
- `churn.recent_activity` — 30-day summary computed in the same git log
  parse pass.

**Validation**: ajv Draft 2020-12 with `ajv-formats`, same pattern as
`build-report.js validate`. On failure, print the formatted error paths and
the offending field values, then exit 4.

## Data flow

### The single git log pass

This is the load-bearing optimization. Bash runs:

```
git log --since='12 months ago' -M \
  --format='---%n%H %ai %an' --name-only
```

Output is a stream of records separated by `---`. Each record is one header
line (`<sha> <iso-date> <author-name>`) followed by zero or more file paths.
Node parses the stream once, maintaining:

```
fileStats: Map<path, {
  commits: number,
  authors: Set<string>,
  last_touched: string,    // YYYY-MM-DD
  monthly: number[12]      // oldest first
}>

recentActivity: {
  commits: Set<sha>,
  authors: Set<string>,
  filesChanged: Set<path>
}
```

`recentActivity` only accumulates records with a commit date within 30 days
of the script's start timestamp. After the pass:

1. Sort `fileStats` entries by `commits` descending; take the top 15; emit
   as `hotspots[]` with `authors` count and `monthly` array populated.
2. Reduce `recentActivity` sets to counts; emit as `recent_activity`.

One git process fork total. The parser is pure JavaScript against a string,
so it is fully unit-testable from a fixture.

### Month bucketing

`monthly_commits` is a 12-element array with index 0 = oldest, index 11 =
most recent. The window's oldest month is computed from the script's start
timestamp minus 12 months (bash captures this in `manifest.json`). For each
commit's ISO date, compute `(commit_year * 12 + commit_month_zero) -
(oldest_year * 12 + oldest_month_zero)` and clamp to `[0, 11]`. A commit
outside the window is ignored (shouldn't happen with `--since`, but the
clamp is defensive).

### Rename tracking

`git log -M` follows renames across the bulk log. Renamed files appear under
their new path for the entire window, which is the right behavior for hotspot
analysis: "this file is a hotspot" should survive a rename.

## Error handling

| Condition | Surface | Exit |
|-----------|---------|------|
| Missing `cargo`, `git`, `tokei`, or `node` | stderr: `error: <tool> not found in PATH` plus install hint | 3 |
| No `Cargo.toml` in target | stderr: `recon pre-runner: Rust projects only; no Cargo.toml in <path>` | 2 |
| `cargo metadata` fails | propagate cargo's stderr, prefixed with `recon: cargo metadata failed:` | 3 |
| `tokei` fails | propagate tokei's stderr, prefixed with `recon: tokei failed:` | 3 |
| `git log` fails | stderr: `recon: git log failed in <path>. Is this a git repository?` | 3 |
| ajv validation fails | stderr: formatted errors with field paths and offending values | 4 |
| `<audit-dir>` doesn't exist | `mkdir -p` silently | — |
| `<audit-dir>/recon.yaml` already exists | overwrite without warning (idempotent rerun) | — |

No silent failures. No partial `recon.yaml` on error. Callers can always
distinguish tool problems (3) from schema problems (4) from wrong project
type (2).

## Testing

Three layers, each focused on a single kind of correctness.

### Unit tests: parser correctness

`test/recon-to-yaml.test.mjs` with fixture files in `test/fixtures/recon/`:

- `git-log.raw` with known commit distribution (e.g., 20 commits across 3
  files, known monthly pattern) — assert sparkline values, hotspot ordering,
  recent-activity counts.
- `metadata.json` representing a known 3-crate workspace — assert
  `structure.modules` and `dependencies.items` are extracted correctly.
- `tokei.json` with known file/line counts — assert `structure.total_files`,
  `total_lines`, `languages[]`, and per-module file/line filtering.
- `manifest.json` with known meta fields — assert round-trip into
  `recon.meta`.

These tests run in the existing `just test` flow alongside the current
build-report tests.

### Schema round-trip test

A test that constructs the recon object from the fixtures above and
validates it against the real `src/schemas/recon.schema.json`. Same ajv
check that runs in production, but isolated from tool invocation. Parser
bugs that produce schema-invalid output surface here without needing a
real Rust project.

### Manual smoke test (not CI)

`bash src/recon/recon <crustoleum-path> /tmp/cased-recon-smoke` against the
crustoleum repo in the additional working directory. crustoleum is a real
Rust workspace with real git history; if the script works there, it works.
Diff the result against previous smoke runs to catch drift.

No CI integration test. Cased's existing test posture is `just test` on
node's built-in test runner; there is no CI pipeline yet. Adding a sibling-
repo dependency for integration tests is fragile and out of scope.

## Open questions

These are implementation details for the plan, not design decisions that
need Clay's input:

- **Hotspot count**: default 15, possibly configurable via `--hotspots=N`.
  Held at 15 for first cut.
- **`$TMPDIR` override**: inherited automatically from `mktemp -d`; no
  special handling needed.
- **Tool version capture**: whether `manifest.json` records `cargo
  --version`, `tokei --version`, etc. for audit reproducibility. Cheap to
  add, useful for post-mortems on tool-version drift. First cut omits it.
- **Workspace root detection for non-workspace Rust projects**: a plain
  `[package]` Cargo.toml (no `[workspace]`) should still work — `cargo
  metadata` treats it as a single-member workspace. Smoke test against
  crustoleum will confirm this before merge.
- **Parallel tool execution**: first cut runs `cargo metadata`, `tokei`,
  and `git log` sequentially (simpler error handling, ordered stdout).
  Expected total ~1–3 seconds on a typical workspace. If that proves slow
  enough to matter, wrap the three in bash background jobs with `wait`.

## Out of scope

These are intentionally not in the first cut:

- Non-Rust projects (exit 2 is the entire story)
- Network-dependent enrichment (`latest_version`, `age_days`, `notes` on
  dependencies)
- Module-to-module internal dependency graph (`structure.modules[].dependencies`)
- Entry point detection (`structure.modules[].entry_points`)
- `boundaries` (agent-owned by schema design)
- CI integration tests
- A pluggable language backend interface
