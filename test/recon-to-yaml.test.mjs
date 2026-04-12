import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseGitLog, parseTokei, parseMetadata, buildReconObject, detectTesting, validateRecon } from '../src/recon/recon-to-yaml.mjs';

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
    // where files is Array<{ path, lines }>. Paths are workspace-root
    // relative with any leading `./` stripped, matching what tokei
    // emits from `cd "$TARGET" && tokei --output json`. Downstream code
    // prefix-matches these against workspace-root-relative module paths.
    assert.ok(Array.isArray(result.files));
    assert.equal(result.files.length, 10);
    const libRs = result.files.find(f => f.path === 'core/src/lib.rs');
    assert.equal(libRs.lines, 245); // 15 + 200 + 30
  });
});

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

describe('recon-to-yaml CLI', () => {
  it('reads a tmp dir of raw outputs and emits a valid recon.yaml', () => {
    const work = mkdtempSync(join(tmpdir(), 'recon-test-'));
    // Copy the four fixtures into the work dir under the expected names
    for (const name of ['manifest.json', 'metadata.json', 'tokei.json', 'git-log.raw']) {
      writeFileSync(join(work, name), readFileSync(join(fixtures, name), 'utf8'));
    }
    const outYaml = join(work, 'recon.yaml');
    const scriptPath = join(here, '..', 'src', 'recon', 'recon-to-yaml.mjs');

    execFileSync('node', [scriptPath, work, outYaml], {
      stdio: 'pipe',
    });

    assert.ok(existsSync(outYaml));
    const parsed = parseYaml(readFileSync(outYaml, 'utf8'));
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
      writeFileSync(join(work, name), readFileSync(join(fixtures, name), 'utf8'));
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

describe('detectTesting', () => {
  // Helper: create an ephemeral project root populated with the given files
  // (relative paths → contents). Caller discards the handle when done.
  function makeProject(files) {
    const root = mkdtempSync(join(tmpdir(), 'detect-testing-'));
    for (const [relPath, content] of Object.entries(files)) {
      const full = join(root, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    return root;
  }

  it('picks up commands.test from scrat.yaml (priority 1)', () => {
    const root = makeProject({
      '.config/scrat.yaml': 'project:\n  type: node\n\ncommands:\n  test: just test\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'just');
    assert.equal(result.command, 'just test');
    assert.deepEqual(result.sources, ['.config/scrat.yaml']);
    assert.equal(result.notes, undefined);
  });

  it('picks up commands.test from scrat.toml (priority 1)', () => {
    const root = makeProject({
      '.config/scrat.toml': '[project]\ntype = "rust"\n\n[commands]\ntest = "just test"\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'just');
    assert.equal(result.command, 'just test');
    assert.deepEqual(result.sources, ['.config/scrat.toml']);
  });

  it('picks up a Justfile `test:` recipe (priority 2)', () => {
    const root = makeProject({
      'Justfile': 'build:\n    cargo build\n\ntest:\n    cargo test\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'just');
    assert.equal(result.command, 'just test');
    assert.deepEqual(result.sources, ['Justfile']);
  });

  it('picks up package.json scripts.test (priority 3)', () => {
    const root = makeProject({
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'npm');
    assert.equal(result.command, 'npm test');
    assert.deepEqual(result.sources, ['package.json']);
  });

  it('falls back to nextest when only nextest.toml is present (priority 4)', () => {
    const root = makeProject({
      '.config/nextest.toml': '[profile.default]\nretries = 1\n',
      'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'nextest');
    assert.equal(result.command, 'cargo nextest run --workspace');
    assert.deepEqual(result.sources, ['.config/nextest.toml']);
    assert.match(result.notes, /process isolation/);
  });

  it('falls back to cargo test when only Cargo.toml is present (priority 5)', () => {
    const root = makeProject({
      'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'cargo-test');
    assert.equal(result.command, 'cargo test --workspace');
    assert.deepEqual(result.sources, ['Cargo.toml']);
    assert.equal(result.notes, undefined);
  });

  it('returns unknown when nothing testing-related is detected', () => {
    const root = makeProject({
      'README.md': '# test\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'unknown');
    assert.equal(result.command, '');
    assert.deepEqual(result.sources, []);
    assert.equal(result.notes, undefined);
  });

  it('warns when scrat points at cargo test but nextest.toml is present', () => {
    const root = makeProject({
      '.config/scrat.toml': '[commands]\ntest = "cargo test --workspace --all-features"\n',
      '.config/nextest.toml': '[profile.default]\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'cargo-test');
    assert.equal(result.command, 'cargo test --workspace --all-features');
    assert.match(result.notes, /bypasses nextest/);
  });

  it('adds a wrapper note when scrat wraps via just and nextest.toml is present', () => {
    const root = makeProject({
      '.config/scrat.toml': '[commands]\ntest = "just test"\n',
      '.config/nextest.toml': '[profile.default]\n',
    });
    const result = detectTesting(root);
    assert.equal(result.runner, 'just');
    assert.equal(result.command, 'just test');
    assert.match(result.notes, /wrapper command likely invokes/);
  });

  it('scrat beats Justfile when both are present (priority order)', () => {
    const root = makeProject({
      '.config/scrat.yaml': 'commands:\n  test: custom-runner\n',
      'Justfile': 'test:\n    cargo test\n',
    });
    const result = detectTesting(root);
    assert.equal(result.command, 'custom-runner');
    assert.equal(result.runner, 'custom');
    assert.deepEqual(result.sources, ['.config/scrat.yaml']);
  });
});
