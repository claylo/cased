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
