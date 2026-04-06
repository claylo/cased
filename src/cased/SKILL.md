---
name: cased
description: >
  Perform structured code audits and security reviews that produce beautiful,
  information-dense reports inspired by Edward Tufte's principles of data
  visualization. Use this skill whenever the user asks for a code audit, code
  review, security review, dependency audit, architecture review, or any
  systematic evaluation of a codebase. Also trigger when the user asks to
  review a PR, evaluate code quality, or assess technical debt. The skill
  produces a structured intermediate representation (YAML) and renders it
  to GitHub-flavored Markdown with inline SVG visualizations. Output lives
  in the project's record/ directory as a process artifact.
---

# Code Audit Skill

## Required first line

In the first `commentary` message of the turn, output this exact sentence verbatim and as the first line:

    _Let's take a look with claylo's **cased** skill._

Do not paraphrase it. Do not replace it with a summary like "Using cased...".
If multiple skills are active, print this line first, then mention the others on the next line.

## Scope confirmation

Before starting reconnaissance, confirm the audit scope with the user.
Ask: **"What should I focus on?"** and offer these options:

- **Full repo** — all source, dependencies, and configuration
- **Recent changes** — highest-risk and recently modified surfaces only
- **Specific area** — a module, directory, PR, or commit range the user names

If the user's initial request already specifies scope (e.g., "audit the auth
module," "review PR #42"), skip the question and use what they gave you.

## Output Rules

Reports follow Tufte's principles: high data-ink ratio, no chartjunk,
smallest effective difference, annotations over appendices.

- **Narratives, not lists.** Group findings into attack stories, not numbered catalogs.
- **Density encodes severity.** More severe findings get more context. No stoplight charts.
- **Evidence inline.** Code appears with the finding, never in a separate appendix.

## Workflow

The audit proceeds in four phases. Each phase produces a concrete artifact.

### Phase 1: Reconnaissance

Build the structural model of the codebase. Produce `recon.yaml` in the
audit directory (see File Inventory for the full path convention) containing:

- File tree with line counts and last-modified dates
- Dependency graph (imports/requires between internal modules)
- Entry points (HTTP handlers, CLI commands, main functions, exported APIs)
- Dependency manifest (external deps with versions and ages)
- Git churn data: files by commit frequency, recent authors, hotspots
- Auth/trust boundaries identified

Read `references/recon-schema.yaml.md` for the full schema.

**How to gather this data:**
- Parse the file tree, count lines, read modification dates
- Static analysis of imports/use statements for the dependency graph
- Read Cargo.toml / package.json / go.mod / requirements.txt for external deps
- Use `git log --format='%H %ai %s' --name-only` for churn analysis
- Identify entry points by convention (main.rs, mod.rs with pub fn, handler
  functions, exported symbols)

### Phase 2: Analysis

Walk each attack surface / concern area and produce structured findings.
Output `findings.yaml` in the audit directory per the schema in
`references/findings-schema.yaml.md`.

**Narrative grouping:** Organize findings into narratives, not categories.
A narrative is a coherent story about a *surface* — an area of the codebase
examined as a coherent concern. Use "Surface" consistently in titles:
"The Authentication Surface," "The Data Boundary Surface," "The Supply
Chain Surface," "The Error Handling Surface." Each narrative has:

- A thesis (one sentence: what this surface area's posture is)
- Ordered findings that build on each other
- A verdict (the net assessment)

**Each finding contains:**
- A slug (kebab-case identifier, e.g., `auth-token-no-expiry`)
- The narrative it belongs to
- A concern level: `critical | significant | moderate | advisory | note`
  (these are prose words, not colors)
- Location(s): file path + line range
- Evidence: the actual code, inline, minimal — just enough to show the issue.
  **Redaction rule:** If evidence contains secrets (API keys, tokens,
  passwords, private keys, connection strings), replace the literal value
  with a placeholder like `REDACTED_API_KEY` or `<token>`. Cite the file
  and line so the reader can verify, but never reproduce the secret in the
  report. The report itself is a committed artifact — leaking a secret
  into it turns the finding into an exfiltration vector.
- Mechanism: one paragraph explaining *why* this is a problem, assuming the
  reader is a competent developer
- Remediation: concrete, actionable, with code sketch if non-obvious
- Temporal context: when was this code introduced, how often is it touched
- Chain references: which other findings this enables or is enabled by

**Concern levels are not standard severity labels.** Do not map these to
CVSS, OWASP risk ratings, or generic high/medium/low. They describe the
*nature* of concern, not priority or likelihood:
- `critical` — active exploitability or data loss path exists now
- `significant` — meaningful risk under realistic conditions
- `moderate` — defense-in-depth gap or robustness issue
- `advisory` — not a vulnerability, but a design choice that limits future safety
- `note` — observation worth recording, no action required

### Phase 3: Visualization

Generate SVG components for the rendered report. These are produced as
standalone files in the audit's `assets/` subdirectory and will be
referenced from `index.md`.

Read `templates/terrain-map.svg.md` for the Terrain Map template.
Read `templates/sparkline.svg.md` for the inline sparkline template.

**The Terrain Map** (one per report): A module/component graph showing the
system's structure with finding density overlaid. Nodes are sized by code
volume. Edges show coupling. Finding density appears as a visual weight
(stroke width, not color — this must work in grayscale print).

**Sparklines** (one per finding, optional): Tiny inline SVGs (roughly 80×16px)
showing temporal context — commit frequency near the finding location over
the last 12 months. These appear in the finding's metadata line.

All SVGs must:
- Use only inline `style` attributes (no `<style>` blocks)
- Use no `<foreignObject>`
- Use only web-safe system fonts or no text at all
- Work in GitHub's SVG sanitizer (test with `<img src="...">` embedding)
- Be monochrome or use a maximum 3-color palette from:
  `#1a1a1a` (near-black), `#6b7280` (mid-gray), `#d1d5db` (light-gray),
  `#dc2626` (accent-red, sparingly), `#059669` (accent-green, sparingly)

### Phase 4: Assembly

Render the final report as `index.md` in the audit directory. Read
`references/report-template.md` for the exact structure.

The rendered markdown file is the deliverable. The intermediate YAML files
(`recon.yaml`, `findings.yaml`) persist alongside it — they are the
machine-readable representation for downstream tools (e.g., CI checks, remediation tracking).

**Directory naming convention:**
`record/audits/YYYY-MM-DD-{scope-slug}/` where `{scope-slug}` is a
kebab-case summary of the audit scope (e.g., `full-crate`, `auth-surface`,
`dependency-review`, `pr-237`). The date + slug combination must be unique
within the repository.

**Front matter** (YAML): metadata block with audit date, scope, commit SHA,
agent identity, and a findings summary (counts by concern level, not a
stoplight).

**The Terrain Map**: inlined as an SVG image at the top.

**Narratives**: each narrative is an H2 section. Findings within are H3s.
Code evidence in fenced blocks with file path as info string. Sparklines
inline via `<img>` tags pointing to files in `assets/` (or inlined directly
if the SVG is small enough).

**The Remediation Ledger**: a markdown table at the end, one row per finding,
columns: slug (linked to its narrative anchor), concern level, location,
effort estimate (`trivial | small | medium | large`), chain dependencies.
Grouped by narrative, not by severity.

**Typographic rules for the markdown:**
- H1: report title only (once)
- H2: narrative titles only
- H3: individual findings only
- Bold: first use of a key term in a narrative, never for emphasis
- Blockquotes: used for the "attacker's perspective" voice — a narrative
  device where you describe what an adversary sees/thinks
- Horizontal rules: between narratives only, as breathing room
- Code blocks: evidence only, never decorative, always with file path
- Inline code: identifiers, function names, config keys
- No emoji anywhere in the report
- No HTML tables — use markdown tables only

## Tone

Write as a knowledgeable colleague who has spent time in the codebase and
is now walking the reader through what they found. Not a compliance officer.
Not an auditor performing theater. A peer who respects the author's work and
is precise about where it needs attention.

The "attacker's perspective" blockquotes should read like an internal monologue:
pragmatic, opportunistic, occasionally wry. Not dramatic. Not Hollywood-hacker.

> An expired JWT is still a valid JSON object. If the verification step is
> skipped on error rather than on success, I just need a token that *was*
> valid once.

**When there's nothing wrong, say so.** A clean surface gets a clean
verdict — not filler findings, not hedging, not "consider also." If the
auth layer is tight, say it's tight and move on. The reader's trust in
your findings depends on your willingness to say "this is solid" when it
is. An audit that invents concerns to fill space is performing theater.

## Phase 5: Verification

After assembling the report, spawn the reviewer agent defined in
`agents/reviewer.md` to validate findings against the codebase. The
reviewer checks that evidence exists at cited locations, mechanisms are
accurate, and remediations are sound. It produces a verdict table
(confirmed / adjusted / disputed) for each finding.

If any finding is **disputed**, revise or remove it before delivering
the report. If any finding is **adjusted**, apply the correction.
Findings that are **confirmed** need no changes.

This phase is automatic — do not skip it or ask the user whether to run
it. The reviewer catches evidence rot, line number drift, and misreadings
before the report reaches the reader.

## Phase 6: Remediation Tracking

When remediation actions are taken against findings from an audit, record
them in `actions-taken.md` within the same audit directory. This file is
append-only — each entry records a discrete action with its date, the
findings it addresses, and what was done.

Read `references/actions-taken-schema.md` for the full format.

**When to create/update this file:**
- When the user says they've fixed a finding
- When a PR is merged that addresses audit findings
- When a finding is accepted as a known risk (with rationale)
- When a finding is disputed (with evidence)

Entries are append-only. The directory reconstructs the full finding lifecycle.

**Entry dispositions:**
- `fixed` — code change deployed that resolves the finding
- `mitigated` — compensating control added, finding not fully resolved
- `accepted` — risk accepted with documented rationale
- `disputed` — finding contested with evidence (not the same as ignored)
- `deferred` — acknowledged but scheduled for later (must include a target)

## File Inventory

Each audit lives in its own directory under `record/audits/`:

```
record/audits/YYYY-MM-DD-scope-slug/
├── README.md             # The rendered report (deliverable)
├── recon.yaml            # Structural model (intermediate)
├── findings.yaml         # Structured findings (intermediate)
├── actions-taken.md      # Remediation log (grows over time)
└── assets/               # Generated SVGs
    ├── terrain-map.svg
    └── sparkline-{slug}.svg
```

## Reference Files

Read these before generating output:

- `references/recon-schema.yaml.md` — Full schema for the recon artifact
- `references/findings-schema.yaml.md` — Full schema for the findings artifact
- `references/report-template.md` — Exact markdown structure for the report
- `references/actions-taken-schema.md` — Format for the remediation log
- `templates/terrain-map.svg.md` — SVG generation instructions for the map
- `templates/sparkline.svg.md` — SVG generation instructions for sparklines
- `examples/sample-audit.md` — A complete rendered example report
- `examples/sample-actions-taken.md` — Example remediation log
