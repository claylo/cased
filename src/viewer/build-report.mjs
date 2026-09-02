import YAML from 'yaml';
import { readFileSync, existsSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core'
import { toHtml } from '@expressive-code/core/hast'
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers'
import { pluginFrames } from '@expressive-code/plugin-frames'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import { pluginPrebuiltShiki } from './shiki-plugin.js'
import { getHighlighter, inferLangFromPath } from './highlighter.js'
import { flowToSvg } from './flow-to-svg.js'
import githubLightTheme from '@shikijs/themes/github-light'
import { findPriorAudits } from './prior-audits.mjs'
import {
  checkEvidenceFidelity,
  checkSummaryCounts,
  concernCounts,
  checkReadmeComplete,
  checkAuditProfile,
  isBlocking,
  lintLedger,
  allFindings,
} from './gates.mjs'
import { execFileSync } from 'node:child_process'

// Re-export for tests
export { inferLangFromPath } from './highlighter.js'

// Required top-level fields per findings.schema.json
const FINDINGS_REQUIRED = ['audit_date', 'scope', 'commit', 'assessment', 'narratives'];

/**
 * Parse and validate a findings YAML string.
 * Throws with a descriptive message if required fields are missing.
 * @param {string} yamlStr
 * @returns {object}
 */
export function parseFindings(yamlStr) {
  const data = YAML.parse(yamlStr);
  for (const field of FINDINGS_REQUIRED) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`findings YAML missing required field: ${field}`);
    }
  }
  if (!Array.isArray(data.narratives)) {
    throw new Error('findings YAML: narratives must be an array');
  }
  // summary.counts is optional and, when present, only ever checked against
  // the findings (checkSummaryCounts) — the renderers derive the histogram.
  return data;
}

/**
 * Parse a recon YAML string. Embedded as-is into the report data blob.
 * @param {string} yamlStr
 * @returns {object}
 */
export function parseRecon(yamlStr) {
  return YAML.parse(yamlStr);
}

/**
 * Resolve the directory containing recon.schema.json and findings.schema.json.
 * Tries several candidate locations in both the source tree and the shipped
 * skill layout, returning the first directory that contains both schemas.
 * @param {string} startDir — typically the directory of this script
 * @returns {string|null}
 */
export function resolveSchemaDir(startDir) {
  const candidates = [
    join(startDir, '..', 'schemas'),            // src/viewer -> src/schemas
    join(startDir, '..', 'references'),         // skills/cased/scripts -> skills/cased/references
    join(startDir, '..', 'src', 'schemas'),     // build -> src/schemas (bundled at repo root)
    join(startDir, '..', 'skills', 'cased', 'references'), // build -> skills/cased/references
    join(startDir, 'references'),               // fallback: references next to the script
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'recon.schema.json')) &&
        existsSync(join(c, 'findings.schema.json'))) {
      return c;
    }
  }
  return null;
}

/**
 * Compile recon and findings schema validators from a schema directory.
 * @param {string} schemaDir
 * @returns {{validateRecon: Function, validateFindings: Function}}
 */
export function compileValidators(schemaDir) {
  const ajv = new Ajv2020.default({ allErrors: true, strict: false });
  addFormats.default(ajv);

  const reconSchema = JSON.parse(
    readFileSync(join(schemaDir, 'recon.schema.json'), 'utf8')
  );
  const findingsSchema = JSON.parse(
    readFileSync(join(schemaDir, 'findings.schema.json'), 'utf8')
  );

  return {
    validateRecon: ajv.compile(reconSchema),
    validateFindings: ajv.compile(findingsSchema),
  };
}

/**
 * Validate one YAML file against a compiled ajv validator. Returns an array
 * of error records. Empty array means the file is valid.
 * @param {string} filePath
 * @param {string} fileLabel — short label for error messages (e.g., "recon.yaml")
 * @param {Function} validator — an ajv-compiled validate function
 * @returns {Array<{file: string, instancePath: string, message: string, params: object}>}
 */
export function validateYamlFile(filePath, fileLabel, validator) {
  if (!existsSync(filePath)) {
    return [{
      file: fileLabel,
      instancePath: '',
      message: `file not found: ${filePath}`,
      params: {},
    }];
  }
  const content = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = YAML.parse(content);
  } catch (e) {
    return [{
      file: fileLabel,
      instancePath: '',
      message: `YAML parse error: ${e.message}`,
      params: {},
    }];
  }
  const valid = validator(data);
  if (valid) return [];
  return (validator.errors || []).map(err => ({
    file: fileLabel,
    instancePath: err.instancePath || '/',
    message: err.message || 'schema violation',
    params: err.params || {},
  }));
}

/**
 * Validate an audit directory's recon.yaml and findings.yaml against their
 * schemas. Returns a flat array of errors across both files; empty on success.
 * @param {string} auditDir
 * @param {string} schemaDir
 * @returns {Array<object>}
 */
export function validateAuditDir(auditDir, schemaDir) {
  const { validateRecon, validateFindings } = compileValidators(schemaDir);
  const errors = [];
  errors.push(...validateYamlFile(
    join(auditDir, 'recon.yaml'),
    'recon.yaml',
    validateRecon,
  ));
  errors.push(...validateYamlFile(
    join(auditDir, 'findings.yaml'),
    'findings.yaml',
    validateFindings,
  ));
  return errors;
}

/**
 * Format validation errors for terminal display. Groups by file, prefixes
 * each error with its instance path.
 * @param {Array<object>} errors
 * @returns {string}
 */
export function formatValidationErrors(errors) {
  if (errors.length === 0) return '';
  const byFile = new Map();
  for (const e of errors) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e);
  }
  const lines = [];
  for (const [file, errs] of byFile) {
    lines.push(`${file}: ${errs.length} error${errs.length === 1 ? '' : 's'}`);
    for (const e of errs) {
      const path = e.instancePath || '/';
      lines.push(`  ${path} — ${e.message}`);
      if (e.params && Object.keys(e.params).length > 0) {
        lines.push(`    params: ${JSON.stringify(e.params)}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * HTML-escape a string.
 * @param {string} s
 * @returns {string}
 */
export function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render inline prose: convert markdown-ish patterns to HTML, then escape remaining text.
 * Order matters: extract markdown patterns first, escape the rest.
 */
export function renderProse(s) {
  if (s == null) return '';
  const str = String(s);

  const tokens = [];
  let lastIndex = 0;
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(escHtml(str.slice(lastIndex, match.index)));
    }
    if (match[1] !== undefined) {
      const href = safeHref(match[2]);
      tokens.push(href === null
        ? escHtml(match[1])
        : `<a href="${escHtml(href)}" rel="noopener noreferrer">${escHtml(match[1])}</a>`);
    } else if (match[3] !== undefined) {
      tokens.push(`<strong>${escHtml(match[3])}</strong>`);
    } else if (match[4] !== undefined) {
      tokens.push(`<code>${escHtml(match[4])}</code>`);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < str.length) {
    tokens.push(escHtml(str.slice(lastIndex)));
  }
  return tokens.join('');
}

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Return the href to emit for a model-authored markdown link, or null when
 * the link must be rendered as plain text. Prose is untrusted input (it is
 * written by agents that have read an untrusted repository), so only an
 * allowlist of schemes plus fragments and relative paths become anchors.
 * The URL parser is used for the scheme decision so that whitespace, case
 * and control-character disguises (` javascript:`, `java\tscript:`) resolve
 * the way a browser would resolve them.
 */
export function safeHref(raw) {
  const href = String(raw ?? '').trim();
  if (!href) return null;
  let parsed;
  try { parsed = new URL(href, 'https://relative.invalid/base/'); } catch { return null; }
  if (parsed.host === 'relative.invalid') {
    // resolved against the placeholder base: a fragment or a relative path
    return parsed.protocol === 'https:' ? href : null;
  }
  return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? href : null;
}

/**
 * Format a location object as a title string for code frames.
 * @param {object} location
 * @returns {string}
 */
export function formatLocationTitle(location) {
  if (!location?.path) return ''
  const ls = location.start_line;
  const le = location.end_line;
  if (le) return `${location.path}:${ls}-${le}`
  if (ls) return `${location.path}:${ls}`
  return location.path
}

/**
 * Build an EC meta string from an array of marker objects.
 * @param {Array} markers — [{lines, type, label}, ...]
 * @returns {string}
 */
export function buildMetaString(markers) {
  if (!markers || markers.length === 0) return ''
  const grouped = {}
  const labels = []
  for (const m of markers) {
    if (!grouped[m.type]) grouped[m.type] = []
    grouped[m.type].push(m.lines)
    if (m.label) labels.push(`"${m.label}"`)
  }
  const parts = []
  for (const [type, lines] of Object.entries(grouped)) {
    parts.push(`${type}={${lines.join(',')}}`)
  }
  return [...parts, ...labels].join(' ')
}

/**
 * Create a configured ExpressiveCode engine instance.
 */
async function createEC() {
  const highlighter = await getHighlighter()
  const githubLight = githubLightTheme

  return new ExpressiveCodeEngine({
    themes: [new ExpressiveCodeTheme(githubLight)],
    plugins: [
      pluginPrebuiltShiki({ highlighter }),
      pluginTextMarkers(),
      pluginFrames(),
      pluginLineNumbers(),
    ],
    defaultProps: {
      showLineNumbers: true,
    },
    useDarkModeMediaQuery: false,
    themeCssSelector: false,
  })
}

/**
 * Render a finding's evidence block with expressive-code.
 */
async function renderEvidence(ec, finding) {
  const lang = finding.evidence_lang || inferLangFromPath(finding.locations?.[0]?.path)
  const meta = buildMetaString(finding.evidence_markers)
  const title = formatLocationTitle(finding.locations?.[0])

  const { renderedGroupAst, styles } = await ec.render({
    code: (finding.evidence || '').trimEnd(),
    language: lang,
    meta,
    props: {
      title: title || undefined,
      showLineNumbers: true,
      startLineNumber: finding.locations?.[0]?.start_line ?? 1,
    },
  })

  return { html: toHtml(renderedGroupAst), styles }
}

/**
 * Generate the <header> HTML fragment.
 * @param {object} findings — parsed findings object
 * @returns {string}
 */
/**
 * Build a glossary sidenote from concern levels present in this report.
 */
function buildGlossary(counts, blocking, backlog) {
  const defs = {
    critical: 'active exploitability or data loss path',
    significant: 'meaningful risk under realistic conditions',
    moderate: 'defense-in-depth gap or robustness issue',
    advisory: 'design choice that limits future safety',
    note: 'observation worth recording',
  };
  const lines = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([level]) => `<strong>${escHtml(level)}</strong> \u2014 ${escHtml(defs[level] || level)}`)
    .join('<br>');
  if (!lines) return '';
  return `<span class="sidenote glossary"><strong>Concern levels</strong><br>${lines}<br><br>Blocking: ${blocking} &middot; Backlog: ${backlog}<br><br>Each <strong>surface</strong> groups findings into a coherent concern area, not a category.</span>`;
}

export function renderHeader(findings) {
  // Derived from the findings, never read from summary.counts (which the
  // controller used to hand-author and miscount).
  const counts = concernCounts(findings);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const assessment = findings.assessment || '';
  const { blocking, backlog } = blockingCounts(findings);
  const glossary = buildGlossary(counts, blocking, backlog);

  return `    <header>
      <h1>${escHtml(findings.scope || 'Audit')} Audit</h1>
      <p class="meta">${escHtml(findings.audit_date)} &middot; <code>${escHtml((findings.commit || '').slice(0, 12))}</code> &middot; ${escHtml(findings.scope || '')}</p>
${assessment ? `      <p class="assessment">${glossary}${renderProse(assessment)}</p>` : ''}
      <div class="summary-bar">
${Object.entries(counts).filter(([, v]) => v > 0).map(([level, count]) =>
  `        <span class="summary-count" data-concern="${escHtml(level)}">${count} ${escHtml(level)}</span>`
).join('\n')}
        <span class="summary-total">${total} findings</span>
      </div>
    </header>`;
}

/**
 * Generate a narrative <section> with its findings as <article> elements.
 * @param {object} narrative — one element from findings.narratives
 * @param {object} slugToTitle — slug-to-title map for chain references
 * @param {object} ec — ExpressiveCodeEngine instance
 * @returns {Promise<{html: string, styles: Set}>}
 */
export async function renderNarrative(narrative, slugToTitle, ec, auditDir) {
  const findingHtmls = [];
  const allStyles = new Set();
  for (const f of (narrative.findings || [])) {
    const { html: evidenceHtml, styles } = await renderEvidence(ec, f);
    for (const s of styles) allStyles.add(s);
    findingHtmls.push(renderFinding(f, slugToTitle, evidenceHtml, auditDir));
  }

  // Flow diagram (if narrative has flow data)
  const flowSvg = narrative.flow ? flowToSvg(narrative.flow, narrative.findings || []) : '';
  const flowHtml = flowSvg ? `\n      <div class="flow-diagram">${flowSvg}</div>` : '';

  const html = `    <section class="narrative" data-slug="${escHtml(narrative.slug)}">
      <h2>${escHtml(narrative.title)}</h2>
      <p class="thesis"><em>${escHtml(narrative.thesis)}</em></p>${flowHtml}
${findingHtmls.join('\n')}
      <p class="verdict"><em>${escHtml(narrative.verdict)}</em></p>
    </section>`;
  return { html, styles: allStyles };
}

/**
 * Render a single finding as an <article> element.
 * @param {object} finding
 * @param {object} slugToTitle
 * @param {string} evidenceHtml — pre-rendered EC evidence block
 * @returns {string}
 */
function renderFinding(finding, slugToTitle, evidenceHtml, auditDir) {
  const temporal = finding.temporal;
  const sparklineSvgPath = auditDir
    ? join(auditDir, 'assets', `sparkline-${finding.slug}.svg`)
    : null;
  const sparkline = sparklineSvgPath && existsSync(sparklineSvgPath)
    ? `<span class="sidenote sparkline"><span class="sparkline-label">12-mo commits</span>${readFileSync(sparklineSvgPath, 'utf8')}</span>`
    : '';

  const chainRefs = finding.chains;
  const enables = (chainRefs && Array.isArray(chainRefs.enables)) ? chainRefs.enables : [];
  const enabledBy = (chainRefs && Array.isArray(chainRefs.enabled_by)) ? chainRefs.enabled_by : [];
  const related = (chainRefs && Array.isArray(chainRefs.related)) ? chainRefs.related : [];

  const chainParts = [];
  if (enables.length > 0) {
    chainParts.push('Enables: ' + enables.map(slug =>
      `<a href="#${escHtml(slug)}" class="chain-ref">${escHtml(slugToTitle?.[slug] || slug)}</a>`
    ).join(', '));
  }
  if (enabledBy.length > 0) {
    chainParts.push('Enabled by: ' + enabledBy.map(slug =>
      `<a href="#${escHtml(slug)}" class="chain-ref">${escHtml(slugToTitle?.[slug] || slug)}</a>`
    ).join(', '));
  }
  if (related.length > 0) {
    chainParts.push('Related: ' + related.map(slug =>
      `<a href="#${escHtml(slug)}" class="chain-ref">${escHtml(slugToTitle?.[slug] || slug)}</a>`
    ).join(', '));
  }
  const sidenoteHtml = chainParts.length > 0
    ? `\n        <span class="sidenote">${chainParts.join('<br>')}</span>`
    : '';

  const effortHtml = finding.effort
    ? `\n        <span class="sidenote">Effort: ${escHtml(finding.effort)}</span>`
    : '';

  return `      <article id="${escHtml(finding.slug)}" class="finding" data-slug="${escHtml(finding.slug)}" data-concern="${escHtml(finding.concern)}">
        <h3>${escHtml(finding.title)}</h3>${sidenoteHtml}${effortHtml}${sparkline}
        <div class="finding-meta">
          <span class="concern-badge" data-concern="${escHtml(finding.concern)}">${escHtml(finding.concern)}</span>
        </div>
        <div class="mechanism">
          <p>${renderProse(finding.mechanism)}</p>
        </div>
        ${evidenceHtml}
        <div class="remediation">
          <p>${renderProse(finding.remediation)}</p>
        </div>
      </article>`;
}

/**
 * Build the <tr> rows for the findings matching a predicate, in narrative order.
 * @param {object} findings — parsed findings object
 * @param {object} slugToTitle — slug-to-title map for chain references
 * @param {(finding: object) => boolean} predicate
 * @returns {string[]}
 */
function ledgerRows(findings, slugToTitle, predicate) {
  const rows = [];

  for (const narrative of (findings.narratives || [])) {
    for (const finding of (narrative.findings || [])) {
      if (!predicate(finding)) continue;
      const locations = finding.locations || [];
      const locationCell = locations.map(loc =>
        `<code>${escHtml(loc.path)}:${escHtml(loc.start_line)}</code>`
      ).join('<br>');

      const effort = finding.effort ? escHtml(finding.effort) : '\u2014';

      const chainRefs = finding.chains;
      const enables = (chainRefs && Array.isArray(chainRefs.enables)) ? chainRefs.enables : [];
      const enabledBy = (chainRefs && Array.isArray(chainRefs.enabled_by)) ? chainRefs.enabled_by : [];
      const related = (chainRefs && Array.isArray(chainRefs.related)) ? chainRefs.related : [];
      const allChains = [...enables, ...enabledBy, ...related];
      const chainsCell = allChains.length > 0
        ? allChains.map(slug => `<a href="#${escHtml(slug)}">${escHtml(slugToTitle?.[slug] || slug)}</a>`).join('<br>')
        : '\u2014';

      rows.push(`        <tr>
          <td><a href="#${escHtml(finding.slug)}">${escHtml(finding.title)}</a></td>
          <td><span class="concern-badge" data-concern="${escHtml(finding.concern)}">${escHtml(finding.concern)}</span></td>
          <td>${locationCell}</td>
          <td>${effort}</td>
          <td>${chainsCell}</td>
        </tr>`);
    }
  }

  return rows;
}

/**
 * Wrap ledger rows in a table, or emit an explicit empty marker.
 * @param {string[]} rows
 * @returns {string}
 */
function ledgerTable(rows) {
  if (rows.length === 0) return '      <p><em>none</em></p>';
  return `      <table class="ledger-table">
        <thead>
          <tr>
            <th>Finding</th>
            <th>Concern</th>
            <th>Location</th>
            <th>Effort</th>
            <th>Chains</th>
          </tr>
        </thead>
        <tbody>
${rows.join('\n')}
        </tbody>
      </table>`;
}

/**
 * Generate the remediation ledger <section>, split into a release-gating
 * Blocking table and a Backlog table. One row per finding, grouped by
 * narrative within each section. Columns: slug, concern, location, effort,
 * chains.
 * @param {object} findings — parsed findings object
 * @param {object} slugToTitle — slug-to-title map for chain references
 * @returns {string}
 */
export function renderLedger(findings, slugToTitle) {
  const blocking = ledgerRows(findings, slugToTitle, f => isBlocking(f));
  const backlog = ledgerRows(findings, slugToTitle, f => !isBlocking(f));

  return `    <section id="remediation-ledger" class="ledger">
      <h2>Remediation Ledger</h2>
      <h3>Blocking</h3>
      <p>critical/significant with a user-visible failure mode — release-gating</p>
${ledgerTable(blocking)}
      <h3>Backlog</h3>
      <p>everything else — triage to the next milestone by default</p>
${ledgerTable(backlog)}
    </section>`;
}

// --- Sparkline SVG generation ---

const SPARK = { w: 80, h: 16, barW: 5, gap: 2, minH: 0.5 };

function sparklineSvg(commits) {
  const max = Math.max(...commits, 1);
  const step = (SPARK.w - SPARK.barW) / (commits.length - 1);
  const bars = commits.map((v, i) => {
    const x = Math.round(i * step);
    const h = v === 0 ? SPARK.minH : Math.max(1, (v / max) * (SPARK.h - 2));
    const y = SPARK.h - h;
    const fill = v === 0 ? '#d1d5db' : v === max ? '#1a1a1a' : '#6b7280';
    return `  <rect x="${x}" y="${y}" width="${SPARK.barW}" height="${h}" style="fill: ${fill};" />`;
  });
  const nonZero = commits.map((v, i) => v > 0 ? `${v} in month ${i + 1}` : null).filter(Boolean);
  const label = `Commit activity: ${nonZero.join(', ') || 'no commits'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPARK.w} ${SPARK.h}" role="img" aria-label="${label}">\n${bars.join('\n')}\n</svg>`;
}

/**
 * Generate sparkline SVGs for all findings with monthly_commits data.
 * Writes to assets/ subdirectory of the audit directory.
 * @param {string} auditDir
 * @param {object} findings — parsed findings object
 * @returns {number} — count of sparklines generated
 */
export function generateSparklines(auditDir, findings) {
  const assetsDir = join(auditDir, 'assets');
  let count = 0;
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
      const commits = f.temporal?.monthly_commits;
      if (!Array.isArray(commits) || commits.length !== 12) continue;
      mkdirSync(assetsDir, { recursive: true });
      const svg = sparklineSvg(commits);
      writeFileSync(join(assetsDir, `sparkline-${f.slug}.svg`), svg);
      count++;
    }
  }
  return count;
}

/**
 * Title-case a kebab-case slug for display ("full-crate" → "Full Crate").
 * @param {string} slug
 * @returns {string}
 */
export function titleFromScope(slug) {
  if (!slug) return '';
  return String(slug)
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Format a single location as a backticked `path:line` or `path:start-end` string.
 * Returns empty string if location is missing or malformed.
 * @param {object} loc
 * @returns {string}
 */
function formatAgentsLocation(loc) {
  if (!loc || !loc.path) return '';
  const start = loc.start_line;
  const end = loc.end_line;
  if (start && end && end !== start) return `\`${loc.path}:${start}-${end}\``;
  if (start) return `\`${loc.path}:${start}\``;
  return `\`${loc.path}\``;
}

/**
 * Render the finding index markdown: narratives as H3 headers, findings as
 * bullet list with slug, concern, and primary location.
 * @param {object} findings — parsed findings YAML
 * @returns {string}
 */
export function renderAgentsFindingList(findings) {
  const lines = [];
  for (const n of findings.narratives || []) {
    if (n.title) {
      lines.push(`### ${n.title}`);
      lines.push('');
    }
    for (const f of (n.findings || [])) {
      const loc = formatAgentsLocation(f.locations?.[0]);
      const concern = f.concern ? ` (${f.concern})` : '';
      const locSuffix = loc ? ` — ${loc}` : '';
      lines.push(`- \`${f.slug}\`${concern}${locSuffix}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Render the carried-forward list: prior findings this audit deliberately did
 * not re-derive. Markdown bullet list; each slug is backticked so it can never
 * be mistaken for a finding-index entry.
 * @param {object} findings — parsed findings YAML
 * @returns {string}
 */
export function renderCarriedForward(findings) {
  const cf = findings.carried_forward ?? [];
  if (!cf.length) return '_None._';
  return cf.map(c => `- \`${c.slug}\` — ${c.disposition} in \`${c.prior_audit}\`${c.reason ? ` — ${c.reason}` : ''}`).join('\n');
}

/**
 * Render the reconciliation table: what happened to prior audits' fixed
 * findings when this audit re-checked them.
 * @param {object} findings — parsed findings YAML
 * @returns {string}
 */
export function renderReconciliation(findings) {
  const rows = findings.reconciliation ?? [];
  if (!rows.length) return '_No prior fixed findings to reconcile._';
  const lines = ['| prior finding | audit | status | verified against |', '|---|---|---|---|'];
  for (const r of rows) {
    lines.push(`| \`${r.prior_slug}\` | \`${r.prior_audit}\` | ${r.status}${r.superseded_by ? ` → \`${r.superseded_by}\`` : ''} | ${r.verified_against ? `\`${r.verified_against}\`` : '—'} |`);
  }
  return lines.join('\n');
}

/**
 * Split this audit's findings into release-gating and backlog counts.
 * @param {object} findings — parsed findings YAML
 * @returns {{blocking: number, backlog: number}}
 */
export function blockingCounts(findings) {
  const all = allFindings(findings);
  const blocking = all.filter(isBlocking).length;
  return { blocking, backlog: all.length - blocking };
}

// Kept short on purpose: the AGENTS.md template prints the pre-publish
// explanation on the following line, so it must not be duplicated here.
const RELEASE_PHASE_UNKNOWN = 'unspecified — ask the maintainer';

/**
 * Render the AGENTS.md content by interpolating a template string with
 * audit metadata and the pre-rendered finding list.
 * @param {object} findings — parsed findings YAML
 * @param {string} templateStr — raw template markdown
 * @param {string} auditSlug — directory basename (e.g. "2026-04-12-14-full-crate")
 * @param {object} [opts]
 * @param {object|null} [opts.recon] — parsed recon YAML, for test command / mode / release phase
 * @param {Array} [opts.priorAudits] — findPriorAudits() records for sibling audits
 * @returns {string}
 */
export function renderAgentsMd(findings, templateStr, auditSlug, { recon = null, priorAudits = [] } = {}) {
  const auditTitle = titleFromScope(findings.scope);
  let findingCount = 0;
  for (const n of findings.narratives || []) {
    findingCount += (n.findings || []).length;
  }
  const findingList = renderAgentsFindingList(findings);

  const { blocking, backlog } = blockingCounts(findings);
  const testCommand = recon?.testing?.command || '<recon.yaml#testing.command not detected — use the project task runner>';
  const mode = recon?.meta?.audit_profile?.mode ?? 'fresh';
  const phase = recon?.meta?.audit_profile?.release_phase;
  const releasePhase = (!phase || phase === 'unspecified') ? RELEASE_PHASE_UNKNOWN : phase;
  const priorList = priorAudits.length
    ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n')
    : '_none_';

  return templateStr
    .replaceAll('{{audit_title}}', auditTitle)
    .replaceAll('{{audit_slug}}', auditSlug)
    .replaceAll('{{audit_scope}}', findings.scope || '')
    .replaceAll('{{audit_date}}', findings.audit_date || '')
    .replaceAll('{{finding_count}}', String(findingCount))
    .replaceAll('{{finding_list}}', findingList)
    .replaceAll('{{blocking_count}}', String(blocking))
    .replaceAll('{{backlog_count}}', String(backlog))
    .replaceAll('{{test_command}}', testCommand)
    .replaceAll('{{mode}}', mode)
    .replaceAll('{{release_phase}}', releasePhase)
    .replaceAll('{{prior_audits}}', priorList)
    .replaceAll('{{carried_forward_list}}', renderCarriedForward(findings));
}

/**
 * Render the README.md scaffold by interpolating the template with audit
 * metadata, concern counts, and the finding index. The scaffold exists to
 * signal to the agent that README.md is the GitHub-rendered narrative
 * companion to report.html — the agent fills in the prose; the script
 * pre-fills structural metadata so the agent knows the scope.
 * @param {object} findings — parsed findings YAML
 * @param {string} templateStr — raw template markdown
 * @param {object} [opts]
 * @param {Array} [opts.priorAudits] — findPriorAudits() records for sibling audits
 * @returns {string}
 */
export function renderReadmeMd(findings, templateStr, { priorAudits = [] } = {}) {
  const auditTitle = titleFromScope(findings.scope);
  const narratives = findings.narratives || [];
  let findingCount = 0;
  for (const n of narratives) {
    findingCount += (n.findings || []).length;
  }
  const counts = concernCounts(findings);
  const findingList = renderAgentsFindingList(findings);
  const { blocking, backlog } = blockingCounts(findings);
  const priorList = priorAudits.length
    ? priorAudits.map(p => `- \`${p.slug}\`${p.hasLedger ? '' : ' — **no actions-taken.md** (findings there are untracked)'}`).join('\n')
    : '_none_';

  return templateStr
    .replaceAll('{{audit_title}}', auditTitle)
    .replaceAll('{{audit_scope}}', findings.scope || '')
    .replaceAll('{{audit_date}}', findings.audit_date || '')
    .replaceAll('{{audit_commit}}', findings.commit || '')
    .replaceAll('{{finding_count}}', String(findingCount))
    .replaceAll('{{narrative_count}}', String(narratives.length))
    .replaceAll('{{finding_list}}', findingList)
    .replaceAll('{{count_critical}}', String(counts.critical ?? 0))
    .replaceAll('{{count_significant}}', String(counts.significant ?? 0))
    .replaceAll('{{count_moderate}}', String(counts.moderate ?? 0))
    .replaceAll('{{count_advisory}}', String(counts.advisory ?? 0))
    .replaceAll('{{count_note}}', String(counts.note ?? 0))
    .replaceAll('{{blocking_count}}', String(blocking))
    .replaceAll('{{backlog_count}}', String(backlog))
    .replaceAll('{{prior_audits}}', priorList)
    .replaceAll('{{reconciliation_table}}', renderReconciliation(findings))
    .replaceAll('{{carried_forward_list}}', renderCarriedForward(findings));
}

/**
 * Mechanical completeness gate for an audit directory. Returns every reason
 * the audit is not finishable: missing build outputs, an unfilled README
 * scaffold, a stub audit_profile, evidence that does not match the source
 * tree, prior audits whose findings were never dispositioned, and (in
 * re-audit mode) a reconciliation block that contradicts the findings.
 * @param {string} auditDir
 * @param {object} [opts]
 * @param {string|null} [opts.repoRoot] — target repo root; falls back to recon.structure.root
 * @param {boolean} [opts.allowUnledgeredPrior] — downgrade unledgered-prior errors to warnings
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function finalizeAudit(auditDir, { repoRoot = null, allowUnledgeredPrior = false } = {}) {
  const errors = [];
  const warnings = [];
  const findingsPath = join(auditDir, 'findings.yaml');
  const reconPath = join(auditDir, 'recon.yaml');
  const readmePath = join(auditDir, 'README.md');
  for (const p of [findingsPath, reconPath, readmePath, join(auditDir, 'report.html'), join(auditDir, 'AGENTS.md')]) {
    if (!existsSync(p)) errors.push(`missing ${basename(p)}`);
  }
  if (errors.length) return { ok: false, errors, warnings };

  const findings = parseFindings(readFileSync(findingsPath, 'utf8'));
  const recon = parseRecon(readFileSync(reconPath, 'utf8'));
  const root = repoRoot ?? recon?.structure?.root ?? join(auditDir, '..', '..', '..');

  errors.push(...checkReadmeComplete(readFileSync(readmePath, 'utf8')));
  errors.push(...checkAuditProfile(recon));
  for (const p of checkSummaryCounts(findings)) {
    errors.push(p.problem === 'unknown-level'
      ? `summary.counts.${p.level} is not a concern level`
      : `summary.counts.${p.level} is ${p.authored} but the findings contain ${p.actual}`);
  }
  for (const p of checkEvidenceFidelity(findings, root)) {
    errors.push(`evidence ${p.problem} for ${p.slug} @ ${p.path}:${p.start_line}-${p.end_line}${p.expected !== undefined ? ` (file: ${JSON.stringify(p.expected)} vs evidence: ${JSON.stringify(p.actual)})` : ''}`);
  }
  // origin refs required for causal kinds (belt-and-braces if the schema's if/then was dropped)
  for (const f of allFindings(findings)) {
    if (f.origin && ['caused-by-fix', 'recurrence-of'].includes(f.origin.kind) && !f.origin.ref) {
      errors.push(`${f.slug}: origin.kind ${f.origin.kind} requires origin.ref`);
    }
  }

  const prior = findPriorAudits(join(auditDir, '..'), basename(auditDir));
  for (const p of prior) {
    if (p.findingCount === null) {
      errors.push(`prior audit ${p.slug} has an unreadable findings.yaml — cannot tell whether its findings were dispositioned`);
      continue;
    }
    if (p.findingCount > 0 && !p.hasLedger) {
      (allowUnledgeredPrior ? warnings : errors).push(`prior audit ${p.slug} has ${p.findingCount} findings and no actions-taken.md — its findings are untracked (pass --allow-unledgered-prior to override)`);
    }
  }

  if (recon?.meta?.audit_profile?.mode === 're-audit') {
    if (!findings.reconciliation) errors.push('re-audit mode but findings.yaml has no reconciliation block — every ledgered prior fix needs a still-fixed/regressed/superseded/not-verified row');
    const regressed = (findings.reconciliation ?? []).filter(r => r.status === 'regressed').map(r => r.prior_slug);
    const recurrences = new Set(allFindings(findings).filter(f => f.origin?.kind === 'recurrence-of').map(f => f.origin.ref));
    for (const s of regressed) {
      if (!recurrences.has(s)) errors.push(`reconciliation marks ${s} regressed but no finding carries origin {kind: recurrence-of, ref: ${s}}`);
    }
  }

  const ledgerPath = join(auditDir, 'actions-taken.md');
  if (existsSync(ledgerPath)) {
    const problems = lintLedger({
      ledgerText: readFileSync(ledgerPath, 'utf8'),
      findingsDoc: findings,
      testCommand: recon?.testing?.command || null,
    });
    for (const p of problems) {
      (p.level === 'error' ? errors : warnings).push(`ledger${p.entry ? ` [${p.entry}]` : ''}: ${p.message}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Assemble a single self-contained report.html from audit YAML, template, CSS, and fonts.
 * @param {string} auditDir — path to audit directory (contains recon.yaml, findings.yaml)
 * @param {object} opts
 * @param {string} opts.viewerDir — path to viewer source directory (contains template.html, style.css)
 * @param {string} opts.fontsDir — path to fonts directory (contains woff2 files)
 * @param {string|null} opts.viewerJs — path to viewer JS bundle, or null to skip
 * @returns {Promise<string>} — assembled HTML
 */
export async function assembleReport(auditDir, opts = {}) {
  const { viewerDir, fontsDir, viewerJs } = opts;

  // Render only a document that passes the schema. The render path escapes
  // its sinks regardless, but the enum-bound fields (concern, failure_mode,
  // audit_date's format) are what the CSS, badges and gates key on, and
  // `validate` is a separate subcommand a session can skip.
  const schemaDir = opts.schemaDir ?? resolveSchemaDir(dirname(fileURLToPath(import.meta.url)));
  if (!schemaDir) throw new Error('cannot locate recon.schema.json and findings.schema.json; refusing to render an unvalidated document');
  const validationErrors = validateAuditDir(auditDir, schemaDir);
  if (validationErrors.length) {
    throw new Error(`refusing to render: ${validationErrors.length} validation error(s)\n${formatValidationErrors(validationErrors)}`);
  }

  const findingsYaml = readFileSync(join(auditDir, 'findings.yaml'), 'utf8');
  const reconYaml = readFileSync(join(auditDir, 'recon.yaml'), 'utf8');

  const findings = parseFindings(findingsYaml);
  const recon = parseRecon(reconYaml);

  // Generate sparkline SVGs before rendering (so inlining can find them)
  const sparkCount = generateSparklines(auditDir, findings);
  if (sparkCount > 0) console.log(`generated ${sparkCount} sparkline SVG(s)`);

  const slugToTitle = {};
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
      slugToTitle[f.slug] = f.title;
    }
  }

  // Create EC instance
  const ec = await createEC();

  // Render content sections (async for EC)
  const headerHtml = renderHeader(findings);
  const narrativeHtmls = [];
  const blockStyles = new Set();
  for (const n of (findings.narratives || [])) {
    const { html, styles } = await renderNarrative(n, slugToTitle, ec, auditDir);
    narrativeHtmls.push(html);
    for (const s of styles) blockStyles.add(s);
  }
  const ledgerHtml = renderLedger(findings, slugToTitle);

  const contentHtml = [headerHtml, ...narrativeHtmls, ledgerHtml].join('\n');

  // Read template and CSS
  const template = readFileSync(join(viewerDir, 'template.html'), 'utf8');
  const css = readFileSync(join(viewerDir, 'style.css'), 'utf8');

  // EC styles
  const ecBaseStyles = await ec.getBaseStyles();
  const ecThemeStyles = await ec.getThemeStyles();
  const ecJsModules = await ec.getJsModules();

  // Base64-encode fonts with font-weight range
  const fontFiles = [
    { file: 'AtkinsonHyperlegibleNextVF-Variable.woff2', family: 'Atkinson Hyperlegible Next' },
    { file: 'AtkinsonHyperlegibleMonoVF-Variable.woff2', family: 'Atkinson Hyperlegible Mono' },
  ];

  const fontFaceDecls = fontFiles.map(({ file, family }) => {
    const fontPath = join(fontsDir, file);
    const b64 = readFileSync(fontPath).toString('base64');
    return `@font-face {
  font-family: '${family}';
  src: url(data:font/woff2;base64,${b64}) format('woff2');
  font-weight: 200 800;
  font-display: swap;
}`;
  }).join('\n');

  const dataBlob = { recon, findings };

  let viewerJsContent = '';
  if (viewerJs && existsSync(viewerJs)) {
    viewerJsContent = readFileSync(viewerJs, 'utf8');
  }
  const ecJsContent = ecJsModules.map(m => typeof m === 'string' ? m : m.code || '').join('\n');

  const title = `Cased Report: ${findings.scope} \u2014 ${findings.audit_date}`;
  const blockCss = [...blockStyles].join('\n');
  const allCss = `${css}\n/* === Expressive Code === */\n${ecBaseStyles}\n${ecThemeStyles}\n${blockCss}`;
  const allJs = `${viewerJsContent}\n${ecJsContent}`;

  const html = fillSlots(template, {
    title: escHtml(title),
    fonts: fontFaceDecls,
    style: allCss,
    content: contentHtml,
    data: embedJson(dataBlob),
    viewer: allJs,
  });

  assertAssembled(html);
  return html;
}

/**
 * Fill `<!-- SLOT:name -->` markers in the template. Function-form replace,
 * deliberately: string-form `String.replace` interprets `$'`, `` $` ``, `$&`
 * and `$n` in the *replacement*, so a shell regex anchor in an evidence block
 * or a JSON-Schema pattern in a remediation splices the surrounding document
 * into itself (2026-08-28 self-audit, finding
 * `template-slot-replace-interprets-dollar-patterns`).
 */
export function fillSlots(template, slots) {
  // Single pass over the TEMPLATE only. Sequential replaces would re-scan
  // already-filled content, and content legitimately contains marker text
  // (a finding quoting this very code; Expressive Code's copy button carries
  // raw source in a data-code attribute).
  const seen = new Set();
  const out = template.replace(/<!-- SLOT:(\w+) -->/g, (marker, name) => {
    if (!(name in slots)) throw new Error(`template has unknown slot marker ${marker}`);
    seen.add(name);
    return slots[name];
  });
  for (const name of Object.keys(slots)) {
    if (!seen.has(name)) throw new Error(`template missing slot marker <!-- SLOT:${name} -->`);
  }
  return out;
}

/**
 * Serialize for embedding inside a `<script type="application/json">` block.
 * The HTML parser ends a script element at the first `</script` regardless
 * of JSON string context, so `<`, `>`, `&` and the JS line terminators
 * U+2028/U+2029 are `\uXXXX`-escaped. Output is still valid JSON.
 */
export function embedJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Structural sanity check on the assembled document. `finalize` cannot see
 * inside report.html, so `build` must refuse to write a corrupt one.
 */
export function assertAssembled(html) {
  const problems = [];
  const doctypes = (html.match(/<!DOCTYPE html>/gi) || []).length;
  if (doctypes !== 1) problems.push(`expected exactly one DOCTYPE, found ${doctypes}`);
  const m = /<script id="cased-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) problems.push('cased-data block missing');
  else {
    try { JSON.parse(m[1]); } catch (e) { problems.push(`cased-data is not valid JSON: ${e.message}`); }
  }
  if (problems.length) throw new Error(`assembled report is corrupt:\n  ${problems.join('\n  ')}`);
}

// CLI entry point (resolve symlinks so skill installs work)
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
    // Parse subcommand: `validate <dir>` or `build <dir>`; bare `<dir>` is
    // treated as `build` for backward compatibility.
    const rawArgs = process.argv.slice(2);
    const SUBCOMMANDS = ['build', 'validate', 'evidence', 'ledger', 'finalize'];
    const positional = rawArgs.filter(a => !a.startsWith('--'));
    let subcommand = 'build';
    let auditDir = positional[0];
    if (SUBCOMMANDS.includes(positional[0])) {
      subcommand = positional[0];
      auditDir = positional[1];
    }

    if (!auditDir) {
      console.error('Usage: node build-report.mjs [build|validate|evidence|ledger|finalize] <audit-directory>');
      console.error('  build     (default) assemble report.html, AGENTS.md, and the README scaffold');
      console.error('  validate  check recon.yaml and findings.yaml against their schemas');
      console.error('  evidence  check every finding\'s evidence block against the tree at findings.commit (working tree if git cannot resolve it)');
      console.error('  ledger    lint actions-taken.md against findings.yaml and git');
      console.error('  finalize  run every gate; refuse to call the audit finished until they pass');
      console.error('            [--allow-unledgered-prior]  downgrade unledgered prior audits to warnings');
      process.exit(1);
    }

    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(scriptDir, '..', '..');

    if (subcommand === 'validate') {
      const schemaDir = resolveSchemaDir(scriptDir);
      if (!schemaDir) {
        console.error('error: cannot locate recon.schema.json and findings.schema.json');
        console.error('  looked near: ' + scriptDir);
        process.exit(2);
      }
      const errors = validateAuditDir(auditDir, schemaDir);
      if (errors.length === 0) {
        console.log(`ok  ${auditDir}/recon.yaml`);
        console.log(`ok  ${auditDir}/findings.yaml`);
        process.exit(0);
      } else {
        console.error(formatValidationErrors(errors));
        console.error(`\n${errors.length} validation error${errors.length === 1 ? '' : 's'}`);
        process.exit(1);
      }
    }

    if (subcommand === 'evidence') {
      const findingsPath = join(auditDir, 'findings.yaml');
      if (!existsSync(findingsPath)) {
        console.error(`error: ${findingsPath} not found`);
        process.exit(2);
      }
      const findings = parseFindings(readFileSync(findingsPath, 'utf8'));
      const recon = existsSync(join(auditDir, 'recon.yaml'))
        ? parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8'))
        : null;
      const problems = checkEvidenceFidelity(findings, recon?.structure?.root ?? join(auditDir, '..', '..', '..'));
      for (const p of problems) {
        console.error(`${p.slug} @ ${p.path}:${p.start_line}-${p.end_line}: ${p.problem}${p.expected !== undefined ? `\n    file:     ${JSON.stringify(p.expected)}\n    evidence: ${JSON.stringify(p.actual)}` : ''}`);
      }
      console.log(problems.length ? `${problems.length} evidence problem(s)` : 'evidence ok');
      process.exit(problems.length ? 1 : 0);
    }

    if (subcommand === 'ledger') {
      const ledgerPath = join(auditDir, 'actions-taken.md');
      if (!existsSync(ledgerPath)) {
        console.error(`error: ${ledgerPath} does not exist`);
        process.exit(1);
      }
      const findingsPath = join(auditDir, 'findings.yaml');
      if (!existsSync(findingsPath)) {
        console.error(`error: ${findingsPath} not found`);
        process.exit(2);
      }
      const findings = parseFindings(readFileSync(findingsPath, 'utf8'));
      const recon = existsSync(join(auditDir, 'recon.yaml'))
        ? parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8'))
        : null;
      const root = recon?.structure?.root ?? join(auditDir, '..', '..', '..');
      const gitLog = sha => {
        try {
          const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%(trailers:key=Audit-Finding,valueonly)', sha], { encoding: 'utf8' });
          return { exists: true, trailers: out.split('\n').map(s => s.trim()).filter(Boolean) };
        } catch (e) {
          // git exits 128 for an unknown object; anything else means git
          // itself could not run and must not read as "commit not found".
          if (e.status === 128) return { exists: false, trailers: [] };
          throw new Error(`git log failed for ${sha} in ${root}: ${e.message}`);
        }
      };
      const out = lintLedger({
        ledgerText: readFileSync(ledgerPath, 'utf8'),
        findingsDoc: findings,
        gitLog,
        testCommand: recon?.testing?.command || null,
      });
      for (const p of out) console[p.level === 'error' ? 'error' : 'warn'](`${p.level}${p.entry ? ` [${p.entry}]` : ''}: ${p.message}`);
      const errs = out.filter(p => p.level === 'error').length;
      console.log(errs ? `${errs} ledger error(s)` : 'ledger ok');
      process.exit(errs ? 1 : 0);
    }

    if (subcommand === 'finalize') {
      const r = finalizeAudit(auditDir, { allowUnledgeredPrior: rawArgs.includes('--allow-unledgered-prior') });
      for (const w of r.warnings) console.warn(`warn: ${w}`);
      for (const e of r.errors) console.error(`error: ${e}`);
      console.log(r.ok ? `finalize ok: ${auditDir}` : `${r.errors.length} finalize error(s)`);
      process.exit(r.ok ? 0 : 1);
    }

    // build subcommand (default)
    // Viewer dir: source layout has template.html alongside this script;
    // skill layout has it in ../templates/ relative to scripts/
    const viewerDirCandidates = [
      scriptDir,
      join(scriptDir, '..', 'templates'),
    ];
    const viewerDir = viewerDirCandidates.find(d => existsSync(join(d, 'template.html')));
    if (!viewerDir) {
      console.error('Cannot find template.html relative to script');
      process.exit(1);
    }
    const fontsDirCandidates = [
      join(viewerDir, 'fonts'),
      join(scriptDir, 'fonts'),
      join(repoRoot, 'vendor', 'fonts'),
    ];
    const fontsDir = fontsDirCandidates.find(d => existsSync(d));
    // Source mode runs from src/viewer/, where viewer.js is the unbundled
    // rolldown entry point (~1 KB stub). The real 25 KB iife bundle lives at
    // build/viewer.js after scripts/build-viewer.sh. Check build/ first so
    // source-mode runs pick up the bundle instead of shadowing it with the
    // stub. Build mode finds the same file via scriptDir; skill install mode
    // falls through to viewerDir (skills/cased/templates/).
    const viewerJsCandidates = [
      join(repoRoot, 'build', 'viewer.js'),
      join(viewerDir, 'viewer.js'),
      join(scriptDir, 'viewer.js'),
    ];
    const viewerJs = viewerJsCandidates.find(p => existsSync(p)) || null;
    const html = await assembleReport(auditDir, {
      viewerDir,
      fontsDir,
      viewerJs,
    });
    const outPath = join(auditDir, 'report.html');
    writeFileSync(outPath, html);
    console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)}KB)`);

    // Write AGENTS.md from template. Template lives next to template.html in
    // both source and skill layouts, so the same viewerDir candidate resolution
    // that found template.html will find this too.
    const findings = parseFindings(readFileSync(join(auditDir, 'findings.yaml'), 'utf8'));
    const buildRecon = parseRecon(readFileSync(join(auditDir, 'recon.yaml'), 'utf8'));
    const priorAudits = findPriorAudits(join(auditDir, '..'), basename(auditDir));
    const agentsTemplatePath = join(viewerDir, 'agents-md-template.md');
    if (existsSync(agentsTemplatePath)) {
      const template = readFileSync(agentsTemplatePath, 'utf8');
      const agentsMd = renderAgentsMd(findings, template, basename(auditDir), { recon: buildRecon, priorAudits });
      const agentsPath = join(auditDir, 'AGENTS.md');
      writeFileSync(agentsPath, agentsMd);
      console.log(`wrote ${agentsPath} (${(agentsMd.length / 1024).toFixed(1)}KB)`);
    } else {
      console.warn(`agents-md-template.md not found at ${agentsTemplatePath}; skipping AGENTS.md`);
    }

    // Write CLAUDE.md importing AGENTS.md so Claude Code sessions launched
    // in the audit directory auto-load the remediation briefing. Written
    // only if absent — a customized CLAUDE.md belongs to the user.
    const claudePath = join(auditDir, 'CLAUDE.md');
    if (existsSync(claudePath)) {
      console.log(`skipped ${claudePath} (already exists)`);
    } else {
      writeFileSync(claudePath, '@AGENTS.md\n');
      console.log(`wrote ${claudePath}`);
    }

    // Write README.md scaffold from template. The scaffold is only written if
    // README.md does not already exist — the agent fills it in with narrative
    // prose and subsequent build-report runs must not clobber that work.
    const readmeTemplatePath = join(viewerDir, 'readme-template.md');
    const readmePath = join(auditDir, 'README.md');
    if (existsSync(readmeTemplatePath)) {
      if (existsSync(readmePath)) {
        console.log(`skipped ${readmePath} (already exists; scaffold never overwrites authored prose)`);
      } else {
        const template = readFileSync(readmeTemplatePath, 'utf8');
        const readmeMd = renderReadmeMd(findings, template, { priorAudits });
        writeFileSync(readmePath, readmeMd);
        console.log(`wrote ${readmePath} (${(readmeMd.length / 1024).toFixed(1)}KB) — scaffold, agent must fill in`);
      }
    } else {
      console.warn(`readme-template.md not found at ${readmeTemplatePath}; skipping README.md`);
    }
  })();
}
