import YAML from 'yaml';
import { readFileSync, existsSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { ExpressiveCodeEngine, ExpressiveCodeTheme } from '@expressive-code/core'
import { toHtml } from '@expressive-code/core/hast'
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers'
import { pluginFrames } from '@expressive-code/plugin-frames'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import { pluginPrebuiltShiki } from './shiki-plugin.js'
import { getHighlighter, inferLangFromPath } from './highlighter.js'
import { flowToSvg } from './flow-to-svg.js'
import githubLightTheme from '@shikijs/themes/github-light'

// Re-export for tests
export { inferLangFromPath } from './highlighter.js'

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
 * Parse a recon YAML string. Embedded as-is into the report data blob.
 * @param {string} yamlStr
 * @returns {object}
 */
export function parseRecon(yamlStr) {
  return YAML.parse(yamlStr);
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
      tokens.push(`<a href="${escHtml(match[2])}">${escHtml(match[1])}</a>`);
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
function buildGlossary(counts) {
  const defs = {
    critical: 'active exploitability or data loss path',
    significant: 'meaningful risk under realistic conditions',
    moderate: 'defense-in-depth gap or robustness issue',
    advisory: 'design choice that limits future safety',
    note: 'observation worth recording',
  };
  const lines = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([level]) => `<strong>${level}</strong> \u2014 ${defs[level] || level}`)
    .join('<br>');
  if (!lines) return '';
  return `<span class="sidenote glossary"><strong>Concern levels</strong><br>${lines}<br><br>Each <strong>surface</strong> groups findings into a coherent concern area, not a category.</span>`;
}

export function renderHeader(findings) {
  const counts = findings.summary?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const assessment = findings.assessment || '';
  const glossary = buildGlossary(counts);

  return `    <header>
      <h1>${escHtml(findings.scope || 'Audit')} Audit</h1>
      <p class="meta">${findings.audit_date} &middot; <code>${(findings.commit || '').slice(0, 12)}</code> &middot; ${escHtml(findings.scope || '')}</p>
${assessment ? `      <p class="assessment">${glossary}${renderProse(assessment)}</p>` : ''}
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
        `<code>${escHtml(loc.path)}:${loc.start_line}</code>`
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

  return `    <section id="remediation-ledger" class="ledger">
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

  const html = template
    .replace('<!-- SLOT:title -->', escHtml(title))
    .replace('<!-- SLOT:fonts -->', fontFaceDecls)
    .replace('<!-- SLOT:style -->', allCss)
    .replace('<!-- SLOT:content -->', contentHtml)
    .replace('<!-- SLOT:data -->', JSON.stringify(dataBlob))
    .replace('<!-- SLOT:viewer -->', allJs);

  return html;
}

// CLI entry point (resolve symlinks so skill installs work)
if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  (async () => {
    const auditDir = process.argv[2];
    if (!auditDir) {
      console.error('Usage: node build-report.mjs <audit-directory>');
      process.exit(1);
    }
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(scriptDir, '..', '..');
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
    const viewerJsCandidates = [
      join(repoRoot, 'dist', 'viewer.js'),
      join(viewerDir, 'viewer.js'),
      join(scriptDir, 'viewer.js'),
      join(scriptDir, 'viewer.iife.js'),
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
  })();
}
