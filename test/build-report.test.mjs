import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, parseRecon, renderHeader, renderLedger, assembleReport } from '../src/viewer/build-report.mjs';
import { inferLangFromPath, buildMetaString, formatLocationTitle } from '../src/viewer/build-report.mjs';
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
    const loc = { path: 'src/main.rs', line_start: 10, line_end: 20 };
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
