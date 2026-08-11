# Handoff: Multi-platform skill hardening + viewer fixes

**Date:** 2026-04-12
**Branch:** main
**State:** Green

## Where things stand

Four PRs landed this session. R5 and R8 close the multi-platform skill requirements list (5 of 10 merged, 2 closed-as-covered-by-R1, 3 deferred). A real Codex audit against rebar surfaced three audit-quality bugs — two are fixed (recon test-runner detection, flow-to-svg off-spine finding annotations) and one is open (sparklines missing from report.html). Tree is clean; 64 tests pass via `just test`.

## Decisions made

- **PR #26 (R5) — `<SUBAGENT-STOP>` guards** on `skills/cased/SKILL.md` and all 8 agent rubrics. Prevents a dispatched subagent from re-entering the full controller workflow when it auto-loads the skill. 9 files, +36 lines.

- **PR #27 (R8) — Gemini extension + multi-platform setup docs.** Ships `gemini-extension.json` + `GEMINI.md` (real plugin-level auto-load for Gemini consumers via `contextFileName`) plus a README "Multi-platform setup" section. Deliberately skipped repo-root `CLAUDE.md`/`AGENTS.md`: plugin-level auto-inject into user-project CLAUDE.md or AGENTS.md is NOT supported by Claude Code or Codex today. Superpowers' CLAUDE.md/AGENTS.md are contributor guidelines, not tool-mapping loaders — copying them would be cargo-cult.

- **PR #28 — Recon test-runner detection.** New `testing` top-level block in `recon.yaml`, populated deterministically by priority: scrat `commands.test` (YAML or TOML) → Justfile `test:` recipe → `package.json` `scripts.test` → nextest config → Cargo.toml default. SKILL.md Phase 1 now tells agents: "Do NOT run tests during audit. If dynamic verification is needed, use `recon.yaml#testing.command`." Structural redirect from an initial "add a don't-run-tests rule in prose" proposal — encoding project intent as data beats encoding it as a rule agents might skip.

- **PR #29 — Flow-to-svg off-spine finding annotations.** Finding annotations attached to off-spine steps (decision-branch landings with `spine: false`) were silently dropped by the main annotation loop, which only iterated `spineSteps`. Extracted a `renderFindingAnnotations()` helper parameterized on x-coordinate, called from both spine and off-spine loops. Also guarded a latent null-deref in the chain-reference loop. Deleted 4 stale tests encoding horizontal layout that was removed earlier (the source header at `src/viewer/flow-to-svg.js:29` documents the removal).

- **Rebar eval drove both viewer PRs.** The Codex audit at `/Users/clay/source/claylo/rebar/record/audits/2026-04-12-full-crate/` has 2 narratives with `flow:` blocks, 7 findings total, all attached to off-spine steps. Before #29: 0 margin annotation titles across all flow SVGs. After #29: all 7 render with hairline connectors. Verified live in the browser via the superpowers-chrome skill.

## What's next

1. **Issue #2 — Sparklines missing from `report.html`.** Rebar audit produced exactly one sparkline SVG in `assets/` (the 12-month commit activity graphic) but none appear rendered in the final HTML. Not yet investigated. Entry points: `src/viewer/build-report.mjs` sparkline-insertion logic and whatever renders per-finding commit activity.

2. **Flow annotation stacking polish.** When a step has 3+ findings, the stacked titles extend below the step's y-coordinate and overlap the off-spine step's label. Geometry: `titleY = findingBaseY - 2 + fi*20` with `findingBaseY = y - 50`. For fi=2 (3rd finding): titleY = y + 8, 8px below the step row. Visible on both rebar flows. Fix options: compress vertical spacing, shift `findingBaseY` higher when N > 2, or rotate long findings into a multi-column layout.

3. **R3 / R7 / R10 of the multi-platform requirements list.** Rebar eval showed Codex dispatched subagents successfully, so R7 (graphviz digraphs for dispatch decisions) and R3 (standalone dispatch prompt templates) didn't surface as failures. Close them unless a future audit reveals specific need. R10 (session-start verification script) would catch `multi_agent = true` missing on consumer machines; low urgency.

4. **Consider a `gemini-tools.md` reference** only if real Gemini consumer usage emerges. Currently `GEMINI.md` includes only SKILL.md to avoid teaching Gemini Codex-specific tool names.

## Landmines

- **Codex Default mode actively pushes "reasonable assumptions."** Its base instructions say: "strongly prefer making reasonable assumptions and executing the user's request rather than stopping to ask questions." `~/.codex/AGENTS.md` reinforces this. The recon `testing` block encodes project intent as data to counter the guessing tendency — but if Codex hits a project without a recon `testing` block, it may still guess. Tie any future audit-behavior fixes to recon data, not SKILL.md prose.

- **`just check-bundle` reports false drift on uncommitted edits.** Runs `scripts/build-viewer.sh` then `git diff --quiet skills/cased/` against HEAD. Any uncommitted edit under `skills/cased/` registers as drift even when intentional. Expected during WIP; clears after commit. Hit twice this session.

- **Editing recon or viewer sources requires a regenerated-bundle commit.** `src/recon/recon-to-yaml.mjs` and `src/viewer/*.js` are sources; `skills/cased/scripts/` has bundled copies. Run `just build-viewer` or `just build-schemas` before committing, or `just check-bundle` will fail post-merge.

- **Claude Code and Codex have no plugin-level auto-inject for CLAUDE.md/AGENTS.md.** Those files live in user projects, not plugin directories. The R8 requirement as originally phrased (`@`-include tool mappings at session start) is only achievable for Gemini. Don't try to expand R8 to make CC/Codex auto-load; the gap is platform capability, not PR scope.

- **rebar has `.config/scrat.toml` with `test = "just test"` but no Justfile.** Recon detection surfaces what the config says, not what works. Agents consulting `testing.command` would receive `just test`, which would fail with "command not found." This is a rebar misconfiguration, not a cased bug — but worth knowing if a future eval uses rebar as a fixture.

- **The `.handoffs/2026-04-12-1540-...md` orphan** accidentally landed in PR #28 because it was staged before the branch pivot and carried across. This handoff deletes it and supersedes. If you see references to the 1540 handoff in older chat context, they're stale.

- **Flow diagram DOM may show duplicate `.flow-diagram` containers.** Pre-reload the rebar report showed 4 flow-diagram divs for 2 narratives-with-flows; after reload, only 2. Likely the slide mode ("Present" button) clones elements on activation. Not a rendering bug, but selector-based tests should use `:not([aria-hidden])` or similar to avoid false duplicates.

- **Multi-platform requirements doc `ref/multi-platform-skills-requirements.md` is gitignored** via user-global `~/.gitignore`. Don't stage files from `ref/`.
