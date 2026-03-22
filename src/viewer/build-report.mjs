import YAML from 'yaml';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

// Required top-level fields per findings.schema.json
const FINDINGS_REQUIRED = ['audit_date', 'scope', 'commit', 'assessment', 'narratives', 'summary'];

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
  if (!data.summary?.counts) {
    throw new Error('findings YAML: summary.counts is required');
  }
  return data;
}

/**
 * Parse and validate a recon YAML string.
 * Throws if the files array is absent.
 * @param {string} yamlStr
 * @returns {object}
 */
export function parseRecon(yamlStr) {
  const data = YAML.parse(yamlStr);
  if (!Array.isArray(data.files)) {
    throw new Error('recon YAML missing required field: files (must be an array)');
  }
  return data;
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
 * Render inline prose: escape HTML, then convert `backticks` to <code> tags.
 */
export function renderProse(s) {
  return escHtml(String(s)).replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Generate the <header> HTML fragment.
 * @param {object} findings — parsed findings object
 * @returns {string}
 */
export function renderHeader(findings) {
  const counts = findings.summary?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const assessment = findings.assessment || '';

  return `    <header>
      <h1>${escHtml(findings.scope || 'Audit')} Audit</h1>
      <p class="meta">${findings.audit_date} &middot; <code>${(findings.commit || '').slice(0, 12)}</code> &middot; ${escHtml(findings.scope || '')}</p>
${assessment ? `      <p class="assessment">${renderProse(assessment)}</p>` : ''}
      <div class="summary-bar">
${Object.entries(counts).filter(([, v]) => v > 0).map(([level, count]) =>
  `        <span class="summary-count" data-concern="${level}">${count} ${level}</span>`
).join('\n')}
        <span class="summary-total">${total} findings</span>
      </div>
    </header>`;
}

/**
 * Generate a narrative <section> with its findings as <article> elements.
 * @param {object} narrative — one element from findings.narratives
 * @returns {string}
 */
export function renderNarrative(narrative, slugToTitle) {
  const findingHtml = (narrative.findings || []).map(f => renderFinding(f, slugToTitle)).join('\n');

  return `    <section class="narrative" data-slug="${escHtml(narrative.slug)}">
      <h2>${escHtml(narrative.title)}</h2>
      <p class="thesis"><em>${escHtml(narrative.thesis)}</em></p>
${findingHtml}
      <p class="verdict"><em>${escHtml(narrative.verdict)}</em></p>
    </section>`;
}

/**
 * Render a single finding as an <article> element.
 * @param {object} finding
 * @returns {string}
 */
function renderFinding(finding, slugToTitle) {
  const locations = finding.locations || [];
  const locationCodes = locations.map(loc =>
    `<code class="location">${escHtml(loc.path)}:${loc.line_start}-${loc.line_end}</code>`
  ).join(' ');

  const monthlyCommits = finding.temporal_context?.monthly_commits;
  const sparkline = Array.isArray(monthlyCommits) && monthlyCommits.length === 12
    ? `\n        <canvas class="sparkline" data-commits="${escHtml(monthlyCommits.join(','))}" width="80" height="20"></canvas>`
    : '';

  // chain_references may be {} (empty object), undefined, or an object with arrays
  const chainRefs = finding.chain_references;
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
  const chainHtml = chainParts.length > 0
    ? `\n        <div class="chains">${chainParts.join(' · ')}</div>`
    : '';

  return `      <article id="${escHtml(finding.slug)}" class="finding" data-slug="${escHtml(finding.slug)}" data-concern="${escHtml(finding.concern)}">
        <h3>${escHtml(finding.title)}</h3>
        <div class="finding-meta">
          <span class="concern-badge" data-concern="${escHtml(finding.concern)}">${escHtml(finding.concern)}</span>
          ${locationCodes}${sparkline}
        </div>
        <div class="mechanism">
          <p>${renderProse(finding.mechanism)}</p>
        </div>
        <pre class="evidence"><code>${escHtml(finding.evidence)}</code></pre>${chainHtml}
        <div class="remediation">
          <p>${renderProse(finding.remediation)}</p>
        </div>
      </article>`;
}

/**
 * Generate the remediation ledger <section> with a summary table.
 * One row per finding, grouped by narrative. Columns: slug, concern, location, effort, chains.
 * @param {object} findings — parsed findings object
 * @returns {string}
 */
export function renderLedger(findings, slugToTitle) {
  const rows = [];

  for (const narrative of (findings.narratives || [])) {
    for (const finding of (narrative.findings || [])) {
      const locations = finding.locations || [];
      const locationCell = locations.map(loc =>
        `<code>${escHtml(loc.path)}:${loc.line_start}</code>`
      ).join('<br>');

      const effort = finding.effort ? escHtml(finding.effort) : '—';

      const chainRefs = finding.chain_references;
      const enables = (chainRefs && Array.isArray(chainRefs.enables)) ? chainRefs.enables : [];
      const enabledBy = (chainRefs && Array.isArray(chainRefs.enabled_by)) ? chainRefs.enabled_by : [];
      const related = (chainRefs && Array.isArray(chainRefs.related)) ? chainRefs.related : [];
      const allChains = [...enables, ...enabledBy, ...related];
      const chainsCell = allChains.length > 0
        ? allChains.map(slug => `<a href="#${escHtml(slug)}">${escHtml(slugToTitle?.[slug] || slug)}</a>`).join('<br>')
        : '—';

      rows.push(`        <tr>
          <td><a href="#${escHtml(finding.slug)}">${escHtml(finding.title)}</a></td>
          <td><span class="concern-badge" data-concern="${escHtml(finding.concern)}">${escHtml(finding.concern)}</span></td>
          <td>${locationCell}</td>
          <td>${effort}</td>
          <td>${chainsCell}</td>
        </tr>`);
    }
  }

  return `    <section class="ledger">
      <h2>Remediation Ledger</h2>
      <table class="ledger-table">
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
      </table>
    </section>`;
}

/**
 * Assemble a single self-contained report.html from audit YAML, template, CSS, and fonts.
 * @param {string} auditDir — path to audit directory (contains recon.yaml, findings.yaml)
 * @param {object} opts
 * @param {string} opts.viewerDir — path to viewer source directory (contains template.html, style.css)
 * @param {string} opts.fontsDir — path to fonts directory (contains woff2 files)
 * @param {string|null} opts.viewerJs — path to viewer JS bundle, or null to skip
 * @returns {string} — assembled HTML
 */
export function assembleReport(auditDir, opts = {}) {
  const { viewerDir, fontsDir, viewerJs } = opts;

  // 1. Read YAML files
  const findingsYaml = readFileSync(join(auditDir, 'findings.yaml'), 'utf8');
  const reconYaml = readFileSync(join(auditDir, 'recon.yaml'), 'utf8');

  // 2. Parse
  const findings = parseFindings(findingsYaml);
  const recon = parseRecon(reconYaml);

  // 3. Build slug→title map for chain reference resolution
  const slugToTitle = {};
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
      slugToTitle[f.slug] = f.title;
    }
  }

  // 4. Render content sections
  const headerHtml = renderHeader(findings);
  const narrativeHtmls = (findings.narratives || []).map(n => renderNarrative(n, slugToTitle));
  const ledgerHtml = renderLedger(findings, slugToTitle);

  // 4. Add terrain map placeholder
  const terrainHtml = `    <section id="terrain-map"><canvas id="terrain-canvas"></canvas></section>`;

  // 5. Concatenate content
  const contentHtml = [headerHtml, terrainHtml, ...narrativeHtmls, ledgerHtml].join('\n');

  // 6. Read template and CSS
  const template = readFileSync(join(viewerDir, 'template.html'), 'utf8');
  const css = readFileSync(join(viewerDir, 'style.css'), 'utf8');

  // 7. Base64-encode fonts and generate @font-face declarations
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
  font-display: swap;
}`;
  }).join('\n');

  // 8. Build JSON data blob
  const dataBlob = { recon, findings };

  // 9. Read viewer JS bundle if provided
  let viewerJsContent = '';
  if (viewerJs && existsSync(viewerJs)) {
    viewerJsContent = readFileSync(viewerJs, 'utf8');
  }

  // 10. Replace SLOT markers
  const title = `Cased Report: ${findings.scope} — ${findings.audit_date}`;
  const html = template
    .replace('<!-- SLOT:title -->', escHtml(title))
    .replace('<!-- SLOT:fonts -->', fontFaceDecls)
    .replace('<!-- SLOT:style -->', css)
    .replace('<!-- SLOT:content -->', contentHtml)
    .replace('<!-- SLOT:data -->', JSON.stringify(dataBlob))
    .replace('<!-- SLOT:viewer -->', viewerJsContent);

  return html;
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const auditDir = process.argv[2];
  if (!auditDir) {
    console.error('Usage: node build-report.mjs <audit-directory>');
    process.exit(1);
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, '..', '..');
  // Resolve assets: check flat layout (bundled in dist/ or skill dir) vs dev layout
  const fontsDir = existsSync(join(scriptDir, 'fonts'))
    ? join(scriptDir, 'fonts')
    : join(repoRoot, 'vendor', 'fonts');
  // Always use the IIFE bundle, never the ESM source. In dev mode (src/viewer/),
  // the bundle is at dist/viewer.js. In bundled mode (dist/ or skill), it's a sibling.
  const viewerJsCandidates = [
    join(repoRoot, 'dist', 'viewer.js'),     // dev mode
    join(scriptDir, 'viewer.iife.js'),        // skill dir (explicit name)
    join(scriptDir, '..', 'templates', 'viewer.js'), // skill: scripts/ -> templates/
  ];
  const viewerJs = viewerJsCandidates.find(p => existsSync(p)) || null;
  const html = assembleReport(auditDir, {
    viewerDir: scriptDir,
    fontsDir,
    viewerJs,
  });
  const outPath = join(auditDir, 'report.html');
  writeFileSync(outPath, html);
  console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)}KB)`);
}
