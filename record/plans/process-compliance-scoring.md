# Process-compliance scoring for evals

**Status:** planned. Captured 2026-08-10 after the first eval matrix runs.

## Why

The eval scorer measures *outcomes* (recall, false positives, calibration,
hygiene). It cannot see *process* — and every audit failure we've caught in
the wild was a process failure first:

- Agents running bare `cargo deny` instead of the project's justfile
  recipe, skipping tuned config (observed on crustoleum reviews; fixed
  with instructions, unverified at scale).
- Reviewer agents dumping `review-N.md` files instead of returning
  results in their final message (observed on Opus 5 audits; now measured
  post-hoc via the stray-file diff, but not attributed to which agent).
- Phase 2 parallel dispatch silently collapsing to sequential analysis
  (the primary failure mode the skill's dispatch instructions exist to
  prevent — currently unmeasurable).

## Mechanism

Run the eval with structured event output instead of prose transcripts:

- **Claude Code:** `claude -p --output-format stream-json` emits per-event
  records: tool calls with full inputs, subagent dispatches, file writes.
  (`--output-format text` is pinned in run-eval today; stream-json becomes
  a second transcript artifact, not a replacement — keep the human-readable
  one.)
- **Codex:** verify the counterpart (`codex exec --json` or equivalent
  event log) when wiring; do not assume symmetry.

A post-run analyzer walks the event stream and scores binary checks:

| Check | Signal in event stream |
|---|---|
| Task-runner compliance | No `Bash` input matching bare `cargo (deny\|audit\|clippy)` / `npm audit` when the fixture has a matching recipe |
| Parallel dispatch | All Phase 2 `Task` dispatches issued before the first wait; count ≥ expected for the fixture's surface set |
| Dispatcher discipline | Orchestrator issues no `Read` on fixture source files during Phase 2 |
| Hygiene attribution | `Write`/`Edit` targets outside sanctioned paths, attributed to the specific agent |
| No test execution | No `cargo test`/`npm test` invocations (audits are static analysis) |
| Intermediates immutable | No `Edit`/`Write` on `recon.yaml` after the pre-runner emits it, or on `findings.yaml` after validation passes — observed live: codex hand-groomed generated recon post-assembly (prettified scope, relativized paths), breaking provenance even where the edits looked like improvements |

Results land in `score.json` as a `process` block alongside the findings
metrics, and `compare-runs` grows columns for them — process compliance is
exactly the axis where models/platforms will diverge most.

## Shape of the work

1. `run-eval`: add a second output stream (`events.jsonl`) on platforms
   that support it; keep `transcript.txt`.
2. `evals/scripts/score-process.mjs`: event-stream walker with the checks
   above; per-fixture expectations (expected agent count, recipe names)
   live in `expected-findings.yaml` under a new `process:` key.
3. Unit tests from canned event streams — no live runs needed to develop.
4. `compare-runs` picks up the `process` block automatically.

## Open questions

- Event schema stability: stream-json is a CLI contract, not a spec —
  pin what we depend on and fail soft when fields move.
- Subagent attribution: whether stream-json exposes per-subagent tool
  events or only the orchestrator's; if opaque, hygiene attribution
  degrades to the current post-hoc diff.
- Codex event fidelity vs Claude's — the checks may need per-platform
  capability flags (the axe capability-matrix pattern, in miniature).
- `codex exec` fully buffers stdout when piped (observed live: empty
  transcript 10 minutes into a run) — live progress and incremental
  event capture need `stdbuf`, a PTY, or the JSON event stream written
  to a file. Also observed: codex redirected the cargo target dir into
  `.crustoleum/target/` unprompted — platform-specific behaviors like
  this are what per-run event streams will attribute.
- Hermeticity. A live codex run was observed surfacing past cased
  audits of other repos (librebar, bito) from user-level memory/MCP
  config; run-eval now passes `--ephemeral --ignore-user-config` on
  codex. The claude path has the same class of leak unaddressed:
  `~/.claude/CLAUDE.md` and user-level context load into every run.
  Acceptable while all runs share one machine; a cross-machine matrix
  needs an equivalent isolation story (e.g., scoped CLAUDE_CONFIG_DIR).
  The workdir sits inside the cased repo tree — its own git init
  contains project-doc discovery, but tree-walk behaviors differ per
  platform and deserve a check in the event stream.
