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
**Blast radius:** crates touched: core
**Coverage lost:** none

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
    assert.equal(l.entries[0].fields['Blast radius'], 'crates touched: core');
    assert.equal(l.entries[0].fields['Coverage lost'], 'none');
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
