# Yamalgam audit churn — what 27 audits in 15 days taught us

**Date:** 2026-08-18
**Corpus:** `~/source/claylo/yamalgam/record/audits/` — 27 audits (2026-04-08, then 26 between 2026-08-03 and 2026-08-17), 426 findings, 314 ledger entries, 329 fix commits.
**Method:** five research agents — four chronological slices (M10 / M11–M13 / M14 closure loop / 08-17 burst) reading every README + ledger + reviewer-verdicts and diffing ledger SHAs; one quantitative lineage pass over `findings.yaml` + ledgers + `git show --stat`. Extracted data in `yamalgam-audit-churn-data/`.
**Purpose:** decide what to change in `cased` / `crustoleum` so users converge faster with less churn.

---

## TL;DR

The hypothesis going in was "hasty remediation agents passed unit tests but broke the broader stack." **Partially confirmed, but it is not the main driver.** Confirmed instances exist (fuzz workspace broken three times by fixes that passed the crate gate; a `halt` exit-code fix that introduced `as u8` wraparound; API accessors that shadowed a trait method; four consecutive rewrites of `retriever/http.rs`; one schema cache file patched five passes in a row, growing 912 → 8,172 lines). Zero cases of tests weakened to pass. Fixes were small (median 2 files / 93 insertions) and test-backed (49% touch tests).

The dominant churn drivers are **process-shaped, and every one of them is a gap in what `cased` currently specifies**:

1. **No termination condition.** "Closed after a later fresh audit is clean" is self-referential; a fresh LLM audit of 90k LOC is never clean. Six "closure/final/clean/clean/clean" audits fired in 14 hours; seven more the next day. Passes 35–68 minutes apart audited the previous pass's diff — the loop audited its own exhaust.
2. **No memory between audits.** Nothing ingests prior `actions-taken.md`. Deferred findings were re-derived verbatim (43% of M13's finding-reports were the same six deferred slugs regenerated four times). Reviewer knowledge (a dead-end documented in audit N) was rediscovered the hard way in N+1.
3. **Findings are located, not classed.** "Allocate before limit check", "linear scan should be an index", "stringly-typed error", "unbounded recursion", "fingerprint rehash" — each drip-fed one file per audit across 3–7 audits. Nobody swept siblings.
4. **Zero pushback.** 348 fixed / 3 disputed (0.7%) across 314 ledger entries. Note-level findings the reviewer explicitly downgraded were fixed at full ceremony; a *note* triggered a breaking public-API change walked back over 3¼ hours. The remediator treats "open: 0" as the goal.
5. **No causation field.** The regression-vocabulary grep is a null result — *not because fixes never caused findings, but because the schema has nowhere to say so.* Auditors wrote "Enabled by:" in prose or silently described the new code as if it had always been there. The data cannot show what the four qualitative reads found everywhere.
6. **Scope and auditor are non-deterministic and unrecorded.** `recon.yaml` carries no surface set, sensitivity floor, tool exclusions, model, or agent count. Surface taxonomy was reinvented every pass; two passes 68 minutes apart shared zero findings. Auditor swapped Opus → Codex → reviewer-augmented mid-loop; finding count tracked agent count, not code state. Only 2 of 27 audits record their model.
7. **Effort estimates ignore blast radius and are never validated.** "medium" → 3,007 lines / 20 files / 3 crates / 5 review rounds. "small + medium" → 17 commits, 8,084 insertions, 8 of which addressed no finding at all. `fixed: 2 / open: 0` hides all of it.
8. **Remediator lacked project-phase context.** Applied post-publish additive-compat rules to a pre-0.1 crate → doubled public API surface → next audit flagged it → 38 files reverted, zero retained change.

What worked and must be kept: `Audit-Finding:` git trailers (reconstructed a ledger-less audit from trailers alone), append-only ledger with real SHAs, the reviewer catching unimplementable remediations *before code was written* (M10), full-gate evidence in ledger entries (once it started, recurrence collapsed), pass-7's forward-verification of the prior sprint's diffs (happened once; should be mandatory), and the fact that the audits found real severe long-lived bugs (quadratic scanner lookahead untouched since June, two stack-exhaustion paths, silent comment deletion, exit 5 on GitHub-Actions-shaped YAML).

---

## 1. The numbers

| | |
|---|---|
| Findings | 426 (7 critical / 94 significant / 191 moderate / 102 advisory / 32 note) — moderate+advisory = 69% throughout |
| Ledger dispositions | 348 fixed · 4 mitigated · 2 accepted · **3 disputed** · 34 deferred · 0 open |
| Missing ledgers | 2026-04-08 (27 findings, no slugs either) and 2026-08-15-1538 (8 findings; 2 never fixed, never re-reported) |
| Reviewer verdicts | 92 across 6 audits: 61 confirmed / 28 adjusted / 2 disputed / **0 rejected**. ~70% of adjustments are quote-indentation and line-range fixes |
| Fix commits | 329; median 2 files, 93 ins, 12 del; p90 8 files; 26% touch ≥2 crates; 21 commits >10 files (mostly mechanical API sweeps); 7 test-only commits, all *tightening* |
| Exact slug recurrence | 8 / 407 (2%) — six are one deferred perf bundle carried through four M13 audits |
| File/surface recurrence | 28 clusters; hotspots: `schema/src/retrieval.rs` (17 audits, 38 locations), `lsp/src/server.rs`, `lsp/src/diagnostics.rs`, `.config/deny.toml` (4 audits) |
| Authorship | git author = Clay ×329; ledger `Author:` = Codex ~95%, pair ~4.5% |
| Cadence | 3 convergence runs (36→5, 14→1, 43→2), each reset by a scope widening (29 / 43 / 39). Peak: 87 commits on 08-17 |
| Provenance defect | every M10 ledger SHA is unreachable from `main` (squash-merged PR #112) |

Finding counts by audit: 27, 36, 47, 27, 5 · 20, 11 · 20 · 14, 10, 9, 7 · 3, 3, 3, 1, 2, 8 · 29, 43 · 10, 11, 18, 2, 8, 13, 39.

## 2. Churn taxonomy with evidence

### 2a. Fix → next audit's finding (confirmed cases)

| Fix (audit → SHA) | What it introduced | Found by | Cost |
|---|---|---|---|
| M10 08-03-18 halt exit code → POSIX truncation | `as u8` wraps: `halt(256)` exits 0 silently | 08-03-21 `halt-exit-code-truncated-to-u8` | re-fix `ab1ce0e` |
| M10 08-03-18 `no-public-read-access-to-yamlval` accessors | `as_bool` shadows `jaq_core::ValT::as_bool`; `Data`/`YgSeq`/`YgMap` over-exposed | 08-03-21 two findings ("not public enough" → "too public") | `b330d75`, `7e9d425` |
| M10 08-03-18 exact `=` pins for jaq | blocks patch updates | 08-03-21 `jaq-exact-pins-block-patch-updates` | `7abe27b` relaxes to `~` |
| M12 `660a8a4` batch snapshot rebuilds | full-text materialization | M13 RC `lsp-changes-copy-and-rebuild-whole-document` — re-reported and re-deferred in 3 more audits | 4 finding-reports |
| M14 A1–A5 `schema/src/retrieval.rs` canonical-alias preflight | each fix exposed the next unreachable cache state; A2 README literally says `Enabled by: <prior slug> remediation` | five consecutive audits; A6's significant finding cites code that did not exist before A5 | file 912 → 8,172 lines in 48h |
| M14 `f725a43` direct document locator (+312) | mishandled inter-document directives | self-caught | reverted `f6dcb47` 16 min later |
| 08-17 pass 3 `5589905` http pool `Drop → shutdown()` | drop joins abandoned fetches | pass 7 `http-fetch-pool-drop-joins-abandoned-fetches` | `e5d3876` reverts; file rewritten 4× in 4 passes |
| 08-17 pass 6 `9f4f74d`/`7b54a02` owned+borrowed API pairs | doubled public surface pre-publish | pass 7 `owned-and-borrowed-api-pairs-frozen-at-publish` (1h later) | `99482f4`, `2eeac07` — 38 files, zero net API change |
| 08-17 `4450f2a` README compliance numbers (5 lines) | new claims not asserted by tests; sibling docs unchanged | pass 7: four findings | 4 fixes |
| 08-17 `b9b0088` emitter Vec-growth test | test measures capacity, not allocations; `String` per key survived | pass 7 `emitter-allocates-a-string-per-mapping-key` — "survived a fix aimed at it" | re-fix |
| M14 `04912b4`/`7e5c5c6` `http` opt-in | doc/config/CI surfaces not swept | 9 findings across 5 passes | 9 fixes |
| **fuzz workspace** — three A8 ledger entries `9ce6e23`, `25ff344`, `2c6cdb4` "correction to an existing fix; no status-count change" | fixes passed crate tests, broke `fuzz/` | repo-wide deny gate | **the hypothesis, confirmed** |

### 2b. Class drip (one mechanism, N audits)

- allocate-before-limit-check ×4 (M13); linear-scan-should-be-index ×4 (M11–M13); stringly-typed errors ×4 audits over 4 months; unbounded recursion ×7 findings / 5 passes (08-17); resource limits ×3 crates across 3 audits (M10 — hardened in `query` + `core/loader.rs`, never propagated to composer/serde/CST); fingerprint rehash ×3 (M14); C0 control escapes fixed, C1 found next audit.

### 2c. Re-derivation of already-dispositioned work

- Six deferred M13 slugs regenerated verbatim in four audits = 17/40 M13 finding-reports (43%).
- 2026-04-08 audit had no ledger and no slugs → ~8 findings rediscovered verbatim in August (`mapping-omits-intoiterator`, `borrowed-value-get-allocates-key`, `serde-peek-clones-owned-event`, `cst-discards-parse-error`, unused deps ×2).
- `librebar-cli-feature-compiles-unused-generators` deferred in 08-17 pass 3, re-filed and re-deferred in pass 7. **Deferral does not suppress rediscovery.**
- jaq-std private-registry dead end: documented by M10 reviewer, rediscovered by compile failure next audit → ADR-0009.

### 2d. False "done" and self-referential closure

- Every M14 closure README: "M14 remains open until … a later fresh audit is clean." Six passes in 14h05m titled closure → final → clean → clean → clean. None clean.
- 08-17 pass 4: single Codex agent, `cargo-geiger` failed, declared "solid pre-release shape" → 68 min later pass 5 found 8, pass 6 found 4 significant incl. two stack-exhaustion paths → the "rerun" at 21:00.
- 08-17 pass 7 opens: "This is the seventh audit of this branch in twenty-four hours." Ends: "nothing blocks the publish." Then 31 more commits landed.
- A8 (43 findings, 2 critical) and pass 0 of 08-17: **README is an unedited scaffold with `<!-- AGENT: -->` placeholders committed.** Remediated from `findings.yaml` alone, 43/43 fixed, ~6.6 min per fix.
- Six closure passes verified an *invariant* ("native pipeline authoritative and unreplaced") and reported it as a *quality verdict* while a critical quadratic lookahead sat untouched in `scanner/src/reader.rs` since June.
- Direct contradiction, no reconciliation: A1 blesses the librebar bridge re ADR-0020; A8 files it as `second-yaml-parser-shipped-for-config`; ripped out `fa7b8de`.

### 2e. Reviewer pass: proofreader, not adversary

- 0/92 verdicts rejected. Two audits with reviewer files caught genuinely wrong *mechanisms* zero times (M10 `lossless-cst-corrupts-eight-valid-flow-documents`: audit and reviewer both blamed flow-mapping end spans; remediator found indentless block-sequence boundaries).
- Reviewer severity downgrades had no effect on remediation priority — notes were fixed anyway (`scanner-error-branches-remain-in-hot-functions`: null benchmark result, +160 bytes `.text`, plus a profile artifact).
- The one real false positive in the 08-17 burst was caught by the remediator, not the reviewer.
- Counterpoint: M10 reviewer killed an unimplementable remediation before code and blocked an optimization that would have weakened the alias-expansion limit. When it argues about *mechanism*, it earns its cost.

### 2f. Effort blowouts hidden by ledger counts

- `lsp-schema-edits-never-invalidate-dependent-validation` "medium" → 6 commits, 20 files, 3007+/174−, 3 crates incl. `yamalgam-resolve/src/retriever/file.rs`, "fifth-round independent review is clean."
- M14 A5: 2 findings ("medium", "small") → 17 commits / 7h34m / +8,084 −594; 8 commits address no finding. Ledger header: `fixed: 2, open: 0`.

## 3. What went well (keep, and make mandatory where it was voluntary)

- `Audit-Finding: <slug>` trailers on every fix commit. Highest-value artifact; survives a missing ledger.
- Append-only ledger, one entry per action, multi-slug `Addresses`, no target-less deferral. Disputes carried compiler-level evidence when they happened.
- Fixes with measured proof (3.37s → 15ms; 115,200 → 639 comparisons; RED test named before GREEN).
- Full repo gate evidence in ledger entries once it started (M10 08-04-16 onward; A8: "3,225/3,225, 25 doctests, 12 package archives, deny, 33-check feature matrix"). **The transition from crate-local to workspace verification correlates 1:1 with the collapse in recurrence.**
- 08-17 pass 7's forward-verification section: re-read all nine prior perf remediations against their diffs, checked five named regression hazards, found none. Exactly the behaviour the loop needed; happened once.
- Pass 7 deferrals got owners ("routed to fleet process") — first pass to say "not this loop."
- Convergence is real: 36 → 5, 14 → 1, 43 → 2. The protocol works when it's allowed to terminate.
- No test weakening anywhere. Test-only commits tighten.

## 4. Changes to make in `cased` (audit side)

Ordered by leverage. Each maps to a specific surface in `skills/cased/`.

1. **Re-audit mode with mandatory prior-ledger ingestion.** (SKILL.md Phase 1; new schema block.) If `record/audits/*/actions-taken.md` exists: read all of them before recon. Emit `findings.yaml#carried_forward` (prior deferred/accepted slugs, excluded from counts, narrative, and the AGENTS.md index) and a required **reconciliation table** at the top of the report: prior slug → `still-fixed | regressed | superseded-by:<slug>`, verified against the fix commit's diff. A slug previously `fixed` that recurs is a hard `regression-of:` — never a fresh finding.
2. **Causation field on every finding.** `origin: pre-existing | new-in-diff | caused-by-fix:<sha or slug> | recurrence-of:<slug>`. Promote the prose `Enabled by:` to schema. `git log -S` over the evidence span makes it mostly mechanical. This is what makes churn *measurable* — the lineage pass could not see it because the field doesn't exist.
3. **Audit profile in `recon.yaml`.** `audit_profile: {model, effort, agent_count, surfaces[], severity_floor, excluded_tools[], skill_versions}` — refuse to render without it. Emit a scope-delta banner vs. the previous audit dir. Freeze the surface taxonomy (crustoleum's surfaces + completeness); no ad-hoc "Round-Trip Editing Surface".
4. **Class sweep before filing.** When a finding is mechanism-shaped (unmetered alloc before limit check, `position()` in a loop, `String` error payload, recursion without depth guard, rehash of a fingerprint), the subagent must grep the workspace and file **one finding with N locations**, not one per audit. Add to `references/subagent-output-contract.md` and the crustoleum agent prompts.
5. **Effort from blast radius.** Ledger row gets `reverse_deps: N crates` (from `cargo tree --invert` on the touched module). A shared-crate finding is never "small".
6. **Blockers vs backlog.** Report renders `critical`/`significant` *with a user-visible failure mode* (exit code, wrong output, panic, data loss) as release-gating; everything else in a separate non-blocking section. A note must not be able to drive a breaking API change.
7. **Reviewer split.** (a) Mechanical evidence-fidelity: extract snippets by byte range from the file, never retyped — this eliminates ~70% of current reviewer output. (b) Adversarial validity reviewer with one job: falsify each finding by reading the whole execution path; verdict field `mechanism_verified: yes|no|not-attempted`; track rejection rate; 0/92 is a broken gate. Reviewer severity is binding: downgraded-to-note lands in backlog, disputed is deleted from `findings.yaml`.
8. **Completeness gates in `build-report.js`.** Fail when `<!-- AGENT:` remains in README.md; warn when the audited commit is < N hours old or when a prior audit dir has open findings and no ledger.
9. **Test-suite exemptions are a first-class surface.** Grep allowlists, `#[ignore]`, known-failure tables, "understood and acceptable" comments. The CST round-trip allowlist survived a full-workspace audit for five months while concealing a defect in the crate's defining capability.
10. **Recon excludes `record/audits/**` and `*.html`.** M13 recon showed HTML at 23% and Markdown at 27% of the scanned corpus. The auditor was auditing its own reports.
11. **Worker scratch files** (per `ref/auditor-scratch-files.txt`): allow `/private/tmp/cased/<audit-id>/` structured results with atomic rename; coordinator verifies before import; never write into the audit dir. This session lost every subagent's first-delivery message and had to request each one — the mailbox is a real SPOF.

## 5. Changes to make in the remediation contract (`templates/agents-md-template.md`, `references/actions-taken-schema.md`)

The current loop is "find slug → read → change code → log". Add:

1. **Verification block required for `fixed`.** Exact commands and results from `recon.yaml#testing.command` at **workspace** scope, plus sibling workspaces (`fuzz/`), package archives, deny, feature matrix where the project has them. Crate-local test counts are not acceptable evidence.
2. **Blast-radius line.** Crates touched vs crates named in the finding; symbol consumers from `cargo tree --invert`; co-varying docs/tests/config grepped and either fixed or listed. Nine http-opt-in findings and four compliance-number findings die here.
3. **Diff budget.** Record `files / +ins / −del / commits` per entry. Actual ≥ 5× estimate → disposition `escalated`, human sign-off; after 3 fix commits on one slug it returns to design review. A5 stops at commit 3, not 17.
4. **Pushback is an obligation.** One sentence per finding on why it is not `deferred`/`disputed`/`no-measurable-benefit`. Add `no-measurable-benefit` and `superseded-by` as legal dispositions. Track dispute rate; 0.7% over 314 entries is compliance, not diligence.
5. **Project phase in AGENTS.md.** `release_phase: pre-publish | published` — pre-publish means change types in place; additive-compat rules don't apply until 0.1.0.
6. **Regression test must measure the claimed quantity.** Ledger names the metric asserted; the audit's cost model must be the thing the test checks (Vec capacity ≠ allocation count).
7. **Fix by subsystem, not slug.** ≥2 findings in one file → one remediation with the design decision recorded.
8. **Ledger before next audit; SHAs must survive merge.** `cased` refuses to start on a repo whose latest audit has open findings and no ledger. Merge remediation branches `--no-ff` or record merge+branch SHA pairs.
9. **Silent test-fixture rewrites forbidden.** If a fix changes an existing test's inputs/expectations, the entry states what coverage was lost (`949ee80` deleted the only cross-crate memory-scheme include coverage).

## 6. A termination condition that actually terminates

Replace "closed after a later fresh audit is clean" with a pre-registered, once-evaluated gate:

> Release closure = in **one** pass over the **frozen surface profile** with **no tool exclusions** beyond permanent waivers: zero open `critical`/`significant` findings naming a user-visible failure mode; reconciliation table shows 0 regressed / 0 caused-by-fix; the audited commit is ≥ 12h old and **the pass introduced no fix commits** (it audits the exact tree the tag will ship). Moderate and below triage to backlog by default. A second confirming pass is permitted only if the first found a `critical`.

"Clean" must be a state of the artifact, not the outcome of a stochastic process. Two consecutive passes over an unchanged tree with an empty blocker set is the signal; anything else is a new audit of new code and will always find something.

## 7. Verdict on the original hypothesis

- **"Hasty agents"** — no. Median fix 2 files, test-backed, no test gaming, negative results recorded. Codex authored ~95% and self-documented its own revert and its own non-sticking fix.
- **"Passed unit tests but broke the broader stack"** — yes, in bounded, identifiable cases: crate-local test runs (M10), the fuzz workspace (A8 ×3), fixes whose semantics interacted with a trait/consumer the remediator didn't look at (`as_bool`, `halt`, http `Drop`). Every one traces to the AGENTS.md loop having **no verification step, no blast-radius step, and no project context**.
- **The bigger cost** was structural: 26 audits where ~10 would have done, driven by a self-referential exit condition, no memory across audits, point findings instead of class sweeps, unrecorded scope, and a remediator with no mandate to push back. Fix the contract and the churn goes with it.

---

Raw agent reports are in `yamalgam-audit-churn-data/agent-reports/`; extracted CSVs in `yamalgam-audit-churn-data/`.
