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
