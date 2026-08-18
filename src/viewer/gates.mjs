// Mechanical audit gates. Everything here is deterministic and cheap; the
// point is to take work off the LLM reviewer (which spent ~70% of its
// verdicts on indentation and line ranges) and to refuse to call an audit
// finished while it is structurally incomplete.
import { existsSync, readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

export function isBlocking(finding) {
  const gating = finding.concern === 'critical' || finding.concern === 'significant';
  return gating && (finding.failure_mode ?? 'user-visible') === 'user-visible';
}

export function allFindings(doc) {
  return (doc.narratives ?? []).flatMap(n => n.findings ?? []);
}

function fileLines(repoRoot, p) {
  const abs = isAbsolute(p) ? p : join(repoRoot, p);
  if (!existsSync(abs)) return null;
  const txt = readFileSync(abs, 'utf8');
  return txt.split('\n');
}

export function checkEvidenceFidelity(doc, repoRoot) {
  const problems = [];
  for (const f of allFindings(doc)) {
    const locs = f.locations ?? [];
    if (!locs.length || typeof f.evidence !== 'string') continue;
    const evidence = f.evidence.replace(/\n$/, '').split('\n');
    const expected = [];
    let missing = false;
    for (const loc of locs) {
      const lines = fileLines(repoRoot, loc.path);
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
