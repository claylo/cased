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

## Provenance

The **runner** stamps `run-meta.yaml` with platform, model, effort, and the
cased commit — never trusted to the model's self-report. Every score is
comparable across the matrix because every run says exactly what produced it.

## Layout

```
evals/
├── fixtures/<name>/            # seeded project + expected-findings.yaml
│   └── expected-findings.yaml  # ground truth: locations, concern floors, clean paths
├── runs/<fixture>/<ts>-<platform>-<model>-<effort>/
│   ├── workdir/                # fixture copy the audit ran against
│   ├── run-meta.yaml           # provenance (runner-stamped)
│   ├── transcript.txt
│   ├── score.json / score.txt
└── scripts/
    ├── run-eval                # copy fixture → headless audit → score
    └── score-eval.mjs          # location matcher (unit-tested in test/)
```

## Running

```bash
just eval error-handling-rs                       # default model/effort
just eval error-handling-rs --model opus          # matrix axis: model
evals/scripts/run-eval --help
```

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

## Comparing runs

```bash
just eval-compare evals/runs/error-handling-rs/<run-a> evals/runs/error-handling-rs/<run-b>
```

Prints per-seed hits across runs (which model found what, at what concern),
per-run totals, and pairwise Jaccard similarity of matched-seed sets — the
variance number the matrix exists to measure.

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

## Not yet built

- Gemini platform case in `run-eval` — removed pre-launch; returns with an
  adapter and eval verification.
- Process-compliance scoring from structured event streams (task-runner
  usage, parallel dispatch, per-agent hygiene attribution) — spec in
  `record/plans/process-compliance-scoring.md`.
