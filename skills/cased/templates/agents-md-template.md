# Agent Briefing — {{audit_title}}

You are in a `cased` audit output directory. This file exists to help you pick
up remediation work without thrashing. Read it once, then act.

**Audit:** `{{audit_slug}}`
**Date:** {{audit_date}}
**Findings:** {{finding_count}} total

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

**Mode:** {{mode}} · **Blocking findings: {{blocking_count}}** · **Backlog: {{backlog_count}}**
**Workspace test command:** `{{test_command}}`
**Release phase:** {{release_phase}}

`pre-publish` means change types in place; additive-compat pairs
(`FooBorrowed` beside `Foo`) are wrong until the API is published.

### Prior audits

Sibling audit directories. A prior audit with findings and no
`actions-taken.md` means those findings were never dispositioned.

{{prior_audits}}

### Carried forward (already dispositioned — do NOT re-remediate)

Prior findings this audit deliberately did not re-derive. They are **not** in
the finding index below and do not count toward this audit's totals, but the
ledger accepts these slugs in `Addresses` if you deliberately act on one.

{{carried_forward_list}}

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
5. **Verify at workspace scope**: `{{test_command}}` and the project's
   check/deny/feature gates — including sibling workspaces (`fuzz/`,
   `xtask/`). Crate-local passes are not evidence.
6. **Check the budget.** `git diff --shortstat <base>..HEAD` for this
   finding. Effort `trivial`/`small` and you are past 10 files or 500
   insertions, or on your third commit for one slug → stop, disposition
   `escalated`, hand it to a human.
7. Append one ledger entry (format below), then run
   `node <cased>/scripts/build-report.js ledger <this-dir>` and fix every
   error before committing the ledger.

**One entry per action**, even when a single action resolves multiple
findings — put every slug it addresses in the `Addresses` field.

## `actions-taken.md` format

YAML front matter plus chronological markdown entries. Front matter is
mandatory; update `last_updated` and the `status` counts every time you
add an entry. The `open` count is `{{finding_count}}` minus the findings
carrying any disposition.

```markdown
---
audit: {{audit_slug}}
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
  open: {{finding_count}}
---

# Actions Taken: {{audit_title}}

Summary of remediation status for the [{{audit_date}} {{audit_scope}} audit](README.md).

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
  implied, or a third fix commit on one slug). Stop, record what was
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

{{finding_list}}

## If you have the `cased` skill loaded

Invoke it. The skill's Phase 5 covers remediation tracking with the full
schema reference and worked examples. This briefing exists for the case
where you land in the directory without the skill available.
