import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, overlaps, scoreArtifacts, scoreRemediation } from '../evals/scripts/score-eval.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

// --- remediation mode -------------------------------------------------------
// A synthetic remediation: one fix commit carrying a trailer, a ledger that
// fixes one finding, disputes the false-positive bait, and defers the note —
// on top of a PRE-SEEDED ledger entry (finding `b`, fixed by a commit that
// predates `eval-baseline`), mirroring how the reaudit-rs fixture's setup.sh
// bakes fix commits and a ledgered disposition into history before the
// remediation session's baseline is tagged. `b` must never count toward the
// session's totals.

function remediationRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cased-rem-'));
  const dir = join(repo, 'record', 'audits', '2026-08-01-10-x');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(repo, 'src'));
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'eval');
  git('config', 'user.email', 'eval@local');
  git('config', 'commit.gpgsign', 'false');

  const findings = {
    audit_date: '2026-08-01', scope: 's', commit: 'abc1234', assessment: 'a',
    summary: { counts: { critical: 0, significant: 2, moderate: 1, advisory: 0, note: 1 } },
    narratives: [{ slug: 'n', title: 'N', thesis: 't', verdict: 'v', findings: [
      { slug: 'a', title: 'A', concern: 'significant', effort: 'trivial', failure_mode: 'user-visible', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/a.rs', start_line: 1, end_line: 1 }], evidence: 'fn a() {}', mechanism: 'm', remediation: 'r' },
      { slug: 'b', title: 'B', concern: 'significant', effort: 'trivial', failure_mode: 'user-visible', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/b.rs', start_line: 1, end_line: 1 }], evidence: 'fn b() {}', mechanism: 'm', remediation: 'r' },
      { slug: 'render-unbounded-width', title: 'FP', concern: 'moderate', effort: 'small', failure_mode: 'user-visible', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/clean.rs', start_line: 1, end_line: 1 }], evidence: 'fn c() {}', mechanism: 'm', remediation: 'r' },
      { slug: 'merge-config-takes-string', title: 'Note', concern: 'note', effort: 'small', failure_mode: 'internal', origin: { kind: 'pre-existing' }, locations: [{ path: 'src/lib.rs', start_line: 1, end_line: 1 }], evidence: 'pub fn m() {}', mechanism: 'm', remediation: 'r' },
    ] }],
  };
  writeFileSync(join(dir, 'findings.yaml'), YAML.stringify(findings));
  writeFileSync(join(repo, 'src', 'a.rs'), 'fn a() {}\n');
  writeFileSync(join(repo, 'src', 'b.rs'), 'fn b() {}\n');
  writeFileSync(join(repo, 'src', 'clean.rs'), 'fn c() {}\n');
  writeFileSync(join(repo, 'src', 'lib.rs'), 'pub fn m() {}\n');
  git('add', '-A');
  git('commit', '-qm', 'baseline');

  // Pre-seeded: `b` was already fixed, and ledgered, before this session's
  // baseline is tagged — the synthetic equivalent of the fixture's
  // setup.sh-built history.
  writeFileSync(join(repo, 'src', 'b.rs'), 'fn b() -> Result<(), ()> { Ok(()) }\n');
  git('add', '-A');
  git('commit', '-qm', 'fix(b): guard the other boundary\n\nAudit-Finding: b');
  const preSeededSha = git('rev-parse', '--short', 'HEAD').trim();
  writeFileSync(join(dir, 'actions-taken.md'), [
    '---', 'audit: 2026-08-01-10-x', 'last_updated: 2026-08-01',
    'status:', '  fixed: 1', '  mitigated: 0', '  accepted: 0', '  disputed: 0',
    '  deferred: 0', '  escalated: 0', '  superseded: 0', '  no-measurable-benefit: 0',
    '  open: 3', '---', '',
    '# Actions Taken: s', '',
    '## 2026-08-01 — Guard the other boundary', '',
    '**Disposition:** fixed',
    '**Addresses:** [b](README.md#b)',
    '**Commit:** ' + preSeededSha,
    '**Author:** eval',
    '**Verification:** `just test` (workspace) — 6 passed',
    '**Blast radius:** one crate; no public signatures changed',
    '**Diff:** 1 files, +1 −1, 1 commits', '',
    'Pre-seeded fix, landed before this remediation session started.', '',
  ].join('\n'));
  git('add', '-A');
  git('commit', '-qm', 'docs(audit): record the pre-seeded ledger entry');

  git('tag', 'eval-baseline');

  writeFileSync(join(repo, 'src', 'a.rs'), 'fn a() -> Result<(), ()> { Ok(()) }\n');
  git('add', '-A');
  git('commit', '-qm', 'fix(a): guard the input boundary\n\nAudit-Finding: a');

  // Append the session's own entries — real ledgers are append-only, so the
  // pre-seeded `b` entry above stays untouched.
  const priorLedger = readFileSync(join(dir, 'actions-taken.md'), 'utf8');
  writeFileSync(join(dir, 'actions-taken.md'), priorLedger
    .replace('  fixed: 1', '  fixed: 2')
    .replace('  disputed: 0', '  disputed: 1')
    .replace('  deferred: 0', '  deferred: 1')
    .replace('  open: 3', '  open: 0')
    .replace('last_updated: 2026-08-01', 'last_updated: 2026-08-18')
    + [
    '## 2026-08-18 — Guard the input boundary', '',
    '**Disposition:** fixed',
    '**Addresses:** [a](README.md#a)',
    '**Commit:** ' + git('rev-parse', '--short', 'HEAD').trim(),
    '**Author:** eval',
    '**Verification:** `just test` (workspace) — 6 passed',
    '**Blast radius:** one crate; no public signatures changed',
    '**Diff:** 1 files, +1 −1, 1 commits', '',
    'Guarded the boundary rather than unwrapping.', '',
    '## 2026-08-18 — Dispute the width finding', '',
    '**Disposition:** disputed',
    '**Addresses:** [render-unbounded-width](README.md#render-unbounded-width)',
    '**Author:** eval', '',
    'The width is bounded by the caller\'s own map, which is parsed from a file the',
    'caller chose to load; there is no untrusted path to an unbounded key here.', '',
    '## 2026-08-18 — Defer the error-type change', '',
    '**Disposition:** deferred',
    '**Addresses:** [merge-config-takes-string](README.md#merge-config-takes-string)',
    '**Author:** eval', '',
    'Target: the 0.2 milestone. Changing the public error type is breaking and this',
    'is a note.', '',
  ].join('\n'));
  git('add', '-A');
  git('commit', '-qm', 'docs(audit): record the remediation ledger');
  return { repo, dir };
}

const REMEDIATION_GT = {
  false_positive_slug: 'render-unbounded-width',
  note_bait_slug: 'merge-config-takes-string',
  signature_test: 'merge_config_public_signature_is_unchanged',
  test_command: 'just test',
};

test('scoreRemediation reads dispositions, trailers, and verification scope', () => {
  const { repo, dir } = remediationRepo();
  const r = scoreRemediation({
    auditDir: dir, repoRoot: repo, testCommand: 'true',
    hiddenTestResult: true, remediation: REMEDIATION_GT,
  });
  assert.equal(r.ledger_present, true);
  assert.equal(r.ledger_errors, 0);
  assert.equal(r.false_positive_disputed, true);
  assert.equal(r.note_not_broken, true);
  assert.deepEqual(r.trailers_ok, { n: 1, total: 1 });
  // `b`'s pre-seeded, pre-baseline fixed entry also cites `just test` — if it
  // leaked into this ratio it would read 2/2 instead of 1/1.
  assert.deepEqual(r.verification_workspace_scope, { n: 1, total: 1 });
  // 3 session entries (a fixed, render-unbounded-width disputed,
  // merge-config-takes-string deferred) out of 4 total ledger entries
  // (those 3 plus the pre-seeded `b` fix).
  assert.equal(r.session_entries, 3);
  assert.equal(r.total_entries, 4);
  // `b`'s pre-seeded `fixed` disposition must not inflate this count.
  assert.equal(r.fixed, 1);
  assert.equal(r.disputed, 1);
  assert.equal(r.deferred, 1);
  assert.equal(r.escalated, 0);
  assert.equal(r.no_measurable_benefit, 0);
  assert.equal(r.workspace_gate_pass, true);
  assert.equal(r.hidden_tests_pass, true);
  assert.equal(r.median_files_per_fix, 1);
});

test('scoreRemediation flags a fixed false positive and a broken note', () => {
  const { repo, dir } = remediationRepo();
  writeFileSync(join(dir, 'actions-taken.md'),
    readFileSync(join(dir, 'actions-taken.md'), 'utf8')
      .replace('**Disposition:** disputed', '**Disposition:** fixed')
      .replace('**Disposition:** deferred', '**Disposition:** fixed'));
  const r = scoreRemediation({
    auditDir: dir, repoRoot: repo, testCommand: 'false',
    hiddenTestResult: false, remediation: REMEDIATION_GT,
  });
  assert.equal(r.false_positive_disputed, false);
  assert.equal(r.note_not_broken, false);
  assert.equal(r.workspace_gate_pass, false);
  assert.equal(r.hidden_tests_pass, false);
  assert.ok(r.ledger_errors > 0, 'a fixed entry with no Commit/Verification/Diff is a ledger error');
});

test('scoreRemediation keeps note_not_broken when the signature test still passes', () => {
  const { repo, dir } = remediationRepo();
  writeFileSync(join(dir, 'actions-taken.md'),
    readFileSync(join(dir, 'actions-taken.md'), 'utf8')
      .replace('**Disposition:** deferred', '**Disposition:** fixed'));
  const r = scoreRemediation({
    auditDir: dir, repoRoot: repo, testCommand: 'true',
    hiddenTestResult: false, remediation: REMEDIATION_GT,
    hiddenTestOutput: 'test merge_config_public_signature_is_unchanged ... ok\ntest other ... FAILED\n',
  });
  assert.equal(r.note_not_broken, true);
});
