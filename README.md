# cased

Structured code audits for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Anthropic's agentic coding tool. Ask for an audit, get a report you'd hand to a VP of Engineering. Flow diagrams. Sparklines. Evidence inline. No stoplight charts.

## What it produces

```
record/audits/2026-04-08-full-crate/
├── recon.yaml        # structural model of the codebase
├── findings.yaml     # structured findings (machine-readable)
├── report.html       # interactive HTML report (the deliverable)
└── assets/           # sparkline SVGs, generated at build time
```

The HTML report is a single self-contained file. Open it in a browser. Present it in a meeting. The YAML files are the machine-readable layer for downstream tools, CI checks, and remediation tracking.

## How it works

```
"Run a cased audit on this repo"
```

Cased runs in four phases:

1. **Recon** — maps the codebase: file tree, entry points, dependency graph, git churn, trust boundaries. Writes `recon.yaml`.
2. **Analysis** — dispatches parallel agents against structured criteria. Each agent returns findings in a shared schema. Writes `findings.yaml`.
3. **Verification** — a reviewer agent checks that evidence exists at cited locations and remediations are sound. Disputed findings get revised or removed before the report is built.
4. **Assembly** — renders the verified findings into a single-file HTML report with highlighted evidence, flow diagrams, sparklines, and slide mode.

### Parallel agents

Cased dispatches specialist agents based on what it finds in the codebase:

**With a domain skill** (e.g., [crustoleum](https://github.com/claylo/crustoleum) for Rust):

| Agent | What it evaluates |
|-------|------------------|
| Safety Auditor | Unsafe soundness, memory management |
| API & Type Design | Ownership, lifetimes, trait design, idioms |
| Error & Robustness | Error handling paths, panic risks |
| Concurrency | Lock ordering, async/sync interactions |
| Supply Chain & Deps | CVEs, FFI boundaries, dependency fitness |
| Performance | Allocations, copying, monomorphization costs |

**Without a domain skill** (any language):

| Agent | What it evaluates |
|-------|------------------|
| Security | Injection, auth bypass, secrets, input validation |
| Error Handling | Silent failures, crash risks, error context |
| Code Quality | Complexity, duplication, dead code, test gaps |
| Performance | Algorithmic complexity, resource leaks, hot paths |
| API Design | Public surface consistency, naming, contracts |
| Dependencies | Outdated versions, advisories, license risks |

Domain skills go deeper — crustoleum brings 84 binary criteria across 13 surfaces. The generic agents cover the fundamentals for any codebase.

## Design principles

Reports follow [Edward Tufte's](https://www.edwardtufte.com/) principles:

- **Narratives, not lists.** Findings group into stories about attack surfaces — "The Auth Surface," "The Error Handling Surface" — not numbered catalogs sorted by severity.
- **Evidence inline.** Code appears with the finding. No appendices. The code is right there, with line numbers matching the source file.
- **Density encodes severity.** Critical findings get more context. Notes get a sentence. Nothing looks the same weight.
- **Sparklines over dashboards.** Twelve months of commit activity in a tiny SVG next to each finding. See the trend without leaving the story.

## Installation

Cased is a Claude Code skill — a prompt-and-script package that Claude Code loads on demand.

```sh
npx @anthropic-ai/claude-code-skill install claylo/cased
```

Or install manually:

```sh
git clone https://github.com/claylo/cased.git
ln -s /path/to/cased/skills/cased ~/.claude/skills/cased
```

The HTML report renderer ships pre-built in the skill directory. No build step required.

## Usage

### Full audit

```
"Run a cased audit on this repo"
```

Cased will ask what to focus on: full repo, recent changes, or a specific area. If your request already specifies scope ("audit the auth module"), it skips the question.

### Scoped audit

```
"Audit the authentication module"
"Review PR #42"
"Evaluate the dependency tree"
```

### After the audit

Reports live in `record/audits/YYYY-MM-DD-scope-slug/`. Open `report.html` for the interactive version. The report includes:

- **Slide mode** — press S to present findings one at a time
- **Navigation** — click a finding in the nav bar to jump to it
- **Flow diagrams** — visual process flows with findings pinned to steps
- **Sparklines** — 12-month commit activity for each finding's file

### Remediation tracking

After fixing findings, record what you did:

```
"Let's resolve issues from the latest audit"
```

Cased appends entries to `actions-taken.md` in the audit directory. Each entry records the date, which findings it addresses, and the disposition: `fixed`, `mitigated`, `accepted`, `disputed`, or `deferred`.

## Extending with domain skills

Domain skills plug into the analysis phase. They bring rubrics, agents, and tool setups for a specific language.

| Language | Skill | What it adds |
|----------|-------|-------------|
| Rust | [crustoleum](https://github.com/claylo/crustoleum) | 13 surfaces, 84 criteria, cargo tooling (clippy, audit, deny, geiger, miri, sanitizers) |

To add a domain skill, install it as a Claude Code skill. Cased detects it by looking for language markers (`Cargo.toml`, `package.json`, etc.) and loads the skill's rubric when it finds a match.

## The findings schema

All agents produce output in the same format. The schema lives in `skills/cased/references/findings-schema.yaml.md` with a JSON Schema at `skills/cased/references/findings.schema.json`.

Key fields per finding:

| Field | What it is |
|-------|-----------|
| `slug` | Kebab-case identifier (`auth-token-no-expiry`) |
| `concern` | `critical`, `significant`, `moderate`, `advisory`, or `note` |
| `locations` | File path + `start_line` / `end_line` |
| `evidence` | Verbatim source code — no added comments, no elisions |
| `mechanism` | Why this is a problem |
| `remediation` | How to fix it |
| `temporal` | When introduced, last modified, 12-month commit sparkline |
| `chains` | Which findings this enables or is enabled by |

Concern levels are not severity ratings. They describe the *nature* of concern:

| Level | Meaning |
|-------|---------|
| `critical` | Active exploitability or data loss path exists now |
| `significant` | Meaningful risk under realistic conditions |
| `moderate` | Defense-in-depth gap or robustness issue |
| `advisory` | Design choice that limits future safety |
| `note` | Observation worth recording, no action required |

## Tone

Reports read like a knowledgeable colleague walking you through what they found. Not a compliance officer. Not an auditor filling a checklist. When a surface is solid, the report says so and moves on. An audit that invents concerns to fill space is wasting your time.

## Development

If you're modifying the HTML report viewer, rebuild it from source:

```sh
# Requires Node.js and just (https://just.systems)
npm install
just build-viewer
```

This bundles the viewer JS and copies the built assets into `skills/cased/`.

## License

MIT
