// src/recon/recon-to-yaml.mjs
//
// Assembles recon.yaml from the raw tool outputs written by
// src/recon/recon. Pure-function parsers for each input plus a
// build step that combines them into a schema-valid recon object.
// Validation runs via ajv against src/schemas/recon.schema.json.
//
// The CLI entry point at the bottom is guarded so tests can import
// the parser functions without triggering the build pipeline.

import { dirname, basename } from 'node:path';

/**
 * Parse `git log --since=... -M --format='---%n%H %ai %an' --name-only`
 * output into hotspot stats and recent-activity summary.
 *
 * Dates (month bucketing and last_touched) are computed in UTC so that
 * DST transitions and mixed timezone offsets in the git log cannot
 * perturb slot assignment or maximum-date selection.
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
      // UTC date — keeps last_touched consistent with monthBucket's UTC math.
      const iso = commitDate.toISOString().slice(0, 10);
      if (iso > stats.last_touched) stats.last_touched = iso;
    }
  }

  const hotspots = [...fileStats.entries()]
    .sort((a, b) => b[1].commits - a[1].commits || b[0].localeCompare(a[0]))
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
 * calendar month. Uses UTC year/month on both inputs so the bucketing
 * is timezone-invariant.
 */
function monthBucket(commitDate, windowStart) {
  const yearDiff = commitDate.getUTCFullYear() - windowStart.getUTCFullYear();
  const monthDiff = commitDate.getUTCMonth() - windowStart.getUTCMonth();
  return yearDiff * 12 + monthDiff;
}

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
      const s = report.stats || {};
      const fileLines = (s.blanks || 0) + (s.code || 0) + (s.comments || 0);
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
  // optional overrides kind: the schema enum treats optional as its own
  // axis, not a modifier of dev/build. An optional dev-dep → 'optional'.
  if (dep.optional === true) return 'optional';
  switch (dep.kind) {
    case 'dev': return 'dev';
    case 'build': return 'build';
    case null:
    case undefined:
    case 'normal':
      return 'direct';
    default:
      // Defensive: cargo currently emits only the cases above.
      return 'direct';
  }
}

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
    // Two branches: exact match catches single-file-crate layouts where
    // the module path IS the file; prefix match is the common directory
    // case. parseMetadata always emits directory paths, but countPerModule
    // is general enough to accept either.
    if (f.path === modulePath || f.path.startsWith(prefix)) {
      fileCount += 1;
      lineCount += f.lines;
    }
  }
  return { files: fileCount, lines: lineCount };
}
