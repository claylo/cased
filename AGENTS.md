# cased monorepo — agent briefing

This repo hosts a family of code-audit skills: **cased** (the audit
orchestrator) and **crustoleum** (Rust review), with future language skills
(embargo/Go, snakeoil/Python, typecast/TS) joining as siblings under
`skills/`. crustoleum merged in from its own repo on 2026-08-10; its
history is reachable here via `git log --follow`.

## Layout

| Path | What it is |
|---|---|
| `src/schemas/` | **Canonical** audit contract: findings/recon JSON Schemas, examples, doc fragments |
| `src/viewer/` | **Canonical** report builder source (`build-report.mjs`) and viewer JS |
| `src/recon/` | Recon pre-runner source |
| `skills/cased/` | Shipped skill. `scripts/`, `templates/`, and contract files in `references/` are **generated** |
| `skills/crustoleum/` | Shipped skill. Contract files in `references/` are **generated**; the rest is authored |
| `evals/` | Seeded fixtures + runner + scorer (see `evals/README.md`) |
| `example/` | Checked-in sample audit used by `just build-example` |
| `record/` | Process artifacts (audits of this repo, superpowers plans) — not user docs |

## Iron rules

- **Never hand-edit generated files.** `skills/*/references/{findings,recon}.schema.json`,
  `*.example.yaml`, `*-schema.yaml.md`, `skills/cased/scripts/build-report.js`,
  and `skills/cased/templates/` are stamped by `just build-schemas` /
  `just build-viewer`. Edit `src/`, rebuild, and commit both. CI fails on
  drift (`check-contract`, `check-bundle`).
- **Verify through the skill path.** `~/.claude/skills/{cased,crustoleum}`
  and `~/.codex/skills/*` symlink into this repo. After rebuilding, test via
  the symlinked path, not just `src/`.
- **The skill zip must stay self-contained** — no npm install at use time;
  everything pre-bundled (rolldown).
- **Never manually bump versions** in any manifest. Ask first if you think
  you need to.
- **Commits**: conventional format written to `commit.txt`; Clay runs
  `gtxt`. This repo is scrat-managed — `feat`/`fix` commits need
  `Release-Note:` (≤60 chars) and `Release-Impact:` trailers.

## Commands

```bash
just test            # node --test (build-report, recon, eval scorer)
just check-bundle    # rebuild viewer bundle, fail on drift
just check-contract  # restamp schema contract, fail on drift (validates examples with the bundle's ajv)
just build-example   # full pipeline against example/ data
just eval <fixture>  # live audit eval — real tokens, minutes; not for CI
```

## Contract change protocol

A change to the findings/recon contract touches `src/schemas/` only, then
`just build-schemas` propagates it to every consumer skill listed in
`build-schemas.sh` (`build_one findings cased crustoleum ...`). New
consumer skills add themselves to that list — never copy schema files by
hand.

## Multi-platform notes

cased runs on Claude Code, Codex, and Gemini. Platform adapters live in
`skills/cased/references/codex-tools.md` and the SKILL.md "Platform
adaptation" section. Tool invocations inside audits must go through a
project's task runner (justfile etc.) when one exists — both skills
instruct this; keep it true in new agent prompts.
