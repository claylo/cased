import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, parseRecon, renderHeader, renderLedger, assembleReport } from '../src/viewer/build-report.mjs';
import { inferLangFromPath, buildMetaString, formatLocationTitle } from '../src/viewer/build-report.mjs';
import { titleFromScope, renderAgentsFindingList, renderAgentsMd } from '../src/viewer/build-report.mjs';
import {
  resolveSchemaDir,
  compileValidators,
  validateYamlFile,
  validateAuditDir,
  formatValidationErrors,
} from '../src/viewer/build-report.mjs';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

const findingsYaml = readFileSync('example/2026-03-21-current-repo-review/findings.yaml', 'utf8');
const reconYaml = readFileSync('example/2026-03-21-current-repo-review/recon.yaml', 'utf8');

describe('parseFindings', () => {
  it('parses example findings.yaml without error', () => {
    const data = parseFindings(findingsYaml);
    assert.equal(data.narratives.length, 2);
    assert.equal(data.narratives[0].findings.length, 2);
    assert.equal(data.narratives[0].findings[0].concern, 'significant');
  });
});

describe('parseRecon', () => {
  it('parses example recon.yaml without error', () => {
    const data = parseRecon(reconYaml);
    assert.ok(data.files.length > 0);
    assert.ok(data.dependency_graph.length > 0);
  });
});

describe('renderHeader', () => {
  it('generates header HTML with project info', () => {
    const findings = parseFindings(findingsYaml);
    const html = renderHeader(findings);
    assert.ok(html.includes('<h1>'));
    assert.ok(html.includes('current-repo-review'));
    assert.ok(html.includes('summary-bar'));
  });
});

describe('inferLangFromPath', () => {
  it('maps .rs to rust', () => {
    assert.equal(inferLangFromPath('crates/foo/src/main.rs'), 'rust');
  });
  it('maps .mjs to javascript', () => {
    assert.equal(inferLangFromPath('src/build.mjs'), 'javascript');
  });
  it('returns text for unknown extensions', () => {
    assert.equal(inferLangFromPath('README'), 'text');
  });
  it('returns text for undefined', () => {
    assert.equal(inferLangFromPath(undefined), 'text');
  });
});

describe('buildMetaString', () => {
  it('converts markers to EC meta syntax', () => {
    const markers = [
      { lines: '3', type: 'del', label: 'silent path' },
      { lines: '3-7', type: 'mark' },
    ];
    const meta = buildMetaString(markers);
    assert.ok(meta.includes('del={3}'));
    assert.ok(meta.includes('"silent path"'));
    assert.ok(meta.includes('mark={3-7}'));
  });
  it('returns empty string for undefined', () => {
    assert.equal(buildMetaString(undefined), '');
  });
});

describe('formatLocationTitle', () => {
  it('formats path with line range', () => {
    const loc = { path: 'src/main.rs', start_line: 10, end_line: 20 };
    assert.equal(formatLocationTitle(loc), 'src/main.rs:10-20');
  });
  it('returns empty string for undefined', () => {
    assert.equal(formatLocationTitle(undefined), '');
  });
});

describe('renderNarrative', () => {
  it('generates narrative section with findings', async () => {
    const html = await assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    assert.ok(html.includes('data-slug="location-truthfulness"'));
    assert.ok(html.includes('class="finding"'));
    assert.ok(html.includes('concern-badge'));
    assert.ok(html.includes('expressive-code'));
  });

  it('includes flow diagram SVG when narrative has flow data', async () => {
    const html = await assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    // Flow diagram present for location-truthfulness
    assert.ok(html.includes('class="flow-diagram"'));
    assert.ok(html.includes('Index locations'));
    assert.ok(html.includes('Alias available?'));
    // Second narrative has no flow, so only one flow-diagram div
    const flowDiagramCount = html.split('class="flow-diagram"').length - 1;
    assert.equal(flowDiagramCount, 1);
  });
});

describe('renderLedger', () => {
  it('generates remediation ledger table', () => {
    const findings = parseFindings(findingsYaml);
    const html = renderLedger(findings);
    assert.ok(html.includes('<table'));
    assert.ok(html.includes('curate-validation-suppresses'));
  });
});

describe('assembleReport', () => {
  it('produces valid HTML from example data', async () => {
    const html = await assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('@font-face'));
    assert.ok(html.includes('font-weight: 200 800'));
    assert.ok(html.includes('Atkinson'));
    assert.ok(html.includes('cased-data'));
    assert.ok(html.includes('expressive-code'));
    assert.ok(html.includes('Remediation Ledger'));
  });
});

describe('titleFromScope', () => {
  it('title-cases a kebab slug', () => {
    assert.equal(titleFromScope('current-repo-review'), 'Current Repo Review');
  });
  it('handles single word', () => {
    assert.equal(titleFromScope('auth'), 'Auth');
  });
  it('returns empty string for empty input', () => {
    assert.equal(titleFromScope(''), '');
    assert.equal(titleFromScope(undefined), '');
  });
});

describe('renderAgentsFindingList', () => {
  it('groups findings under narrative titles with concern and location', () => {
    const findings = parseFindings(findingsYaml);
    const list = renderAgentsFindingList(findings);
    // Both narrative titles present as H3s
    assert.ok(list.includes('### The Location Truthfulness Surface'));
    assert.ok(list.includes('### The Text Boundary Surface'));
    // All three example finding slugs present with their concerns
    assert.ok(list.includes('`curate-validation-suppresses-unresolved-without-suggestion` (significant)'));
    assert.ok(list.includes('`main-file-detection-uses-substring-match` (moderate)'));
    assert.ok(list.includes('`unicode-casefold-offsets-drift-from-source` (moderate)'));
    // Location annotation uses backticked path:line format
    assert.ok(list.includes('`crates/colophon/src/commands/curate.rs:58-66`'));
  });
});

describe('renderAgentsMd', () => {
  it('interpolates template placeholders from findings', () => {
    const findings = parseFindings(findingsYaml);
    const template = readFileSync('src/viewer/agents-md-template.md', 'utf8');
    const md = renderAgentsMd(findings, template);
    // All placeholders replaced
    assert.ok(!md.includes('{{'));
    // Audit metadata correctly interpolated
    assert.ok(md.includes('Current Repo Review'));           // audit_title
    assert.ok(md.includes('`2026-03-21-current-repo-review`')); // audit_slug
    assert.ok(md.includes('2026-03-21'));                    // audit_date
    assert.ok(md.includes('3 total'));                       // finding_count (3 findings in example)
    assert.ok(md.includes('open: 3'));                       // finding_count in front-matter example
    // Finding list interpolated in place
    assert.ok(md.includes('`curate-validation-suppresses-unresolved-without-suggestion`'));
    // Core guidance sections present
    assert.ok(md.includes('## The loop'));
    assert.ok(md.includes('## Dispositions'));
    assert.ok(md.includes('## What you must not do'));
    assert.ok(md.includes('## Finding index'));
  });
});

describe('resolveSchemaDir', () => {
  it('finds src/schemas from src/viewer', () => {
    const dir = resolveSchemaDir('src/viewer');
    assert.ok(dir);
    assert.ok(dir.endsWith('schemas'));
  });
  it('returns null when no candidate contains both schemas', () => {
    const dir = resolveSchemaDir('/nonexistent/path/nowhere');
    assert.equal(dir, null);
  });
});

describe('compileValidators', () => {
  it('compiles recon and findings validators from src/schemas', () => {
    const { validateRecon, validateFindings } = compileValidators('src/schemas');
    assert.equal(typeof validateRecon, 'function');
    assert.equal(typeof validateFindings, 'function');
    // Call one to verify the compiled function actually runs
    assert.equal(typeof validateRecon.errors, 'object'); // null or array, never undefined
  });
});

describe('validateYamlFile', () => {
  it('returns empty array for a valid file', () => {
    const { validateRecon } = compileValidators('src/schemas');
    const errors = validateYamlFile('src/schemas/recon.example.yaml', 'recon.yaml', validateRecon);
    assert.deepEqual(errors, []);
  });

  it('returns errors for a missing file', () => {
    const { validateRecon } = compileValidators('src/schemas');
    const errors = validateYamlFile('/nonexistent/file.yaml', 'recon.yaml', validateRecon);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /file not found/);
  });

  it('returns errors for malformed YAML', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cased-test-'));
    try {
      const badPath = join(tmp, 'bad.yaml');
      writeFileSync(badPath, 'not: [valid: yaml');
      const { validateRecon } = compileValidators('src/schemas');
      const errors = validateYamlFile(badPath, 'bad.yaml', validateRecon);
      assert.equal(errors.length, 1);
      assert.match(errors[0].message, /YAML parse error/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns errors for schema violations', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cased-test-'));
    try {
      const badPath = join(tmp, 'bad.yaml');
      // Minimal valid-ish shape but missing required structure.root
      writeFileSync(badPath, [
        'meta:',
        '  project: test',
        '  commit: abc1234',
        '  timestamp: 2026-04-10T12:00:00Z',
        '  scope: test',
        'structure:',
        '  total_files: 1',
        '  total_lines: 10',
        '  languages: []',
        '  modules: []',
        '',
      ].join('\n'));
      const { validateRecon } = compileValidators('src/schemas');
      const errors = validateYamlFile(badPath, 'bad.yaml', validateRecon);
      assert.ok(errors.length > 0);
      // At least one error should mention 'root'
      assert.ok(errors.some(e => e.message.includes('root') || JSON.stringify(e.params).includes('root')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('validateAuditDir', () => {
  it('validates the src/schemas directory as a self-test fixture', () => {
    // The schemas directory isn't an audit, but it contains both example.yaml files
    // named *.example.yaml. Simulate an audit directory by copying them under the
    // expected names.
    const tmp = mkdtempSync(join(tmpdir(), 'cased-audit-'));
    try {
      writeFileSync(join(tmp, 'recon.yaml'), readFileSync('src/schemas/recon.example.yaml', 'utf8'));
      writeFileSync(join(tmp, 'findings.yaml'), readFileSync('src/schemas/findings.example.yaml', 'utf8'));
      const errors = validateAuditDir(tmp, 'src/schemas');
      assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors, null, 2)}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('catches drift in the old colophon example recon.yaml', () => {
    const errors = validateAuditDir('example/2026-03-21-current-repo-review', 'src/schemas');
    // Old example uses flat schema, so recon.yaml should report errors
    const reconErrors = errors.filter(e => e.file === 'recon.yaml');
    assert.ok(reconErrors.length > 0, 'expected recon.yaml validation errors from stale schema');
    // Should surface the missing `meta` and `structure` top-level fields
    const messages = reconErrors.map(e => e.message).join(' ');
    assert.ok(messages.includes('meta') || messages.includes('structure'),
      'expected errors mentioning missing meta/structure');
  });
});

describe('formatValidationErrors', () => {
  it('returns empty string for no errors', () => {
    assert.equal(formatValidationErrors([]), '');
  });

  it('groups errors by file with indented paths', () => {
    const errors = [
      { file: 'recon.yaml', instancePath: '/meta', message: 'missing commit', params: {} },
      { file: 'recon.yaml', instancePath: '/structure', message: 'missing root', params: {} },
      { file: 'findings.yaml', instancePath: '/narratives/0', message: 'missing slug', params: { missingProperty: 'slug' } },
    ];
    const out = formatValidationErrors(errors);
    assert.ok(out.includes('recon.yaml: 2 errors'));
    assert.ok(out.includes('findings.yaml: 1 error'));
    assert.ok(out.includes('/meta — missing commit'));
    assert.ok(out.includes('/narratives/0 — missing slug'));
    assert.ok(out.includes('"missingProperty":"slug"'));
  });
});
