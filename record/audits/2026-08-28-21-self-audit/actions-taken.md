---
audit: 2026-08-28-21-self-audit
last_updated: 2026-08-28
status:
  fixed: 3
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 0
  escalated: 0
  superseded: 0
  no-measurable-benefit: 0
  open: 39
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
