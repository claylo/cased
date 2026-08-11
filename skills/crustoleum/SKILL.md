---
name: crustoleum
description: A comprehensive Rust code review skill. Use when reviewing Rust code for safety, correctness, performance, and idiomatic quality. Provides 14 evaluation surfaces with binary criteria that go beyond what cargo clippy, cargo audit, and other static tools catch — ownership model analysis, unsafe soundness reasoning, error type architecture, concurrency design, and non-obvious performance costs.
---

# Rust Code Review Rubrics

**Run tools first, then apply rubrics.** The rubrics assume a clean tool baseline.

## Tooling Prerequisites

Run these before applying any rubric surface. Findings from tools are inputs to
the rubric evaluation, not replacements for it.

Run `${CLAUDE_SKILL_DIR}/scripts/check-tools` now and read its output before
applying any rubric.

Tools that fail = immediate findings. Tools that pass = green light to apply
judgment rubrics.

## Task Runners Before Bare Cargo

Before running ANY cargo tool directly, check for a project task runner:
`Justfile`/`justfile` (list recipes with `just --list`), `Makefile`,
`Makefile.toml` (cargo-make), and `.cargo/config.toml` aliases.

If a recipe wraps the tool you need (`just deny`, `just audit`,
`just lint`), invoke the recipe — it carries the project's config paths
and invocation preferences. A bare `cargo deny check` skips the
project's `deny.toml` discovery and tuned flags, and reports findings
the project has already dispatched. Those false positives destroy
report credibility.

- `${CLAUDE_SKILL_DIR}/scripts/run-tools` is the sanctioned path for
  the tool catalog — it discovers `deny.toml` in `.config/` and the
  project root. Use it; do not hand-run its tools "to be quick."
- The rule covers everything OUTSIDE run-tools too: ad-hoc verification
  runs, `cargo tree`, re-running a single tool to confirm a finding.
  Recipe first, bare cargo only when no recipe covers it.
- When dispatching agents, include the discovered recipes in their
  context so they follow the same rule.

"A quick bare run is faster" — it is also wrong.

## The 14 Surfaces

Each surface is a coherent concern area with a thesis, binary criteria, and
priority tags. Criteria are in the reference files — load the relevant surface
for the code under review.

| # | Surface | Criteria | Priority Focus | Reference |
|---|---------|----------|---------------|-----------|
| 1 | **Unsafe Code** | 8 | SEC | `${CLAUDE_SKILL_DIR}/references/unsafe-and-memory.md` |
| 2 | **Memory Management** | 6 | SEC/PERF | `${CLAUDE_SKILL_DIR}/references/unsafe-and-memory.md` |
| 3 | **Ownership & Borrowing** | 5 | PERF/BUG | `${CLAUDE_SKILL_DIR}/references/ownership-and-lifetimes.md` |
| 4 | **Lifetimes** | 4 | BUG/STYLE | `${CLAUDE_SKILL_DIR}/references/ownership-and-lifetimes.md` |
| 5 | **Error Handling** | 7 | SEC/BUG | `${CLAUDE_SKILL_DIR}/references/error-handling-and-panics.md` |
| 6 | **Concurrency** | 6 | SEC/BUG | `${CLAUDE_SKILL_DIR}/references/concurrency.md` |
| 7 | **Supply Chain** | 6 | SEC/PERF | `${CLAUDE_SKILL_DIR}/references/supply-chain-and-ffi.md` |
| 8 | **FFI** | 5 | SEC | `${CLAUDE_SKILL_DIR}/references/supply-chain-and-ffi.md` |
| 9 | **Trait Design** | 5 | PERF/STYLE | `${CLAUDE_SKILL_DIR}/references/traits-and-idioms.md` |
| 10 | **Idiomatic Patterns** | 6 | PERF/STYLE | `${CLAUDE_SKILL_DIR}/references/traits-and-idioms.md` |
| 11 | **Panic & Program Flow** | 5 | SEC/BUG | `${CLAUDE_SKILL_DIR}/references/error-handling-and-panics.md` |
| 12 | **Performance** | 12 | PERF | `${CLAUDE_SKILL_DIR}/references/performance.md` |
| 13 | **Dependency Fitness** | 9 | PERF/SEC | `${CLAUDE_SKILL_DIR}/references/dependency-fitness.md` |
| 14 | **Feature Completeness** | 5 | BUG/SEC | `${CLAUDE_SKILL_DIR}/agents/completeness.md` |

**Total: 89 criteria across 14 surfaces.**

## Priority Tags

`[SEC]` > `[BUG]` > `[PERF]` > `[STYLE]`

## Evaluation Method

1. **Select and run tools.** Before executing, present the tool catalog below
   and ask the user which tools to run. Pass their selection as arguments to
   `${CLAUDE_SKILL_DIR}/scripts/run-tools`. If the user says "all" or "full",
   pass `--full`. If they accept defaults, run with no tool arguments.

   **Tool catalog** (default set marked with `*`):

   | Tool | Default | What It Checks |
   |------|:-------:|----------------|
   | clippy | * | 800+ lints: correctness, perf, style |
   | audit | * | Known CVEs in dependencies (RustSec) |
   | deny | * | Advisories + licenses + banned crates |
   | machete | * | Unused dependencies (heuristic) |
   | geiger | * | Unsafe code census across dep tree |
   | udeps | * | Unused declared dependencies (nightly) |
   | miri | | UB detection in pure code (nightly, slow) |
   | asan | | Buffer overflow, use-after-free (nightly, slow) |
   | tsan | | Data races (nightly, slow) |

   Example: `${CLAUDE_SKILL_DIR}/scripts/run-tools clippy deny geiger`

   Findings land in `.crustoleum/*.txt`.
2. **Identify applicable surfaces.** Not all 14 apply to every review:
   - No unsafe code? Skip Surfaces 1, 8.
   - No async? Surface 6 partially applies.
   - Binary, not library? Surface 9 is less relevant.
3. **For each applicable surface:** Load the reference file. Evaluate each
   criterion as pass/fail with evidence (verbatim code quote or concrete
   observation).
4. **Classify failures by concern level:**

| Concern | What It Means | Example Criteria |
|---------|--------------|-----------------|
| **Critical** | Active UB or exploitability | Aliasing violations, FFI type mismatch, panic across FFI |
| **Significant** | Meaningful risk under realistic conditions | Missing SAFETY docs, unwrap on external input, no cargo-audit |
| **Moderate** | Robustness gaps | Unbalanced into_raw/from_raw, silent Result discard |
| **Advisory** | Design choices limiting future safety | Over-specified lifetimes, missing typed errors |
| **Note** | Observations worth recording | Style preferences, minor perf opportunities |

## Surface Selection Guide

| If the code... | Prioritize these surfaces |
|----------------|-------------------------|
| Contains `unsafe` blocks | 1 (Unsafe), 2 (Memory) |
| Is a library with public API | 5 (Errors), 9 (Traits), 3 (Ownership) |
| Uses async/await or threads | 6 (Concurrency) |
| Has FFI / C interop | 8 (FFI), 1 (Unsafe) |
| Has many dependencies | 7 (Supply Chain), 13 (Dependency Fitness) |
| Is performance-sensitive | 12 (Performance), 2 (Memory), 3 (Ownership) |
| Is application code | 5 (Errors), 11 (Panics), 10 (Idioms) |
| Has heavyweight deps or slow builds | 13 (Dependency Fitness) |

## Output Discipline

During a review, perform mechanical operations silently. Use bracketed
notation for actions that don't need user attention:

```
[Run tools: cargo clippy, cargo audit, cargo deny]
[Classify codebase — unsafe blocks, FFI, async]
[Dispatch 7 agents in parallel]
[Waiting for all agents to return]
```

**What to say out loud:**
- Tool selection and run confirmation
- Agent dispatch summary: "Dispatching 7 agents in parallel."
- Blocked or failed agents
- Phase completion with finding counts

**What to do silently (bracket notation):**
- Reading files, running commands, gathering tool output
- Classifying the codebase for agent dispatch
- Individual agent dispatch mechanics
- Waiting for agents
- Collecting and deduplicating agent output

Do not narrate what you are reading, what you found in each file, or
what each agent is doing as it works. The report is the deliverable,
not the commentary.

**Division of labor:** During agent dispatch, you are a dispatcher,
not an analyst. Do NOT read project source files yourself — that is
what the agents do. Your job is to run tools, classify the codebase
from tool output and Cargo.toml, dispatch agents, wait for results,
and assemble findings. If you find yourself reading `.rs` source
files during dispatch, you are doing the agents' work and wasting
tokens.

## Running a Full Review (Subagent Dispatch)

For a comprehensive review, dispatch seven specialized agents in parallel.
Each agent loads only its assigned surfaces, keeping context focused.

**Step 1: Select and run tools** (before dispatching agents).
Ask the user which tools to run using the catalog in the Evaluation Method
section above. For a comprehensive review, recommend `--full` but let the
user decide.

```bash
${CLAUDE_SKILL_DIR}/scripts/run-tools [--full | tool ...]
```

Output lands in `.crustoleum/` — one `.txt` per tool plus `summary.md`.
Agents receive their relevant tool output files as input context.

**Step 2: Classify the codebase** to determine which agents to dispatch:
- `completeness` always runs.
- Has `unsafe` blocks? → `safety-auditor`
- Has `extern "C"` / FFI? → `supply-chain-deps` (includes FFI surface)
- Has async/await or threads? → `concurrency-reviewer`
- Skip agents whose surfaces don't apply.

**Step 3: Dispatch agents in parallel.**

Agent definitions are in `${CLAUDE_SKILL_DIR}/agents/`. Each agent has its own surfaces,
persona, and instructions for consuming tool output from `.crustoleum/`.

| Agent | Surfaces | Definition |
|-------|----------|------------|
| **Safety Auditor** | 1, 2 | `${CLAUDE_SKILL_DIR}/agents/safety-auditor.md` |
| **API & Type Design** | 3, 4, 9, 10 | `${CLAUDE_SKILL_DIR}/agents/api-type-design.md` |
| **Error & Robustness** | 5, 11 | `${CLAUDE_SKILL_DIR}/agents/error-robustness.md` |
| **Concurrency** | 6 | `${CLAUDE_SKILL_DIR}/agents/concurrency.md` |
| **Supply Chain & Deps** | 7, 8, 13 | `${CLAUDE_SKILL_DIR}/agents/supply-chain-deps.md` |
| **Performance** | 12 + [PERF] cross-refs | `${CLAUDE_SKILL_DIR}/agents/performance.md` |
| **Completeness** | 14 | `${CLAUDE_SKILL_DIR}/agents/completeness.md` |

**Step 4: Synthesize findings.** Collect all agent results. Deduplicate
(multiple agents may flag the same code from different angles). Present
findings ordered by concern level: critical first, notes last.

For a **focused review** (single surface), skip the dispatch — load the
relevant reference file directly and evaluate inline.

## Further Reading

- `${CLAUDE_SKILL_DIR}/references/source-guide.md` — Annotated bibliography of authoritative Rust
  sources (Rustonomicon, ANSSI guide, RustSec, API Guidelines, Perf Book)
- Individual surface files contain full criteria with evidence requirements
  and references to primary sources
