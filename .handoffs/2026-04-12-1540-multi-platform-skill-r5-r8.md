# Handoff: Multi-platform skill adaptation — R5 and R8 landed

**Date:** 2026-04-12
**Branch:** main
**State:** Green

## Where things stand

Two more PRs shipped against the 10-item multi-platform requirements list: R5 (SUBAGENT-STOP guards, PR #26) and R8 (Gemini extension + multi-platform setup docs, PR #27). Five of ten requirements now merged (R1, R2, R5, R6, R8). Remaining items (R3, R7, R10) are paused pending eval evidence from a real Codex audit.

## Decisions made

- **R5 — `<SUBAGENT-STOP>` guard between frontmatter and first content** in `skills/cased/SKILL.md` and all 8 agent rubrics under `skills/cased/agents/`. Pattern lifted from `~/source/reference/superpowers/skills/using-superpowers/SKILL.md` lines 6-8. Prevents a dispatched subagent from re-entering the full controller workflow when it auto-loads the skill. 9 files, +36 lines.

- **R8 — shipped `gemini-extension.json` + `GEMINI.md` at repo root, plus a "Multi-platform setup" section in `README.md`.** The Gemini pair is real session-start auto-load mechanism — `gemini-extension.json` declares `"contextFileName": "GEMINI.md"`, and `GEMINI.md` `@`-includes `./skills/cased/SKILL.md`. The README section is the documentation path for Codex (config flag + `AGENTS.md` snippet) and Claude Code (no setup).

- **R8 scope deliberately narrowed.** Plugin-level auto-inject into user-project `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex) is NOT a capability any of those platforms supports today — those files live in the consumer's own project, not the plugin directory. Only Gemini has a plugin-level context-file mechanism. The PR ships what's achievable and documents the rest. It does not add repo-root `CLAUDE.md`/`AGENTS.md` because those would mirror superpowers' pattern without serving the same purpose (superpowers uses them for contributor guidelines, not tool-mapping auto-load).

- **`GEMINI.md` intentionally excludes `codex-tools.md`** from its `@`-includes. Loading Codex-specific tool names (`spawn_agent`, `wait`, `close_agent`) into Gemini's context would teach the wrong vocabulary. SKILL.md's own "Platform adaptation" block directs the model to consult `references/` for the right mapping per platform.

- **R3, R7, R10 paused pending eval.** The requirements doc at `ref/multi-platform-skills-requirements.md` already marks R3 and R10 as "defer unless eval evidence." Next action is a real Codex audit against another project; that signal decides whether the remaining items warrant work or can be closed.

## What's next

1. **Codex audit run against another project (off this repo).** Gather evidence on whether R1-R8 made Phase 2 parallel dispatch reliable under Codex. The original failure that motivated this whole sequence was a rebar audit producing four shallow findings — that's the baseline to compare against.

2. **Based on the audit evidence, decide each remaining requirement:**
   - If parallel dispatch works cleanly: close R3/R7/R10 with a note citing the audit run as eval evidence.
   - If Phase 2 branching behavior is inconsistent: R7 (graphviz digraph in `skills/cased/SKILL.md` for the dispatch decision tree).
   - If inlined dispatch prompts produce unreliable subagent output: R3 (extract to `skills/cased/agents/prompts/{role}-prompt.md`).
   - If users hit silent degradation from a missing `multi_agent = true` flag: R10 (session-start verification script).

3. **Consider a `gemini-tools.md` reference** only if real Gemini consumer usage surfaces a need. Currently no Gemini-specific mapping exists; `GEMINI.md` relies on SKILL.md's platform-adaptation block to direct translation. Writing one is a small, separable PR when demand emerges.

## Landmines

- **The R8 requirement as written in `ref/multi-platform-skills-requirements.md` is aspirational for CC/Codex.** It says "the entry file `@`-includes the relevant `references/{platform}-tools.md`" — this only works for Gemini. Claude Code and Codex have no plugin-level auto-inject mechanism. Do not try to expand R8 to make CC/Codex auto-load; the gap is platform capability, not PR scope.

- **`just check-bundle` reports false drift on uncommitted edits.** The recipe runs `scripts/build-viewer.sh` then `git diff --quiet skills/cased/` against HEAD. Any uncommitted edit under `skills/cased/` shows as drift even when intentional. Expected during WIP; clears after commit.

- **Superpowers' `CLAUDE.md` and `AGENTS.md` are contributor guidelines, not tool-mapping loaders.** They contain 94%-rejection-rate messaging about PR discipline. Don't mirror them into cased expecting auto-load behavior — that behavior exists only via the `gemini-extension.json` + `GEMINI.md` pair.

- **`ref/` is gitignored via `~/.gitignore` line 38** (user-global, not repo-local). Any `ls -la` run locally won't show it as ignored-here. Don't try to stage or commit files under `ref/`.

- **Prior handoff at `.handoffs/2026-04-12-1509-multi-platform-skill-r1-r6.md` is stale** — it lists R5 and R8 as "what's next." This handoff supersedes its "what's next" section.

- **`gemini-extension.json` uses `"version": "0.1.0"`** as a starting value. cased has no prior versioning (no field in `package.json`, no tags, no `CHANGELOG`, `.config/scrat.yaml` has `no_publish: true`). When versioning starts, revisit this choice.
