# Codex Tool Mapping for `cased`

The `cased` skill is authored against Claude Code's tool vocabulary
(`Task`, `TodoWrite`, `Skill`, `Read`, `Bash`, etc.). On Codex, those
names do not exist — but the underlying capabilities do. This file
maps cased's instructions to Codex primitives so the skill runs the
same way under `codex exec` as under `claude code`.

If you are a Codex session loading this file, read it end-to-end before
starting an audit. The Phase 2 parallel subagent dispatch **will not
work correctly** without the config flag called out below.

## Prerequisite: enable multi-agent support

Add to `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

Without this flag, `spawn_agent` / `wait` / `close_agent` are not
exposed, and cased's Phase 2 dispatch collapses into a single sequential
context. That is the failure mode that produced the 4-finding "whiff of
an audit" we're trying to fix.

Confirm after editing the config:

```bash
codex agents list-types   # expect at least: default, explorer, worker
```

## Tool mapping

| Skill references | Codex equivalent |
|------------------|------------------|
| `Task` tool (dispatch subagent) | `spawn_agent` (see [Named agent dispatch](#named-agent-dispatch)) |
| Multiple `Task` calls (parallel) | Multiple `spawn_agent` calls issued together |
| `Task` returns result | `wait` (blocks until agent returns) |
| Task completes automatically | `close_agent` to free the concurrency slot |
| `TodoWrite` (task tracking) | `update_plan` |
| `Skill` tool (invoke a skill) | Skills load natively — follow the instructions |
| `Read` / `Write` / `Edit` (files) | Your native file tools |
| `Bash` (run commands) | Your native shell tools |
| `Grep` / `Glob` | Native file-search primitives |

The `agents.max_threads` default is 6, which matches the cased agent
count exactly (security, error-handling, code-quality, completeness,
dependencies, api-design/performance). Leave the default unless an
audit requires more surfaces.

`agents.max_depth` defaults to 1 — fine for cased. The skill does not
nest dispatches.

## Named agent dispatch

Claude Code's `Task` tool accepts a `subagent_type` that maps to a
named agent definition file (for cased: `skills/cased/agents/security.md`,
`skills/cased/agents/error-handling.md`, etc.). Codex does not have a
named-agent registry — `spawn_agent` accepts a type from
`default | explorer | worker` and a free-form `message`.

When a cased instruction says **"Dispatch the security subagent"** or
**"Dispatch agents: security, error-handling, code-quality, completeness,
dependencies"**, do this on Codex:

1. Read the agent definition file (e.g., `skills/cased/agents/security.md`)
2. Extract the evaluation criteria and tool list from the file
3. Fill the dispatch template below with that content plus audit
   context (target repo path, commit SHA, recon summary, finding
   schema pointer)
4. Call `spawn_agent(agent_type="worker", message=<filled template>)`
5. Issue all per-surface spawns together — do not wait between dispatches
6. `wait` for all agents, then `close_agent` for each
7. Parse each returned envelope (see `subagent-output-contract.md` for
   the exact shape). Route on `status` first, then merge the `findings`
   array for DONE / DONE_WITH_PARTIAL_COVERAGE responses into the
   working `findings.yaml` under a narrative keyed by the subagent's
   `surface:` field.

### Dispatch message template

Codex treats the `message` parameter as user-level input, not a system
prompt. Structure it for maximum instruction adherence:

```
Your task is to perform a cased audit surface review. Follow the
instructions below exactly. Do not add scope. Do not summarize the
instructions back to me. Do not ask clarifying questions — if the
information you need is missing, return status NEEDS_CONTEXT.

<audit-context>
target_repo: /absolute/path/to/audited/repo
commit: <full SHA from recon.yaml>
audit_dir: /absolute/path/to/record/audits/YYYY-MM-DD-HH-slug
recon_summary: |
  <2-4 sentences from recon.yaml meta + structure + key hotspots>
findings_schema: /absolute/path/to/skills/cased/references/findings.schema.json
</audit-context>

<agent-instructions>
<!-- Paste the complete content of skills/cased/agents/<role>.md here,
     verbatim. Do NOT ask the agent to go read the file — supply the
     content inline so the worker has everything in its initial context. -->
</agent-instructions>

<output-contract>
Return a YAML document per the envelope defined in
skills/cased/references/subagent-output-contract.md. Shape:

status: DONE | DONE_WITH_PARTIAL_COVERAGE | BLOCKED | NEEDS_CONTEXT
findings: [...]        # present when status is DONE or DONE_WITH_PARTIAL_COVERAGE
coverage_notes: |      # present when status is DONE_WITH_PARTIAL_COVERAGE
  <what you could not cover and why>
blocker: |             # present when status is BLOCKED or NEEDS_CONTEXT
  <what is missing>

Each findings[] entry follows the rubric's surface-specific fields
(criterion prefix, surface name, evidence_lang default) plus the
full finding schema at findings.schema.json. Do NOT emit narrative-
level fields (thesis, verdict, title) at the top level — the
controller writes those after assembling findings from every
dispatched subagent.
</output-contract>

Execute this now. Output ONLY the YAML document described above,
with no surrounding prose.
```

Three framing rules, all load-bearing:

1. **Task-delegation framing.** `"Your task is to perform..."` not
   `"You are a security auditor..."`. Persona framing lets the model
   free-associate; task framing pins it to the instructions.
2. **XML tag wrapping.** Codex workers treat tagged blocks as
   authoritative. Without wrapping, the model sometimes interprets the
   rubric content as conversation and begins negotiating scope.
3. **Explicit execution directive.** `"Execute this now. Output ONLY..."`
   prevents the worker from summarizing the rubric back to the
   controller instead of performing the analysis.

## Status handling

When a dispatched surface agent returns, read the `status` field before
reading `findings`:

- **DONE** — merge `findings[]` into the working `findings.yaml` under
  a narrative keyed by the subagent's `surface:` value, and proceed.
- **DONE_WITH_PARTIAL_COVERAGE** — merge `findings[]` the same way,
  then record the `coverage_notes` entry in the audit directory's
  recon-side log so the reader knows what was not examined. Do NOT
  silently discard partial coverage.
- **BLOCKED** — read `blocker`, decide whether to provide more context
  and re-dispatch (same model), escalate to a more capable model, or
  mark the surface unauditable and note it in the final report.
- **NEEDS_CONTEXT** — provide the requested context in the
  `<audit-context>` block and re-dispatch. Never retry a
  NEEDS_CONTEXT agent with the same message.

Never ignore a non-DONE status. A cased audit that silently drops a
partial-coverage result is indistinguishable from one that never
dispatched the agent in the first place.

For the full contract including examples for each status, see
`subagent-output-contract.md`.

## Parallel dispatch shape

The correct pattern for Phase 2:

```
# Pseudocode — actual tool invocation is harness-specific
plans = [
  spawn_agent(worker, message=security_prompt),
  spawn_agent(worker, message=error_handling_prompt),
  spawn_agent(worker, message=code_quality_prompt),
  spawn_agent(worker, message=completeness_prompt),
  spawn_agent(worker, message=dependencies_prompt),   # if deps present
  spawn_agent(worker, message=api_design_prompt),     # if public API
]
results = [wait(p) for p in plans]
for p in plans: close_agent(p)
```

Issue all `spawn_agent` calls back-to-back *before* the first `wait` —
otherwise the agents run sequentially. The entire Phase 2 wall-clock
time should match the slowest single surface, not the sum of surfaces.

## Environment detection for worktree-using skills

The cased pre-runner writes `recon.yaml` from cargo metadata + git log
in the target repo. Before running the Phase 1 pre-runner, detect
whether Codex is operating in a managed worktree:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` → in a linked worktree. Pre-runner still
  works; just make sure the audit directory is written to the main
  working copy, not the sandbox worktree.
- `BRANCH` empty → detached HEAD. The reviewer subagent (Phase 3b)
  cannot push its verification notes back to the branch from a
  detached sandbox.

## Troubleshooting

**"My Phase 2 dispatched one agent and stopped."**
`multi_agent = true` is probably not set. Check `~/.codex/config.toml`
and re-run `codex agents list-types`.

**"Agents return prose summaries instead of YAML."**
The execution directive at the end of the dispatch template is missing
or paraphrased. Keep it verbatim: `"Execute this now. Output ONLY the
YAML fragment..."`.

**"Agents ask the controller for clarification mid-task."**
The `NEEDS_CONTEXT` status is for that — don't let the worker engage
in conversation. Make sure the `<audit-context>` block was populated
before dispatch.

**"`cargo audit` / `cargo deny` output was available to my controller
but the agents don't see it."**
Controller context does not propagate to workers. Either pre-compute
the scan outputs into the audit directory and cite them in
`<audit-context>`, or have each agent re-run its own scoped tool.
