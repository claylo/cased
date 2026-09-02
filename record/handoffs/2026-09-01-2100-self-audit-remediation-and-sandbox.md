# Handoff: self-audit remediation batch 2, evidence gate, ys removal, eval sandbox

**Session:** 2026-09-01 evening (no handoff existed for the 08-28 remediation
tail; this one covers from "catch up" to the start of self-audit #2).
**Tree:** main @ `9f7e30a`, clean, pushed. CI green since 67c42c8.

## Where the self-audit stands

`record/audits/2026-08-28-21-self-audit/` — 42 findings, **12 fixed / 30 open**,
`ledger ok`, `finalize ok` through the shipped bundle. Every blocker, every
launch-credibility item, and the four moderates Clay named are closed. The 30
open are moderates, advisories and notes; no triage pass has been done on them
(Clay: triage after external audits tell us which ones bite).

Commits this session, in order (all Clay's `gtxt`):

| SHA | What | Ledgered |
|---|---|---|
| b7ade51 | evidence gate reads `git show <findings.commit>:./<path>`; path containment; schema pattern | ef41a9d |
| 44b419c | five metadata sinks escaped; `safeHref` scheme allowlist; counts derived not authored; `build` validates first | 01b9607 |
| c2c8a89 | `ys` dropped; contract examples validate through the bundle's ajv | — (not a finding) |
| c8eff06 | eval runner: `--isolation sandbox\|none`, Bash prefix allowlist, trust statement | 9f7e30a |
| 7b3e626 | cargo-audit inside the sandbox; first sandboxed baseline recorded | 9f7e30a |

## Decisions Clay made (do not re-litigate)

- **Evidence is a claim about `findings.commit`, not the working tree.** The
  "skip fixed slugs" alternative was dead on arrival: 12 of the 19 post-fix
  evidence errors were on *untouched* findings whose lines drifted because they
  share a file with a fix.
- **No release post** until several audits outside this repo have run.
- **No container mode for the eval runner.** One operator (Clay), first-party
  fixtures. `sandbox` (default) or `none`. Container "BYOD" was discussed and
  declined.
- **`ys` (yaml-schema) is gone.** Two validators in two regex dialects could
  disagree, and did (lookahead: fine in ajv, unsupported in ys). Agents in the
  wild only ever ran ajv; now dev/CI does too.
- **`summary.counts` is not authored.** Renderers derive it; if present,
  `finalize` checks it. The canonical example had been miscounting itself
  (advisory 8 vs 10, note 5 vs 3).

## Things learned the hard way (the "keep these" list)

1. **The sandbox's default escape hatch makes it theater.** Out of the box a
   command that hits the wall may be retried with `dangerouslyDisableSandbox`,
   and in headless acceptEdits that retry runs unprompted. run-eval sets
   `allowUnsandboxedCommands=false`; the probe confirmed the retry stays denied.
   Also `failIfUnavailable=true` so a host without seatbelt/bubblewrap fails
   instead of silently degrading to `none`.
2. **The sandbox network boundary is a proxy, not a firewall.** Denied domains
   come back as a 403 from the proxy. Tools that don't honor the proxy env fail
   with generic I/O errors: cargo-audit's advisory-db git fetch is one; cargo's
   registry fetch and cargo-deny are fine. run-eval refreshes the advisory DB
   outside the wall and writes `.cargo/audit.toml` (`fetch=false`, `stale=true`)
   into the workdir.
3. **The advisory-db lock is a sibling file:** `~/.cargo/advisory-db..lock`,
   not inside `~/.cargo/advisory-db/`. Allowing the directory is not enough.
4. **A session's stated reason for excluding a tool is a claim, not evidence.**
   The live eval said `cargo udeps` "requires the nightly rustup proxy, which
   fails in this sandbox." False: `cargo +nightly udeps`, `rustup toolchain
   list`, and crustoleum's `run-tools udeps` all succeed inside the same
   policy. What actually happened: run-tools' summary shows udeps as `not run`
   (its `has_cmd && has_nightly` guard evaluated false once, unreproduced) and
   the session narrated a mechanism. The artifact that carries the truth is
   `.crustoleum/summary.md` — `not run` means a guard; a real sandbox denial
   names the path or host. This is the churn-research pattern in miniature:
   plausible mechanism, confidently stated, wrong. Belongs in the post.
5. **`execFileSync` swallows big files as "missing".** The shipped bundle is
   over Node's 1 MB `maxBuffer`; the throw was indistinguishable from "path not
   in commit" until a test with a 2 MB tracked file caught it. The self-audit
   caught it first, because one finding cites the bundle.
6. **Schema patterns had to be valid in two regex dialects** while ys existed.
   The path rule is a segment grammar, not lookahead. Kept after ys left:
   correct, tested, portable.
7. **`build` now refuses an unvalidated document.** The render path used to
   assume a clean document because SKILL.md says to run `validate`; the
   assumption is enforced by the code that depends on it.

## Live eval baseline (first sandboxed run)

`evals/runs/error-handling-rs/2026-09-01-202221-claude-default-default`, 22m23s:
recall 7/7, unexpected 13, false positives 0, calibration misses 0,
`finalize_ok` true, `evidence_problems` 0. No command auto-denied by the prefix
allowlist. Recorded under **Baselines** in `evals/README.md`. Residual: `rm` is
deliberately off the prefix list, so a session cannot clean `target/` (14 MB
left in the workdir; runs dir is untracked).

## Next actions

1. **Self-audit #2 (re-audit mode)** at `9f7e30a` — started at the end of this
   session. It must ingest the 08-28 ledger (12 fixed → reconciliation rows,
   `still-fixed`/`regressed`), carry forward nothing (no deferred/accepted yet),
   and `finalize` must see the prior audit as ledgered. Expect it quiet.
2. Triage the 30 open moderates/advisories/notes in one ledger pass *after*
   external audits — Clay's sequencing.
3. Several audits outside this repo. Then the release post (churn research +
   self-audit #1 + the udeps story).

## Still open from earlier handoffs

- `skills/cased/references/report-template.md` still carries the deprecated
  Terrain Map block (08-10 ghost artifact).
- Codex column of the reaudit-rs evals never run.
- `example/`, `build/`, `dist/`, `crustoleum-merge/` untracked in the tree.

## Self-audit #2 result (verification pass, completed same session)

`record/audits/2026-09-01-21-verification-pass/` — 47 findings (0 critical, 0
significant, 27 moderate, 12 advisory, 8 note), **0 blocking**, `finalize ok`.
Six agents, 48 raw, one cross-surface duplicate collapsed. Reviewer: 42
confirmed, 5 adjusted (detail only), 0 disputed, 0 overrides. All 12 ledgered
fixes reconcile `still-fixed`; the `ci-drift-gates-abort-without-ys` row needs
a `superseded` follow-up entry in the 08-28 ledger citing c2c8a89 (the fix was
replaced when ys was dropped) — remediation-tracking action, not done.

What the batch carried in (10 `caused-by-fix`, all moderate or below):
- f4812fe left the two markdown renderers on string-form `replaceAll` (same `$'` class).
- b7ade51's `commitReader` swallows every git failure into a silent working-tree
  fallback; the path rule exists twice (schema vs gate) and they disagree.
- c8eff06's prefix allowlist bounds nothing (`bash`, `node`, `find` on it) and
  the ledger's "rm is off the list" residual is wrong; `--isolation` is not in
  run provenance; codex+none has no allowlist at all.
- 67c42c8's notices generator misses the IIFE bundle (tab-indented `//#region`)
  and `LICENSE-MIT` files, exits 0 — rough-notation ships with no notice; the
  ledger's "no LICENSE file" claim was wrong.
- 7b3e626's advisory refresh conflates "advisories found" with "fetch failed".
Seven pre-existing found for the first time (notably: recon splices sibling
audit dir names into manifest.json unescaped). Thirty prior open findings
re-derived under original slugs, three narrowed.

Re-audit machinery verdict: worked end to end (origin on 47/47, reconciliation
rendered, finalize accepted the ledgered prior). Two frictions: `titleFromScope`
turns a long `scope` into an ugly H1/AGENTS.md title — keep `scope` short; and
the evidence gate's git-show read passed 47/47 first time, which is the point.
