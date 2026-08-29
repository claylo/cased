---
audit: 2026-08-28-21-self-audit
last_updated: 2026-08-28
status:
  fixed: 7
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 0
  escalated: 0
  superseded: 0
  no-measurable-benefit: 0
  open: 35
---

# Actions Taken: Full Repo self Audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/

Summary of remediation status for the [2026-08-28 Full-repo self-audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/ audit](README.md).

---

## 2026-08-28 — harden report assembly and eval gate against audited content

**Disposition:** fixed
**Addresses:** [template-slot-replace-interprets-dollar-patterns](README.md#template-slot-replace-interprets-dollar-patterns), [report-data-blob-script-breakout](README.md#report-data-blob-script-breakout), [eval-scorer-shells-out-model-authored-test-command](README.md#eval-scorer-shells-out-model-authored-test-command)
**Commit:** f4812fe
**Author:** claude-fable-5 (controller session, Clay reviewing)
**Verification:** `just test` — 122 pass, 0 fail. `scripts/build-viewer.sh` then `node skills/cased/scripts/build-report.js record/audits/2026-08-28-21-self-audit` through the shipped bundle: report.html 748 KB, 1 DOCTYPE, 1 `</html>`, cased-data parses (was 9.0 MB / 29 DOCTYPEs at 2365a3f).
**Blast radius:** Files touched: src/viewer/build-report.mjs, src/viewer/viewer.js, evals/scripts/score-eval.mjs, plus rebuilt skills/cased/scripts/build-report.js and skills/cased/templates/viewer.js, tests in test/build-report.test.mjs and test/eval-score.test.mjs, and the re-rendered report.html in this directory. The findings name build-report.mjs:929-935 and score-eval.mjs:304; the fix stays within those files. New exports `fillSlots`, `embedJson`, `assertAssembled` (build-report.mjs) and `splitGateCommand` (score-eval.mjs) — additive, no existing signature changed. `scoreRemediation` callers grepped: only the score-eval CLI and tests; existing tests passed `true`/`false` as testCommand and still pass under argv form. Co-varying text: the same three findings quote the old `.replace` chain as evidence — left untouched (audit artifact is immutable); the post-remediation evidence-gate mismatch is a known gap, recorded in session memory for discussion.
**Diff:** 8 files, +2698 −36991, 1 commit. Hand-written source is ~185 lines across five files; the rest is the rebuilt bundle (`skills/cased/scripts/build-report.js`, `templates/viewer.js`) and the re-rendered report.html. The ledger gate's budget warning is triggered by generated output, not scope creep; not escalated.
**Coverage lost:** none — no existing test inputs or expectations edited; `existsSync` import and one test-command test were added, not changed.

Three findings, one mechanism: audited source text reaching an interpreter unescaped. Fixed together because two share `assembleReport` and the third shares the "model-authored input" shape.

- `template-slot-replace-interprets-dollar-patterns`: slots are filled by a single regex pass over the template with a function-form callback (`fillSlots`), so `$'`/`` $` ``/`$&` in the replacement are inert. Single pass rather than six sequential replaces because filled content legitimately contains marker text — Expressive Code's copy button carries raw source in `data-code`, and this audit's own evidence quotes the markers. `build` now runs `assertAssembled` (exactly one DOCTYPE, cased-data block present and parseable) and refuses to write a corrupt document; this is the assertion `finalize` could not provide.
- `report-data-blob-script-breakout`: `embedJson` `\uXXXX`-escapes `<`, `>`, `&`, U+2028, U+2029 in the serialized blob (still valid JSON), so `</script>` in audited source can neither truncate the blob nor execute. `viewer.js` guards the parse so a malformed blob no longer kills annotations, slides, or nav.
- `eval-scorer-shells-out-model-authored-test-command`: `gateCommand` is sourced only from `--test-command` or the fixture's `expected-findings.yaml` (operator-authored); `recon.testing.command` is still the *cited* command for ledger linting but is never executed. Execution is argv form via `splitGateCommand`, which rejects shell metacharacters outright — a gate that needs a pipe must be wrapped in a script. A canary test writes `touch CANARY` into recon.testing.command and asserts the file never appears.

## 2026-08-28 — run every test file, unbreak CI gates, surface swallowed errors, ship license notices

**Disposition:** fixed
**Addresses:** [ci-drift-gates-abort-without-ys](README.md#ci-drift-gates-abort-without-ys), [flow-diagram-tests-excluded-from-suite](README.md#flow-diagram-tests-excluded-from-suite), [bare-catch-erases-failure-cause](README.md#bare-catch-erases-failure-cause), [bundled-third-party-source-missing-license-notices](README.md#bundled-third-party-source-missing-license-notices)
**Commit:** 67c42c8
**Author:** claude-fable-5 (controller session, Clay reviewing)
**Verification:** `just test` — 153 pass, 0 fail (122 before the glob; 29 flow-diagram tests joined and passed unchanged, plus 2 new). `just check-bundle` — `bundle ok` after commit (Clay, locally). CI on the push is the live verification for the ci.yaml change; not yet observed at time of entry.
**Blast radius:** Files: .github/workflows/ci.yaml, AGENTS.md, Justfile, README.md, scripts/build-viewer.sh, scripts/third-party-notices.mjs (new), skills/cased/THIRD-PARTY-NOTICES.md (new), src/viewer/prior-audits.mjs, src/viewer/build-report.mjs, src/recon/recon-to-yaml.mjs (+ shipped copy), evals/scripts/score-eval.mjs, three test files. Findings name ci.yaml, Justfile, prior-audits.mjs/build-report.mjs/recon-to-yaml.mjs/score-eval.mjs, and the two bundles — the fix stays within those plus the new generator and its docs. Public surface: `findPriorAudits` entries' `findingCount` can now be `null` (was always a number); `finalizeAudit` is the only consumer and handles it. `scoreRemediation` output gains `workspace_gate_error` (additive). `gitLog`/`sessionLedgerEntries`/`fixCommits` now throw on non-128 git failures instead of returning defaults — callers are the ledger CLI and the scorer CLI, both of which surface the throw. Co-varying text: README "Bundle drift" prose unchanged; README License section updated; AGENTS.md just-recipe list updated.
**Diff:** 16 files, +1457 −27, 1 commit (≈1300 of the insertions are the generated THIRD-PARTY-NOTICES.md).
**Coverage lost:** none — no existing test inputs or expectations changed.

Four findings, one commit, because they are the four things a reader checks before trusting the release post: is CI green, does the suite run, do failures surface, is redistribution legal.

- `ci-drift-gates-abort-without-ys`: `tool: just,yaml-schema` on the test job. Chose installing `ys` over splitting schema regeneration out of `build-viewer.sh`, because check-bundle *should* regenerate the stamped contract — that is the drift it exists to catch.
- `flow-diagram-tests-excluded-from-suite`: `node --test "test/*.test.mjs"`. Count rose by exactly the 29 the finding predicted; nothing newly failing.
- `bare-catch-erases-failure-cause`: all nine sites bind the error. `countFindings` → `null` on parse failure, `finalizeAudit` errors on `null` ("unreadable findings.yaml") even under `--allow-unledgered-prior` — test added. git failures split on `e.status === 128` (semantic "no such object / no baseline") vs everything else (throw). Recon config detectors warn on stderr before falling through. Scorer: `workspace_gate_error` set on ENOENT — test added asserting a missing binary and a failing gate are distinguishable.
- `bundled-third-party-source-missing-license-notices`: `scripts/third-party-notices.mjs` walks rolldown's `//#region node_modules/…` markers, resolves each package's package.json + LICENSE, writes an aggregated notices file; `build-viewer.sh` runs it so check-bundle diffs it. **Count correction:** 44 distinct packages (40 MIT / 2 ISC / 2 BSD-3-Clause), not 81 — the finding counted `@scope/pkg/subpath` regions as distinct packages. Two packages (`cssesc`, `postcss-selector-parser`) publish no LICENSE file to npm; the notices file records them as "declared MIT" and the generator warns. Residual: none of this is copyleft; the BSD non-endorsement clause is satisfied by reproducing the notice.
