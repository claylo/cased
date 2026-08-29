# Agent Briefing — Full Repo self Audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/

You are in a `cased` audit output directory. This file exists to help you pick
up remediation work without thrashing. Read it once, then act.

**Audit:** `2026-08-28-21-self-audit`
**Date:** 2026-08-28
**Findings:** 42 total

## Files in this directory

- `README.md`        — authored narrative report (markdown, GitHub-rendered companion to report.html). Read-only for remediation work.
- `report.html`      — interactive rendered report (primary deliverable). Read-only.
- `findings.yaml`    — structured findings (source for the build). Read-only.
- `recon.yaml`       — structural model. Read-only.
- `assets/`          — generated sparkline SVGs. Don't edit.
- `actions-taken.md` — append-only remediation ledger. May not exist yet;
  create it the first time you log an action.
- `AGENTS.md`        — this file.

## Context you need before touching code

**Mode:** fresh · **Blocking findings: 3** · **Backlog: 39**
**Workspace test command:** `just test`
**Release phase:** pre-publish

`pre-publish` means change types in place; additive-compat pairs
(`FooBorrowed` beside `Foo`) are wrong until the API is published.

### Prior audits

Sibling audit directories. A prior audit with findings and no
`actions-taken.md` means those findings were never dispositioned.

_none_

### Carried forward (already dispositioned — do NOT re-remediate)

Prior findings this audit deliberately did not re-derive. They are **not** in
the finding index below and do not count toward this audit's totals, but the
ledger accepts these slugs in `Addresses` if you deliberately act on one.

_None._

## The loop

For each finding — **blocking first, then backlog** (backlog is optional
for release; triage it, don't grind it):

1. Find it by slug in `README.md` / `report.html`. Read concern, location,
   mechanism, remediation, `failure_mode`, `origin`.
2. **Decide the disposition before writing code.** Is the mechanism
   right? (Trace the path — the reviewer may have missed a guard.)
   Reachable? Worth it now? If not: `disputed` / `deferred` /
   `no-measurable-benefit`, with rationale. Zero pushback across a ledger
   is a smell.
3. **Scope the blast radius before the change.** Which crates does the
   fix touch vs which the finding names? `cargo tree --invert -p <crate>`
   for consumers of any changed symbol. Grep for co-varying text (docs,
   README numbers, config templates, tests asserting the old behaviour).
   If ≥ 2 findings share a file, fix them together.
4. Make the change. One focused commit per logical fix, trailer
   `Audit-Finding: <slug>` per slug. If you edit an existing test's inputs
   or expectations, note what coverage is lost.
5. **Verify at workspace scope**: `just test` and the project's
   check/deny/feature gates — including sibling workspaces (`fuzz/`,
   `xtask/`). Crate-local passes are not evidence.
6. **Check the budget.** `git diff --shortstat <base>..HEAD` for this
   finding. Effort `trivial`/`small` and you are past 10 files or 500
   insertions, or on a fourth commit on one slug → stop, disposition
   `escalated`, hand it to a human.
7. Append one ledger entry (format below), then run
   `node <cased>/scripts/build-report.js ledger <this-dir>` and fix every
   error before committing the ledger.

**One entry per action**, even when a single action resolves multiple
findings — put every slug it addresses in the `Addresses` field.

## `actions-taken.md` format

YAML front matter plus chronological markdown entries. Front matter is
mandatory; update `last_updated` and the `status` counts every time you
add an entry. The `open` count is `42` minus the findings
carrying any disposition.

```markdown
---
audit: 2026-08-28-21-self-audit
last_updated: YYYY-MM-DD
status:
  fixed: 0
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 0
  escalated: 0
  superseded: 0
  no-measurable-benefit: 0
  open: 42
---

# Actions Taken: Full Repo self Audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/

Summary of remediation status for the [2026-08-28 Full-repo self-audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/ audit](README.md).

---

## YYYY-MM-DD — brief description of the action

**Disposition:** fixed
**Addresses:** [finding-slug](README.md#finding-slug)
**Commit:** {SHA(s)}                       ← required for fixed / mitigated / superseded
**Author:** {who did the work — model id or person}
**Verification:** {exact workspace-scope commands and results}   ← required for fixed
**Blast radius:** {crates touched vs crates named in the finding; reverse deps of changed symbols; co-varying docs/tests/config grepped and updated or listed}   ← required for fixed
**Diff:** {N files, +I −D, C commits}      ← required for fixed
**Coverage lost:** {none | what an edited/removed test no longer asserts}   ← required when a fix edits an existing test's inputs or expectations

Rationale paragraphs. For disputed/accepted: the evidence. For deferred/
escalated: the target or the decision needed. For fixed: what changed and
why this approach — and, if the fix touched a public signature, say so.
```

## Dispositions

- `fixed` — code change deployed; commit SHA required, plus `Verification`,
  `Blast radius`, and `Diff`
- `mitigated` — compensating control in place; root cause remains; explain
  the residual risk. Commit SHA required
- `accepted` — risk acknowledged; rationale mandatory (who decided, why).
  This is not a euphemism for "ignored"
- `disputed` — finding contested with evidence; not a dismissal. The
  original finding stays in `README.md`; this entry records the counterargument
- `deferred` — scheduled for later; target date or milestone reference
  required. A deferred finding without a target is an accepted finding in
  disguise
- `escalated` — the fix is out of budget (diff ≥ 5× what the effort estimate
  implied, or a fourth fix commit on one slug). Stop, record what was
  learned, hand the design decision to a human. A circuit breaker, not a
  failure
- `superseded` — a later action replaces this finding's fix or the finding
  itself; name it with `superseded_by:` in the body. Commit SHA required.
  Use this instead of re-filing the same concern under a new heading
- `no-measurable-benefit` — a performance or ergonomics remediation was
  implemented, measured, and showed no benefit; the change was not kept.
  Record the measurement. Do not ship a null result as `fixed`

## Recording fixes in git

One focused commit per logical fix. Each fix commit names the finding(s)
it addresses with a git trailer, one line per slug:

    Audit-Finding: <finding-slug>

Do not pair every fix commit with a ledger commit — a ledger entry cannot
cite a SHA that doesn't exist yet, and per-fix ledger commits double the
history noise. Land the fix commits first, then append ledger entries
(batching several per entry-commit is fine) citing the real SHAs. The
trailers keep the finding-to-commit mapping recoverable before the ledger
catches up:

    git log --format='%h %(trailers:key=Audit-Finding,valueonly)'

## What you must not do

- Do not edit `README.md`, `report.html`, `findings.yaml`, `recon.yaml`, or
  anything in `assets/`. They are the audit artifact and must stay immutable.
- Do not edit past `actions-taken.md` entries. The file is append-only. If
  a previous action is superseded, add a new entry referencing the old one.
- Do not invent finding slugs. Use the ones in the index below, verbatim.
- Do not create an empty `actions-taken.md` until you have at least one
  action to log.
- Do not remediate carried-forward findings. They already carry a standing
  disposition from a prior audit.
- Do not fix a `note` with a breaking public change. Defer it.
- Do not claim `fixed` on crate-local test evidence. Verification is
  workspace-scope or it is not verification.

## Finding index

Every finding in this audit. Use these exact slugs in the `Addresses` field
of your `actions-taken.md` entries.

### The Security Surface

- `report-data-blob-script-breakout` (significant) — `src/viewer/build-report.mjs:929-935`
- `template-slot-replace-interprets-dollar-patterns` (significant) — `src/viewer/build-report.mjs:929-935`
- `eval-scorer-shells-out-model-authored-test-command` (significant) — `src/recon/recon-to-yaml.mjs:313-322`
- `unescaped-metadata-in-report-markup` (moderate) — `src/viewer/build-report.mjs:356-357`
- `prose-links-allow-javascript-uris` (moderate) — `src/viewer/build-report.mjs:223-231`
- `evidence-gate-reads-outside-the-repo-root` (moderate) — `src/viewer/gates.mjs:18-23`
- `eval-runner-drives-unsandboxed-headless-session` (moderate) — `evals/scripts/run-eval:138-142`

### The Error Handling Surface

- `bare-catch-erases-failure-cause` (significant) — `src/viewer/prior-audits.mjs:46-51`
- `build-subcommand-unguarded-io` (moderate) — `src/viewer/build-report.mjs:857-861`
- `fonts-dir-resolution-unguarded` (moderate) — `src/viewer/build-report.mjs:1055-1065`
- `score-json-truncated-by-redirect` (moderate) — `evals/scripts/run-eval:287-290`
- `hygiene-gate-swallows-git-failure` (moderate) — `evals/scripts/run-eval:215-221`
- `entrypoint-guard-unresolved-path` (moderate) — `evals/scripts/score-eval.mjs:494-496`
- `recon-catch-all-collapses-exit-3` (moderate) — `src/recon/recon:10-15`
- `setup-trap-deletes-only-copy` (advisory) — `evals/fixtures/reaudit-rs/setup.sh:78-85`
- `recon-exec-skips-tmp-cleanup` (advisory) — `src/recon/recon:56-57`

### The Completeness Surface

- `ci-drift-gates-abort-without-ys` (significant) — `.github/workflows/ci.yaml:25-31`
- `flow-diagram-tests-excluded-from-suite` (significant) — `Justfile:66-68`
- `agents-md-stale-after-prelaunch-cleanup` (moderate) — `AGENTS.md:19`
- `readme-slide-mode-wrong-key` (moderate) — `README.md:137`
- `finalize-skips-ledger-commit-verification` (moderate) — `src/viewer/build-report.mjs:831-836`
- `crustoleum-run-tools-path-unresolvable-from-cased` (moderate) — `skills/cased/SKILL.md:243-244`
- `codex-max-threads-undercounts-agents` (moderate) — `skills/cased/references/codex-tools.md:47-50`
- `readme-crustoleum-counts-and-agent-table-stale` (advisory) — `README.md:45-56`
- `readme-primary-install-path-unverified` (advisory) — `README.md:69-72`

### The API Design Surface

- `contract-fields-absent-from-schema` (moderate) — `skills/cased/agents/api-design.md:90-91`
- `findings-schema-accepts-unknown-keys` (moderate) — `src/schemas/recon.schema.json:1-13`
- `summary-counts-never-cross-checked` (moderate) — `src/viewer/build-report.mjs:348-353`
- `ledger-addresses-silently-parses-nothing` (moderate) — `skills/cased/references/actions-taken-schema.md:41`
- `build-report-subcommand-fallback` (moderate) — `src/viewer/build-report.mjs:941-953`
- `run-eval-effort-ignored-on-claude` (moderate) — `evals/scripts/run-eval:67-69`
- `shipped-help-names-source-paths` (advisory) — `src/recon/recon:7-8`
- `disposition-vocabulary-triplicated` (advisory) — `src/viewer/gates.mjs:73-74`

### The Code Quality Surface

- `build-report-cli-monolith` (moderate) — `src/viewer/build-report.mjs:940-953`
- `agents-readme-render-duplication` (moderate) — `src/viewer/build-report.mjs:696-712`
- `untested-render-and-escape-exports` (moderate) — `src/viewer/build-report.mjs:204-206`
- `finalize-gate-branches-untested` (moderate) — `src/viewer/build-report.mjs:807-819`
- `build-viewer-parallel-copy-lists` (advisory) — `scripts/build-viewer.sh:18-22`
- `detect-npm-test-command-discarded` (note) — `src/recon/recon-to-yaml.mjs:334-342`
- `flat-findings-traversal-reimplemented` (note) — `src/viewer/gates.mjs:14-16`

### The Supply Chain Surface

- `bundled-third-party-source-missing-license-notices` (significant) — `skills/cased/scripts/build-report.js:38-40`
- `eval-runner-no-external-cli-preflight-check` (moderate) — `evals/scripts/run-eval:77-78`

## If you have the `cased` skill loaded

Invoke it. The skill's Phase 5 covers remediation tracking with the full
schema reference and worked examples. This briefing exists for the case
where you land in the directory without the skill available.
