import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, parseRecon, renderHeader, renderLedger, assembleReport } from '../src/viewer/build-report.mjs';
import { inferLangFromPath, buildMetaString, formatLocationTitle } from '../src/viewer/build-report.mjs';
import { titleFromScope, renderAgentsFindingList, renderAgentsMd } from '../src/viewer/build-report.mjs';
import { readFileSync } from 'node:fs';
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
