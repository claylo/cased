# Audit Churn Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cased` audits converge instead of loop — by giving the contract memory (prior ledgers), causation (`origin`), a recorded scope (`audit_profile`), mechanical gates (evidence fidelity, README completeness, ledger lint, finalize), a remediation contract with verification/blast-radius/pushback obligations, and evals that measure every one of those behaviours.

**Architecture:** Contract changes land in `src/schemas/` and are stamped into `skills/*/references/` by `build-schemas.sh` (never edit stamped copies). Mechanical gates live in `src/viewer/build-report.mjs` as new subcommands (`evidence`, `ledger`, `finalize`) bundled by rolldown into `skills/cased/scripts/build-report.js`. Skill prose (`SKILL.md`, agent prompts, templates) instructs the model to use them. Evals gain a `re-audit` fixture family, a `remediate` run mode, artifact-level scoring, and hidden cross-module tests — the measurement for "passed unit tests but broke the stack."

**Tech Stack:** Node ≥ 20 (`node:test`, `yaml`, `ajv`), rolldown bundling, bash (`set -euo pipefail`), `just`, `ys` (yaml-schema) for contract validation. No new runtime deps in the shipped skill.

**Spec:** `record/research/2026-08-18-yamalgam-audit-churn.md` §4 (audit side), §5 (remediation contract), §6 (termination condition). Read it first; every task cites the finding it answers.

## Global Constraints

- **Contract source of truth is `src/schemas/`.** Edit `*.schema.json`, `*.example.yaml`, `*.md.header/footer` there, run `just build-schemas`, commit the stamped copies. `just check-contract` must pass.
- **Skill must ship pre-bundled.** After any `src/viewer/*` change: `scripts/build-viewer.sh` then commit `skills/cased/scripts/build-report.js` + `skills/cased/templates/*`. `just check-bundle` must pass.
- **Verify through the skill path.** Smoke test the bundle via `node skills/cased/scripts/build-report.js ...` in addition to source mode (`node src/viewer/build-report.mjs ...`).
- **Backward compatibility of old audit dirs is not required** for `finalize`/`ledger`/`evidence` (they are opt-in gates), but `validate` on the canonical examples must keep passing and old `findings.yaml` files without new fields must still `build` (all new finding-level fields are optional; `meta.audit_profile` is required only for **new** recon output — the pre-runner emits it).
- **Tests run with `just test`.** Add every new test file to the `test:` recipe in `justfile`.
- **No Python.** Node or bash only.
- **Never bump versions manually.**
- **Plans/specs live in `record/superpowers/`; user docs in `docs/`.**
- **Commit style:** conventional commits; Clay commits himself from `commit.txt` when working interactively. Subagents executing this plan may commit directly with the messages given.

---

## File Structure

| Path | Responsibility | Status |
|---|---|---|
| `src/schemas/findings.schema.json` | + `origin`, `failure_mode` per finding; + top-level `carried_forward`, `reconciliation` | modify |
| `src/schemas/findings.example.yaml` / `findings.md.header` / `findings.md.footer` | canonical example + prose for new fields | modify |
| `src/schemas/recon.schema.json` / `recon.example.yaml` / `recon.md.footer` | + `meta.audit_profile` | modify |
| `src/recon/recon` | tokei/git excludes for `record/audits`, `*.html`; skill-version capture | modify |
| `src/recon/recon-to-yaml.mjs` | emit `meta.audit_profile` stub (`mode`, `prior_audit`, `skill_versions`) | modify |
| `src/viewer/prior-audits.mjs` | **new**: discover prior audit dirs, parse ledgers, front-matter status | create |
| `src/viewer/gates.mjs` | **new**: `checkEvidenceFidelity`, `checkReadmeComplete`, `checkAuditProfile`, `lintLedger`, `isBlocking`, `finalizeAudit` | create |
| `src/viewer/build-report.mjs` | wire subcommands `evidence`, `ledger`, `finalize`; render blockers/backlog split; carried-forward + reconciliation in README scaffold and AGENTS.md | modify |
| `src/viewer/agents-md-template.md` | remediation contract rewrite (verification, blast radius, diff budget, pushback, release phase) | modify |
| `src/viewer/readme-template.md` | + Reconciliation + Carried Forward sections; blockers/backlog split in ledger | modify |
| `skills/cased/SKILL.md` | re-audit mode, audit_profile, class sweep, reviewer split, finalize gate, scratch-file policy, termination rule | modify |
| `skills/cased/references/subagent-output-contract.md` | + `origin`, `failure_mode`, class-sweep rule, scratch-file rule | modify |
| `skills/cased/references/actions-taken-schema.md` | new dispositions + required fields for `fixed` | modify |
| `skills/cased/agents/reviewer.md` | adversarial reviewer: `mechanism_verified`, no proofreading (that's `evidence`) | modify |
| `skills/crustoleum/SKILL.md`, `skills/crustoleum/agents/*.md` | class-sweep + origin instructions (findings contract consumer) | modify |
| `evals/scripts/score-eval.mjs` | + `scoreReaudit`, `scoreArtifacts`, `scoreRemediation` | modify |
| `evals/scripts/run-eval` | `--mode audit\|remediate`, fixture `setup.sh` hook, hidden tests | modify |
| `evals/scripts/compare-runs.mjs` | show new metrics | modify |
| `evals/fixtures/reaudit-rs/` | **new** fixture: prior audit dir + ledger + seeded regression/carried-forward/class-sweep/caused-by + hidden tests | create |
| `evals/fixtures/error-handling-rs/hidden-tests/` | **new**: cross-module contract test for remediation mode | create |
| `test/prior-audits.test.mjs`, `test/gates.test.mjs`, `test/eval-score-reaudit.test.mjs` | unit tests | create |
| `justfile` | test recipe additions; `eval` passes through `--mode` | modify |
| `evals/README.md` | document new modes/metrics/fixture layout | modify |

---

# Phase 1 — Contract

### Task 1: `origin` and `failure_mode` on findings; `carried_forward` and `reconciliation` at top level

Answers spec §4.1, §4.2, §4.6 (root causes 2, 5 — "no memory", "no causation field").

**Files:**
- Modify: `src/schemas/findings.schema.json`
- Modify: `src/schemas/findings.example.yaml`
- Modify: `src/schemas/findings.md.footer`
- Test: `test/build-report.test.mjs` (existing validator tests)

**Interfaces:**
- Produces (schema): per-finding optional `origin: {kind: "pre-existing"|"new-in-diff"|"caused-by-fix"|"recurrence-of", ref?: string}`; per-finding optional `failure_mode: "user-visible"|"internal"|"policy"|"documentation"`; top-level optional `carried_forward: [{slug, prior_audit, disposition: "deferred"|"accepted"|"mitigated", reason?}]`; top-level optional `reconciliation: [{prior_slug, prior_audit, status: "still-fixed"|"regressed"|"superseded"|"not-verified", superseded_by?, verified_against?}]`.

- [ ] **Step 1: Write the failing test** — append to `test/build-report.test.mjs`:

```js
describe('findings contract: origin / failure_mode / carried_forward / reconciliation', () => {
  const schemaDir = resolveSchemaDir('src/viewer');
  const { validateFindings } = compileValidators(schemaDir);

  it('accepts a finding with origin.kind caused-by-fix and a ref', () => {
    const doc = YAML.parse(findingsYaml);
    doc.narratives[0].findings[0].origin = { kind: 'caused-by-fix', ref: '660a8a4' };
    doc.narratives[0].findings[0].failure_mode = 'user-visible';
    assert.equal(validateFindings(doc), true, JSON.stringify(validateFindings.errors));
  });

  it('rejects an unknown origin.kind', () => {
    const doc = YAML.parse(findingsYaml);
    doc.narratives[0].findings[0].origin = { kind: 'magic' };
    assert.equal(validateFindings(doc), false);
  });

  it('accepts carried_forward and reconciliation blocks', () => {
    const doc = YAML.parse(findingsYaml);
    doc.carried_forward = [{ slug: 'old-perf-nit', prior_audit: '2026-08-12-10-m13-release-candidate', disposition: 'deferred', reason: 'bounded internal optimization; milestone M15' }];
    doc.reconciliation = [{ prior_slug: 'silent-write-discard', prior_audit: '2026-08-12-10-m13-release-candidate', status: 'still-fixed', verified_against: 'a3a4739' }];
    assert.equal(validateFindings(doc), true, JSON.stringify(validateFindings.errors));
  });

  it('rejects reconciliation with an unknown status', () => {
    const doc = YAML.parse(findingsYaml);
    doc.reconciliation = [{ prior_slug: 'x', prior_audit: 'y', status: 'maybe' }];
    assert.equal(validateFindings(doc), false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/build-report.test.mjs 2>&1 | grep -E 'origin|not ok' | head`
Expected: the "rejects" tests FAIL (schema currently permissive) — 2 failing.

- [ ] **Step 3: Edit `src/schemas/findings.schema.json`.** Inside the finding item `properties` (sibling of `chains`), add:

```json
"origin": {
  "type": "object",
  "required": ["kind"],
  "additionalProperties": false,
  "properties": {
    "kind": { "type": "string", "enum": ["pre-existing", "new-in-diff", "caused-by-fix", "recurrence-of"],
      "description": "How this finding relates to prior audits and fixes. pre-existing: present before the last audit and never reported. new-in-diff: introduced by commits since the prior audit, not by a ledgered fix. caused-by-fix: introduced by a ledgered remediation commit (ref = SHA or prior slug). recurrence-of: a prior slug that was ledgered fixed and is back (ref = prior slug)." },
    "ref": { "type": "string", "description": "Commit SHA or prior finding slug the kind refers to. Required for caused-by-fix and recurrence-of." }
  },
  "if": { "properties": { "kind": { "enum": ["caused-by-fix", "recurrence-of"] } } },
  "then": { "required": ["kind", "ref"] }
},
"failure_mode": {
  "type": "string",
  "enum": ["user-visible", "internal", "policy", "documentation"],
  "description": "What fails if unaddressed. user-visible: wrong output, exit code, panic, data loss, hang reachable by a user. internal: perf/ownership/design cost with no user-visible symptom yet. policy: supply-chain/licensing/process. documentation: prose or metadata drift. Drives release gating: only critical/significant + user-visible block."
}
```

At the top-level `properties` (sibling of `summary`), add:

```json
"carried_forward": {
  "type": "array",
  "description": "Prior-audit findings with a standing deferred/accepted/mitigated disposition. Listed for tracking, EXCLUDED from narratives, counts, and the AGENTS.md finding index. Populated in re-audit mode from prior actions-taken.md files.",
  "items": {
    "type": "object",
    "required": ["slug", "prior_audit", "disposition"],
    "additionalProperties": false,
    "properties": {
      "slug": { "type": "string" },
      "prior_audit": { "type": "string", "description": "Audit directory basename, e.g. 2026-08-12-10-m13-release-candidate" },
      "disposition": { "type": "string", "enum": ["deferred", "accepted", "mitigated"] },
      "reason": { "type": "string" }
    }
  }
},
"reconciliation": {
  "type": "array",
  "description": "Re-audit mode: verdict on every prior finding ledgered fixed. still-fixed = fix present and effective; regressed = the defect is back (must also appear as a finding with origin.kind recurrence-of); superseded = a new finding replaces it (superseded_by); not-verified = could not check (say why in the report).",
  "items": {
    "type": "object",
    "required": ["prior_slug", "prior_audit", "status"],
    "additionalProperties": false,
    "properties": {
      "prior_slug": { "type": "string" },
      "prior_audit": { "type": "string" },
      "status": { "type": "string", "enum": ["still-fixed", "regressed", "superseded", "not-verified"] },
      "superseded_by": { "type": "string" },
      "verified_against": { "type": "string", "description": "Fix commit SHA whose diff was re-read" }
    }
  }
}
```

- [ ] **Step 4: Update the canonical example.** In `src/schemas/findings.example.yaml`, add to the first finding (after `effort_notes`):

```yaml
        origin:
          kind: pre-existing
        failure_mode: user-visible
```

and to a second finding in a later narrative:

```yaml
        origin:
          kind: caused-by-fix
          ref: 8f4b559
        failure_mode: internal
```

Append at the end of the file (after `summary:`):

```yaml
carried_forward:
  - slug: hooks-timeout-not-configurable
    prior_audit: 2026-03-30-14-full-workspace
    disposition: deferred
    reason: "Targeted at the 0.4 milestone; no user report yet"

reconciliation:
  - prior_slug: truncation-panic-on-multibyte
    prior_audit: 2026-03-30-14-full-workspace
    status: still-fixed
    verified_against: 3f9c2b1
  - prior_slug: shell-error-swallowed
    prior_audit: 2026-03-30-14-full-workspace
    status: regressed
```

- [ ] **Step 5: Document in `src/schemas/findings.md.footer`.** Append a section:

```markdown
## Origin, failure mode, and re-audit blocks

Every finding SHOULD carry `origin.kind`. In a first audit of a repo every
finding is `pre-existing`. In a re-audit (a prior `record/audits/*/` exists)
you must decide per finding: was this here before and missed
(`pre-existing`), introduced by ordinary commits since the last audit
(`new-in-diff`), introduced by a ledgered fix (`caused-by-fix`, `ref` = the
fix SHA — `git log -S'<evidence fragment>' --format=%h` finds it), or a
prior slug that was ledgered `fixed` and is back (`recurrence-of`, `ref` =
prior slug). A recurrence is a regression, never a fresh finding.

`failure_mode` decides release gating. Only `critical`/`significant`
findings with `failure_mode: user-visible` are **blocking**; everything
else renders in the backlog section. A note-level finding must never be
able to drive a breaking change.

`carried_forward` lists prior deferred/accepted/mitigated findings so
they are tracked but not re-derived. They are excluded from `summary.counts`,
from narratives, and from the AGENTS.md finding index. `reconciliation`
records, for every prior finding ledgered `fixed`, whether the fix still
holds — verified by re-reading the fix commit's diff, not by re-auditing
from scratch.
```

- [ ] **Step 6: Rebuild the contract and run tests**

Run: `just build-schemas && just check-contract && node --test test/build-report.test.mjs`
Expected: `contract ok`; all tests pass including the 4 new ones. (If `ys` rejects the `if/then` keyword, replace the conditional with a `description` note "ref is required for caused-by-fix/recurrence-of" and enforce it in `checkAuditProfile`'s sibling `checkOrigins` in Task 5 instead — note the choice in the commit body.)

- [ ] **Step 7: Commit**

```bash
git add src/schemas skills/cased/references skills/crustoleum/references test/build-report.test.mjs
git commit -m "feat(contract): add origin, failure_mode, carried_forward, reconciliation to findings schema

Audit churn research (record/research/2026-08-18-yamalgam-audit-churn.md)
found the schema had no way to express that a finding was caused by a
prior fix or is a recurrence — the regression grep over 426 findings was
a null result for that reason alone. origin.kind makes churn measurable;
failure_mode separates release blockers from backlog; carried_forward and
reconciliation give re-audits memory."
```

---

### Task 2: `meta.audit_profile` in recon

Answers spec §4.3 (root cause 6 — unrecorded scope/auditor).

**Files:**
- Modify: `src/schemas/recon.schema.json`, `src/schemas/recon.example.yaml`, `src/schemas/recon.md.footer`
- Modify: `src/recon/recon` (skill version + excludes), `src/recon/recon-to-yaml.mjs` (`buildMeta`)
- Test: `test/recon-to-yaml.test.mjs`

**Interfaces:**
- Produces: `recon.meta.audit_profile = {mode: "fresh"|"re-audit", prior_audit: string|null, model: string, effort: string, agent_count: integer, surfaces: string[], severity_floor: "note"|"advisory"|"moderate"|"significant"|"critical", excluded_tools: string[], skill_versions: {cased: string, crustoleum?: string}}`. Pre-runner emits `model: "unknown"`, `effort: "unknown"`, `agent_count: 0`, `surfaces: []`, `severity_floor: "note"`, `excluded_tools: []`; the controller fills them before Phase 3a. `checkAuditProfile` (Task 5) refuses `finalize` while `model === "unknown"` or `agent_count === 0`.

- [ ] **Step 1: Failing test** — append to `test/recon-to-yaml.test.mjs` (it already imports `buildReconObject` and fixture inputs; reuse the same fixture variables the file uses for its existing `buildReconObject` tests):

```js
describe('audit_profile', () => {
  it('emits a stub audit_profile in fresh mode when no prior audits exist', () => {
    const recon = buildReconObject({ manifest: { ...manifest, prior_audits: [] , cased_version: 'abc1234' }, metadata, tokei, gitLog });
    assert.deepEqual(recon.meta.audit_profile, {
      mode: 'fresh', prior_audit: null, model: 'unknown', effort: 'unknown', agent_count: 0,
      surfaces: [], severity_floor: 'note', excluded_tools: [], skill_versions: { cased: 'abc1234' },
    });
  });
  it('emits re-audit mode with the newest prior audit dir', () => {
    const recon = buildReconObject({ manifest: { ...manifest, prior_audits: ['2026-08-01-10-full-repo', '2026-08-03-18-m10'], cased_version: 'abc1234' }, metadata, tokei, gitLog });
    assert.equal(recon.meta.audit_profile.mode, 're-audit');
    assert.equal(recon.meta.audit_profile.prior_audit, '2026-08-03-18-m10');
  });
});
```

- [ ] **Step 2: Run to verify it fails**: `node --test test/recon-to-yaml.test.mjs 2>&1 | grep -E 'audit_profile|not ok'` → FAIL (`audit_profile` undefined).

- [ ] **Step 3: Schema.** In `src/schemas/recon.schema.json` → `properties.meta`: add `"audit_profile"` to `required` and to `properties`:

```json
"audit_profile": {
  "type": "object",
  "required": ["mode", "prior_audit", "model", "effort", "agent_count", "surfaces", "severity_floor", "excluded_tools", "skill_versions"],
  "additionalProperties": false,
  "properties": {
    "mode": { "type": "string", "enum": ["fresh", "re-audit"] },
    "prior_audit": { "type": ["string", "null"], "description": "Basename of the newest prior audit dir under record/audits/, or null" },
    "model": { "type": "string", "description": "Model id that ran the controller, e.g. claude-opus-4-6, gpt-5.6-sol. 'unknown' until the controller fills it." },
    "effort": { "type": "string" },
    "agent_count": { "type": "integer", "minimum": 0 },
    "surfaces": { "type": "array", "items": { "type": "string" }, "description": "Frozen surface names dispatched (crustoleum surfaces + completeness for Rust)" },
    "severity_floor": { "type": "string", "enum": ["note", "advisory", "moderate", "significant", "critical"] },
    "excluded_tools": { "type": "array", "items": { "type": "string" }, "description": "Tools deliberately not run (e.g. cargo-geiger) and why, as 'tool: reason'" },
    "skill_versions": { "type": "object", "required": ["cased"], "properties": { "cased": { "type": "string" }, "crustoleum": { "type": "string" } } }
  }
}
```

- [ ] **Step 4: Example.** In `src/schemas/recon.example.yaml` under `meta:` add:

```yaml
  audit_profile:
    mode: fresh
    prior_audit: null
    model: claude-opus-4-6
    effort: max
    agent_count: 6
    surfaces: [safety, error-robustness, api-type-design, concurrency, performance, supply-chain-deps, completeness]
    severity_floor: note
    excluded_tools: []
    skill_versions:
      cased: bec49e2
      crustoleum: bec49e2
```

- [ ] **Step 5: `buildMeta` in `src/recon/recon-to-yaml.mjs`.** Locate `function buildMeta(manifest, metadata)` and add to its returned object:

```js
    audit_profile: {
      mode: (manifest.prior_audits ?? []).length ? 're-audit' : 'fresh',
      prior_audit: (manifest.prior_audits ?? []).slice().sort().at(-1) ?? null,
      model: 'unknown',
      effort: 'unknown',
      agent_count: 0,
      surfaces: [],
      severity_floor: 'note',
      excluded_tools: [],
      skill_versions: { cased: manifest.cased_version ?? 'unknown' },
    },
```

- [ ] **Step 6: `src/recon/recon`.** (a) Before the manifest heredoc, compute:

```bash
# Prior audits: any sibling dir under the same record/audits/ that already
# has a findings.yaml. Drives audit_profile.mode.
AUDITS_ROOT="$(dirname "$AUDIT_DIR")"
PRIOR_JSON="[]"
if [[ -d "$AUDITS_ROOT" ]]; then
  PRIOR_JSON="$(cd "$AUDITS_ROOT" && ls -1 2>/dev/null \
    | while read -r d; do [[ -f "$d/findings.yaml" && "$d" != "$(basename "$AUDIT_DIR")" ]] && printf '"%s"\n' "$d"; done \
    | paste -sd, - | sed 's/^/[/; s/$/]/')"
  [[ "$PRIOR_JSON" == "[]" || "$PRIOR_JSON" == "[" ]] && PRIOR_JSON="[]"
fi
# Skill version: the cased commit if the skill is a checkout/symlink into
# the repo, else unknown. Never trust a model to self-report this.
CASED_VERSION="$(git -C "$(dirname "$(realpath "$0")")" rev-parse --short HEAD 2>/dev/null || echo unknown)"
```

and add to the manifest JSON: `"prior_audits": $PRIOR_JSON, "cased_version": "$CASED_VERSION",`.

(b) Change the tokei call to exclude audit artifacts (spec §4.10 — recon showed HTML at 23% of the corpus):

```bash
if ! tokei --exclude 'record/audits' --exclude '*.html' --exclude 'target' --output json > "$TMP/tokei.json" 2> "$TMP/tokei.err"; then
```

(c) Change the git log call to add `-- . ':(exclude)record/audits'` after `--name-only`.

- [ ] **Step 7: Run tests + rebuild + smoke**

Run: `just build-schemas && node --test test/recon-to-yaml.test.mjs && just build-smoke && just recon evals/fixtures/error-handling-rs /tmp/recon-smoke && grep -A3 audit_profile /tmp/recon-smoke/recon.yaml`
Expected: tests pass; smoke ok; recon.yaml shows `mode: fresh`, `model: unknown`.

- [ ] **Step 8: Commit**

```bash
git add src/schemas src/recon skills/cased/references skills/cased/scripts test/recon-to-yaml.test.mjs
git commit -m "feat(recon): record audit_profile (mode, prior audit, model, surfaces, exclusions); exclude record/audits from recon

Only 2 of 27 yamalgam audits recorded their model; surface taxonomy was
reinvented per pass and 'clean' from pass N carried no information into
N+1. audit_profile is required in meta; the pre-runner stubs it and the
controller must complete it before finalize."
```

---

# Phase 2 — Mechanical gates in build-report

### Task 3: `prior-audits.mjs` — discover prior audits and parse ledgers

Answers spec §4.1, §5.8 (ledger before next audit).

**Files:**
- Create: `src/viewer/prior-audits.mjs`
- Test: `test/prior-audits.test.mjs`

**Interfaces:**
- Produces:
  - `findPriorAudits(auditsRoot: string, currentSlug: string) → Array<{slug, dir, hasFindings, hasLedger, findingCount, ledger: LedgerSummary|null}>` sorted ascending by slug.
  - `parseLedger(md: string) → {frontMatter: {audit, last_updated, status:{fixed,mitigated,accepted,disputed,deferred,open,...}}, entries: Array<{heading, disposition, addresses: string[], commits: string[], author, fields: Record<string,string>, body}>}`.
  - `latestDispositions(ledger) → Map<slug, {disposition, entryIndex}>` (last entry wins).

- [ ] **Step 1: Failing test** — create `test/prior-audits.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPriorAudits, parseLedger, latestDispositions } from '../src/viewer/prior-audits.mjs';

const LEDGER = `---
audit: 2026-08-01-10-full-repo
last_updated: 2026-08-02
status:
  fixed: 2
  mitigated: 0
  accepted: 0
  disputed: 1
  deferred: 1
  open: 0
---

# Actions Taken: Full repo

---

## 2026-08-02 — Propagate write failures

**Disposition:** fixed
**Addresses:** [silent-write-discard](README.md#silent-write-discard), [swallowed-load-error](README.md#swallowed-load-error)
**Commit:** a1b2c3d4
**Author:** Codex
**Verification:** \`just test\` (workspace) — 14 passed
**Diff:** 2 files, +31 −6, 1 commit

Body text.

## 2026-08-02 — Dispute render finding

**Disposition:** disputed
**Addresses:** [render-unbounded-width](README.md#render-unbounded-width)
**Author:** Codex

Width is bounded by the caller.

## 2026-08-02 — Defer args nit

**Disposition:** deferred
**Addresses:** [args-index-panic](README.md#args-index-panic)
**Author:** Codex

Target: 0.2 milestone.
`;

describe('parseLedger', () => {
  it('parses front matter and entries', () => {
    const l = parseLedger(LEDGER);
    assert.equal(l.frontMatter.audit, '2026-08-01-10-full-repo');
    assert.equal(l.frontMatter.status.disputed, 1);
    assert.equal(l.entries.length, 3);
    assert.equal(l.entries[0].disposition, 'fixed');
    assert.deepEqual(l.entries[0].addresses, ['silent-write-discard', 'swallowed-load-error']);
    assert.deepEqual(l.entries[0].commits, ['a1b2c3d4']);
    assert.equal(l.entries[0].fields.Verification, '`just test` (workspace) — 14 passed');
    assert.equal(l.entries[1].disposition, 'disputed');
  });
  it('latestDispositions: last entry wins per slug', () => {
    const m = latestDispositions(parseLedger(LEDGER + `
## 2026-08-03 — Fix args after all

**Disposition:** fixed
**Addresses:** [args-index-panic](README.md#args-index-panic)
**Commit:** deadbeef
**Author:** Codex
`));
    assert.equal(m.get('args-index-panic').disposition, 'fixed');
    assert.equal(m.get('render-unbounded-width').disposition, 'disputed');
  });
});

describe('findPriorAudits', () => {
  it('lists sibling audit dirs with findings.yaml, excluding the current one', () => {
    const root = mkdtempSync(join(tmpdir(), 'cased-prior-'));
    for (const d of ['2026-08-01-10-a', '2026-08-03-18-b', '2026-08-05-09-current', 'not-an-audit']) mkdirSync(join(root, d));
    writeFileSync(join(root, '2026-08-01-10-a', 'findings.yaml'), 'narratives:\n  - findings:\n      - slug: x\n      - slug: y\n');
    writeFileSync(join(root, '2026-08-01-10-a', 'actions-taken.md'), LEDGER);
    writeFileSync(join(root, '2026-08-03-18-b', 'findings.yaml'), 'narratives: []\n');
    const prior = findPriorAudits(root, '2026-08-05-09-current');
    assert.deepEqual(prior.map(p => p.slug), ['2026-08-01-10-a', '2026-08-03-18-b']);
    assert.equal(prior[0].hasLedger, true);
    assert.equal(prior[0].findingCount, 2);
    assert.equal(prior[1].hasLedger, false);
    assert.equal(prior[1].findingCount, 0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**: `node --test test/prior-audits.test.mjs` → FAIL (module not found).

- [ ] **Step 3: Implement `src/viewer/prior-audits.mjs`:**

```js
// Discover prior audit directories and parse their remediation ledgers.
// Used by re-audit mode (carried_forward / reconciliation inputs) and by
// the finalize gate (a prior audit with findings and no ledger is a
// process failure — findings evaporate; see research doc §2d).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const DISPOSITIONS = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];

export function parseLedger(md) {
  let frontMatter = {};
  let body = md;
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    frontMatter = parseYaml(fm[1]) ?? {};
    body = md.slice(fm[0].length);
  }
  const entries = [];
  // Entries are H2 sections whose body carries a **Disposition:** field.
  const sections = body.split(/^## /m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const heading = sec.slice(0, nl).trim();
    const rest = sec.slice(nl + 1);
    const fields = {};
    for (const m of rest.matchAll(/^\*\*([A-Za-z][A-Za-z -]*?):\*\*\s*(.*)$/gm)) fields[m[1].trim()] = m[2].trim();
    if (!fields.Disposition) continue;
    const disposition = fields.Disposition.toLowerCase().trim();
    const addresses = [...(fields.Addresses ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    const commits = [...(fields.Commit ?? '').matchAll(/\b[0-9a-f]{7,40}\b/g)].map(m => m[0]);
    entries.push({ heading, disposition, addresses, commits, author: fields.Author ?? '', fields, body: rest.trim() });
  }
  return { frontMatter, entries };
}

export function latestDispositions(ledger) {
  const map = new Map();
  ledger.entries.forEach((e, i) => {
    if (!DISPOSITIONS.includes(e.disposition)) return;
    for (const slug of e.addresses) map.set(slug, { disposition: e.disposition, entryIndex: i });
  });
  return map;
}

function countFindings(findingsPath) {
  try {
    const doc = parseYaml(readFileSync(findingsPath, 'utf8')) ?? {};
    return (doc.narratives ?? []).reduce((n, nar) => n + (nar.findings ?? []).length, 0);
  } catch { return 0; }
}

export function findPriorAudits(auditsRoot, currentSlug) {
  if (!existsSync(auditsRoot)) return [];
  return readdirSync(auditsRoot)
    .filter(d => d !== currentSlug && statSync(join(auditsRoot, d)).isDirectory())
    .filter(d => existsSync(join(auditsRoot, d, 'findings.yaml')))
    .sort()
    .map(slug => {
      const dir = join(auditsRoot, slug);
      const ledgerPath = join(dir, 'actions-taken.md');
      const hasLedger = existsSync(ledgerPath);
      return {
        slug, dir, hasFindings: true, hasLedger,
        findingCount: countFindings(join(dir, 'findings.yaml')),
        ledger: hasLedger ? parseLedger(readFileSync(ledgerPath, 'utf8')) : null,
      };
    });
}
```

- [ ] **Step 4: Run tests**: `node --test test/prior-audits.test.mjs` → PASS. Add the file to `justfile` `test:` recipe.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/prior-audits.mjs test/prior-audits.test.mjs justfile
git commit -m "feat(viewer): prior-audit discovery and ledger parser for re-audit mode"
```

---

### Task 4: `gates.mjs` — evidence fidelity, README completeness, audit_profile check, `isBlocking`

Answers spec §4.7 (reviewer split — mechanical evidence check), §4.8 (completeness gates), §4.6 (blockers vs backlog).

**Files:**
- Create: `src/viewer/gates.mjs`
- Test: `test/gates.test.mjs`

**Interfaces:**
- Produces:
  - `checkEvidenceFidelity(findingsDoc, repoRoot) → Array<{slug, path, start_line, end_line, problem: "file-missing"|"line-count"|"text-mismatch", expected?: string, actual?: string}>` — compares each `finding.evidence` (split by `\n`, trailing newline trimmed) to the file lines `start_line..end_line` (1-indexed). Whitespace-insensitive at line ends only (`trimEnd`); indentation must match. Multi-location findings: evidence blocks are separated by a line that is exactly `# ...` ? No — the contract says one evidence block per location; when `locations.length > 1`, evidence is compared to the concatenation of the location ranges in order.
  - `checkReadmeComplete(readmeText) → string[]` problems: any `<!-- AGENT:` marker, or the leading `<!--\n  README.md scaffold` comment still present.
  - `checkAuditProfile(recon) → string[]` problems: missing `meta.audit_profile`; `model === 'unknown'`; `agent_count === 0`; `surfaces.length === 0`; `mode === 're-audit'` and `prior_audit === null`.
  - `isBlocking(finding) → boolean`: `(concern === 'critical' || concern === 'significant') && (finding.failure_mode ?? 'user-visible') === 'user-visible'`.

- [ ] **Step 1: Failing tests** — create `test/gates.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkEvidenceFidelity, checkReadmeComplete, checkAuditProfile, isBlocking } from '../src/viewer/gates.mjs';

function repoWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'cased-gates-'));
  for (const [p, txt] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), txt); }
  return root;
}
const SRC = 'fn a() {\n    let x = 1;\n    let y = 2;\n}\n';

describe('checkEvidenceFidelity', () => {
  it('passes when evidence matches the file lines exactly', () => {
    const root = repoWith({ 'src/a.rs': SRC });
    const doc = { narratives: [{ findings: [{ slug: 'ok', locations: [{ path: 'src/a.rs', start_line: 2, end_line: 3 }], evidence: '    let x = 1;\n    let y = 2;\n' }] }] };
    assert.deepEqual(checkEvidenceFidelity(doc, root), []);
  });
  it('flags retyped indentation and wrong line counts', () => {
    const root = repoWith({ 'src/a.rs': SRC });
    const doc = { narratives: [{ findings: [
      { slug: 'indent', locations: [{ path: 'src/a.rs', start_line: 2, end_line: 3 }], evidence: 'let x = 1;\nlet y = 2;\n' },
      { slug: 'count', locations: [{ path: 'src/a.rs', start_line: 2, end_line: 3 }], evidence: '    let x = 1;\n' },
      { slug: 'missing', locations: [{ path: 'src/nope.rs', start_line: 1, end_line: 1 }], evidence: 'x' },
    ] }] };
    const problems = checkEvidenceFidelity(doc, root);
    assert.deepEqual(problems.map(p => [p.slug, p.problem]), [['indent', 'text-mismatch'], ['count', 'line-count'], ['missing', 'file-missing']]);
  });
  it('concatenates ranges for multi-location findings', () => {
    const root = repoWith({ 'src/a.rs': SRC });
    const doc = { narratives: [{ findings: [{ slug: 'multi', locations: [{ path: 'src/a.rs', start_line: 1, end_line: 1 }, { path: 'src/a.rs', start_line: 4, end_line: 4 }], evidence: 'fn a() {\n}\n' }] }] };
    assert.deepEqual(checkEvidenceFidelity(doc, root), []);
  });
});

describe('checkReadmeComplete', () => {
  it('flags scaffold placeholders', () => {
    assert.equal(checkReadmeComplete('# Audit\n<!-- AGENT: opening assessment -->\n').length, 1);
    assert.equal(checkReadmeComplete('<!--\n  README.md scaffold for the cased audit "x".\n-->\n# Audit\nreal prose\n').length, 1);
    assert.deepEqual(checkReadmeComplete('# Audit\n\nReal prose.\n'), []);
  });
});

describe('checkAuditProfile', () => {
  const good = { meta: { audit_profile: { mode: 'fresh', prior_audit: null, model: 'claude-opus-4-6', effort: 'max', agent_count: 6, surfaces: ['safety'], severity_floor: 'note', excluded_tools: [], skill_versions: { cased: 'abc' } } } };
  it('accepts a completed profile', () => assert.deepEqual(checkAuditProfile(good), []));
  it('rejects the pre-runner stub', () => {
    const stub = structuredClone(good); stub.meta.audit_profile.model = 'unknown'; stub.meta.audit_profile.agent_count = 0; stub.meta.audit_profile.surfaces = [];
    assert.equal(checkAuditProfile(stub).length, 3);
  });
  it('rejects re-audit without prior_audit', () => {
    const bad = structuredClone(good); bad.meta.audit_profile.mode = 're-audit';
    assert.equal(checkAuditProfile(bad).length, 1);
  });
});

describe('isBlocking', () => {
  it('blocks critical/significant user-visible; defaults missing failure_mode to user-visible', () => {
    assert.equal(isBlocking({ concern: 'critical' }), true);
    assert.equal(isBlocking({ concern: 'significant', failure_mode: 'user-visible' }), true);
    assert.equal(isBlocking({ concern: 'significant', failure_mode: 'documentation' }), false);
    assert.equal(isBlocking({ concern: 'moderate', failure_mode: 'user-visible' }), false);
    assert.equal(isBlocking({ concern: 'note' }), false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**: `node --test test/gates.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement `src/viewer/gates.mjs`:**

```js
// Mechanical audit gates. Everything here is deterministic and cheap; the
// point is to take work off the LLM reviewer (which spent ~70% of its
// verdicts on indentation and line ranges) and to refuse to call an audit
// finished while it is structurally incomplete.
import { existsSync, readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

export function isBlocking(finding) {
  const gating = finding.concern === 'critical' || finding.concern === 'significant';
  return gating && (finding.failure_mode ?? 'user-visible') === 'user-visible';
}

export function allFindings(doc) {
  return (doc.narratives ?? []).flatMap(n => n.findings ?? []);
}

function fileLines(repoRoot, p) {
  const abs = isAbsolute(p) ? p : join(repoRoot, p);
  if (!existsSync(abs)) return null;
  const txt = readFileSync(abs, 'utf8');
  return txt.split('\n');
}

export function checkEvidenceFidelity(doc, repoRoot) {
  const problems = [];
  for (const f of allFindings(doc)) {
    const locs = f.locations ?? [];
    if (!locs.length || typeof f.evidence !== 'string') continue;
    const evidence = f.evidence.replace(/\n$/, '').split('\n');
    const expected = [];
    let missing = false;
    for (const loc of locs) {
      const lines = fileLines(repoRoot, loc.path);
      if (!lines) { problems.push({ slug: f.slug, path: loc.path, start_line: loc.start_line, end_line: loc.end_line, problem: 'file-missing' }); missing = true; break; }
      expected.push(...lines.slice(loc.start_line - 1, loc.end_line));
    }
    if (missing) continue;
    const first = locs[0];
    if (expected.length !== evidence.length) {
      problems.push({ slug: f.slug, path: first.path, start_line: first.start_line, end_line: first.end_line, problem: 'line-count', expected: String(expected.length), actual: String(evidence.length) });
      continue;
    }
    for (let i = 0; i < expected.length; i++) {
      if (expected[i].trimEnd() !== evidence[i].trimEnd()) {
        problems.push({ slug: f.slug, path: first.path, start_line: first.start_line, end_line: first.end_line, problem: 'text-mismatch', expected: expected[i], actual: evidence[i] });
        break;
      }
    }
  }
  return problems;
}

export function checkReadmeComplete(text) {
  const problems = [];
  if (/^<!--\s*\n\s*README\.md scaffold/m.test(text)) problems.push('scaffold instruction comment still present at top of README.md');
  const markers = text.match(/<!--\s*AGENT:/g);
  if (markers) problems.push(`${markers.length} <!-- AGENT: --> placeholder(s) still present in README.md`);
  return problems;
}

export function checkAuditProfile(recon) {
  const p = recon?.meta?.audit_profile;
  if (!p) return ['recon.yaml meta.audit_profile is missing (pre-runner ≥ this version emits a stub; controller must complete it)'];
  const problems = [];
  if (!p.model || p.model === 'unknown') problems.push('audit_profile.model is unknown — record the controller model id');
  if (!p.agent_count) problems.push('audit_profile.agent_count is 0 — record how many analysis agents were dispatched');
  if (!p.surfaces || p.surfaces.length === 0) problems.push('audit_profile.surfaces is empty — record the surface names dispatched');
  if (p.mode === 're-audit' && !p.prior_audit) problems.push('audit_profile.mode is re-audit but prior_audit is null');
  return problems;
}
```

- [ ] **Step 4: Run**: `node --test test/gates.test.mjs` → PASS. Add to `justfile` `test:`.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/gates.mjs test/gates.test.mjs justfile
git commit -m "feat(viewer): mechanical gates — evidence fidelity, README completeness, audit_profile, isBlocking"
```

---

### Task 5: `lintLedger` — validate `actions-taken.md` against the remediation contract

Answers spec §5.1–§5.4, §5.9 (verification block, blast radius, diff budget, pushback, coverage-loss statement).

**Files:**
- Modify: `src/viewer/gates.mjs` (add `lintLedger`)
- Test: `test/gates.test.mjs`

**Interfaces:**
- Produces: `lintLedger({ledgerText, findingsDoc, gitLog?: (sha)=>({exists:boolean, trailers:string[]})}) → Array<{entry: string|null, level: "error"|"warn", message}>`.
  Rules:
  1. front matter present with `audit`, `status` (numbers), `open` computed = total − Σ(others) — error on mismatch.
  2. every entry has `Disposition`, `Addresses`, `Author` — error.
  3. every `Addresses` slug exists in `findingsDoc` (or in `carried_forward`) — error.
  4. `fixed`/`mitigated`/`superseded` require `Commit` — error.
  5. `fixed` requires `Verification` and `Diff` fields — error; `Verification` must mention the workspace-scope command (`recon.testing.command` when supplied via `testCommand` option; otherwise any of `--workspace`, `just test`, `just check`) — warn.
  6. `fixed` requires `Blast radius` field — warn (error once eval fixture proves models can produce it — flip in Task 15).
  7. `deferred` body must contain a target (`milestone|target|issue|#\d+|\d{4}-\d{2}`) — error.
  8. `disputed`/`accepted` body ≥ 40 chars — error.
  9. `Diff` parse `(\d+) files?, \+(\d+) [−-](\d+), (\d+) commits?`; if the finding effort is `trivial|small` and files > 10 or insertions > 500, or commits > 3 → warn "diff budget exceeded; consider disposition escalated".
  10. if `gitLog` provided: each commit exists (error) and carries an `Audit-Finding:` trailer for each addressed slug (warn).
  11. if the entry `fields['Coverage lost']` is absent but body mentions `test` and `replace|rewrite|remove` → warn.

- [ ] **Step 1: Failing tests** — append to `test/gates.test.mjs`:

```js
import { lintLedger } from '../src/viewer/gates.mjs';
const FINDINGS = { narratives: [{ findings: [{ slug: 'a', concern: 'significant', effort: 'small' }, { slug: 'b', concern: 'note', effort: 'trivial' }] }], carried_forward: [{ slug: 'cf', prior_audit: 'x', disposition: 'deferred' }] };
const GOOD = `---
audit: 2026-08-18-10-x
last_updated: 2026-08-18
status:
  fixed: 1
  mitigated: 0
  accepted: 0
  disputed: 1
  deferred: 0
  open: 0
---
# Actions Taken

## 2026-08-18 — Fix a

**Disposition:** fixed
**Addresses:** [a](README.md#a)
**Commit:** abc1234
**Author:** Codex
**Verification:** \`just test\` (workspace, 41 passed), \`just check\`
**Blast radius:** crates touched: core (named: core); reverse deps of changed symbol: cli
**Diff:** 2 files, +40 −3, 1 commit

Did the thing.

## 2026-08-18 — Dispute b

**Disposition:** disputed
**Addresses:** [b](README.md#b)
**Author:** Codex

The width is bounded by the caller at cli/src/main.rs:40; the finding misread the guard.
`;
describe('lintLedger', () => {
  it('accepts a compliant ledger', () => {
    assert.deepEqual(lintLedger({ ledgerText: GOOD, findingsDoc: FINDINGS }).filter(p => p.level === 'error'), []);
  });
  it('errors on missing Verification/Diff for fixed, unknown slug, and bad open count', () => {
    const bad = GOOD.replace('**Verification:** `just test` (workspace, 41 passed), `just check`\n', '').replace('**Diff:** 2 files, +40 −3, 1 commit\n', '').replace('[b](README.md#b)', '[zzz](README.md#zzz)').replace('open: 0', 'open: 3');
    const msgs = lintLedger({ ledgerText: bad, findingsDoc: FINDINGS }).filter(p => p.level === 'error').map(p => p.message);
    assert.ok(msgs.some(m => /Verification/.test(m)));
    assert.ok(msgs.some(m => /Diff/.test(m)));
    assert.ok(msgs.some(m => /zzz/.test(m)));
    assert.ok(msgs.some(m => /open/.test(m)));
  });
  it('warns on diff budget blowout for a small finding', () => {
    const blow = GOOD.replace('**Diff:** 2 files, +40 −3, 1 commit', '**Diff:** 8 files, +8084 −594, 17 commits');
    assert.ok(lintLedger({ ledgerText: blow, findingsDoc: FINDINGS }).some(p => p.level === 'warn' && /budget/.test(p.message)));
  });
  it('errors when deferred has no target', () => {
    const d = GOOD + `\n## 2026-08-18 — Defer cf\n\n**Disposition:** deferred\n**Addresses:** [cf](README.md#cf)\n**Author:** Codex\n\nLater.\n`;
    assert.ok(lintLedger({ ledgerText: d, findingsDoc: FINDINGS }).some(p => p.level === 'error' && /target/.test(p.message)));
  });
  it('uses gitLog to check trailers when provided', () => {
    const gitLog = sha => ({ exists: sha === 'abc1234', trailers: [] });
    const out = lintLedger({ ledgerText: GOOD, findingsDoc: FINDINGS, gitLog });
    assert.ok(out.some(p => p.level === 'warn' && /Audit-Finding/.test(p.message)));
  });
});
```

- [ ] **Step 2: Run**: `node --test test/gates.test.mjs` → FAIL (`lintLedger` not exported).

- [ ] **Step 3: Implement** — append to `src/viewer/gates.mjs`:

```js
import { parseLedger } from './prior-audits.mjs';

const REQUIRE_COMMIT = new Set(['fixed', 'mitigated', 'superseded']);
const KNOWN = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];

export function lintLedger({ ledgerText, findingsDoc, gitLog = null, testCommand = null }) {
  const out = [];
  const err = (entry, message) => out.push({ entry, level: 'error', message });
  const warn = (entry, message) => out.push({ entry, level: 'warn', message });
  const ledger = parseLedger(ledgerText);
  const fm = ledger.frontMatter;
  const findings = allFindings(findingsDoc);
  const known = new Map(findings.map(f => [f.slug, f]));
  for (const cf of findingsDoc.carried_forward ?? []) known.set(cf.slug, { slug: cf.slug, concern: 'note', effort: 'small', carried: true });

  if (!fm.audit || !fm.status) err(null, 'front matter must declare audit and status counts');
  else {
    const s = fm.status;
    const total = findings.length;
    const others = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'].reduce((n, k) => n + (Number(s[k]) || 0), 0);
    if (Number(s.open) !== total - others) err(null, `front matter open=${s.open} but findings(${total}) − dispositioned(${others}) = ${total - others}`);
  }
  if (!ledger.entries.length) warn(null, 'ledger has no entries');

  for (const e of ledger.entries) {
    const f = e.fields;
    if (!KNOWN.includes(e.disposition)) err(e.heading, `unknown disposition '${e.disposition}'`);
    if (!f.Addresses) err(e.heading, 'missing **Addresses:**');
    if (!f.Author) err(e.heading, 'missing **Author:**');
    for (const slug of e.addresses) if (!known.has(slug)) err(e.heading, `Addresses unknown slug '${slug}' (not in findings.yaml or carried_forward)`);
    if (REQUIRE_COMMIT.has(e.disposition) && !e.commits.length) err(e.heading, `disposition ${e.disposition} requires **Commit:** with a SHA`);
    if (e.disposition === 'fixed') {
      if (!f.Verification) err(e.heading, 'fixed requires **Verification:** (workspace-scope commands and results)');
      else {
        const wantWorkspace = testCommand ? f.Verification.includes(testCommand) : /--workspace|just test|just check|workspace/.test(f.Verification);
        if (!wantWorkspace) warn(e.heading, `Verification does not cite the workspace-scope gate${testCommand ? ` (${testCommand})` : ''}`);
      }
      if (!f.Diff) err(e.heading, 'fixed requires **Diff:** "N files, +I −D, C commits"');
      else {
        const m = f.Diff.match(/(\d+)\s+files?,\s*\+(\d+)\s+[−-](\d+),\s*(\d+)\s+commits?/);
        if (!m) err(e.heading, `Diff not parseable: '${f.Diff}'`);
        else {
          const [files, ins, , commits] = m.slice(1).map(Number);
          const smallest = e.addresses.map(s => known.get(s)?.effort).filter(Boolean).sort((a, b) => ['trivial', 'small', 'medium', 'large'].indexOf(a) - ['trivial', 'small', 'medium', 'large'].indexOf(b))[0];
          if ((['trivial', 'small'].includes(smallest) && (files > 10 || ins > 500)) || commits > 3) warn(e.heading, `diff budget exceeded for effort=${smallest ?? '?'} (${files} files, +${ins}, ${commits} commits); consider disposition escalated and human sign-off`);
        }
      }
      if (!f['Blast radius']) warn(e.heading, 'fixed should state **Blast radius:** (crates touched vs named; reverse deps; co-varying docs/tests)');
      if (!f['Coverage lost'] && /\btests?\b/i.test(e.body) && /\b(replace|rewrit|remov|delet)/i.test(e.body)) warn(e.heading, 'entry mentions changing tests; state **Coverage lost:** (or "none")');
    }
    if (e.disposition === 'deferred' && !/(milestone|target|issue|#\d+|\d{4}-\d{2})/i.test(e.body)) err(e.heading, 'deferred requires a target (milestone, issue, or date) in the body');
    if ((e.disposition === 'disputed' || e.disposition === 'accepted') && e.body.replace(/\*\*[^*]+:\*\*.*\n/g, '').trim().length < 40) err(e.heading, `${e.disposition} requires a substantive rationale`);
    if (gitLog) {
      for (const sha of e.commits) {
        const info = gitLog(sha);
        if (!info.exists) { err(e.heading, `commit ${sha} not found in target repo (squash-merge? record the merge SHA)`); continue; }
        for (const slug of e.addresses) if (!info.trailers.includes(slug)) warn(e.heading, `commit ${sha} lacks 'Audit-Finding: ${slug}' trailer`);
      }
    }
  }
  return out;
}
```

(Move the `import { parseLedger }` to the top of the file with the other imports.)

- [ ] **Step 4: Run**: `node --test test/gates.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/gates.mjs test/gates.test.mjs
git commit -m "feat(viewer): lintLedger enforces the remediation contract (verification, diff budget, targets, trailers)"
```

---

### Task 6: Wire `evidence`, `ledger`, `finalize` subcommands; blockers/backlog rendering; carried-forward and reconciliation in scaffold + AGENTS.md

Answers spec §4.6, §4.8, §5.8, §6.

**Files:**
- Modify: `src/viewer/build-report.mjs` (CLI dispatch ~L752–877; `renderLedger` ~L452; `renderAgentsMd` ~L605; `renderReadmeMd` ~L632; `renderHeader` ~L338)
- Modify: `src/viewer/readme-template.md`, `src/viewer/agents-md-template.md` (placeholders only here; prose rewrite is Task 10)
- Test: `test/build-report.test.mjs`

**Interfaces:**
- Produces: `finalizeAudit(auditDir, {repoRoot, allowUnledgeredPrior=false}) → {ok:boolean, errors:string[], warnings:string[]}` exported from `build-report.mjs`. CLI: `build-report.js evidence <dir>` (exit 1 on any problem), `build-report.js ledger <dir>` (exit 1 on errors), `build-report.js finalize <dir> [--allow-unledgered-prior]` (exit 1 on errors). `renderAgentsMd(findings, templateStr, auditSlug, {recon = null, priorAudits = []} = {})`. `renderReadmeMd(findings, templateStr, {priorAudits = []} = {})`. New template placeholders: `{{blocking_count}}`, `{{backlog_count}}`, `{{carried_forward_list}}`, `{{reconciliation_table}}`, `{{prior_audits}}`, `{{test_command}}`, `{{release_phase}}`, `{{mode}}`.

- [ ] **Step 1: Failing tests** — append to `test/build-report.test.mjs`:

```js
import { finalizeAudit, renderCarriedForward, renderReconciliation } from '../src/viewer/build-report.mjs';
import { mkdirSync } from 'node:fs';

describe('re-audit rendering', () => {
  const doc = YAML.parse(findingsYaml);
  it('renderCarriedForward lists prior slugs with disposition and audit', () => {
    const md = renderCarriedForward(doc);
    assert.match(md, /hooks-timeout-not-configurable/);
    assert.match(md, /deferred/);
    assert.match(md, /2026-03-30-14-full-workspace/);
  });
  it('renderReconciliation emits a table with status per prior slug', () => {
    const md = renderReconciliation(doc);
    assert.match(md, /\| prior finding \| audit \| status \|/);
    assert.match(md, /regressed/);
  });
  it('renderLedger splits blocking from backlog', () => {
    const slugToTitle = new Map();
    for (const n of doc.narratives) for (const f of n.findings) slugToTitle.set(f.slug, f.title);
    const html = renderLedger(doc, slugToTitle);
    assert.match(html, /Blocking/);
    assert.match(html, /Backlog/);
  });
  it('AGENTS.md excludes carried_forward from the finding index and shows counts', () => {
    const tpl = readFileSync('src/viewer/agents-md-template.md', 'utf8');
    const md = renderAgentsMd(doc, tpl, '2026-08-18-10-x', { recon: YAML.parse(reconYaml) });
    assert.doesNotMatch(md, /- \[?hooks-timeout-not-configurable/);
    assert.match(md, /Blocking findings:\s*\d+/);
    assert.match(md, /just test|cargo/); // test command interpolated from recon.testing.command
  });
});

describe('finalizeAudit', () => {
  it('fails on scaffold README, stub audit_profile, and unledgered prior audit; passes when complete', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cased-fin-'));
    const audits = join(repo, 'record', 'audits');
    const prior = join(audits, '2026-08-01-10-prior'); mkdirSync(prior, { recursive: true });
    writeFileSync(join(prior, 'findings.yaml'), 'narratives:\n  - findings:\n      - slug: old\n');
    const cur = join(audits, '2026-08-18-10-cur'); mkdirSync(cur);
    const doc = YAML.parse(findingsYaml);
    // make evidence trivially verifiable: one finding, file we control
    doc.narratives = [{ slug: 'n', title: 'N', thesis: 't', verdict: 'v', findings: [{ slug: 'f1', title: 'F1', concern: 'moderate', locations: [{ path: 'src/x.rs', start_line: 1, end_line: 1 }], evidence: 'fn x() {}\n', mechanism: 'm', remediation: 'r' }] }];
    doc.summary = { counts: { critical: 0, significant: 0, moderate: 1, advisory: 0, note: 0 } };
    mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src', 'x.rs'), 'fn x() {}\n');
    writeFileSync(join(cur, 'findings.yaml'), YAML.stringify(doc));
    const recon = YAML.parse(reconYaml); recon.structure.root = repo; recon.meta.audit_profile.model = 'unknown';
    writeFileSync(join(cur, 'recon.yaml'), YAML.stringify(recon));
    writeFileSync(join(cur, 'README.md'), '# Audit\n<!-- AGENT: fill -->\n');
    let r = finalizeAudit(cur, { repoRoot: repo });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /AGENT:/.test(e)));
    assert.ok(r.errors.some(e => /model/.test(e)));
    assert.ok(r.errors.some(e => /2026-08-01-10-prior/.test(e) && /actions-taken/.test(e)));
    // fix everything
    recon.meta.audit_profile.model = 'claude-opus-4-6';
    writeFileSync(join(cur, 'recon.yaml'), YAML.stringify(recon));
    writeFileSync(join(cur, 'README.md'), '# Audit\n\nProse.\n');
    writeFileSync(join(prior, 'actions-taken.md'), '---\naudit: 2026-08-01-10-prior\nlast_updated: 2026-08-02\nstatus:\n  fixed: 0\n  mitigated: 0\n  accepted: 0\n  disputed: 0\n  deferred: 1\n  open: 0\n---\n## 2026-08-02 — defer\n\n**Disposition:** deferred\n**Addresses:** [old](README.md#old)\n**Author:** me\n\nTarget: 0.2 milestone.\n');
    r = finalizeAudit(cur, { repoRoot: repo });
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });
});
```

- [ ] **Step 2: Run**: `node --test test/build-report.test.mjs` → FAIL (exports missing).

- [ ] **Step 3: Implement in `src/viewer/build-report.mjs`.**

(a) Imports at top:

```js
import { findPriorAudits } from './prior-audits.mjs';
import { checkEvidenceFidelity, checkReadmeComplete, checkAuditProfile, isBlocking, lintLedger, allFindings } from './gates.mjs';
import { execFileSync } from 'node:child_process';
```

(b) New render helpers (place after `renderAgentsFindingList`):

```js
export function renderCarriedForward(findings) {
  const cf = findings.carried_forward ?? [];
  if (!cf.length) return '_None._';
  return cf.map(c => `- \`${c.slug}\` — ${c.disposition} in \`${c.prior_audit}\`${c.reason ? ` — ${c.reason}` : ''}`).join('\n');
}

export function renderReconciliation(findings) {
  const rows = findings.reconciliation ?? [];
  if (!rows.length) return '_No prior fixed findings to reconcile._';
  const lines = ['| prior finding | audit | status | verified against |', '|---|---|---|---|'];
  for (const r of rows) lines.push(`| \`${r.prior_slug}\` | \`${r.prior_audit}\` | ${r.status}${r.superseded_by ? ` → \`${r.superseded_by}\`` : ''} | ${r.verified_against ? `\`${r.verified_against}\`` : '—'} |`);
  return lines.join('\n');
}

export function blockingCounts(findings) {
  const all = allFindings(findings);
  const blocking = all.filter(isBlocking).length;
  return { blocking, backlog: all.length - blocking };
}
```

(c) `renderLedger(findings, slugToTitle)`: wrap the existing per-narrative table generation so it is emitted twice — first with only `isBlocking(f)` findings under an `<h3>Blocking</h3>` heading (`<p>critical/significant with a user-visible failure mode — release-gating</p>`), then the rest under `<h3>Backlog</h3>` (`<p>everything else — triage to the next milestone by default</p>`). Skip an empty section with `<p><em>none</em></p>`.

(d) `renderHeader(findings)`: in the counts glossary add a line `Blocking: {blocking} · Backlog: {backlog}` using `blockingCounts`.

(e) `renderAgentsMd(findings, templateStr, auditSlug, { recon = null, priorAudits = [] } = {})`: keep existing replacements; add:

```js
  const { blocking, backlog } = blockingCounts(findings);
  const testCommand = recon?.testing?.command || '<recon.yaml#testing.command not detected — use the project task runner>';
  const mode = recon?.meta?.audit_profile?.mode ?? 'fresh';
  const priorList = priorAudits.length ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n') : '_none_';
  // ... .replaceAll('{{blocking_count}}', String(blocking))
  //     .replaceAll('{{backlog_count}}', String(backlog))
  //     .replaceAll('{{test_command}}', testCommand)
  //     .replaceAll('{{mode}}', mode)
  //     .replaceAll('{{prior_audits}}', priorList)
  //     .replaceAll('{{carried_forward_list}}', renderCarriedForward(findings))
  //     .replaceAll('{{release_phase}}', recon?.meta?.release_phase ?? 'unspecified — ask the maintainer; pre-publish means change types in place')
```

`{{finding_list}}` continues to come from `renderAgentsFindingList(findings)`, which reads only `narratives[].findings` — carried_forward is therefore excluded by construction. Update `{{finding_count}}` to remain the narratives count.

(f) `renderReadmeMd(findings, templateStr, { priorAudits = [] } = {})`: add `.replaceAll('{{reconciliation_table}}', renderReconciliation(findings)).replaceAll('{{carried_forward_list}}', renderCarriedForward(findings)).replaceAll('{{blocking_count}}', ...).replaceAll('{{backlog_count}}', ...)`.

(g) `finalizeAudit`:

```js
export function finalizeAudit(auditDir, { repoRoot = null, allowUnledgeredPrior = false } = {}) {
  const errors = [], warnings = [];
  const findingsPath = join(auditDir, 'findings.yaml'), reconPath = join(auditDir, 'recon.yaml'), readmePath = join(auditDir, 'README.md');
  for (const p of [findingsPath, reconPath, readmePath, join(auditDir, 'report.html'), join(auditDir, 'AGENTS.md')]) if (!existsSync(p)) errors.push(`missing ${basename(p)}`);
  if (errors.length) return { ok: false, errors, warnings };
  const findings = parseFindings(readFileSync(findingsPath, 'utf8'));
  const recon = parseRecon(readFileSync(reconPath, 'utf8'));
  const root = repoRoot ?? recon?.structure?.root ?? join(auditDir, '..', '..', '..');
  errors.push(...checkReadmeComplete(readFileSync(readmePath, 'utf8')));
  errors.push(...checkAuditProfile(recon));
  for (const p of checkEvidenceFidelity(findings, root)) errors.push(`evidence ${p.problem} for ${p.slug} @ ${p.path}:${p.start_line}-${p.end_line}${p.expected !== undefined ? ` (file: ${JSON.stringify(p.expected)} vs evidence: ${JSON.stringify(p.actual)})` : ''}`);
  // origin refs required for causal kinds (belt-and-braces if the schema's if/then was dropped)
  for (const f of allFindings(findings)) if (f.origin && ['caused-by-fix', 'recurrence-of'].includes(f.origin.kind) && !f.origin.ref) errors.push(`${f.slug}: origin.kind ${f.origin.kind} requires origin.ref`);
  const prior = findPriorAudits(join(auditDir, '..'), basename(auditDir));
  for (const p of prior) if (p.findingCount > 0 && !p.hasLedger) (allowUnledgeredPrior ? warnings : errors).push(`prior audit ${p.slug} has ${p.findingCount} findings and no actions-taken.md — its findings are untracked (pass --allow-unledgered-prior to override)`);
  if (recon?.meta?.audit_profile?.mode === 're-audit') {
    if (!findings.reconciliation) warnings.push('re-audit mode but findings.yaml has no reconciliation block');
    const regressed = (findings.reconciliation ?? []).filter(r => r.status === 'regressed').map(r => r.prior_slug);
    const recurrences = new Set(allFindings(findings).filter(f => f.origin?.kind === 'recurrence-of').map(f => f.origin.ref));
    for (const s of regressed) if (!recurrences.has(s)) errors.push(`reconciliation marks ${s} regressed but no finding carries origin {kind: recurrence-of, ref: ${s}}`);
  }
  const ledgerPath = join(auditDir, 'actions-taken.md');
  if (existsSync(ledgerPath)) for (const p of lintLedger({ ledgerText: readFileSync(ledgerPath, 'utf8'), findingsDoc: findings, testCommand: recon?.testing?.command || null })) (p.level === 'error' ? errors : warnings).push(`ledger${p.entry ? ` [${p.entry}]` : ''}: ${p.message}`);
  return { ok: errors.length === 0, errors, warnings };
}
```

(h) CLI dispatch: extend the subcommand parser to accept `evidence`, `ledger`, `finalize` (and `--allow-unledgered-prior`). Implement:

```js
    if (subcommand === 'evidence') {
      const findings = parseFindings(readFileSync(join(auditDir, 'findings.yaml'), 'utf8'));
      const recon = existsSync(join(auditDir, 'recon.yaml')) ? parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8')) : null;
      const problems = checkEvidenceFidelity(findings, recon?.structure?.root ?? join(auditDir, '..', '..', '..'));
      for (const p of problems) console.error(`${p.slug} @ ${p.path}:${p.start_line}-${p.end_line}: ${p.problem}${p.expected !== undefined ? `\n    file:     ${JSON.stringify(p.expected)}\n    evidence: ${JSON.stringify(p.actual)}` : ''}`);
      console.log(problems.length ? `${problems.length} evidence problem(s)` : 'evidence ok');
      process.exit(problems.length ? 1 : 0);
    }
    if (subcommand === 'ledger') {
      const findings = parseFindings(readFileSync(join(auditDir, 'findings.yaml'), 'utf8'));
      const recon = existsSync(join(auditDir, 'recon.yaml')) ? parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8')) : null;
      const root = recon?.structure?.root ?? join(auditDir, '..', '..', '..');
      const gitLog = sha => { try { const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%(trailers:key=Audit-Finding,valueonly)', sha], { encoding: 'utf8' }); return { exists: true, trailers: out.split('\n').map(s => s.trim()).filter(Boolean) }; } catch { return { exists: false, trailers: [] }; } };
      const out = lintLedger({ ledgerText: readFileSync(join(auditDir, 'actions-taken.md'), 'utf8'), findingsDoc: findings, gitLog, testCommand: recon?.testing?.command || null });
      for (const p of out) console[p.level === 'error' ? 'error' : 'warn'](`${p.level}${p.entry ? ` [${p.entry}]` : ''}: ${p.message}`);
      const errs = out.filter(p => p.level === 'error').length;
      console.log(errs ? `${errs} ledger error(s)` : 'ledger ok');
      process.exit(errs ? 1 : 0);
    }
    if (subcommand === 'finalize') {
      const r = finalizeAudit(auditDir, { allowUnledgeredPrior: rawArgs.includes('--allow-unledgered-prior') });
      for (const w of r.warnings) console.warn(`warn: ${w}`);
      for (const e of r.errors) console.error(`error: ${e}`);
      console.log(r.ok ? `finalize ok: ${auditDir}` : `${r.errors.length} finalize error(s)`);
      process.exit(r.ok ? 0 : 1);
    }
```

In the `build` path, compute `priorAudits = findPriorAudits(join(auditDir,'..'), basename(auditDir))` and `recon = parseRecon(...)`, and pass `{ recon, priorAudits }` to `renderAgentsMd` and `renderReadmeMd`. Update the usage text to list all five subcommands.

(i) Templates: in `src/viewer/readme-template.md` add, after the "Findings in this audit" section:

```markdown
Blocking (release-gating): {{blocking_count}} · Backlog: {{backlog_count}}

## Reconciliation with prior audits

{{reconciliation_table}}

## Carried forward (not re-derived)

{{carried_forward_list}}
```

In `src/viewer/agents-md-template.md` add after `**Findings:**`: `**Blocking findings:** {{blocking_count}} · **Backlog:** {{backlog_count}}`, `**Mode:** {{mode}}`, `**Workspace test command:** \`{{test_command}}\``, `**Release phase:** {{release_phase}}`, and sections `## Prior audits\n\n{{prior_audits}}` and `## Carried forward\n\n{{carried_forward_list}}` before the finding index. (Full prose rewrite happens in Task 10; keep placeholders stable.)

- [ ] **Step 4: Run tests, rebuild bundle, smoke through the skill path**

```bash
node --test test/build-report.test.mjs && scripts/build-viewer.sh && just build-smoke && \
smoke=$(mktemp -d)/s && mkdir -p $smoke && cp src/schemas/recon.example.yaml $smoke/recon.yaml && cp src/schemas/findings.example.yaml $smoke/findings.yaml && \
node skills/cased/scripts/build-report.js $smoke && node skills/cased/scripts/build-report.js finalize $smoke; echo "exit=$?"
```
Expected: tests pass; `finalize` on the smoke dir exits 1 with errors for scaffold README and evidence file-missing (root path is scrat's) — that is the correct behaviour; `just check-bundle` passes.

- [ ] **Step 5: Commit**

```bash
git add src/viewer skills/cased/scripts skills/cased/templates test/build-report.test.mjs
git commit -m "feat(viewer): evidence/ledger/finalize subcommands; blocking vs backlog; carried-forward and reconciliation rendering"
```

---

# Phase 3 — Skill instructions (cased + crustoleum)

### Task 7: Subagent output contract — `origin`, `failure_mode`, class sweep, scratch files

Answers spec §4.2, §4.4, §4.11.

**Files:**
- Modify: `skills/cased/references/subagent-output-contract.md`
- Modify: `skills/cased/agents/{security,error-handling,code-quality,completeness,dependencies,api-design,performance}.md` (one paragraph each)
- Modify: `skills/crustoleum/agents/*.md`, `skills/crustoleum/SKILL.md` (same paragraph; crustoleum consumes the findings contract)

No unit test — verified by eval fixture in Task 13/14. Manual check: `grep -l 'class sweep' skills/*/agents/*.md | wc -l` = 14.

- [ ] **Step 1: In `subagent-output-contract.md`, extend the finding shape** (after `effort_notes`):

```yaml
    origin:                              # REQUIRED in re-audit mode, recommended always
      kind: pre-existing | new-in-diff | caused-by-fix | recurrence-of
      ref: "<fix SHA for caused-by-fix; prior slug for recurrence-of>"
    failure_mode: user-visible | internal | policy | documentation
```

and add these sections before "## Validation":

```markdown
## Origin and failure mode

`failure_mode` answers "what does a user see if this ships?" — pick
`user-visible` only for wrong output, wrong exit code, panic, hang, or
data loss reachable from input. Perf, ownership, and design costs with no
symptom yet are `internal`; supply-chain/licensing/process are `policy`;
prose and metadata are `documentation`. Only critical/significant +
user-visible findings gate a release; be honest, not dramatic.

`origin.kind`: the audit-context tells you whether prior audits exist and
lists their ledgered fixes (slug → SHA). Before filing, run
`git log -S'<a distinctive line from your evidence>' --format='%h %s' -- <path>`
in the target repo. If the introducing commit is one of the ledgered fix
SHAs → `caused-by-fix` with that SHA. If your finding matches a prior slug
that was ledgered `fixed` → `recurrence-of` with that slug (this is a
regression, say so in `mechanism`). If the introducing commit is newer than
the prior audit → `new-in-diff`. Otherwise `pre-existing`. In a first
audit everything is `pre-existing`.

## Class sweep — one mechanism, one finding

When a finding is *mechanism-shaped* — a pattern that can recur anywhere
(allocation before a limit check, `.position()`/linear scan inside a loop,
`String` error payloads, recursion without a depth guard, rehashing a
precomputed fingerprint, `unwrap()` on external input, a feature-gated
symbol referenced without the gate) — you MUST grep the whole workspace for
sibling instances before filing, and file **one finding with N `locations`
and one evidence block per location**, not one finding per file. Say in
`mechanism` how many sites you found and how you searched. Point findings
that leave siblings behind are the single largest source of re-audit churn:
the same class was drip-fed one file per audit across 3–7 audits.

## Scratch files

Your final message is your output, but a long evidence-heavy pass must not
be lost to one dropped message. You MAY write your in-progress result as
YAML to `/private/tmp/cased/<audit-id>/<surface>.yaml` (write to a `.tmp`
name, then rename atomically). Record `target`, `commit`, `surface`,
`model`, `status`, and your findings there. Never write under the target
repo or the audit directory. The controller treats these files as process
evidence — it re-verifies before importing anything into `findings.yaml`.
```

- [ ] **Step 2: In every analysis agent prompt** (`skills/cased/agents/*.md` except `reviewer.md`, and all `skills/crustoleum/agents/*.md`), add one paragraph under the output/return section:

```markdown
**Class sweep and origin.** Before returning, for each mechanism-shaped
finding grep the workspace for sibling instances and merge them into one
finding with multiple `locations` (see subagent-output-contract.md "Class
sweep"). Set `failure_mode` and, when the audit-context lists prior
ledgered fixes, set `origin.kind`/`origin.ref` per the contract.
```

- [ ] **Step 2b: Test-suite exemptions are a surface** (spec §4.9). In `skills/cased/agents/completeness.md` and `skills/crustoleum/agents/completeness.md` add:

```markdown
**Audit the test suite's escape hatches.** Grep tests for `#[ignore]`,
`#[should_panic]` on non-panic contracts, allowlists / skip lists /
"known failures" tables, and comments like "understood and acceptable" or
"expected to fail". A self-documented acceptable failure against a
documented contract of the crate (round-trip fidelity, spec compliance,
exit-code mapping) is at least `significant` with
`failure_mode: user-visible` — it hides a defect in the crate's defining
capability. One such allowlist survived a full-workspace audit for five
months.
```

- [ ] **Step 3: In `skills/crustoleum/SKILL.md`** add a short "Findings contract additions" note under its output section pointing at the stamped `references/findings-schema.yaml.md` fields `origin`, `failure_mode`.

- [ ] **Step 4: Verify** — `grep -c 'Class sweep' skills/cased/agents/*.md skills/crustoleum/agents/*.md` shows 1 for every non-reviewer agent (13 files); `just check-contract` still ok.

- [ ] **Step 5: Commit**

```bash
git add skills/cased/references/subagent-output-contract.md skills/cased/agents skills/crustoleum
git commit -m "docs(skill): subagent contract — origin, failure_mode, class sweep, scratch-file policy"
```

---

### Task 8: Reviewer becomes adversarial; mechanical checks move to `evidence`

Answers spec §4.7 (0/92 rejected; ~70% of verdicts were indentation).

**Files:**
- Modify: `skills/cased/agents/reviewer.md`
- Modify: `skills/cased/references/subagent-output-contract.md` (reviewer findings shape)

- [ ] **Step 1: Reviewer contract shape** — in `subagent-output-contract.md` replace the reviewer entry shape with:

```yaml
  - slug: "<slug of the original finding being reviewed>"
    verdict: confirmed | adjusted | disputed
    mechanism_verified: yes | no | not-attempted   # did you trace the whole execution path?
    concern_override: critical | significant | moderate | advisory | note   # only when adjusted for severity
    notes: "<required when adjusted or disputed>"
```

- [ ] **Step 2: Rewrite the Process section of `reviewer.md`:**

```markdown
## What you are NOT doing

Evidence fidelity (indentation, line ranges, verbatim text) is checked
mechanically by `build-report.js evidence <audit-dir>` before you are
dispatched. Do not spend verdicts on it. If you notice a fidelity problem
anyway, mention it in `notes` in one clause and move on.

## Process — try to break each finding

For each finding, your job is to **falsify** it. Default to `disputed` if
you cannot confirm the mechanism end-to-end.

1. **Trace the execution path.** Start at the nearest entry point (CLI
   arg, request handler, public fn) and read to the cited lines. Is there
   an earlier guard, a type-level bound, an unreachable branch, a
   feature gate? Set `mechanism_verified: yes` only if you read the whole
   path. `not-attempted` is an honest answer; `yes` without the trace is
   a lie the remediator pays for.
2. **Attack the remediation.** Would it compile? Does it change a public
   signature (say so)? Does it move the bug instead of fixing it (a
   limit enforced one layer up; a `Drop` that now joins threads)? Does it
   need a change in another crate the finding didn't name?
3. **Check the class.** If the mechanism can recur, did the finder sweep
   siblings? A finding with one location for a workspace-wide pattern
   is `adjusted` with a list of the sites it missed.
4. **Check origin.** If `origin.kind` is `caused-by-fix` or
   `recurrence-of`, confirm the ref. If it is `pre-existing` but
   `git log -S` shows a ledgered fix introduced it, `adjusted` with the
   corrected origin.
5. **Severity is binding.** If you downgrade to `advisory`/`note`, set
   `concern_override`; the controller applies it and the finding renders
   in the backlog, not the remediation queue.

A review with zero disputed and zero mechanism-level adjustments across
more than ten findings is statistically suspicious; re-read your three
weakest confirmations before returning.
```

- [ ] **Step 3: SKILL.md Phase 3b** (Task 9 edits SKILL.md — note here so it lands there): "Run `build-report.js evidence <dir>` and fix every problem **before** dispatching the reviewer; apply `concern_override` verbatim; disputed findings are removed from `findings.yaml`, not annotated."

- [ ] **Step 4: Commit**

```bash
git add skills/cased/agents/reviewer.md skills/cased/references/subagent-output-contract.md
git commit -m "docs(skill): reviewer is adversarial (mechanism_verified, binding severity); fidelity moves to build-report evidence"
```

---

### Task 9: `SKILL.md` — re-audit mode, audit_profile, finalize gate, termination rule, recon exclusions

Answers spec §4.1, §4.3, §4.8, §4.10, §6.

**Files:**
- Modify: `skills/cased/SKILL.md` (Phase 1 ~L118, Phase 2 ~L173, Phase 3 ~L374, Phase 4 ~L408, Phase 5 ~L484, hygiene ~L99)

- [ ] **Step 1: Phase 1 additions** (after the pre-runner paragraph):

```markdown
**Prior audits and re-audit mode.** The pre-runner sets
`meta.audit_profile.mode` to `re-audit` when `record/audits/` already
holds an audit with `findings.yaml`. In re-audit mode you MUST, before
dispatching any analysis agent:

1. Read every prior `actions-taken.md`. Build two lists: **standing
   dispositions** (latest disposition per slug is deferred/accepted/
   mitigated) and **ledgered fixes** (slug → commit SHA).
2. Write standing dispositions into `findings.yaml#carried_forward`. They
   are excluded from counts, narratives, and the AGENTS.md index. Do not
   re-derive them; if an agent re-files one, drop the duplicate and keep
   the carried_forward entry.
3. Put the ledgered-fix list (slug → SHA) into the `<audit-context>` block
   so every agent can set `origin`.
4. After analysis, write `findings.yaml#reconciliation` with one row per
   ledgered fix: re-read the fix commit's diff (`git show <sha>`) and
   decide `still-fixed` / `regressed` / `superseded` / `not-verified`. A
   `regressed` row requires a finding with `origin.kind: recurrence-of`.

If any prior audit has findings and no `actions-taken.md`, stop and tell
the user: those findings are untracked and `finalize` will refuse
(override: `--allow-unledgered-prior`).

**Complete `audit_profile`.** The pre-runner stubs
`meta.audit_profile` with `model: unknown`, `agent_count: 0`,
`surfaces: []`. Fill `model` (your model id), `effort`, `agent_count`,
`surfaces` (the frozen list you dispatch — for Rust: crustoleum's
surfaces plus completeness; never invent ad-hoc surface names),
`severity_floor` (default `note`), and `excluded_tools` (every tool you
did not run, as `tool: reason`). `finalize` refuses a stub.

**Recon excludes audit artifacts.** `record/audits/**` and `*.html` are
never part of the analyzed corpus. If you hand-gather recon for a
non-Rust project, apply the same exclusions.
```

- [ ] **Step 2: Phase 3 additions** — before 3b:

```markdown
**3a′. Evidence fidelity (mechanical).**

    node "${CLAUDE_SKILL_DIR}/scripts/build-report.js" evidence <audit-directory>

Fix every reported problem by re-extracting the evidence from the file at
the cited range — never by retyping. Do not dispatch the reviewer until
this exits 0.
```

and amend 3b: "The reviewer returns `mechanism_verified` and may set `concern_override`. Apply overrides verbatim. **Remove** disputed findings from `findings.yaml`. Record the reviewer's confirmed/adjusted/disputed counts in the README assessment."

- [ ] **Step 3: Phase 4 additions** — after the README-authoring paragraph:

```markdown
**Finalize.** After authoring README.md, run

    node "${CLAUDE_SKILL_DIR}/scripts/build-report.js" finalize <audit-directory>

It refuses while README placeholders remain, `audit_profile` is a stub,
evidence drifts from source, a re-audit lacks reconciliation, or a prior
audit is unledgered. An audit is not complete until `finalize` exits 0.
Say "finalize ok" out loud; never claim completion without it.
```

- [ ] **Step 4: New section before Phase 5 — "When to stop auditing":**

```markdown
## When to stop auditing (termination rule)

"Closed after a later fresh audit is clean" is not a stop condition — a
fresh audit of a large tree is never clean. Declare a milestone or
release **closed** when ONE audit satisfies all of:

- `audit_profile.surfaces` is the frozen surface set with
  `excluded_tools` empty apart from permanent, recorded waivers;
- zero **blocking** findings (critical/significant with
  `failure_mode: user-visible`);
- `reconciliation` shows 0 `regressed` and no finding has
  `origin.kind: caused-by-fix`;
- the audited commit is at least 12 hours old and no fix commits landed
  during the audit — you audited the tree that will ship.

Moderate and below, and non-user-visible significants, go to the backlog
and do not re-trigger the loop. If a re-audit is requested less than 12
hours after a remediation batch, say so and recommend waiting; if the
user insists, run in re-audit mode and label the pass a *verification*
pass in `scope`.
```

- [ ] **Step 5: Hygiene paragraph (~L99)** — replace the absolute "Subagents return analysis in their final message, never as files" with the scratch policy: final message is canonical; structured scratch allowed only under `/private/tmp/cased/<audit-id>/`; controller re-verifies; nothing under the target repo.

- [ ] **Step 6: Phase 5** — replace the disposition list with a pointer to the updated `actions-taken-schema.md` (Task 10) and add: "Run `build-report.js ledger <audit-directory>` after every batch of ledger entries; fix errors before committing the ledger."

- [ ] **Step 7: Verify** — `grep -n 'finalize\|re-audit\|termination\|evidence <audit' skills/cased/SKILL.md | wc -l` ≥ 8. Read the whole file once for flow.

- [ ] **Step 8: Commit**

```bash
git add skills/cased/SKILL.md
git commit -m "docs(skill): re-audit mode, audit_profile, evidence+finalize gates, termination rule, scratch policy"
```

---

# Phase 4 — Remediation contract

### Task 10: `actions-taken-schema.md` + `agents-md-template.md` rewrite

Answers spec §5.1–§5.9.

**Files:**
- Modify: `skills/cased/references/actions-taken-schema.md`
- Modify: `src/viewer/agents-md-template.md` (source; bundle copies to `skills/cased/templates/`)
- Modify: `skills/cased/examples/sample-actions-taken.md` (add one compliant `fixed` entry and one `no-measurable-benefit`)
- Test: `test/build-report.test.mjs` (existing renderAgentsMd tests keep passing; the placeholder test from Task 6 covers new placeholders)

- [ ] **Step 1: `actions-taken-schema.md` — entry format.** Replace the entry template with:

```markdown
## YYYY-MM-DD — {brief description of action}

**Disposition:** {fixed | mitigated | accepted | disputed | deferred | escalated | superseded | no-measurable-benefit}
**Addresses:** [{slug}](README.md#{slug}), …
**Commit:** {SHA(s)}                       ← required for fixed / mitigated / superseded
**Author:** {who did the work — model id or person}
**Verification:** {exact workspace-scope commands and results}   ← required for fixed
**Blast radius:** {crates touched vs crates named in the finding; reverse deps of changed symbols (`cargo tree --invert -p <crate>`); co-varying docs/tests/config grepped and updated or listed}   ← required for fixed
**Diff:** {N files, +I −D, C commits}      ← required for fixed
**Coverage lost:** {none | what an edited/removed test no longer asserts}   ← required when a fix edits an existing test's inputs or expectations

{Rationale paragraphs. For disputed/accepted: the evidence. For deferred/
escalated: the target or the decision needed. For fixed: what changed and
why this approach — and, if the fix touched a public signature, say so.}
```

Add the new dispositions:

```markdown
- `escalated` — the fix is out of budget: actual diff ≥ 5× what the effort
  estimate implied, or a third fix commit on the same slug. Stop, record
  what was learned, and hand the design decision to a human. Not a failure
  — a circuit breaker. (One "small + medium" pair became 17 commits and
  8,084 lines with `fixed: 2 / open: 0` on the ledger.)
- `superseded` — a later action replaces this finding's fix or the finding
  itself (`superseded_by:` slug or SHA in the body). Use instead of
  re-filing the same concern under a new heading.
- `no-measurable-benefit` — a performance/ergonomics remediation was
  implemented or prototyped, measured, and showed no benefit; the change
  was not kept. Record the measurement. This is a legal, honest outcome —
  do not ship a null result as `fixed`.
```

And a "Verification is workspace-scope" section:

```markdown
**Verification is workspace-scope, always.** Run the project's canonical
test command from `recon.yaml#testing.command` (or `AGENTS.md` "Workspace
test command") across the whole workspace, plus any sibling workspaces
(`fuzz/`, `xtask/`, `benches/`), package/deny/feature-matrix gates the
project has (`just check`, `cargo hack --each-feature`, `cargo deny
check`). "All 103 tests in crate X pass" is not verification — the
recurrence rate collapsed exactly when ledgers switched from crate-local
to workspace-scope gates.

**Pushback is an obligation, not an option.** For every finding you MUST
decide whether it should be `disputed` (mechanism wrong, unreachable,
misread guard), `deferred` (real but not now — with a target), or
`no-measurable-benefit`. A ledger with 100% `fixed` over dozens of findings
is compliance, not diligence. Never fix a `note`-level finding with a
breaking public change; defer it.

**Fix by subsystem, not by slug.** If ≥ 2 findings touch the same file or
mechanism, remediate once with the design decision recorded, and list
every slug in `Addresses`. Sequential per-slug rewrites of one file are the
signature of churn.

**Regression tests must measure the claimed quantity.** If the finding is
about allocations, assert allocations (not `Vec` capacity). Name the
metric in the entry.
```

- [ ] **Step 2: `src/viewer/agents-md-template.md` — replace "## The loop" with:**

```markdown
## Context you need before touching code

**Mode:** {{mode}} · **Blocking findings:** {{blocking_count}} · **Backlog:** {{backlog_count}}
**Workspace test command:** `{{test_command}}`
**Release phase:** {{release_phase}} — pre-publish means change types in
place; additive-compat pairs (`FooBorrowed` beside `Foo`) are wrong until
the API is published.

### Prior audits
{{prior_audits}}

### Carried forward (already dispositioned — do NOT re-remediate)
{{carried_forward_list}}

## The loop

For each finding — **blocking first, then backlog** (backlog is optional
for release; triage it, don't grind it):

1. Find it by slug in `README.md` / `report.html`. Read concern, location,
   mechanism, remediation, `failure_mode`, `origin`.
2. **Decide the disposition before writing code.** Is the mechanism
   right? (Trace the path — the reviewer may have missed a guard.)
   Reachable? Worth it now? If not: `disputed` / `deferred` /
   `no-measurable-benefit`, with rationale. Zero pushback across a ledger
   is a smell.
3. **Scope the blast radius before the change.** Which crates does the
   fix touch vs which the finding names? `cargo tree --invert -p <crate>`
   for consumers of any changed symbol. Grep for co-varying text (docs,
   README numbers, config templates, tests asserting the old behaviour).
   If ≥ 2 findings share a file, fix them together.
4. Make the change. One focused commit per logical fix, trailer
   `Audit-Finding: <slug>` per slug. If you edit an existing test's inputs
   or expectations, note what coverage is lost.
5. **Verify at workspace scope**: `{{test_command}}` and the project's
   check/deny/feature gates — including sibling workspaces (`fuzz/`,
   `xtask/`). Crate-local passes are not evidence.
6. **Check the budget.** `git diff --shortstat <base>..HEAD` for this
   finding. Effort `trivial`/`small` and you are past 10 files or 500
   insertions, or on your third commit for one slug → stop, disposition
   `escalated`, hand it to a human.
7. Append one ledger entry (format below), then run
   `node <cased>/scripts/build-report.js ledger <this-dir>` and fix every
   error before committing the ledger.
```

Update the entry format block in the template to match Step 1 (Verification / Blast radius / Diff / Coverage lost lines), and the "What you must not do" list to add: "Do not remediate carried-forward findings. Do not fix a note with a breaking change. Do not claim `fixed` on crate-local test evidence."

- [ ] **Step 3: Rebuild + tests + bundle check**

Run: `scripts/build-viewer.sh && node --test test/build-report.test.mjs && just check-bundle`
Expected: pass; `bundle ok`.

- [ ] **Step 4: Commit**

```bash
git add skills/cased/references/actions-taken-schema.md src/viewer/agents-md-template.md skills/cased/templates skills/cased/examples
git commit -m "docs(skill): remediation contract — verification, blast radius, diff budget, pushback, new dispositions"
```

---

# Phase 5 — Evals

### Task 11: Scorer — `scoreArtifacts` (process/gate metrics from the audit dir)

Answers: every gate above must be measured, not assumed.

**Files:**
- Modify: `evals/scripts/score-eval.mjs`
- Test: `test/eval-score.test.mjs`

**Interfaces:**
- Produces: `scoreArtifacts(auditDir, {repoRoot}) → {audit_profile_complete: bool, readme_complete: bool, evidence_problems: int, finalize_ok: bool, origin_coverage: number|null (fraction of findings with origin.kind), failure_mode_coverage: number|null, blocking: int, backlog: int, class_sweep_multi_location: int (findings with ≥2 locations)}`. Uses `finalizeAudit`, `checkAuditProfile`, `checkReadmeComplete`, `checkEvidenceFidelity`, `isBlocking` from `src/viewer/*.mjs`.
- CLI: `score-eval.mjs <fixture-dir> <findings.yaml> [--json] [--audit-dir <dir> --repo-root <dir>]` merges `artifacts:` into the result.

- [ ] **Step 1: Failing test** — append to `test/eval-score.test.mjs`:

```js
import { scoreArtifacts } from '../evals/scripts/score-eval.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

test('scoreArtifacts reports gate outcomes', () => {
  const repo = mkdtempSync(join(tmpdir(), 'cased-art-'));
  const dir = join(repo, 'record', 'audits', '2026-08-18-10-x'); mkdirSync(dir, { recursive: true });
  mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src', 'a.rs'), 'fn a() {}\n');
  const findings = { audit_date: '2026-08-18', scope: 's', commit: 'abc1234', assessment: 'a', summary: { counts: { critical: 0, significant: 1, moderate: 0, advisory: 0, note: 0 } },
    narratives: [{ slug: 'n', title: 'N', thesis: 't', verdict: 'v', findings: [
      { slug: 'f1', title: 'F1', concern: 'significant', failure_mode: 'user-visible', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/a.rs', start_line: 1, end_line: 1 }, { path: 'src/a.rs', start_line: 1, end_line: 1 }], evidence: 'fn a() {}\nfn a() {}\n', mechanism: 'm', remediation: 'r' } ] }] };
  writeFileSync(join(dir, 'findings.yaml'), YAML.stringify(findings));
  const recon = YAML.parse(readFileSync('src/schemas/recon.example.yaml', 'utf8')); recon.structure.root = repo;
  writeFileSync(join(dir, 'recon.yaml'), YAML.stringify(recon));
  writeFileSync(join(dir, 'README.md'), '# Audit\n\nProse.\n'); writeFileSync(join(dir, 'report.html'), '<html>'); writeFileSync(join(dir, 'AGENTS.md'), '# A');
  const a = scoreArtifacts(dir, { repoRoot: repo });
  assert.equal(a.audit_profile_complete, true);
  assert.equal(a.readme_complete, true);
  assert.equal(a.evidence_problems, 0);
  assert.equal(a.finalize_ok, true);
  assert.equal(a.origin_coverage, 1);
  assert.equal(a.failure_mode_coverage, 1);
  assert.equal(a.blocking, 1);
  assert.equal(a.class_sweep_multi_location, 1);
});
```

(Add `import { readFileSync } from 'node:fs'` if not already imported.)

- [ ] **Step 2: Run**: `node --test test/eval-score.test.mjs` → FAIL.

- [ ] **Step 3: Implement** in `score-eval.mjs`:

```js
import { finalizeAudit, parseFindings, parseRecon } from '../../src/viewer/build-report.mjs';
import { checkAuditProfile, checkReadmeComplete, checkEvidenceFidelity, isBlocking, allFindings } from '../../src/viewer/gates.mjs';

export function scoreArtifacts(auditDir, { repoRoot }) {
  const findings = parseFindings(readFileSync(join(auditDir, 'findings.yaml'), 'utf8'));
  const recon = existsSync(join(auditDir, 'recon.yaml')) ? parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8')) : {};
  const readme = existsSync(join(auditDir, 'README.md')) ? readFileSync(join(auditDir, 'README.md'), 'utf8') : '';
  const all = allFindings(findings);
  const frac = pred => (all.length ? +(all.filter(pred).length / all.length).toFixed(3) : null);
  const fin = finalizeAudit(auditDir, { repoRoot });
  return {
    audit_profile_complete: checkAuditProfile(recon).length === 0,
    readme_complete: checkReadmeComplete(readme).length === 0,
    evidence_problems: checkEvidenceFidelity(findings, repoRoot).length,
    finalize_ok: fin.ok,
    finalize_errors: fin.errors,
    origin_coverage: frac(f => !!f.origin?.kind),
    failure_mode_coverage: frac(f => !!f.failure_mode),
    blocking: all.filter(isBlocking).length,
    backlog: all.length - all.filter(isBlocking).length,
    class_sweep_multi_location: all.filter(f => (f.locations ?? []).length >= 2).length,
  };
}
```

Extend `main()` to parse `--audit-dir` / `--repo-root`; when present, `result.artifacts = scoreArtifacts(...)`; text output prints one line per key.

- [ ] **Step 4: Run** `node --test test/eval-score.test.mjs` → PASS. Commit:

```bash
git add evals/scripts/score-eval.mjs test/eval-score.test.mjs
git commit -m "feat(evals): scoreArtifacts — gate outcomes, origin/failure_mode coverage, blocking split, class-sweep count"
```

---

### Task 12: Scorer — `scoreReaudit` (carried-forward suppression, regression labeling, class-sweep grouping, caused-by attribution)

**Files:**
- Modify: `evals/scripts/score-eval.mjs`
- Test: `test/eval-score-reaudit.test.mjs` (new; add to `justfile`)

**Interfaces:**
- Consumes new `expected-findings.yaml` keys:
  ```yaml
  reaudit:
    prior_audit: 2026-08-01-10-full-repo
    carried_forward:            # prior deferred slugs; must appear in findings.carried_forward and NOT as fresh findings at these locations
      - { slug: args-index-panic, path: src/main.rs, lines: [7, 7] }
    regressions:                # fixed-then-reverted; must be found AND labelled recurrence-of
      - { prior_slug: silent-write-discard, path: src/store.rs, lines: [13, 13] }
    caused_by:                  # defect introduced by a ledgered fix commit; must be found AND labelled caused-by-fix with a SHA that matches {{FIX_SHA_n}} placeholder resolved by setup.sh
      - { id: exit-code-wrap, path: src/main.rs, lines: [20, 22], fix_placeholder: FIX_SHA_1 }
    class_sweeps:               # one mechanism seeded in N files; expect ONE finding covering >= min_locations of them
      - { id: unwrap-on-input, paths: [src/config.rs, src/store.rs, src/cli.rs], min_locations: 2 }
    still_fixed:                # ledgered fixes that hold; reconciliation must say still-fixed
      - { prior_slug: swallowed-load-error }
  ```
- Produces: `scoreReaudit(expectedDoc, findingsDoc, {shaMap}) → {carried_forward_suppressed: n/total, regressions_found: n/total, regressions_labelled: n/total, caused_by_found: n/total, caused_by_labelled: n/total, class_sweeps_grouped: n/total, still_fixed_reconciled: n/total, reconciliation_present: bool}` where each `n/total` is `{n, total}`.

- [ ] **Step 1: Failing test** — create `test/eval-score-reaudit.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreReaudit } from '../evals/scripts/score-eval.mjs';

const expected = { tolerance_lines: 2, reaudit: {
  prior_audit: 'p',
  carried_forward: [{ slug: 'cf-1', path: 'src/main.rs', lines: [7, 7] }],
  regressions: [{ prior_slug: 'reg-1', path: 'src/store.rs', lines: [13, 13] }],
  caused_by: [{ id: 'cb-1', path: 'src/main.rs', lines: [20, 22], fix_placeholder: 'FIX_SHA_1' }],
  class_sweeps: [{ id: 'cs-1', paths: ['src/a.rs', 'src/b.rs', 'src/c.rs'], min_locations: 2 }],
  still_fixed: [{ prior_slug: 'ok-1' }],
} };
const shaMap = { FIX_SHA_1: 'abc1234' };

test('perfect re-audit scores full marks', () => {
  const doc = {
    carried_forward: [{ slug: 'cf-1', prior_audit: 'p', disposition: 'deferred' }],
    reconciliation: [{ prior_slug: 'ok-1', prior_audit: 'p', status: 'still-fixed' }, { prior_slug: 'reg-1', prior_audit: 'p', status: 'regressed' }],
    narratives: [{ findings: [
      { slug: 'x', concern: 'significant', origin: { kind: 'recurrence-of', ref: 'reg-1' }, locations: [{ path: 'src/store.rs', start_line: 13, end_line: 13 }] },
      { slug: 'y', concern: 'moderate', origin: { kind: 'caused-by-fix', ref: 'abc1234' }, locations: [{ path: 'src/main.rs', start_line: 21, end_line: 21 }] },
      { slug: 'z', concern: 'moderate', locations: [{ path: 'src/a.rs', start_line: 1, end_line: 1 }, { path: 'src/c.rs', start_line: 4, end_line: 4 }] },
    ] }],
  };
  const r = scoreReaudit(expected, doc, { shaMap });
  assert.deepEqual(r.carried_forward_suppressed, { n: 1, total: 1 });
  assert.deepEqual(r.regressions_found, { n: 1, total: 1 });
  assert.deepEqual(r.regressions_labelled, { n: 1, total: 1 });
  assert.deepEqual(r.caused_by_found, { n: 1, total: 1 });
  assert.deepEqual(r.caused_by_labelled, { n: 1, total: 1 });
  assert.deepEqual(r.class_sweeps_grouped, { n: 1, total: 1 });
  assert.deepEqual(r.still_fixed_reconciled, { n: 1, total: 1 });
  assert.equal(r.reconciliation_present, true);
});

test('re-filing a carried-forward slug as fresh, unlabelled regression, and split class sweep all lose marks', () => {
  const doc = {
    carried_forward: [],
    narratives: [{ findings: [
      { slug: 'again', concern: 'moderate', locations: [{ path: 'src/main.rs', start_line: 7, end_line: 7 }] },
      { slug: 'x', concern: 'significant', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/store.rs', start_line: 13, end_line: 13 }] },
      { slug: 'z1', concern: 'moderate', locations: [{ path: 'src/a.rs', start_line: 1, end_line: 1 }] },
      { slug: 'z2', concern: 'moderate', locations: [{ path: 'src/b.rs', start_line: 1, end_line: 1 }] },
    ] }],
  };
  const r = scoreReaudit(expected, doc, { shaMap });
  assert.deepEqual(r.carried_forward_suppressed, { n: 0, total: 1 });
  assert.deepEqual(r.regressions_found, { n: 1, total: 1 });
  assert.deepEqual(r.regressions_labelled, { n: 0, total: 1 });
  assert.deepEqual(r.class_sweeps_grouped, { n: 0, total: 1 });
  assert.equal(r.reconciliation_present, false);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** in `score-eval.mjs`:

```js
function findAt(findings, path, lines, tol, paths) {
  return findings.filter(f => (f.locations ?? []).some(l => normalizePath(l.path, paths) === path && overlaps(lines[0], lines[1], l.start_line, l.end_line, tol)));
}
const ratio = (n, total) => ({ n, total });

export function scoreReaudit(expectedDoc, findingsDoc, { shaMap = {} } = {}) {
  const r = expectedDoc.reaudit ?? {};
  const tol = expectedDoc.tolerance_lines ?? 4;
  const findings = (findingsDoc.narratives ?? []).flatMap(n => n.findings ?? []);
  const cf = new Set((findingsDoc.carried_forward ?? []).map(c => c.slug));
  const recon = findingsDoc.reconciliation ?? [];
  const allPaths = [...new Set([...(r.carried_forward ?? []).map(c => c.path), ...(r.regressions ?? []).map(c => c.path), ...(r.caused_by ?? []).map(c => c.path), ...(r.class_sweeps ?? []).flatMap(c => c.paths)])];

  const cfOk = (r.carried_forward ?? []).filter(c => cf.has(c.slug) && findAt(findings, c.path, c.lines, tol, allPaths).length === 0).length;
  const regs = (r.regressions ?? []).map(c => ({ hits: findAt(findings, c.path, c.lines, tol, allPaths), c }));
  const regFound = regs.filter(x => x.hits.length).length;
  const regLabelled = regs.filter(x => x.hits.some(f => f.origin?.kind === 'recurrence-of' && f.origin.ref === x.c.prior_slug)).length;
  const cbs = (r.caused_by ?? []).map(c => ({ hits: findAt(findings, c.path, c.lines, tol, allPaths), sha: shaMap[c.fix_placeholder] }));
  const cbFound = cbs.filter(x => x.hits.length).length;
  const cbLabelled = cbs.filter(x => x.hits.some(f => f.origin?.kind === 'caused-by-fix' && x.sha && (f.origin.ref?.startsWith(x.sha) || x.sha.startsWith(f.origin.ref ?? ' ')))).length;
  const sweeps = (r.class_sweeps ?? []).filter(c => findings.some(f => new Set((f.locations ?? []).map(l => normalizePath(l.path, allPaths)).filter(p => c.paths.includes(p))).size >= (c.min_locations ?? 2))).length;
  const stillFixed = (r.still_fixed ?? []).filter(c => recon.some(x => x.prior_slug === c.prior_slug && x.status === 'still-fixed')).length;

  return {
    carried_forward_suppressed: ratio(cfOk, (r.carried_forward ?? []).length),
    regressions_found: ratio(regFound, regs.length),
    regressions_labelled: ratio(regLabelled, regs.length),
    caused_by_found: ratio(cbFound, cbs.length),
    caused_by_labelled: ratio(cbLabelled, cbs.length),
    class_sweeps_grouped: ratio(sweeps, (r.class_sweeps ?? []).length),
    still_fixed_reconciled: ratio(stillFixed, (r.still_fixed ?? []).length),
    reconciliation_present: recon.length > 0,
  };
}
```

`main()`: when `expectedDoc.reaudit` exists, read `<run-dir>/sha-map.json` if `--sha-map <path>` given, and attach `result.reaudit = scoreReaudit(...)`; print each ratio as `n/total`.

- [ ] **Step 4: Run** → PASS; add test to `justfile`. Commit:

```bash
git add evals/scripts/score-eval.mjs test/eval-score-reaudit.test.mjs justfile
git commit -m "feat(evals): scoreReaudit — carried-forward suppression, regression/caused-by labelling, class-sweep grouping, reconciliation"
```

---

### Task 13: Fixture `reaudit-rs` — prior audit + ledger + seeded regression, caused-by, class sweep, carried-forward

**Files:**
- Create: `evals/fixtures/reaudit-rs/` (copy of `error-handling-rs` + additions):
  - `src/cli.rs` (new; third site for the class sweep), `src/main.rs` (edited: caused-by defect + wires `cli`), `src/store.rs` (regression: revert of the ledgered fix)
  - `record/audits/2026-08-01-10-full-repo/{findings.yaml,recon.yaml,README.md,AGENTS.md,report.html,actions-taken.md}` — the prior audit
  - `setup.sh` — builds git history in the workdir: baseline commit (pre-fix state) → fix commit(s) with `Audit-Finding:` trailers → the caused-by defect inside a fix commit → the regression commit → ledger commit; writes `sha-map.json` into `$RUN_DIR`
  - `expected-findings.yaml` with the `reaudit:` block from Task 12
  - `justfile` (same as error-handling-rs plus `test: cargo test --workspace`)
- Modify: `evals/scripts/run-eval` — after baseline commit, `if [[ -x "$FIXTURE_DIR/setup.sh" ]]; then RUN_DIR="$RUN_DIR" bash "$FIXTURE_DIR/setup.sh" "$WORKDIR"; fi`; exclude `setup.sh` and `hidden-tests` from rsync; pass `--audit-dir/--repo-root/--sha-map` to the scorer.

**Design of the seeds** (all in fixture source, deterministic; keep the crate compiling — `cargo check` in `setup.sh` at every commit):

| Seed | Where | Mechanism | Expected behaviour |
|---|---|---|---|
| carried-forward | `src/main.rs:7` `args[1]` panic | prior ledger: `deferred` "target 0.2 milestone" | appears in `carried_forward`, **not** as a fresh finding |
| still-fixed | `src/store.rs:18-22` swallowed load error | prior ledger `fixed` in setup commit 1 (`Audit-Finding: swallowed-load-error`); code stays fixed | reconciliation `still-fixed` |
| regression | `src/store.rs:13` `let _ = fs::write(...)` | prior ledger `fixed` in setup commit 1; setup commit 3 ("refactor(store): simplify snapshot write") re-introduces `let _ =` | found; `origin.kind: recurrence-of, ref: silent-write-discard`; reconciliation `regressed` |
| caused-by | `src/main.rs:20-22` exit code `as u8` truncation | introduced by setup commit 2 = the ledgered fix for `args-index-panic`'s sibling `exit-code-not-propagated` (`Audit-Finding: exit-code-not-propagated`) — mirrors yamalgam's `halt` case | found; `origin.kind: caused-by-fix, ref: <FIX_SHA_1>` |
| class sweep | `unwrap()` on user input in `src/config.rs:26-27`, `src/store.rs:30`, `src/cli.rs:12` | prior audit found only config.rs (`split-unwrap-user-input`, ledgered fixed for config.rs only) | one finding with ≥ 2 locations across the three files |
| clean | `src/render.rs` | unchanged | zero findings |
| false-positive bait for remediation (Task 14) | prior findings.yaml includes `render-unbounded-width` on `render.rs:5-9` (bounded by caller) | prior ledger leaves it `open` | remediation should `disputed` it |
| note bait for remediation | prior findings.yaml `note`: "`merge_config` could take `impl AsRef<str>`" | open | remediation should defer/accept, not change the public signature |

- [ ] **Step 1: Create the fixture source.** Copy `evals/fixtures/error-handling-rs/{Cargo.toml,Cargo.lock,justfile,src}` to `evals/fixtures/reaudit-rs/`. Rename package in `Cargo.toml` to `reaudit-rs`. Add `src/cli.rs`:

```rust
//! Minimal argument parsing. Deliberately mirrors config.rs's unwrap-on-input
//! pattern so the audit has three sibling sites for one mechanism.
pub struct Cli {
    pub path: String,
    pub verbose: bool,
}

pub fn parse(args: &[String]) -> Cli {
    // seed: unwrap on user input (class-sweep site 3)
    let path = args.get(1).cloned().unwrap();
    let verbose = args.get(2).map(|v| v.parse::<bool>().unwrap()).unwrap_or(false);
    Cli { path, verbose }
}
```

Edit `src/main.rs` so it becomes (line numbers matter — keep this exact layout):

```rust
mod cli;
mod config;
mod render;
mod store;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = &args[1];
    let cli = cli::parse(&args);
    let cfg = match config::load(path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(2);
        }
    };
    let snapshot = store::load_snapshot(&cfg.snapshot_path);
    println!("{}", render::render(&cfg, &snapshot, cli.verbose));
    // exit code requested by config; introduced by the "propagate exit code" fix
    let code: i64 = cfg.exit_code;
    std::process::exit((code as u8) as i32);
}
```

(Adjust `render::render` and `Config` in the copied files to accept the extra `verbose` flag and `exit_code: i64` field; keep the seeded lines in `config.rs`/`store.rs` at their original line numbers — verify with `grep -n`.) Add to `src/store.rs` a third `unwrap` site at line 30: `let n: usize = raw.trim().parse().unwrap();` inside a small `parse_len` helper.

- [ ] **Step 2: Create the prior audit dir.** Write `record/audits/2026-08-01-10-full-repo/findings.yaml` by hand (validate with `just validate`), containing these findings (slugs are the contract for the ledger and the `reaudit:` block): `split-unwrap-user-input` (config.rs:26-26, significant), `silent-write-discard` (store.rs:13-13, significant), `swallowed-load-error` (store.rs:18-22, moderate), `args-index-panic` (main.rs:8-8, moderate), `exit-code-not-propagated` (main.rs:17-17, advisory), `render-unbounded-width` (render.rs:5-9, moderate — the false positive), `merge-config-takes-string` (lib.rs:11-11, note). Give it a `recon.yaml` (run `just recon evals/fixtures/reaudit-rs <that dir>` then set `audit_profile.model: claude-opus-4-6`, `agent_count: 6`, `surfaces: [error-handling]`), then `just build-report <that dir>` to produce `report.html`/`AGENTS.md`, and write a short real README (no `<!-- AGENT:` markers).

Write `actions-taken.md` with placeholders `{{FIX_SHA_1}}` (exit-code fix + config.rs unwrap fix, one commit) and `{{FIX_SHA_2}}` (store.rs write/load fixes):

```markdown
---
audit: 2026-08-01-10-full-repo
last_updated: 2026-08-02
status:
  fixed: 4
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 1
  open: 2
---

# Actions Taken: Full repo

## 2026-08-02 — Propagate config exit code; guard config parsing

**Disposition:** fixed
**Addresses:** [exit-code-not-propagated](README.md#exit-code-not-propagated), [split-unwrap-user-input](README.md#split-unwrap-user-input)
**Commit:** {{FIX_SHA_1}}
**Author:** Codex
**Verification:** `just test` (workspace) — 6 passed
**Blast radius:** crate reaudit-rs only; no public signatures changed
**Diff:** 2 files, +14 −4, 1 commit

`main` now exits with `cfg.exit_code`; `config::load` returns an error instead of unwrapping.

## 2026-08-02 — Propagate snapshot I/O errors

**Disposition:** fixed
**Addresses:** [silent-write-discard](README.md#silent-write-discard), [swallowed-load-error](README.md#swallowed-load-error)
**Commit:** {{FIX_SHA_2}}
**Author:** Codex
**Verification:** `just test` (workspace) — 6 passed
**Blast radius:** store.rs and its one caller in main.rs
**Diff:** 2 files, +11 −3, 1 commit

Write failures are returned; unreadable snapshots produce an error.

## 2026-08-02 — Defer args usage message

**Disposition:** deferred
**Addresses:** [args-index-panic](README.md#args-index-panic)
**Author:** Codex

Target: 0.2 milestone, when the CLI gets a real parser.
```

- [ ] **Step 3: `setup.sh`** (executable). It receives `$1 = WORKDIR`, `$RUN_DIR` in env:

```bash
#!/usr/bin/env bash
# Build the git history a re-audit expects: pre-fix baseline → ledgered fixes
# (one of which introduces a new defect) → a regression → the ledger commit.
# The fixture directory holds the FINAL state of source files; this script
# reconstructs the earlier states by patching backwards, so the checked-in
# tree is always what the audit sees at HEAD.
set -euo pipefail
W="$1"; cd "$W"
git config user.name eval; git config user.email eval@local
commit() { git add -A; git -c commit.gpgsign=false commit -q -m "$1"; git rev-parse --short HEAD; }

# --- state 0: pre-fix baseline (rewrite the seeded lines to their "before" form)
python_free_sed() { sed -i '' -e "$1" "$2"; }
# main.rs before fix 1: no exit-code propagation, config unwrap present
python_free_sed 's|    let code: i64 = cfg.exit_code;|    // (no exit code propagation yet)|' src/main.rs
python_free_sed 's|    std::process::exit((code as u8) as i32);|    let _ = 0;|' src/main.rs
python_free_sed 's|Ok(c) => c,|Ok(c) => c, // pre-fix|' src/main.rs
git rm -q --cached record/audits/2026-08-01-10-full-repo/actions-taken.md 2>/dev/null || true
mv record/audits/2026-08-01-10-full-repo/actions-taken.md /tmp/ledger.$$ 
BASE="$(commit 'chore: baseline before remediation')"

# --- fix 1: exit code propagation (introduces the u8 truncation = caused-by seed) + config guard
git checkout -q "$BASE" -- . 2>/dev/null || true
python_free_sed 's|    // (no exit code propagation yet)|    let code: i64 = cfg.exit_code;|' src/main.rs
python_free_sed 's|    let _ = 0;|    std::process::exit((code as u8) as i32);|' src/main.rs
python_free_sed 's|Ok(c) => c, // pre-fix|Ok(c) => c,|' src/main.rs
FIX1="$(commit "$(printf 'fix(main): propagate config exit code; return errors from config::load\n\nAudit-Finding: exit-code-not-propagated\nAudit-Finding: split-unwrap-user-input')")"

# --- fix 2: store.rs write/load errors propagated (final fixture already has the fixed load; write is fixed here)
python_free_sed 's|    let _ = fs::write(path, data);|    fs::write(path, data)?;|' src/store.rs
FIX2="$(commit "$(printf 'fix(store): propagate snapshot I/O errors\n\nAudit-Finding: silent-write-discard\nAudit-Finding: swallowed-load-error')")"

# --- ledger commit with real SHAs
mkdir -p record/audits/2026-08-01-10-full-repo
sed -e "s/{{FIX_SHA_1}}/$FIX1/g" -e "s/{{FIX_SHA_2}}/$FIX2/g" /tmp/ledger.$$ > record/audits/2026-08-01-10-full-repo/actions-taken.md
rm -f /tmp/ledger.$$
commit 'docs(audit): record remediation ledger' >/dev/null

# --- regression: a "simplification" reintroduces the silent write discard
python_free_sed 's|    fs::write(path, data)?;|    let _ = fs::write(path, data);|' src/store.rs
REG="$(commit 'refactor(store): simplify snapshot write')"

cargo check -q
printf '{"FIX_SHA_1":"%s","FIX_SHA_2":"%s","REGRESSION_SHA":"%s"}\n' "$FIX1" "$FIX2" "$REG" > "$RUN_DIR/sha-map.json"
```

(The checked-in fixture's `src/store.rs:13` must therefore contain `let _ = fs::write(path, data);` — the regressed state — and `main.rs` the `as u8` line; `setup.sh` walks the file back and forward. Run the script by hand once against a scratch copy and `git log --oneline` to confirm five commits with the expected trailers: `git log --format='%h %(trailers:key=Audit-Finding,valueonly)'`.)

- [ ] **Step 4: `expected-findings.yaml`:**

```yaml
fixture: reaudit-rs
surface: error-handling
tolerance_lines: 3
clean_paths:
  - src/render.rs
expected:
  - { id: silent-write-discard-regressed, path: src/store.rs, lines: [13, 13], concern_floor: significant, note: "regression of a ledgered fix" }
  - { id: exit-code-u8-wrap, path: src/main.rs, lines: [20, 21], concern_floor: significant, note: "as u8 wraps: exit_code 256 exits 0 silently; introduced by FIX_SHA_1" }
  - { id: unwrap-class, path: src/cli.rs, lines: [10, 11], concern_floor: significant, note: "unwrap on user input, class-sweep site 3" }
reaudit:
  prior_audit: 2026-08-01-10-full-repo
  carried_forward:
    - { slug: args-index-panic, path: src/main.rs, lines: [8, 8] }
  regressions:
    - { prior_slug: silent-write-discard, path: src/store.rs, lines: [13, 13] }
  caused_by:
    - { id: exit-code-u8-wrap, path: src/main.rs, lines: [20, 21], fix_placeholder: FIX_SHA_1 }
  class_sweeps:
    - { id: unwrap-on-input, paths: [src/config.rs, src/store.rs, src/cli.rs], min_locations: 2 }
  still_fixed:
    - { prior_slug: swallowed-load-error }
    - { prior_slug: exit-code-not-propagated }
```

- [ ] **Step 5: `run-eval` changes.** (a) rsync excludes: `--exclude expected-findings.yaml --exclude target --exclude setup.sh --exclude hidden-tests`. (b) After the baseline commit: `if [[ -x "$FIXTURE_DIR/setup.sh" ]]; then RUN_DIR="$RUN_DIR" bash "$FIXTURE_DIR/setup.sh" "$WORKDIR"; fi`. (c) Scoring: `AUDIT_DIR="$(dirname "$FINDINGS")"`; pass `--audit-dir "$AUDIT_DIR" --repo-root "$WORKDIR"` and, if `$RUN_DIR/sha-map.json` exists, `--sha-map "$RUN_DIR/sha-map.json"`. (d) SANCTIONED regex: allow the fixture's pre-existing prior audit dir files (they were committed at baseline so they aren't strays — no change needed; but `finalize` output nothing new). (e) Prompt: unchanged — the point is that the skill discovers re-audit mode by itself.

- [ ] **Step 6: Dry-run the mechanics without spending tokens** — validate the prior audit dir and rehearse setup:

```bash
just validate evals/fixtures/reaudit-rs/record/audits/2026-08-01-10-full-repo
tmp=$(mktemp -d); rsync -a --exclude expected-findings.yaml --exclude setup.sh evals/fixtures/reaudit-rs/ $tmp/; git -C $tmp init -q; git -C $tmp add -A; git -C $tmp -c user.name=e -c user.email=e@e commit -qm base
RUN_DIR=$tmp bash evals/fixtures/reaudit-rs/setup.sh $tmp && git -C $tmp log --format='%h %s %(trailers:key=Audit-Finding,valueonly,separator=,)' && cat $tmp/sha-map.json && (cd $tmp && cargo check -q && echo compiles)
node evals/scripts/score-eval.mjs evals/fixtures/reaudit-rs evals/fixtures/reaudit-rs/record/audits/2026-08-01-10-full-repo/findings.yaml --sha-map $tmp/sha-map.json
```
Expected: 5 commits, trailers present, compiles; scoring the *prior* findings.yaml against the fixture shows `carried_forward_suppressed 0/1` (it re-files args-index-panic) — proving the metric moves.

- [ ] **Step 7: Live run (costs tokens; do it once):** `just eval reaudit-rs` — then read `score.txt`. Record the baseline numbers in `evals/README.md` (Task 15). Fix any fixture defect it exposes (e.g. line drift) before committing.

- [ ] **Step 8: Commit**

```bash
git add evals/fixtures/reaudit-rs evals/scripts/run-eval
git commit -m "feat(evals): reaudit-rs fixture — prior audit + ledger, seeded regression, caused-by-fix, class sweep, carried-forward"
```

---

### Task 14: Remediation mode — `run-eval --mode remediate`, hidden cross-module tests, `scoreRemediation`

Answers the original hypothesis directly: "passed unit tests but broke the broader stack."

**Files:**
- Modify: `evals/scripts/run-eval` (`--mode audit|remediate`)
- Modify: `evals/scripts/score-eval.mjs` (`scoreRemediation`)
- Create: `evals/fixtures/reaudit-rs/hidden-tests/contract.rs` (copied into `workdir/tests/` **after** remediation, then `cargo test --test contract` is run) — asserts the cross-module contract: `config::load` on a bad line returns `Err` (not panic); `store::save_snapshot` returns `Err` on an unwritable path; `merge_config`'s public signature is unchanged (`fn _sig(f: fn(&str, &str) -> Result<String, String>) {} _sig(reaudit_rs::merge_config);`); `cli::parse` with no path does not panic; exit-code mapping clamps (`exit_code_for(256) == 1`, add this helper to the fixture so the hidden test can call it — remediators who "fix" the truncation by clamping satisfy it; those who leave `as u8` fail).
- Test: `test/eval-score.test.mjs` (`scoreRemediation` unit test on a synthetic ledger + git repo)

**Interfaces:**
- `scoreRemediation({auditDir, repoRoot, testCommand, hiddenTestResult}) → {ledger_present, ledger_errors, ledger_warnings, fixed, disputed, deferred, escalated, no_measurable_benefit, false_positive_disputed: bool (slug render-unbounded-width latest disposition == disputed), note_not_broken: bool (merge-config-takes-string not fixed OR public signature unchanged per hidden test), trailers_ok: {n,total} (fix commits since baseline carrying Audit-Finding), workspace_gate_pass: bool (testCommand exit 0 at HEAD), hidden_tests_pass: bool, verification_workspace_scope: {n,total} (fixed entries citing the workspace command), median_files_per_fix: number}`.

- [ ] **Step 1: Failing test** — append to `test/eval-score.test.mjs` a synthetic case: create a temp git repo with one baseline commit, one fix commit with trailer `Audit-Finding: a`, an audit dir with `findings.yaml` (slugs `a`, `render-unbounded-width`, `merge-config-takes-string`) and an `actions-taken.md` (fixed `a` with Verification citing `just test`, disputed `render-unbounded-width`, deferred `merge-config-takes-string`); call `scoreRemediation({auditDir, repoRoot, testCommand: 'true', hiddenTestResult: true})` and assert `false_positive_disputed === true`, `trailers_ok = {n:1,total:1}`, `verification_workspace_scope = {n:1,total:1}`, `ledger_errors === 0`.

- [ ] **Step 2: Implement `scoreRemediation`** in `score-eval.mjs` using `parseLedger`/`latestDispositions` (from `src/viewer/prior-audits.mjs`), `lintLedger`, and `execFileSync('git', ['-C', repoRoot, 'log', '--format=%h|%(trailers:key=Audit-Finding,valueonly,separator=,)', 'BASELINE..HEAD'])` where `BASELINE` is the tag `eval-baseline` that `run-eval` creates before the remediation session; `median_files_per_fix` from `git show --stat --format= <sha> | tail -1`. `workspace_gate_pass` = `execFileSync(testCommand, {cwd: repoRoot, shell: true})` exit 0.

- [ ] **Step 3: `run-eval --mode remediate`.** Flow: copy fixture (as today) → `setup.sh` (builds prior audit + ledger + regression) → **run an audit first?** No — remediation mode targets the *prior* audit's open/regressed findings: after setup, `git tag eval-baseline`; PROMPT becomes: `"Use the cased skill. Resolve the findings from the latest audit in record/audits/ (read its AGENTS.md). Work through every open finding: decide disposition first, remediate what should be remediated, verify at workspace scope, and record every action in actions-taken.md. Do not ask for confirmation."` → after the session: copy `hidden-tests/*.rs` into `workdir/tests/`, run `cargo test --test contract` (capture pass/fail), run `node build-report.js ledger <prior-audit-dir>`, then `score-eval.mjs --mode remediate --audit-dir <prior-audit-dir> --repo-root <workdir> --test-command "$(yq recon.testing.command)"` (use `node -e` with `yaml` to read the command; no yq dependency). Write `score.json`/`score.txt`, `run-meta.yaml` gets `mode: remediate`.

- [ ] **Step 4: Justfile**: `eval fixture *args` already passes `{{args}}` through — document `just eval reaudit-rs --mode remediate`.

- [ ] **Step 5: Live run once** (`just eval reaudit-rs --mode remediate`); inspect `score.txt`, `transcript.txt`; confirm hidden tests ran and the score reflects it. Fix fixture/prompt defects surfaced; do not tune the fixture to make the model pass.

- [ ] **Step 6: Commit**

```bash
git add evals/scripts/run-eval evals/scripts/score-eval.mjs evals/fixtures/reaudit-rs/hidden-tests test/eval-score.test.mjs justfile
git commit -m "feat(evals): remediation mode — hidden cross-module contract tests, ledger lint, pushback and trailer scoring"
```

---

### Task 15: `compare-runs`, README, and flipping warn→error where the eval proves feasibility

**Files:**
- Modify: `evals/scripts/compare-runs.mjs` — print `artifacts.finalize_ok`, `origin_coverage`, `class_sweep_multi_location`, and each `reaudit.*` ratio, and each `remediation.*` when present, per run.
- Modify: `evals/README.md` — document `--mode`, `setup.sh`, `hidden-tests/`, `sha-map.json`, the new metrics table, and the baseline numbers from Tasks 13/14 live runs.
- Modify: `src/viewer/gates.mjs` — if the live remediation run produced `Blast radius` in ≥ 80% of fixed entries, flip rule 6 (`Blast radius`) from `warn` to `error` and update the Task 5 test expectation; otherwise leave `warn` and note the observed rate in the README.
- Modify: `test/compare-runs.test.mjs` — add a case with `artifacts`/`reaudit` keys present.

- [ ] **Step 1**: extend `compare-runs.mjs` table columns; test; **Step 2**: README; **Step 3**: warn→error decision + test update; **Step 4**: `just test && just check-contract && just check-bundle && just build-smoke` all green.

- [ ] **Step 5: Commit**

```bash
git add evals/scripts/compare-runs.mjs evals/README.md src/viewer/gates.mjs test
git commit -m "feat(evals): compare-runs shows gate/re-audit/remediation metrics; document modes and baselines"
```

---

### Task 16: Handoff + memory

- [ ] Write `record/handoffs/$(TZ=America/New_York date +%Y-%m-%d-%H%M)-audit-churn-reduction.md`: what shipped, the live eval numbers (audit + re-audit + remediate), what the gates refuse, open questions (Codex platform run of the new fixture; whether `failure_mode` calibration needs its own eval seeds; whether to make `Blast radius` an error).
- [ ] Update `~/.claude/projects/-Users-clay-source-claylo-cased/memory/project_audit_churn_research.md` "How to apply" to say the plan is executed and point at the handoff.
- [ ] Commit the handoff.

---

## Self-review against the spec

**Spec coverage (research doc §4/§5/§6 → task):** §4.1 re-audit + reconciliation → T1, T3, T6, T9. §4.2 origin → T1, T7, T12. §4.3 audit_profile → T2, T4, T9. §4.4 class sweep → T7, T12/T13. §4.5 effort from blast radius → T5 (diff budget), T10 (`Blast radius` field); *reverse-dep fan-out computed by the audit itself is NOT implemented* — deliberately deferred: it needs `cargo metadata` at finding time inside subagents; noted as follow-up in T16. §4.6 blockers/backlog → T1 (`failure_mode`), T4 (`isBlocking`), T6 (rendering). §4.7 reviewer split → T4 (`evidence`), T8. §4.8 completeness gates → T4, T6 (`finalize`). §4.9 test-suite exemptions as a surface → **gap**: add one paragraph to `skills/cased/agents/completeness.md` and `skills/crustoleum/agents/completeness.md` in T7 Step 2 ("grep for `#[ignore]`, allowlists, known-failure tables, 'understood and acceptable'; a self-documented acceptable failure against a documented contract is at least significant") — folded into T7. §4.10 recon excludes → T2, T9. §4.11 scratch files → T7, T9. §5.1–§5.9 → T5, T10, T14. §6 termination → T9. Evals for everything → T11–T15.

**Placeholder scan:** no TBD/TODO; every code step has code. Two intentional "decide at execution" points are explicit (T1 Step 6 `if/then` fallback; T15 warn→error flip) with the decision rule stated.

**Type consistency:** `origin.{kind,ref}`, `failure_mode`, `carried_forward[].{slug,prior_audit,disposition,reason}`, `reconciliation[].{prior_slug,prior_audit,status,superseded_by,verified_against}`, `meta.audit_profile.{mode,prior_audit,model,effort,agent_count,surfaces,severity_floor,excluded_tools,skill_versions}` used identically in T1/T2/T4/T6/T9/T11/T12/T13. `renderAgentsMd(findings, tpl, slug, {recon, priorAudits})` and `renderReadmeMd(findings, tpl, {priorAudits})` in T6 only. `finalizeAudit(auditDir, {repoRoot, allowUnledgeredPrior})` in T6/T11. `lintLedger({ledgerText, findingsDoc, gitLog, testCommand})` in T5/T6/T14. Ratios `{n,total}` in T12/T14.
