// Discover prior audit directories and parse their remediation ledgers.
// Used by re-audit mode (carried_forward / reconciliation inputs) and by
// the finalize gate (a prior audit with findings and no ledger is a
// process failure — findings evaporate; see research doc §2d).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const DISPOSITIONS = ['fixed', 'mitigated', 'accepted', 'disputed', 'deferred', 'escalated', 'superseded', 'no-measurable-benefit'];

export function parseLedger(md) {
  let frontMatter = {};
  let body = md;
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    frontMatter = parseYaml(fm[1]) ?? {};
    body = md.slice(fm[0].length);
  }
  const entries = [];
  // Entries are H2 sections whose body carries a **Disposition:** field.
  const sections = body.split(/^## /m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const heading = sec.slice(0, nl).trim();
    const rest = sec.slice(nl + 1);
    const fields = {};
    for (const m of rest.matchAll(/^\*\*([A-Za-z][A-Za-z -]*?):\*\*\s*(.*)$/gm)) fields[m[1].trim()] = m[2].trim();
    if (!fields.Disposition) continue;
    const disposition = fields.Disposition.toLowerCase().trim();
    const addresses = [...(fields.Addresses ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    const commits = [...(fields.Commit ?? '').matchAll(/\b[0-9a-f]{7,40}\b/g)].map(m => m[0]);
    entries.push({ heading, disposition, addresses, commits, author: fields.Author ?? '', fields, body: rest.trim() });
  }
  return { frontMatter, entries };
}

export function latestDispositions(ledger) {
  const map = new Map();
  ledger.entries.forEach((e, i) => {
    if (!DISPOSITIONS.includes(e.disposition)) return;
    for (const slug of e.addresses) map.set(slug, { disposition: e.disposition, entryIndex: i });
  });
  return map;
}

function countFindings(findingsPath) {
  try {
    const doc = parseYaml(readFileSync(findingsPath, 'utf8')) ?? {};
    return (doc.narratives ?? []).reduce((n, nar) => n + (nar.findings ?? []).length, 0);
  } catch { return 0; }
}

export function findPriorAudits(auditsRoot, currentSlug) {
  if (!existsSync(auditsRoot)) return [];
  return readdirSync(auditsRoot)
    .filter(d => d !== currentSlug && statSync(join(auditsRoot, d)).isDirectory())
    .filter(d => existsSync(join(auditsRoot, d, 'findings.yaml')))
    .sort()
    .map(slug => {
      const dir = join(auditsRoot, slug);
      const ledgerPath = join(dir, 'actions-taken.md');
      const hasLedger = existsSync(ledgerPath);
      return {
        slug, dir, hasFindings: true, hasLedger,
        findingCount: countFindings(join(dir, 'findings.yaml')),
        ledger: hasLedger ? parseLedger(readFileSync(ledgerPath, 'utf8')) : null,
      };
    });
}
