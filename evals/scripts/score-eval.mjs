#!/usr/bin/env node
// Score an audit's findings.yaml against a fixture's expected-findings.yaml.
//
// Matching is by path + line-range overlap (± tolerance) — slugs, titles,
// and narrative groupings are model-authored free text and differ across
// models and runs, so they never participate in matching.
//
// Usage: node score-eval.mjs <fixture-dir> <findings.yaml> [--json]
//
// Exit codes: 0 scored (regardless of quality), 2 usage/parse error.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { finalizeAudit, parseFindings, parseRecon } from '../../src/viewer/build-report.mjs';
import { checkAuditProfile, checkReadmeComplete, checkEvidenceFidelity, isBlocking, allFindings } from '../../src/viewer/gates.mjs';

const CONCERN_RANK = { note: 0, advisory: 1, moderate: 2, significant: 3, critical: 4 };

export function overlaps(aStart, aEnd, bStart, bEnd, tolerance) {
  return aStart - tolerance <= bEnd && bStart - tolerance <= aEnd;
}

function normalizePath(p, fixturePaths) {
  // Findings may cite paths relative to the audited repo root; expected
  // paths are fixture-relative. Match on suffix.
  for (const fp of fixturePaths) {
    if (p === fp || p.endsWith(`/${fp}`)) return fp;
  }
  return p;
}

export function score(expectedDoc, findingsDoc) {
  const tolerance = expectedDoc.tolerance_lines ?? 4;
  const cleanPaths = expectedDoc.clean_paths ?? [];
  const expected = expectedDoc.expected ?? [];
  const expectedPaths = expected.map((e) => e.path);

  // Flatten findings across narratives; each location is a match candidate.
  const findings = [];
  for (const narrative of findingsDoc.narratives ?? []) {
    for (const f of narrative.findings ?? []) {
      findings.push(f);
    }
  }

  const matched = [];
  const calibrationMisses = [];
  const matchedFindingSlugs = new Set();

  for (const exp of expected) {
    let hit = null;
    for (const f of findings) {
      for (const loc of f.locations ?? []) {
        const path = normalizePath(loc.path, expectedPaths.concat(cleanPaths));
        if (path !== exp.path) continue;
        if (overlaps(exp.lines[0], exp.lines[1], loc.start_line, loc.end_line, tolerance)) {
          hit = f;
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      matched.push({ id: exp.id, slug: hit.slug, concern: hit.concern });
      matchedFindingSlugs.add(hit.slug);
      if (CONCERN_RANK[hit.concern] < CONCERN_RANK[exp.concern_floor]) {
        calibrationMisses.push({
          id: exp.id,
          slug: hit.slug,
          reported: hit.concern,
          floor: exp.concern_floor,
        });
      }
    }
  }

  const missed = expected
    .filter((e) => !matched.some((m) => m.id === e.id))
    .map((e) => ({ id: e.id, path: e.path, lines: e.lines, note: e.note }));

  // Unmatched findings: in a seeded fixture, anything not in the manifest
  // is unexpected. Findings in clean_paths are outright false positives.
  const unexpected = [];
  const falsePositives = [];
  for (const f of findings) {
    if (matchedFindingSlugs.has(f.slug)) continue;
    const paths = (f.locations ?? []).map((l) =>
      normalizePath(l.path, expectedPaths.concat(cleanPaths))
    );
    const entry = { slug: f.slug, concern: f.concern, paths };
    if (paths.some((p) => cleanPaths.includes(p))) {
      falsePositives.push(entry);
    } else {
      unexpected.push(entry);
    }
  }

  return {
    fixture: expectedDoc.fixture,
    totals: {
      expected: expected.length,
      matched: matched.length,
      recall: expected.length ? +(matched.length / expected.length).toFixed(3) : null,
      unexpected: unexpected.length,
      false_positives: falsePositives.length,
      calibration_misses: calibrationMisses.length,
    },
    matched,
    missed,
    calibration_misses: calibrationMisses,
    unexpected,
    false_positives: falsePositives,
  };
}

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
  const cbLabelled = cbs.filter(x => x.hits.some(f => f.origin?.kind === 'caused-by-fix' && x.sha && f.origin.ref && (f.origin.ref.startsWith(x.sha) || x.sha.startsWith(f.origin.ref)))).length;
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

function main() {
  const rawArgs = process.argv.slice(2);
  const asJson = rawArgs.includes('--json');
  let auditDir = null;
  let repoRoot = null;
  let shaMapPath = null;
  const args = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--json') continue;
    if (a === '--audit-dir') { auditDir = rawArgs[++i]; continue; }
    if (a === '--repo-root') { repoRoot = rawArgs[++i]; continue; }
    if (a === '--sha-map') { shaMapPath = rawArgs[++i]; continue; }
    args.push(a);
  }
  if (args.length !== 2) {
    console.error('Usage: score-eval.mjs <fixture-dir> <findings.yaml> [--json] [--audit-dir <dir> --repo-root <dir>] [--sha-map <path>]');
    process.exit(2);
  }
  const [fixtureDir, findingsPath] = args;
  const expectedPath = join(fixtureDir, 'expected-findings.yaml');
  for (const p of [expectedPath, findingsPath]) {
    if (!existsSync(p)) {
      console.error(`error: ${p} not found`);
      process.exit(2);
    }
  }

  const expectedDoc = parse(readFileSync(expectedPath, 'utf8'));
  const findingsDoc = parse(readFileSync(findingsPath, 'utf8'));
  const result = score(expectedDoc, findingsDoc);

  if (auditDir) {
    result.artifacts = scoreArtifacts(auditDir, { repoRoot });
  }

  if (expectedDoc.reaudit) {
    let shaMap = {};
    if (shaMapPath) {
      if (!existsSync(shaMapPath)) {
        console.error(`error: ${shaMapPath} not found`);
        process.exit(2);
      }
      shaMap = JSON.parse(readFileSync(shaMapPath, 'utf8'));
    }
    result.reaudit = scoreReaudit(expectedDoc, findingsDoc, { shaMap });
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const t = result.totals;
  console.log(`fixture:            ${result.fixture}`);
  console.log(`recall:             ${t.matched}/${t.expected} (${t.recall ?? 'n/a'})`);
  console.log(`unexpected:         ${t.unexpected}`);
  console.log(`false positives:    ${t.false_positives} (findings in clean paths)`);
  console.log(`calibration misses: ${t.calibration_misses}`);
  for (const m of result.missed) {
    console.log(`  MISSED ${m.id} @ ${m.path}:${m.lines[0]}-${m.lines[1]}`);
  }
  for (const c of result.calibration_misses) {
    console.log(`  UNDERRATED ${c.id}: reported ${c.reported}, floor ${c.floor}`);
  }
  for (const fp of result.false_positives) {
    console.log(`  FALSE POSITIVE ${fp.slug} @ ${fp.paths.join(', ')}`);
  }
  if (result.artifacts) {
    console.log('artifacts:');
    for (const [k, v] of Object.entries(result.artifacts)) {
      console.log(`  ${k}: ${Array.isArray(v) ? v.length : JSON.stringify(v)}`);
    }
  }
  if (result.reaudit) {
    console.log('reaudit:');
    for (const [k, v] of Object.entries(result.reaudit)) {
      console.log(`  ${k}: ${v && typeof v === 'object' ? `${v.n}/${v.total}` : v}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
