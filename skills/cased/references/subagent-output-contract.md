# Subagent Output Contract

This contract defines the exact shape that every cased subagent returns
to the controller. It applies to all analysis agents (security,
error-handling, code-quality, completeness, dependencies, api-design,
performance) and, with a different `findings` shape, to the reviewer
agent in Phase 3b.

The controller (cased during Phase 2 / Phase 3b) parses the returned
YAML, reads the `status` field first, then routes on it. Subagents that
omit the `status` field, or emit it with an unrecognised value, cannot
be handled correctly — their output is not merge-eligible.

## Envelope

Every response is a YAML document with the following top-level shape:

```yaml
status: DONE | DONE_WITH_PARTIAL_COVERAGE | BLOCKED | NEEDS_CONTEXT
findings: [...]        # present when status is DONE or DONE_WITH_PARTIAL_COVERAGE
coverage_notes: |      # present when status is DONE_WITH_PARTIAL_COVERAGE
  <what you could not cover and why>
blocker: |             # present when status is BLOCKED or NEEDS_CONTEXT
  <what is missing or blocking; be specific>
```

Exactly one of `findings` or `blocker` must be present. Omit the
other. Never emit both.

## Status values

### `DONE`

You completed every applicable criterion for your surface. The
`findings` array contains all confirmed findings (possibly empty if
the surface is clean — report zero findings cleanly, do not invent
concerns to justify your existence).

### `DONE_WITH_PARTIAL_COVERAGE`

You covered the surface as completely as you could, but something
specific was out of reach: a file couldn't be read, a tool wasn't
available, a module required credentials you didn't have, a dependency
was missing from the recon data. Emit `findings` for what you did cover
and `coverage_notes` describing exactly what was skipped and why.

The controller will merge your findings and surface the
`coverage_notes` entry in the audit's recon-side log, so the reader
knows the bounds of the analysis. Do not silently degrade to `DONE` —
that produces an audit report that overpromises coverage.

### `BLOCKED`

You cannot perform meaningful analysis for your surface at all. The
`<audit-context>` block was sufficient but the task is impossible as
specified (wrong language, no code matching your surface, infrastructure
the rubric doesn't apply to). Populate `blocker` with a one-paragraph
explanation and omit `findings`.

The controller will either re-dispatch you with a more capable model,
reroute the surface to a different subagent, or record the surface as
unauditable in the final report. Do not invent findings to avoid a
BLOCKED status.

### `NEEDS_CONTEXT`

You need information that was not provided in `<audit-context>`. The
task is possible, but you can't start without additional input — for
example, the audit-context named a commit SHA that does not exist in
the repo you can see, or the target repo path was wrong. Populate
`blocker` with a precise description of what is missing.

The controller will supply the missing context and re-dispatch. Never
retry a NEEDS_CONTEXT response with the same message — respond
differently only after the context changes.

## `findings` shape (analysis agents)

Each finding is an object with the fields below. All findings must
validate against `${CLAUDE_SKILL_DIR}/references/findings.schema.json`.

```yaml
findings:
  - slug: "<kebab-case-finding-id>"
    title: "<Human-readable finding title>"
    criterion: "<YOUR_PREFIX>-N"         # e.g. SEC-1, CQ-3 — see your rubric
    surface: "<Your Surface Name>"       # maps to the narrative title
    concern: critical | significant | moderate | advisory | note
    locations:
      - path: "src/file.ext"
        start_line: 42
        end_line: 55
    evidence: |
      <VERBATIM code from the file — no added comments, no // ... elisions.
      Line numbers are rendered from start_line, so every line must match
      the source exactly. Use multiple locations for non-contiguous code.>
    evidence_lang: "<language>"          # your rubric specifies the default
    evidence_markers:
      - lines: "<line or range, e.g. '3' or '3-7'>"
        type: del | mark | ins
        label: "<optional: what this marker highlights>"
    mechanism: "<what is wrong and why — one paragraph>"
    remediation: "<how to fix — concrete, actionable>"
    temporal:
      introduced: "<date if discoverable from git>"
      last_modified: "<date if discoverable from git>"
      commit_count: <int if discoverable>
      monthly_commits: [0,0,0,0,0,0,0,0,0,0,0,0]
    chains:
      enables: []
      enabled_by: []
      related: []
    effort: trivial | small | medium | large
    effort_notes: "<brief justification>"
```

**Required:** `slug`, `title`, `concern`, `locations`, `evidence`,
`mechanism`, `remediation`. The `temporal` and `chains` fields are
optional but preferred when git history is available.

**Narrative metadata is controller-written.** Do not emit `thesis`,
`verdict`, or any narrative-level fields. The controller writes those
after collecting all findings from all subagents, because the thesis
and verdict depend on the assembled picture, not a single surface's
view.

**Evidence is verbatim.** Copy the code exactly as it appears in the
file at the cited location. No added comments, no `// ...` elisions.
If the relevant code spans a gap, emit two location entries with two
evidence blocks, not one block with a gap.

**Redaction rule.** If evidence contains secrets, replace the literal
value with a placeholder (`REDACTED_API_KEY`, `<token>`) but still
cite the file and line so the reader can verify. Never reproduce the
secret in the report.

## `findings` shape (reviewer agent)

The reviewer emits a different `findings` structure — a verdict per
input finding, not new findings. The envelope (status + blocker)
is the same.

```yaml
status: DONE | DONE_WITH_PARTIAL_COVERAGE | BLOCKED | NEEDS_CONTEXT
findings:
  - slug: "<slug of the original finding being reviewed>"
    verdict: confirmed | adjusted | disputed
    notes: "<required when adjusted or disputed; explain what to change or why the finding is wrong>"
```

See `agents/reviewer.md` for the full rules — the reviewer is
read-only, never invents findings, and always cites file:line evidence
for disputed or adjusted verdicts.

## Examples

### Clean surface — DONE with zero findings

```yaml
status: DONE
findings: []
```

### Partial coverage — DONE_WITH_PARTIAL_COVERAGE

```yaml
status: DONE_WITH_PARTIAL_COVERAGE
findings:
  - slug: token-no-expiry
    title: "Session tokens issued without an expiry claim"
    # ... full finding fields ...
coverage_notes: |
  The `admin/` module was not covered: its source files are gated
  behind a build feature (`--features admin`) that was not enabled in
  the recon-captured cargo metadata. Re-dispatch with the admin
  feature enabled to cover that surface.
```

### Blocker — BLOCKED

```yaml
status: BLOCKED
blocker: |
  The target repo at /path/to/target is a Python project. This
  security-auditor rubric's SEC-1 (injection reachability), SEC-4
  (cryptographic misuse), and SEC-6 (information disclosure) are
  language-agnostic, but the evidence-gathering conventions in this
  rubric assume Rust source and Cargo.toml configuration. Re-dispatch
  with a Python-adapted rubric, or reroute this surface to a
  Python-specialised security subagent.
```

### Missing context — NEEDS_CONTEXT

```yaml
status: NEEDS_CONTEXT
blocker: |
  The audit-context names commit SHA f706dc96 but the repo at
  /path/to/target is currently at a1b2c3d4 with uncommitted changes.
  Confirm which commit I should audit — the named one (requires
  checkout) or the current working tree state (may diverge from the
  committed history other subagents are using).
```

## Validation

Before returning, emit the YAML to stdout and mentally validate:

1. `status` is present and one of the four enum values.
2. Exactly one of `findings` or `blocker` is present.
3. Every finding's `slug` is unique within your response.
4. Every `locations[].start_line` is ≤ `end_line`.
5. Every `evidence` block's line count matches `end_line - start_line + 1`.
6. No narrative-level fields (`thesis`, `verdict`, `title`,
   `assessment`) at the top level of the response.

The controller will run schema validation on the merged `findings.yaml`
before assembly; a subagent that emits malformed YAML fails the whole
audit.
