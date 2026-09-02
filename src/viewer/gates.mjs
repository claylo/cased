// Mechanical audit gates. Everything here is deterministic and cheap; the
// point is to take work off the LLM reviewer (which spent ~70% of its
// verdicts on indentation and line ranges) and to refuse to call an audit
// finished while it is structurally incomplete.
import { existsSync, readFileSync } from 'node:fs';
import { join, isAbsolute, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseLedger } from './prior-audits.mjs';

export function isBlocking(finding) {
  const gating = finding.concern === 'critical' || finding.concern === 'significant';
  return gating && (finding.failure_mode ?? 'user-visible') === 'user-visible';
}

export function allFindings(doc) {
  return (doc.narratives ?? []).flatMap(n => n.findings ?? []);
}

export const CONCERN_LEVELS = ['critical', 'significant', 'moderate', 'advisory', 'note'];

/**
 * The per-concern histogram, derived from the findings themselves. This is
 * the only source of truth for counts: the renderers use it directly, and
 * an authored `summary.counts` block is checked against it, never trusted.
 */
export function concernCounts(doc) {
  const counts = Object.fromEntries(CONCERN_LEVELS.map(l => [l, 0]));
  for (const f of allFindings(doc)) {
    if (f.concern in counts) counts[f.concern] += 1;
  }
  return counts;
}

/**
 * If the document authors `summary.counts`, every level must agree with
 * the findings and no key may be outside the concern vocabulary.
 */
export function checkSummaryCounts(doc) {
  const authored = doc?.summary?.counts;
  if (!authored || typeof authored !== 'object') return [];
  const actual = concernCounts(doc);
  const problems = [];
  for (const [level, n] of Object.entries(authored)) {
    if (!(level in actual)) { problems.push({ level, authored: n, actual: null, problem: 'unknown-level' }); continue; }
    if (Number(n) !== actual[level]) problems.push({ level, authored: n, actual: actual[level], problem: 'count-mismatch' });
  }
  return problems;
}

/**
 * A finding path is a claim about a file *inside* the audited tree. Absolute
 * paths and anything that resolves above repoRoot are refused before any read.
 */
function pathEscapesRepo(repoRoot, p) {
  if (typeof p !== 'string' || !p || isAbsolute(p)) return true;
  const base = resolve(repoRoot);
  const abs = resolve(base, p);
  return abs !== base && !abs.startsWith(base + sep);
}

/**
 * Evidence is a claim about the tree at `findings.commit`, not the tree on
 * disk today. When git can resolve that commit we read the file from it, so
 * remediation moving lines around never invalidates the audit's own evidence.
 * Returns null when the commit is unknown (no git, no such object) — the
 * caller then falls back to the working tree.
 */
function commitReader(repoRoot, commit) {
  if (typeof commit !== 'string' || !commit) return null;
  // maxBuffer: shipped bundles and lockfiles exceed the 1 MB default, and a
  // truncation throw would be indistinguishable from "path not in commit".
  const run = args => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  try { run(['cat-file', '-e', `${commit}^{commit}`]); } catch { return null; }
  return p => {
    try { return run(['show', `${commit}:./${p}`]).split('\n'); } catch { return null; }
  };
}

function workingTreeReader(repoRoot) {
  return p => {
    const abs = join(repoRoot, p);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf8').split('\n');
  };
}

export function checkEvidenceFidelity(doc, repoRoot, { commit = doc?.commit } = {}) {
  const problems = [];
  const readLines = commitReader(repoRoot, commit) ?? workingTreeReader(repoRoot);
  for (const f of allFindings(doc)) {
    const locs = f.locations ?? [];
    if (!locs.length || typeof f.evidence !== 'string') continue;
    const evidence = f.evidence.replace(/\n$/, '').split('\n');
    const expected = [];
    let missing = false;
    for (const loc of locs) {
      if (pathEscapesRepo(repoRoot, loc.path)) { problems.push({ slug: f.slug, path: loc.path, start_line: loc.start_line, end_line: loc.end_line, problem: 'path-escapes-repo' }); missing = true; break; }
      const lines = readLines(loc.path);
      if (!lines) { problems.push({ slug: f.slug, path: loc.path, start_line: loc.start_line, end_line: loc.end_line, problem: 'file-missing' }); missing = true; break; }
      expected.push(...lines.slice(loc.start_line - 1, loc.end_line));
    }
    if (missing) continue;
    const first = locs[0];
    if (expected.length !== evidence.length) {
      problems.push({ slug: f.slug, path: first.path, start_line: first.start_line, end_line: first.end_line, problem: 'line-count', expected: String(expected.length), actual: String(evidence.length) });
      continue;
    }
    for (let i = 0; i < expected.length; i++) {
      if (expected[i].trimEnd() !== evidence[i].trimEnd()) {
        problems.push({ slug: f.slug, path: first.path, start_line: first.start_line, end_line: first.end_line, problem: 'text-mismatch', expected: expected[i], actual: evidence[i] });
        break;
      }
    }
  }
  return problems;
}

export function checkReadmeComplete(text) {
  const problems = [];
  if (/^<!--\s*\n\s*README\.md scaffold/m.test(text)) problems.push('scaffold instruction comment still present at top of README.md');
  const markers = text.match(/<!--\s*AGENT:/g);
  if (markers) problems.push(`${markers.length} <!-- AGENT: --> placeholder(s) still present in README.md`);
  return problems;
}

export function checkAuditProfile(recon) {
  const p = recon?.meta?.audit_profile;
  if (!p) return ['recon.yaml meta.audit_profile is missing (pre-runner ≥ this version emits a stub; controller must complete it)'];
  const problems = [];
  if (!p.model || p.model === 'unknown') problems.push('audit_profile.model is unknown — record the controller model id');
  if (!p.agent_count) problems.push('audit_profile.agent_count is 0 — record how many analysis agents were dispatched');
  if (!p.surfaces || p.surfaces.length === 0) problems.push('audit_profile.surfaces is empty — record the surface names dispatched');
  if (p.mode === 're-audit' && !p.prior_audit) problems.push('audit_profile.mode is re-audit but prior_audit is null');
  return problems;
}

const REQUIRE_COMMIT = new Set(['fixed', 'mitigated', 'superseded']);
const KNOWN = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];

export function lintLedger({ ledgerText, findingsDoc, gitLog = null, testCommand = null }) {
  const out = [];
  const err = (entry, message) => out.push({ entry, level: 'error', message });
  const warn = (entry, message) => out.push({ entry, level: 'warn', message });
  const ledger = parseLedger(ledgerText);
  const fm = ledger.frontMatter;
  const findings = allFindings(findingsDoc);
  const known = new Map(findings.map(f => [f.slug, f]));
  for (const cf of findingsDoc.carried_forward ?? []) known.set(cf.slug, { slug: cf.slug, concern: 'note', effort: 'small', carried: true });

  if (!fm.audit || !fm.status) err(null, 'front matter must declare audit and status counts');
  else {
    const s = fm.status;
    const total = findings.length;
    const others = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'].reduce((n, k) => n + (Number(s[k]) || 0), 0);
    if (Number(s.open) !== total - others) err(null, `front matter open=${s.open} but findings(${total}) − dispositioned(${others}) = ${total - others}`);
  }
  if (!ledger.entries.length) warn(null, 'ledger has no entries');

  for (const e of ledger.entries) {
    const f = e.fields;
    if (!KNOWN.includes(e.disposition)) err(e.heading, `unknown disposition '${e.disposition}'`);
    if (!f.Addresses) err(e.heading, 'missing **Addresses:**');
    if (!f.Author) err(e.heading, 'missing **Author:**');
    for (const slug of e.addresses) if (!known.has(slug)) err(e.heading, `Addresses unknown slug '${slug}' (not in findings.yaml or carried_forward)`);
    if (REQUIRE_COMMIT.has(e.disposition) && !e.commits.length) err(e.heading, `disposition ${e.disposition} requires **Commit:** with a SHA`);
    if (e.disposition === 'fixed') {
      if (!f.Verification) err(e.heading, 'fixed requires **Verification:** (workspace-scope commands and results)');
      else {
        const wantWorkspace = testCommand ? f.Verification.includes(testCommand) : /--workspace|just test|just check|workspace/.test(f.Verification);
        if (!wantWorkspace) warn(e.heading, `Verification does not cite the workspace-scope gate${testCommand ? ` (${testCommand})` : ''}`);
      }
      if (!f.Diff) err(e.heading, 'fixed requires **Diff:** "N files, +I −D, C commits"');
      else {
        const m = f.Diff.match(/(\d+)\s+files?,\s*\+(\d+)\s+[−-](\d+),\s*(\d+)\s+commits?/);
        if (!m) err(e.heading, `Diff not parseable: '${f.Diff}'`);
        else {
          const [files, ins, , commits] = m.slice(1).map(Number);
          const smallest = e.addresses.map(s => known.get(s)?.effort).filter(Boolean).sort((a, b) => ['trivial', 'small', 'medium', 'large'].indexOf(a) - ['trivial', 'small', 'medium', 'large'].indexOf(b))[0];
          if ((['trivial', 'small'].includes(smallest) && (files > 10 || ins > 500)) || commits > 3) warn(e.heading, `diff budget exceeded for effort=${smallest ?? '?'} (${files} files, +${ins}, ${commits} commits); consider disposition escalated and human sign-off`);
        }
      }
      if (!f['Blast radius']) err(e.heading, 'fixed requires **Blast radius:** (crates touched vs named; reverse deps; co-varying docs/tests)');
      if (!f['Coverage lost'] && /\btests?\b/i.test(e.body) && /\b(replace|rewrit|remov|delet)/i.test(e.body)) warn(e.heading, 'entry mentions changing tests; state **Coverage lost:** (or "none")');
    }
    if (e.disposition === 'deferred' && !/(milestone|target|issue|#\d+|\d{4}-\d{2})/i.test(e.body)) err(e.heading, 'deferred requires a target (milestone, issue, or date) in the body');
    if ((e.disposition === 'disputed' || e.disposition === 'accepted') && e.body.replace(/\*\*[^*]+:\*\*.*\n/g, '').trim().length < 40) err(e.heading, `${e.disposition} requires a substantive rationale`);
    if (gitLog) {
      for (const sha of e.commits) {
        const info = gitLog(sha);
        if (!info.exists) { err(e.heading, `commit ${sha} not found in target repo (squash-merge? record the merge SHA)`); continue; }
        for (const slug of e.addresses) if (!info.trailers.includes(slug)) warn(e.heading, `commit ${sha} lacks 'Audit-Finding: ${slug}' trailer`);
      }
    }
  }
  return out;
}
