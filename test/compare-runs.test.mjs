import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, jaccard, loadRun } from '../evals/scripts/compare-runs.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(label, matchedIds, missedIds, totalsOverride = {}) {
  return {
    dir: `/fake/${label}`,
    label,
    meta: {},
    score: {
      fixture: 'error-handling-rs',
      totals: {
        expected: matchedIds.length + missedIds.length,
        matched: matchedIds.length,
        false_positives: 0,
        unexpected: 0,
        calibration_misses: 0,
        ...totalsOverride,
      },
      matched: matchedIds.map((id) => ({ id, slug: `slug-${id}`, concern: 'moderate' })),
      missed: missedIds.map((id) => ({ id })),
    },
  };
}

test('jaccard basics', () => {
  assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  assert.equal(jaccard(['a', 'b'], ['b', 'c']), 0.333);
  assert.equal(jaccard([], []), 1);
  assert.equal(jaccard(['a'], []), 0);
});

test('compare builds seed matrix across runs', () => {
  const result = compare([
    run('claude/opus/max', ['s1', 's2'], ['s3']),
    run('claude/sonnet/high', ['s2', 's3'], ['s1']),
  ]);
  assert.equal(result.seeds.length, 3);
  const s2 = result.seeds.find((s) => s.id === 's2');
  assert.deepEqual(s2.hits, ['moderate', 'moderate']);
  const s1 = result.seeds.find((s) => s.id === 's1');
  assert.deepEqual(s1.hits, ['moderate', null]);
  assert.equal(result.pairwise_jaccard[0].jaccard, 0.333);
});

test('compare rejects mixed fixtures', () => {
  const a = run('a', ['s1'], []);
  const b = run('b', ['s1'], []);
  b.score.fixture = 'other-fixture';
  assert.throws(() => compare([a, b]), /different fixtures/);
});

test('loadRun rejects a remediate-mode score.json with a clear message, not a TypeError', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cased-compare-'));
  writeFileSync(join(dir, 'score.json'), JSON.stringify({
    fixture: 'reaudit-rs',
    mode: 'remediate',
    remediation: { fixed: 1 },
  }));
  assert.throws(() => loadRun(dir), /remediate-mode/);
});
