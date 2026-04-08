# Findings Schema

The findings artifact captures all audit observations in a structured,
narrative-grouped format. Saved as `findings.yaml` in the audit directory.

```yaml
# findings.yaml (in audit directory)
---
audit_date: date
scope: string
commit: string
assessment: string         # One-paragraph opening assessment

narratives:
  - slug: string           # kebab-case, e.g., "authentication-surface"
    title: string          # Human title, e.g., "The Authentication Surface"
    thesis: string         # One sentence: what is this surface's posture?
    verdict: string        # Net assessment (1-3 sentences)

    flow:                    # Optional: process/data flow for this surface
      - id: string           # Unique within this flow
        label: string        # Displayed text (keep short)
        type: string         # "start" | "end" | "process" | "decision" |
                             # "input" | "store" | "ref" (default: "process")
        findings:            # Finding slugs that attach to this step
          - string           # Simple: just the slug
          # or object form for short labels:
          # - slug: string
          #   label: string  # Override finding title with shorter text
        spine: false         # Optional: off-spine branch step
        no: string           # Optional: step id for "no" branch (decision only)
        next: string         # Optional: override sequential flow (loop-back)

    findings:
      - slug: string       # kebab-case, e.g., "jwt-no-expiry-check"
        title: string      # Human-readable finding title
        concern: string    # "critical" | "significant" | "moderate" |
                           # "advisory" | "note"

        locations:
          - path: string
            start_line: int
            end_line: int

        evidence: |
          # Fenced code block content — the actual code exhibiting
          # the issue. Minimal: just enough to show the problem.
          # Include surrounding context only if it affects understanding.

        mechanism: |
          # One paragraph (2-5 sentences) explaining WHY this is a
          # problem. Assume the reader is a competent developer.
          # Do not explain what SQL injection is. Explain why THIS
          # code is vulnerable to it in THIS context.

        remediation: |
          # Concrete, actionable steps. Include a code sketch if the
          # fix is non-obvious. If the fix is obvious ("add input
          # validation"), say so briefly and move on.

        temporal:
          introduced: date       # When this code was first committed
          last_modified: date    # Last time these lines were touched
          commit_count: int      # Times this file was modified (12mo)
          monthly_commits: list[int]  # For sparkline (12 integers)

        chains:                  # Relationships to other findings
          enables: list[string]  # Slugs of findings this enables
          enabled_by: list[string]  # Slugs that enable this one
          related: list[string]  # Thematically related but not causal

        effort: string           # "trivial" | "small" | "medium" | "large"
        effort_notes: string     # Brief justification for the estimate

summary:
  counts:
    critical: int
    significant: int
    moderate: int
    advisory: int
    note: int
```

## Narrative Construction Guidelines

**Choosing narratives**: Group by *attack surface* or *failure domain*, not
by OWASP category or CWE number. Good narratives:

- "The Authentication Surface" — identity, sessions, tokens
- "The Data Boundary Surface" — input validation, serialization, output encoding
- "The Supply Chain Surface" — dependencies, build pipeline, vendored code
- "The Error Handling Surface" — panics, error swallowing, fallback behavior
- "The Configuration Surface" — environment variables, secrets, defaults
- "The Concurrency Surface" — race conditions, shared mutable state, atomicity

Bad narratives (these are just categories with a hat on):

- "Injection Vulnerabilities" — too generic, groups unrelated code
- "High Severity Findings" — severity is not a narrative
- "Frontend Issues" — location is not a narrative

**Ordering within a narrative**: Lead with the most structurally important
finding — the one that shapes the reader's mental model of this surface.
Follow with findings that build on or complicate that picture. End with
advisory/note-level observations that round out the view.

**The thesis**: Must be a single assessable claim. Not "we looked at auth"
but "The authentication implementation assumes token integrity without
verification, creating a single point of failure at the session boundary."

**The verdict**: Should connect back to the thesis. What did the findings
collectively reveal? Is the thesis confirmed, complicated, or worse than
expected?

## Chain References

Chains are the most important structural element. They turn a flat list
into a graph the reader can follow:

- `enables`: "If you exploit finding A, finding B becomes reachable."
  Example: an auth bypass *enables* privilege escalation.
- `enabled_by`: The reverse. "Finding B is only exploitable if A exists."
- `related`: Thematic connection without causal link. Two different places
  where the same antipattern appears.

In the rendered report, chain references become hyperlinks between findings.
