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

1. **Full repo** — all source, dependencies, and configuration
2. **Recent changes** — highest-risk and recently modified surfaces only
3. **Specific area** — a module, directory, PR, or commit range the user names

If the user's initial request already specifies scope (e.g., "audit the auth
module," "review PR #42"), skip the question and use what they gave you.

## Output Rules

Reports follow Tufte's principles: high data-ink ratio, no chartjunk,
smallest effective difference, annotations over appendices.

- **Narratives, not lists.** Group findings into attack stories, not numbered catalogs.
- **Density encodes severity.** More severe findings get more context. No stoplight charts.
- **Evidence inline.** Code appears with the finding, never in a separate appendix.

## Workflow

The audit proceeds in five phases. Each phase produces a concrete artifact.

### Phase 1: Reconnaissance

Build the structural model of the codebase. Produce `recon.yaml` in the
audit directory (see File Inventory for the full path convention) containing:

- File tree with line counts and last-modified dates
- Dependency graph (imports/requires between internal modules)
- Entry points (HTTP handlers, CLI commands, main functions, exported APIs)
- Dependency manifest (external deps with versions and ages)
- Git churn data: files by commit frequency, recent authors, hotspots
- Auth/trust boundaries identified

Read `${CLAUDE_SKILL_DIR}/references/recon-schema.yaml.md` for the full schema.

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
`${CLAUDE_SKILL_DIR}/references/findings-schema.yaml.md`.

**Domain-specific review skills:** Before starting analysis, check if a
specialized review skill is available for the primary language. These skills
provide structured evaluation rubrics with binary criteria that go beyond
what linters and static tools catch. If available, use the skill's surfaces
as the narrative framework and dispatch its agents for parallel review.

| Language | Skill | Detection | What it adds |
|----------|-------|-----------|-------------|
| Rust | `crustoleum` | `Cargo.toml` present | 13 surfaces, 84 criteria, 6 parallel agents. Covers unsafe soundness, ownership model, error architecture, concurrency, supply chain, and performance. |

When a domain skill is present:
1. Load the skill (`skill: crustoleum`) to get the full rubric.
2. Run the skill's tool prerequisites (e.g., `${CLAUDE_SKILL_DIR}/scripts/run-tools --full`).
3. Classify the codebase using the skill's surface selection guide to
   determine which agents to dispatch.
4. Dispatch the skill's agents in parallel. Each agent returns findings
   in cased's `findings.yaml` schema.
5. **Wait for ALL agents to complete.** Do not proceed to findings
   assembly until every dispatched agent has returned. The agents ARE
   the analysis — you do not have "sufficient data from direct code
   reading" to substitute for their structured rubric evaluation.
   If an agent is slow, wait. If an agent fails, report the failure.
   Never skip agent results to save time.
6. Collect agent output, deduplicate, and organize into narratives.
   Each surface becomes a narrative. The skill's `surface` field maps
   to the narrative title (e.g., surface "Unsafe Code" → narrative
   "The Unsafe Code Surface").
7. Write the thesis and verdict for each narrative based on the
   collected findings — these are your assessment, not the agents'.

When no domain skill is present, dispatch the built-in analysis agents:

1. Classify the codebase to determine which agents to dispatch:
   - `security`, `error-handling`, and `code-quality` always apply.
   - Has external dependencies (package.json, Cargo.toml, go.mod, etc.)? → `dependencies`
   - Exposes a public API (library, HTTP endpoints, CLI)? → `api-design`
   - Performance-sensitive or has hot paths? → `performance`
2. Dispatch applicable agents in parallel. Each agent returns findings
   in cased's `findings.yaml` schema.
3. **Wait for ALL agents to complete.** Same rules as domain skill
   dispatch — agents ARE the analysis. Do not proceed until all return.
4. Collect agent output, deduplicate, and organize into narratives.

| Agent | Surface | When to Dispatch | Definition |
|-------|---------|-----------------|------------|
| **Security** | Injection, auth, secrets, input validation | Always | `${CLAUDE_SKILL_DIR}/agents/security.md` |
| **Error Handling** | Error paths, silent failures, crash risks | Always | `${CLAUDE_SKILL_DIR}/agents/error-handling.md` |
| **Code Quality** | Complexity, duplication, dead code, test gaps | Always | `${CLAUDE_SKILL_DIR}/agents/code-quality.md` |
| **Performance** | Algorithmic complexity, resource leaks, hot paths | Performance-sensitive code or large codebases | `${CLAUDE_SKILL_DIR}/agents/performance.md` |
| **API Design** | Public API surface, naming, contracts | Libraries, HTTP APIs, CLIs | `${CLAUDE_SKILL_DIR}/agents/api-design.md` |
| **Dependencies** | Outdated versions, advisories, license risks | External deps present | `${CLAUDE_SKILL_DIR}/agents/dependencies.md` |

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
- Evidence: **verbatim code** copied from the file at the cited location.
  The evidence field is rendered with line numbers starting from `start_line`,
  so every line must correspond exactly to the actual source file. The reader
  will check your evidence against the real code — any mismatch destroys
  credibility.
  **Do not** add comments, annotations, or explanatory text inside the
  evidence. Use `evidence_markers` to highlight or label specific lines —
  markers render as visual annotations alongside the code, not as edits
  to it.
  **Do not** elide code with `// ...` or similar placeholders. Elision
  breaks line numbering because the renderer counts every line. If the
  relevant code is too long, narrow the `start_line`/`end_line` range to
  show only the lines that matter. Two separate evidence blocks (two
  locations) are better than one block with a gap.
  **Redaction rule:** If evidence contains secrets (API keys, tokens,
  passwords, private keys, connection strings), replace the literal value
  with a placeholder like `REDACTED_API_KEY` or `<token>`. Cite the file
  and line so the reader can verify, but never reproduce the secret in the
  report.
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

**Flow diagrams** are authored as data in `findings.yaml` and rendered
automatically by the build script. Add a `flow` array to any narrative
where findings attach to steps in a process — authentication flows,
request pipelines, data validation chains, build/deploy sequences.

How to build a flow:
1. Identify the spine — the happy-path steps in order.
2. Mark the first step `type: start` and the last `type: end`.
3. Use `type: decision` for branching points (yes/no).
4. Attach findings to steps with `findings: [slug]`. Use the object
   form `findings: [{slug, label}]` when the finding title is too long
   for the diagram (keep labels under ~20 characters).
5. For decision branches, add `no: step-id` to point at the rejection
   path. The off-spine target step needs `spine: false`.
6. For loops, add `next: step-id` on the off-spine step to create a
   loop-back arrow to an earlier spine step.

See `${CLAUDE_SKILL_DIR}/references/findings-schema.yaml.md` for the
full flow schema.

**Sparklines** are generated automatically by the build script from the
`temporal.monthly_commits` field. Populate this 12-integer array during
analysis — no SVG generation is needed.

### Phase 3: Verification

After writing `findings.yaml`, spawn the `cased:audit-reviewer` agent
defined in `${CLAUDE_SKILL_DIR}/agents/reviewer.md` to validate findings
against the codebase. The reviewer checks that evidence exists at cited
locations, mechanisms are accurate, and remediations are sound. It produces
a verdict table (confirmed / adjusted / disputed) for each finding.

If any finding is **disputed**, revise or remove it. If any finding is
**adjusted**, apply the correction. Findings that are **confirmed** need
no changes.

This phase is automatic — do not skip it or ask the user whether to run
it. The reviewer catches evidence rot, line number drift, and misreadings
before the report is built. Verification runs before assembly so that
disputed findings are resolved once, not rendered twice.

### Phase 4: Assembly

After verification, generate the HTML report:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/build-report.js" <audit-directory>
```

This produces `report.html` in the audit directory �� an interactive,
presentation-ready report with flow diagrams, syntax-highlighted evidence,
and slide mode. The HTML report is the primary deliverable. The markdown
`index.md` is a secondary output for GitHub rendering.

The intermediate YAML files (`recon.yaml`, `findings.yaml`) persist
alongside it — they are the machine-readable representation for downstream
tools (e.g., CI checks, remediation tracking).

**Directory naming convention:**
`record/audits/YYYY-MM-DD-{scope-slug}/` where `{scope-slug}` is a
kebab-case summary of the audit scope (e.g., `full-crate`, `auth-surface`,
`dependency-review`, `pr-237`). The date + slug combination must be unique
within the repository.

**Front matter** (YAML): metadata block with audit date, scope, commit SHA,
agent identity, and a findings summary (counts by concern level, not a
stoplight).

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

## Phase 5: Remediation Tracking

When remediation actions are taken against findings from an audit, record
them in `actions-taken.md` within the same audit directory. This file is
append-only — each entry records a discrete action with its date, the
findings it addresses, and what was done.

DO NOT create an empty/blank `actions-taken.md` file until a user says something
like "let's resolve issues from the latest audit" or "let's work on findings from
the last cased audit."

Read `${CLAUDE_SKILL_DIR}/references/actions-taken-schema.md` for the full format.

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
└── assets/               # Generated by build script
    └── sparkline-{slug}.svg
```

## Reference Files

Read these before generating output:

- `${CLAUDE_SKILL_DIR}/references/recon-schema.yaml.md` — Full schema for the recon artifact
- `${CLAUDE_SKILL_DIR}/references/findings-schema.yaml.md` — Full schema for the findings artifact
- `${CLAUDE_SKILL_DIR}/references/report-template.md` — Exact markdown structure for the report
- `${CLAUDE_SKILL_DIR}/references/actions-taken-schema.md` — Format for the remediation log
- `${CLAUDE_SKILL_DIR}/examples/sample-audit.md` — A complete rendered example report
- `${CLAUDE_SKILL_DIR}/examples/sample-actions-taken.md` — Example remediation log
