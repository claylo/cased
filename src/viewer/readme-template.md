<!--
  README.md scaffold for the cased audit "{{audit_title}}".

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
audit_date: {{audit_date}}
commit: {{audit_commit}}
scope: {{audit_scope}}
findings:
  critical: {{count_critical}}
  significant: {{count_significant}}
  moderate: {{count_moderate}}
  advisory: {{count_advisory}}
  note: {{count_note}}
---

# Audit: {{audit_title}}

<!-- AGENT: opening 3–5 sentence assessment. See comment block above. -->

## Findings in this audit

This audit contains {{finding_count}} finding(s) across {{narrative_count}} narrative surface(s).
Anchor links target the slugs below — match them exactly when you author the H3 headings.

{{finding_list}}

<!-- AGENT: replace everything below this line with the authored narrative
     sections (H2 per narrative, H3 per finding) and the Remediation
     Ledger table. Do not leave this placeholder in the committed file. -->

---

<sub>
Generated {{audit_date}}. Source artifacts: recon.yaml, findings.yaml, report.html.
</sub>
