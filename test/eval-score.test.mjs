import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, overlaps, scoreArtifacts } from '../evals/scripts/score-eval.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

const expectedDoc = {
  fixture: 'test-fixture',
  tolerance_lines: 4,
  clean_paths: ['src/clean.rs'],
  expected: [
    { id: 'seed-a', path: 'src/a.rs', lines: [26, 26], concern_floor: 'significant' },
    { id: 'seed-b', path: 'src/b.rs', lines: [10, 18], concern_floor: 'moderate' },
  ],
};

function findingsDoc(findings) {
  return { narratives: [{ findings }] };
}

test('overlaps respects tolerance in both directions', () => {
  assert.equal(overlaps(26, 26, 26, 26, 0), true);
  assert.equal(overlaps(26, 26, 30, 32, 4), true);
  assert.equal(overlaps(26, 26, 31, 32, 4), false);
  assert.equal(overlaps(10, 18, 1, 8, 4), true);
});

test('exact and tolerant matches count toward recall', () => {
  const result = score(
    expectedDoc,
    findingsDoc([
      {
        slug: 'model-named-this-anything',
        concern: 'significant',
        locations: [{ path: 'src/a.rs', start_line: 24, end_line: 28 }],
      },
    ])
  );
  assert.equal(result.totals.matched, 1);
  assert.equal(result.totals.recall, 0.5);
  assert.equal(result.missed.length, 1);
  assert.equal(result.missed[0].id, 'seed-b');
});

test('paths cited from repo root normalize by suffix', () => {
  const result = score(
    expectedDoc,
    findingsDoc([
      {
        slug: 'prefixed-path',
        concern: 'moderate',
        locations: [{ path: 'workdir/src/b.rs', start_line: 12, end_line: 12 }],
      },
    ])
  );
  assert.equal(result.totals.matched, 1);
});

test('findings in clean paths are false positives', () => {
  const result = score(
    expectedDoc,
    findingsDoc([
      {
        slug: 'invented-problem',
        concern: 'moderate',
        locations: [{ path: 'src/clean.rs', start_line: 5, end_line: 9 }],
      },
    ])
  );
  assert.equal(result.totals.false_positives, 1);
  assert.equal(result.totals.unexpected, 0);
});

test('matched below concern floor is a calibration miss', () => {
  const result = score(
    expectedDoc,
    findingsDoc([
      {
        slug: 'underrated',
        concern: 'note',
        locations: [{ path: 'src/a.rs', start_line: 26, end_line: 26 }],
      },
    ])
  );
  assert.equal(result.totals.matched, 1);
  assert.equal(result.totals.calibration_misses, 1);
  assert.equal(result.calibration_misses[0].reported, 'note');
});

test('unmatched findings outside clean paths are unexpected, not FP', () => {
  const result = score(
    expectedDoc,
    findingsDoc([
      {
        slug: 'somewhere-else',
        concern: 'advisory',
        locations: [{ path: 'src/other.rs', start_line: 1, end_line: 3 }],
      },
    ])
  );
  assert.equal(result.totals.unexpected, 1);
  assert.equal(result.totals.false_positives, 0);
});

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
