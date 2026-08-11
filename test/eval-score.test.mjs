import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, overlaps } from '../evals/scripts/score-eval.mjs';

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
