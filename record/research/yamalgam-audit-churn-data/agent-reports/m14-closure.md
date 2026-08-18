# M14 "Release Closure" Loop — Churn Analysis (agent cluster-m14-closure)

## 1. Timeline
Every commit authored Clay Loveless in git; every ledger entry says Author: Codex. Only A1 records auditor (gpt-5.6-sol/terra surface agents, high effort); A2-A6 record none.

| # | Audit dir | Audit @ | Commit | Findings (C/S/Mo/Ad/N) | Rem. commits | Rust LOC | Gap to next |
|---|---|---|---|---|---|---|---|
| A1 | 2026-08-14-m14-release-closure | 08-15 01:33 | 1269483 | 0/0/1/2/0 = 3 | 4 | 84,932 | 1h55m |
| A2 | 2026-08-15-0328-m14-release-closure | 03:28 | 78e178b | 0/0/1/2/0 = 3 | 7 | 86,014 | 2h19m |
| A3 | …-0547-…-final | 05:47 | 2ff0938 | 0/0/2/1/0 = 3 | 4 | 86,968 | 57m |
| A4 | …-0644-…-clean | 06:44 | d98afe1 | 0/0/1/0/0 = 1 | 2 | 87,220 | 35m |
| A5 | …-0719-…-clean | 07:19 | fc3c1b2 | 0/0/2/0/0 = 2 | 17 | 87,355 | 8h19m |
| A6 | …-1538-…-clean | 15:38 | 8084c7c | 0/1/7/0/0 = 8 | 14 (only 6 of 8 findings) | 94,845 | 15h14m |
| A7 | 2026-08-16-06-pre-release-full | 08-16 06:52 | 2f5ddd1 | 0/7/11/9/2 = 29 | 31 | 99,449 | 14h47m |
| A8 | 2026-08-16-21-m14-pre-release | 21:39 | e4abbc3 | 2/13/17/8/3 = 43 | ~44 | 104,119 | — |

Every ledger 100% fixed; 0 disputed/accepted/deferred. A6 has NO actions-taken.md. 92 findings, 92 "fixed", zero pushback. Six "closure/final/clean" audits in 14h05m; none was clean.

## 2. Churn evidence
(a) Fixes causing next pass's findings — audit says so: A2 README:59 "Enabled by: canonical-schema-aliases-bypass-load-single-flight remediation." A1→A5 is one schema-alias/canonical-identity state machine in crates/yamalgam-schema/src/retrieval.rs patched five consecutive times, each fix creating the next edge case. A6's significant finding cites retrieval.rs:2485-2515 — code that did not exist before A5's remediation. retrieval.rs: 912 lines @1269483 → 1,391 @fc3c1b2 → 6,831 @8084c7c → 8,172 @e4abbc3 (9× in 48h).

(b) Recurring: local-cst-edits-still-scan-whole-stream identical slug A1 & A2 (declared fixed by 78e178b, re-reported 23 min later). Fingerprint-rehash family across three passes; three passes to remove one anti-pattern from three call sites — no sweep.

(c) Reverts/redo: f725a43 "perf(cst): locate edited documents directly" (+312) → f6dcb47 "fix(cst): restore stream document selection" (−257) 16 minutes later. Four-commit API thrash on an advisory + a NOTE: fa4ea99→811bbe2→459a98a→5bbb4ea; A7 ledger: "exact legacy public signatures … are restored." 728723c reopened by 6c57a8e. Three A8 entries with off-schema disposition "correction to an existing fix; no status-count change" (9ce6e23, 25ff344, 2c6cdb4) — repairs to the separate fuzz/ workspace broken by earlier fixes: "The missed callers surfaced when the repository-wide deny gate compiled the separate fuzz workspace." ← THE suspected failure mode, confirmed.

(d) Effort vs actual — A5 blowout: 2 findings (medium, small) → 17 commits, 7h34m, `8 files changed, 8084 insertions(+), 594 deletions(-)` (retrieval.rs +6294, lsp/diagnostics.rs +2087). 8 of 17 commits address no audit finding — review-of-review. Header says fixed: 2 / open: 0.

(e) Findings silently lost — A6 no ledger; trailers cover 6/8 findings. Never fixed, never re-reported: release-cargo-tools-are-installed-from-mutable-bare-names (moderate; setup-cargo-tools/action.yml last touched 2026-03-27), fuzz-workflow-and-roadmap-omit-registered-targets (moderate).

(f) Scope/sensitivity drift: recon boundaries byte-identical A1–A5 (4); A6 jumps to 8; A7/A8 switch to crustoleum surfaces. A8's CRITICAL scanner-peek-at-quadratic-lookahead in yamalgam-scanner/src/reader.rs untouched since 2026-06-10 — present through all six closure audits, five of which called that surface "clean. The native pipeline remains authoritative and unreplaced." They verified an invariant and reported a quality verdict. Direct contradiction: A1 blesses Librebar bridge re ADR-0020; A8 files it as second-yaml-parser-shipped-for-config and it's ripped out in fa7b8de.

(g) Audit-side noise: A8 duplicate finding (resource-limits-clone-not-copy + resource-limits-missing-copy-derive) reconciled by 3048c26. A8 README is an unedited scaffold with `<!-- AGENT: -->` placeholders committed — largest audit (43 findings, 2 critical) has no narrative.

## 3. What went well
- Audit-Finding trailers on every commit — reconstructed A6 remediation from trailers alone.
- Commit hygiene: code and ledger in separate commits, one finding per code commit.
- RED-before-GREEN in A5, full gate evidence in A8 ("3,225/3,225, 25 doctests, 12 package archives, Cargo Deny, 33-check feature matrix").
- Enabled by / Related / Enables chain annotations proved fix→finding causation. Underused.
- A7/A8 found real severe long-lived bugs. Changing the auditor changed the outcome.

## 4. Root causes
1. Exit condition self-referential/unachievable: "M14 remains open until … a later fresh audit is clean." Criterion = "an LLM finds nothing" — function of model, not code.
2. Audits ran against code the previous fix had just written (35–57 min gaps). Loop audited its own exhaust.
3. No severity floor — A4 shipped 1 moderate finding as a full pass; a note triggered a breaking API change.
4. Effort never validated vs actuals; review-of-review no cost ceiling.
5. Verification per-crate not per-repo (fuzz/ breakages).
6. Ledger status counts structurally hide churn (fixed:2/open:0 over 8k lines).
7. No auditor provenance → "code got worse" vs "auditor got pickier" indistinguishable.

## 5. Recommendations
Audit: require auditor frontmatter (model, effort, agent count, skill versions), refuse to render without; diff-aware pass mode with required label new-in-diff / pre-existing-missed / caused-by-fix:<slug> / recurrence-of:<slug>, recurring slug hard-fails as regression; sweep before filing; pin surface manifest per milestone and report coverage; severity floor — advisory/note in separate non-blocking section; fail render on unedited scaffold (grep `<!-- AGENT:`); warn when auditing tree written in last N hours.
Remediation: record insertions/deletions/commit count per entry; actual ≥5× estimate → `escalated`, human sign-off; make non-fixed dispositions mandatory-considered; verify with repo-wide gate incl. sibling workspaces + package archives; ledger written before next audit starts (cased checks precondition, refuses otherwise); cap follow-up rounds at 1.
Definition of done: zero open critical/significant across a named surface manifest, verified by ONE audit at a commit ≥12h old, full repo-wide gate green; moderate and below triage to next milestone by default; second confirming pass only if first found a critical. "Clean" was defined as the outcome of a stochastic process rather than a state of the artifact.
