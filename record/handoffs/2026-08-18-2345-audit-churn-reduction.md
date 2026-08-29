# Handoff: audit churn reduction — contract, gates, remediation contract, evals

**Session:** 2026-08-18 afternoon → late night. Branch `audit-churn-reduction`
(24 commits on top of main @356cee1, 84 files, +6810/−232). **Not merged, not
pushed.** All gates green: `just test` 114/114, `check-contract`,
`check-bundle`, `build-smoke`.

## Why

`record/research/2026-08-18-yamalgam-audit-churn.md` — five research agents
over 27 yamalgam audits (426 findings, 314 ledger entries, 329 fix commits).
Verdict: "hasty agents broke the stack" was true only in bounded cases; the
churn was contract-shaped — no termination rule, no memory across audits,
no causation field, point findings not class sweeps, 0.7% pushback,
unrecorded scope, and a remediation loop of "read → change → log". Plan:
`record/superpowers/plans/2026-08-18-audit-churn-reduction.md` (16 tasks,
executed via subagent-driven development; SDD ledger with every ruling at
`.superpowers/sdd/2026-08-18-audit-churn-reduction/progress.md` — gitignored,
still on disk).

## What shipped

**Contract (`src/schemas/`, stamped into both skills)**
- findings: per-finding `origin {kind: pre-existing|new-in-diff|caused-by-fix|recurrence-of, ref}` (ref required for the causal kinds via `if/then`), `failure_mode {user-visible|internal|policy|documentation}`; top-level `carried_forward[]` (deferred/accepted/mitigated/no-measurable-benefit — NOT escalated) and `reconciliation[]` (still-fixed/regressed/superseded/not-verified; `still-fixed` even when the fix caused a new defect — that finding carries `caused-by-fix`).
- recon: `meta.audit_profile` REQUIRED (mode, prior_audit, model, effort, agent_count, surfaces, severity_floor, excluded_tools, skill_versions; optional `release_phase`). Pre-runner stubs it (`model: unknown`, `agent_count: 0`, `surfaces: []`), controller must complete it. Pre-runner excludes `record/audits` and `*.html` from tokei/git. Old recon.yaml files fail `validate` on this — do not retrofit.

**Gates (`src/viewer/`, bundled to `skills/cased/scripts/build-report.js`)**
- `prior-audits.mjs`: `findPriorAudits`, `parseLedger`, `latestDispositions`.
- `gates.mjs`: `checkEvidenceFidelity` (mechanical — replaces ~70% of what the LLM reviewer used to do), `checkReadmeComplete`, `checkAuditProfile`, `isBlocking` (critical/significant + user-visible; missing failure_mode defaults to user-visible), `lintLedger` (front-matter arithmetic, required fields per disposition, **Blast radius is an error**, Coverage lost warns, diff budget vs effort → suggests `escalated`, deferred targets, trailers via git).
- `build-report.js validate | build | evidence | ledger | finalize [--allow-unledgered-prior]`. `finalize` refuses: scaffold README, stub audit_profile, evidence drift, missing origin.ref, unledgered prior audit, re-audit without reconciliation, regressed rows without a `recurrence-of` finding, ledger errors.
- Report: Blocking vs Backlog split in ledger + header; README scaffold + AGENTS.md carry reconciliation table, carried-forward list, blocking/backlog counts, mode, workspace test command, release phase, prior audits.

**Skill prose**
- `SKILL.md`: re-audit mode (ingest prior ledgers → carried_forward; ledgered fixes → `<audit-context>` `ledgered_fixes:`; reconciliation), audit_profile completion, Phase 3a′ evidence gate, adversarial 3b (apply `concern_override`, delete disputed), Phase 4 `finalize` gate, **"When to stop auditing"** termination rule (frozen surfaces, zero blocking, 0 regressed/caused-by-fix, commit ≥12h old, no fix commits during the pass), scratch policy (`/private/tmp/cased/<audit-id>/`), Phase 5 → `ledger` subcommand.
- `subagent-output-contract.md`: origin/failure_mode, **class sweep** (one finding, N locations; evidence = ranges concatenated in order), scratch files, `<audit-context>` fields incl. `mode/prior_audit/ledgered_fixes/release_phase` (also in `codex-tools.md`).
- `agents/reviewer.md`: adversarial (`mechanism_verified`, `concern_override`, default-to-disputed if untraced); 14 analysis agents (cased 7 + crustoleum 7) carry class-sweep/origin; both completeness agents audit test-suite escape hatches.
- Remediation contract (`actions-taken-schema.md`, `agents-md-template.md`, sample ledger): dispositions + `escalated`, `superseded`, `no-measurable-benefit`; `fixed` requires Commit (SHA), Verification (workspace scope), Blast radius, Diff (`N files, +I −D, C commits`), Coverage lost when tests edited; pushback obligation; fix by subsystem; regression test measures the claimed quantity; escalate on ≥5× budget or a 4th commit on one slug; `release_phase`.

**Evals**
- `score-eval.mjs`: `scoreArtifacts` (gates as metrics), `scoreReaudit` (carried-forward suppression, regression/caused-by labelling, class-sweep grouping, reconciliation), `scoreRemediation` (session-scoped ledger dispositions, false-positive-disputed, note-not-broken, trailers, workspace gate, **hidden cross-module tests**, verification scope, median files/fix). `run-eval --mode audit|remediate`, fixture `setup.sh` hook builds real git history (ledgered fixes w/ trailers, a caused-by defect inside a fix, a regression commit), `eval-baseline` tag, `sha-map.json`, hidden tests copied in after the session; audit mode errors if the session produced no new audit.
- Fixture `evals/fixtures/reaudit-rs/` (prior audit dir + ledger + seeds + `hidden-tests/contract.rs` that runs the binary). `compare-runs` shows the new metrics. README documents everything + baselines.

## Live results (recorded in `evals/README.md` Baselines; run dirs gitignored)

- **Audit / re-audit** (claude default, 25m35s): recall 3/3, `finalize_ok`, origin+failure_mode coverage 1.0, carried_forward suppressed 1/1, regression found+labelled 1/1, caused-by found+labelled 1/1 (correct SHA), class sweep grouped 1/1, still_fixed 1/2 (model chose `superseded` — contract clarified since), FP 2 (bait re-derived + a `format!` nit on the clean file).
- **Remediate** (8m23s): ledger ok, trailers 4/4, verification workspace-scope 4/4, hidden tests pass (after the contract-not-fix-shape correction), **false_positive_disputed: false** — the remediator "fixed" the bait on the clean file instead of disputing it. The eval catches the yamalgam pattern on its first run.

## Next actions

1. **Merge decision** — Clay: `git pm` from `audit-churn-reduction` when ready. Nothing pushed yet.
2. Follow-ups (from final review, deliberately not done): unit tests for `finalizeAudit`'s reconciliation-consistency / origin.ref / allowUnledgeredPrior branches; make `finalize` pass `gitLog` into `lintLedger` (today only `ledger` checks commit existence/trailers); omit empty Reconciliation/Carried-forward sections from the fresh-audit README scaffold; `audit_profile.effort` is unconstrained (stub `unknown` passes the gate); `test/flow-to-svg.test.mjs` still absent from `just test`.
3. **Codex column**: run `just eval reaudit-rs --platform codex --model gpt-5.6-sol` (hermetic flags already in run-eval) and `--mode remediate` to see whether the pushback failure is model-specific.
4. Consider a `failure_mode` calibration seed (a significant `documentation` finding that must NOT be blocking) — none of the fixtures test the blocking split's other direction.
5. yamalgam: next audit there should run in re-audit mode against its 27 prior dirs — expect `finalize` to refuse on the two unledgered ones (`2026-04-08-full-workspace`, `2026-08-15-1538-…`) until ledgers exist or `--allow-unledgered-prior`.

## Process notes

- Subagent final messages failed to arrive on first delivery for essentially every dispatch this session (had to `SendMessage` "send your report" each time); one implementer went idle mid-live-run and lost ~2h. The report-file-per-task convention is what saved it — exactly the argument in `ref/auditor-scratch-files.txt`, now codified in the skill's scratch policy.
- Reviewers caught two things the plan text got wrong that would have shipped otherwise: an all-digit git SHA (`9395798`) unquoted in YAML parses as an int; a hidden test that asserted a fix *shape* the audit had explicitly said was optional.
