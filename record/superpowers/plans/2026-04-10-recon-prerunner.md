# Recon Pre-Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bash + node pipeline (`src/recon/recon` + `src/recon/recon-to-yaml.mjs`) that emits a schema-validated `recon.yaml` for Rust projects, replacing the per-audit hand-gathering in Phase 1 of SKILL.md.

**Architecture:** Bash orchestrator runs `cargo metadata`, `tokei`, and a single `git log` pass; writes raw outputs to a temp dir. Node assembler reads the temp dir, parses raw outputs with pure functions (testable in isolation), builds the recon object, validates against `src/schemas/recon.schema.json` via `ajv`, and emits YAML. One git fork replaces the 180-fork sparkline loop.

**Tech Stack:** bash (POSIX + mktemp + trap), Node ESM, `ajv` + `ajv-formats` + `yaml` npm packages (already in the tree via build-report.mjs), `cargo metadata`, `tokei`, `git log`.

**Spec:** `record/superpowers/specs/2026-04-10-recon-prerunner-design.md`

**Branch:** `feat/recon-prerunner` (continues from the spec commit)

**Clay's commit flow:** Each task's final step says "stage files and write `commit.txt`". Do NOT run `git commit` yourself — write `commit.txt` with the suggested message and wait for Clay to run `gtxt` (`git commit -F commit.txt && rm commit.txt`). This is the hard rule. Never commit for Clay.

---

## File Structure

**Create:**
- `src/recon/recon` — bash orchestrator, executable, ~150 lines
- `src/recon/recon-to-yaml.mjs` — node assembler, ~300 lines, exports pure functions + guarded CLI entry
- `test/recon-to-yaml.test.mjs` — node test runner suite, ~200 lines
- `test/fixtures/recon/metadata.json` — hand-authored 3-crate workspace metadata
- `test/fixtures/recon/tokei.json` — known file/line counts covering the 3 crates
- `test/fixtures/recon/git-log.raw` — 8-commit fixture spanning known months
- `test/fixtures/recon/manifest.json` — known meta fields with deterministic `window_start`

**Modify:**
- `skills/cased/SKILL.md` — Phase 1 calls the pre-runner instead of describing hand-gathering
- `scripts/build-viewer.sh` — copy `src/recon/*` into `skills/cased/scripts/`
- `justfile` — add `recon` recipe

**Do not touch:**
- `src/schemas/recon.schema.json` — already canonical; consumed read-only by the validator
- `src/viewer/build-report.mjs` — unrelated
- `skills/crustoleum/*` — unrelated (the schema sync was a prior task)

**Import management:** ESM requires all `import` statements at the top of the file. Tasks 2–7 add new functions incrementally and reference additional symbols from `node:fs`, `node:path`, `node:url`, `ajv`, `ajv-formats`, and `yaml`. When a task instructs you to "append" a function that uses a new import, **place the `import` statement in the file's top-level import block** (merging with any existing import from the same module — e.g., `import { dirname, basename } from 'node:path'` instead of two separate lines) and place the function body at the end of the file. Don't let duplicate imports accumulate.

---

### Task 1: Test fixtures

**Files:**
- Create: `test/fixtures/recon/metadata.json`
- Create: `test/fixtures/recon/tokei.json`
- Create: `test/fixtures/recon/git-log.raw`
- Create: `test/fixtures/recon/manifest.json`

These are data files, not code. No TDD cycle — hand-author with known values that downstream tests will assert against.

- [ ] **Step 1: Create `test/fixtures/recon/manifest.json`**

This is the bash→node handoff file. Fixed values so tests are deterministic.

```json
{
  "commit": "abc0001def2345678901234567890123456789ab",
  "short_sha": "abc0001",
  "timestamp": "2026-04-10T14:30:00-04:00",
  "target_path": "/tmp/sample-rust-workspace",
  "audit_dir": "/tmp/sample-audit",
  "window_start": "2025-05-01T00:00:00-04:00",
  "window_end": "2026-04-10T14:30:00-04:00",
  "recent_cutoff": "2026-03-11T14:30:00-04:00",
  "scope": "full working tree at abc0001"
}
```

- [ ] **Step 2: Create `test/fixtures/recon/metadata.json`**

Represents a 3-crate workspace: `sample-core`, `sample-cli` (depends on core + clap), `sample-macros` (dev-dep of core). This exercises workspace members, direct deps, and dev deps.

```json
{
  "workspace_root": "/tmp/sample-rust-workspace",
  "workspace_members": [
    "path+file:///tmp/sample-rust-workspace/core#sample-core@0.1.0",
    "path+file:///tmp/sample-rust-workspace/cli#sample-cli@0.1.0",
    "path+file:///tmp/sample-rust-workspace/macros#sample-macros@0.1.0"
  ],
  "packages": [
    {
      "name": "sample-core",
      "version": "0.1.0",
      "id": "path+file:///tmp/sample-rust-workspace/core#sample-core@0.1.0",
      "manifest_path": "/tmp/sample-rust-workspace/core/Cargo.toml",
      "dependencies": [
        { "name": "serde", "req": "^1.0", "kind": null, "optional": false },
        { "name": "sample-macros", "req": "0.1.0", "kind": "dev", "optional": false }
      ]
    },
    {
      "name": "sample-cli",
      "version": "0.1.0",
      "id": "path+file:///tmp/sample-rust-workspace/cli#sample-cli@0.1.0",
      "manifest_path": "/tmp/sample-rust-workspace/cli/Cargo.toml",
      "dependencies": [
        { "name": "sample-core", "req": "0.1.0", "kind": null, "optional": false },
        { "name": "clap", "req": "^4.0", "kind": null, "optional": false },
        { "name": "anyhow", "req": "^1.0", "kind": null, "optional": true }
      ]
    },
    {
      "name": "sample-macros",
      "version": "0.1.0",
      "id": "path+file:///tmp/sample-rust-workspace/macros#sample-macros@0.1.0",
      "manifest_path": "/tmp/sample-rust-workspace/macros/Cargo.toml",
      "dependencies": [
        { "name": "syn", "req": "^2.0", "kind": null, "optional": false },
        { "name": "quote", "req": "^1.0", "kind": "build", "optional": false }
      ]
    }
  ]
}
```

Expected dependencies.items[] after extraction (deduped across members, workspace-internal excluded):

- `serde ^1.0 direct`
- `clap ^4.0 direct`
- `anyhow ^1.0 optional`
- `syn ^2.0 direct`
- `quote ^1.0 build`

(Five total; `sample-core` and `sample-macros` are excluded as workspace-internal.)

- [ ] **Step 3: Create `test/fixtures/recon/tokei.json`**

Tokei JSON shape (abbreviated to what the parser reads). Lines/files chosen so each crate has a distinct fingerprint.

```json
{
  "Rust": {
    "blanks": 50,
    "code": 600,
    "comments": 100,
    "files": 6,
    "reports": [
      { "name": "/tmp/sample-rust-workspace/core/src/lib.rs",      "stats": { "blanks": 15, "code": 200, "comments": 30 } },
      { "name": "/tmp/sample-rust-workspace/core/src/auth.rs",     "stats": { "blanks": 10, "code": 150, "comments": 20 } },
      { "name": "/tmp/sample-rust-workspace/cli/src/main.rs",      "stats": { "blanks": 10, "code": 120, "comments": 25 } },
      { "name": "/tmp/sample-rust-workspace/cli/src/args.rs",      "stats": { "blanks": 5,  "code": 60,  "comments": 10 } },
      { "name": "/tmp/sample-rust-workspace/macros/src/lib.rs",    "stats": { "blanks": 8,  "code": 50,  "comments": 10 } },
      { "name": "/tmp/sample-rust-workspace/macros/src/derive.rs", "stats": { "blanks": 2,  "code": 20,  "comments": 5  } }
    ]
  },
  "Toml": {
    "blanks": 10,
    "code": 40,
    "comments": 5,
    "files": 4,
    "reports": [
      { "name": "/tmp/sample-rust-workspace/Cargo.toml",           "stats": { "blanks": 2, "code": 8, "comments": 1 } },
      { "name": "/tmp/sample-rust-workspace/core/Cargo.toml",      "stats": { "blanks": 3, "code": 12, "comments": 2 } },
      { "name": "/tmp/sample-rust-workspace/cli/Cargo.toml",       "stats": { "blanks": 3, "code": 12, "comments": 1 } },
      { "name": "/tmp/sample-rust-workspace/macros/Cargo.toml",    "stats": { "blanks": 2, "code": 8, "comments": 1 } }
    ]
  },
  "Total": {
    "blanks": 60,
    "code": 640,
    "comments": 105,
    "files": 10,
    "reports": []
  }
}
```

Expected structure totals:
- `total_files: 10`
- `total_lines: 805` (sum of blanks+code+comments across Rust+Toml; 60+640+105 = 805)
- `languages[0]: { language: "Rust", files: 6, lines: 750, percentage: 93.17 }` (750 = 50+600+100)
- `languages[1]: { language: "Toml", files: 4, lines: 55, percentage: 6.83 }`

Expected per-module file/line counts (from path-prefix filtering):
- `sample-core` (path `/tmp/sample-rust-workspace/core`): 3 files (lib.rs, auth.rs, Cargo.toml), 442 lines (245+180+17)
- `sample-cli` (path `/tmp/sample-rust-workspace/cli`): 3 files, 246 lines (155+75+16)
- `sample-macros` (path `/tmp/sample-rust-workspace/macros`): 3 files, 106 lines (68+27+11)

- [ ] **Step 4: Create `test/fixtures/recon/git-log.raw`**

8 commits spanning 11 months, covering: recent activity (within 30 days of `recent_cutoff`), outside-recent but inside-window, four distinct files, multiple authors, and empty file list (merge commit).

Window: 2025-05-01 → 2026-04-10. Recent cutoff: 2026-03-11.

```
---
abc0001 2026-04-05 10:00:00 -0400 Alice Example
src/auth.rs
src/common.rs

---
abc0002 2026-04-03 09:30:00 -0400 Bob Example
src/auth.rs

---
abc0003 2026-03-20 14:15:00 -0400 Alice Example
src/common.rs

---
abc0004 2026-02-15 12:00:00 -0500 Alice Example
src/auth.rs
tests/auth.rs

---
abc0005 2026-02-10 11:00:00 -0500 Bob Example
src/db.rs

---
abc0006 2026-01-05 16:30:00 -0500 Carol Example
src/auth.rs
src/db.rs

---
abc0007 2025-11-20 10:00:00 -0500 Alice Example

---
abc0008 2025-06-15 09:45:00 -0400 Bob Example
src/auth.rs
```

The `abc0007` record has no file list — simulates a merge commit that `git log --name-only` renders empty. The parser must handle this gracefully (count the commit for `recentActivity` only if within the 30-day window, skip file updates).

**Expected hotspots** (sorted by commit count descending):

| rank | path           | commits | authors | last_touched | monthly_commits index→count     |
|------|----------------|---------|---------|--------------|----------------------------------|
| 1    | src/auth.rs    | 5       | 3       | 2026-04-05   | `[0,1,0,0,0,0,0,0,1,1,0,2]`     |
| 2    | src/db.rs      | 2       | 2       | 2026-02-10   | `[0,0,0,0,0,0,0,0,1,1,0,0]`     |
| 3    | src/common.rs  | 2       | 1       | 2026-04-05   | `[0,0,0,0,0,0,0,0,0,0,1,1]`     |
| 4    | tests/auth.rs  | 1       | 1       | 2026-02-15   | `[0,0,0,0,0,0,0,0,0,1,0,0]`     |

Window months (12 slots, oldest-first):
- 0: 2025-05, 1: 2025-06, 2: 2025-07, 3: 2025-08, 4: 2025-09, 5: 2025-10
- 6: 2025-11, 7: 2025-12, 8: 2026-01, 9: 2026-02, 10: 2026-03, 11: 2026-04

**Expected recent_activity** (commits on or after 2026-03-11):
- `abc0001` (2026-04-05, Alice, auth + common)
- `abc0002` (2026-04-03, Bob, auth)
- `abc0003` (2026-03-20, Alice, common)

```
recent_activity:
  total_commits: 3
  active_authors: 2   # {Alice, Bob}
  files_changed: 2    # {src/auth.rs, src/common.rs}
```

- [ ] **Step 5: Stage fixtures and write commit.txt**

```bash
git add test/fixtures/recon/
```

Write `commit.txt`:

```
test(recon): add fixtures for recon-to-yaml parser tests

Four fixture files drive the unit tests for the node side of
the recon pre-runner:

- manifest.json: the bash-to-node handoff shape with a fixed
  window_start (2025-05-01) and recent_cutoff (2026-03-11) so
  month bucketing and recent_activity are deterministic
- metadata.json: a 3-crate workspace (sample-core, sample-cli,
  sample-macros) covering direct/dev/build/optional deps and
  workspace-internal dep exclusion
- tokei.json: known file/line counts across Rust and Toml so
  language percentages and per-module filtering are verifiable
- git-log.raw: 8 commits spanning 11 months including a merge
  commit with empty file list; expected hotspot ordering and
  sparkline values are documented in the plan
```

Wait for Clay to run `gtxt`.

---

### Task 2: parseGitLog function (TDD)

**Files:**
- Create: `src/recon/recon-to-yaml.mjs` (new; add parser stub and export)
- Create: `test/recon-to-yaml.test.mjs`
- Test: `test/recon-to-yaml.test.mjs` (the file you're creating)

- [ ] **Step 1: Write the failing test for parseGitLog**

Create `test/recon-to-yaml.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseGitLog } from '../src/recon/recon-to-yaml.mjs';

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
```

Create the stub module `src/recon/recon-to-yaml.mjs`:

```js
// src/recon/recon-to-yaml.mjs
//
// Assembles recon.yaml from the raw tool outputs written by
// src/recon/recon. Pure-function parsers for each input plus a
// build step that combines them into a schema-valid recon object.
// Validation runs via ajv against src/schemas/recon.schema.json.
//
// The CLI entry point at the bottom is guarded so tests can import
// the parser functions without triggering the build pipeline.

export function parseGitLog(raw, opts) {
  throw new Error('parseGitLog: not implemented');
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: FAIL with `parseGitLog: not implemented`.

- [ ] **Step 3: Implement parseGitLog**

Replace the stub in `src/recon/recon-to-yaml.mjs`:

```js
/**
 * Parse `git log --since=... -M --format='---%n%H %ai %an' --name-only`
 * output into hotspot stats and recent-activity summary.
 *
 * @param {string} raw - the complete git log output
 * @param {{ windowStart: Date, recentCutoff: Date }} opts
 * @returns {{
 *   hotspots: Array<{
 *     path: string,
 *     commits: number,
 *     authors: number,
 *     last_touched: string,
 *     monthly_commits: number[]
 *   }>,
 *   recent_activity: {
 *     total_commits: number,
 *     active_authors: number,
 *     files_changed: number
 *   }
 * }}
 */
export function parseGitLog(raw, { windowStart, recentCutoff }) {
  const records = splitRecords(raw);

  const fileStats = new Map();
  const recent = {
    commits: new Set(),
    authors: new Set(),
    files: new Set(),
  };

  for (const record of records) {
    const { sha, date, author, files } = record;
    if (!sha) continue;

    const commitDate = new Date(date);
    if (commitDate >= recentCutoff) {
      recent.commits.add(sha);
      recent.authors.add(author);
      for (const f of files) recent.files.add(f);
    }

    const monthIndex = monthBucket(commitDate, windowStart);
    if (monthIndex < 0 || monthIndex > 11) continue;

    for (const f of files) {
      let stats = fileStats.get(f);
      if (!stats) {
        stats = {
          commits: 0,
          authors: new Set(),
          last_touched: '',
          monthly: new Array(12).fill(0),
        };
        fileStats.set(f, stats);
      }
      stats.commits += 1;
      stats.authors.add(author);
      stats.monthly[monthIndex] += 1;
      const iso = commitDate.toISOString().slice(0, 10);
      if (iso > stats.last_touched) stats.last_touched = iso;
    }
  }

  const hotspots = [...fileStats.entries()]
    .sort((a, b) => b[1].commits - a[1].commits || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([path, stats]) => ({
      path,
      commits: stats.commits,
      authors: stats.authors.size,
      last_touched: stats.last_touched,
      monthly_commits: stats.monthly,
    }));

  return {
    hotspots,
    recent_activity: {
      total_commits: recent.commits.size,
      active_authors: recent.authors.size,
      files_changed: recent.files.size,
    },
  };
}

/**
 * Split the git log output into records. Each record starts with a
 * header line (`<sha> <iso-date> <author-name>`) after the `---`
 * separator. Files follow on subsequent lines until the next `---`
 * or end of input.
 */
function splitRecords(raw) {
  const lines = raw.split('\n');
  const records = [];
  let current = null;

  for (const line of lines) {
    if (line === '---') {
      if (current) records.push(current);
      current = null;
      continue;
    }
    if (current === null) {
      // First non-empty line after --- is the header.
      if (line.trim() === '') continue;
      const match = line.match(
        /^([0-9a-f]+) (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}) (.+)$/
      );
      if (!match) {
        current = null;
        continue;
      }
      current = {
        sha: match[1],
        date: match[2],
        author: match[3],
        files: [],
      };
      continue;
    }
    if (line.trim() === '') continue;
    current.files.push(line);
  }
  if (current) records.push(current);
  return records;
}

/**
 * Compute the 0-indexed month bucket for a commit, relative to
 * windowStart. Index 0 = month of windowStart; increments by 1 per
 * calendar month.
 */
function monthBucket(commitDate, windowStart) {
  const yearDiff = commitDate.getUTCFullYear() - windowStart.getUTCFullYear();
  const monthDiff = commitDate.getUTCMonth() - windowStart.getUTCMonth();
  return yearDiff * 12 + monthDiff;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: 5 subtests pass under `parseGitLog`.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): add parseGitLog for hotspots and recent_activity

Single-pass parser over `git log --since=12.months.ago -M
--format='---%n%H %ai %an' --name-only` output. Maintains a
per-file map of commits, unique authors, last_touched date, and
a 12-element monthly sparkline oldest-first. Builds hotspots by
sorting descending and taking the top 15. Computes recent_activity
as a 30-day window relative to the script's start timestamp.

Handles merge commits with empty file lists (the record is still
counted toward recent_activity if within the window, but no file
stats are updated). Month bucketing uses (year*12 + month) diffs
so calendar math is not affected by short vs long months.

Tests use deterministic fixtures (window_start = 2025-05-01,
recent_cutoff = 2026-03-11) so the parser is verifiable without
invoking git.
```

Wait for Clay to run `gtxt`.

---

### Task 3: parseTokei function (TDD)

**Files:**
- Modify: `src/recon/recon-to-yaml.mjs` (add `parseTokei` export)
- Modify: `test/recon-to-yaml.test.mjs` (add describe block)

- [ ] **Step 1: Write the failing test**

Append to `test/recon-to-yaml.test.mjs`:

```js
import { parseTokei } from '../src/recon/recon-to-yaml.mjs';

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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: new subtests fail with `parseTokei is not a function`.

- [ ] **Step 3: Implement parseTokei**

Append to `src/recon/recon-to-yaml.mjs`:

```js
/**
 * Aggregate tokei JSON output into recon structure fields. Returns
 * total file and line counts, a languages[] array with percentages,
 * and a flat file index for downstream per-module filtering.
 *
 * @param {object} tokei - parsed tokei JSON (output of `tokei --output json`)
 * @returns {{
 *   total_files: number,
 *   total_lines: number,
 *   languages: Array<{ language: string, files: number, lines: number, percentage: number }>,
 *   files: Array<{ path: string, lines: number }>
 * }}
 */
export function parseTokei(tokei) {
  let totalFiles = 0;
  let totalLines = 0;
  const languages = [];
  const files = [];

  for (const [language, data] of Object.entries(tokei)) {
    if (language === 'Total') continue;
    const lines = (data.blanks || 0) + (data.code || 0) + (data.comments || 0);
    totalFiles += data.files || 0;
    totalLines += lines;
    languages.push({ language, files: data.files || 0, lines });
    for (const report of data.reports || []) {
      const fileLines =
        (report.stats.blanks || 0) +
        (report.stats.code || 0) +
        (report.stats.comments || 0);
      files.push({ path: report.name, lines: fileLines });
    }
  }

  for (const lang of languages) {
    lang.percentage = totalLines === 0
      ? 0
      : Math.round((lang.lines / totalLines) * 10000) / 100;
  }

  return {
    total_files: totalFiles,
    total_lines: totalLines,
    languages,
    files,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: `parseTokei` subtests pass; prior `parseGitLog` tests still pass.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): add parseTokei for structure totals and per-file index

Aggregates tokei JSON into total file/line counts and a languages[]
array with percentages (two decimal places, Math.round-based to
avoid floating-point noise). Also returns a flat files[] index so
downstream code can compute per-module counts by filtering paths
against each workspace member's directory prefix.

Skips the Total key since tokei already emits aggregated totals
there; recomputing from per-language data matches what the schema
expects and avoids double-counting.
```

---

### Task 4: parseMetadata function (TDD)

**Files:**
- Modify: `src/recon/recon-to-yaml.mjs` (add `parseMetadata`)
- Modify: `test/recon-to-yaml.test.mjs` (add describe block)

- [ ] **Step 1: Write the failing test**

Append to `test/recon-to-yaml.test.mjs`:

```js
import { parseMetadata } from '../src/recon/recon-to-yaml.mjs';

describe('parseMetadata', () => {
  const metadataJson = JSON.parse(
    readFileSync(join(fixtures, 'metadata.json'), 'utf8')
  );
  const result = parseMetadata(metadataJson);

  it('extracts workspace members as modules', () => {
    assert.equal(result.modules.length, 3);
    const names = result.modules.map(m => m.name).sort();
    assert.deepEqual(names, ['sample-cli', 'sample-core', 'sample-macros']);
  });

  it('sets module paths to the directory containing Cargo.toml', () => {
    const core = result.modules.find(m => m.name === 'sample-core');
    assert.equal(core.path, '/tmp/sample-rust-workspace/core');
  });

  it('extracts direct dependencies and deduplicates', () => {
    assert.equal(result.dependencies.length, 5);
    const names = result.dependencies.map(d => d.name).sort();
    assert.deepEqual(names, ['anyhow', 'clap', 'quote', 'serde', 'syn']);
  });

  it('maps kind correctly and excludes workspace-internal deps', () => {
    const serde = result.dependencies.find(d => d.name === 'serde');
    assert.equal(serde.kind, 'direct');
    assert.equal(serde.version, '^1.0');

    const quote = result.dependencies.find(d => d.name === 'quote');
    assert.equal(quote.kind, 'build');

    const anyhow = result.dependencies.find(d => d.name === 'anyhow');
    assert.equal(anyhow.kind, 'optional');

    // sample-core and sample-macros are workspace members; never in deps
    assert.equal(
      result.dependencies.find(d => d.name === 'sample-core'),
      undefined
    );
    assert.equal(
      result.dependencies.find(d => d.name === 'sample-macros'),
      undefined
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: new subtests fail with `parseMetadata is not a function`.

- [ ] **Step 3: Implement parseMetadata**

Append to `src/recon/recon-to-yaml.mjs`:

```js
/**
 * Extract workspace modules and direct dependencies from cargo
 * metadata JSON. Workspace-internal dependencies are excluded.
 *
 * @param {object} metadata - parsed output of `cargo metadata --no-deps --format-version 1`
 * @returns {{
 *   workspace_root: string,
 *   modules: Array<{ name: string, path: string, manifest_path: string }>,
 *   dependencies: Array<{ name: string, version: string, kind: string }>
 * }}
 */
export function parseMetadata(metadata) {
  const memberIds = new Set(metadata.workspace_members || []);
  const memberNames = new Set();
  const modules = [];

  for (const pkg of metadata.packages || []) {
    if (!memberIds.has(pkg.id)) continue;
    memberNames.add(pkg.name);
    modules.push({
      name: pkg.name,
      path: dirname(pkg.manifest_path),
      manifest_path: pkg.manifest_path,
    });
  }

  const seen = new Map();
  for (const pkg of metadata.packages || []) {
    if (!memberIds.has(pkg.id)) continue;
    for (const dep of pkg.dependencies || []) {
      if (memberNames.has(dep.name)) continue;
      const kind = mapDepKind(dep);
      const key = `${dep.name}@${dep.req}@${kind}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        name: dep.name,
        version: dep.req,
        kind,
      });
    }
  }

  return {
    workspace_root: metadata.workspace_root,
    modules,
    dependencies: [...seen.values()],
  };
}

function mapDepKind(dep) {
  if (dep.optional === true) return 'optional';
  switch (dep.kind) {
    case 'dev': return 'dev';
    case 'build': return 'build';
    case null:
    case undefined:
    case 'normal':
      return 'direct';
    default:
      return 'direct';
  }
}
```

You'll need to add `dirname` to the node:path import at the top of the file. Change the top of `src/recon/recon-to-yaml.mjs` so the imports include:

```js
import { dirname } from 'node:path';
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: `parseMetadata` subtests pass; all prior tests still pass.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): add parseMetadata for workspace modules and deps

Walks cargo metadata's packages array filtered by workspace_members
to produce one module per workspace crate and a deduplicated
dependency list. Workspace-internal deps are excluded (identified
by matching package name against the set of workspace member
package names, not by id — dep records use bare names without the
full package id).

Kind mapping: null/"normal" → "direct", "dev" → "dev",
"build" → "build". Optional overrides any kind to "optional" since
the schema enum does not model kind+optional as separate axes.

Version is the req string (e.g., "^1.0") rather than a locked
version: cargo metadata --no-deps intentionally omits the resolve
graph, and the schema's string type accommodates either form.
```

---

### Task 5: buildReconObject assembly (TDD)

**Files:**
- Modify: `src/recon/recon-to-yaml.mjs` (add `buildReconObject`)
- Modify: `test/recon-to-yaml.test.mjs` (add describe block)

- [ ] **Step 1: Write the failing test**

Append to `test/recon-to-yaml.test.mjs`:

```js
import { buildReconObject } from '../src/recon/recon-to-yaml.mjs';

describe('buildReconObject', () => {
  const manifest = loadManifest();
  const metadataJson = JSON.parse(readFileSync(join(fixtures, 'metadata.json'), 'utf8'));
  const tokeiJson = JSON.parse(readFileSync(join(fixtures, 'tokei.json'), 'utf8'));
  const gitLogRaw = readFileSync(join(fixtures, 'git-log.raw'), 'utf8');

  const recon = buildReconObject({
    manifest,
    metadata: metadataJson,
    tokei: tokeiJson,
    gitLog: gitLogRaw,
  });

  it('populates meta from manifest', () => {
    assert.equal(recon.meta.commit, manifest.commit);
    assert.equal(recon.meta.timestamp, manifest.timestamp);
    assert.equal(recon.meta.scope, manifest.scope);
  });

  it('sets meta.project from cargo workspace root package name or root dir', () => {
    // The fixture's workspace_root has no root package, so fall back
    // to the directory basename.
    assert.equal(recon.meta.project, 'sample-rust-workspace');
  });

  it('populates structure with tokei totals and cargo modules', () => {
    assert.equal(recon.structure.root, manifest.target_path);
    assert.equal(recon.structure.total_files, 10);
    assert.equal(recon.structure.total_lines, 805);
    assert.equal(recon.structure.modules.length, 3);
  });

  it('computes per-module file and line counts by path-prefix filter', () => {
    const core = recon.structure.modules.find(m => m.name === 'sample-core');
    assert.equal(core.files, 3);
    assert.equal(core.lines, 442); // 245 + 180 + 17
  });

  it('populates dependencies', () => {
    assert.equal(recon.dependencies.manifest,
      '/tmp/sample-rust-workspace/Cargo.toml');
    assert.equal(recon.dependencies.items.length, 5);
  });

  it('populates churn with hotspots and recent_activity', () => {
    assert.equal(recon.churn.period, 'last 12 months');
    assert.equal(recon.churn.hotspots.length, 4);
    assert.equal(recon.churn.hotspots[0].path, 'src/auth.rs');
    assert.equal(recon.churn.recent_activity.total_commits, 3);
  });

  it('does not include boundaries (agent-owned)', () => {
    assert.equal(recon.boundaries, undefined);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: new subtests fail with `buildReconObject is not a function`.

- [ ] **Step 3: Implement buildReconObject**

Append to `src/recon/recon-to-yaml.mjs`:

```js
import { basename } from 'node:path';

/**
 * Combine parsed inputs into a complete recon object matching
 * src/schemas/recon.schema.json. Does not validate — that happens
 * in the separate validateRecon step.
 */
export function buildReconObject({ manifest, metadata, tokei, gitLog }) {
  const meta = buildMeta(manifest, metadata);
  const parsedTokei = parseTokei(tokei);
  const parsedMetadata = parseMetadata(metadata);
  const parsedGitLog = parseGitLog(gitLog, {
    windowStart: new Date(manifest.window_start),
    recentCutoff: new Date(manifest.recent_cutoff),
  });

  const structure = {
    root: manifest.target_path,
    total_files: parsedTokei.total_files,
    total_lines: parsedTokei.total_lines,
    languages: parsedTokei.languages,
    modules: parsedMetadata.modules.map(mod => ({
      name: mod.name,
      path: mod.path,
      ...countPerModule(parsedTokei.files, mod.path),
    })),
  };

  const dependencies = {
    manifest: `${parsedMetadata.workspace_root}/Cargo.toml`,
    items: parsedMetadata.dependencies,
  };

  const churn = {
    period: 'last 12 months',
    hotspots: parsedGitLog.hotspots,
    recent_activity: parsedGitLog.recent_activity,
  };

  return { meta, structure, dependencies, churn };
}

function buildMeta(manifest, metadata) {
  // Project name: prefer the package whose manifest_path is the
  // workspace root's Cargo.toml. If no such package exists (pure
  // virtual workspace), fall back to the workspace root directory
  // name.
  const rootManifest = `${metadata.workspace_root}/Cargo.toml`;
  const rootPkg = (metadata.packages || []).find(
    p => p.manifest_path === rootManifest
  );
  const project = rootPkg ? rootPkg.name : basename(metadata.workspace_root);

  return {
    project,
    commit: manifest.commit,
    timestamp: manifest.timestamp,
    scope: manifest.scope,
  };
}

function countPerModule(files, modulePath) {
  const prefix = modulePath.endsWith('/') ? modulePath : modulePath + '/';
  let fileCount = 0;
  let lineCount = 0;
  for (const f of files) {
    if (f.path === modulePath || f.path.startsWith(prefix)) {
      fileCount += 1;
      lineCount += f.lines;
    }
  }
  return { files: fileCount, lines: lineCount };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: `buildReconObject` subtests pass; all prior tests still pass.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): add buildReconObject to combine parsed inputs

Composes the four parsers (manifest, metadata, tokei, git log) into
a complete recon object matching recon.schema.json. Per-module file
and line counts come from filtering the tokei file index by each
workspace member's directory prefix.

Project name resolution prefers the package whose manifest_path is
the workspace root's Cargo.toml; falls back to the workspace root
directory basename for pure virtual workspaces.

Boundaries are left unset (agent-owned per the schema description).
entry_points on modules are also left unset (optional in the schema).
```

---

### Task 6: Schema validation (TDD)

**Files:**
- Modify: `src/recon/recon-to-yaml.mjs` (add `validateRecon`)
- Modify: `test/recon-to-yaml.test.mjs` (add describe block)

- [ ] **Step 1: Write the failing test**

Append to `test/recon-to-yaml.test.mjs`:

```js
import { validateRecon } from '../src/recon/recon-to-yaml.mjs';

describe('validateRecon', () => {
  const manifest = loadManifest();
  const metadataJson = JSON.parse(readFileSync(join(fixtures, 'metadata.json'), 'utf8'));
  const tokeiJson = JSON.parse(readFileSync(join(fixtures, 'tokei.json'), 'utf8'));
  const gitLogRaw = readFileSync(join(fixtures, 'git-log.raw'), 'utf8');

  const recon = buildReconObject({
    manifest, metadata: metadataJson, tokei: tokeiJson, gitLog: gitLogRaw,
  });

  // Resolve the real schema file. Tests run from the repo root so
  // this path is stable.
  const schemaPath = join(here, '..', 'src', 'schemas', 'recon.schema.json');

  it('validates the built object against recon.schema.json', () => {
    const errors = validateRecon(recon, schemaPath);
    assert.deepEqual(errors, []);
  });

  it('returns descriptive errors for a malformed object', () => {
    const broken = JSON.parse(JSON.stringify(recon));
    delete broken.meta.project;
    const errors = validateRecon(broken, schemaPath);
    assert.ok(errors.length > 0);
    assert.ok(
      errors.some(e => e.instancePath === '/meta' || e.schemaPath?.includes('project')),
      'expected an error mentioning the missing project field'
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: new subtests fail with `validateRecon is not a function`.

- [ ] **Step 3: Implement validateRecon**

Append to `src/recon/recon-to-yaml.mjs`. Note: the `ajv` CJS→ESM unwrap
pattern (`.default`) matches `src/viewer/build-report.mjs`; do not remove
the `.default` calls — without them you get `Ajv2020 is not a constructor`.

```js
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

/**
 * Validate a built recon object against recon.schema.json.
 *
 * @param {object} recon - the object returned by buildReconObject
 * @param {string} schemaPath - absolute path to recon.schema.json
 * @returns {Array} ajv error objects; empty array on success
 */
export function validateRecon(recon, schemaPath) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020.default({ allErrors: true, strict: false });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(recon);
  return valid ? [] : validate.errors;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: both `validateRecon` subtests pass; all prior tests still pass.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): validate built recon object against the canonical schema

Uses the same ajv+ajv-formats pattern as build-report.mjs, including
the CJS→ESM .default unwrap for Ajv2020 and addFormats. Returns the
ajv errors array directly so callers can render field paths in any
format they need.

The happy-path test uses the fixture chain (manifest + metadata +
tokei + git-log) to verify the full build-then-validate flow. A
malformed-object test deletes meta.project and asserts an error is
returned, keeping the regression surface small but end-to-end.
```

---

### Task 7: CLI entry point for recon-to-yaml.mjs

**Files:**
- Modify: `src/recon/recon-to-yaml.mjs` (add guarded CLI main)
- Modify: `test/recon-to-yaml.test.mjs` (add end-to-end YAML emission test)

- [ ] **Step 1: Write the failing test**

Append to `test/recon-to-yaml.test.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync as rfs, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';

describe('recon-to-yaml CLI', () => {
  it('reads a tmp dir of raw outputs and emits a valid recon.yaml', () => {
    const work = mkdtempSync(join(tmpdir(), 'recon-test-'));
    // Copy the four fixtures into the work dir under the expected names
    for (const name of ['manifest.json', 'metadata.json', 'tokei.json', 'git-log.raw']) {
      writeFileSync(join(work, name), rfs(join(fixtures, name), 'utf8'));
    }
    const outYaml = join(work, 'recon.yaml');
    const scriptPath = join(here, '..', 'src', 'recon', 'recon-to-yaml.mjs');

    execFileSync('node', [scriptPath, work, outYaml], {
      stdio: 'pipe',
    });

    assert.ok(existsSync(outYaml));
    const parsed = parseYaml(rfs(outYaml, 'utf8'));
    assert.equal(parsed.meta.project, 'sample-rust-workspace');
    assert.equal(parsed.structure.total_files, 10);
    assert.equal(parsed.churn.hotspots[0].path, 'src/auth.rs');
  });

  it('exits 4 on schema validation failure', () => {
    const work = mkdtempSync(join(tmpdir(), 'recon-test-'));
    // Write a manifest that is missing the required `scope` field.
    const badManifest = { ...loadManifest() };
    delete badManifest.scope;
    writeFileSync(join(work, 'manifest.json'), JSON.stringify(badManifest));
    for (const name of ['metadata.json', 'tokei.json', 'git-log.raw']) {
      writeFileSync(join(work, name), rfs(join(fixtures, name), 'utf8'));
    }
    const outYaml = join(work, 'recon.yaml');
    const scriptPath = join(here, '..', 'src', 'recon', 'recon-to-yaml.mjs');

    let code = 0;
    try {
      execFileSync('node', [scriptPath, work, outYaml], { stdio: 'pipe' });
    } catch (err) {
      code = err.status;
    }
    assert.equal(code, 4);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: CLI tests fail because the script has no CLI entry point yet (execFileSync succeeds but writes nothing).

- [ ] **Step 3: Implement the CLI entry point**

Append to `src/recon/recon-to-yaml.mjs`:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { dirname as pathDirname, join as pathJoin, resolve } from 'node:path';
import { stringify as yamlStringify } from 'yaml';

// CLI entry point. Guarded so tests can import the parser functions
// without triggering the build pipeline.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const [, , tmpDir, outYamlPath] = process.argv;
  if (!tmpDir || !outYamlPath) {
    console.error('Usage: node recon-to-yaml.mjs <tmp-dir> <out-yaml-path>');
    process.exit(1);
  }

  try {
    const manifest = JSON.parse(
      readFileSync(pathJoin(tmpDir, 'manifest.json'), 'utf8')
    );
    const metadata = JSON.parse(
      readFileSync(pathJoin(tmpDir, 'metadata.json'), 'utf8')
    );
    const tokei = JSON.parse(
      readFileSync(pathJoin(tmpDir, 'tokei.json'), 'utf8')
    );
    const gitLog = readFileSync(pathJoin(tmpDir, 'git-log.raw'), 'utf8');

    const recon = buildReconObject({ manifest, metadata, tokei, gitLog });

    // Locate the schema. In the source layout, it's at
    // ../../schemas/recon.schema.json relative to this file. In the
    // shipped skill, it's at ../references/recon.schema.json.
    const scriptDir = pathDirname(fileURLToPath(import.meta.url));
    const schemaCandidates = [
      resolve(scriptDir, '..', 'schemas', 'recon.schema.json'),
      resolve(scriptDir, '..', 'references', 'recon.schema.json'),
    ];
    const { existsSync } = await import('node:fs');
    const schemaPath = schemaCandidates.find(p => existsSync(p));
    if (!schemaPath) {
      console.error('error: cannot locate recon.schema.json');
      console.error('  looked near: ' + scriptDir);
      process.exit(3);
    }

    const errors = validateRecon(recon, schemaPath);
    if (errors.length > 0) {
      console.error('recon: validation failed');
      for (const err of errors) {
        console.error(`  ${err.instancePath || '/'}: ${err.message}`);
      }
      process.exit(4);
    }

    mkdirSync(pathDirname(outYamlPath), { recursive: true });
    const yaml = yamlStringify(recon, { indent: 2, lineWidth: 100 });
    writeFileSync(outYamlPath, yaml);

    const sizeKb = (yaml.length / 1024).toFixed(1);
    console.log(`wrote ${outYamlPath} (${sizeKb}KB)`);
  } catch (err) {
    console.error(`recon: ${err.message}`);
    process.exit(3);
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test test/recon-to-yaml.test.mjs`

Expected: all tests pass, including the two new CLI tests.

- [ ] **Step 5: Stage and write commit.txt**

```bash
git add src/recon/recon-to-yaml.mjs test/recon-to-yaml.test.mjs
```

Write `commit.txt`:

```
feat(recon): add CLI entry point for recon-to-yaml.mjs

Takes <tmp-dir> <out-yaml-path> positional args, reads the four
raw outputs (manifest.json, metadata.json, tokei.json, git-log.raw)
from the tmp dir, builds and validates the recon object, and writes
YAML to the out path.

Schema resolution mirrors build-report.mjs: checks ../schemas/ for
the source layout and ../references/ for the shipped skill layout.
Exit codes: 1 (usage error), 3 (tool/schema/IO error), 4 (schema
validation failure).

End-to-end tests invoke the script via execFileSync and parse the
resulting YAML to confirm full-stack correctness. A second test
feeds a manifest missing `scope` to verify the exit-4 path.
```

---

### Task 8: Bash orchestrator

**Files:**
- Create: `src/recon/recon` (bash, executable)

There is no automated test for bash. The manual smoke test in Task 10 verifies this works against a real Rust project.

- [ ] **Step 1: Write the bash script**

Create `src/recon/recon`:

```bash
#!/usr/bin/env bash
#
# Cased recon pre-runner. Gathers the mechanical structural data for
# a Rust project (cargo metadata, tokei, git log) and hands off to
# recon-to-yaml.mjs, which assembles and validates recon.yaml.
#
# Usage:
#   bash src/recon/recon <target-project-dir> <audit-dir>
#
# Exit codes:
#   0  success — <audit-dir>/recon.yaml written and validated
#   1  usage error
#   2  not a Rust project (no Cargo.toml in target)
#   3  required tool missing or tool failed
#   4  validation failure (propagated from recon-to-yaml.mjs)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ $# -ne 2 ]]; then
  echo "Usage: bash $0 <target-project-dir> <audit-dir>" >&2
  exit 1
fi

TARGET="$(cd "$1" 2>/dev/null && pwd || true)"
if [[ -z "$TARGET" ]]; then
  echo "error: target directory does not exist: $1" >&2
  exit 1
fi

AUDIT_DIR_ARG="$2"
mkdir -p "$AUDIT_DIR_ARG"
AUDIT_DIR="$(cd "$AUDIT_DIR_ARG" && pwd)"

# Required tools
for bin in cargo git tokei node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: required tool '$bin' not found in PATH" >&2
    case "$bin" in
      cargo) echo "  install via https://rustup.rs" >&2 ;;
      tokei) echo "  install via 'cargo install tokei'" >&2 ;;
    esac
    exit 3
  fi
done

# Must be a Rust project
if [[ ! -f "$TARGET/Cargo.toml" ]]; then
  echo "recon pre-runner: Rust projects only" >&2
  echo "  no Cargo.toml found in $TARGET" >&2
  exit 2
fi

# Temp dir with trap cleanup
TMP="$(mktemp -d -t cased-recon.XXXXXXXX)"
trap 'rm -rf "$TMP"' EXIT

cd "$TARGET"

# Capture meta before running tools so window_start/recent_cutoff
# use the same reference point.
COMMIT="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short=7 HEAD)"
TIMESTAMP="$(date +"%Y-%m-%dT%H:%M:%S%z" | sed 's/\(..\)$/:\1/')"

# Window computation (BSD/macOS `date` compatible)
WINDOW_START="$(date -v-12m +"%Y-%m-01T00:00:00%z" | sed 's/\(..\)$/:\1/')"
WINDOW_END="$TIMESTAMP"
RECENT_CUTOFF="$(date -v-30d +"%Y-%m-%dT%H:%M:%S%z" | sed 's/\(..\)$/:\1/')"

echo "recon: gathering cargo metadata"
if ! cargo metadata --no-deps --format-version 1 > "$TMP/metadata.json" 2> "$TMP/cargo.err"; then
  echo "recon: cargo metadata failed:" >&2
  cat "$TMP/cargo.err" >&2
  exit 3
fi

echo "recon: counting files with tokei"
if ! tokei --output json > "$TMP/tokei.json" 2> "$TMP/tokei.err"; then
  echo "recon: tokei failed:" >&2
  cat "$TMP/tokei.err" >&2
  exit 3
fi

echo "recon: parsing 12 months of git history"
if ! git log \
  --since='12 months ago' \
  -M \
  --format='---%n%H %ai %an' \
  --name-only \
  > "$TMP/git-log.raw" \
  2> "$TMP/git.err"; then
  echo "recon: git log failed in $TARGET. Is this a git repository?" >&2
  cat "$TMP/git.err" >&2
  exit 3
fi

# Write manifest.json by hand. No jq dependency.
cat > "$TMP/manifest.json" <<EOF
{
  "commit": "$COMMIT",
  "short_sha": "$SHORT_SHA",
  "timestamp": "$TIMESTAMP",
  "target_path": "$TARGET",
  "audit_dir": "$AUDIT_DIR",
  "window_start": "$WINDOW_START",
  "window_end": "$WINDOW_END",
  "recent_cutoff": "$RECENT_CUTOFF",
  "scope": "full working tree at $SHORT_SHA"
}
EOF

echo "recon: building recon.yaml"
exec node "$SCRIPT_DIR/recon-to-yaml.mjs" "$TMP" "$AUDIT_DIR/recon.yaml"
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x src/recon/recon
```

- [ ] **Step 3: Syntax-check the script**

```bash
bash -n src/recon/recon
```

Expected: no output (successful parse).

- [ ] **Step 4: Verify usage message**

```bash
bash src/recon/recon 2>&1 || true
```

Expected: `Usage: bash src/recon/recon <target-project-dir> <audit-dir>` on stderr, exit 1.

- [ ] **Step 5: Verify non-Rust exit**

```bash
mkdir -p /tmp/recon-test-empty && bash src/recon/recon /tmp/recon-test-empty /tmp/recon-test-out 2>&1 || true
rm -rf /tmp/recon-test-empty /tmp/recon-test-out
```

Expected: `recon pre-runner: Rust projects only` on stderr, exit 2.

- [ ] **Step 6: Stage and write commit.txt**

```bash
git add src/recon/recon
```

Write `commit.txt`:

```
feat(recon): add bash orchestrator for the recon pre-runner

Runs cargo metadata, tokei, and a single git log pass sequentially
and writes raw outputs to a mktemp'd temp dir. Exec's the node
assembler against the temp dir; the trap cleans up on any exit.

All dates use BSD date -v- syntax for macOS compatibility (Clay's
primary platform). Window start is the first-of-month 12 months
back; recent cutoff is 30 days back from now. Both go in
manifest.json for the node parser to consume.

Exit codes match the spec: 0 success, 1 usage, 2 not Rust, 3 tool
failure, 4 validation (propagated from node via exec).
```

---

### Task 9: Add `just recon` recipe

**Files:**
- Modify: `justfile`

- [ ] **Step 1: Append the recipe**

Add to `justfile`:

```makefile
# Run the recon pre-runner against a target Rust project
recon target audit_dir:
    bash src/recon/recon {{target}} {{audit_dir}}
```

- [ ] **Step 2: Verify the recipe parses**

```bash
just --list
```

Expected: the `recon` recipe appears in the listing.

- [ ] **Step 3: Stage and write commit.txt**

```bash
git add justfile
```

Write `commit.txt`:

```
chore(justfile): add recon recipe

Matches the existing build-report and validate recipes: a thin
wrapper around the bash entry point that forwards both positional
args. Removes the need to remember the exact bash path during dev.
```

---

### Task 10: SKILL.md Phase 1 update

**Files:**
- Modify: `skills/cased/SKILL.md` (the Phase 1 section starting around line 89)

- [ ] **Step 1: Read the current Phase 1 section**

```bash
sed -n '85,115p' skills/cased/SKILL.md
```

Compare against the spec's Problem section to confirm the current prose matches what you're replacing.

- [ ] **Step 2: Replace Phase 1 with pre-runner instructions**

Find the section starting `### Phase 1: Reconnaissance` and replace through the end of the "How to gather this data" bullet list (up to but not including `### Phase 2: Analysis`) with:

```markdown
### Phase 1: Reconnaissance

Build the structural model of the codebase. Produce `recon.yaml` in
the audit directory (see File Inventory for the full path convention).

**For Rust projects**, run the pre-runner:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/recon <target-project-dir> <audit-dir>
```

The pre-runner gathers mechanical data (cargo metadata, tokei, git
log with a single-pass 12-month sparkline computation) and writes a
schema-validated `recon.yaml` covering:

- `meta` — project, commit, timestamp, scope
- `structure` — file/line totals, languages, workspace modules
- `dependencies` — direct dependencies with version requirements
- `churn` — top 15 hotspots with 12-month sparklines, 30-day recent activity

Exit codes: `0` success, `2` not a Rust project, `3` tool missing or
failed, `4` validation failure. On exit 2, fall back to gathering
the same data by hand per `${CLAUDE_SKILL_DIR}/references/recon-schema.yaml.md`.

The pre-runner does not populate `boundaries` (agent-owned by schema
design) or `modules[].entry_points` (optional). Add those by editing
the emitted `recon.yaml` if the audit needs them.

**For non-Rust projects**, gather the same data by hand:

- Parse the file tree, count lines, read modification dates
- Static analysis of imports/use statements for the dependency graph
- Read Cargo.toml / package.json / go.mod / requirements.txt for external deps
- Use `git log --format='%H %ai %s' --name-only` for churn analysis
- Identify entry points by convention (main.rs, mod.rs with pub fn, handler functions, exported symbols)

Read `${CLAUDE_SKILL_DIR}/references/recon-schema.yaml.md` for the full schema.
```

- [ ] **Step 3: Verify SKILL.md still reads cleanly**

```bash
sed -n '85,135p' skills/cased/SKILL.md
```

Confirm:
- Phase 1 header is intact
- The pre-runner block precedes the hand-gathering fallback
- Phase 2 section still starts immediately after the Phase 1 block

- [ ] **Step 4: Stage and write commit.txt**

```bash
git add skills/cased/SKILL.md
```

Write `commit.txt`:

```
docs(skill): point Phase 1 at the recon pre-runner

Rust projects now run `bash ${CLAUDE_SKILL_DIR}/scripts/recon
<target> <audit-dir>` instead of gathering structural data by hand.
Non-Rust projects keep the hand-gathering instructions as a
fallback; the pre-runner exits 2 on Cargo.toml absence and that
exit code is the orchestrator's signal to fall back.

Satisfies the 2026-04-09 division-of-labor rule: the orchestrator
no longer reads source files during Phase 1. The pre-runner is
the only thing that touches the target tree.
```

---

### Task 11: build-viewer.sh bundling

**Files:**
- Modify: `scripts/build-viewer.sh`

The shipped skill's scripts/ directory currently only contains
`build-report.js`. The recon pre-runner needs to ship alongside it
so Phase 1's `${CLAUDE_SKILL_DIR}/scripts/recon` path resolves.

- [ ] **Step 1: Read the current build-viewer.sh**

```bash
cat scripts/build-viewer.sh
```

Locate the `=== copying assets to skill directory ===` section.

- [ ] **Step 2: Add the recon copies**

Add these lines to the "copying assets to skill directory" section, after the existing `cp build/build-report.js ...` line:

```bash
cp src/recon/recon              skills/cased/scripts/recon
cp src/recon/recon-to-yaml.mjs  skills/cased/scripts/recon-to-yaml.mjs
chmod +x skills/cased/scripts/recon
```

- [ ] **Step 3: Ensure recon.schema.json is in references/ in the shipped skill**

Check that `src/schemas/build-schemas.sh` already copies `recon.schema.json` into `skills/cased/references/`:

```bash
grep "recon.schema.json" src/schemas/build-schemas.sh
```

Expected: the script's `build_one recon` line handles this via the generic `cp "$schema" "$OUT_DIR/$name.schema.json"` path. If it doesn't, the recon script's node side will fail to resolve the schema at skill-install time.

- [ ] **Step 4: Run the build to verify nothing breaks**

```bash
scripts/build-viewer.sh
```

Expected: the script runs to completion. Verify:

```bash
ls -la skills/cased/scripts/ skills/cased/references/recon.schema.json
```

Expected:
- `skills/cased/scripts/` contains `build-report.js`, `recon`, `recon-to-yaml.mjs`
- `skills/cased/scripts/recon` is executable
- `skills/cased/references/recon.schema.json` exists

- [ ] **Step 5: Stage and write commit.txt**

Do NOT stage `skills/cased/scripts/*` or `skills/cased/references/recon.schema.json` — those are build outputs that get regenerated on each build. Only stage the source changes.

```bash
git add scripts/build-viewer.sh
# If skills/cased/scripts/ or skills/cased/references/ have tracked
# files that need updating, add those too — check with `git status`.
```

Write `commit.txt`:

```
build(viewer): copy recon pre-runner into shipped skill scripts dir

The recon pre-runner is invoked via
${CLAUDE_SKILL_DIR}/scripts/recon from SKILL.md Phase 1, so both
files (the bash entry point and the node assembler) must ship
alongside build-report.js in skills/cased/scripts/.

The recon.schema.json that the node side validates against is
already copied into skills/cased/references/ by the generic
build_one recon path in src/schemas/build-schemas.sh. No change
needed there.
```

---

### Task 12: Manual smoke test against crustoleum

**Files:** none

This is a verification step, not a code change. No commit.

- [ ] **Step 1: Run the pre-runner against crustoleum**

```bash
bash src/recon/recon /Users/clay/source/claylo/crustoleum /tmp/cased-recon-smoke
```

Expected output:
- `recon: gathering cargo metadata`
- `recon: counting files with tokei`
- `recon: parsing 12 months of git history`
- `recon: building recon.yaml`
- `wrote /tmp/cased-recon-smoke/recon.yaml (<N>KB)`
- Exit 0.

- [ ] **Step 2: Validate the emitted recon.yaml manually**

```bash
node src/viewer/build-report.mjs validate /tmp/cased-recon-smoke 2>&1 | head -20
```

Expected: `ok  /tmp/cased-recon-smoke/recon.yaml` (and a findings.yaml warning or error, which is expected since no findings were generated).

Or use the schema validator directly:

```bash
node -e "
import('./src/recon/recon-to-yaml.mjs').then(m => {
  const fs = require('node:fs');
  const { parse } = require('yaml');
  const recon = parse(fs.readFileSync('/tmp/cased-recon-smoke/recon.yaml', 'utf8'));
  const errors = m.validateRecon(recon, './src/schemas/recon.schema.json');
  console.log('errors:', errors.length);
  if (errors.length) console.log(errors);
});
"
```

Expected: `errors: 0`.

- [ ] **Step 3: Inspect the recon.yaml for sanity**

```bash
head -60 /tmp/cased-recon-smoke/recon.yaml
```

Verify:
- `meta.project` matches crustoleum's workspace root package name (or directory name)
- `structure.total_files` is a plausible number for crustoleum
- `structure.modules` lists crustoleum's workspace members
- `dependencies.items` includes crustoleum's direct deps
- `churn.hotspots` has 15 or fewer entries with reasonable sparkline patterns

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/cased-recon-smoke
```

- [ ] **Step 5: Report the smoke test outcome**

If the smoke test passed, mark Task 12 complete and report the sparkline and hotspot results to Clay along with the recon.yaml file size. If it failed, capture the failure mode (which command, what error) and fix in the appropriate earlier task — do not paper over failures at this stage.

---

## Post-Implementation

After all 12 tasks are complete:

1. Run `just test` to confirm all unit tests pass.
2. Confirm `git status` is clean on `feat/recon-prerunner`.
3. Bundle the spec commit (from the prior session) and the 11 implementation commits into a single PR via `git pm`. Clay controls the merge.
4. After merge, close out the 2026-04-10-2142 handoff's "What's next" item #1.
