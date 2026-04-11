import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseGitLog, parseTokei } from '../src/recon/recon-to-yaml.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'recon');

function loadManifest() {
  return JSON.parse(readFileSync(join(fixtures, 'manifest.json'), 'utf8'));
}

describe('parseGitLog', () => {
  const manifest = loadManifest();
  const raw = readFileSync(join(fixtures, 'git-log.raw'), 'utf8');
  const result = parseGitLog(raw, {
    windowStart: new Date(manifest.window_start),
    recentCutoff: new Date(manifest.recent_cutoff),
  });

  it('produces hotspots sorted by commit count descending', () => {
    const paths = result.hotspots.map(h => h.path);
    assert.deepEqual(paths, [
      'src/auth.rs',
      'src/db.rs',
      'src/common.rs',
      'tests/auth.rs',
    ]);
  });

  it('counts commits and unique authors per hotspot', () => {
    const auth = result.hotspots.find(h => h.path === 'src/auth.rs');
    assert.equal(auth.commits, 5);
    assert.equal(auth.authors, 3);
    assert.equal(auth.last_touched, '2026-04-05');
  });

  it('buckets commits into 12-month sparklines, oldest-first', () => {
    const auth = result.hotspots.find(h => h.path === 'src/auth.rs');
    assert.deepEqual(auth.monthly_commits,
      [0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 2]);
  });

  it('computes recent_activity as a 30-day window', () => {
    assert.equal(result.recent_activity.total_commits, 3);
    assert.equal(result.recent_activity.active_authors, 2);
    assert.equal(result.recent_activity.files_changed, 2);
  });

  it('handles merge commits with empty file lists', () => {
    // abc0007 has no files; it should not crash and should not
    // contribute to any hotspot. Covered implicitly by the hotspot
    // count assertions above, but assert explicitly:
    const allPaths = new Set(result.hotspots.map(h => h.path));
    assert.equal(allPaths.has('abc0007'), false);
  });
});

describe('parseTokei', () => {
  const tokeiJson = JSON.parse(
    readFileSync(join(fixtures, 'tokei.json'), 'utf8')
  );
  const result = parseTokei(tokeiJson);

  it('aggregates total files and lines across all languages', () => {
    assert.equal(result.total_files, 10);
    assert.equal(result.total_lines, 805);
  });

  it('builds a languages array with per-language percentages', () => {
    assert.equal(result.languages.length, 2);
    const rust = result.languages.find(l => l.language === 'Rust');
    assert.equal(rust.files, 6);
    assert.equal(rust.lines, 750);
    assert.equal(rust.percentage, 93.17);
  });

  it('exposes a file index for module path-prefix filtering', () => {
    // parseTokei returns { total_files, total_lines, languages, files }
    // where files is Array<{ path, lines }>. Downstream code filters
    // this by path prefix to compute per-module counts.
    assert.ok(Array.isArray(result.files));
    assert.equal(result.files.length, 10);
    const libRs = result.files.find(
      f => f.path === '/tmp/sample-rust-workspace/core/src/lib.rs'
    );
    assert.equal(libRs.lines, 245); // 15 + 200 + 30
  });
});
