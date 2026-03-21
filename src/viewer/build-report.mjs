import YAML from 'yaml';

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
${assessment ? `      <p class="assessment">${escHtml(assessment)}</p>` : ''}
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
export function renderNarrative(narrative) {
  const findingHtml = (narrative.findings || []).map(renderFinding).join('\n');

  return `    <section class="narrative" data-slug="${escHtml(narrative.slug)}">
      <h2>${escHtml(narrative.title)}</h2>
      <p class="thesis">${escHtml(narrative.thesis)}</p>
${findingHtml}
      <p class="verdict">${escHtml(narrative.verdict)}</p>
    </section>`;
}

/**
 * Render a single finding as an <article> element.
 * @param {object} finding
 * @returns {string}
 */
function renderFinding(finding) {
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

  const chainLinks = [...enables, ...enabledBy, ...related];
  const chainHtml = chainLinks.length > 0
    ? `
        <div class="chain-references">
          ${chainLinks.map(slug => `<a href="#${escHtml(slug)}" class="chain-link">${escHtml(slug)}</a>`).join('\n          ')}
        </div>`
    : '';

  return `      <article id="${escHtml(finding.slug)}" class="finding" data-slug="${escHtml(finding.slug)}" data-concern="${escHtml(finding.concern)}">
        <h3>${escHtml(finding.title)}</h3>
        <div class="finding-meta">
          <span class="concern-badge" data-concern="${escHtml(finding.concern)}">${escHtml(finding.concern)}</span>
          ${locationCodes}${sparkline}
        </div>
        <div class="mechanism">
          <p>${escHtml(finding.mechanism)}</p>
        </div>
        <pre class="evidence"><code>${escHtml(finding.evidence)}</code></pre>${chainHtml}
        <div class="remediation">
          <p>${escHtml(finding.remediation)}</p>
        </div>
      </article>`;
}

/**
 * Generate the remediation ledger <section> with a summary table.
 * One row per finding, grouped by narrative. Columns: slug, concern, location, effort, chains.
 * @param {object} findings — parsed findings object
 * @returns {string}
 */
export function renderLedger(findings) {
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
        ? allChains.map(slug => `<a href="#${escHtml(slug)}">${escHtml(slug)}</a>`).join('<br>')
        : '—';

      rows.push(`        <tr>
          <td><a href="#${escHtml(finding.slug)}">${escHtml(finding.slug)}</a></td>
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
