import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, parseRecon, renderHeader, renderNarrative, renderLedger } from '../src/viewer/build-report.mjs';
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

describe('renderNarrative', () => {
  it('generates narrative section with findings', () => {
    const findings = parseFindings(findingsYaml);
    const html = renderNarrative(findings.narratives[0]);
    assert.ok(html.includes('data-slug="location-truthfulness"'));
    assert.ok(html.includes('class="finding"'));
    assert.ok(html.includes('concern-badge'));
    assert.ok(html.includes('<pre class="evidence">'));
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
