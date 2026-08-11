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

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const asJson = process.argv.includes('--json');
  if (args.length !== 2) {
    console.error('Usage: score-eval.mjs <fixture-dir> <findings.yaml> [--json]');
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
