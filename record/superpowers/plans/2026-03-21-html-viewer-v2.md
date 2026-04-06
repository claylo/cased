# HTML Viewer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the HTML report viewer from a functional prototype into a Tufte-inspired, brand-quality document with syntax-highlighted code, typographic weight hierarchy, and margin sidenotes.

**Architecture:** Build-time rendering via expressive-code with a custom Shiki plugin (no dynamic imports, fully bundleable). CSS-only sidenote layout with a 55/45 text/margin split. Variable font weight replaces decorative borders as the primary hierarchy signal.

**Tech Stack:** `@expressive-code/core`, `@shikijs/core` (JS regex engine, static grammar imports), `@expressive-code/plugin-text-markers`, `@expressive-code/plugin-frames`, `@expressive-code/plugin-line-numbers`, rolldown (CJS bundler)

**Spec:** `record/superpowers/specs/2026-03-21-html-viewer-v2-design.md`

---

## File Structure

| File | Role |
|---|---|
| `src/viewer/shiki-plugin.js` | **New.** Custom EC plugin — adapts a pre-built HighlighterCore to EC's `performSyntaxAnalysis` hook |
| `src/viewer/highlighter.js` | **New.** Creates and exports the pre-built HighlighterCore with static grammar imports + JS regex engine |
| `src/viewer/build-report.mjs` | **Modify.** Integrate EC rendering, async transition, sidenote HTML, @font-face fix, helper functions |
| `src/viewer/annotations.js` | **Modify.** Remove bracket/circle/advisory annotations, keep badge + thesis only |
| `src/viewer/viewer.js` | **Modify.** Add summary pill click-to-scroll |
| `src/viewer/terrain-map.js` | **Modify.** Fix ambiguous labels (use 2-segment paths for mod.rs etc.) |
| `src/cased/templates/style.css` | **Modify.** Cream palette, weight hierarchy, sidenote layout, remove borders, EC overrides |
| `src/cased/references/findings.schema.json` | **Modify.** Add `evidence_lang`, `evidence_markers` |
| `example/2026-03-21-current-repo-review/findings.yaml` | **Modify.** Add `evidence_markers` and `evidence_lang` to example data |
| `test/build-report.test.mjs` | **Modify.** Update tests for async assembleReport, EC output, sidenotes |
| `package.json` | **Modify.** Add new devDependencies |
| `scripts/build-viewer.sh` | **Modify.** No changes to rolldown commands (same entry points), but verify bundle works |

---

### Task 1: Install dependencies and update schema

**Files:**
- Modify: `package.json`
- Modify: `src/cased/references/findings.schema.json:27-69`
- Modify: `example/2026-03-21-current-repo-review/findings.yaml`

- [ ] **Step 1: Install npm packages**

```bash
npm install --save-dev @expressive-code/core @shikijs/core @shikijs/langs @shikijs/themes @expressive-code/plugin-text-markers @expressive-code/plugin-frames @expressive-code/plugin-line-numbers
```

Verify: `package.json` has all seven new devDependencies.

**Important:** After installing, verify the exact import paths for grammars, themes, and `toHtml`:

```bash
node -e "
import('@shikijs/langs/rust').then(m => console.log('langs OK:', typeof m.default));
import('@shikijs/themes/github-light').then(m => console.log('themes OK:', typeof m.default));
import('@expressive-code/core/hast').then(m => console.log('toHtml OK:', typeof m.toHtml)).catch(() =>
  import('@expressive-code/core').then(m => console.log('toHtml from core:', typeof m.toHtml))
);
" --input-type=module
```

If any path fails, check the installed package's `exports` field in its `package.json` and adjust import paths in subsequent tasks accordingly.

- [ ] **Step 2: Add evidence_lang and evidence_markers to findings.schema.json**

After the `"evidence"` property (line 43), add:

```json
"evidence_lang": {
  "type": "string",
  "description": "Language identifier for syntax highlighting. Inferred from locations[0].path extension if absent."
},
"evidence_markers": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "lines": { "type": "string", "description": "Line or range, e.g. '3' or '3-7'" },
      "type": { "type": "string", "enum": ["mark", "ins", "del"] },
      "label": { "type": "string", "description": "Optional label shown on first line of range" }
    },
    "required": ["lines", "type"]
  }
},
```

- [ ] **Step 3: Add markers and language to example findings.yaml**

For the first finding (`curate-validation-suppresses-unresolved-without-suggestion`), add after the `evidence` field:

```yaml
    evidence_lang: rust
    evidence_markers:
      - lines: "3"
        type: del
        label: "only prints when suggestions exist"
```

For the second finding (`main-file-detection-uses-substring-match`), add:

```yaml
    evidence_lang: rust
    evidence_markers:
      - lines: "4"
        type: del
        label: "substring, not identity"
```

For the third finding (`unicode-casefold-offsets-drift-from-source`), add:

```yaml
    evidence_lang: rust
    evidence_markers:
      - lines: "1-3"
        type: mark
      - lines: "5-8"
        type: mark
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/cased/references/findings.schema.json example/2026-03-21-current-repo-review/findings.yaml
git commit -m "feat: add evidence_markers and evidence_lang to findings schema"
```

---

### Task 2: Create the custom Shiki plugin

**Files:**
- Create: `src/viewer/shiki-plugin.js`
- Create: `src/viewer/highlighter.js`

- [ ] **Step 1: Create highlighter.js with static grammar imports**

This file creates a pre-built HighlighterCore with statically imported grammars and the JavaScript regex engine. No dynamic imports anywhere.

```javascript
// src/viewer/highlighter.js
import { createHighlighterCore } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/core/engine/javascript'

// Static grammar imports — bundleable by rolldown
import langRust from '@shikijs/langs/rust'
import langJavaScript from '@shikijs/langs/javascript'
import langTypeScript from '@shikijs/langs/typescript'
import langPython from '@shikijs/langs/python'
import langGo from '@shikijs/langs/go'
import langJava from '@shikijs/langs/java'
import langC from '@shikijs/langs/c'
import langCpp from '@shikijs/langs/cpp'
import langRuby from '@shikijs/langs/ruby'
import langPhp from '@shikijs/langs/php'
import langSwift from '@shikijs/langs/swift'
import langKotlin from '@shikijs/langs/kotlin'
import langToml from '@shikijs/langs/toml'
import langYaml from '@shikijs/langs/yaml'
import langJson from '@shikijs/langs/json'
import langBash from '@shikijs/langs/bash'
import langShell from '@shikijs/langs/shellscript'
import langSql from '@shikijs/langs/sql'
import langCss from '@shikijs/langs/css'
import langHtml from '@shikijs/langs/html'
import langMarkdown from '@shikijs/langs/markdown'
import langDockerfile from '@shikijs/langs/dockerfile'
import langMake from '@shikijs/langs/make'
import langXml from '@shikijs/langs/xml'

const LANGS = [
  langRust, langJavaScript, langTypeScript, langPython, langGo,
  langJava, langC, langCpp, langRuby, langPhp, langSwift, langKotlin,
  langToml, langYaml, langJson, langBash, langShell, langSql,
  langCss, langHtml, langMarkdown, langDockerfile, langMake, langXml,
]

let highlighterPromise = null

/**
 * Get or create the shared highlighter instance.
 * Lazy-initialized, cached. Safe to call multiple times.
 */
export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [],
      langs: LANGS,
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

// Extension-to-language map
const EXT_MAP = {
  '.rs': 'rust', '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
  '.py': 'python', '.go': 'go', '.java': 'java',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.toml': 'toml', '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json', '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.sql': 'sql', '.css': 'css', '.html': 'html', '.htm': 'html',
  '.md': 'markdown', '.xml': 'xml',
}

/**
 * Infer Shiki language identifier from a file path.
 * Returns 'text' if unrecognized.
 */
export function inferLangFromPath(filePath) {
  if (!filePath) return 'text'
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return 'text'
  const ext = filePath.slice(dot).toLowerCase()
  return EXT_MAP[ext] || 'text'
}
```

- [ ] **Step 2: Create shiki-plugin.js**

This is the custom EC plugin (~60 lines) that replaces `@expressive-code/plugin-shiki`. It accepts the pre-built highlighter and uses the `performSyntaxAnalysis` hook.

```javascript
// src/viewer/shiki-plugin.js
import { InlineStyleAnnotation } from '@expressive-code/core'

const FontStyle = { Italic: 1, Bold: 2, Underline: 4, Strikethrough: 8 }

/**
 * Custom expressive-code plugin that uses a pre-built HighlighterCore
 * instead of plugin-shiki's dynamic-import approach.
 *
 * @param {{ highlighter: import('@shikijs/core').HighlighterCore }} options
 * @returns {import('@expressive-code/core').ExpressiveCodePlugin}
 */
export function pluginPrebuiltShiki({ highlighter }) {
  const loadedThemes = new Set()

  return {
    name: 'Shiki',
    hooks: {
      performSyntaxAnalysis: async ({ codeBlock, styleVariants }) => {
        const codeLines = codeBlock.getLines()
        const code = codeBlock.code

        // Resolve language — fall back to 'text' if not loaded
        const loadedLangs = highlighter.getLoadedLanguages()
        const langToUse = loadedLangs.includes(codeBlock.language)
          ? codeBlock.language : 'text'

        for (let vi = 0; vi < styleVariants.length; vi++) {
          const theme = styleVariants[vi].theme
          const themeName = theme.name

          // Load theme into highlighter if not already loaded
          if (!loadedThemes.has(themeName)) {
            await highlighter.loadTheme(theme)
            loadedThemes.add(themeName)
          }

          // Tokenize
          const tokenLines = highlighter.codeToTokensBase(code, {
            lang: langToUse,
            theme: themeName,
          })

          // Map tokens to InlineStyleAnnotation
          tokenLines.forEach((line, lineIndex) => {
            if (lineIndex >= codeLines.length) return
            let charIndex = 0
            line.forEach((token) => {
              const len = token.content.length
              const fs = token.fontStyle || 0
              codeLines[lineIndex].addAnnotation(
                new InlineStyleAnnotation({
                  styleVariantIndex: vi,
                  color: token.color || theme.fg,
                  italic: !!(fs & FontStyle.Italic),
                  bold: !!(fs & FontStyle.Bold),
                  underline: !!(fs & FontStyle.Underline),
                  strikethrough: !!(fs & FontStyle.Strikethrough),
                  inlineRange: { columnStart: charIndex, columnEnd: charIndex + len },
                  renderPhase: 'earliest',
                })
              )
              charIndex += len
            })
          })
        }
      },
    },
  }
}
```

- [ ] **Step 3: Verify imports resolve**

```bash
node -e "
import { ExpressiveCode } from '@expressive-code/core';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
console.log('EC imports OK');
" --input-type=module
```

Expected: `EC imports OK`

- [ ] **Step 4: Commit**

```bash
git add src/viewer/shiki-plugin.js src/viewer/highlighter.js
git commit -m "feat: custom EC shiki plugin with pre-built highlighter"
```

---

### Task 3: Write a test for the EC rendering pipeline

**Files:**
- Modify: `test/build-report.test.mjs`

- [ ] **Step 1: Add test for evidence rendering through EC**

Add a new `describe` block to `test/build-report.test.mjs`:

```javascript
import { inferLangFromPath, buildMetaString, formatLocationTitle } from '../src/viewer/build-report.mjs';

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/build-report.test.mjs
```

Expected: FAIL — `buildMetaString` and `formatLocationTitle` not yet exported from build-report.mjs. (`inferLangFromPath` is re-exported from highlighter.js, which exists after Task 2.)

- [ ] **Step 3: Commit failing test**

```bash
git add test/build-report.test.mjs
git commit -m "test: add tests for EC helper functions (failing)"
```

---

### Task 4: Integrate EC into build-report.mjs

This is the largest task. It modifies `build-report.mjs` to:
- Export and use the helper functions
- Initialize ExpressiveCode with the custom plugin
- Render evidence blocks through EC
- Generate sidenote HTML
- Make `assembleReport` async
- Fix @font-face declarations

**Files:**
- Modify: `src/viewer/build-report.mjs`

- [ ] **Step 1: Add imports and EC initialization**

At the top of `build-report.mjs`, add after existing imports:

```javascript
import { ExpressiveCode, ExpressiveCodeTheme } from '@expressive-code/core'
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers'
import { pluginFrames } from '@expressive-code/plugin-frames'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import { pluginPrebuiltShiki } from './shiki-plugin.js'
import { getHighlighter, inferLangFromPath } from './highlighter.js'

// Re-export for tests
export { inferLangFromPath } from './highlighter.js'
```

**Important:** The `toHtml` function may come from different paths depending on EC version. The import path was verified in Task 1 Step 1. Use whichever path worked:
- Try `import { toHtml } from '@expressive-code/core/hast'` first
- Fallback: `import { toHtml } from '@expressive-code/core'`
- Last resort: install `hast-util-to-html` directly and use `import { toHtml } from 'hast-util-to-html'`

- [ ] **Step 2: Add helper functions**

Add after the existing `renderProse` function:

```javascript
/**
 * Format location for EC title tab.
 * @param {object} location - { path, line_start, line_end }
 * @returns {string}
 */
export function formatLocationTitle(location) {
  if (!location?.path) return ''
  if (location.line_end) return `${location.path}:${location.line_start}-${location.line_end}`
  if (location.line_start) return `${location.path}:${location.line_start}`
  return location.path
}

/**
 * Convert evidence_markers array to EC meta string.
 * @param {Array} markers - [{ lines, type, label }]
 * @returns {string}
 */
export function buildMetaString(markers) {
  if (!markers || markers.length === 0) return ''
  // Group markers by type
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
```

- [ ] **Step 3: Create EC instance factory**

Add a function to create the EC instance (called once per report build):

```javascript
/**
 * Create an ExpressiveCode instance with our custom Shiki plugin.
 * Must be called async (highlighter init). Cache the result.
 */
async function createEC() {
  const highlighter = await getHighlighter()
  // github-light theme
  const githubLight = (await import('@shikijs/themes/github-light')).default

  return new ExpressiveCode({
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
```

Note: The theme import path might be `shiki/themes/github-light.mjs` or `@shikijs/themes/github-light`. Check what's available after install.

- [ ] **Step 4: Add renderEvidence function**

```javascript
/**
 * Render an evidence code block through ExpressiveCode.
 * Returns { html, styles } where html is the rendered <div class="expressive-code">...</div>
 * and styles is a Set of CSS strings for this block.
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
    },
  })

  return { html: toHtml(renderedGroupAst), styles }
}
```

- [ ] **Step 5: Update renderFinding to use EC output and emit sidenotes**

Modify the `renderFinding` function. The key changes:
1. Replace `<pre class="evidence"><code>...</code></pre>` with `{evidenceHtml}` (passed in)
2. Move chain references to `<span class="sidenote">` elements
3. Remove `<code class="location">` from finding-meta (EC title tab handles this)

```javascript
function renderFinding(finding, slugToTitle, evidenceHtml) {
  const monthlyCommits = finding.temporal_context?.monthly_commits;
  const sparkline = Array.isArray(monthlyCommits) && monthlyCommits.length === 12
    ? `<span class="sidenote"><canvas class="sparkline" data-commits="${escHtml(monthlyCommits.join(','))}" width="80" height="20"></canvas></span>`
    : '';

  // Chain references as sidenotes
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
  const sidenoteHtml = chainParts.length > 0
    ? `\n        <span class="sidenote">${chainParts.join('<br>')}</span>`
    : '';

  // Effort in sidenote
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
```

- [ ] **Step 6: Update renderNarrative to pass evidence HTML**

`renderNarrative` must now be async and pass pre-rendered evidence HTML to `renderFinding`:

```javascript
export async function renderNarrative(narrative, slugToTitle, ec) {
  const findingHtmls = [];
  const allStyles = new Set();
  for (const f of (narrative.findings || [])) {
    const { html: evidenceHtml, styles } = await renderEvidence(ec, f);
    for (const s of styles) allStyles.add(s);
    findingHtmls.push(renderFinding(f, slugToTitle, evidenceHtml));
  }

  const html = `    <section class="narrative" data-slug="${escHtml(narrative.slug)}">
      <h2>${escHtml(narrative.title)}</h2>
      <p class="thesis"><em>${escHtml(narrative.thesis)}</em></p>
${findingHtmls.join('\n')}
      <p class="verdict"><em>${escHtml(narrative.verdict)}</em></p>
    </section>`;
  return { html, styles: allStyles };
}
```

- [ ] **Step 7: Make assembleReport async and inject EC CSS**

Key changes to `assembleReport`:
1. Add `async` keyword
2. Create EC instance
3. Await narrative rendering
4. Extract EC base/theme styles and append to CSS
5. Extract EC JS modules and append to viewer JS
6. Fix @font-face declarations to include `font-weight: 200 800`

```javascript
export async function assembleReport(auditDir, opts = {}) {
  const { viewerDir, fontsDir, viewerJs } = opts;

  // 1. Read YAML files
  const findingsYaml = readFileSync(join(auditDir, 'findings.yaml'), 'utf8');
  const reconYaml = readFileSync(join(auditDir, 'recon.yaml'), 'utf8');

  // 2. Parse
  const findings = parseFindings(findingsYaml);
  const recon = parseRecon(reconYaml);

  // 3. Build slug→title map
  const slugToTitle = {};
  for (const n of (findings.narratives || [])) {
    for (const f of (n.findings || [])) {
      slugToTitle[f.slug] = f.title;
    }
  }

  // 4. Create EC instance
  const ec = await createEC();

  // 5. Render content sections (async for EC)
  const headerHtml = renderHeader(findings);
  const narrativeHtmls = [];
  const blockStyles = new Set();
  for (const n of (findings.narratives || [])) {
    const { html, styles } = await renderNarrative(n, slugToTitle, ec);
    narrativeHtmls.push(html);
    for (const s of styles) blockStyles.add(s);
  }
  const ledgerHtml = renderLedger(findings, slugToTitle);

  // 6. Add terrain map placeholder
  const terrainHtml = `    <section id="terrain-map"><canvas id="terrain-canvas"></canvas></section>`;

  // 7. Concatenate content
  const contentHtml = [headerHtml, terrainHtml, ...narrativeHtmls, ledgerHtml].join('\n');

  // 8. Read template and CSS
  const template = readFileSync(join(viewerDir, 'template.html'), 'utf8');
  const css = readFileSync(join(viewerDir, 'style.css'), 'utf8');

  // 9. EC styles
  const ecBaseStyles = await ec.getBaseStyles();
  const ecThemeStyles = await ec.getThemeStyles();
  const ecJsModules = await ec.getJsModules();

  // 10. Base64-encode fonts with font-weight range
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

  // 11. Build JSON data blob
  const dataBlob = { recon, findings };

  // 12. Read viewer JS bundle
  let viewerJsContent = '';
  if (viewerJs && existsSync(viewerJs)) {
    viewerJsContent = readFileSync(viewerJs, 'utf8');
  }
  // Append EC JS modules
  const ecJsContent = ecJsModules.map(m => typeof m === 'string' ? m : m.code || '').join('\n');

  // 13. Replace SLOT markers
  const title = `Cased Report: ${findings.scope} — ${findings.audit_date}`;
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
```

- [ ] **Step 8: Update CLI entry point to async IIFE**

Replace the existing CLI block at the bottom of `build-report.mjs`:

```javascript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const auditDir = process.argv[2];
    if (!auditDir) {
      console.error('Usage: node build-report.mjs <audit-directory>');
      process.exit(1);
    }
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(scriptDir, '..', '..');
    const fontsDir = existsSync(join(scriptDir, 'fonts'))
      ? join(scriptDir, 'fonts')
      : join(repoRoot, 'vendor', 'fonts');
    const viewerJsCandidates = [
      join(repoRoot, 'dist', 'viewer.js'),
      join(scriptDir, 'viewer.iife.js'),
      join(scriptDir, '..', 'templates', 'viewer.js'),
    ];
    const viewerJs = viewerJsCandidates.find(p => existsSync(p)) || null;
    const html = await assembleReport(auditDir, {
      viewerDir: scriptDir,
      fontsDir,
      viewerJs,
    });
    const outPath = join(auditDir, 'report.html');
    writeFileSync(outPath, html);
    console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)}KB)`);
  })();
}
```

- [ ] **Step 9: Run tests**

```bash
node --test test/build-report.test.mjs
```

Fix any import path issues. The `renderNarrative` test (line 40-41) needs updating because the function signature changed (now takes 3 args and is async).

Update the test:

```javascript
describe('renderNarrative', () => {
  it('generates narrative section with findings', async () => {
    const findings = parseFindings(findingsYaml);
    // For testing without EC, create a minimal mock or use null
    // The function will render evidence through EC if passed
    // For a simple test, we call assembleReport which handles EC internally
    const html = await assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    assert.ok(html.includes('data-slug="location-truthfulness"'));
    assert.ok(html.includes('class="finding"'));
    assert.ok(html.includes('concern-badge'));
    // EC output check — should have expressive-code markup instead of <pre class="evidence">
    assert.ok(html.includes('expressive-code'));
  });
});
```

Also update the `assembleReport` test to use `async/await`:

```javascript
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
```

- [ ] **Step 10: Run tests, verify pass**

```bash
node --test test/build-report.test.mjs
```

Expected: All tests pass. EC renders evidence blocks as `<div class="expressive-code">` with syntax highlighting.

- [ ] **Step 11: Commit**

```bash
git add src/viewer/build-report.mjs test/build-report.test.mjs
git commit -m "feat: integrate expressive-code for syntax-highlighted evidence blocks"
```

---

### Task 5: Update CSS — Tufte palette, weight hierarchy, sidenotes, remove borders

**Files:**
- Modify: `src/viewer/style.css` (this is the source of truth — `scripts/build-viewer.sh` copies it to `src/cased/templates/style.css`)

- [ ] **Step 1: Update color tokens**

```css
:root {
  --c-black: #111;
  --c-mid: #6b7280;
  --c-light: #d1d5db;
  --c-red: #dc2626;
  --c-green: #059669;
  --c-bg: #fffff8;
}
```

- [ ] **Step 2: Update body and layout for sidenotes**

```css
main#report {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 2rem 2rem 12%;
}
```

Add main text column constraint (apply to text-bearing elements):

```css
header,
.summary-bar,
section.narrative > h2,
section.narrative > p,
section.ledger {
  max-width: 40rem;
}
```

- [ ] **Step 3: Add sidenote styles**

```css
.sidenote {
  float: right;
  clear: right;
  margin-right: -45%;
  width: 40%;
  font-size: 0.85rem;
  font-weight: 300;
  line-height: 1.4;
  color: var(--c-mid);
  margin-bottom: 0.75rem;
}

.sidenote a {
  color: var(--c-mid);
  text-decoration: underline;
  text-decoration-thickness: 0.05em;
  text-underline-offset: 0.1em;
}

.sidenote a:hover {
  color: var(--c-black);
}
```

- [ ] **Step 4: Update typography weights**

```css
h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--c-black);
  margin-top: 0;
  margin-bottom: 0.5rem;
}

h2 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--c-black);
  margin-top: 0;
  margin-bottom: 0.75rem;
}

p.meta {
  color: var(--c-mid);
  font-size: 0.875rem;
  font-weight: 300;
  margin-top: 0;
  margin-bottom: 0.5rem;
}

p.assessment {
  font-size: 1rem;
  font-weight: 450;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

p.thesis {
  font-style: italic;
  font-weight: 300;
  margin-top: 0;
}

p.verdict {
  font-style: italic;
  font-weight: 300;
  margin-top: 1.5rem;
}

.summary-count {
  font-weight: 500;
  /* ... keep existing padding/border styles ... */
}
```

Add concern-level h3 weights:

```css
article.finding h3 {
  font-weight: 400;
}
article.finding[data-concern="critical"] h3,
article.finding[data-concern="significant"] h3 {
  font-weight: 600;
}
article.finding[data-concern="moderate"] h3 {
  font-weight: 500;
}
```

- [ ] **Step 5: Remove border-left styles, update finding spacing**

Remove all of these rules:
- `article.finding { border-left: 3px solid var(--c-light); padding-left: 1rem; ... }`
- `article.finding[data-concern="critical"] { border-left-color: ... }`
- `article.finding[data-concern="significant"] { border-left-color: ... }`
- `article.finding[data-concern="moderate"] { border-left-color: ... }`
- `article.finding[data-concern="advisory"] { border-left-color: ... }`
- `article.finding[data-concern="note"] { border-left-color: ... }`
- `pre.evidence` styles (replaced by EC)
- `.remediation pre` green left-border accent

Replace the `article.finding` rule with:

```css
article.finding {
  margin-bottom: 3rem;
  max-width: 40rem;
}
```

- [ ] **Step 6: Add EC overrides**

```css
/* Force Atkinson Mono in EC code blocks */
.expressive-code pre,
.expressive-code code {
  font-family: 'Atkinson Hyperlegible Mono', ui-monospace, monospace;
  font-weight: 400;
}

/* Lighter gutter line numbers */
.expressive-code .gutter .ln {
  font-weight: 300;
}

/* EC blocks span full finding width */
article.finding .expressive-code {
  max-width: 40rem;
}
```

- [ ] **Step 7: Update summary pill styles for clickability**

```css
.summary-count {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.2rem 0.6rem;
  border: 1.5px solid var(--c-mid);
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
}
```

- [ ] **Step 8: Update print styles**

Add EC figures to the break-inside-avoid rule:

```css
@media print {
  #mode-toggle,
  #slides,
  .slide-counter {
    display: none;
  }

  main#report {
    max-width: none;
    padding: 2rem;
  }

  article.finding {
    break-inside: avoid;
  }

  .sidenote {
    float: none;
    margin-right: 0;
    width: auto;
    display: block;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add src/viewer/style.css
git commit -m "style: Tufte palette, weight hierarchy, sidenote layout, remove borders"
```

---

### Task 6: Simplify annotations

**Files:**
- Modify: `src/viewer/annotations.js`

- [ ] **Step 1: Update annotation rules**

Replace the entire `rules` array and remove the evidence bracket and chain-ref circle blocks:

```javascript
import { annotate } from 'rough-notation';

export function initAnnotations() {
  const rules = [
    { sel: '.concern-badge[data-concern="critical"]', type: 'box', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="significant"]', type: 'underline', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="moderate"]', type: 'underline', color: '#111' }, // matches --c-black
    { sel: 'p.thesis', type: 'highlight', color: '#f3f4f6' },
  ];

  const annotations = [];

  for (const rule of rules) {
    for (const el of document.querySelectorAll(rule.sel)) {
      annotations.push({
        el,
        annotation: annotate(el, { type: rule.type, color: rule.color, animate: true, animationDuration: 600 })
      });
    }
  }

  // Single IntersectionObserver for all
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const match = annotations.find(a => a.el === entry.target);
        if (match) {
          match.annotation.show();
          observer.unobserve(entry.target);
        }
      }
    }
  }, { threshold: 0.3 });

  for (const { el } of annotations) {
    observer.observe(el);
  }

  return annotations;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/annotations.js
git commit -m "refactor: simplify annotations — badges and thesis only"
```

---

### Task 7: Summary pill click-to-scroll

**Files:**
- Modify: `src/viewer/viewer.js`

- [ ] **Step 1: Add pill click handler in viewer.js**

After the `initSlides()` call, add:

```javascript
  // Summary pill click-to-scroll
  for (const pill of document.querySelectorAll('.summary-count')) {
    const concern = pill.getAttribute('data-concern');
    if (!concern) continue;
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.addEventListener('click', () => {
      const target = document.querySelector(`article.finding[data-concern="${concern}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pill.click();
      }
    });
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/viewer.js
git commit -m "feat: summary pills scroll to first finding of that concern level"
```

---

### Task 8: Fix terrain map labels

**Files:**
- Modify: `src/viewer/terrain-map.js`

- [ ] **Step 1: Update label generation**

In `terrain-map.js`, replace the label generation (around line 115):

```javascript
    // Short label: use 2 segments for ambiguous filenames (mod.rs, lib.rs, main.rs)
    const segments = file.path.split('/');
    const filename = segments.pop() || file.path;
    const AMBIGUOUS = new Set(['mod.rs', 'lib.rs', 'main.rs', 'index.js', 'index.ts', 'mod.ts']);
    const label = (AMBIGUOUS.has(filename) && segments.length > 0)
      ? `${segments.pop()}/${filename}`
      : filename;
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/terrain-map.js
git commit -m "fix: terrain map uses 2-segment labels for ambiguous filenames"
```

---

### Task 9: Improve renderProse

**Files:**
- Modify: `src/viewer/build-report.mjs`

- [ ] **Step 1: Update renderProse to handle bold and links**

Replace the `renderProse` function:

```javascript
/**
 * Render inline prose: convert markdown-ish patterns to HTML, then escape remaining text.
 * Order matters: extract markdown patterns first, escape the rest.
 */
export function renderProse(s) {
  if (s == null) return '';
  const str = String(s);

  // Tokenize: find markdown patterns, escape everything else
  const tokens = [];
  let lastIndex = 0;
  // Combined regex for links, bold, and inline code
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(escHtml(str.slice(lastIndex, match.index)));
    }
    if (match[1] !== undefined) {
      // Link: [text](url)
      tokens.push(`<a href="${escHtml(match[2])}">${escHtml(match[1])}</a>`);
    } else if (match[3] !== undefined) {
      // Bold: **text**
      tokens.push(`<strong>${escHtml(match[3])}</strong>`);
    } else if (match[4] !== undefined) {
      // Inline code: `text`
      tokens.push(`<code>${escHtml(match[4])}</code>`);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < str.length) {
    tokens.push(escHtml(str.slice(lastIndex)));
  }
  return tokens.join('');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/build-report.mjs
git commit -m "feat: renderProse handles bold, links, and inline code"
```

---

### Task 10: Build, test, and verify

**Files:**
- Modify: `scripts/build-viewer.sh` (if needed)

- [ ] **Step 1: Run the report build from source (no rolldown)**

```bash
node src/viewer/build-report.mjs example/2026-03-21-current-repo-review
```

Expected: `wrote example/2026-03-21-current-repo-review/report.html (NNkb)`. The file should be larger than before (~300KB+) due to EC CSS.

- [ ] **Step 2: Open in browser and visually verify**

Open `example/2026-03-21-current-repo-review/report.html` in a browser. Check:
- Cream `#fffff8` background
- Syntax-highlighted evidence blocks with line numbers
- `del`-marked lines (red indicators) on the first finding
- Sidenotes with chain references floating in right margin
- Concern badges with rough-notation animations
- Summary pills scroll to findings on click
- Terrain map labels show `curate/mod.rs` not `mod.rs`
- Weight hierarchy visible: H1 heavier than H2, thesis italic and lighter

- [ ] **Step 3: Run rolldown bundle**

```bash
bash scripts/build-viewer.sh
```

Expected: Both `dist/viewer.js` and `dist/build-report.js` bundle successfully. `dist/build-report.js` will be larger (1-3MB due to grammar data).

- [ ] **Step 4: Test the bundled script**

```bash
node dist/build-report.js example/2026-03-21-current-repo-review
```

Expected: Same output as step 1. The bundled CJS script works identically.

- [ ] **Step 5: Run full test suite**

```bash
node --test test/build-report.test.mjs
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-viewer.sh dist/ src/cased/
git commit -m "build: bundle v2 viewer with EC and Shiki grammars"
```

---

### Task 11: Final cleanup

- [ ] **Step 1: Copy updated style.css to src/viewer/**

The source-of-truth `style.css` is in `src/cased/templates/style.css` but there's also a copy at `src/viewer/style.css`. Keep them in sync — `build-viewer.sh` copies from `src/viewer/` to `src/cased/templates/`. So `src/viewer/style.css` is the source. Verify the build script copies correctly.

- [ ] **Step 2: Remove any dead CSS selectors**

Search `style.css` for selectors that reference removed HTML elements (`.chains`, `pre.evidence`, `.remediation pre` green border). Remove them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up dead CSS selectors and sync assets"
```
