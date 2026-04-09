# crustoleum

A structured Rust code review skill for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Thirteen surfaces. Eighty-four binary criteria. Six parallel agents that find the bugs `cargo clippy` told you didn't exist.

## What it catches

Clippy checks syntax. Crustoleum checks *thinking*.

```
cargo clippy   →  "no warnings, ship it"
crustoleum     →  "your unsafe block has no SAFETY comment,
                    your error types are stringly typed,
                    and you're holding a std::sync::Mutex
                    across an await point"
```

The 13 surfaces, briefly:

| # | Surface | The question it answers |
|---|---------|----------------------|
| 1 | Unsafe Code | Can safe API calls trigger undefined behavior (UB)? |
| 2 | Memory Management | Balanced alloc/dealloc? Double-free? |
| 3 | Ownership & Borrowing | Cloning where borrowing suffices? |
| 4 | Lifetimes | Over-specified? Under-bounded? |
| 5 | Error Handling | Can external input cause a panic? |
| 6 | Concurrency | Deadlocks? Locks held across awaits? |
| 7 | Supply Chain | Known vulnerabilities (CVEs)? Banned crates? |
| 8 | FFI (Foreign Function Interface) | Sound boundaries? Correct type mappings? |
| 9 | Trait Design | Cohesive? Object-safe where needed? |
| 10 | Idiomatic Patterns | Iterator abuse? Missing From/Into? |
| 11 | Panic & Program Flow | Process-killing panics in library code? |
| 12 | Performance | Hidden allocations on hot paths? |
| 13 | Dependency Fitness | Pulling a bulldozer to pick a flower? |

Every criterion is binary — pass or fail, with verbatim evidence. No vibes-based "consider also" padding.

## How it works

Crustoleum dispatches six specialist agents in parallel. Each one loads its assigned surfaces, reads tool output from `.crustoleum/`, and returns structured findings.

```
┌─────────────────┐
│  crustoleum      │
│  SKILL.md        │──→ run-tools (clippy, audit, deny, geiger, ...)
│                  │         │
│  Classify code   │         ▼
│  Dispatch agents │    .crustoleum/*.txt
└──┬──┬──┬──┬──┬──┘
   │  │  │  │  │  │
   ▼  ▼  ▼  ▼  ▼  ▼
  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐
  │SA││AT││ER││CC││SC││PF│  ← agents, in parallel
  └──┘└──┘└──┘└──┘└──┘└──┘
   │  │  │  │  │  │
   └──┴──┴──┼──┴──┘
            ▼
      findings.yaml
```

| Agent | Surfaces | When dispatched |
|-------|----------|----------------|
| Safety Auditor | 1, 2 | Code contains `unsafe` |
| API & Type Design | 3, 4, 9, 10 | Always |
| Error & Robustness | 5, 11 | Always |
| Concurrency | 6 | Code uses async/await or threads |
| Supply Chain & Deps | 7, 8, 13 | Always |
| Performance | 12 + cross-refs | Performance-sensitive code |

The Safety Auditor and Concurrency agents run at `effort: ultrathink` (maximum reasoning depth) — they prove the absence of UB and deadlocks, not scan for lint. The rest use standard effort.

## Installation

Crustoleum is a Claude Code skill — a prompt-and-script package that Claude Code loads on demand. Install it by symlinking the skill directory:

```sh
# From your Claude Code skills directory
ln -s /path/to/crustoleum/skills/crustoleum ~/.claude/skills/crustoleum
```

### Tool prerequisites

The skill runs Rust tooling before applying rubrics. Check what you have:

```sh
~/.claude/skills/crustoleum/scripts/check-tools
```

You'll get a table showing what's installed and what's missing. The minimum useful set:

```sh
# The essentials
rustup component add clippy
cargo install cargo-audit cargo-deny cargo-machete cargo-geiger

# For the thorough (nightly required)
rustup toolchain install nightly
rustup component add miri --toolchain nightly
cargo install cargo-udeps cargo-fuzz
```

Miri and the sanitizers are slow. They're worth it. They find the bugs that show up at 3 AM on a holiday weekend — which is when all unsafe bugs prefer to surface.

## Usage

### With cased (recommended)

Crustoleum works best as a domain skill within [cased](https://github.com/claylo/cased). Cased is a code audit framework that renders findings into standalone, single-file HTML reports with flow diagrams, sparklines, and syntax-highlighted evidence.

Ask cased for an audit on a Rust project. It detects `Cargo.toml`, loads crustoleum, and dispatches the agents. You get the full pipeline: tool runs, rubric checks, narrative grouping, and a report you can hand to humans.

```
"Run a cased audit on this crate"
```

That's it. Cased handles the orchestration.

### Standalone

You can also invoke crustoleum directly as a Claude Code skill:

```
"Use the crustoleum skill to review this code"
```

In standalone mode, crustoleum runs the tools, dispatches agents, and returns structured findings in YAML. You get the analysis without the rendered report.

### Choosing which tools to run

The tool runner supports interactive selection (if you have `fzf`), explicit tool lists, or the full suite:

```sh
# Interactive picker
scripts/run-tools

# Specific tools
scripts/run-tools clippy deny geiger

# Everything, including the slow ones
scripts/run-tools --full
```

Output lands in `.crustoleum/` next to your `Cargo.toml`. Add it to `.gitignore` — it's ephemeral analysis data, not a build artifact.

## The rubric

Full criteria live in `references/`:

| Reference file | Surfaces covered |
|---------------|-----------------|
| `unsafe-and-memory.md` | 1, 2 |
| `ownership-and-lifetimes.md` | 3, 4 |
| `error-handling-and-panics.md` | 5, 11 |
| `concurrency.md` | 6 |
| `supply-chain-and-ffi.md` | 7, 8 |
| `traits-and-idioms.md` | 9, 10 |
| `performance.md` | 12 |
| `dependency-fitness.md` | 13 |

Each criterion is tagged with a priority: `[SEC]` > `[BUG]` > `[PERF]` > `[STYLE]`. Security issues that can trigger UB outrank style debates — including the eternal `impl Into<String>` vs `&str` argument.

## Output format

Agents produce findings in [cased's findings schema](references/findings-schema.yaml.md). The output is structured YAML with slugs, concern levels, verbatim evidence, temporal context, and chain references linking related findings.

```yaml
findings:
  - slug: "mutex-held-across-await"
    title: "std::sync::Mutex guard held across .await"
    criterion: "6.2"
    surface: "Concurrency"
    concern: significant
    locations:
      - path: "src/server.rs"
        start_line: 142
        end_line: 158
    evidence: |
      let guard = self.state.lock().unwrap();
      let result = client.fetch(guard.url()).await?;
      // guard is still alive here — blocking the executor
    evidence_lang: rust
    mechanism: "..."
    remediation: "..."
```

Evidence is verbatim source code. No agent-added comments, no `// ...` elisions, no rewording. The renderer displays line numbers starting from `start_line`, so every line must match the actual file. If an agent is wrong about what's on line 142, you'll know immediately.

## License

MIT
