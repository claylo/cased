import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, parseRecon, renderHeader, renderLedger, assembleReport, fillSlots, embedJson, assertAssembled } from '../src/viewer/build-report.mjs';
import { inferLangFromPath, buildMetaString, formatLocationTitle } from '../src/viewer/build-report.mjs';
import { titleFromScope, renderAgentsFindingList, renderAgentsMd } from '../src/viewer/build-report.mjs';
import {
  resolveSchemaDir,
  compileValidators,
  validateYamlFile,
  validateAuditDir,
  formatValidationErrors,
} from '../src/viewer/build-report.mjs';
import {
  finalizeAudit,
  renderCarriedForward,
  renderReconciliation,
  blockingCounts,
} from '../src/viewer/build-report.mjs';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

// Test fixture: an audit dir assembled from the canonical schema examples —
// the same files the contract stamps into every skill, so the fixture can
// never drift from the schema (the failure mode that killed the old
// checked-in example/ directory).
const findingsYaml = readFileSync('src/schemas/findings.example.yaml', 'utf8');
const reconYaml = readFileSync('src/schemas/recon.example.yaml', 'utf8');
const fixtureDir = mkdtempSync(join(tmpdir(), 'cased-test-audit-'));
writeFileSync(join(fixtureDir, 'findings.yaml'), findingsYaml);
writeFileSync(join(fixtureDir, 'recon.yaml'), reconYaml);

describe('parseFindings', () => {
  it('parses canonical findings.yaml without error', () => {
    const data = parseFindings(findingsYaml);
    assert.equal(data.narratives.length, 5);
    assert.equal(data.narratives[0].findings.length, 3);
    assert.equal(data.narratives[0].findings[0].concern, 'significant');
  });
});

describe('parseRecon', () => {
  it('parses canonical recon.yaml without error', () => {
    const data = parseRecon(reconYaml);
    assert.ok(data.structure.total_files > 0);
    assert.ok(data.dependencies.items.length > 0);
    assert.ok(data.churn.hotspots.length > 0);
  });
});

describe('findings contract: origin / failure_mode / carried_forward / reconciliation', () => {
  const schemaDir = resolveSchemaDir('src/viewer');
  const { validateFindings } = compileValidators(schemaDir);

  it('accepts a finding with origin.kind caused-by-fix and a ref', () => {
    const doc = YAML.parse(findingsYaml);
    doc.narratives[0].findings[0].origin = { kind: 'caused-by-fix', ref: '660a8a4' };
    doc.narratives[0].findings[0].failure_mode = 'user-visible';
    assert.equal(validateFindings(doc), true, JSON.stringify(validateFindings.errors));
  });

  it('rejects an unknown origin.kind', () => {
    const doc = YAML.parse(findingsYaml);
    doc.narratives[0].findings[0].origin = { kind: 'magic' };
    assert.equal(validateFindings(doc), false);
  });

  it('accepts carried_forward and reconciliation blocks', () => {
    const doc = YAML.parse(findingsYaml);
    doc.carried_forward = [{ slug: 'old-perf-nit', prior_audit: '2026-08-12-10-m13-release-candidate', disposition: 'deferred', reason: 'bounded internal optimization; milestone M15' }];
    doc.reconciliation = [{ prior_slug: 'silent-write-discard', prior_audit: '2026-08-12-10-m13-release-candidate', status: 'still-fixed', verified_against: 'a3a4739' }];
    assert.equal(validateFindings(doc), true, JSON.stringify(validateFindings.errors));
  });

  it('rejects reconciliation with an unknown status', () => {
    const doc = YAML.parse(findingsYaml);
    doc.reconciliation = [{ prior_slug: 'x', prior_audit: 'y', status: 'maybe' }];
    assert.equal(validateFindings(doc), false);
  });
});

describe('renderHeader', () => {
  it('generates header HTML with project info', () => {
    const findings = parseFindings(findingsYaml);
    const html = renderHeader(findings);
    assert.ok(html.includes('<h1>'));
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
    const html = await assembleReport(fixtureDir, {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    assert.ok(html.includes('data-slug="hooks-filter-truncate-panic"'));
    assert.ok(html.includes('class="finding"'));
    assert.ok(html.includes('concern-badge'));
    assert.ok(html.includes('expressive-code'));
  });

  it('includes flow diagram SVG when narrative has flow data', async () => {
    const html = await assembleReport(fixtureDir, {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    // Flow diagram present for shell-execution-boundary
    assert.ok(html.includes('class="flow-diagram"'));
    assert.ok(html.includes('Spawn shell command'));
    assert.ok(html.includes('filter: prefix?'));
    // Three of the five canonical narratives carry flow data
    const flowDiagramCount = html.split('class="flow-diagram"').length - 1;
    assert.equal(flowDiagramCount, 3);
  });
});

describe('renderLedger', () => {
  it('generates remediation ledger table', () => {
    const findings = parseFindings(findingsYaml);
    const html = renderLedger(findings);
    assert.ok(html.includes('<table'));
    assert.ok(html.includes('hooks-stdin-write-silently-discarded'));
  });
});

describe('assembleReport', () => {
  it('produces valid HTML from example data', async () => {
    const html = await assembleReport(fixtureDir, {
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
    // Narrative titles present as H3s
    assert.ok(list.includes('### The Shell Execution Boundary'));
    assert.ok(list.includes('### The Ecosystem Completeness Surface'));
    // First narrative's finding slugs present with their concerns
    assert.ok(list.includes('`hooks-filter-truncate-panic` (significant)'));
    assert.ok(list.includes('`hooks-stdin-write-silently-discarded` (moderate)'));
    assert.ok(list.includes('`git-fetch-silently-discarded` (moderate)'));
    // Location annotation uses backticked path:line format
    assert.ok(list.includes('`crates/scrat-core/src/hooks.rs:393-394`'));
  });
});

describe('renderAgentsMd', () => {
  it('interpolates template placeholders from findings', () => {
    const findings = parseFindings(findingsYaml);
    const template = readFileSync('src/viewer/agents-md-template.md', 'utf8');
    const md = renderAgentsMd(findings, template, '2026-04-09-full-workspace');
    // All placeholders replaced
    assert.ok(!md.includes('{{'));
    // Audit metadata correctly interpolated
    assert.ok(md.includes('Full workspace audit'));          // audit_title (from scope)
    assert.ok(md.includes('`2026-04-09-full-workspace`'));   // audit_slug
    assert.ok(md.includes('2026-04-09'));                    // audit_date
    assert.ok(md.includes('18 total'));                      // finding_count (canonical example)
    assert.ok(md.includes('open: 18'));                      // finding_count in front-matter example
    // Finding list interpolated in place
    assert.ok(md.includes('`hooks-filter-truncate-panic`'));
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

  it('validates the canonical fixture dir cleanly', () => {
    const errors = validateAuditDir(fixtureDir, 'src/schemas');
    assert.deepEqual(errors, [],
      `canonical examples must validate: ${JSON.stringify(errors, null, 2)}`);
  });
});

describe('re-audit rendering', () => {
  const doc = YAML.parse(findingsYaml);
  it('renderCarriedForward lists prior slugs with disposition and audit', () => {
    const md = renderCarriedForward(doc);
    assert.match(md, /hooks-timeout-not-configurable/);
    assert.match(md, /deferred/);
    assert.match(md, /2026-03-30-14-full-workspace/);
  });
  it('renderReconciliation emits a table with status per prior slug', () => {
    const md = renderReconciliation(doc);
    assert.match(md, /\| prior finding \| audit \| status \|/);
    assert.match(md, /regressed/);
  });
  it('renderLedger splits blocking from backlog', () => {
    const slugToTitle = new Map();
    for (const n of doc.narratives) for (const f of n.findings) slugToTitle.set(f.slug, f.title);
    const html = renderLedger(doc, slugToTitle);
    assert.match(html, /Blocking/);
    assert.match(html, /Backlog/);
  });
  it('AGENTS.md excludes carried_forward from the finding index and shows counts', () => {
    const tpl = readFileSync('src/viewer/agents-md-template.md', 'utf8');
    const md = renderAgentsMd(doc, tpl, '2026-08-18-10-x', { recon: YAML.parse(reconYaml) });
    assert.doesNotMatch(md, /- \[?hooks-timeout-not-configurable/);
    assert.match(md, /Blocking findings:\s*\d+/);
    assert.match(md, /just test|cargo/); // test command interpolated from recon.testing.command
  });
});

describe('finalizeAudit', () => {
  it('fails on scaffold README, stub audit_profile, and unledgered prior audit; passes when complete', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cased-fin-'));
    const audits = join(repo, 'record', 'audits');
    const prior = join(audits, '2026-08-01-10-prior'); mkdirSync(prior, { recursive: true });
    writeFileSync(join(prior, 'findings.yaml'), 'narratives:\n  - findings:\n      - slug: old\n');
    const cur = join(audits, '2026-08-18-10-cur'); mkdirSync(cur);
    const doc = YAML.parse(findingsYaml);
    // make evidence trivially verifiable: one finding, file we control
    doc.narratives = [{ slug: 'n', title: 'N', thesis: 't', verdict: 'v', findings: [{ slug: 'f1', title: 'F1', concern: 'moderate', locations: [{ path: 'src/x.rs', start_line: 1, end_line: 1 }], evidence: 'fn x() {}\n', mechanism: 'm', remediation: 'r' }] }];
    doc.summary = { counts: { critical: 0, significant: 0, moderate: 1, advisory: 0, note: 0 } };
    mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src', 'x.rs'), 'fn x() {}\n');
    writeFileSync(join(cur, 'findings.yaml'), YAML.stringify(doc));
    const recon = YAML.parse(reconYaml); recon.structure.root = repo; recon.meta.audit_profile.model = 'unknown';
    writeFileSync(join(cur, 'recon.yaml'), YAML.stringify(recon));
    writeFileSync(join(cur, 'README.md'), '# Audit\n<!-- AGENT: fill -->\n');
    // report.html and AGENTS.md are build outputs finalize requires; write stubs
    // so the test exercises the content gates rather than the existence gate.
    writeFileSync(join(cur, 'report.html'), '<!DOCTYPE html>\n');
    writeFileSync(join(cur, 'AGENTS.md'), '# Agent Briefing\n');
    let r = finalizeAudit(cur, { repoRoot: repo });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /AGENT:/.test(e)));
    assert.ok(r.errors.some(e => /model/.test(e)));
    assert.ok(r.errors.some(e => /2026-08-01-10-prior/.test(e) && /actions-taken/.test(e)));
    // fix everything
    recon.meta.audit_profile.model = 'claude-opus-4-6';
    writeFileSync(join(cur, 'recon.yaml'), YAML.stringify(recon));
    writeFileSync(join(cur, 'README.md'), '# Audit\n\nProse.\n');
    writeFileSync(join(prior, 'actions-taken.md'), '---\naudit: 2026-08-01-10-prior\nlast_updated: 2026-08-02\nstatus:\n  fixed: 0\n  mitigated: 0\n  accepted: 0\n  disputed: 0\n  deferred: 1\n  open: 0\n---\n## 2026-08-02 — defer\n\n**Disposition:** deferred\n**Addresses:** [old](README.md#old)\n**Author:** me\n\nTarget: 0.2 milestone.\n');
    r = finalizeAudit(cur, { repoRoot: repo });
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
    // Self-audit 2026-08-28 (bare-catch-erases-failure-cause): an unreadable
    // prior findings.yaml must fail the gate, not count as zero findings.
    writeFileSync(join(prior, 'findings.yaml'), 'narratives: [\n  - {slug: old\n');
    r = finalizeAudit(cur, { repoRoot: repo, allowUnledgeredPrior: true });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /2026-08-01-10-prior/.test(e) && /unreadable/.test(e)));
    rmSync(repo, { recursive: true, force: true });
  });

  it('errors (not warns) when a re-audit has no reconciliation block', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cased-fin-recon-'));
    const cur = join(repo, 'record', 'audits', '2026-08-18-10-cur');
    mkdirSync(cur, { recursive: true });
    mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src', 'x.rs'), 'fn x() {}\n');
    const doc = YAML.parse(findingsYaml);
    doc.narratives = [{ slug: 'n', title: 'N', thesis: 't', verdict: 'v', findings: [{ slug: 'f1', title: 'F1', concern: 'moderate', locations: [{ path: 'src/x.rs', start_line: 1, end_line: 1 }], evidence: 'fn x() {}\n', mechanism: 'm', remediation: 'r' }] }];
    doc.summary = { counts: { critical: 0, significant: 0, moderate: 1, advisory: 0, note: 0 } };
    delete doc.reconciliation;
    writeFileSync(join(cur, 'findings.yaml'), YAML.stringify(doc));
    const recon = YAML.parse(reconYaml);
    recon.structure.root = repo;
    recon.meta.audit_profile.mode = 're-audit';
    recon.meta.audit_profile.prior_audit = '2026-08-01-10-prior';
    writeFileSync(join(cur, 'recon.yaml'), YAML.stringify(recon));
    writeFileSync(join(cur, 'README.md'), '# Audit\n\nProse.\n');
    writeFileSync(join(cur, 'report.html'), '<!DOCTYPE html>\n');
    writeFileSync(join(cur, 'AGENTS.md'), '# Agent Briefing\n');

    let r = finalizeAudit(cur, { repoRoot: repo });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /reconciliation/.test(e)), `expected a reconciliation error, got ${JSON.stringify(r.errors)}`);
    assert.ok(!r.warnings.some(e => /reconciliation/.test(e)), 'missing reconciliation must be an error, not a warning');

    // adding the block clears it
    doc.reconciliation = [{ prior_slug: 'old', status: 'still-fixed', note: 'verified at e4f5a6b' }];
    writeFileSync(join(cur, 'findings.yaml'), YAML.stringify(doc));
    r = finalizeAudit(cur, { repoRoot: repo });
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
    rmSync(repo, { recursive: true, force: true });
  });

  it('reports missing build outputs before checking content', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cased-fin-bare-'));
    const cur = join(repo, 'record', 'audits', '2026-08-18-10-bare');
    mkdirSync(cur, { recursive: true });
    writeFileSync(join(cur, 'findings.yaml'), findingsYaml);
    writeFileSync(join(cur, 'recon.yaml'), reconYaml);
    const r = finalizeAudit(cur, { repoRoot: repo });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /missing README\.md/.test(e)));
    assert.ok(r.errors.some(e => /missing report\.html/.test(e)));
    assert.ok(r.errors.some(e => /missing AGENTS\.md/.test(e)));
    rmSync(repo, { recursive: true, force: true });
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

// Self-audit 2026-08-28: the report broke itself. Two blockers, one describe.
describe('assembly hardening (template-slot-replace-interprets-dollar-patterns, report-data-blob-script-breakout)', () => {
  const POISON = "grep -E '^foo$' file  $' $` $& $1 ${x} </script><script>alert(1)</script>  line ";

  it('fillSlots does not interpret $-patterns in the replacement', () => {
    const out = fillSlots('A<!-- SLOT:x -->B', { x: POISON });
    assert.equal(out, `A${POISON}B`);
  });

  it('fillSlots throws on a missing or unknown marker', () => {
    assert.throws(() => fillSlots('no markers', { x: '1' }), /missing slot marker/);
    assert.throws(() => fillSlots('<!-- SLOT:y -->', { x: '1' }), /unknown slot marker/);
  });

  it('fillSlots only recognizes markers in the template, not in filled content', () => {
    const out = fillSlots('<!-- SLOT:a --><!-- SLOT:b -->', { a: '<!-- SLOT:b -->', b: 'B' });
    assert.equal(out, '<!-- SLOT:b -->B');
  });

  it('embedJson never emits </script or raw line terminators, and round-trips', () => {
    const s = embedJson({ v: POISON });
    assert.ok(!s.includes('<'));
    assert.ok(!s.includes('>'));
    assert.ok(!s.includes('&'));
    assert.ok(!s.includes(' ') && !s.includes(' '));
    assert.equal(JSON.parse(s).v, POISON);
  });

  it('assertAssembled rejects the failure shapes the self-audit produced', () => {
    assert.throws(() => assertAssembled('<!DOCTYPE html><!DOCTYPE html>'), /one DOCTYPE/);
    assert.throws(() => assertAssembled('<!DOCTYPE html><script id="cased-data" type="application/json">{oops</script>'), /not valid JSON/);
    assert.throws(() => assertAssembled('<!DOCTYPE html>'), /cased-data block missing/);
  });

  it('assembleReport survives poisoned evidence and remediation end to end', async () => {
    const doc = YAML.parse(findingsYaml);
    const f = doc.narratives[0].findings[0];
    f.evidence = POISON + '\n' + f.evidence;
    f.remediation = f.remediation + '\nPattern: ^[a-z]+$ and ' + POISON;
    const dir = mkdtempSync(join(tmpdir(), 'cased-test-poison-'));
    writeFileSync(join(dir, 'findings.yaml'), YAML.stringify(doc));
    writeFileSync(join(dir, 'recon.yaml'), reconYaml);
    const html = await assembleReport(dir, { viewerDir: 'src/viewer', fontsDir: 'vendor/fonts', viewerJs: null });
    assert.equal((html.match(/<!DOCTYPE html>/g) || []).length, 1);
    assert.equal((html.match(/<\/html>/g) || []).length, 1);
    const blob = /<script id="cased-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1];
    const data = JSON.parse(blob);
    assert.equal(data.findings.narratives[0].findings[0].evidence.startsWith(POISON), true);
    assert.equal((html.match(/<script id="cased-data"/g) || []).length, 1);
    rmSync(dir, { recursive: true });
  });
});
