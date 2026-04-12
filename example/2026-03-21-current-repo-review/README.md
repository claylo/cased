<!--
  README.md scaffold for the cased audit "Current Repo Review".

  The build script created this file with audit metadata filled in.
  You — the agent that ran the audit — must complete the prose.

  README.md is the GitHub-rendered narrative companion to report.html.
  Anyone who lands on this directory in a browser sees it as a coherent
  written report, not just a structured YAML blob.

  Follow the structure in ${CLAUDE_SKILL_DIR}/references/report-template.md.
  Tone: knowledgeable peer who walked the codebase. Not a compliance
  officer. No emoji.

  Required sections:
    1. Opening 3–5 sentence assessment. Start from the assessment field
       in findings.yaml and tighten for prose. State posture directly.
    2. One H2 per narrative in findings.yaml, in the same order. Each
       narrative opens with a one-sentence italic thesis (from
       findings.yaml), then each finding as an H3:
         - title
         - "**{concern}** · `{path}:{lines}` · effort: {effort}" metadata line
         - mechanism paragraph (source findings.yaml mechanism, edit for flow)
         - evidence fenced code block, file-path + line-range info string
         - attacker's-perspective blockquote where the finding has an
           exploit framing (agent authors this — not in findings.yaml)
         - "Enables / Enabled by" chain references where present
         - "**Remediation:**" paragraph with optional code sketch
       Close each narrative with a one-sentence italic verdict.
    3. Remediation Ledger table at the end, one row per finding,
       grouped by narrative (not by severity).

  Do not add findings here that are not in findings.yaml.
  Do not elide code or use // ... in evidence blocks — same rule as
  findings.yaml.

  Remove this HTML comment before committing.
-->

---
audit_date: 2026-03-21
commit: 8a027bfb55da46d8cc0ee150edc01497b511c63b
scope: current-repo-review
findings:
  critical: 0
  significant: 1
  moderate: 2
  advisory: 0
  note: 0
---

# Audit: Current Repo Review

<!-- AGENT: opening 3–5 sentence assessment. See comment block above. -->

## Findings in this audit

This audit contains 3 finding(s) across 2 narrative surface(s).
Anchor links target the slugs below — match them exactly when you author the H3 headings.

### The Location Truthfulness Surface

- `curate-validation-suppresses-unresolved-without-suggestion` (significant) — `crates/colophon/src/commands/curate.rs:58-66`
- `main-file-detection-uses-substring-match` (moderate) — `crates/colophon-core/src/curate/mod.rs:348-351`

### The Text Boundary Surface

- `unicode-casefold-offsets-drift-from-source` (moderate) — `crates/colophon-core/src/render/mod.rs:106-109`

<!-- AGENT: replace everything below this line with the authored narrative
     sections (H2 per narrative, H3 per finding) and the Remediation
     Ledger table. Do not leave this placeholder in the committed file. -->

---

<sub>
Generated 2026-03-21. Source artifacts: recon.yaml, findings.yaml, report.html.
</sub>
