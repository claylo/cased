# Yamalgam Cross-Audit Finding Lineage — 27 audits, 2026-04-08 → 2026-08-17

**Corpus:** 426 findings / 648 finding-locations across 130 distinct files; 314 ledger entries; 329 unique remediation commits.

## Data-quality caveats (read first)

- **Schema is stable.** All 27 `findings.yaml` use the same shape (`narratives[].findings[]`, `concern` ∈ critical/significant/moderate/advisory/note). The April audit is *not* a different schema. Good news for comparability.
- **There is no `category` field.** The narrative `slug` is the only surface/category label, and it is **free text that changes every audit** (`performance` vs `schema-and-editing-performance-surface` vs `hot-path-surface`). Cross-audit category matching is therefore weak; I leaned on **file path** as the primary key.
- **Two audits have no ledger:** `2026-04-08-full-workspace` (27 findings) and `2026-08-15-1538-m14-release-closure-clean` (8 findings). Their 35 findings have no disposition and are excluded from status totals.
- **Ledger front-matter counts don't always match enumerable entries.** Audits 9–12 declare 5–6 `deferred` but carry a single "deferred" entry addressing 6 slugs at once. Front-matter totals are authoritative; per-entry counts undercount.
- **Commit SHAs appear both backticked and bare**; a first regex found 152, the corrected one 330. One SHA (`48e5be7f…`) is not in the repo — rebased or amended away. Stats use the 329 resolvable.
- **`git author` is 100% "Clay Loveless"** for all 329 commits. Actual authorship lives only in the ledger `**Author:**` field. Treat "who wrote it" as ledger-declared, not git-verifiable.

## 1. Per-audit counts and severity mix

| # | audit dir | date | n | crit | sig | mod | adv | note | fixed | mit | acc | disp | def | open |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2026-04-08-full-workspace | 04-08 | 27 | 0 | 8 | 13 | 6 | 0 | — | — | — | — | — | — |
| 2 | 2026-08-03-18-m10-query-yg | 08-03 | 36 | **4** | 5 | 22 | 4 | 1 | 34 | 1 | 1 | 0 | 0 | 0 |
| 3 | 2026-08-03-21-m10-fresh | 08-03 | 47 | 0 | 3 | 18 | 17 | 9 | 42 | 3 | 1 | 0 | 1 | 0 |
| 4 | 2026-08-04-16-m10-post-remediation | 08-04 | 27 | 0 | 8 | 4 | 7 | 8 | 27 | 0 | 0 | 0 | 0 | 0 |
| 5 | 2026-08-08-15-m10-fresh | 08-08 | 5 | 0 | 0 | 4 | 1 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2026-08-09-13-m11-final-review | 08-09 | 20 | 0 | 10 | 9 | 1 | 0 | 20 | 0 | 0 | 0 | 0 | 0 |
| 7 | 2026-08-09-1537-m11-post-remediation | 08-09 | 11 | 0 | 6 | 5 | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| 8 | 2026-08-11-07-m12-full-repo | 08-11 | 20 | 0 | 8 | 10 | 2 | 0 | 19 | 0 | 0 | 0 | 1 | 0 |
| 9 | 2026-08-12-10-m13-release-candidate | 08-12 | 14 | 1 | 4 | 7 | 2 | 0 | 9 | 0 | 0 | 0 | 5 | 0 |
| 10 | 2026-08-12-15-m13-post-remediation | 08-12 | 10 | 0 | 1 | 6 | 3 | 0 | 4 | 0 | 0 | 0 | 6 | 0 |
| 11 | 2026-08-12-17-m13-final-verification | 08-12 | 9 | 0 | 1 | 5 | 3 | 0 | 3 | 0 | 0 | 0 | 6 | 0 |
| 12 | 2026-08-12-20-m13-release-closure | 08-12 | 7 | 0 | 0 | 3 | 4 | 0 | 1 | 0 | 0 | 0 | 6 | 0 |
| 13 | 2026-08-14-m14-release-closure | 08-15 | 3 | 0 | 0 | 1 | 2 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 14 | 2026-08-15-0328-m14-release-closure | 08-15 | 3 | 0 | 0 | 1 | 2 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 15 | 2026-08-15-0547-…-final | 08-15 | 3 | 0 | 0 | 2 | 1 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 16 | 2026-08-15-0644-…-clean | 08-15 | 1 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 17 | 2026-08-15-0719-…-clean | 08-15 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 18 | 2026-08-15-1538-…-clean | 08-15 | 8 | 0 | 1 | 7 | 0 | 0 | — | — | — | — | — | — |
| 19 | 2026-08-16-06-pre-release-full | 08-16 | 29 | 0 | 7 | 11 | 9 | 2 | 29 | 0 | 0 | 0 | 0 | 0 |
| 20 | 2026-08-16-21-m14-pre-release | 08-16 | **43** | **2** | **13** | 17 | 8 | 3 | 43 | 0 | 0 | 0 | 0 | 0 |
| 21 | 2026-08-17-07-pre-release-m14 | 08-17 | 10 | 0 | 3 | 4 | 2 | 1 | 8 | 0 | 0 | 1 | 1 | 0 |
| 22 | 2026-08-17-11-pre-release-m14 | 08-17 | 11 | 0 | 4 | 2 | 3 | 2 | 10 | 0 | 0 | 1 | 0 | 0 |
| 23 | 2026-08-17-14-full-repo | 08-17 | 18 | 0 | 0 | 9 | 7 | 2 | 17 | 0 | 0 | 0 | 1 | 0 |
| 24 | 2026-08-17-18-m14-pre-release | 08-17 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 25 | 2026-08-17-20-m14-pre-release | 08-17 | 8 | 0 | 0 | 5 | 3 | 0 | 8 | 0 | 0 | 0 | 0 | 0 |
| 26 | 2026-08-17-21-m14-pre-release-rerun | 08-17 | 13 | 0 | 4 | 4 | 5 | 0 | 13 | 0 | 0 | 0 | 0 | 0 |
| 27 | 2026-08-17-23-pre-release-verify | 08-18 | 39 | 0 | 8 | 17 | 10 | 4 | 31 | 0 | 0 | 1 | **7** | 0 |
| | **TOTAL** | | **426** | **7** | **94** | **191** | **102** | **32** | **348** | **4** | **2** | **3** | **34** | **0** |

**Shape of the curve:** three convergence runs (2→5, 9→12/13→17, 19→24) each drive counts toward zero — then a *scope change* resets the count to 29/43/39. Audits 1–13 = 236 findings (5 crit), audits 14–27 = 190 (2 crit). Severity mix is essentially flat: moderate+advisory is 69% of everything throughout.

## 2. Recurrence

Two different measures, and they disagree in an informative way.

**(a) Same file + same narrative surface, ≥2 audits: 28 clusters of 406 pairs (6.9%).** Top clusters:

| file | surface | #audits | audits | earlier one ledger-fixed? |
|---|---|---:|---|---|
| `.config/deny.toml` | supply-chain | 4 | 3,4,20,27 | YES ×3 |
| `crates/yamalgam-lsp/src/server.rs` | concurrency | 4 | 19,20,23,27 | YES ×3 |
| `crates/yamalgam-query/Cargo.toml` | supply-chain | 3 | 2,3,20 | YES ×2 |
| `crates/yamalgam/Cargo.toml` | supply-chain | 3 | 3,20,27 | YES ×2 |
| `README.md` | completeness | 3 | 19,26,27 | YES ×2 |
| `crates/yamalgam-resolve/src/retriever/http.rs` | concurrency | 3 | 20,23,27 | YES ×3 |
| `docs/yg/reference.md` | completeness | 2 | 26,27 | YES |
| `crates/yamalgam-scanner/src/scanner.rs` | performance | 2 | 20,26 | YES |

22 of 28 recurring clusters had an earlier appearance marked fixed/mitigated. **But** inspecting slugs shows these are almost always *different defects in the same file* — `deny.toml` goes advisory-ignore → unmaintained-crate → openssl-license → sources-policy. That is hotspot re-entry, not fix failure.

**(b) Exact/near-identical finding repeated across audits: only 8 slugs of 407 (2.0%).**

| slug | sev | audits | earlier disposition |
|---|---|---|---|
| `schema-preflight-builds-diagnostics-on-success` | moderate | 9,10,11,12 | **deferred** each time |
| `core-value-emission-collects-every-mapping` | moderate | 9,10,11,12 | **deferred** |
| `lsp-changes-copy-and-rebuild-whole-document` | moderate | 9,10,11,12 | deferred (bundled) |
| `scalar-index-rehashes-randomized-fingerprints` | advisory | 9,10,11,12 | deferred (bundled) |
| `serde-tag-resolver-unnecessary-dynamic-dispatch` | advisory | 9,10,11,12 | deferred (bundled) |
| `schema-value-iterators-omit-size-hints` | advisory | 10,11,12 | deferred (bundled) |
| `cst-discards-parse-error` | advisory | 1,4 | no ledger (audit 1) |
| **`local-cst-edits-still-scan-whole-stream`** | advisory | **13,14** | **FIXED in 13** |

Of 37 cross-audit near-duplicate pairs, the earlier finding's disposition was **deferred in 6, fixed in only 2**, no-ledger in 29. The audit 9→12 block is a single honest carry-forward of six deferred perf items, explicitly documented: *"These six findings are the same bounded internal optimization opportunities carried through the previous audits."*

**The one true "fix didn't stick":** `local-cst-edits-still-scan-whole-stream`, fixed in audit 13 (commit `78e178b`, "derive checked old/new hulls… instead of rescanning unchanged Rope prefixes"), re-flagged in audit 14 under a *different anchor* — "still traverse every syntax node." The byte scan was bounded; a second whole-tree walk remained. The audit-14 ledger entry also documents an intra-round revert: *"the corrective commit removed it and restored the accepted top-level document enumeration."*

## 3. File hotspots

130 distinct files ever flagged; **57 (44%) appear in exactly one audit; 54 appear in ≥3.**

| file | locations | distinct audits | span |
|---|---:|---:|---|
| `crates/yamalgam-schema/src/retrieval.rs` | 38 | **17** | 8–27 |
| `crates/yamalgam-lsp/src/server.rs` | 29 | 9 | 8–27 |
| `crates/yamalgam-lsp/src/diagnostics.rs` | 26 | 13 | 8–23 |
| `crates/yamalgam-query/src/value.rs` | 25 | 7 | 2–26 |
| `crates/yamalgam-scanner/src/scanner.rs` | 23 | 7 | 1–26 |
| `crates/yamalgam-compose/src/lib.rs` | 23 | 7 | 1–27 |
| `crates/yamalgam/src/commands/query.rs` | 20 | 6 | 2–23 |
| `crates/yamalgam-serde/src/de.rs` | 15 | 6 | 1–12 |
| `crates/yamalgam-core/src/loader.rs` | 15 | 7 | 1–25 |
| `crates/yamalgam-lsp/src/document.rs` | 12 | 10 | 8–27 |

| crate | locations | distinct audits |
|---|---:|---:|
| yamalgam-query | 105 | 15 |
| yamalgam-lsp | 97 | **19** |
| yamalgam-schema | 77 | 18 |
| (repo root: Cargo.toml, README, docs, justfile) | 71 | 17 |
| yamalgam-resolve | 54 | 10 |
| yamalgam | 49 | 12 |
| yamalgam-scanner | 37 | 9 |
| yamalgam-cst | 34 | 14 |
| yamalgam-core | 32 | 13 |
| yamalgam-serde | 25 | 9 |
| yamalgam-compose | 24 | 7 |
| yamalgam-emit | 21 | 9 |
| yamalgam-parser | 11 | 4 |
| yamalgam-compare | 9 | 5 |
| yamalgam-bench | 2 | 2 |

`schema/retrieval.rs` is flagged in 17 of 27 audits over a 20-audit span, and the audits 13–18 sequence is a chain of *distinct* cache-coherence bugs on that one file: stale confirmed authority → stale requested cache → missing source generation → ignored cancellation. Each fix was real; each exposed the next state a generation-less cache could reach.

## 4. Disputed / accepted / reviewer rejection

Only **9 non-fix dispositions in 314 entries (2.9%)**: 3 disputed, 2 accepted, 3 corrections, 1 mitigated-with-follow-up.

| audit | disp | subject | slug |
|---|---|---|---|
| 2 | accepted | Retain single-threaded value repr | `rc-makes-value-model-non-send` |
| 3 | accepted | jaq time cost accepted | `jaq-std-time-feature-bundles-tzdb` |
| 20 | correction ×3 | fuzz-workspace lock refreshes | non-exhaustive / encoding-rs / base64 |
| 21 | disputed | lossy parser-event conversion | `event-no-parse-back-bridge` |
| 22 | disputed | atomic update unavailable at MSRV | `fetch-update-deprecated` — **later fixed** when Rust 1.95 landed |
| 27 | disputed | validate HTTP-gate gap | `validate-http-gate-lacks-usage-error` |

Disputed/accepted by surface: supply-chain 3, then one each of value-model, api-design, emitter-api-completeness, pre-release-hygiene, completeness. **Supply-chain is the most-disputed category** — unsurprising, since those findings are policy judgments, not defects.

**reviewer-verdicts.yaml exists in 6 audits, 92 verdicts total: 61 confirmed, 28 adjusted, 2 disputed, 0 rejected/invalid (0.0%).** The audit-2 reviewer summary is explicit: *"No finding is invalid."* Adjustments were line-range off-by-N, overstated magnitudes, and two inflated concern levels — calibration, not false positives.

| audit | verdicts | confirmed | adjusted | rejected | other |
|---|---:|---:|---:|---:|---|
| 2 | 36 | 22 | 14 | 0 | — |
| 3 | 50 | 35 | 14 | 0 | disputed 1 |
| 5 | 6 | 4 | 1 | 0 | disputed 1 |
| 4, 8, 23 | 0 | — | — | — | file present, no verdicts |

## 5. Fix sprawl (329 commits)

| metric | value |
|---|---|
| files/commit | median **2**, mean 3.9, p90 8, max 33 |
| insertions | median 93, total 63,156 |
| deletions | median 12, total 12,883 |
| ins:del ratio | **4.9 : 1** |
| >10 files | 21 commits (6%) |
| ≥2 crates | 87 (26%); ≥4 crates 21 (6%) |
| touches tests/benches/fuzz | 161 (**49%**) |
| **test-only commits** | **7 (2.1%)** |
| doc-only commits | 6 (1.8%) |
| ledger entries citing >1 commit | 19 |
| ledger entries citing 0 commits | 12 (9 deferred, 1 disputed, 2 headerless) |

Crate-count histogram: 210 single-crate, 50 two-crate, 32 zero-crate (root/docs/config), tail out to 14 crates.

**Biggest commits:**

| sha | date | files | +/- | crates | subject |
|---|---|---:|---|---:|---|
| `0259b5b` | 08-17 | 33 | +647/-594 | 9 | refactor(api): unify configurable parse entry points |
| `2eeac07` | 08-18 | 31 | +149/-269 | 7 | fix(resolve): collapse retrieved resource ownership |
| `543b538` | 08-08 | 30 | +1062/-341 | 8 | fix(core): preserve structured resource limit errors |
| `902439e` | 08-17 | 28 | +150/-12 | 11 | fix(api): require Debug on public entry points |
| `1cf84ed` | 08-03 | 27 | +1432/-172 | 3 | feat(cli): ship YAML-native yg query engine |
| `a3a4739` | 08-03 | 27 | +9051/-157 | 3 | fix(query): remediate M10 audit findings |
| `4e8e771` | 08-17 | 26 | +301/-333 | 11 | refactor(api): make configuration surfaces extensible |
| `cdf70a1` | 08-17 | 25 | +72/-0 | 12 | docs: configure complete docs.rs builds |
| `9c96df0` | 08-17 | 17 | +163/-113 | 14 | build: centralize workspace dependencies |

The 11–14-crate commits are all mechanical API-uniformity sweeps (`#[non_exhaustive]`, `Debug` bounds, docs.rs metadata, workspace dep table) — wide but shallow (+150/-12 across 28 files). Genuine multi-crate *logic* fixes are `543b538` and `2eeac07`.

**Test-only commits — none look like test-gaming.** All 7 are 1-file:

| sha | date | +/- | subject |
|---|---|---|---|
| `b212751` | 08-03 | +5/-8 | test(cli): expect strict value depth enforcement |
| `d64cc6c` | 08-12 | +26/-7 | test(fuzz): assert exact campaign argv |
| `9ce6e23` | 08-17 | +5/-8 | fix(fuzz): construct extensible emit options |
| `25ff344` | 08-17 | +0/-10 | fix(fuzz): refresh scanner dependency lock |
| `2c6cdb4` | 08-17 | +8/-2 | fix(fuzz): refresh Base64 dependency lock |
| `7034f49` | 08-18 | +17/-2 | test(compare): enforce invalid fixture rejection |
| `7c5bb4b` | 08-18 | +61/-9 | test(compare): include resolved tags in compliance |

5 are fuzz-workspace lock/API refreshes following an implementation change; 2 (`7034f49`, `7c5bb4b`) *tighten* the compliance harness in direct response to audit-27 findings that the compliance claim was over-stated. Those two add assertions rather than remove them.

**Authorship:** git says Clay Loveless ×329. Ledgers say Codex 249, OpenAI Codex 49, "Clay Loveless and Codex" 13, "Clay and OpenAI Codex" 1, none 2. **Ledger-declared: ~95% Codex-authored, 4.5% pair-authored, 0% Clay-solo.**

**Cadence (fix commits/day):** 08-03:20, 08-04:30, 08-06:2, 08-08:29, 08-09:12, 08-11:19, 08-12:31, 08-15:34, 08-16:37, **08-17:87**, 08-18:28.

## 6. Regression signal — the null result

- **Loose regex** (`regression|introduc|revert|recent change|after the`): 63/426 findings; joining to fix commits yields 372 file-overlap pairs. **This is noise.** Nearly every hit is a remediation instruction — "add a regression test."
- **Strict regex** (excluding "regression test/coverage/fixture/suite"): **3/426 findings.** All three are *forward-looking* — "rather than reintroducing the linear scan there" (`compose-insert-pair-quadratic-dedup`, audit 20), "so the pattern cannot be reintroduced" (`scanner-directive-error-bypasses-terminal-state`, audit 20), "and reintroduce them when the LSP actually consumes a catalog" (`lsp-server-config-exposes-inert-schemastore-fields`, audit 27). **Zero findings attribute a defect to a prior fix.**

## 7. Ledger keyword grep

`revert|regress|broke|reintroduc|follow-up|re-fix|again`: 94/314 raw hits. After stripping "regression test/coverage/fixture/suite/guard/case/bench", **73 remain — and `regress` (57 of those) is still almost entirely test-naming.** Genuinely substantive: `follow-up` = 5, `broke` = 1, `again` = 12 (mostly prose: "canonicalize again", "composing the source again").

The real re-fix hit list, in full:

| # | audit | disp | what |
|---|---|---|---|
| 3 | 2026-08-03-21-m10-fresh | mitigated | "A **follow-up** action must bound that error-formatting path" — `Display for YamlVal` unbounded; closed in audit 4 |
| 13 | 2026-08-14-m14-release-closure | fixed | "A **follow-up** fix preserved exact open overlays after backing-file de…" |
| 14 | 2026-08-15-0328-m14-release-closure | fixed | intra-round revert: "the corrective commit **removed it and restored** the accepted top-level document enumeration" |
| 17 | 2026-08-15-0719-…-clean | fixed | 2 entries each citing **2 commits** — RED regression + corrective follow-up, source-generation identity and forced retargets |
| 22 | 2026-08-17-11-pre-release-m14 | disputed→fixed | "2026-08-17 **follow-up** — Rust 1.95 enables the atomic update replacement" — dispute resolved by toolchain bump |

That is **5 re-fix events across 314 ledger entries (1.6%)**.

---

## What this data says about churn

- **[FACT] The churn is scope-driven, not rework-driven.** Only 8 of 407 slugs (2.0%) ever repeat, 6 of those are one explicitly-deferred perf bundle, and exactly **one** finding was marked fixed and then re-flagged. 44% of flagged files appear in a single audit.
- **[FACT] The audit process has essentially no false-positive rate.** 92 reviewer verdicts, 0 rejected. 3 disputed dispositions in 314 entries (1.0%) — and one of those (`fetch-update-deprecated`) was later fixed when the MSRV allowed it. Disputes cluster in supply-chain, where findings are policy calls.
- **[FACT] Fixes are small and test-backed.** Median 2 files / 93 insertions; 49% touch tests; only 7 test-only commits, none of which weaken assertions. The 21 wide commits are mechanical API sweeps, not sprawling logic rewrites.
- **[INFERENCE] `schema/retrieval.rs` is a design problem, not a fix-quality problem.** 38 locations across 17 audits, and audits 13→18 walk a chain of *distinct* cache-coherence bugs (stale authority → stale requested → missing generation token → ignored cancellation). Each fix was correct; the cache lacked a generation concept until audit 17 introduced one. That's iterative discovery of one missing invariant, and the chain terminates once the invariant lands.
- **[INFERENCE] The 26 audits in 15 days are a convergence protocol, not thrash.** Three descending runs (36→5, 14→1, 43→2) each reach near-zero before a deliberate scope widening resets the count. Audits 24 and 16 finding 2 and 1 issues respectively is the protocol working.
- **[INFERENCE] Hotspot re-flagging is surface breadth, not fix failure.** 22/28 recurring file+surface clusters had a prior "fixed", but the slugs differ every time — `deny.toml` cycled through four unrelated policy gaps. Reading cluster recurrence as failed remediation would be wrong.
- **[INFERENCE] Codex authored ~95% of remediation and the audits caught its work honestly.** Ledger-declared authorship is Codex 298 / pair 14 / Clay-solo 0. The one fix that didn't stick and the one intra-round revert are both documented in the ledger by the same agent that wrote them — the record is self-critical rather than self-congratulatory.
- **[INFERENCE] The main risk this data surfaces is *documentation drift*, not code drift.** The late audits (19, 26, 27) increasingly flag `README.md`, `docs/yg/reference.md`, and compliance-claim accuracy — the code converged faster than the prose describing it. Audit 27's 7 deferrals are all packaging/policy items, which is the right thing to carry into a release.
