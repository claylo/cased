#!/usr/bin/env node
// Compare scored eval runs of the same fixture across the model/effort/
// platform matrix. Reads run directories produced by run-eval (each with
// run-meta.yaml + score.json) and reports per-seed hits, totals, and
// pairwise Jaccard similarity of matched-seed sets.
//
// Usage: node compare-runs.mjs <run-dir> <run-dir> [...] [--json]

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

export function loadRun(dir) {
  const scorePath = join(dir, 'score.json');
  if (!existsSync(scorePath)) {
    throw new Error(`${dir}: no score.json (did run-eval finish?)`);
  }
  const score = JSON.parse(readFileSync(scorePath, 'utf8'));
  if (score.mode === 'remediate') {
    throw new Error(
      `${dir}: score.json is a remediate-mode result (no matched/missed); compare-runs only compares audit-mode runs`
    );
  }
  const metaPath = join(dir, 'run-meta.yaml');
  const meta = existsSync(metaPath) ? parse(readFileSync(metaPath, 'utf8')) : {};
  const label =
    meta.platform && meta.model
      ? `${meta.platform}/${meta.model}/${meta.effort ?? '?'}`
      : basename(dir);
  return { dir, label, meta, score };
}

export function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return +(inter / (A.size + B.size - inter)).toFixed(3);
}

export function compare(runs) {
  const fixtures = new Set(runs.map((r) => r.score.fixture));
  if (fixtures.size > 1) {
    throw new Error(`runs span different fixtures: ${[...fixtures].join(', ')}`);
  }

  const allSeeds = new Set();
  for (const r of runs) {
    for (const m of r.score.matched) allSeeds.add(m.id);
    for (const m of r.score.missed) allSeeds.add(m.id);
  }

  const seeds = [...allSeeds].sort().map((id) => ({
    id,
    hits: runs.map((r) => {
      const m = r.score.matched.find((x) => x.id === id);
      return m ? m.concern : null;
    }),
  }));

  const pairs = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      pairs.push({
        a: runs[i].label,
        b: runs[j].label,
        jaccard: jaccard(
          runs[i].score.matched.map((m) => m.id),
          runs[j].score.matched.map((m) => m.id)
        ),
      });
    }
  }

  return {
    fixture: runs[0].score.fixture,
    runs: runs.map((r) => ({ label: r.label, totals: r.score.totals })),
    seeds,
    pairwise_jaccard: pairs,
  };
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const asJson = process.argv.includes('--json');
  if (args.length < 2) {
    console.error('Usage: compare-runs.mjs <run-dir> <run-dir> [...] [--json]');
    process.exit(2);
  }

  const runs = args.map(loadRun);
  const result = compare(runs);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`fixture: ${result.fixture}\n`);
  const labelWidth = Math.max(...result.runs.map((r) => r.label.length));
  for (const r of result.runs) {
    const t = r.totals;
    console.log(
      `${r.label.padEnd(labelWidth)}  recall ${t.matched}/${t.expected}` +
        `  fp ${t.false_positives}  unexpected ${t.unexpected}  calib ${t.calibration_misses}`
    );
  }
  console.log('');
  const idWidth = Math.max(...result.seeds.map((s) => s.id.length), 4);
  console.log(`${'seed'.padEnd(idWidth)}  ${result.runs.map((r) => r.label).join('  ')}`);
  for (const s of result.seeds) {
    const cells = s.hits.map((h, i) =>
      (h ?? '—').padEnd(result.runs[i].label.length)
    );
    console.log(`${s.id.padEnd(idWidth)}  ${cells.join('  ')}`);
  }
  console.log('');
  for (const p of result.pairwise_jaccard) {
    console.log(`jaccard(${p.a}, ${p.b}) = ${p.jaccard}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
