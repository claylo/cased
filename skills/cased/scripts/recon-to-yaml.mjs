// src/recon/recon-to-yaml.mjs
//
// Assembles recon.yaml from the raw tool outputs written by
// src/recon/recon. Pure-function parsers for each input plus a
// build step that combines them into a schema-valid recon object.
// Validation runs via ajv against src/schemas/recon.schema.json.
//
// The CLI entry point at the bottom is guarded so tests can import
// the parser functions without triggering the build pipeline.

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

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
 * File counts come from `reports.length`: real tokei (v14+) does not
 * emit a top-level `files` key at the language level — only `blanks`,
 * `code`, `comments`, `reports`, `children`, `inaccurate`. Report
 * paths are normalized by stripping a leading `./`, which tokei emits
 * when invoked from the project's working directory (our recon
 * orchestrator does `cd "$TARGET" && tokei`). Downstream code compares
 * these against workspace-root-relative module paths.
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
    const reports = data.reports || [];
    const fileCount = reports.length;
    const lines = (data.blanks || 0) + (data.code || 0) + (data.comments || 0);
    totalFiles += fileCount;
    totalLines += lines;
    languages.push({ language, files: fileCount, lines });
    for (const report of reports) {
      const s = report.stats || {};
      const fileLines = (s.blanks || 0) + (s.code || 0) + (s.comments || 0);
      files.push({ path: stripDotSlash(report.name), lines: fileLines });
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
 * Strip a leading `./` from a tokei report path. Tokei emits this when
 * run from the project directory without an explicit path argument. We
 * normalize for downstream prefix matching against relative module paths.
 */
function stripDotSlash(p) {
  return p.startsWith('./') ? p.slice(2) : p;
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
 * Deterministically detect the project's canonical test command by scanning
 * config files in a fixed priority order. Priority: human-curated wrappers
 * (scrat, Justfile, package.json) before tool-specific config (nextest)
 * before language defaults (cargo test).
 *
 * Priority rationale: a scrat-configured `commands.test` or a Justfile `test:`
 * recipe encodes the maintainer's canonical command, including wrapper
 * semantics we can't infer from tool config alone. Tool-specific config
 * (nextest.toml) is next because its presence implies a preference even
 * when no human-curated wrapper exists. Cargo default only fires when
 * nothing else applies.
 *
 * Notes are emitted only when warranted — specifically, when nextest
 * config is present and the chosen command bypasses it (e.g., `cargo test`
 * directly).
 *
 * @param {string} targetPath - absolute path to the project root
 * @returns {{ runner: string, command: string, sources: string[], notes?: string }}
 */
export function detectTesting(targetPath) {
  // Priority 1: scrat config commands.test
  const scratResult = detectScratTest(targetPath);
  if (scratResult) {
    return finalizeTesting({
      command: scratResult.command,
      sources: [scratResult.source],
      targetPath,
    });
  }

  // Priority 2: Justfile with a `test:` recipe
  const justResult = detectJustTest(targetPath);
  if (justResult) {
    return finalizeTesting({
      command: 'just test',
      sources: [justResult.source],
      targetPath,
    });
  }

  // Priority 3: package.json scripts.test
  const npmResult = detectNpmTest(targetPath);
  if (npmResult) {
    return finalizeTesting({
      command: 'npm test',
      sources: ['package.json'],
      targetPath,
    });
  }

  // Priority 4: nextest config — use nextest directly
  const nextestResult = detectNextestConfig(targetPath);
  if (nextestResult) {
    return {
      runner: 'nextest',
      command: 'cargo nextest run --workspace',
      sources: [nextestResult.source],
      notes: 'Nextest provides per-test process isolation. Running `cargo test` instead will cause env-mutating tests to fail unexpectedly.',
    };
  }

  // Priority 5: Rust default — Cargo.toml exists, no other signal
  if (existsSync(join(targetPath, 'Cargo.toml'))) {
    return {
      runner: 'cargo-test',
      command: 'cargo test --workspace',
      sources: ['Cargo.toml'],
    };
  }

  // Nothing detected
  return {
    runner: 'unknown',
    command: '',
    sources: [],
  };
}

/**
 * Finalize a detected command into a schema-valid testing entry.
 * Infers the runner label from the command and attaches a note when
 * nextest config is present but the chosen command doesn't use nextest.
 */
function finalizeTesting({ command, sources, targetPath }) {
  const runner = inferRunner(command);
  const entry = { runner, command, sources };

  const nextestPresent = detectNextestConfig(targetPath) !== null;
  if (nextestPresent && runner !== 'nextest') {
    if (/\bcargo\s+test\b/.test(command)) {
      // Direct cargo test when nextest.toml exists — misconfiguration risk.
      entry.notes =
        '`.config/nextest.toml` is present, but the configured test command invokes `cargo test` directly. This bypasses nextest\'s process isolation and will cause env-mutating tests to fail unexpectedly.';
    } else {
      // Wrapper command (just/npm/custom) — likely calls nextest internally.
      entry.notes =
        '`.config/nextest.toml` is present — the wrapper command likely invokes `cargo nextest run`. Do not invoke `cargo test` directly: env-mutating tests assume nextest process isolation.';
    }
  }

  return entry;
}

function inferRunner(command) {
  if (/^\s*just\s/.test(command)) return 'just';
  if (/\bnextest\b/.test(command)) return 'nextest';
  if (/^\s*cargo\s+test\b/.test(command)) return 'cargo-test';
  if (/^\s*(npm|yarn|pnpm)\s+(run\s+)?test\b/.test(command)) return 'npm';
  return 'custom';
}

function detectScratTest(targetPath) {
  const candidates = [
    { path: '.config/scrat.yaml', type: 'yaml' },
    { path: '.config/scrat.yml', type: 'yaml' },
    { path: '.config/scrat.toml', type: 'toml' },
  ];
  for (const { path, type } of candidates) {
    const full = join(targetPath, path);
    if (!existsSync(full)) continue;
    let raw;
    try {
      raw = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    let command;
    if (type === 'yaml') {
      try {
        const parsed = YAML.parse(raw);
        command = parsed?.commands?.test;
      } catch {
        continue;
      }
    } else {
      command = extractTomlCommandsTest(raw);
    }
    if (command && typeof command === 'string' && command.trim()) {
      return { command: command.trim(), source: path };
    }
  }
  return null;
}

/**
 * Minimal TOML extractor for `[commands]\ntest = "..."`. Not a general
 * TOML parser — scoped to the one field we need, to avoid adding a TOML
 * dependency. Handles basic backslash escapes inside the string value.
 */
function extractTomlCommandsTest(content) {
  const headerMatch = content.match(/^\[commands\]\s*$/m);
  if (!headerMatch) return null;
  const start = headerMatch.index + headerMatch[0].length;
  const rest = content.slice(start);
  // Section body runs until the next `[section]` header or end of file.
  const nextHeader = rest.match(/^\s*\[/m);
  const section = nextHeader ? rest.slice(0, nextHeader.index) : rest;
  const testMatch = section.match(/^\s*test\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/m);
  return testMatch ? testMatch[1].replace(/\\(.)/g, '$1') : null;
}

function detectJustTest(targetPath) {
  for (const name of ['Justfile', 'justfile']) {
    const full = join(targetPath, name);
    if (!existsSync(full)) continue;
    let raw;
    try {
      raw = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    // Match a top-level recipe header `test:` (optionally with deps after).
    // Uses [ \t] (not \s) to keep the colon on the same line as the name,
    // and excludes leading whitespace so indented recipe bodies and
    // commented lines don't false-positive.
    if (/^test[ \t]*:/m.test(raw)) {
      return { source: name };
    }
  }
  return null;
}

function detectNpmTest(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg?.scripts?.test && typeof pkg.scripts.test === 'string') {
      return { command: pkg.scripts.test };
    }
  } catch {
    // Malformed package.json — silent skip; higher-priority detection
    // already returned null.
  }
  return null;
}

function detectNextestConfig(targetPath) {
  for (const path of ['.config/nextest.toml', '.cargo/nextest.toml']) {
    if (existsSync(join(targetPath, path))) {
      return { source: path };
    }
  }
  return null;
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

  // Tokei paths (from parseTokei) are workspace-root-relative after
  // ./ stripping. Module paths from cargo metadata are absolute. Compute
  // a relative module path for the per-module tokei match.
  //
  // Known gap: a workspace that is ALSO a root package (hybrid layout
  // with [workspace] + [package] at the root and src/ alongside) will
  // produce rel === '' for the root member. countPerModule's prefix
  // becomes '/', which matches no relative path — the root member
  // under-counts (returns 0 files, 0 lines). Virtual workspaces (bito,
  // scrat, most Cargo workspaces in practice) don't hit this case.
  // Tracked as a future enhancement; flagged in the commit message.
  const workspaceRoot = parsedMetadata.workspace_root;
  const relativize = absPath => {
    if (absPath === workspaceRoot) return '';
    if (absPath.startsWith(workspaceRoot + '/')) {
      return absPath.slice(workspaceRoot.length + 1);
    }
    return absPath;
  };

  const structure = {
    root: manifest.target_path,
    total_files: parsedTokei.total_files,
    total_lines: parsedTokei.total_lines,
    languages: parsedTokei.languages,
    modules: parsedMetadata.modules.map(mod => ({
      name: mod.name,
      path: mod.path,
      ...countPerModule(parsedTokei.files, relativize(mod.path)),
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

  const testing = detectTesting(manifest.target_path);

  return { meta, structure, dependencies, churn, testing };
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
      readFileSync(join(tmpDir, 'manifest.json'), 'utf8')
    );
    const metadata = JSON.parse(
      readFileSync(join(tmpDir, 'metadata.json'), 'utf8')
    );
    const tokei = JSON.parse(
      readFileSync(join(tmpDir, 'tokei.json'), 'utf8')
    );
    const gitLog = readFileSync(join(tmpDir, 'git-log.raw'), 'utf8');

    const recon = buildReconObject({ manifest, metadata, tokei, gitLog });

    // Locate the schema. In the source layout it's at
    // ../schemas/recon.schema.json relative to this file. In the
    // shipped skill it's at ../references/recon.schema.json.
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const schemaCandidates = [
      resolve(scriptDir, '..', 'schemas', 'recon.schema.json'),
      resolve(scriptDir, '..', 'references', 'recon.schema.json'),
    ];
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

    mkdirSync(dirname(outYamlPath), { recursive: true });
    const yaml = YAML.stringify(recon, { indent: 2, lineWidth: 100 });
    writeFileSync(outYamlPath, yaml);

    const sizeKb = (yaml.length / 1024).toFixed(1);
    console.log(`wrote ${outYamlPath} (${sizeKb}KB)`);
  } catch (err) {
    console.error(`recon: ${err.message}`);
    process.exit(3);
  }
}
