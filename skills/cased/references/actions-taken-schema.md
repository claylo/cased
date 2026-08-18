# Actions Taken Schema

The remediation log tracks responses to audit findings over time. It lives
alongside the audit report as `actions-taken.md` in the audit directory.

This file is **append-only**. New entries are added at the bottom. Entries
are never edited or removed — they form a chronological ledger. If a
previous action is superseded, add a new entry referencing the old one.

## Format

The file uses YAML front matter for machine-parseable summary, followed
by markdown entries in chronological order.

```markdown
---
audit: YYYY-MM-DD-HH-scope-slug
last_updated: YYYY-MM-DD
status:
  fixed: {n}
  mitigated: {n}
  accepted: {n}
  disputed: {n}
  deferred: {n}
  escalated: {n}
  superseded: {n}
  no-measurable-benefit: {n}
  open: {n}          # findings with no action yet
---

# Actions Taken: {Audit Title}

Summary of remediation status for the
[{date} {scope} audit](README.md).

---

## YYYY-MM-DD — {brief description of action}

**Disposition:** {fixed | mitigated | accepted | disputed | deferred | escalated | superseded | no-measurable-benefit}
**Addresses:** [{slug}](README.md#{slug}), …
**Commit:** {SHA(s)}                       ← required for fixed / mitigated / superseded
**Author:** {who did the work — model id or person}
**Verification:** {exact workspace-scope commands and results}   ← required for fixed
**Blast radius:** {crates touched vs crates named in the finding; reverse deps of changed symbols (`cargo tree --invert -p <crate>`); co-varying docs/tests/config grepped and updated or listed}   ← required for fixed
**Diff:** {N files, +I −D, C commits}      ← required for fixed
**Coverage lost:** {none | what an edited/removed test no longer asserts}   ← required when a fix edits an existing test's inputs or expectations

{Rationale paragraphs. For disputed/accepted: the evidence. For deferred/
escalated: the target or the decision needed. For fixed: what changed and
why this approach — and, if the fix touched a public signature, say so.}

{If code was changed, a brief before/after is appropriate:}

    ~~~{language} {file_path}
    {relevant snippet showing the fix}
    ~~~

---

## YYYY-MM-DD — {next action}

{... same structure ...}
```

## Entry Guidelines

**One entry per action, not per finding.** A single PR that fixes three
findings gets one entry with all three slugs in the `Addresses` field.
A finding that requires two separate changes gets two entries.

**Recording commits truthfully.** A ledger entry cannot cite a fix's SHA
in the same commit as the fix — the SHA does not exist until the commit
does. Do NOT solve this with two commits per finding; that doubles
history noise. Instead:

1. Each fix commit carries a git trailer naming the finding(s) it
   addresses:

   ```
   fix(store): propagate snapshot write failures

   Audit-Finding: silent-write-discard
   ```

   Multi-finding commits repeat the trailer, one line per slug. The
   commit declares its findings at the moment it exists — no SHA needed.

2. Ledger entries are appended after the fix commits exist, singly or
   in batches (N fix commits, one ledger commit). The trailers make the
   finding-to-commit mapping recoverable from history even before the
   ledger catches up:

   ```
   git log --format='%h %(trailers:key=Audit-Finding,valueonly,separator=%x2C)'
   ```

The ledger is the narrative record; the trailers are the ground truth
that keeps it honest.

**Dispositions:**

- `fixed` — The finding is resolved by a code change. The commit field
  is required and must contain the fix commit SHA(s) (a PR link may
  accompany it, but a SHA must be present — the ledger lint extracts
  SHAs). `Verification`, `Blast radius`, and `Diff` are also required.
- `mitigated` — A compensating control is in place but the root cause
  remains. Explain what the mitigation is and what residual risk exists.
  Requires **Commit:** with a SHA.
- `accepted` — The risk is acknowledged and will not be addressed.
  Rationale is mandatory — who made the decision and why. This is not
  a euphemism for "ignored." Legitimate reasons: the attack requires
  physical access to the server, the fix would break backward compat
  and the risk is low, the finding is in a deprecated codepath scheduled
  for removal.
- `disputed` — The finding is contested. Provide evidence: the analysis
  is incorrect, the preconditions can't be met in this deployment, the
  code path is unreachable. This is a technical disagreement, not a
  dismissal. The original finding remains in the audit — this entry
  records the counterargument.
- `deferred` — Acknowledged but not yet addressed. Must include either
  a target date or a milestone/issue reference. A deferred finding
  without a target is an accepted finding in disguise.
- `escalated` — the fix is out of budget: actual diff ≥ 5× what the effort
  estimate implied, or a third fix commit on the same slug. Stop, record
  what was learned, and hand the design decision to a human. Not a failure
  — a circuit breaker. (One "small + medium" pair became 17 commits and
  8,084 lines with `fixed: 2 / open: 0` on the ledger.)
- `superseded` — a later action replaces this finding's fix or the finding
  itself (`superseded_by:` slug or SHA in the body). Requires **Commit:**
  with a SHA — the SHA of the replacing change. Use instead of
  re-filing the same concern under a new heading.
- `no-measurable-benefit` — a performance/ergonomics remediation was
  implemented or prototyped, measured, and showed no benefit; the change
  was not kept. Record the measurement. This is a legal, honest outcome —
  do not ship a null result as `fixed`.

**Verification is workspace-scope, always.** Run the project's canonical
test command from `recon.yaml#testing.command` (or `AGENTS.md` "Workspace
test command") across the whole workspace, plus any sibling workspaces
(`fuzz/`, `xtask/`, `benches/`), package/deny/feature-matrix gates the
project has (`just check`, `cargo hack --each-feature`, `cargo deny
check`). "All 103 tests in crate X pass" is not verification — the
recurrence rate collapsed exactly when ledgers switched from crate-local
to workspace-scope gates.

**Pushback is an obligation, not an option.** For every finding you MUST
decide whether it should be `disputed` (mechanism wrong, unreachable,
misread guard), `deferred` (real but not now — with a target), or
`no-measurable-benefit`. A ledger with 100% `fixed` over dozens of findings
is compliance, not diligence. Never fix a `note`-level finding with a
breaking public change; defer it.

**Fix by subsystem, not by slug.** If ≥ 2 findings touch the same file or
mechanism, remediate once with the design decision recorded, and list
every slug in `Addresses`. Sequential per-slug rewrites of one file are the
signature of churn.

**Regression tests must measure the claimed quantity.** If the finding is
about allocations, assert allocations (not `Vec` capacity). Name the
metric in the entry.

**Front matter status counts** should be updated each time a new entry
is added. The `open` count is `total_findings` minus the number of
findings carrying any disposition (`fixed + mitigated + accepted +
disputed + deferred + escalated + superseded + no-measurable-benefit`).
When `open` reaches 0, all findings have been dispositioned (though not
necessarily fixed).

**Checking the ledger.** The entry rules above are enforced mechanically:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/build-report.js" ledger <audit-directory>
```

It checks the front-matter arithmetic, unknown slugs and dispositions, the
required fields per disposition, `Diff` budget against each finding's
effort estimate, and whether the cited commits exist and carry their
`Audit-Finding:` trailers. Run it after every batch of entries and fix
every error before committing the ledger.

**Linking:** Each finding slug in the `Addresses` field links back to
the finding's anchor in `README.md`. This creates bidirectional
navigation: the audit report links forward to the remediation ledger
(via the Remediation Ledger table), and actions-taken links back to
the specific findings.

**Superseding entries:** If a previously `deferred` finding is later
`fixed`, add a new entry with disposition `fixed`. Do not edit the
original `deferred` entry. The front matter status counts reflect the
*latest* disposition for each finding — a finding that was deferred
then fixed counts as `fixed`, not both. When a later action replaces an
earlier *fix* (rather than the finding's status advancing), give the new
entry disposition `superseded` and name the replacement with
`superseded_by:` in its body.

**Carried-forward findings.** In a re-audit, findings with a standing
disposition from a prior audit live in `findings.yaml#carried_forward`,
not in this audit's narratives. Do not re-remediate them. The ledger
still accepts their slugs in `Addresses` if you deliberately act on one.
Actions on carried-forward slugs do not change this audit's `status`
counts — they are tracked in the prior audit's ledger; log them there, or
here with the same slug but leave `status` untouched.

## Tone

Same as the audit report: a colleague's working log. Brief, specific,
no ceremony. The reader should be able to scan the H2 headings and
know exactly what happened and when.
