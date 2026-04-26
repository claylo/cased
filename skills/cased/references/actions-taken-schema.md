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
  open: {n}          # findings with no action yet
---

# Actions Taken: {Audit Title}

Summary of remediation status for the
[{date} {scope} audit](README.md).

---

## YYYY-MM-DD — {brief description of action}

**Disposition:** {fixed | mitigated | accepted | disputed | deferred}
**Addresses:** [{finding-slug}](README.md#{anchor}), [{finding-slug}](README.md#{anchor})
**Commit:** {SHA or PR link}
**Author:** {who did the work}

{One to three paragraphs describing what was done. Be specific: what
changed, in which files, and why this approach was chosen. If the
disposition is `accepted` or `disputed`, the rationale must be here.
If `deferred`, include the target date or milestone.}

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

**Dispositions:**

- `fixed` — The finding is resolved by a code change. The commit field
  is required and should point to the merge commit or PR.
- `mitigated` — A compensating control is in place but the root cause
  remains. Explain what the mitigation is and what residual risk exists.
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

**Front matter status counts** should be updated each time a new entry
is added. The `open` count is `total_findings - (fixed + mitigated +
accepted + disputed + deferred)`. When `open` reaches 0, all findings
have been dispositioned (though not necessarily fixed).

**Linking:** Each finding slug in the `Addresses` field links back to
the finding's anchor in `README.md`. This creates bidirectional
navigation: the audit report links forward to the remediation ledger
(via the Remediation Ledger table), and actions-taken links back to
the specific findings.

**Superseding entries:** If a previously `deferred` finding is later
`fixed`, add a new entry with disposition `fixed`. Do not edit the
original `deferred` entry. The front matter status counts reflect the
*latest* disposition for each finding — a finding that was deferred
then fixed counts as `fixed`, not both.

## Tone

Same as the audit report: a colleague's working log. Brief, specific,
no ceremony. The reader should be able to scan the H2 headings and
know exactly what happened and when.
