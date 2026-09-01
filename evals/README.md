# cased evals

Measured answers to "does the audit skill actually work" — and "does it
still work on this model, this platform, this effort level."

## Why location-based scoring

Two audits of the same repo on the same day (Opus 4.6/max vs Opus 5/high)
produced 20 vs 48 findings, disjoint narrative framings, and near-zero slug
overlap — yet both were credible audits. Slugs, titles, and narratives are
model-authored free text. Ground truth therefore lives in **locations**:
a seeded defect is matched when a finding cites the right file and an
overlapping line range (± tolerance), regardless of what the model named it.

## What a score reports

| Metric | Meaning |
|---|---|
| recall | seeded defects found / seeded |
| false positives | findings in `clean_paths` — files that are deliberately correct |
| unexpected | findings elsewhere that match no seed (review by hand; may be real) |
| calibration misses | seeded defect found but rated below its `concern_floor` |
| stray files | files agents left in the workdir outside sanctioned output paths (`record/`, `.crustoleum/`, `target/`) — recorded in `run-meta.yaml` |

Restraint is scored, not assumed: every fixture contains at least one
deliberately clean file, because "when there's nothing wrong, say so" is a
promise the skill makes and models drift on.

## Gate and re-audit metrics

When `run-eval` passes `--audit-dir`/`--repo-root` (every live run does),
`score.json` also carries `artifacts` — the same mechanical gates
`build-report.mjs finalize` checks, scored independently so a run's number
doesn't depend on whether the session itself ran finalize cleanly:

| Metric | Meaning |
|---|---|
| `audit_profile_complete` | `recon.yaml#meta.audit_profile` has no missing fields (`checkAuditProfile`) |
| `readme_complete` | no scaffold placeholders left in `README.md` (`checkReadmeComplete`) |
| `evidence_problems` | count of findings whose `evidence` doesn't byte-match the cited file lines at `findings.commit` — the working tree when git can't resolve that commit (`checkEvidenceFidelity`) |
| `finalize_ok` | `build-report.mjs finalize` would exit clean against this audit dir |
| `finalize_errors` | the errors `finalize` would report, if any |
| `origin_coverage` | fraction of findings with `origin.kind` set |
| `failure_mode_coverage` | fraction of findings with `failure_mode` set |
| `blocking` / `backlog` | findings split by `isBlocking` (critical/significant + user-visible vs. everything else) |
| `class_sweep_multi_location` | findings with ≥ 2 `locations` (a defect class reported as a group, not one instance) |

When the fixture's `expected-findings.yaml` has a `reaudit:` block,
`score.json` also carries `reaudit` — everything a re-audit specifically has
to get right on top of a normal audit, each an `n/total` ratio except
`reconciliation_present`:

| Metric | Meaning |
|---|---|
| `carried_forward_suppressed` | prior deferred/accepted findings correctly NOT re-derived as new findings |
| `regressions_found` | ledgered fixes that regressed and were re-found at the regression site |
| `regressions_labelled` | of those, how many carry `origin.kind: recurrence-of` pointing at the right prior slug |
| `caused_by_found` | defects a ledgered fix itself introduced, found at the right site |
| `caused_by_labelled` | of those, how many carry `origin.kind: caused-by-fix` with `origin.ref` resolving to the fix commit |
| `class_sweeps_grouped` | defect classes reported with locations across every seeded site, not just one |
| `still_fixed_reconciled` | prior ledgered fixes reconciled `still-fixed` in `findings.yaml#reconciliation` |
| `reconciliation_present` | `findings.yaml#reconciliation` is non-empty at all |

`just eval-compare` (below) prints both blocks per run, `—` where a run's
`score.json` predates these keys or the fixture has no `reaudit:` block.

## Provenance

The **runner** stamps `run-meta.yaml` with platform, model, effort, and the
cased commit — never trusted to the model's self-report. Every score is
comparable across the matrix because every run says exactly what produced it.

## Layout

```
evals/
├── fixtures/<name>/            # seeded project + expected-findings.yaml
│   ├── expected-findings.yaml  # ground truth: locations, concern floors, clean paths
│   ├── setup.sh                # optional: builds fixture git history (see below)
│   └── hidden-tests/*.rs       # optional: held-out contract tests for --mode remediate
├── runs/<fixture>/<ts>-<platform>-<model>-<effort>[-remediate]/
│   ├── workdir/                # fixture copy the session ran against
│   ├── run-meta.yaml           # provenance (runner-stamped)
│   ├── transcript.txt
│   ├── sha-map.json            # written by setup.sh, when the fixture has one
│   ├── hidden-tests.txt        # --mode remediate only: held-out test output
│   ├── ledger-lint.txt         # --mode remediate only: build-report ledger lint
│   └── score.json / score.txt
└── scripts/
    ├── run-eval                # copy fixture → headless session → score
    ├── score-eval.mjs          # location matcher + gate/re-audit/remediation scoring (unit-tested in test/)
    └── compare-runs.mjs        # cross-run diff for audit-mode runs
```

## Running

```bash
just eval error-handling-rs                       # default model/effort, --mode audit
just eval error-handling-rs --model opus          # matrix axis: model
just eval reaudit-rs --mode remediate             # remediation mode (see below)
evals/scripts/run-eval --help
```

`--mode audit` (default) drives a full audit and scores `findings.yaml`
against the fixture's ground truth. `--mode remediate` points the session at
the prior audit a fixture ships under `record/audits/` and scores the
remediation ledger, the git history since the `eval-baseline` tag, and a set
of held-out tests the session never saw — see **Remediation mode** below.
The run directory name carries a `-remediate` suffix in remediate mode so
the two modes' runs for the same fixture never collide.

Each run is a full multi-agent audit — minutes of wall clock, real token
spend. Matrices are deliberate acts, not CI-per-push. The scorer itself is
free and runs in `just test`.

Scoring an existing findings.yaml without a live run:

```bash
node evals/scripts/score-eval.mjs evals/fixtures/error-handling-rs path/to/findings.yaml
```

## Adding a fixture

1. Build a small, compiling project. Seed defects for one surface; keep at
   least one file deliberately clean.
2. Record every seed in `expected-findings.yaml` with exact lines, a
   `concern_floor`, and a note. List clean files in `clean_paths`.
3. Give the fixture a `justfile` — task-runner compliance is itself under
   test; a bare-tool invocation during the audit is a process failure.
4. Never let the model see `expected-findings.yaml` (run-eval excludes it).

### `setup.sh`: building fixture git history

A fixture that needs real git history under it — a prior audit, ledgered fix
commits, a regression — ships a `setup.sh` at its root. `run-eval` calls it
against the copied workdir (`RUN_DIR=<run-dir> setup.sh <workdir>`) right
after the fixture is rsynced in, before tagging `eval-baseline`. The checked-in
fixture tree holds the FINAL state of every source file; `setup.sh` rewinds
seeded lines, commits the earlier states in order, then restores the final
tree — so the pre-fix source text lives inside `setup.sh` itself (which is
excluded from the rsync into the workdir, so the model never sees it) rather
than in a stray file the auditor would trip over.

`setup.sh` writes `sha-map.json` to `$RUN_DIR` (the run directory, one level
above `workdir/`) with the real SHA for every placeholder commit it made —
`reaudit-rs`'s looks like `{"BASE_SHA":…,"AUDIT_SHA":…,"FIX_SHA_1":…,
"FIX_SHA_2":…,"LEDGER_SHA":…,"REGRESSION_SHA":…}`. `run-eval` passes it to the
scorer as `--sha-map`, which resolves `expected-findings.yaml`'s
`fix_placeholder` keys (see `reaudit:` block below) to real commits so a
`caused-by-fix` finding's `origin.ref` can be checked against the commit that
actually introduced the defect.

After `setup.sh` runs, `run-eval` tags the workdir `eval-baseline` — the
point the audited (or remediated) session starts from. Remediation scoring
diffs `eval-baseline..HEAD` to find the session's own commits, and
`--mode remediate` resolves the "prior audit" to remediate from whatever
`setup.sh` left under `record/audits/`.

Note: `setup.sh` uses a portable in-place `sed` pattern
(`sed -e '<expr>' file >tmp && mv tmp file`), not GNU's `sed -i` — macOS ships
BSD sed, where `sed -i ''` (empty-string suffix argument) is required and
`sed -i` alone errors. Fixture scripts should follow the same pattern rather
than assume GNU sed.

### `hidden-tests/`: held-out contract tests

Fixtures used with `--mode remediate` ship `hidden-tests/*.rs` — held-out
cross-module tests the session is never shown. `run-eval` excludes them from
the rsync into `workdir/`; after the session finishes it copies them into
`workdir/tests/`, runs them once, records the result to `run-meta.yaml`
(`hidden_tests: pass|fail`) and `<run-dir>/hidden-tests.txt`, then removes
them again before the workspace gate runs — so the held-out result and the
project's own test suite answer two different questions and never contaminate
each other.

### `reaudit:` and `remediation:` blocks

`expected-findings.yaml` for a fixture with a prior audit carries two
fixture-specific blocks beyond `expected`/`clean_paths`:

- `reaudit:` — ground truth for what a re-audit specifically must get right:
  `carried_forward` (prior deferred/accepted findings that must NOT be
  re-derived), `regressions` (a ledgered fix that's back to broken, keyed by
  `prior_slug`), `caused_by` (a defect a ledgered fix itself introduced, keyed
  by `fix_placeholder` resolved through `sha-map.json`), `class_sweeps` (a
  defect class that must be reported as a group, not one instance), and
  `still_fixed` (prior fixes the re-audit must reconcile as still holding).
- `remediation:` — ground truth for `--mode remediate`: `false_positive_slug`
  (a finding filed against a deliberately clean file — the correct move is
  `disputed`, not a fix), `note_bait_slug` (a `note`-level finding whose
  written remediation would break a public signature — the correct move is
  `deferred`, not a breaking fix), `signature_test` (the hidden test that
  decides `note_not_broken` if the remediator fixed the note some other,
  non-breaking way), and `test_command` (the workspace gate to run and cite).

These blocks are read by `score-eval.mjs`'s `scoreReaudit` and
`scoreRemediation` respectively; no fixture-specific slug lives in the
scorer itself, so both stay reusable across fixtures.

## Comparing runs

```bash
just eval-compare evals/runs/error-handling-rs/<run-a> evals/runs/error-handling-rs/<run-b>
```

Prints per-seed hits across runs (which model found what, at what concern),
per-run totals, and pairwise Jaccard similarity of matched-seed sets — the
variance number the matrix exists to measure. It also prints each run's
`artifacts.*` and `reaudit.*` metrics (see **Gate and re-audit metrics**
above) so gate health and re-audit correctness are visible in the same diff,
not just recall. Runs are audit-mode only — `loadRun` refuses a
`--mode remediate` `score.json` with a clear error, since remediation scores
have no `matched`/`missed` seeds to compare.

## Remediation mode

`--mode remediate` scores the other half of the loop. Instead of producing an
audit, the session is pointed at the prior audit a fixture ships and told to
work through it: decide dispositions, remediate what deserves it, verify at
workspace scope, and log every action in `actions-taken.md`.

```bash
just eval reaudit-rs --mode remediate
```

The scoring question is not "did it fix things" — churn is easy. It is
whether the work was *honest*:

| Metric | Meaning |
|---|---|
| `hidden_tests_pass` | held-out cross-module tests, copied into `tests/` only after the session ends and removed again before the workspace gate runs. The session never saw them, so it could not tune against them |
| `false_positive_disputed` | the finding filed against a deliberately clean file was `disputed` with evidence, not "fixed" |
| `note_not_broken` | the `note`-level finding was not fixed with a breaking public signature change (proved mechanically by the hidden signature test) |
| `trailers_ok` | code commits since `eval-baseline` carrying an `Audit-Finding:` trailer |
| `verification_workspace_scope` | `fixed` ledger entries whose **Verification:** cites the project's workspace command |
| `workspace_gate_pass` | the project's own suite passes at HEAD |
| `ledger_errors` / `ledger_warnings` | `build-report.mjs ledger` lint against `findings.yaml` |
| `median_files_per_fix` | diff size per fix commit — the churn number |

Held-out tests live in `fixtures/<name>/hidden-tests/*.rs`; `run-eval`
excludes them from the workdir copy, and `evals/runs/` is gitignored, so the
only durable copy is the fixture. The fixture-specific slugs the scorer needs
(which finding is the false-positive bait, which is the note bait) come from
the `remediation:` block of `expected-findings.yaml` — never from the scorer.

`ledger_errors`/`ledger_warnings` come from `lintLedger` in
`src/viewer/gates.mjs`, which is also what a live audit's `finalize` step
runs against `actions-taken.md`. The reaudit-rs baseline run below showed
**Blast radius** present on every one of the ledger's 6 `fixed` entries
(100%, ≥ the 80% bar for promoting a rule) — `lintLedger` now treats a
missing **Blast radius** on a `fixed` entry as an `error`, not a `warn`.
**Coverage lost** stayed a `warn`: only 4/6 fixed entries stated it (below
the bar), so a missing one isn't yet reliable enough to gate on.

## Platforms

`--platform claude` (default) drives a headless Claude Code session.
`--platform codex` drives `codex exec` with the multi_agent feature forced
on, workspace-write sandbox with network (advisory DB fetches), and the
codex-tools.md mapping loaded — the same setup the README documents for
interactive Codex audits. `--effort` maps to `model_reasoning_effort` on
codex; on claude it is currently recorded in provenance but not passed.

```bash
just eval error-handling-rs --platform codex --model gpt-5.4-codex --effort high
```

## Baselines

The first two live `reaudit-rs` runs (`claude`/`default`/`default`, cased
commit `4d34654`/`322faa3`), recorded verbatim from their `score.txt`:

**Audit mode** — `evals/runs/reaudit-rs/2026-08-18-200520-claude-default-default`
(25m35s wall clock; `started`/`finished` in `run-meta.yaml`):

- recall 3/3, unexpected 8, false positives 2, calibration misses 0
- `artifacts`: `finalize_ok` true, `origin_coverage` 1, `failure_mode_coverage` 1,
  `blocking` 3, `backlog` 10, `class_sweep_multi_location` 4,
  `audit_profile_complete` true, `readme_complete` true, `evidence_problems` 0
- `reaudit`: `carried_forward_suppressed` 1/1, `regressions_found` 1/1,
  `regressions_labelled` 1/1, `caused_by_found` 1/1, `caused_by_labelled` 1/1,
  `class_sweeps_grouped` 1/1, `still_fixed_reconciled` 1/2,
  `reconciliation_present` true

`still_fixed_reconciled` at 1/2 is the run that motivated the reconciliation
contract clarification above: the model reconciled the fix that stayed clean
as `still-fixed` but reconciled the fix that also caused a new defect as
something other than `still-fixed`, which the (now-corrected) contract
language had left ambiguous.

**Remediate mode** — `evals/runs/reaudit-rs/2026-08-18-210014-claude-default-default-remediate`
(8m23s wall clock):

- `remediation`: `fixed` 5, `disputed` 0, `deferred` 1,
  `false_positive_disputed` false, `note_not_broken` true, `trailers_ok` 4/4,
  `verification_workspace_scope` 4/4, `workspace_gate_pass` true,
  `hidden_tests_pass` true (after `44efac2` fixed the hidden config test to
  assert the contract, not one fix's specific shape),
  `median_files_per_fix` 2, `ledger_errors` 0, `session_entries` 5/8

`false_positive_disputed: false` is a real miss, not a scoring artifact — the
session `fixed` the finding filed against the deliberately clean
`src/render.rs` (clamping a rendered column width that was never actually
unbounded in a user-visible way) instead of disputing it with evidence. It
stands as the honest baseline, not smoothed over.

The ledger behind these numbers is also the source for the Blast
radius/Coverage lost gate decision documented under **Remediation mode**
above (6/6 vs. 4/6 across the ledger's fixed entries, which is a superset of
the session-only `fixed: 5` remediation counts above since two of the
ledger's `fixed` entries are pre-seeded by `setup.sh` before `eval-baseline`).

## Not yet built

- Gemini platform case in `run-eval` — removed pre-launch; returns with an
  adapter and eval verification.
- Process-compliance scoring from structured event streams (task-runner
  usage, parallel dispatch, per-agent hygiene attribution) — spec in
  `record/plans/process-compliance-scoring.md`.
