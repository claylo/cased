// src/recon/recon-to-yaml.mjs
//
// Assembles recon.yaml from the raw tool outputs written by
// src/recon/recon. Pure-function parsers for each input plus a
// build step that combines them into a schema-valid recon object.
// Validation runs via ajv against src/schemas/recon.schema.json.
//
// The CLI entry point at the bottom is guarded so tests can import
// the parser functions without triggering the build pipeline.

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
