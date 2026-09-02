---
audit: 2026-08-28-21-self-audit
last_updated: 2026-09-01
status:
  fixed: 11
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 0
  escalated: 0
  superseded: 0
  no-measurable-benefit: 0
  open: 31
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

## 2026-09-01 — evidence gate reads findings.commit and refuses paths outside the repo

**Disposition:** fixed
**Addresses:** [evidence-gate-reads-outside-the-repo-root](README.md#evidence-gate-reads-outside-the-repo-root)
**Commit:** b7ade51
**Author:** claude-fable-5-1 (controller session, Clay reviewing)
**Verification:** `just test` — 159 pass, 0 fail (153 before; five new gate tests: read-from-commit, file-missing-at-commit, large file over the child_process buffer, unknown-commit fallback, path escape; one new schema test). `node skills/cased/scripts/build-report.js finalize record/audits/2026-08-28-21-self-audit` through the shipped bundle: `finalize ok` (19 evidence errors before this change). `validate` on this audit under the tightened schema: ok.
**Blast radius:** Files: src/viewer/gates.mjs, src/schemas/findings.schema.json, src/viewer/build-report.mjs (help text only), skills/cased/SKILL.md, evals/README.md, two test files, plus the restamped contract in skills/cased/references/ and skills/crustoleum/references/ and the rebuilt bundle. The finding names gates.mjs:18-23 and the schema; the fix stays there. Public surface: `checkEvidenceFidelity(doc, repoRoot, { commit })` gains an optional third argument defaulting to `doc.commit` — the two existing callers (finalizeAudit, the evidence subcommand) and the eval scorer pass nothing and get the new behaviour. New problem kind `path-escapes-repo` in the returned list; consumers already switch on `problem` strings. Schema: `locations[].path` now has a pattern; this audit's 42 findings and both schema example files validate under it. Eval fixtures ship without `.git`, so the scorer falls back to the working tree there — behaviour unchanged for evals. Co-varying text updated: SKILL.md 3a′, the `evidence` subcommand usage line, evals/README.md metric table.
**Diff:** 10 files, +211 −30, 1 commit (≈40 lines are the rebuilt bundle and restamped schema copies).
**Coverage lost:** none — existing tests untouched; the working-tree path is still exercised by the three original gate tests, which run without git.

The finding asked for path containment. The same function had a second, unfiled defect surfaced by remediating this audit: it read evidence from the working tree, so after the seven fixes above `finalize` reported 19 evidence mismatches, 12 of them on findings nobody had touched — their lines drifted because they share a file with a fix. Evidence is a claim about the tree at `findings.commit`, so the gate now reads each cited path with `git show <commit>:./<path>`, resolved once per run via `git cat-file -e`; if git cannot resolve the commit (no repository, unknown object) it falls back to the working tree. `maxBuffer` is raised because the shipped bundle exceeds Node's 1 MB default and the resulting throw was being reported as `file-missing` — caught because this audit cites the bundle in `bundled-third-party-source-missing-license-notices`.

Path containment is enforced twice: the gate rejects absolute or `..`-traversing paths with `path-escapes-repo` before any read, and the schema pattern rejects them at `validate` time. The pattern is a segment grammar rather than lookahead because `ys` (the Rust validator that stamps the contract) has no look-around support.

## 2026-09-01 — escape every metadata sink, allowlist link schemes, derive concern counts

**Disposition:** fixed
**Addresses:** [unescaped-metadata-in-report-markup](README.md#unescaped-metadata-in-report-markup), [prose-links-allow-javascript-uris](README.md#prose-links-allow-javascript-uris), [summary-counts-never-cross-checked](README.md#summary-counts-never-cross-checked)
**Commit:** 44b419c
**Author:** claude-fable-5-1 (controller session, Clay reviewing)
**Verification:** `just test` — 174 pass, 0 fail (159 before; 15 new tests: header/ledger/flow-badge escaping, link allow and deny lists incl. whitespace and tab disguises, build refusing an invalid document, derived header and README counts, `checkSummaryCounts` match/mismatch/unknown-key, `concernCounts`). `just build-smoke` ok. Self-audit through the shipped bundle: `validate` ok, `build` (report.html and AGENTS.md byte-identical to the committed ones), `finalize ok`.
**Blast radius:** Files: src/viewer/build-report.mjs, src/viewer/flow-to-svg.js, src/viewer/gates.mjs, src/schemas/findings.schema.json, src/schemas/findings.example.yaml, src/schemas/findings.md.footer, three test files, plus the rebuilt bundle and the contract restamped into skills/cased/references/ and skills/crustoleum/references/. The findings name build-report.mjs (five sinks, renderProse, renderHeader), flow-to-svg.js and the schema's summary block; the fix stays within those plus gates.mjs, where the counts helpers belong beside the other gates. Public surface: `parseFindings` no longer throws on a missing `summary`; schema drops `summary` from `required` and sets `additionalProperties: false` on `summary.counts` (this audit's findings.yaml and both example files validate); `assembleReport` now throws on a document that fails the schema (new optional `schemaDir` opt; the CLI passes nothing and resolves it the way `validate` does); new exports `safeHref`, `concernCounts`, `checkSummaryCounts`, `CONCERN_LEVELS`; anchors gain `rel="noopener noreferrer"`. `renderReadmeMd` and `renderAgentsMd` count placeholders now derive from the findings. Co-varying text: findings.md.footer (concern note rewritten, new `summary.counts` note, carried_forward sentence), the canonical example's `summary` block removed — it had been miscounting its own findings (advisory 8 vs 10, note 5 vs 3), which is the finding demonstrated in the contract itself. No SKILL.md or agent prompt told the controller to author counts, so nothing there to change.
**Diff:** 16 files, +356 −79, 1 commit (≈120 of the insertions are the rebuilt bundle and restamped copies).
**Coverage lost:** none — existing tests untouched; the canonical example still exercises every render path, now with derived counts.

Three findings, one mechanism: text reaching the report without passing the escaper or a check. `unescaped-metadata-in-report-markup` wraps all five sinks the reviewer's sweep found — audit_date, commit, the counts keys (glossary text, `data-concern` attribute, summary-bar text), `start_line`, and the flow badge's `concern` — in the escaper already in scope at each site; separately, `build` now runs the compiled validators before rendering and refuses a document that fails, so the enum-bound fields the badges and gates key on are guaranteed at render time rather than by a process step a session can skip. `prose-links-allow-javascript-uris`: `safeHref` parses the target with `new URL(href, 'https://relative.invalid/base/')` — fragments and relative paths resolve to the placeholder host and pass, anything else passes only with an http, https or mailto protocol; using the parser rather than a string prefix means ` javascript:` and `java\tscript:` are rejected the way a browser would honour them. `summary-counts-never-cross-checked`: took the finding's second option — the field carried no information the findings did not — and kept its first as the safety net: renderers derive the histogram via `concernCounts`, the schema makes `summary` optional and closes `counts` to the five levels, and `finalizeAudit` errors on any authored count that disagrees or any key outside the vocabulary.
