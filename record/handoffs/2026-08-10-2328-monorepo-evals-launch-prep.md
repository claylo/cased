# Handoff: monorepo consolidation, eval harness, launch prep

**Session:** 2026-08-10 evening. Large session; everything below is
committed and pushed unless marked pending.

## Structural changes

- **crustoleum merged into this repo** at `skills/crustoleum/` (subtree
  merge, history preserved). Old repo archived with pointer README.
  Skill symlinks in `~/.claude/skills/` and `~/.codex/skills/` repoint
  here.
- **Shared contract extracted**: `src/schemas/` is canonical;
  `build-schemas.sh` stamps into every consumer skill listed in its
  `build_one findings ...` line, validates with `ys` (yaml-schema).
  `just check-contract` fails CI on drift. New language skills add
  themselves to that list — never copy schema files by hand.
- **CI** (`.github/workflows/ci.yaml`): test, check-bundle,
  check-contract, build-smoke. SHA-pinned actions.
- `example/` deleted (12 schema errors, March-era). `just build-smoke`
  renders from canonical examples instead; test fixtures likewise.

## Eval harness (`evals/`)

Location-based scoring (slugs/narratives are model-authored free text —
never match on them). Runner stamps provenance; model self-report is
never trusted. See `evals/README.md`.

**Matrix so far** (fixture: error-handling-rs, 7 seeded defects):

| run | recall | unexpected | calib | strays | wall |
|---|---|---|---|---|---|
| claude/default | 7/7 | 6 | 1 | n/a | 14m |
| claude/opus | 7/7 | 14 | 2 | 0 | 23m |
| codex/gpt-5.6-sol* | 6/7 | 3 | 0 | 0† | 33m |

\* contaminated: ran pre-hermetic-flags with user config/memory loaded —
observed surfacing librebar/bito audits and depositing a ghost
terrain-map.svg (deprecated March-era artifact, rendered live by
`~/.local/bin/pikchr`, propagated as a codex-memory habit).
† pre-tightening; the tightened check flags the terrain ghost.

**Codex runs are now hermetic** (`--ephemeral --ignore-user-config`).

## Pending / next actions

1. **Hermetic codex re-run** for the clean matrix column:
   `just eval error-handling-rs --platform codex --model gpt-5.6-sol`
   then `just eval-compare` across all three run dirs.
2. **Fresh cased-on-cased self-audit** into `record/audits/` — launch
   demo #1 (replaces what example/ pretended to be).
3. **Launch sequence** (decided, not started): claylo.dev release post →
   Show HN ("Code audits that read like heist plans") → skill lists →
   plugin marketplace packaging. Second demo target: OWASP Juice Shop
   (recall vs published vulnerability catalog). Avoid actix-adjacent
   anything.
4. **Process-compliance scoring**: spec'd in
   `record/plans/process-compliance-scoring.md` (stream-json events,
   five checks + intermediates-immutability). Not built.
5. **axe**: premise doc updated for Agent Plugins 1.0 (adopts
   plugin.json as packaging; axe owns the behavioral layer). cased is
   the designated hard-corpus test case.

## Conventions established this session

- Fix commits for audit findings carry `Audit-Finding: <slug>` trailers;
  ledger entries batch afterward citing real SHAs (see
  actions-taken-schema.md and the AGENTS.md template).
- Audit publishers need the linguist-generated `.gitattributes` block
  (README documents it) or GitHub calls their repo "HTML".
- Generated intermediates are immutable post-emission; agents return
  analysis in final messages, never as files.
- GitHub search for published audits:
  `gh search code --filename findings.yaml "evidence_markers"`
  (17 audits across 6 repos as of tonight, all Clay's).
