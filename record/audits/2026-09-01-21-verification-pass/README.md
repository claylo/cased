---
audit_date: 2026-09-01
project: cased
commit: 9f7e30a2be4c799fe0239c6581a8ee0d6fd708bc
scope: cased verification pass at 9f7e30a (re-audit of 2026-08-28-21-self-audit, <12h after remediation; not a closing audit) — src/ (viewer, recon, schemas), evals/ (runner, scorer, fixtures), skills/ (cased + crustoleum prose), scripts/, test/, .github/
auditor: claude-fable-5-1 controller; six analysis agents (claude-fable-5-1) on security, error-handling, code-quality, completeness, dependencies, api-design; adversarial reviewer claude-fable-5-1; default effort
findings:
  critical: 0
  significant: 0
  moderate: 27
  advisory: 12
  note: 8
---

# Audit: cased (verification pass)

This pass exists to run the re-audit machinery for the first time against the twelve fixes ledgered since the 2026-08-28 self-audit, and to see what those fixes carried in with them; it was started less than twelve hours after the last fix commit, which the skill's own termination rule says disqualifies it as a closing audit, so `scope` labels it a verification pass. All twelve reconcile still-fixed: every mechanism the prior audit named is closed at `9f7e30a`, none regressed, and one (`ci-drift-gates-abort-without-ys`) is closed by a later commit than the one ledgered. The batch left ten defects of its own, every one `caused-by-fix`, every one moderate or below, and they cluster where the fixes were narrowest. **The Security Surface** shows the `$'`-splice fix closed the HTML chain and left the two markdown renderers on the same string-form `replaceAll`, and the sandbox commit documented a Bash prefix allowlist as a residual gate when `bash`, `node` and `find` are on it. **The Error Handling Surface** has the sharpest new finding of the pass: the evidence gate now reads the audited commit, and swallows every git failure into a silent working-tree fallback. **The Supply Chain Surface** shows the notices generator missing the second bundle and two `LICENSE-MIT` files, exiting 0. **The API Design Surface** has four new seams where a fix's contract is not stated. **The Code Quality Surface** and **The Completeness Surface** are the thirty prior findings, re-derived under their original slugs and unchanged, plus a few new notes. Zero blocking. Quiet, as expected; the noise it does have is a precise map of where narrow fixes end.

Process: six agents returned 48 raw findings; one cross-surface duplicate (`evidence-gate-silent-working-tree-fallback`, filed independently by error-handling and api-design) was collapsed into the error-handling version with the api-design contract angle merged in. The reviewer traced every mechanism: 47 reviewed, 42 confirmed, 5 adjusted, 0 disputed, 0 concern overrides. The five adjustments are all corrections of detail rather than of mechanism — a payload example that a directory name cannot contain, a `git -c core.pager` vector that needs a tty and so does not fire headlessly, a cargo-audit version number, two sibling walks the class sweep missed, and a "no Cargo.toml at any level" that should read "no root Cargo.toml". Every adjustment is applied in `findings.yaml`. The schema validator and the byte-level evidence gate both passed on the first run, which is the git-show evidence gate (b7ade51) doing what it was written to do.

What the pass says about the re-audit machinery, which is what it was for: the pre-runner does not apply (non-Rust), so recon was hand-gathered; `carried_forward` is empty because the prior audit has no standing dispositions; the agents set `origin.kind` on all 47 findings without exception; the reconciliation table rendered; `finalize` accepted a re-audit with a ledgered prior. The one soft spot is in the row for `ci-drift-gates-abort-without-ys`, discussed under Reconciliation below.

## Reconciliation with prior audits

| prior finding | audit | status | verified against |
|---|---|---|---|
| `template-slot-replace-interprets-dollar-patterns` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `report-data-blob-script-breakout` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `eval-scorer-shells-out-model-authored-test-command` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `ci-drift-gates-abort-without-ys` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `flow-diagram-tests-excluded-from-suite` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `bare-catch-erases-failure-cause` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `bundled-third-party-source-missing-license-notices` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `evidence-gate-reads-outside-the-repo-root` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `unescaped-metadata-in-report-markup` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `prose-links-allow-javascript-uris` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `summary-counts-never-cross-checked` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |
| `eval-runner-drives-unsandboxed-headless-session` | `2026-08-28-21-self-audit` | still-fixed | `9f7e30a` |

Eleven rows mean what they say: the ledgered fix commit's change is present at `9f7e30a` and effective. The twelfth, `ci-drift-gates-abort-without-ys`, is the exception the reconciliation vocabulary does not have a word for. The ledgered fix (67c42c8, adding `yaml-schema` to the CI tool lists) is *not* present at `9f7e30a` — c2c8a89 removed `yaml-schema` from CI and from `build-schemas.sh` entirely, replacing it with the bundle's own ajv. The defect is closed, more thoroughly than the fix closed it: the gate can no longer abort for want of a tool CI never installed, because the tool no longer exists in the pipeline. But "verified against 9f7e30a" for that row means "defect verified closed", not "ledgered fix verified present". `superseded` is reserved by the schema for replacement by a new *finding*, and there is none. The honest bookkeeping is a follow-up entry in the prior audit's `actions-taken.md` with disposition `superseded`, commit c2c8a89, `superseded_by` naming the 67c42c8 entry; that is a remediation-tracking action and is left for the operator.

Two other reconciliation notes the reviewer made that belong here. `bare-catch-erases-failure-cause` is still-fixed at its nine ledgered sites, and the same class reappears at two new sites b7ade51 introduced; that is filed as a `caused-by-fix` finding, not as a regression of the slug, which is what the contract says to do. `bundled-third-party-source-missing-license-notices` is still-fixed as ledgered, and the ledger entry's claim that two packages "publish no LICENSE file to npm" is wrong — they do, under `LICENSE-MIT`, and the generator's regex rejects the hyphen; that is the supply-chain finding below.

## Carried forward (not re-derived)

_None._ The prior audit has no standing dispositions; its 30 open findings are re-derived below under their original slugs.

---

## The Security Surface

*The three blockers are closed, and the class they belonged to — untrusted text reaching an interpreter unescaped — still has two open members the fixes did not reach: the markdown renderers and the recon manifest.*

### AGENTS.md and README scaffold renderers still fill slots with string-form replaceAll {#markdown-renderers-interpret-dollar-patterns}

**moderate** · `src/viewer/build-report.mjs:742-755`, `src/viewer/build-report.mjs:784-788` · effort: trivial · <img src="assets/sparkline-markdown-renderers-interpret-dollar-patterns.svg" height="14" alt="commit activity" />

f4812fe replaced the HTML assembly chain with `fillSlots` (function-form, single pass) and left the two sibling chains that render AGENTS.md and the README scaffold. `String.prototype.replaceAll` with a string pattern applies the same GetSubstitution rules as `replace`: a replacement containing `$'`, `` $` ``, `$&` or `$$` splices the template text around the marker into the output, and because the thirteen replaces run sequentially, a value filled early that happens to contain a later `{{marker}}` is expanded as if it were template. Every value in the chain except the counts is text an agent wrote after reading an untrusted repository (`findings.scope`, narrative titles, `locations[].path` — the schema path pattern admits `$` — `carried_forward[].reason`) or text lifted verbatim from that repository (`recon.testing.command` comes from `.config/scrat.yaml`). AGENTS.md is regenerated on every build and is the briefing the next Claude Code session auto-loads through CLAUDE.md, so a corrupted briefing persists across rebuilds. The sweep for `.replace(`/`.replaceAll(` with a non-function second argument in `src/`, `evals/scripts/` and `scripts/` found these two chains to be the only remaining sites that take model- or repo-authored values. The reviewer probed the semantics directly: `'A{{x}}B'.replaceAll('{{x}}', "$'|$\`|$&|$$")` yields `A[B|A|{{x}}|$]B`.

```javascript src/viewer/build-report.mjs:742-755
  return templateStr
    .replaceAll('{{audit_title}}', auditTitle)
    .replaceAll('{{audit_slug}}', auditSlug)
    .replaceAll('{{audit_scope}}', findings.scope || '')
    .replaceAll('{{audit_date}}', findings.audit_date || '')
    .replaceAll('{{finding_count}}', String(findingCount))
    .replaceAll('{{finding_list}}', findingList)
    .replaceAll('{{blocking_count}}', String(blocking))
    .replaceAll('{{backlog_count}}', String(backlog))
    .replaceAll('{{test_command}}', testCommand)
    .replaceAll('{{mode}}', mode)
    .replaceAll('{{release_phase}}', releasePhase)
    .replaceAll('{{prior_audits}}', priorList)
    .replaceAll('{{carried_forward_list}}', renderCarriedForward(findings));
```

```javascript src/viewer/build-report.mjs:784-788
  return templateStr
    .replaceAll('{{audit_title}}', auditTitle)
    .replaceAll('{{audit_scope}}', findings.scope || '')
    .replaceAll('{{audit_date}}', findings.audit_date || '')
    .replaceAll('{{audit_commit}}', findings.commit || '')
```

> Same trick, quieter target. I don't get the report this time, I get the briefing the next agent reads before it touches the code — and it reads it every session, because CLAUDE.md imports it. A `$'` in a scrat test command is enough.

Related: [renderAgentsMd and renderReadmeMd still duplicate metadata assembly](#agents-readme-render-duplication).

**Remediation:** Route both renderers through the same mechanism as the HTML path: generalise `fillSlots` to take the marker regex (`/\{\{(\w+)\}\}/g`) or add a `fillMarkdownSlots` that does one pass with a function-form callback, and have `renderAgentsMd` and `renderReadmeMd` build a slots object and call it. Keep the unknown-marker and missing-marker throws so a template edit cannot silently drop a slot. Add one test per renderer that puts `$'` and a `{{finding_list}}` literal into `findings.scope` and asserts the output contains them verbatim.

<div>&hairsp;</div>

### The eval runner's Bash prefix allowlist includes bash, node and find, so it bounds nothing {#eval-bash-allowlist-admits-shell-prefixes}

**moderate** · `evals/scripts/run-eval:194-197`, `evals/scripts/run-eval:252-253` · effort: small · <img src="assets/sparkline-eval-bash-allowlist-admits-shell-prefixes.svg" height="14" alt="commit activity" />

c8eff06 replaced the blanket Bash grant with `Bash(<prefix>:*)` rules and documents the list as the remaining control when `--isolation none` is chosen ("the allowlist is the only gate left"; the ledger records "rm is deliberately off the prefix list, so a session cannot clean target/"). Claude Code's prefix rule matches the first word of the command, so `Bash(bash:*)` admits `bash -c '<anything>'`, `Bash(node:*)` admits `node -e`, `Bash(find:*)` admits `find -exec`, `Bash(cargo:*)` admits `cargo run` against the fixture crate, `Bash(just:*)` admits any recipe, and `Bash(git:*)` admits `git -c alias.x='!<cmd>' x` or an alias in the workdir's `.git/config` (a pager override does not fire headlessly). `bash` cannot be removed, because the pipeline itself is launched as `bash <path>/recon`. In sandbox mode the list is moot for a different reason: `autoAllowBashIfSandboxed` is true, so the OS sandbox is the only thing bounding a command (reasoned from the setting's documented semantics, not observed). The list therefore never bounds what a session may run; it only changes which commands stall the transcript. The false claim is what matters: an operator who runs a fixture under `--isolation none` is told a residual gate exists, and the ledger's stated residual is wrong — `bash -c 'rm -rf target'` passes. The reviewer confirmed prefix semantics against the Claude Code permission documentation and the origin against `git log -S'Bash($prefix:*)'`.

```bash evals/scripts/run-eval:194-197
ALLOWED_TOOLS="Read,Write,Edit,Glob,Grep,Task,Skill,TodoWrite"
for prefix in bash node cargo just tokei git ls wc find grep rg head tail diff mkdir; do
  ALLOWED_TOOLS="$ALLOWED_TOOLS,Bash($prefix:*)"
done
```

```bash evals/scripts/run-eval:252-253
if [[ "$ISOLATION" == "none" ]]; then
  echo "  isolation: NONE — session runs with your full user rights, gated only by the command-prefix allowlist" >&2
```

> The operator switched the wall off because the sandbox refused something, and the banner told them a fence was still up. The fence has a gate labelled `bash`.

Related: [Hidden tests and the workspace gate run session-modified code outside the sandbox](#eval-post-session-execution-outside-sandbox), [The --isolation contract promises the allowlist on every platform](#eval-isolation-allowlist-claim-false-on-codex).

**Remediation:** Stop presenting the prefix list as a security boundary. Either drop the prefix rules back to the minimum the pipeline needs and state in the header and the isolation echo that Bash is effectively unrestricted with the OS sandbox as the only confinement; or keep the list for stall-visibility but make `--isolation none` an explicit acknowledgement (require `CASED_EVAL_ISOLATION=none` in the environment together with the flag, and print that the session has full user rights with no command gate). Correct the ledger's residual note in a follow-up entry, not by editing the existing one.

<div>&hairsp;</div>

### Hidden tests and the workspace gate compile and run session-modified code outside the sandbox {#eval-post-session-execution-outside-sandbox}

**advisory** · `evals/scripts/run-eval:326-328`, `evals/scripts/score-eval.mjs:333-335` · effort: medium · <img src="assets/sparkline-eval-post-session-execution-outside-sandbox.svg" height="14" alt="commit activity" />

c8eff06 confines the headless session to a seatbelt/bubblewrap sandbox, and f4812fe stopped the scorer executing a model-authored command string. Neither touches what happens next in remediate mode: run-eval copies the held-out tests into the workdir and runs `cargo test --test <t>` there, and `scoreRemediation` runs the operator's gate command with `cwd` set to the same workdir. Both compile and execute whatever the session left in the tree — `build.rs`, proc-macro crates, tests, `[patch]` or `[dependencies]` entries — as the operator, outside the wall. A session that wants to do something the sandbox refused only has to write it into `build.rs` and wait. The trust statement at the top of run-eval already declares that the scorer trusts the session's artifacts, so this is a documented residual; it is filed because the sandbox fix's ledger entry records the downstream half of the chain as closed by f4812fe, and it is not — the command string is operator-authored, the code it runs is not. Audit mode is unaffected: `scoreArtifacts` executes nothing.

```bash evals/scripts/run-eval:326-328
  for t in "${HIDDEN_TARGETS[@]}"; do
    ( cd "$WORKDIR" && cargo test --test "$t" ) >>"$RUN_DIR/hidden-tests.txt" 2>&1 \
      || HIDDEN_RESULT="fail"
```

```javascript evals/scripts/score-eval.mjs:333-335
    const argv = splitGateCommand(gateCommand);
    try {
      execFileSync(argv[0], argv.slice(1), { cwd: repoRoot, stdio: 'ignore' });
```

> I don't fight the sandbox. I write a `build.rs`, finish the remediation politely, and let the scorer compile it for me thirty seconds later with the operator's keychain in reach.

Related: [The eval runner's Bash prefix allowlist bounds nothing](#eval-bash-allowlist-admits-shell-prefixes).

**Remediation:** Either run the post-session steps inside the same confinement (invoke `cargo test` and the gate command through the platform sandbox with the `SANDBOX_SETTINGS` policy, or through `sandbox-exec`/`bwrap` with an equivalent profile), or record the residual accurately: a follow-up ledger entry for `eval-runner-drives-unsandboxed-headless-session` stating that remediate-mode scoring executes session-modified code with operator rights, and a line in the run-eval header saying the sandbox bounds the session, not the scoring of its output.

<div>&hairsp;</div>

### Recon pre-runner splices sibling audit directory names and paths into manifest.json without JSON escaping {#recon-manifest-json-interpolates-unescaped-names}

**moderate** · `src/recon/recon:101-103`, `src/recon/recon:159` · effort: small · <img src="assets/sparkline-recon-manifest-json-interpolates-unescaped-names.svg" height="14" alt="commit activity" />

The pre-runner writes `manifest.json` by hand with a heredoc and hands it to `recon-to-yaml.mjs`, which `JSON.parse`s it and copies its fields into `recon.yaml` (`meta.commit`, `meta.scope`, `structure.root`, `audit_profile.prior_audit`). `prior_audits` is built from `ls -1` over the audited repository's own `record/audits/` directory: every sibling that contains a `findings.yaml` is emitted as `"<name>"` with no escaping, and that directory is part of the untrusted repository under audit. A sibling named with a double quote makes the manifest unparseable and recon exits 3, aborting the pre-runner from repository content alone. A name shaped like `x"], "commit": "0000000", "scope": "y", "zz": ["z` produces valid JSON in which the later duplicate keys win, so `meta.commit` and `meta.scope` are set by the repository rather than by `git rev-parse`; `target_path` (which becomes `structure.root`) can be overridden the same way only with a slash-free value such as `..`, because a directory name cannot contain `/` — and `structure.root` is the containment base `finalize` passes to `checkEvidenceFidelity` when no `--repo-root` is given. The reviewer confirmed the abort and narrowed the override claim; the original example payload contained a `/` and could not exist as a directory name.

```bash src/recon/recon:101-103
  PRIOR_LIST="$(cd "$AUDITS_ROOT" && ls -1 2>/dev/null \
    | while read -r d; do [[ -f "$d/findings.yaml" && "$d" != "$(basename "$AUDIT_DIR")" ]] && printf '"%s"\n' "$d"; true; done \
    | paste -sd, -)"
```

```bash src/recon/recon:159
  "prior_audits": $PRIOR_JSON,
```

> Directory names are the one thing every repo lets me choose freely. One under `record/audits/` with a quote in it and the auditor's recon dies before it starts; one with a comma and a key in it and the auditor believes it audited a commit of my choosing.

Related: [recon-to-yaml collapses every failure into exit 3](#recon-catch-all-collapses-exit-3).

**Remediation:** Do not template JSON in bash. node is already a required tool: have recon export the values as environment variables and let `recon-to-yaml.mjs` build the manifest object itself, or write `manifest.json` from a one-line `node -e` that `JSON.stringify()`s an object read from `process.env`. Iterate sibling directories with `find -mindepth 1 -maxdepth 1 -type d -print0` rather than `ls -1 | while read` so names with newlines cannot split records. Add a test fixture with a sibling directory named with a quote and a comma and assert `recon.yaml` carries it as one `prior_audit` entry.

*Verdict: Nothing here is a blocker and nothing regressed. But f4812fe fixed one of three sibling replace chains, and the sandbox commit made a claim about its prefix allowlist that the allowlist cannot keep. Both are honest-mistake residue of narrow fixes, and both are trivial.*

<div>&nbsp;</div>

## The Error Handling Surface

*The nine bare catches are bound and the class is back: the evidence gate the whole audit rests on now swallows every git failure into a silent fallback, and the eight prior findings on exit codes and unguarded reads are unchanged at their new line numbers.*

### The evidence gate's commit reader swallows every git failure into a silent working-tree fallback or a false file-missing {#evidence-gate-silent-working-tree-fallback}

**moderate** · `src/viewer/gates.mjs:68-77` · effort: small · <img src="assets/sparkline-evidence-gate-silent-working-tree-fallback.svg" height="14" alt="commit activity" />

b7ade51 made the gate read evidence from `findings.commit` so remediation cannot invalidate an audit's own evidence, and documented a fallback to the working tree when git cannot resolve the commit. The fallback is silent. Line 6 of the evidence is a bare catch that returns null for every reason `git cat-file -e` can fail — git not on PATH, `repoRoot` not a repository, a mistyped or unfetched commit (a shallow CI clone) — and `checkEvidenceFidelity` then reads the working tree without telling anyone which tree it read. Nothing in `finalize`'s or `evidence`'s output says "checked against working tree". Two consequences: before remediation the working tree equals the commit tree, so a wrong `findings.commit` passes the gate unnoticed and ships in the published audit; after remediation the operator gets the same text-mismatch wall that b7ade51 was written to eliminate, with no indication that the commit lookup failed rather than the evidence. Line 8 is the same shape one level down: any failure of `git show` becomes null, which the caller reports as `file-missing` — the exact misattribution the `maxBuffer` comment two lines above says the author was trying to avoid, now applied to every other cause, with stderr discarded so the cause is gone. These two sites are the class ledgered fixed as `bare-catch-erases-failure-cause` in 67c42c8; that fix's nine sites remain bound, and b7ade51 reintroduced the pattern in the gate the whole audit's evidence claim rests on. The api-design agent filed the same defect independently from the contract side: the return value is only the `problems` array, so `evidence` prints `evidence ok`, `finalizeAudit` prints `finalize ok`, and the scorer's `evidence_problems` records 0 for a run whose named commit never resolved. The reviewer probed all four git failure statuses and confirmed each collapses to the same null.

```javascript src/viewer/gates.mjs:68-77
function commitReader(repoRoot, commit) {
  if (typeof commit !== 'string' || !commit) return null;
  // maxBuffer: shipped bundles and lockfiles exceed the 1 MB default, and a
  // truncation throw would be indistinguishable from "path not in commit".
  const run = args => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  try { run(['cat-file', '-e', `${commit}^{commit}`]); } catch { return null; }
  return p => {
    try { return run(['show', `${commit}:./${p}`]).split('\n'); } catch { return null; }
  };
}
```

Related: [build-subcommand-unguarded-io](#build-subcommand-unguarded-io), [The repo-relative path rule lives in two implementations](#evidence-path-rule-implemented-twice).

**Remediation:** Bind the error in both catches. For `cat-file`: distinguish `e.code === 'ENOENT'` (git missing) and status 128 (no repo / unknown object) from everything else, and in every case `console.warn` one line naming the commit, the root and the cause before returning null, so `finalize` output always says which tree was checked. Make the tree part of the contract: either return `{ source, commit, problems }` and have `evidence`/`finalize` print `evidence ok against 9f7e30a` vs `… against working tree — commit not resolvable`, or push a `commit-unresolved` problem when `doc.commit` is set but cannot be resolved, so a mistyped SHA is an error and only the no-commit/no-git case degrades. Have the scorer surface the source beside `evidence_problems`. For `show`: treat status 128 as file-missing and rethrow anything else with captured stderr.

<div>&hairsp;</div>

### The sandbox advisory-db refresh runs a full cargo audit with output discarded, so a found advisory is reported as a failed refresh and a real failure has no cause {#advisory-db-refresh-warning-conflates-scan-and-fetch}

**advisory** · `evals/scripts/run-eval:116-125` · effort: trivial · <img src="assets/sparkline-advisory-db-refresh-warning-conflates-scan-and-fetch.svg" height="14" alt="commit activity" />

7b3e626 moved the advisory-database refresh outside the sandbox because cargo-audit's fetch does not traverse the sandbox proxy. The refresh is implemented as a complete `cargo audit` run against the fixture lockfile with stdout and stderr sent to `/dev/null`. cargo-audit exits 1 when it finds an advisory, which is the outcome an advisory database exists to produce: the day any pinned crate acquires a RUSTSEC entry, every run prints "advisory-db refresh failed; the session's cargo audit will run stale" although the fetch succeeded. In the other direction, when the fetch really fails, the discarded stderr means the operator gets the same one-line warning with no cause. The two fixtures that carry a `Cargo.lock` seed no advisories today, which is why the baseline run saw neither symptom. The reviewer corrected the installed cargo-audit version (0.22.2) and confirmed both that `cargo audit fetch` is not a subcommand and that a hard error exits 2.

```bash evals/scripts/run-eval:116-125
if [[ "$ISOLATION" == "sandbox" && -f "$WORKDIR/Cargo.lock" ]]; then
  if command -v cargo-audit >/dev/null 2>&1; then
    (cd "$RUN_DIR" && cargo audit -q -f "$WORKDIR/Cargo.lock" >/dev/null 2>&1) \
      || echo "warn: advisory-db refresh failed; the session's cargo audit will run stale" >&2
  fi
  if [[ ! -e "$WORKDIR/.cargo/audit.toml" ]]; then
    mkdir -p "$WORKDIR/.cargo"
    printf '[database]\nfetch = false\nstale = true\n' > "$WORKDIR/.cargo/audit.toml"
  fi
fi
```

Related: [run-eval has no external CLI preflight](#eval-runner-no-external-cli-preflight-check).

**Remediation:** Refresh with a fetch-only step rather than a scan. cargo-audit 0.22.2 has no `fetch` subcommand, so either update the database directly — `git -C ~/.cargo/advisory-db pull --ff-only -q`; it is an ordinary git clone — or keep the scan and read its exit status honestly: 1 means advisories found (fetch succeeded), a hard error such as a missing lockfile exits 2 (probed); the exit status of a failed *fetch* was not probed and needs a network-down run before a threshold is relied on. Capture stderr to `"$RUN_DIR/advisory-db-fetch.txt"` and print its last lines in the warning.

<div>&hairsp;</div>

### The scorer's workspace gate distinguishes 'could not start' from 'failed' by ENOENT alone and records nothing about why a gate failed {#gate-start-failure-detected-by-enoent-only}

**note** · `evals/scripts/score-eval.mjs:334-341` · effort: trivial · <img src="assets/sparkline-gate-start-failure-detected-by-enoent-only.svg" height="14" alt="commit activity" />

67c42c8 added `workspace_gate_error` so a missing gate binary and a failing gate are distinguishable, and the comment states the intended rule: a gate that could not start is not a gate that failed. The implementation checks one errno. A spawn failure for any other reason — the gate script present but not executable (EACCES, the same lost-exec-bit case run-eval guards against for `setup.sh`), a path component that is a file (ENOTDIR), a child killed by a signal — leaves `gateError` null and `workspace_gate_pass: false`, scored as the session having broken the build. Independently, `stdio: 'ignore'` discards the gate's output, so a genuine failure is recorded as a bare boolean with nothing in the run directory to say what failed.

```javascript evals/scripts/score-eval.mjs:334-341
    try {
      execFileSync(argv[0], argv.slice(1), { cwd: repoRoot, stdio: 'ignore' });
      gatePass = true;
    } catch (e) {
      gatePass = false;
      // A gate that could not start is not a gate that failed.
      if (e.code === 'ENOENT') gateError = `gate command not found: ${argv[0]}`;
    }
```

**Remediation:** Use the spawn/exit distinction Node already provides: `e.status == null` means the process never ran or was signalled; set `gateError` from `e.code` or `e.signal` in that case. Capture output with `stdio: ['ignore','pipe','pipe']` and store the last ~20 lines of stderr in a `workspace_gate_output` field so a failing gate is diagnosable from `score.json`.

<div>&hairsp;</div>

### The build-report CLI still has no rejection handler, so every failure the fixes now throw exits as a raw stack trace with a meaningless exit code {#build-subcommand-unguarded-io}

**moderate** · `src/viewer/build-report.mjs:1044-1045`, `src/viewer/build-report.mjs:1132-1134`, `src/viewer/prior-audits.mjs:74-75` · effort: small · <img src="assets/sparkline-build-subcommand-unguarded-io.svg" height="14" alt="commit activity" />

Still open, and sharper than at 2365a3f. The whole CLI body remains an async IIFE with no `.catch()`, so any throw becomes an unhandled promise rejection: Node prints the raw stack and exits 1, the same code the script uses for "usage error" and "gate failed". Since the prior audit two fixes routed more failures into exactly this path: 67c42c8 made `ledger`'s gitLog throw on any non-128 git failure, and 44b419c made `build` throw on a document that fails the schema — both correct decisions, both now surfacing as a traceback rather than the `error: …` line the other subcommands print for their preflights. The mismatch 67c42c8 left is visible in the third location: `countFindings` was bound (warn with path, return null, finalize errors on null), but the `parseLedger(readFileSync(...))` one line below it was not. A sibling audit's `actions-taken.md` with a tab in its front matter makes `yaml.parse` throw, and because `findPriorAudits` scans every sibling, `build` and `finalize` of a *different* audit crash with a YAMLParseError that names a line and column but no file.

```javascript src/viewer/build-report.mjs:1044-1045
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
```

```javascript src/viewer/build-report.mjs:1132-1134
          if (e.status === 128) return { exists: false, trailers: [] };
          throw new Error(`git log failed for ${sha} in ${root}: ${e.message}`);
        }
```

```javascript src/viewer/prior-audits.mjs:74-75
      findingCount: countFindings(join(dir, 'findings.yaml')),
      ledger: hasLedger ? parseLedger(readFileSync(ledgerPath, 'utf8')) : null,
```

Related: [fonts-dir-resolution-unguarded](#fonts-dir-resolution-unguarded), [build-report-subcommand-fallback](#build-report-subcommand-fallback), [evidence-gate-silent-working-tree-fallback](#evidence-gate-silent-working-tree-fallback).

**Remediation:** Append `.catch(err => { console.error(`error: ${err.message}`); process.exit(1); })` to the IIFE, guard the ledger read in `findPriorAudits` the way `countFindings` is guarded — bind the error, warn with `ledgerPath`, return a ledger object flagged unparseable so finalize can error on it by name — and settle one exit code for "input missing/unreadable" (2) and one for "gate failed" (1) across all five subcommands, stated in the usage text.

<div>&hairsp;</div>

### Font directory resolution can yield undefined and crashes in path.join instead of failing like its sibling check {#fonts-dir-resolution-unguarded}

**moderate** · `src/viewer/build-report.mjs:1163-1173`, `src/viewer/build-report.mjs:954-956` · effort: trivial · <img src="assets/sparkline-fonts-dir-resolution-unguarded.svg" height="14" alt="commit activity" />

Unchanged since the prior audit apart from line numbers. Two adjacent candidate-list resolutions are handled asymmetrically: `viewerDir` gets an explicit guard with an actionable message and exit 1; `fontsDir`, resolved by the same `find` idiom six lines later, gets nothing, and returns undefined when none of the three directories exist. That undefined reaches `join(fontsDir, file)` inside `assembleReport`, where Node throws `ERR_INVALID_ARG_TYPE` from a `.map()` callback, naming neither fonts nor the three paths searched. The same block reads each woff2 without checking it exists, so a fonts directory that is present but incomplete produces an equally contextless ENOENT. 44b419c's schema validation now runs before this point, so a well-formed audit with a broken skill install fails *after* validation succeeds, which reads as a renderer bug.

```javascript src/viewer/build-report.mjs:1163-1173
    const viewerDir = viewerDirCandidates.find(d => existsSync(join(d, 'template.html')));
    if (!viewerDir) {
      console.error('Cannot find template.html relative to script');
      process.exit(1);
    }
    const fontsDirCandidates = [
      join(viewerDir, 'fonts'),
      join(scriptDir, 'fonts'),
      join(repoRoot, 'vendor', 'fonts'),
    ];
    const fontsDir = fontsDirCandidates.find(d => existsSync(d));
```

```javascript src/viewer/build-report.mjs:954-956
  const fontFaceDecls = fontFiles.map(({ file, family }) => {
    const fontPath = join(fontsDir, file);
    const b64 = readFileSync(fontPath).toString('base64');
```

Related: [build-subcommand-unguarded-io](#build-subcommand-unguarded-io).

**Remediation:** Mirror the `viewerDir` guard: `if (!fontsDir) { console.error('Cannot find a fonts directory; looked in: ' + fontsDirCandidates.join(', ')); process.exit(1); }`. In `assembleReport`, check each font file exists before reading and throw an Error naming the missing file and the resolved `fontsDir`.

<div>&hairsp;</div>

### A scorer crash leaves a zero-byte score.json that defeats compare-runs' own 'did run-eval finish?' guard {#score-json-truncated-by-redirect}

**moderate** · `evals/scripts/run-eval:371-374`, `evals/scripts/compare-runs.mjs:14-18` · effort: trivial · <img src="assets/sparkline-score-json-truncated-by-redirect.svg" height="14" alt="commit activity" />

Unchanged since the prior audit; both redirect sites moved with the sandbox additions and `compare-runs.mjs` is untouched. The shell creates and truncates `score.json` before `score-eval.mjs` runs. If the scorer then exits non-zero — a usage error, a malformed `findings.yaml` from the session under test, a throw from `finalizeAudit` or from the non-128 git failures 67c42c8 made `fixCommits` raise — `set -e` aborts run-eval, but the empty file it already created stays behind at the end of a run that cost minutes and real token spend. compare-runs' `existsSync` check was written for exactly this failure; a zero-byte file passes it, and the operator instead gets `SyntaxError: Unexpected end of JSON input`, pointing at the JSON parser rather than at the run that never scored.

```bash evals/scripts/run-eval:371-374
  node "$EVALS_DIR/scripts/score-eval.mjs" "$FIXTURE_DIR" "${SCORE_ARGS[@]}" --json \
    > "$RUN_DIR/score.json"
  node "$EVALS_DIR/scripts/score-eval.mjs" "$FIXTURE_DIR" "${SCORE_ARGS[@]}" \
    | tee "$RUN_DIR/score.txt"
```

```javascript evals/scripts/compare-runs.mjs:14-18
  const scorePath = join(dir, 'score.json');
  if (!existsSync(scorePath)) {
    throw new Error(`${dir}: no score.json (did run-eval finish?)`);
  }
  const score = JSON.parse(readFileSync(scorePath, 'utf8'));
```

Enabled by [Both eval CLIs gate main() on a raw string compare](#entrypoint-guard-unresolved-path).

**Remediation:** Score to a temp file and move it into place only on success (`> score.json.tmp && mv`), with a trap removing the `.tmp` on abort. Independently, harden `loadRun` to treat an empty or unparseable `score.json` as the same "did run-eval finish?" condition rather than letting `SyntaxError` escape.

<div>&hairsp;</div>

### The stray-file hygiene gate reports a clean run when git itself fails {#hygiene-gate-swallows-git-failure}

**moderate** · `evals/scripts/run-eval:299-305` · effort: trivial · <img src="assets/sparkline-hygiene-gate-swallows-git-failure.svg" height="14" alt="commit activity" />

Unchanged since the prior audit apart from line numbers. The `|| true` is needed because the final grep exits 1 in the good case, but under `set -o pipefail` it also absorbs a failure of any earlier stage. If `git status` fails — the workdir's `.git` rewritten by a fixture `setup.sh`, a lock file left by an interrupted git command inside the sandbox — `STRAYS` is empty, `STRAY_COUNT` is 0, and the run records `stray_file_count: 0`: the same output as a perfectly clean run. Workspace hygiene is scored as a contract violation, so the measurement silently reports the best possible result whenever its own instrumentation breaks.

```bash evals/scripts/run-eval:299-305
SANCTIONED='^record/audits/[^/]+/(README\.md|report\.html|AGENTS\.md|CLAUDE\.md|recon\.yaml|findings\.yaml|actions-taken\.md|assets/sparkline-[^/]+\.svg)$'
STRAYS="$(git -C "$WORKDIR" status --porcelain -uall \
  | sed 's/^...//' \
  | grep -vE '^(\.crustoleum/|target/)' \
  | grep -vE "$SANCTIONED" || true)"
STRAY_COUNT=0
[[ -n "$STRAYS" ]] && STRAY_COUNT="$(echo "$STRAYS" | wc -l | tr -d ' ')"
```

**Remediation:** Capture git's status separately from grep's: `PORCELAIN="$(git -C "$WORKDIR" status --porcelain -uall)" || { echo "error: git status failed in $WORKDIR" >&2; exit 1; }`, then filter `$PORCELAIN` through the two greps with `|| true` applied only to the filtering stage. Alternatively record `stray_file_count: unknown` when the git call fails, so the scorer can refuse to credit the run.

<div>&hairsp;</div>

### Both eval CLIs gate main() on a raw string compare that fails silently with exit 0 {#entrypoint-guard-unresolved-path}

**moderate** · `evals/scripts/score-eval.mjs:530-532`, `evals/scripts/compare-runs.mjs:149-151` · effort: trivial · <img src="assets/sparkline-entrypoint-guard-unresolved-path.svg" height="14" alt="commit activity" />

Unchanged since the prior audit. `import.meta.url` is a percent-encoded URL; `process.argv[1]` is a raw filesystem path and is not symlink-resolved. The two diverge whenever the repo lives under a path containing a space, a `#`, or any non-ASCII character, and whenever the script is reached through a symlink. When they diverge `main()` never runs, the process exits 0, and nothing is printed; run-eval redirects that empty stdout straight into `score.json`, so a run silently produces an empty score file and reports success. The other two entry points already use the correct idiom — `build-report.mjs` and `recon-to-yaml.mjs` compare `realpathSync` of both sides — so this remains a two-site inconsistency with a known-good sibling.

```javascript evals/scripts/score-eval.mjs:530-532
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

```javascript evals/scripts/compare-runs.mjs:149-151
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

Enables [A scorer crash leaves a zero-byte score.json](#score-json-truncated-by-redirect).

**Remediation:** Replace both guards with the idiom used in `src/`: `if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))`. Optionally have run-eval assert `-s "$RUN_DIR/score.json"` after each scorer invocation so a silent no-op can never be recorded as a run.

<div>&hairsp;</div>

### recon-to-yaml collapses every failure into exit 3 and prints only err.message, contradicting recon's documented exit codes {#recon-catch-all-collapses-exit-3}

**moderate** · `src/recon/recon:10-15`, `src/recon/recon-to-yaml.mjs:705-708` · effort: small · <img src="assets/sparkline-recon-catch-all-collapses-exit-3.svg" height="14" alt="commit activity" />

Unchanged since the prior audit; the catch moved two lines with 67c42c8's detector warnings. The pre-runner publishes a four-code taxonomy and `exec`s `recon-to-yaml.mjs` as its final step, so the Node script's exit code *is* recon's exit code. That script wraps its entire body in one catch that exits 3, the code documented as "required tool missing or tool failed". Every unrelated failure therefore claims a tool problem: malformed tokei or cargo JSON, a TypeError from an unexpected cargo metadata shape, an unwritable audit directory. Printing only `err.message` compounds it — a caller sees `recon: Cannot read properties of undefined (reading 'slice')` and exit 3, with no stack, no file name, and a documented meaning that points them at their PATH.

```bash src/recon/recon:10-15
# Exit codes:
#   0  success — <audit-dir>/recon.yaml written and validated
#   1  usage error
#   2  not a Rust project (no Cargo.toml in target)
#   3  required tool missing or tool failed
#   4  validation failure (propagated from recon-to-yaml.mjs)
```

```javascript src/recon/recon-to-yaml.mjs:705-708
  } catch (err) {
    console.error(`recon: ${err.message}`);
    process.exit(3);
  }
```

Related: [recon's exec hand-off discards the EXIT trap](#recon-exec-skips-tmp-cleanup), [Recon pre-runner splices sibling names into manifest.json](#recon-manifest-json-interpolates-unescaped-names).

**Remediation:** Give the catch distinct exits: keep 3 for genuinely missing/failed tooling inputs (ENOENT on the temp-dir files), add a code for "internal error while assembling recon.yaml", and print `err.stack` so the failing step is identifiable. Update the exit-code block in `src/recon/recon` to match.

<div>&hairsp;</div>

### The fixture's EXIT trap deletes the only copy of the files it moved out of the workdir {#setup-trap-deletes-only-copy}

**advisory** · `evals/fixtures/reaudit-rs/setup.sh:78-85` · effort: trivial · <img src="assets/sparkline-setup-trap-deletes-only-copy.svg" height="14" alt="commit activity" />

Unchanged since the prior audit; the file has not been touched. Lines 84-85 move — not copy — the unsubstituted ledger and the entire prior-audit directory into `$STASH`, and the script has already run `rm -rf .git`. The EXIT trap fires on the failure path as readily as on success, so any abort between here and the restore deletes the only copy of the moved artifacts. The comment acknowledges the workdir becomes unrecoverable, but the trap is what makes it unrecoverable: without it the operator could restore from `$STASH`.

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

**Remediation:** Use `cp -a` instead of `mv` for the ledger and audit directory, or make the trap conditional on a `SUCCESS=1` flag set before the final consistency checks, printing "setup.sh failed; originals preserved in $STASH" otherwise. Also add cleanup for the per-edit temp file created at line 60.

<div>&hairsp;</div>

### recon's exec hand-off discards the EXIT trap, leaking its temp directory on every successful run {#recon-exec-skips-tmp-cleanup}

**advisory** · `src/recon/recon:56-57`, `src/recon/recon:164-165` · effort: trivial · <img src="assets/sparkline-recon-exec-skips-tmp-cleanup.svg" height="14" alt="commit activity" />

Unchanged since the prior audit. `exec` replaces the shell process image, so the EXIT trap registered at line 57 never fires. Every run that reaches line 165 — every successful run, and every run that fails inside `recon-to-yaml.mjs` — leaves its mktemp directory behind holding the full cargo metadata, tokei output, and twelve months of git log for the audited project. Only the early-exit paths clean up, so the trap protects the cheap cases and abandons the expensive one.

```bash src/recon/recon:56-57
TMP="$(mktemp -d -t cased-recon.XXXXXXXX)"
trap 'rm -rf "$TMP"' EXIT
```

```bash src/recon/recon:164-165
echo "recon: building recon.yaml"
exec node "$SCRIPT_DIR/recon-to-yaml.mjs" "$TMP" "$AUDIT_DIR/recon.yaml"
```

Related: [recon-to-yaml collapses every failure into exit 3](#recon-catch-all-collapses-exit-3).

**Remediation:** Drop the `exec` and run the node script normally so the trap fires, letting its exit status propagate under `set -e` — or keep `exec` and delete `$TMP` explicitly before it, passing the assembled inputs by another route.

*Verdict: Still-fixed on the ledgered slug, and the sharpest new finding of the pass is in the fix that made evidence durable. Nothing loses data; two things now report the wrong cause with more confidence than before. The eight carried-over moderates and advisories remain mechanical.*

<div>&nbsp;</div>

## The Code Quality Surface

*The seven prior findings are all still present at their new line numbers; the batch edited beside every one of them and touched none, and in one case made the CLI monolith parse the same two files three times.*

### build-report.mjs still ends in a ~200-line untestable CLI closure that parses findings.yaml three times per build {#build-report-cli-monolith}

**moderate** · `src/viewer/build-report.mjs:1043-1056`, `src/viewer/build-report.mjs:1156-1167` · effort: medium · <img src="assets/sparkline-build-report-cli-monolith.svg" height="14" alt="commit activity" />

Unchanged since the prior audit. The anonymous async IIFE now spans lines 1043–1241: argv parsing, five subcommand handlers, three candidate-path searches and four conditional writes with different overwrite policies, none of it exported and none of it tested. The remediation batch made the block slightly worse rather than better: `assembleReport` (44b419c) now runs `validateAuditDir`, which reads and parses `findings.yaml` and `recon.yaml`, then `assembleReport` parses both again, and the build handler parses both a third time to render AGENTS.md and the README scaffold. Three parses of the same two files in one `build` is a symptom of the handler having no shape to hand a parsed document through. A bare directory is still treated as `build`, so a typo'd subcommand silently builds a directory by that name, and `--allow-unledgered-prior` is matched with `rawArgs.includes`, so it is honoured by `finalize` and silently ignored by every other subcommand.

```javascript src/viewer/build-report.mjs:1043-1056
// CLI entry point (resolve symlinks so skill installs work)
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
    // Parse subcommand: `validate <dir>` or `build <dir>`; bare `<dir>` is
    // treated as `build` for backward compatibility.
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

```javascript src/viewer/build-report.mjs:1156-1167
    // build subcommand (default)
    // Viewer dir: source layout has template.html alongside this script;
    // skill layout has it in ../templates/ relative to scripts/
    const viewerDirCandidates = [
      scriptDir,
      join(scriptDir, '..', 'templates'),
    ];
    const viewerDir = viewerDirCandidates.find(d => existsSync(join(d, 'template.html')));
    if (!viewerDir) {
      console.error('Cannot find template.html relative to script');
      process.exit(1);
    }
```

Related: [finalize-gate-branches-untested](#finalize-gate-branches-untested), [agents-readme-render-duplication](#agents-readme-render-duplication), [build-report-subcommand-fallback](#build-report-subcommand-fallback).

**Remediation:** Extract the closure body into exported functions — `parseCliArgs(argv)` returning `{subcommand, auditDir, flags}` and rejecting unknown subcommands, one `runX(auditDir, opts)` per subcommand, and `resolveLayout(scriptDir, repoRoot)` — leaving the guard as a five-line dispatcher. Have `assembleReport` accept an already-parsed `{findings, recon}` so the build handler parses each file once. Then unit-test argument parsing and layout resolution against synthetic directory trees.

<div>&hairsp;</div>

### renderAgentsMd and renderReadmeMd still duplicate metadata assembly; the fix touched one twin and left the pair {#agents-readme-render-duplication}

**moderate** · `src/viewer/build-report.mjs:725-740`, `src/viewer/build-report.mjs:770-782` · effort: small · <img src="assets/sparkline-agents-readme-render-duplication.svg" height="14" alt="commit activity" />

Still present. Both renderers compute `auditTitle`, hand-roll the same `findingCount` loop, call `renderAgentsFindingList`, destructure `blockingCounts`, and build `priorList` from a byte-identical expression; below the cited ranges nine placeholder keys are wired twice in parallel `.replaceAll` chains. The ledgered fix for `summary-counts-never-cross-checked` (44b419c) is the first drift event after the finding was filed: it changed one line in `renderReadmeMd` from `findings.summary?.counts || {}` to `concernCounts(findings)` and left the duplicated assembly on either side of that line in place. The asymmetry the prior audit named — `{{reconciliation_table}}` is wired for the README and nowhere in `renderAgentsMd` — is unchanged, so a reconciliation block still reaches the human-facing README and never the agent-facing briefing.

```javascript src/viewer/build-report.mjs:725-740
export function renderAgentsMd(findings, templateStr, auditSlug, { recon = null, priorAudits = [] } = {}) {
  const auditTitle = titleFromScope(findings.scope);
  let findingCount = 0;
  for (const n of findings.narratives || []) {
    findingCount += (n.findings || []).length;
  }
  const findingList = renderAgentsFindingList(findings);

  const { blocking, backlog } = blockingCounts(findings);
  const testCommand = recon?.testing?.command || '<recon.yaml#testing.command not detected — use the project task runner>';
  const mode = recon?.meta?.audit_profile?.mode ?? 'fresh';
  const phase = recon?.meta?.audit_profile?.release_phase;
  const releasePhase = (!phase || phase === 'unspecified') ? RELEASE_PHASE_UNKNOWN : phase;
  const priorList = priorAudits.length
    ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n')
    : '_none_';
```

```javascript src/viewer/build-report.mjs:770-782
export function renderReadmeMd(findings, templateStr, { priorAudits = [] } = {}) {
  const auditTitle = titleFromScope(findings.scope);
  const narratives = findings.narratives || [];
  let findingCount = 0;
  for (const n of narratives) {
    findingCount += (n.findings || []).length;
  }
  const counts = concernCounts(findings);
  const findingList = renderAgentsFindingList(findings);
  const { blocking, backlog } = blockingCounts(findings);
  const priorList = priorAudits.length
    ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n')
    : '_none_';
```

Related: [build-report-cli-monolith](#build-report-cli-monolith), [untested-render-and-escape-exports](#untested-render-and-escape-exports), [flat-findings-traversal-reimplemented](#flat-findings-traversal-reimplemented), [markdown-renderers-interpret-dollar-patterns](#markdown-renderers-interpret-dollar-patterns).

**Remediation:** Extract a shared `auditTemplateVars(findings, {recon, auditSlug, priorAudits})` returning the full key→value map, and reduce both renderers to `interpolate(templateStr, vars)`. Add a test asserting that every `{{...}}` placeholder in both templates is a key of the vars map, which turns the `{{reconciliation_table}}` asymmetry into a decision. This is the same change the security finding above wants, from the other direction.

<div>&hairsp;</div>

### escHtml, generateSparklines, and the non-link half of renderProse remain untested after the link tests landed {#untested-render-and-escape-exports}

**advisory** · `src/viewer/build-report.mjs:205-207`, `src/viewer/build-report.mjs:218-224`, `src/viewer/build-report.mjs:601-603` · effort: small · <img src="assets/sparkline-untested-render-and-escape-exports.svg" height="14" alt="commit activity" />

Partially and incidentally narrowed by the remediation batch, so the concern drops from moderate to advisory but the slug stays open. 44b419c added link allow/deny tests and one README count test; the `renderHeader` escaping tests exercise `escHtml` transitively. Still not covered: `escHtml` directly (the test file imports it but uses it only to build an expected string — an oracle, not a subject, so a regression in the escaper moves the oracle and the assertion together); `renderProse` for bold, code, adjacent and nested markers, unbalanced delimiters, and raw HTML between markers; and `generateSparklines`, which writes files into the audit directory and divides by `commits.length - 1`, with zero tests.

```javascript src/viewer/build-report.mjs:205-207
export function escHtml(s) {
  if (s == null) return '';
  return String(s)
```

```javascript src/viewer/build-report.mjs:218-224
export function renderProse(s) {
  if (s == null) return '';
  const str = String(s);

  const tokens = [];
  let lastIndex = 0;
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
```

```javascript src/viewer/build-report.mjs:601-603
export function generateSparklines(auditDir, findings) {
  const assetsDir = join(auditDir, 'assets');
  let count = 0;
```

**Remediation:** Table-driven cases: `escHtml` over `& < > "` plus null/undefined/number; `renderProse` over plain text, each marker type, adjacent and nested markers, unbalanced delimiters, and raw HTML outside any marker; `generateSparklines` against a temp dir asserting file names, the all-zero series, and a wrong-length `monthly_commits` being skipped.

<div>&hairsp;</div>

### Three finalizeAudit gate branches still untested; the one test that passes allowUnledgeredPrior does so in a state where the branch cannot fire {#finalize-gate-branches-untested}

**moderate** · `src/viewer/build-report.mjs:841-846`, `src/viewer/build-report.mjs:848-857`, `src/viewer/build-report.mjs:859-866`, `test/build-report.test.mjs:501-506` · effort: small · <img src="assets/sparkline-finalize-gate-branches-untested.svg" height="14" alt="commit activity" />

Still present, with one misleading near-miss. The ledgered fix for `bare-catch-erases-failure-cause` (67c42c8) added the `findingCount === null` branch and a test for it; that test is the only place `allowUnledgeredPrior` appears under `test/`, and it passes the flag as `true` in a state where the branch it controls cannot execute: the prior audit has an `actions-taken.md` and an unparseable `findings.yaml`, so control hits the `continue` before the ternary. A reader grepping for coverage of the override flag would find a hit and stop. The `origin.ref` requirement and the regressed-without-recurrence cross-check have no test at all. This verification pass is the first document to exercise the re-audit branch live.

```javascript src/viewer/build-report.mjs:841-846
  // origin refs required for causal kinds (belt-and-braces if the schema's if/then was dropped)
  for (const f of allFindings(findings)) {
    if (f.origin && ['caused-by-fix', 'recurrence-of'].includes(f.origin.kind) && !f.origin.ref) {
      errors.push(`${f.slug}: origin.kind ${f.origin.kind} requires origin.ref`);
    }
  }
```

```javascript src/viewer/build-report.mjs:848-857
  const prior = findPriorAudits(join(auditDir, '..'), basename(auditDir));
  for (const p of prior) {
    if (p.findingCount === null) {
      errors.push(`prior audit ${p.slug} has an unreadable findings.yaml — cannot tell whether its findings were dispositioned`);
      continue;
    }
    if (p.findingCount > 0 && !p.hasLedger) {
      (allowUnledgeredPrior ? warnings : errors).push(`prior audit ${p.slug} has ${p.findingCount} findings and no actions-taken.md — its findings are untracked (pass --allow-unledgered-prior to override)`);
    }
  }
```

```javascript src/viewer/build-report.mjs:859-866
  if (recon?.meta?.audit_profile?.mode === 're-audit') {
    if (!findings.reconciliation) errors.push('re-audit mode but findings.yaml has no reconciliation block — every ledgered prior fix needs a still-fixed/regressed/superseded/not-verified row');
    const regressed = (findings.reconciliation ?? []).filter(r => r.status === 'regressed').map(r => r.prior_slug);
    const recurrences = new Set(allFindings(findings).filter(f => f.origin?.kind === 'recurrence-of').map(f => f.origin.ref));
    for (const s of regressed) {
      if (!recurrences.has(s)) errors.push(`reconciliation marks ${s} regressed but no finding carries origin {kind: recurrence-of, ref: ${s}}`);
    }
  }
```

```javascript test/build-report.test.mjs:501-506
    // Self-audit 2026-08-28 (bare-catch-erases-failure-cause): an unreadable
    // prior findings.yaml must fail the gate, not count as zero findings.
    writeFileSync(join(prior, 'findings.yaml'), 'narratives: [\n  - {slug: old\n');
    r = finalizeAudit(cur, { repoRoot: repo, allowUnledgeredPrior: true });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /2026-08-01-10-prior/.test(e) && /unreadable/.test(e)));
```

Related: [build-report-cli-monolith](#build-report-cli-monolith), [finalize-skips-ledger-commit-verification](#finalize-skips-ledger-commit-verification).

**Remediation:** Extend `describe('finalizeAudit')` with three cases on the temp-repo helper already there: an unledgered prior with a parseable `findings.yaml` asserted to land in `errors` without the flag and in `warnings` with it; a `recurrence-of` finding with no `ref` asserted to error; and a re-audit whose reconciliation marks a slug `regressed` while no finding carries the matching origin, asserted to error, plus the paired passing case.

<div>&hairsp;</div>

### build-viewer.sh still maintains two hand-synchronised copies of the same asset list {#build-viewer-parallel-copy-lists}

**advisory** · `scripts/build-viewer.sh:18-22`, `scripts/build-viewer.sh:35-39` · effort: trivial · <img src="assets/sparkline-build-viewer-parallel-copy-lists.svg" height="14" alt="commit activity" />

Unchanged since the prior audit; 67c42c8 inserted the third-party-notices step between the two blocks without touching either. A sixth template added to only the `build/` block yields a shipped skill that silently lacks it: `check-bundle` diffs `skills/cased/` and a never-copied file produces no diff; `build-smoke` runs against `build/`, the branch that did get it. Both gates report green and the omission surfaces only on skill install.

```bash scripts/build-viewer.sh:18-22
cp src/viewer/template.html         build/template.html
cp src/viewer/agents-md-template.md build/agents-md-template.md
cp src/viewer/readme-template.md    build/readme-template.md
cp src/viewer/style.css             build/style.css
cp vendor/fonts/*.woff2             build/fonts/
```

```bash scripts/build-viewer.sh:35-39
cp src/viewer/template.html         skills/cased/templates/template.html
cp src/viewer/agents-md-template.md skills/cased/templates/agents-md-template.md
cp src/viewer/readme-template.md    skills/cased/templates/readme-template.md
cp src/viewer/style.css             skills/cased/templates/style.css
cp vendor/fonts/*.woff2             skills/cased/templates/fonts/
```

Related: [notices-header-names-build-paths-not-shipped-ones](#notices-header-names-build-paths-not-shipped-ones).

**Remediation:** Drive both destinations from one array with a `for dest in build skills/cased/templates` loop, and have `check-bundle` assert that `skills/cased/templates/` contains exactly the expected file set.

<div>&hairsp;</div>

### detectNpmTest still computes the project's real test command and its caller still throws it away {#detect-npm-test-command-discarded}

**note** · `src/recon/recon-to-yaml.mjs:334-342`, `src/recon/recon-to-yaml.mjs:482-486` · effort: trivial · <img src="assets/sparkline-detect-npm-test-command-discarded.svg" height="14" alt="commit activity" />

Unchanged. 67c42c8 edited the `catch` immediately below the cited range and left the return shape alone. `detectNpmTest` returns `{ command: pkg.scripts.test }`; the only caller tests it for truthiness and passes the literal `'npm test'`. Three conventions across four parallel detectors, one carrying a field that is computed and dropped.

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

```javascript src/recon/recon-to-yaml.mjs:482-486
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg?.scripts?.test && typeof pkg.scripts.test === 'string') {
      return { command: pkg.scripts.test };
    }
```

**Remediation:** Make `detectNpmTest` return `{ source: 'package.json' }` only, matching `detectJustTest`, or pass `npmResult.command` through. State the chosen return-shape convention in the `detectTesting` doc comment.

<div>&hairsp;</div>

### The narratives-to-findings flatten is still reimplemented beside the allFindings helper {#flat-findings-traversal-reimplemented}

**note** · `src/viewer/gates.mjs:15-17`, `src/viewer/prior-audits.mjs:55`, `src/viewer/build-report.mjs:916-921`, `evals/scripts/score-eval.mjs:49-54`, `evals/scripts/score-eval.mjs:134`, `src/viewer/build-report.mjs:496-497`, `src/viewer/build-report.mjs:604-605` · effort: trivial · <img src="assets/sparkline-flat-findings-traversal-reimplemented.svg" height="14" alt="commit activity" />

Unchanged, and wider than filed: the reviewer's class sweep found two more hand-rolled walks in `build-report.mjs` (`ledgerRows` and `generateSparklines`), so six copies sit beside the exported helper, two of them in `score-eval.mjs` which already imports `allFindings`. Meanwhile the remediation batch added a fifth *correct* consumer — `concernCounts` uses `allFindings` — so the module that defines the rule keeps following it while its neighbours do not. Null-handling has already diverged (`??` vs `||`).

```javascript src/viewer/gates.mjs:15-17
export function allFindings(doc) {
  return (doc.narratives ?? []).flatMap(n => n.findings ?? []);
}
```

```javascript src/viewer/prior-audits.mjs:55
    return (doc.narratives ?? []).reduce((n, nar) => n + (nar.findings ?? []).length, 0);
```

```javascript src/viewer/build-report.mjs:916-921
  const slugToTitle = {};
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
      slugToTitle[f.slug] = f.title;
    }
  }
```

```javascript evals/scripts/score-eval.mjs:49-54
  const findings = [];
  for (const narrative of findingsDoc.narratives ?? []) {
    for (const f of narrative.findings ?? []) {
      findings.push(f);
    }
  }
```

```javascript evals/scripts/score-eval.mjs:134
  const findings = (findingsDoc.narratives ?? []).flatMap(n => n.findings ?? []);
```

```javascript src/viewer/build-report.mjs:496-497
  for (const narrative of (findings.narratives || [])) {
    for (const finding of (narrative.findings || [])) {
```

```javascript src/viewer/build-report.mjs:604-605
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
```

Related: [disposition-vocabulary-triplicated](#disposition-vocabulary-triplicated), [agents-readme-render-duplication](#agents-readme-render-duplication).

**Remediation:** Import `allFindings` at every site that can. For `prior-audits.mjs`, importing from `gates.mjs` would create a cycle — move `allFindings` into a small shared module imported by both.

<div>&hairsp;</div>

### renderHeader's JSDoc is stacked on buildGlossary and describes the wrong function {#header-jsdoc-orphaned-on-glossary}

**note** · `src/viewer/build-report.mjs:351-359` · effort: trivial · <img src="assets/sparkline-header-jsdoc-orphaned-on-glossary.svg" height="14" alt="commit activity" />

Two consecutive JSDoc blocks precede `buildGlossary`; the first describes `renderHeader` (sixteen lines below, with no doc comment of its own) and names a `findings` parameter that `buildGlossary` does not take. The arrangement dates from the file's first commit, so this predates the prior audit and was missed there; 44b419c edited both functions without noticing.

```javascript src/viewer/build-report.mjs:351-359
/**
 * Generate the <header> HTML fragment.
 * @param {object} findings — parsed findings object
 * @returns {string}
 */
/**
 * Build a glossary sidenote from concern levels present in this report.
 */
function buildGlossary(counts, blocking, backlog) {
```

**Remediation:** Move the first JSDoc block down to sit directly above `export function renderHeader(findings)`.

<div>&hairsp;</div>

### The generated THIRD-PARTY-NOTICES header calls build/ scratch paths 'the shipped bundles' {#notices-header-names-build-paths-not-shipped-ones}

**note** · `scripts/build-viewer.sh:25`, `scripts/third-party-notices.mjs:68-73` · effort: trivial · <img src="assets/sparkline-notices-header-names-build-paths-not-shipped-ones.svg" height="14" alt="commit activity" />

Introduced by 67c42c8. The generator is invoked over `build/build-report.js` and `build/viewer.js` and echoes its argv into the notices header as "The shipped bundles (`build/build-report.js`, `build/viewer.js`)". The file itself ships inside `skills/cased/`, where the bundles are `scripts/build-report.js` and `templates/viewer.js` and no `build/` directory exists. The contents are correct; only the attribution text is wrong, in the one file whose purpose is to be read by someone checking provenance.

```bash scripts/build-viewer.sh:25
node scripts/third-party-notices.mjs skills/cased/THIRD-PARTY-NOTICES.md build/build-report.js build/viewer.js
```

```javascript scripts/third-party-notices.mjs:68-73
const header =
  `# Third-Party Notices\n\n` +
  `The shipped bundles (${bundles.map(b => `\`${b.replace(repoRoot + '/', '')}\``).join(', ')}) ` +
  `inline source from the ${sections.length} packages below. Each is redistributed under its ` +
  `own license, reproduced here as required. Generated by \`scripts/third-party-notices.mjs\` ` +
  `from \`scripts/build-viewer.sh\`; do not edit by hand.\n\n`;
```

Related: [build-viewer-parallel-copy-lists](#build-viewer-parallel-copy-lists), [notices-generator-misses-iife-regions-and-license-variants](#notices-generator-misses-iife-regions-and-license-variants).

**Remediation:** Move the generator invocation after the copy step and pass the shipped paths, or add a `--label` per bundle. Fix together with the supply-chain finding, which touches the same file.

*Verdict: Nothing regressed and nothing new of weight. One prior finding narrowed from moderate to advisory because the link tests landed. Two notes are pure fix-residue. Grind these when the CLI is next opened, not before.*

<div>&nbsp;</div>

## The Completeness Surface

*The batch rewrote the prose it had to (evidence gate, counts, ys, isolation) and left every pre-existing doc/code contradiction in place; two more were found in README's developer section.*

### AGENTS.md still briefs agents on a directory, a recipe, and a platform that do not exist {#agents-md-stale-after-prelaunch-cleanup}

**moderate** · `AGENTS.md:19`, `AGENTS.md:43-47`, `AGENTS.md:60` · effort: trivial · <img src="assets/sparkline-agents-md-stale-after-prelaunch-cleanup.svg" height="14" alt="commit activity" />

Re-filed: three of the prior finding's four statements are unchanged. 67c42c8 rewrote only the ys parenthetical. `just build-example` still does not exist; `example/` is still untracked, so the Layout row promises a checked-in artifact a fresh clone does not have; "cased runs on Claude Code, Codex, and Gemini" still contradicts README.md ("Other platforms — Not yet") and evals/README.md ("Gemini platform case in run-eval — removed pre-launch"). The `just test` comment has drifted further: the recipe now globs eight files while the comment names three. Under the project's own rule that documentation wins, AGENTS.md and README.md assert opposite things about the same platform.

```markdown AGENTS.md:19
| `example/` | Checked-in sample audit used by `just build-example` |
```

```markdown AGENTS.md:43-47
just test            # node --test (build-report, recon, eval scorer)
just check-bundle    # rebuild viewer bundle, fail on drift
just check-contract  # restamp schema contract, fail on drift (validates examples with the bundle's ajv)
just build-example   # full pipeline against example/ data
just eval <fixture>  # live audit eval — real tokens, minutes; not for CI
```

```markdown AGENTS.md:60
cased runs on Claude Code, Codex, and Gemini. Platform adapters live in
```

Related: [readme-crustoleum-counts-and-agent-table-stale](#readme-crustoleum-counts-and-agent-table-stale), [readme-disposition-list-omits-three](#readme-disposition-list-omits-three).

**Remediation:** Replace the `example/` row and the `just build-example` line with `build-smoke`, and either commit `example/` or delete it. Change line 60 to "cased runs on Claude Code and Codex; Gemini is unsupported until an adapter and eval verification exist". Drop the `just test` parenthetical so it cannot go stale again.

<div>&hairsp;</div>

### README tells readers to press S for slide mode; the viewer still binds P {#readme-slide-mode-wrong-key}

**moderate** · `README.md:137`, `src/viewer/slides.js:15-17` · effort: trivial · <img src="assets/sparkline-readme-slide-mode-wrong-key.svg" height="14" alt="commit activity" />

Re-filed; neither line changed. `slides.js` registers exactly one mode-toggle binding, on `p`. Pressing S in a rendered report does nothing. Slide mode is one of the four features README advertises as the payoff for opening `report.html`, and README is the only document that names a key.

```markdown README.md:137
- **Slide mode** — press S to present findings one at a time
```

```javascript src/viewer/slides.js:15-17
  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
      toggleMode(body);
```

**Remediation:** Change README.md:137 to "press P". If S is the intended key, change `slides.js` instead and run `just build-viewer`.

<div>&hairsp;</div>

### `finalize` still claims to run every gate but skips the ledger's commit checks {#finalize-skips-ledger-commit-verification}

**moderate** · `src/viewer/build-report.mjs:869-874`, `src/viewer/gates.mjs:187-193`, `evals/README.md:270-272` · effort: small · <img src="assets/sparkline-finalize-skips-ledger-commit-verification.svg" height="14" alt="commit activity" />

Re-filed at its new location: the counts block 44b419c added to `finalizeAudit` moved the `lintLedger` call, but it still passes no `gitLog`. The CLI help advertises finalize as "run every gate", yet everything inside `lintLedger`'s `if (gitLog)` block — including the error-level "commit not found in target repo" check — is dead during finalize. The standalone `ledger` subcommand builds a gitLog closure and passes it, so `ledger` is strictly stricter than the gate documented as the superset. A ledger citing a SHA that does not exist fails `ledger` but passes `finalize` clean.

```javascript src/viewer/build-report.mjs:869-874
  if (existsSync(ledgerPath)) {
    const problems = lintLedger({
      ledgerText: readFileSync(ledgerPath, 'utf8'),
      findingsDoc: findings,
      testCommand: recon?.testing?.command || null,
    });
```

```javascript src/viewer/gates.mjs:187-193
    if (gitLog) {
      for (const sha of e.commits) {
        const info = gitLog(sha);
        if (!info.exists) { err(e.heading, `commit ${sha} not found in target repo (squash-merge? record the merge SHA)`); continue; }
        for (const slug of e.addresses) if (!info.trailers.includes(slug)) warn(e.heading, `commit ${sha} lacks 'Audit-Finding: ${slug}' trailer`);
      }
    }
```

```markdown evals/README.md:270-272
`ledger_errors`/`ledger_warnings` come from `lintLedger` in
`src/viewer/gates.mjs`, which is also what a live audit's `finalize` step
runs against `actions-taken.md`. The reaudit-rs baseline run below showed
```

Related: [finalize-gate-branches-untested](#finalize-gate-branches-untested).

**Remediation:** Lift the gitLog closure from the `ledger` subcommand into `finalizeAudit` and pass it to `lintLedger`, so finalize is a true superset of `ledger`; add a test that a ledger citing an unknown SHA fails finalize. If skipping git during finalize is deliberate, say so in the CLI help, SKILL.md, and evals/README.md.

<div>&hairsp;</div>

### Phase 2 still tells the controller to run run-tools at a path cased does not have {#crustoleum-run-tools-path-unresolvable-from-cased}

**moderate** · `skills/cased/SKILL.md:243-244` · effort: trivial · <img src="assets/sparkline-crustoleum-run-tools-path-unresolvable-from-cased.svg" height="14" alt="commit activity" />

Re-filed; the two lines are unchanged. Inside cased's own SKILL.md, `${CLAUDE_SKILL_DIR}` expands to the cased skill directory, which has no `scripts/run-tools`; run-tools lives in `skills/crustoleum/scripts/`. Followed literally, step 2 resolves to a nonexistent file, so the cargo tooling that feeds the Supply Chain, Safety, and Performance surfaces is never run. Step 5 of the same list already resolves crustoleum's agents directory from the base path reported when the skill is loaded; step 2 is the only cross-skill path still spelled with `${CLAUDE_SKILL_DIR}`.

```markdown skills/cased/SKILL.md:243-244
1. Load the skill (`skill: crustoleum`) to get the full rubric.
2. Run the skill's tool prerequisites (e.g., `${CLAUDE_SKILL_DIR}/scripts/run-tools --full`).
```

**Remediation:** Rewrite step 2 the way step 5 does: resolve `<crustoleum-skill-dir>/scripts/run-tools --full` from the base path reported when the crustoleum skill is loaded. Never use `${CLAUDE_SKILL_DIR}` for a path outside the cased skill.

<div>&hairsp;</div>

### Codex adapter still says the default thread cap matches the agent count; it is one short {#codex-max-threads-undercounts-agents}

**moderate** · `skills/cased/references/codex-tools.md:47-50`, `skills/cased/references/codex-tools.md:179-186` · effort: trivial · <img src="assets/sparkline-codex-max-threads-undercounts-agents.svg" height="14" alt="commit activity" />

Re-filed; the file is unchanged. Both dispatch paths in SKILL.md can reach seven concurrent agents; the adapter hides the seventh by writing "api-design/performance" as one slot, and its own pseudocode lists six spawns with no performance entry. This file exists to stop Phase 2 from degrading silently on Codex, and "leave the default" at 6 is the one instruction here that reintroduces queuing behind the cap.

```markdown skills/cased/references/codex-tools.md:47-50
The `agents.max_threads` default is 6, which matches the cased agent
count exactly (security, error-handling, code-quality, completeness,
dependencies, api-design/performance). Leave the default unless an
audit requires more surfaces.
```

```markdown skills/cased/references/codex-tools.md:179-186
plans = [
  spawn_agent(worker, message=security_prompt),
  spawn_agent(worker, message=error_handling_prompt),
  spawn_agent(worker, message=code_quality_prompt),
  spawn_agent(worker, message=completeness_prompt),
  spawn_agent(worker, message=dependencies_prompt),   # if deps present
  spawn_agent(worker, message=api_design_prompt),     # if public API
]
```

Related: [readme-crustoleum-counts-and-agent-table-stale](#readme-crustoleum-counts-and-agent-table-stale).

**Remediation:** Correct the count to seven and say "set `agents.max_threads` to at least 7". Add a `performance_prompt` spawn to the pseudocode so the two sections agree.

<div>&hairsp;</div>

### README still undersells crustoleum and omits the Completeness agent from its roster {#readme-crustoleum-counts-and-agent-table-stale}

**advisory** · `README.md:45-56`, `README.md:181` · effort: trivial · <img src="assets/sparkline-readme-crustoleum-counts-and-agent-table-stale.svg" height="14" alt="commit activity" />

Re-filed; the only README change since 2365a3f is the License section. crustoleum's own SKILL.md and cased's SKILL.md both say 89 criteria across 14 surfaces; only cased's README carries the pre-merge 13/84 figures, in both places it quotes them. The "Without a domain skill" roster lists six agents while SKILL.md dispatches Completeness as Always — the README table is the only public description of what a generic-language audit covers, and it omits a narrative every such audit renders.

```markdown README.md:45-56
**Without a domain skill** (any language):

| Agent | What it evaluates |
|-------|------------------|
| Security | Injection, auth bypass, secrets, input validation |
| Error Handling | Silent failures, crash risks, error context |
| Code Quality | Complexity, duplication, dead code, test gaps |
| Performance | Algorithmic complexity, resource leaks, hot paths |
| API Design | Public surface consistency, naming, contracts |
| Dependencies | Outdated versions, advisories, license risks |

Domain skills go deeper — crustoleum brings 84 binary criteria across 13 surfaces. The generic agents cover the fundamentals for any codebase.
```

```markdown README.md:181
| Rust | [crustoleum](https://github.com/claylo/crustoleum) | 13 surfaces, 84 criteria, cargo tooling (clippy, audit, deny, geiger, miri, sanitizers) |
```

Related: [agents-md-stale-after-prelaunch-cleanup](#agents-md-stale-after-prelaunch-cleanup), [codex-max-threads-undercounts-agents](#codex-max-threads-undercounts-agents).

**Remediation:** Update both figures to 89/14 and add a Completeness row to the table. Quote the counts in one place and reference them from the others.

<div>&hairsp;</div>

### The install command README leads with still has nothing in the repo backing it {#readme-primary-install-path-unverified}

**advisory** · `README.md:69-72` · effort: trivial · <img src="assets/sparkline-readme-primary-install-path-unverified.svg" height="14" alt="commit activity" />

Re-filed; unchanged. `package.json` still declares no `name`, there is still no `.claude-plugin/`, `plugin.json`, or marketplace entry, so the repository publishes nothing an `npx … install claylo/cased` command could resolve. The manual clone-and-symlink path below it is the one the rest of the project is built around. Whether the npm package exists could not be verified from here; the reviewer confirmed the repo-side absence and that the finding says so.

```markdown README.md:69-72
Cased is a Claude Code skill — a prompt-and-script package that Claude Code loads on demand.

```sh
npx @anthropic-ai/claude-code-skill install claylo/cased
```

Related: [readme-dev-prereqs-omit-jq](#readme-dev-prereqs-omit-jq).

**Remediation:** Run the command on a clean machine before publishing. If it does not resolve, lead with the manual block and drop the npx line, or add the packaging metadata that makes it real.

<div>&hairsp;</div>

### README's rebuild instructions name Node and just, but build-viewer aborts without jq {#readme-dev-prereqs-omit-jq}

**advisory** · `README.md:221-223`, `scripts/build-viewer.sh:7-8`, `src/schemas/build-schemas.sh:31-36` · effort: trivial · <img src="assets/sparkline-readme-dev-prereqs-omit-jq.svg" height="14" alt="commit activity" />

README's Development section is the only end-user instruction for rebuilding the viewer and states its prerequisites as Node.js and just. `just build-viewer` runs `build-viewer.sh`, whose first step is `build-schemas.sh`, which exits 1 with "required tool 'jq' not found" when jq is absent. jq is not part of a stock macOS install and is not pulled in by `npm install`, so a contributor following the README verbatim on a fresh Mac fails at the first documented step. The ys requirement that used to sit beside jq was removed by c2c8a89 and its README-facing traces are gone; jq was never documented and remains.

```bash README.md:221-223
# Requires Node.js and just (https://just.systems)
npm install
just build-viewer
```

```bash scripts/build-viewer.sh:7-8
echo "=== building + validating schema docs ==="
bash src/schemas/build-schemas.sh
```

```bash src/schemas/build-schemas.sh:31-36
for bin in jq node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: required tool '$bin' not found in PATH" >&2
    exit 1
  fi
done
```

Related: [readme-primary-install-path-unverified](#readme-primary-install-path-unverified).

**Remediation:** Add jq to the README line, or replace the single `jq empty` sanity check in `build-schemas.sh` with `node -e 'JSON.parse(...)'` and drop the jq requirement entirely — the script already requires node.

<div>&hairsp;</div>

### README lists five remediation dispositions; the ledger accepts eight {#readme-disposition-list-omits-three}

**note** · `README.md:173`, `src/viewer/gates.mjs:138` · effort: trivial · <img src="assets/sparkline-readme-disposition-list-omits-three.svg" height="14" alt="commit activity" />

README's "Remediation tracking" section presents the disposition vocabulary as a closed list of five. The ledger linter, the generated AGENTS.md, and `actions-taken-schema.md` all define eight, and the three README omits are the ones with process weight: `escalated` is the circuit breaker, `superseded` is how a later action replaces an earlier one, and `no-measurable-benefit` is the honest disposition for a measured null result.

```markdown README.md:173
Cased appends entries to `actions-taken.md` in the audit directory. Each entry records the date, which findings it addresses, and the disposition: `fixed`, `mitigated`, `accepted`, `disputed`, or `deferred`.
```

```javascript src/viewer/gates.mjs:138
const KNOWN = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];
```

Related: [agents-md-stale-after-prelaunch-cleanup](#agents-md-stale-after-prelaunch-cleanup), [disposition-vocabulary-triplicated](#disposition-vocabulary-triplicated).

**Remediation:** List all eight, or replace the inline list with a pointer to `actions-taken-schema.md` so README stops carrying a copy of a vocabulary that already lives in three places.

*Verdict: All seven prior completeness findings re-derived unchanged, one partially. Two new pre-existing: the README rebuild instructions omit jq, and the README disposition list is five where the ledger accepts eight. Everything here is trivial and authored; batch it into one docs commit.*

<div>&nbsp;</div>

## The Supply Chain Surface

*Nothing ships as a runtime dependency and nothing is behind by a major; the one shipped supply-chain artifact — the notices file — is incomplete in a way its generator cannot see.*

### Third-party notices generator skips the whole viewer.js bundle and two LICENSE-MIT files, then exits 0 {#notices-generator-misses-iife-regions-and-license-variants}

**moderate** · `scripts/third-party-notices.mjs:34-40`, `scripts/third-party-notices.mjs:42-45`, `scripts/third-party-notices.mjs:75-77` · effort: trivial · <img src="assets/sparkline-notices-generator-misses-iife-regions-and-license-variants.svg" height="14" alt="commit activity" />

The ledgered fix for `bundled-third-party-source-missing-license-notices` (67c42c8) is present and does most of the job — 44 packages from `build-report.js` are listed with full license text — but the generator has two patterns narrower than the inputs it is fed, and both failures degrade silently. First, the region regex is anchored at line start. rolldown's CJS output puts `//#region` at column 0, but its IIFE output (`viewer.js`) wraps the bundle in `(function() {` and indents every marker with a tab — the shipped `viewer.js` has five indented `//#region` lines, one of them `rough-notation`, and zero at column 0. So the second bundle contributes nothing, and rough-notation@0.5.1 (MIT, imported by `annotations.js` and `slides.js`) is inlined into the shipped viewer with no notice at all, even though the file's header names `build/viewer.js` as a covered bundle. Second, the license-file filter accepts only `LICENSE`, `LICENSE.<ext>` or `COPYING`. cssesc ships `LICENSE-MIT.txt` and postcss-selector-parser ships `LICENSE-MIT`, so the ledger's statement that these two "publish no LICENSE file to npm" is incorrect — the files are in `node_modules`; the regex rejects the hyphen. Third, every miss is reported only as a stderr `warn:` and the script exits 0, so `check-bundle` and CI stay green with the incomplete file. Net: of 45 packages inlined across the two shipped bundles, one has no notice and two have no license text. The reviewer verified the tab-indented markers and both LICENSE-MIT files directly.

```javascript scripts/third-party-notices.mjs:34-40
for (const bundle of bundles) {
  const text = readFileSync(bundle, 'utf8');
  for (const m of text.matchAll(/^\/\/#region (node_modules\/\S+)/gm)) {
    const name = packageFromRegion(m[1]);
    if (name) packages.add(name);
  }
}
```

```javascript scripts/third-party-notices.mjs:42-45
function findLicenseFile(dir) {
  const candidates = readdirSync(dir).filter(f => /^(LICEN[CS]E|COPYING)(\.|$)/i.test(f));
  return candidates.length ? join(dir, candidates.sort()[0]) : null;
}
```

```javascript scripts/third-party-notices.mjs:75-77
writeFileSync(outFile, header + sections.join('\n'));
console.log(`wrote ${outFile}: ${sections.length} packages`);
for (const m of missing) console.error(`warn: ${m}`);
```

Related: [notices-header-names-build-paths-not-shipped-ones](#notices-header-names-build-paths-not-shipped-ones).

**Remediation:** Three one-line changes: allow leading whitespace on the marker (`/^\s*\/\/#region …/gm`); accept the common variants (`/^(LICEN[CS]E|COPYING)([-_.]|$)/i`); exit non-zero when `missing` is non-empty so an uncovered package fails `check-bundle` instead of warning past it. Then `just build-viewer` — the regenerated file should list 45 packages including rough-notation — and commit the result. Correct the 67c42c8 ledger entry's claim in a new entry.

<div>&hairsp;</div>

### run-eval shells out to rsync/git/claude/codex/cargo with no preflight existence check, unlike recon's established pattern {#eval-runner-no-external-cli-preflight-check}

**moderate** · `evals/scripts/run-eval:104-105`, `evals/scripts/run-eval:116-120`, `evals/scripts/run-eval:216`, `src/recon/recon:36-46` · effort: trivial · <img src="assets/sparkline-eval-runner-no-external-cli-preflight-check.svg" height="14" alt="commit activity" />

Still open, re-derived unchanged; the isolation changes did not address it. `src/recon/recon` establishes the project's convention: loop over required binaries with `command -v` before doing any work, print an install hint, exit with a documented code. run-eval depends on strictly more external tools — rsync, git, claude or codex, node, cargo — and checks none of them. The one `command -v` the sandbox work introduced guards the optional advisory refresh and deliberately falls through when the tool is absent; it is not a preflight for anything the run requires. A host missing rsync, claude, codex or cargo fails with bash's bare "command not found" at whatever point that tool is first reached — after rsync has staged a run directory and git has committed a baseline.

```bash evals/scripts/run-eval:104-105
rsync -a --exclude expected-findings.yaml --exclude target \
  --exclude setup.sh --exclude hidden-tests "$FIXTURE_DIR/" "$WORKDIR/"
```

```bash evals/scripts/run-eval:116-120
if [[ "$ISOLATION" == "sandbox" && -f "$WORKDIR/Cargo.lock" ]]; then
  if command -v cargo-audit >/dev/null 2>&1; then
    (cd "$RUN_DIR" && cargo audit -q -f "$WORKDIR/Cargo.lock" >/dev/null 2>&1) \
      || echo "warn: advisory-db refresh failed; the session's cargo audit will run stale" >&2
  fi
```

```bash evals/scripts/run-eval:216
    CMD=(claude -p "$PROMPT" --output-format text --permission-mode acceptEdits --allowedTools "$ALLOWED_TOOLS")
```

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

Related: [advisory-db-refresh-warning-conflates-scan-and-fetch](#advisory-db-refresh-warning-conflates-scan-and-fetch).

**Remediation:** Add a preflight loop at the top of run-eval, after argument parsing and before the rsync stage, mirroring recon: check `rsync`, `git`, `node`, `cargo` and the binary named by `--platform`, print an install hint per tool, and exit with a dedicated non-127 code documented in the header.

<div>&hairsp;</div>

### dependabot.yml routes alerts to a workflow that has never existed in this repo, and watches a cargo ecosystem the repo does not have at its root {#dependabot-config-cites-nonexistent-issues-workflow}

**note** · `.github/dependabot.yml:1-7`, `.github/dependabot.yml:11-18` · effort: trivial · <img src="assets/sparkline-dependabot-config-cites-nonexistent-issues-workflow.svg" height="14" alt="commit activity" />

The file is boilerplate from the repo-setup commit. Its header says alerts are converted into issues by `dependabot-issues.yml`; `.github/workflows/` contains only `ci.yaml` and no commit ever added such a workflow. With `open-pull-requests-limit: 0` on every ecosystem and no workflow reading the alerts, the stated review process does not exist: a devDependency advisory would appear only in the Security tab, and CI runs no `npm audit`. The cargo block watches `directory: "/"`, where there is no `Cargo.toml` — the only manifests are the two eval fixtures, which that setting does not cover (the reviewer corrected the original "no Cargo.toml at any level"). Impact is bounded — `npm audit` reports zero vulnerabilities today — which is why this is a note about process honesty rather than a live exposure.

```yaml .github/dependabot.yml:1-7
# Dependabot configuration
#
# This enables Dependabot security scanning but does NOT create automatic PRs.
# Instead, the dependabot-issues.yml workflow converts alerts into issues
# for manual review and batched updates.
#
# See: https://docs.github.com/en/code-security/dependabot/dependabot-alerts
```

```yaml .github/dependabot.yml:11-18
  # Rust/Cargo dependencies
  - package-ecosystem: "cargo"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    # Disable automatic PRs - we use the issues workflow instead
    open-pull-requests-limit: 0
```

**Remediation:** Either add the promised step or remove the claim. Cheapest honest option: drop the cargo block and rewrite the header to say alerts are reviewed in the Security tab; optionally add `npm audit --audit-level=high` to the CI test job.

*Verdict: The license fix in 67c42c8 did most of the job and then exited 0 on the part it missed. rough-notation ships with no notice. Trivial regexes, and the ledger's "no LICENSE file" claim needs correcting.*

<div>&nbsp;</div>

## The API Design Surface

*Every new contract the batch introduced — the commit-read evidence gate, the path rule, the isolation flag, the link allowlist — has a seam where the promise and the implementation disagree, and the seven prior contract findings are untouched.*

### The repo-relative path rule lives in a schema pattern and in pathEscapesRepo, and the two accept different paths {#evidence-path-rule-implemented-twice}

**note** · `src/viewer/gates.mjs:54-59`, `src/viewer/gates.mjs:79-85`, `src/schemas/findings.schema.json:62-66` · effort: small · <img src="assets/sparkline-evidence-path-rule-implemented-twice.svg" height="14" alt="commit activity" />

One rule — "a path is inside the audited tree" — has two implementations with no shared code and no test asserting they agree. Probed against 18 paths: the schema is strictly narrower — it rejects `src/../src/x.mjs`, `src/`, `src//x`, `a\b`, `C:/x`, all of which the gate accepts because `resolve()` normalises them inside `repoRoot`. Only `validate` and `build` run the schema; `evidence`, `finalize` and the eval scorer run only the gate, so `src/../src/x.mjs` reads `evidence ok` from three tools and `must match pattern` from the fourth. The one path both accept is `.`: it resolves to `repoRoot` itself, the git reader hands back a tree listing and reports `text-mismatch`, while the working-tree reader's `readFileSync` on a directory throws EISDIR out of `checkEvidenceFidelity` uncaught — the only input for which the gate crashes rather than returns a problem. Nothing is exploitable; the gate is the safe direction.

```javascript src/viewer/gates.mjs:54-59
function pathEscapesRepo(repoRoot, p) {
  if (typeof p !== 'string' || !p || isAbsolute(p)) return true;
  const base = resolve(repoRoot);
  const abs = resolve(base, p);
  return abs !== base && !abs.startsWith(base + sep);
}
```

```javascript src/viewer/gates.mjs:79-85
function workingTreeReader(repoRoot) {
  return p => {
    const abs = join(repoRoot, p);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf8').split('\n');
  };
}
```

```json src/schemas/findings.schema.json:62-66
                      "path": {
                        "type": "string",
                        "description": "Repo-relative, forward-slash path inside the audited tree. Absolute paths, drive letters, backslashes, and any `..` segment are rejected. Written as a segment grammar (no look-around) so it holds in any regex engine.",
                        "pattern": "^([^/\\\\.][^/\\\\:][^/\\\\]*|[^/\\\\.]|\\.[^/\\\\.][^/\\\\]*|\\.\\.[^/\\\\]+|\\.)(/([^/\\\\.][^/\\\\]*|\\.[^/\\\\.][^/\\\\]*|\\.\\.[^/\\\\]+|\\.))*$"
                      },
```

Related: [evidence-gate-silent-working-tree-fallback](#evidence-gate-silent-working-tree-fallback).

**Remediation:** Export one path predicate from `gates.mjs` implementing the segment grammar and have `pathEscapesRepo` call it before `resolve()`, so the gate is at least as strict as the schema. Add a test that runs the schema's pattern and the predicate over the same fixture list and asserts identical verdicts. In `workingTreeReader`, treat a non-file as `null` so a directory reads as `file-missing`.

<div>&hairsp;</div>

### run-eval records platform/model/effort in run-meta.yaml and the run slug, but not --isolation {#eval-isolation-absent-from-run-provenance}

**moderate** · `evals/scripts/run-eval:340-351`, `evals/scripts/compare-runs.mjs:27-28`, `evals/README.md:69-71` · effort: trivial · <img src="assets/sparkline-eval-isolation-absent-from-run-provenance.svg" height="14" alt="commit activity" />

c8eff06 added a fourth runner-controlled axis that materially changes what a session can do — the README records that the first sandboxed run excluded three cargo tools and could not clean `target/`, none of which applied to the unsandboxed run it is compared against. But `run-meta.yaml` and `RUN_SLUG` were not extended, so two runs of the same fixture under `sandbox` and `none` produce byte-identical provenance and identically-named directories, `compare-runs.mjs` labels both `claude/default/default`, and the only record of which wall a run ran behind is the operator's prose in the README. The runner's own contract — "every run says exactly what produced it" — is now missing the axis most likely to explain a recall or hygiene difference. An env-var default makes it worse: an operator who exported `CASED_EVAL_ISOLATION=none` weeks ago has no artifact that says so.

```bash evals/scripts/run-eval:340-351
cat > "$RUN_DIR/run-meta.yaml" <<EOF
fixture: $FIXTURE
mode: $MODE
platform: $PLATFORM
model: $MODEL
effort: $EFFORT
cased_commit: $CASED_COMMIT
started: $STARTED
finished: $FINISHED
findings: ${FINDINGS#"$RUN_DIR/"}
stray_file_count: $STRAY_COUNT
EOF
```

```javascript evals/scripts/compare-runs.mjs:27-28
    meta.platform && meta.model
      ? `${meta.platform}/${meta.model}/${meta.effort ?? '?'}`
```

```markdown evals/README.md:69-71
The **runner** stamps `run-meta.yaml` with platform, model, effort, and the
cased commit — never trusted to the model's self-report. Every score is
comparable across the matrix because every run says exactly what produced it.
```

Related: [run-eval-effort-ignored-on-claude](#run-eval-effort-ignored-on-claude), [eval-isolation-allowlist-claim-false-on-codex](#eval-isolation-allowlist-claim-false-on-codex).

**Remediation:** Stamp `isolation: $ISOLATION` into `run-meta.yaml` next to `effort`, and append it to `RUN_SLUG` (or only when it is not the default). Extend `compare-runs.mjs`'s label to include it, and add it to the README provenance sentence.

<div>&hairsp;</div>

### The --isolation contract promises the ALLOWED_TOOLS prefix allowlist on every platform; the codex branch applies none {#eval-isolation-allowlist-claim-false-on-codex}

**moderate** · `evals/scripts/run-eval:28-38`, `evals/scripts/run-eval:232-242`, `evals/README.md:116-119` · effort: trivial · <img src="assets/sparkline-eval-isolation-allowlist-claim-false-on-codex.svg" height="14" alt="commit activity" />

The trust statement at the top of run-eval — the text an operator is told to read before pointing the runner at anything — defines `--isolation` in platform-neutral terms: under `sandbox` "tool calls are still limited to ALLOWED_TOOLS", and under `none` the session is "gated only by the ALLOWED_TOOLS command-prefix allowlist". `ALLOWED_TOOLS` is only ever consumed by the `claude)` branch. The `codex)` branch passes no tool restriction at all, so `--platform codex --isolation none` runs `codex exec -s danger-full-access` with nothing between the session and the operator's account, while the flag's documentation says a gate is in place. The flag's two values therefore mean different things per platform, and the contract does not say so. Introduced by the fix commit itself: c8eff06 added both the trust statement and the codex `danger-full-access` mapping. The security finding above goes one step further: the allowlist bounds nothing even on claude.

```bash evals/scripts/run-eval:28-38
#   --isolation sandbox  (default) the harness's own OS sandbox: on the
#                        claude platform, seatbelt (macOS) / bubblewrap
#                        (Linux) confines writes to the workspace and the
#                        scratch dirs listed in SANDBOX_SETTINGS; codex runs
#                        under `-s workspace-write`. Tool calls are still
#                        limited to ALLOWED_TOOLS.
#   --isolation none     no OS confinement; the session runs with the
#                        operator's full user rights, gated only by the
#                        ALLOWED_TOOLS command-prefix allowlist. Use it when
#                        a fixture needs something the sandbox refuses, and
#                        say so in the run notes.
```

```bash evals/scripts/run-eval:232-242
    CMD=(codex exec --skip-git-repo-check
         --ephemeral --ignore-user-config
         --enable multi_agent)
    if [[ "$ISOLATION" == "sandbox" ]]; then
      CMD+=(-s workspace-write -c 'sandbox_workspace_write.network_access=true')
    else
      CMD+=(-s danger-full-access)
    fi
    CMD+=("$CODEX_PROMPT")
    [[ "$MODEL" != "default" ]] && CMD+=(--model "$MODEL")
    [[ "$EFFORT" != "default" ]] && CMD+=(-c "model_reasoning_effort=\"$EFFORT\"")
```

```markdown evals/README.md:116-119
boundary and relies on the Bash command-prefix allowlist alone; the run
header says so loudly. Either way Bash is never blanket-allowed: a command
prefix outside the list in `run-eval` is auto-denied and the audit stalls
visibly in the transcript. `CASED_EVAL_ISOLATION` sets the default. The
```

Related: [eval-isolation-absent-from-run-provenance](#eval-isolation-absent-from-run-provenance), [eval-bash-allowlist-admits-shell-prefixes](#eval-bash-allowlist-admits-shell-prefixes).

**Remediation:** Make the contract match the platforms. State in the header and evals/README.md that the command-prefix allowlist is a claude-platform control and that `--platform codex --isolation none` has no command gate at all; print that in the run header. If that combination should not exist, reject it in the `codex)` branch.

<div>&hairsp;</div>

### safeHref drops non-http/https/mailto links to plain text with no build warning and no mention in any producer-facing document {#prose-link-allowlist-undocumented-and-silent}

**advisory** · `src/viewer/build-report.mjs:248`, `src/viewer/build-report.mjs:259-269` · effort: trivial · <img src="assets/sparkline-prose-link-allowlist-undocumented-and-silent.svg" height="14" alt="commit activity" />

44b419c correctly stopped `javascript:` URIs from becoming anchors, and the allowlist itself is the right call. But the rule now sits only in `build-report.mjs`: SKILL.md, every agent rubric, the output contract, the schema doc and the report template have zero hits for `mailto`, `allowlist`, or `safeHref`. A subagent writing `[trace](file:///…)` or `[spec](vscode://…)` gets a report in which the link text appears unlinked, and `build` prints nothing, so the producer has no way to learn the rule other than by reading the renderer.

```javascript src/viewer/build-report.mjs:248
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
```

```javascript src/viewer/build-report.mjs:259-269
export function safeHref(raw) {
  const href = String(raw ?? '').trim();
  if (!href) return null;
  let parsed;
  try { parsed = new URL(href, 'https://relative.invalid/base/'); } catch { return null; }
  if (parsed.host === 'relative.invalid') {
    // resolved against the placeholder base: a fragment or a relative path
    return parsed.protocol === 'https:' ? href : null;
  }
  return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? href : null;
}
```

**Remediation:** Add one sentence to `findings.md.footer` and to `subagent-output-contract.md`: links may be fragments, relative paths, or `http`/`https`/`mailto`; anything else renders as plain text. Have `renderProse` count dropped hrefs and `build` print `warn: N link(s) dropped (unsupported scheme)` naming the slug.

<div>&hairsp;</div>

### Subagent contract mandates `criterion` and `surface`; the findings schema defines neither {#contract-fields-absent-from-schema}

**moderate** · `skills/cased/agents/api-design.md:90-91`, `skills/cased/references/subagent-output-contract.md:86-87`, `src/schemas/findings.schema.json:51-55` · effort: small · <img src="assets/sparkline-contract-fields-absent-from-schema.svg" height="14" alt="commit activity" />

Unchanged. All seven rubrics and the shared output contract instruct subagents to emit `criterion` and `surface` on every finding; the schema declares neither, the example omits them, and nothing in `build-report.mjs` reads them. They survive `validate` only because the finding object has no `additionalProperties` bound. This verification pass is itself another instance: every agent emitted both fields and the controller stripped them at assembly.

```markdown skills/cased/agents/api-design.md:90-91
- `findings[].criterion:` — use the `API-N` prefix matching the criterion you evaluated.
- `findings[].surface:` — always `"API Design"` (maps to the narrative title).
```

```yaml skills/cased/references/subagent-output-contract.md:86-87
    criterion: "<YOUR_PREFIX>-N"         # e.g. SEC-1, CQ-3 — see your rubric
    surface: "<Your Surface Name>"       # maps to the narrative title
```

```json src/schemas/findings.schema.json:51-55
              "required": ["slug", "title", "concern", "locations", "evidence", "mechanism", "remediation"],
              "properties": {
                "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
                "title": { "type": "string", "description": "Human-readable finding title" },
                "concern": { "type": "string", "enum": ["critical", "significant", "moderate", "advisory", "note"] },
```

Enabled by [findings-schema-accepts-unknown-keys](#findings-schema-accepts-unknown-keys).

**Remediation:** Pick one direction and make the whole contract agree: add both fields to the schema, example and footer and have the controller assert `surface` equals the narrative title; or delete both from the contract and all seven rubrics and state that surface attribution is carried by the narrative grouping alone.

<div>&hairsp;</div>

### findings.schema.json leaves 10 of 14 objects open while recon.schema.json locks 15 of 16 {#findings-schema-accepts-unknown-keys}

**moderate** · `src/schemas/recon.schema.json:1-13`, `src/schemas/findings.schema.json:12-17`, `src/schemas/findings.schema.json:115-119`, `src/schemas/findings.schema.json:142-144` · effort: medium · <img src="assets/sparkline-findings-schema-accepts-unknown-keys.svg" height="14" alt="commit activity" />

Partially addressed, still open. 44b419c set `additionalProperties: false` on `summary.counts`, so the count is now 4 of 14 object schemas closed against recon's 15 of 16. The root, narratives, flow, findings, locations, markers, temporal, chains, summary and the flow-finding variant remain open, so the failure the prior finding described is unchanged: `orign:` drops a finding out of `finalizeAudit`'s causal-ref check; `failure-mode:` instead of `failure_mode:` falls into `isBlocking`'s `?? 'user-visible'` default and silently promotes a finding onto the release-gating list; `validate` — now also run by `build` — reports ok in every case. The half of the contract written by an LLM is still the half that is not locked.

```json src/schemas/recon.schema.json:1-13
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cased.dev/schemas/recon.schema.json",
  "title": "Cased Recon",
  "description": "Structural model of a codebase gathered during the reconnaissance phase of an audit.",
  "type": "object",
  "required": ["meta", "structure"],
  "additionalProperties": false,
  "properties": {
    "meta": {
      "type": "object",
      "required": ["project", "commit", "timestamp", "scope", "audit_profile"],
      "additionalProperties": false,
```

```json src/schemas/findings.schema.json:12-17
    "narratives": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["slug", "title", "thesis", "verdict", "findings"],
        "properties": {
```

```json src/schemas/findings.schema.json:115-119
                "origin": {
                  "type": "object",
                  "required": ["kind"],
                  "additionalProperties": false,
                  "properties": {
```

```json src/schemas/findings.schema.json:142-144
        "counts": {
          "type": "object",
          "additionalProperties": false,
```

Enables [contract-fields-absent-from-schema](#contract-fields-absent-from-schema).

**Remediation:** Add `"additionalProperties": false` to the remaining object schemas, matching recon's policy, and run `just build-smoke` plus every `record/audits/*/findings.yaml` through `validate` to find fields in use the schema never declared — resolve `contract-fields-absent-from-schema` in the same change.

<div>&hairsp;</div>

### A ledger entry whose Addresses field omits link syntax lints clean and records no slugs {#ledger-addresses-silently-parses-nothing}

**moderate** · `skills/cased/references/actions-taken-schema.md:41`, `src/viewer/prior-audits.mjs:30`, `src/viewer/gates.mjs:162-164` · effort: trivial · <img src="assets/sparkline-ledger-addresses-silently-parses-nothing.svg" height="14" alt="commit activity" />

Unchanged; the lines moved because 44b419c and b7ade51 added code above them. `parseLedger` extracts slugs only via `matchAll(/\[([^\]]+)\]/g)`, `lintLedger` checks only that the field is non-empty and then iterates an empty `e.addresses`, so `**Addresses:** silent-write-discard` passes `ledger` with zero errors while addressing nothing — `latestDispositions` records no disposition and the scorer's remediation counts all read empty. The schema doc presents the bracket form as a template convention rather than the parser's requirement.

```markdown skills/cased/references/actions-taken-schema.md:41
**Addresses:** [{slug}](README.md#{slug}), …
```

```javascript src/viewer/prior-audits.mjs:30
    const addresses = [...(fields.Addresses ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
```

```javascript src/viewer/gates.mjs:162-164
    if (!f.Addresses) err(e.heading, 'missing **Addresses:**');
    if (!f.Author) err(e.heading, 'missing **Author:**');
    for (const slug of e.addresses) if (!known.has(slug)) err(e.heading, `Addresses unknown slug '${slug}' (not in findings.yaml or carried_forward)`);
```

Related: [disposition-vocabulary-triplicated](#disposition-vocabulary-triplicated).

**Remediation:** In `lintLedger`, error when `f.Addresses` is present but `e.addresses` is empty, so the syntax requirement fails loudly. State in the schema doc that the bracket form is what the linter parses, not decoration.

<div>&hairsp;</div>

### An unrecognised build-report subcommand becomes the audit directory, and the exit-code contract is ad hoc {#build-report-subcommand-fallback}

**moderate** · `src/viewer/build-report.mjs:1044-1056`, `src/viewer/build-report.mjs:1109-1119` · effort: small · <img src="assets/sparkline-build-report-subcommand-fallback.svg" height="14" alt="commit activity" />

Partially addressed, still open. The prior finding's second half — `build` validating nothing — was fixed by 44b419c, so `build-report.js validte record/audits/x` now fails with `refusing to render: … file not found: validte/recon.yaml` instead of an uncaught ENOENT. The first half is unchanged: the parser still cannot reject a subcommand, unknown `--flags` are still filtered away silently, and the exit codes are still ad hoc — within `ledger` a missing `actions-taken.md` exits 1 while a missing `findings.yaml` exits 2, and the usage block documents no exit-code contract, unlike `src/recon/recon`. Eleven of the twelve fixes since 2365a3f rebuilt this bundle; none touched the entry block.

```javascript src/viewer/build-report.mjs:1044-1056
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
    // Parse subcommand: `validate <dir>` or `build <dir>`; bare `<dir>` is
    // treated as `build` for backward compatibility.
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

```javascript src/viewer/build-report.mjs:1109-1119
    if (subcommand === 'ledger') {
      const ledgerPath = join(auditDir, 'actions-taken.md');
      if (!existsSync(ledgerPath)) {
        console.error(`error: ${ledgerPath} does not exist`);
        process.exit(1);
      }
      const findingsPath = join(auditDir, 'findings.yaml');
      if (!existsSync(findingsPath)) {
        console.error(`error: ${findingsPath} not found`);
        process.exit(2);
      }
```

Related: [shipped-help-names-source-paths](#shipped-help-names-source-paths), [build-subcommand-unguarded-io](#build-subcommand-unguarded-io).

**Remediation:** Reject an unrecognised first positional that looks like a subcommand with the usage text and a non-zero exit; keep the bare-directory form only when the argument resolves to a directory. Error on unknown `--flags`, document the exit-code contract in the usage block, and make the `ledger` missing-file case use 2.

<div>&hairsp;</div>

### run-eval records --effort in the run slug and provenance but never applies it on the claude platform {#run-eval-effort-ignored-on-claude}

**moderate** · `evals/scripts/run-eval:94-96`, `evals/scripts/run-eval:214-219` · effort: trivial · <img src="assets/sparkline-run-eval-effort-ignored-on-claude.svg" height="14" alt="commit activity" />

Unchanged; the lines moved because c8eff06 inserted the isolation and allowlist blocks above them. The `claude)` branch gained a `--settings` line for `--isolation` but still consumes neither `$EFFORT` nor rejects it, while `$EFFORT` still flows into `RUN_SLUG`, `run-meta.yaml` and `compare-runs`' label. evals/README.md acknowledges it, which documents the defect rather than resolving it: two claude runs at `--effort high` and `--effort low` are identically configured sessions filed under different directories.

```bash evals/scripts/run-eval:94-96
TS="$(TZ='America/New_York' date +%Y-%m-%d-%H%M%S)"
RUN_SLUG="$TS-$PLATFORM-$MODEL-$EFFORT"
[[ "$MODE" == "remediate" ]] && RUN_SLUG="$RUN_SLUG-remediate"
```

```bash evals/scripts/run-eval:214-219
case "$PLATFORM" in
  claude)
    CMD=(claude -p "$PROMPT" --output-format text --permission-mode acceptEdits --allowedTools "$ALLOWED_TOOLS")
    [[ "$ISOLATION" == "sandbox" ]] && CMD+=(--settings "$SANDBOX_SETTINGS")
    [[ "$MODEL" != "default" ]] && CMD+=(--model "$MODEL")
    ;;
```

Related: [eval-isolation-absent-from-run-provenance](#eval-isolation-absent-from-run-provenance), [entrypoint-guard-unresolved-path](#entrypoint-guard-unresolved-path).

**Remediation:** Reject the combination explicitly in the `claude)` branch, or map it to a real Claude Code knob if one exists. The recorded `effort:` and the run slug must only ever name a setting that was actually applied.

<div>&hairsp;</div>

### Shipped CLI help text names source-tree paths that do not exist in an installed skill {#shipped-help-names-source-paths}

**advisory** · `src/recon/recon:7-8`, `src/viewer/build-report.mjs:1059` · effort: trivial · <img src="assets/sparkline-shipped-help-names-source-paths.svg" height="14" alt="commit activity" />

Unchanged. `src/recon/recon` is stamped byte-for-byte to `skills/cased/scripts/recon` and `build-report.mjs` is bundled to `build-report.js` with the same usage string, so an installed skill's help names `src/recon/recon` and `build-report.mjs`, neither of which the user has. The usage block was edited by b7ade51 (the `evidence` line) without correcting the first line.

```bash src/recon/recon:7-8
# Usage:
#   bash src/recon/recon <target-project-dir> <audit-dir>
```

```javascript src/viewer/build-report.mjs:1059
      console.error('Usage: node build-report.mjs [build|validate|evidence|ledger|finalize] <audit-directory>');
```

Related: [build-report-subcommand-fallback](#build-report-subcommand-fallback).

**Remediation:** Print the invoked name rather than a hardcoded one: `basename(process.argv[1])` in the usage string; `bash <skill-dir>/scripts/recon …` in the recon header. Re-run `just check-bundle`.

<div>&hairsp;</div>

### The eight-value disposition vocabulary is hardcoded in three places with no single source {#disposition-vocabulary-triplicated}

**advisory** · `src/viewer/gates.mjs:137-138`, `src/viewer/gates.mjs:154`, `src/viewer/prior-audits.mjs:9` · effort: small · <img src="assets/sparkline-disposition-vocabulary-triplicated.svg" height="14" alt="commit activity" />

Unchanged. The list is written out three times in code plus twice in prose, with `REQUIRE_COMMIT` as a partial copy and the schema's `carried_forward.disposition` enum as an overlapping subset. 44b419c added a fourth vocabulary in the same file — `CONCERN_LEVELS` — as a single exported source the renderers consume, which is the pattern this finding asks for; the disposition list did not get the same treatment.

```javascript src/viewer/gates.mjs:137-138
const REQUIRE_COMMIT = new Set(['fixed', 'mitigated', 'superseded']);
const KNOWN = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];
```

```javascript src/viewer/gates.mjs:154
    const others = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'].reduce((n, k) => n + (Number(s[k]) || 0), 0);
```

```javascript src/viewer/prior-audits.mjs:9
const DISPOSITIONS = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];
```

Related: [ledger-addresses-silently-parses-nothing](#ledger-addresses-silently-parses-nothing), [flat-findings-traversal-reimplemented](#flat-findings-traversal-reimplemented), [readme-disposition-list-omits-three](#readme-disposition-list-omits-three).

**Remediation:** Define the vocabulary once in a small shared module, derive `KNOWN`, the front-matter summation and `REQUIRE_COMMIT` from it, reuse it as the enum source for the schema, and add a test asserting the code list matches the dispositions documented in `actions-taken-schema.md`.

*Verdict: Four caused-by-fix findings, all of the shape "the fix is right, the contract around it is not stated". Of the seven prior findings, two narrowed. Nothing here is behaviourally dangerous; all of it is what you would want settled before a third party reads the contract.*

<div>&nbsp;</div>

## Remediation Ledger

| Finding | Concern | Location | Effort | Origin | Chains |
|---------|---------|----------|--------|--------|--------|
| **The Security Surface** | | | | | |
| [markdown-renderers-interpret-dollar-patterns](#markdown-renderers-interpret-dollar-patterns) | moderate | `src/viewer/build-report.mjs:742-755` | trivial | pre-existing | related: agents-readme-render-duplication |
| [eval-bash-allowlist-admits-shell-prefixes](#eval-bash-allowlist-admits-shell-prefixes) | moderate | `evals/scripts/run-eval:194-197` | small | caused-by-fix c8eff06 | related: eval-post-session-execution-outside-sandbox |
| [eval-post-session-execution-outside-sandbox](#eval-post-session-execution-outside-sandbox) | advisory | `evals/scripts/run-eval:326-328` | medium | pre-existing | related: eval-bash-allowlist-admits-shell-prefixes |
| [recon-manifest-json-interpolates-unescaped-names](#recon-manifest-json-interpolates-unescaped-names) | moderate | `src/recon/recon:101-103` | small | pre-existing | related: recon-catch-all-collapses-exit-3 |
| **The Error Handling Surface** | | | | | |
| [evidence-gate-silent-working-tree-fallback](#evidence-gate-silent-working-tree-fallback) | moderate | `src/viewer/gates.mjs:68-77` | small | caused-by-fix b7ade51 | related: bare-catch-erases-failure-cause |
| [advisory-db-refresh-warning-conflates-scan-and-fetch](#advisory-db-refresh-warning-conflates-scan-and-fetch) | advisory | `evals/scripts/run-eval:116-125` | trivial | caused-by-fix 7b3e626 | related: eval-runner-no-external-cli-preflight-check |
| [gate-start-failure-detected-by-enoent-only](#gate-start-failure-detected-by-enoent-only) | note | `evals/scripts/score-eval.mjs:334-341` | trivial | caused-by-fix 67c42c8 | — |
| [build-subcommand-unguarded-io](#build-subcommand-unguarded-io) | moderate | `src/viewer/build-report.mjs:1044-1045` | small | pre-existing | related: fonts-dir-resolution-unguarded |
| [fonts-dir-resolution-unguarded](#fonts-dir-resolution-unguarded) | moderate | `src/viewer/build-report.mjs:1163-1173` | trivial | pre-existing | related: build-subcommand-unguarded-io |
| [score-json-truncated-by-redirect](#score-json-truncated-by-redirect) | moderate | `evals/scripts/run-eval:371-374` | trivial | pre-existing | enabled by: entrypoint-guard-unresolved-path |
| [hygiene-gate-swallows-git-failure](#hygiene-gate-swallows-git-failure) | moderate | `evals/scripts/run-eval:299-305` | trivial | pre-existing | — |
| [entrypoint-guard-unresolved-path](#entrypoint-guard-unresolved-path) | moderate | `evals/scripts/score-eval.mjs:530-532` | trivial | pre-existing | enables: score-json-truncated-by-redirect |
| [recon-catch-all-collapses-exit-3](#recon-catch-all-collapses-exit-3) | moderate | `src/recon/recon:10-15` | small | pre-existing | related: recon-exec-skips-tmp-cleanup |
| [setup-trap-deletes-only-copy](#setup-trap-deletes-only-copy) | advisory | `evals/fixtures/reaudit-rs/setup.sh:78-85` | trivial | pre-existing | — |
| [recon-exec-skips-tmp-cleanup](#recon-exec-skips-tmp-cleanup) | advisory | `src/recon/recon:56-57` | trivial | pre-existing | related: recon-catch-all-collapses-exit-3 |
| **The Code Quality Surface** | | | | | |
| [build-report-cli-monolith](#build-report-cli-monolith) | moderate | `src/viewer/build-report.mjs:1043-1056` | medium | pre-existing | related: finalize-gate-branches-untested |
| [agents-readme-render-duplication](#agents-readme-render-duplication) | moderate | `src/viewer/build-report.mjs:725-740` | small | pre-existing | related: markdown-renderers-interpret-dollar-patterns |
| [untested-render-and-escape-exports](#untested-render-and-escape-exports) | advisory | `src/viewer/build-report.mjs:205-207` | small | pre-existing | related: agents-readme-render-duplication |
| [finalize-gate-branches-untested](#finalize-gate-branches-untested) | moderate | `src/viewer/build-report.mjs:841-846` | small | pre-existing | related: finalize-skips-ledger-commit-verification |
| [build-viewer-parallel-copy-lists](#build-viewer-parallel-copy-lists) | advisory | `scripts/build-viewer.sh:18-22` | trivial | pre-existing | related: notices-header-names-build-paths-not-shipped-ones |
| [detect-npm-test-command-discarded](#detect-npm-test-command-discarded) | note | `src/recon/recon-to-yaml.mjs:334-342` | trivial | pre-existing | — |
| [flat-findings-traversal-reimplemented](#flat-findings-traversal-reimplemented) | note | `src/viewer/gates.mjs:15-17` | trivial | pre-existing | related: disposition-vocabulary-triplicated |
| [header-jsdoc-orphaned-on-glossary](#header-jsdoc-orphaned-on-glossary) | note | `src/viewer/build-report.mjs:351-359` | trivial | pre-existing | — |
| [notices-header-names-build-paths-not-shipped-ones](#notices-header-names-build-paths-not-shipped-ones) | note | `scripts/build-viewer.sh:25` | trivial | caused-by-fix 67c42c8 | related: notices-generator-misses-iife-regions-and-license-variants |
| **The Completeness Surface** | | | | | |
| [agents-md-stale-after-prelaunch-cleanup](#agents-md-stale-after-prelaunch-cleanup) | moderate | `AGENTS.md:19` | trivial | pre-existing | related: readme-crustoleum-counts-and-agent-table-stale |
| [readme-slide-mode-wrong-key](#readme-slide-mode-wrong-key) | moderate | `README.md:137` | trivial | pre-existing | — |
| [finalize-skips-ledger-commit-verification](#finalize-skips-ledger-commit-verification) | moderate | `src/viewer/build-report.mjs:869-874` | small | pre-existing | related: finalize-gate-branches-untested |
| [crustoleum-run-tools-path-unresolvable-from-cased](#crustoleum-run-tools-path-unresolvable-from-cased) | moderate | `skills/cased/SKILL.md:243-244` | trivial | pre-existing | — |
| [codex-max-threads-undercounts-agents](#codex-max-threads-undercounts-agents) | moderate | `skills/cased/references/codex-tools.md:47-50` | trivial | pre-existing | related: readme-crustoleum-counts-and-agent-table-stale |
| [readme-crustoleum-counts-and-agent-table-stale](#readme-crustoleum-counts-and-agent-table-stale) | advisory | `README.md:45-56` | trivial | pre-existing | related: agents-md-stale-after-prelaunch-cleanup |
| [readme-primary-install-path-unverified](#readme-primary-install-path-unverified) | advisory | `README.md:69-72` | trivial | pre-existing | related: readme-dev-prereqs-omit-jq |
| [readme-dev-prereqs-omit-jq](#readme-dev-prereqs-omit-jq) | advisory | `README.md:221-223` | trivial | pre-existing | related: readme-primary-install-path-unverified |
| [readme-disposition-list-omits-three](#readme-disposition-list-omits-three) | note | `README.md:173` | trivial | pre-existing | related: disposition-vocabulary-triplicated |
| **The Supply Chain Surface** | | | | | |
| [notices-generator-misses-iife-regions-and-license-variants](#notices-generator-misses-iife-regions-and-license-variants) | moderate | `scripts/third-party-notices.mjs:34-40` | trivial | caused-by-fix 67c42c8 | related: notices-header-names-build-paths-not-shipped-ones |
| [eval-runner-no-external-cli-preflight-check](#eval-runner-no-external-cli-preflight-check) | moderate | `evals/scripts/run-eval:104-105` | trivial | pre-existing | related: advisory-db-refresh-warning-conflates-scan-and-fetch |
| [dependabot-config-cites-nonexistent-issues-workflow](#dependabot-config-cites-nonexistent-issues-workflow) | note | `.github/dependabot.yml:1-7` | trivial | pre-existing | — |
| **The API Design Surface** | | | | | |
| [evidence-path-rule-implemented-twice](#evidence-path-rule-implemented-twice) | note | `src/viewer/gates.mjs:54-59` | small | caused-by-fix b7ade51 | related: evidence-gate-silent-working-tree-fallback |
| [eval-isolation-absent-from-run-provenance](#eval-isolation-absent-from-run-provenance) | moderate | `evals/scripts/run-eval:340-351` | trivial | caused-by-fix c8eff06 | related: run-eval-effort-ignored-on-claude |
| [eval-isolation-allowlist-claim-false-on-codex](#eval-isolation-allowlist-claim-false-on-codex) | moderate | `evals/scripts/run-eval:28-38` | trivial | caused-by-fix c8eff06 | related: eval-bash-allowlist-admits-shell-prefixes |
| [prose-link-allowlist-undocumented-and-silent](#prose-link-allowlist-undocumented-and-silent) | advisory | `src/viewer/build-report.mjs:248` | trivial | caused-by-fix 44b419c | — |
| [contract-fields-absent-from-schema](#contract-fields-absent-from-schema) | moderate | `skills/cased/agents/api-design.md:90-91` | small | pre-existing | enabled by: findings-schema-accepts-unknown-keys |
| [findings-schema-accepts-unknown-keys](#findings-schema-accepts-unknown-keys) | moderate | `src/schemas/recon.schema.json:1-13` | medium | pre-existing | enables: contract-fields-absent-from-schema |
| [ledger-addresses-silently-parses-nothing](#ledger-addresses-silently-parses-nothing) | moderate | `skills/cased/references/actions-taken-schema.md:41` | trivial | pre-existing | related: disposition-vocabulary-triplicated |
| [build-report-subcommand-fallback](#build-report-subcommand-fallback) | moderate | `src/viewer/build-report.mjs:1044-1056` | small | pre-existing | related: build-subcommand-unguarded-io |
| [run-eval-effort-ignored-on-claude](#run-eval-effort-ignored-on-claude) | moderate | `evals/scripts/run-eval:94-96` | trivial | pre-existing | related: eval-isolation-absent-from-run-provenance |
| [shipped-help-names-source-paths](#shipped-help-names-source-paths) | advisory | `src/recon/recon:7-8` | trivial | pre-existing | related: build-report-subcommand-fallback |
| [disposition-vocabulary-triplicated](#disposition-vocabulary-triplicated) | advisory | `src/viewer/gates.mjs:137-138` | small | pre-existing | related: ledger-addresses-silently-parses-nothing |

Blocking (release-gating): 0 · Backlog: 47 · Origin: 10 caused-by-fix, 37 pre-existing (30 re-derived under prior slugs, 7 found for the first time), 0 new-in-diff, 0 recurrence-of.

---

<sub>
Generated 2026-09-01 at commit 9f7e30a. Verification pass; not a closing audit. Intermediate artifacts: recon.yaml, findings.yaml. Reviewer: 47 reviewed, 42 confirmed, 5 adjusted, 0 disputed.
</sub>
