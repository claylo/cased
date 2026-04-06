# Cased HTML Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained HTML report viewer for cased audit reports, with rough.js hand-drawn terrain maps, rough-notation scroll annotations, and a presentation mode.

**Architecture:** YAML audit data (recon.yaml, findings.yaml) is rendered to semantic HTML at build time by a node script. Client-side JS adds rough.js terrain map, rough-notation annotations on scroll, sparklines, and a presentation mode. rolldown pre-bundles all JS+deps at dev time so the shipped skill only needs node.

**Tech Stack:** Node.js, rolldown (dev bundler), roughjs, rough-notation, yaml (npm, bundled at dev time), Atkinson Hyperlegible fonts (woff2)

**Spec:** `record/superpowers/specs/2026-03-21-html-viewer-design.md`
**Example data:** `example/2026-03-21-current-repo-review/` (real YAML output to test against)

**Important: The JSON schema is the contract.** The build script validates YAML input against the JSON schema and rejects non-conforming data. The JSON schemas are prescriptive — they define what YAML producers (the skill, agents) **must** emit. If existing example data doesn't conform, fix the example data rather than weakening the schema.

Known field name decisions (where prose schema and first example diverged — JSON schema locks these down):
- `line_start`/`line_end` (not `start_line`/`end_line`)
- `temporal_context` (not `temporal`)
- `chain_references` (not `chains`)
- Top-level metadata fields (not wrapped in `meta:`)
- `title` is required on findings and narratives
- `assessment` is required on findings (one-paragraph opening assessment)
- `summary.counts` must include all five concern levels (use 0 for absent levels)

---

## File Map

### New files (development repo)

| File | Responsibility |
|---|---|
| `src/cased/references/recon.schema.json` | JSON Schema for recon.yaml |
| `src/cased/references/findings.schema.json` | JSON Schema for findings.yaml |
| `src/viewer/template.html` | HTML shell with slot markers |
| `src/viewer/style.css` | All report CSS (fonts, layout, scroll, presentation) |
| `src/viewer/build-report.mjs` | Node script: YAML → HTML assembly |
| `src/viewer/viewer.js` | Client entry point, ties modules together |
| `src/viewer/terrain-map.js` | rough.js terrain map rendering |
| `src/viewer/annotations.js` | IntersectionObserver + rough-notation |
| `src/viewer/sparklines.js` | rough.js sparkline polylines |
| `src/viewer/slides.js` | Presentation mode: slide construction + nav |
| `scripts/build-viewer.sh` | Dev build: rolldown bundles + copy to skill dir |
| `test/build-report.test.mjs` | Tests for the build script |

### Modified files

| File | Change |
|---|---|
| `Justfile` | Add `build-viewer` and `build-report` targets |
| `.gitignore` | Add `dist/` |

---

### Task 1: JSON Schemas

Write JSON Schema files that define the structural contract for the YAML artifacts. These schemas must match the **actual** output format (as seen in `example/2026-03-21-current-repo-review/`), not the aspirational prose schemas.

**Files:**
- Create: `src/cased/references/findings.schema.json`
- Create: `src/cased/references/recon.schema.json`
- Reference: `example/2026-03-21-current-repo-review/findings.yaml`
- Reference: `example/2026-03-21-current-repo-review/recon.yaml`
- Reference: `src/cased/references/findings-schema.yaml.md`
- Reference: `src/cased/references/recon-schema.yaml.md`

- [ ] **Step 1: Write findings.schema.json**

Create `src/cased/references/findings.schema.json`. Model the schema from the real example output. Key field names from the actual data: `audit_date`, `scope`, `commit`, `narratives[]` with `slug`, `title`, `thesis`, `verdict`, `findings[]`. Each finding has: `slug`, `concern`, `locations[]` (with `path`, `line_start`, `line_end`), `evidence`, `mechanism`, `remediation`, `temporal_context` (with `introduced_in`, `introduced_date`, `last_touched_in`), `chain_references` (with `enables[]`, `enabled_by[]`). Summary has `counts` with concern level integers. Optional fields: `effort`, `effort_notes`, `temporal_context.monthly_commits` (array of 12 ints for sparklines).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cased.dev/schemas/findings.schema.json",
  "title": "Cased Findings",
  "type": "object",
  "required": ["audit_date", "scope", "commit", "assessment", "narratives", "summary"],
  "properties": {
    "audit_date": { "type": "string", "format": "date" },
    "scope": { "type": "string" },
    "commit": { "type": "string" },
    "assessment": { "type": "string", "description": "One-paragraph opening assessment of the audit" },
    "narratives": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["slug", "title", "thesis", "verdict", "findings"],
        "properties": {
          "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "title": { "type": "string" },
          "thesis": { "type": "string" },
          "verdict": { "type": "string" },
          "findings": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["slug", "title", "concern", "locations", "evidence", "mechanism", "remediation"],
              "properties": {
                "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
                "title": { "type": "string", "description": "Human-readable finding title" },
                "concern": { "type": "string", "enum": ["critical", "significant", "moderate", "advisory", "note"] },
                "locations": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["path", "line_start", "line_end"],
                    "properties": {
                      "path": { "type": "string" },
                      "line_start": { "type": "integer" },
                      "line_end": { "type": "integer" }
                    }
                  }
                },
                "evidence": { "type": "string" },
                "mechanism": { "type": "string" },
                "remediation": { "type": "string" },
                "effort": { "type": "string", "enum": ["trivial", "small", "medium", "large"] },
                "effort_notes": { "type": "string" },
                "temporal_context": {
                  "type": "object",
                  "properties": {
                    "introduced_in": { "type": "string" },
                    "introduced_date": { "type": "string" },
                    "last_touched_in": { "type": "string" },
                    "monthly_commits": {
                      "type": "array",
                      "items": { "type": "integer" },
                      "minItems": 12,
                      "maxItems": 12
                    }
                  }
                },
                "chain_references": {
                  "type": "object",
                  "properties": {
                    "enables": { "type": "array", "items": { "type": "string" } },
                    "enabled_by": { "type": "array", "items": { "type": "string" } },
                    "related": { "type": "array", "items": { "type": "string" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["counts"],
      "properties": {
        "counts": {
          "type": "object",
          "required": ["critical", "significant", "moderate", "advisory", "note"],
          "properties": {
            "critical": { "type": "integer" },
            "significant": { "type": "integer" },
            "moderate": { "type": "integer" },
            "advisory": { "type": "integer" },
            "note": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write recon.schema.json**

Create `src/cased/references/recon.schema.json`. Model from real output: `audit_date`, `scope`, `commit`, `entry_points[]`, `files[]` (with `path`, `lines`, `last_commit`, `last_commit_date`), `dependency_graph[]` (with `from`, `to[]`), `dependency_manifest`, `git_churn`, `trust_boundaries[]`, `validation`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cased.dev/schemas/recon.schema.json",
  "title": "Cased Recon",
  "type": "object",
  "required": ["audit_date", "scope", "commit", "files"],
  "properties": {
    "audit_date": { "type": "string", "format": "date" },
    "scope": { "type": "string" },
    "commit": { "type": "string" },
    "entry_points": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "kind"],
        "properties": {
          "path": { "type": "string" },
          "kind": { "type": "string" }
        }
      }
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "lines"],
        "properties": {
          "path": { "type": "string" },
          "lines": { "type": "integer" },
          "last_commit": { "type": "string" },
          "last_commit_date": { "type": "string" },
          "monthly_commits": {
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 12,
            "maxItems": 12
          }
        }
      }
    },
    "dependency_graph": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "dependency_manifest": { "type": "object" },
    "git_churn": { "type": "object" },
    "trust_boundaries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["boundary"],
        "properties": {
          "boundary": { "type": "string" },
          "notes": { "type": "string" }
        }
      }
    },
    "validation": { "type": "object" }
  }
}
```

- [ ] **Step 3: Fix example data to conform to schemas**

The example YAML at `example/2026-03-21-current-repo-review/` is missing required fields. Update both files:

**findings.yaml** — add:
- `assessment` field (top-level string, one paragraph summarizing the audit)
- `title` field on each finding (human-readable title)
- `critical: 0` in `summary.counts`

**recon.yaml** — no structural changes needed (schema allows optional fields).

- [ ] **Step 4: Validate schemas against example data**

Write a small validation script and run it:
```bash
node -e "
  import { readFileSync } from 'fs';
  import YAML from 'yaml';
  const f = YAML.parse(readFileSync('example/2026-03-21-current-repo-review/findings.yaml','utf8'));
  const required = ['audit_date','scope','commit','assessment','narratives','summary'];
  for (const k of required) { if (!(k in f)) console.error('findings: missing ' + k); }
  for (const n of f.narratives) {
    for (const fi of n.findings) {
      if (!fi.title) console.error('finding ' + fi.slug + ': missing title');
    }
  }
  const counts = f.summary?.counts || {};
  for (const l of ['critical','significant','moderate','advisory','note']) {
    if (!(l in counts)) console.error('summary.counts: missing ' + l);
  }
  console.log('validation complete');
"
```
Expected: `validation complete` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/cased/references/findings.schema.json src/cased/references/recon.schema.json example/
git commit -m "feat: add JSON schemas for findings and recon YAML, fix example data"
```

---

### Task 2: HTML Template Shell

Create the HTML template with slot markers that the build script fills in. The template is a complete HTML document with placeholders like `<!-- SLOT:style -->`, `<!-- SLOT:content -->`, etc.

**Files:**
- Create: `src/viewer/template.html`

- [ ] **Step 1: Write template.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><!-- SLOT:title --></title>
  <style>
<!-- SLOT:fonts -->
<!-- SLOT:style -->
  </style>
</head>
<body data-mode="scroll">
  <nav id="mode-toggle">
    <button id="toggle-btn" type="button" aria-label="Toggle presentation mode">
      <span class="mode-label" data-mode="scroll">Scroll</span>
      <span class="mode-label" data-mode="present">Present</span>
    </button>
  </nav>

  <main id="report">
<!-- SLOT:content -->
  </main>

  <div id="slides" hidden></div>

  <script id="cased-data" type="application/json">
<!-- SLOT:data -->
  </script>

  <script>
<!-- SLOT:viewer -->
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/template.html
git commit -m "feat: add HTML template shell with slot markers"
```

---

### Task 3: CSS Stylesheet

Create the report stylesheet covering typography, layout, scroll mode, presentation mode, and responsive behavior.

**Files:**
- Create: `src/viewer/style.css`

- [ ] **Step 1: Write style.css**

Implement all CSS for the report viewer. Key sections:

**Reset + base typography:**
- `font-family: 'Atkinson Hyperlegible Next', system-ui, sans-serif`
- Code: `'Atkinson Hyperlegible Mono', ui-monospace, monospace`
- Line height 1.6 for body, 1.4 for code
- Max-width 48rem for main content, centered

**Color tokens as custom properties:**
```css
:root {
  --c-black: #1a1a1a;
  --c-mid: #6b7280;
  --c-light: #d1d5db;
  --c-red: #dc2626;
  --c-green: #059669;
  --c-bg: #fafafa;
}
```

**Header:** Project title, meta line, assessment paragraph, summary bar (flex row of concern counts).

**Narrative sections:** H2 with subtle top border. Thesis in italic.

**Findings:** Article with left border (color keyed to concern via `data-concern` attribute). Concern badge as inline pill. Finding meta as flex row. Evidence as `pre` block with file path. Mechanism and remediation as body text. Chain links as styled anchors.

**Remediation ledger:** Clean table, grouped by narrative.

**Terrain map:** Canvas centered, responsive width.

**Sparklines:** Inline canvas, 80x16px, vertical-align middle.

**Mode toggle:** Fixed top-right, subtle button.

**Presentation mode (`[data-mode="present"]`):**
- `main#report` hidden
- `#slides` visible, full viewport
- Slide frames: centered, max-width, vertical centering
- Slide counter fixed bottom-right
- Navigation areas: left/right thirds of viewport

**Print styles:** Hide mode toggle, hide slides container, ensure grayscale-safe output.

- [ ] **Step 2: Commit**

```bash
git add src/viewer/style.css
git commit -m "feat: add report viewer CSS with scroll and presentation modes"
```

---

### Task 4: Build Report Script — YAML Parsing + HTML Generation

The core build script that reads YAML, validates it, and generates the HTML content fragments. This task covers the YAML → HTML rendering logic. Task 5 handles assembly.

**Files:**
- Create: `src/viewer/build-report.mjs`
- Reference: `src/cased/references/findings.schema.json`
- Reference: `src/cased/references/recon.schema.json`
- Reference: `example/2026-03-21-current-repo-review/findings.yaml`
- Reference: `example/2026-03-21-current-repo-review/recon.yaml`
- Create: `test/build-report.test.mjs`

- [ ] **Step 1: Write the test**

Create `test/build-report.test.mjs` using `node:test` and `node:assert`. Tests:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-report.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement build-report.mjs — parsing functions**

Create `src/viewer/build-report.mjs` with exports: `parseFindings(yamlStr)`, `parseRecon(yamlStr)`. These parse YAML strings and return JS objects. Validate required fields are present, throw with clear messages if not.

```javascript
import YAML from 'yaml';

export function parseFindings(yamlStr) {
  const data = YAML.parse(yamlStr);
  if (!data.narratives) throw new Error('findings.yaml: missing "narratives" array');
  if (!data.summary) throw new Error('findings.yaml: missing "summary" object');
  return data;
}

export function parseRecon(yamlStr) {
  const data = YAML.parse(yamlStr);
  if (!data.files) throw new Error('recon.yaml: missing "files" array');
  return data;
}
```

- [ ] **Step 4: Implement renderHeader(findings)**

Generate the report header HTML: `<header>` with H1, meta paragraph, assessment, and summary bar.

```javascript
export function renderHeader(findings) {
  const counts = findings.summary?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const assessment = findings.assessment || '';

  return `    <header>
      <h1>${escHtml(findings.scope || 'Audit')} Audit</h1>
      <p class="meta">${findings.audit_date} &middot; <code>${(findings.commit || '').slice(0, 12)}</code> &middot; ${escHtml(findings.scope || '')}</p>
${assessment ? `      <p class="assessment">${escHtml(assessment)}</p>` : ''}
      <div class="summary-bar">
${Object.entries(counts).filter(([,v]) => v > 0).map(([level, count]) =>
  `        <span class="summary-count" data-concern="${level}">${count} ${level}</span>`
).join('\n')}
        <span class="summary-total">${total} findings</span>
      </div>
    </header>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

```

- [ ] **Step 5: Implement renderNarrative(narrative)**

Generate a narrative `<section>` with all its findings as `<article>` elements.

For each finding, generate:
- Finding article with `data-slug`, `data-concern` attributes
- Finding title from `finding.title` (required by schema)
- Concern badge span
- Location code elements
- Sparkline canvas (only if `temporal_context?.monthly_commits` exists — omit entirely otherwise)
- Mechanism div
- Evidence pre/code block
- Chain reference links — use optional chaining: `finding.chain_references?.enables || []`. The field may be `{}` (empty object), `undefined`, or an object with arrays. Always default to `[]`.
- Remediation div

Escape all user-provided text for HTML safety.

- [ ] **Step 6: Implement renderLedger(findings)**

Generate the remediation ledger `<section>` with a table. One row per finding, grouped by narrative. Columns: slug (linked to anchor), concern, location, effort (if available), chains.

- [ ] **Step 7: Run tests**

Run: `node --test test/build-report.test.mjs`
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/viewer/build-report.mjs test/build-report.test.mjs
git commit -m "feat: build-report YAML parsing and HTML generation"
```

---

### Task 5: Build Report Script — Assembly

Add the main CLI entry point to `build-report.mjs` that reads files, calls the renderers, inlines assets, and writes the final `report.html`.

**Files:**
- Modify: `src/viewer/build-report.mjs`
- Reference: `src/viewer/template.html`
- Reference: `src/viewer/style.css`
- Reference: `vendor/fonts/*.woff2`

- [ ] **Step 1: Add test for full assembly**

Add to `test/build-report.test.mjs`:

```javascript
import { assembleReport } from '../src/viewer/build-report.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('assembleReport', () => {
  it('produces valid HTML from example data', () => {
    const html = assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null // skip JS inlining for this test
    });
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('@font-face'));
    assert.ok(html.includes('Atkinson'));
    assert.ok(html.includes('cased-data'));
    assert.ok(html.includes('location-truthfulness'));
    assert.ok(html.includes('Remediation Ledger'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-report.test.mjs`
Expected: FAIL — `assembleReport` not exported

- [ ] **Step 3: Implement assembleReport()**

Add `assembleReport(auditDir, opts)` to `build-report.mjs`:

1. Resolve paths relative to `auditDir` and the script's own directory
2. Read `recon.yaml` and `findings.yaml` from `auditDir`
3. Call `parseFindings()`, `parseRecon()`
4. Call `renderHeader()`, `renderNarrative()` for each narrative, `renderLedger()`
5. Concatenate all content HTML
6. Read `template.html`
7. Read `style.css`
8. Base64-encode each woff2 font, generate `@font-face` declarations
9. Build JSON data blob from parsed YAML
10. Read `viewer.js` bundle if it exists (optional — allows building without JS for testing)
11. Replace each `<!-- SLOT:xxx -->` marker in the template
12. Return the assembled HTML string

- [ ] **Step 4: Add CLI entry point**

At the bottom of `build-report.mjs`, detect if running as main:

```javascript
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const auditDir = process.argv[2];
  if (!auditDir) {
    console.error('Usage: node build-report.mjs <audit-directory>');
    process.exit(1);
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const html = assembleReport(auditDir, {
    viewerDir: scriptDir,
    fontsDir: join(scriptDir, '..', '..', 'vendor', 'fonts'),
    viewerJs: join(scriptDir, '..', '..', 'dist', 'viewer.js')
  });
  const outPath = join(auditDir, 'report.html');
  writeFileSync(outPath, html);
  console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)}KB)`);
}
```

- [ ] **Step 5: Run tests**

Run: `node --test test/build-report.test.mjs`
Expected: all PASS

- [ ] **Step 6: Test CLI manually**

Run: `node src/viewer/build-report.mjs example/2026-03-21-current-repo-review`
Expected: writes `example/2026-03-21-current-repo-review/report.html`. Open in browser to verify structure renders (no JS features yet — just static HTML with fonts and CSS).

- [ ] **Step 7: Commit**

```bash
git add src/viewer/build-report.mjs test/build-report.test.mjs
git commit -m "feat: build-report assembly with font embedding and CLI entry point"
```

---

### Task 6: Viewer JS — Terrain Map

The rough.js terrain map module. Draws the codebase structure diagram on a canvas element from embedded recon data.

**Files:**
- Create: `src/viewer/terrain-map.js`

- [ ] **Step 1: Write terrain-map.js**

Export a single function `drawTerrainMap(canvas, reconData, findingsData)`.

**Layout algorithm (simple grid):**
1. Collect all unique file paths from `reconData.files`
2. Sort by `lines` descending (largest files first)
3. Compute grid dimensions: `cols = ceil(sqrt(files.length))`, `rows = ceil(files.length / cols)`
4. For each file, compute rectangle position in the grid
5. Rectangle area proportional to `lines` (scale to fit canvas)
6. Determine finding density: count findings per file from `findingsData`
7. Draw with rough.js:
   - `rc.rectangle(x, y, w, h, { stroke: '#1a1a1a', strokeWidth: baseWidth + densityBonus })`
   - Label each rectangle with the short filename (last path segment)

**Edges:**
- From `reconData.dependency_graph`, draw rough.js lines between connected file rectangles
- Line stroke width proportional to number of connections (or use 1 for simple v1)
- Use `rc.line(x1, y1, x2, y2, { stroke: '#6b7280' })`

**Finding density coloring:**
- Files with critical findings: `stroke: '#dc2626'`
- Files with significant findings: slightly thicker stroke
- Files with no findings: default `#1a1a1a`

```javascript
import rough from 'roughjs';

export function drawTerrainMap(canvas, reconData, findingsData) {
  const rc = rough.canvas(canvas);
  const ctx = canvas.getContext('2d');
  // ... layout + drawing logic
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/terrain-map.js
git commit -m "feat: rough.js terrain map renderer"
```

---

### Task 7: Viewer JS — Scroll Annotations

IntersectionObserver-driven rough-notation annotations that fire as findings scroll into view.

**Files:**
- Create: `src/viewer/annotations.js`

- [ ] **Step 1: Write annotations.js**

Export `initAnnotations()`. Called once on DOMContentLoaded.

1. Query all annotatable elements (concern badges, evidence blocks, thesis paragraphs, chain links)
2. For each element, determine annotation type from the spec's annotation table:
   - `.concern-badge[data-concern="critical"]` → `annotate(el, { type: 'box', color: '#dc2626' })`
   - `.concern-badge[data-concern="significant"]` → `annotate(el, { type: 'underline', color: '#dc2626' })`
   - `.concern-badge[data-concern="moderate"]` → `annotate(el, { type: 'underline', color: '#1a1a1a' })`
   - `pre.evidence` inside `[data-concern="critical"], [data-concern="significant"]` → `annotate(el, { type: 'bracket', color: '#dc2626', brackets: ['left'] })`
   - `a.chain-ref` → `annotate(el, { type: 'circle', color: '#d1d5db' })`
   - `p.thesis` → `annotate(el, { type: 'highlight', color: '#f3f4f6' })`
3. Create a single `IntersectionObserver` with `threshold: 0.3`
4. On intersection, call `annotation.show()` and `unobserve()` the element (fire once)

```javascript
import { annotate } from 'rough-notation';

export function initAnnotations() {
  const annotations = [];
  // ... collect elements, create annotations, set up observer
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/annotations.js
git commit -m "feat: scroll-triggered rough-notation annotations"
```

---

### Task 8: Viewer JS — Sparklines

Tiny rough.js polyline sparklines drawn on inline canvas elements.

**Files:**
- Create: `src/viewer/sparklines.js`

- [ ] **Step 1: Write sparklines.js**

Export `initSparklines()`. Uses the same `IntersectionObserver` pattern as annotations.

1. Query all `canvas.sparkline` elements
2. For each, read `data-commits` attribute (JSON array of 12 integers)
3. On viewport entry, draw a rough.js polyline:
   - Canvas size: 80x16px (set via CSS)
   - Normalize values to canvas height
   - `rc.linearPath(points, { stroke: '#6b7280', strokeWidth: 1.5, roughness: 0.8 })`
4. Unobserve after drawing

```javascript
import rough from 'roughjs';

export function initSparklines() {
  const canvases = document.querySelectorAll('canvas.sparkline');
  // ... observer + drawing logic
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/sparklines.js
git commit -m "feat: rough.js sparkline renderer"
```

---

### Task 9: Viewer JS — Presentation Mode

Slide construction, navigation, and mode switching.

**Files:**
- Create: `src/viewer/slides.js`

- [ ] **Step 1: Write slides.js**

Export `initSlides()`. Handles mode toggle and slide navigation.

**Mode switching:**
- Listen for click on `#toggle-btn`, `p` key (toggle), and `Escape` key (exit to scroll)
- Toggle `data-mode` attribute on `<body>` between `scroll` and `present`
- On switch to `present`: build slides if not already built
- On switch to `scroll` (including Escape): scroll to the DOM position of the current slide's source element

**Slide construction (`buildSlides()`):**
1. Read JSON data from `#cased-data`
2. Create slide elements in `#slides`:
   - Title slide: clone header content
   - Terrain map slide: create full-width canvas, draw terrain map (import from terrain-map.js)
   - For each narrative: intro slide (title + thesis), finding slides (clone article elements), verdict slide
   - Ledger slide: clone ledger table
3. Store source element references for scroll-back

**Navigation:**
- Arrow keys (left/right), click left/right thirds
- Track current slide index
- Update slide counter display
- On slide entry: trigger rough-notation annotations for that slide's elements

```javascript
import { drawTerrainMap } from './terrain-map.js';
import { annotate } from 'rough-notation';

export function initSlides() {
  // ... mode toggle, slide construction, navigation
}
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/slides.js
git commit -m "feat: presentation mode with slide navigation"
```

---

### Task 10: Viewer JS — Entry Point

The main viewer.js that ties all modules together. This is what rolldown bundles into the IIFE.

**Files:**
- Create: `src/viewer/viewer.js`

- [ ] **Step 1: Write viewer.js**

```javascript
import { drawTerrainMap } from './terrain-map.js';
import { initAnnotations } from './annotations.js';
import { initSparklines } from './sparklines.js';
import { initSlides } from './slides.js';

document.addEventListener('DOMContentLoaded', () => {
  // Parse embedded data
  const dataEl = document.getElementById('cased-data');
  const data = dataEl ? JSON.parse(dataEl.textContent) : {};

  // Draw terrain map (above the fold, draw immediately)
  const terrainCanvas = document.getElementById('terrain-canvas');
  if (terrainCanvas && data.recon) {
    drawTerrainMap(terrainCanvas, data.recon, data.findings);
  }

  // Initialize scroll-triggered features
  initAnnotations();
  initSparklines();

  // Initialize presentation mode
  initSlides();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer/viewer.js
git commit -m "feat: viewer entry point wiring all modules"
```

---

### Task 11: Dev Build Script

The rolldown build script that produces self-contained artifacts for the skill directory.

**Files:**
- Create: `scripts/build-viewer.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Write build-viewer.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== bundling viewer.js (client IIFE) ==="
npx rolldown src/viewer/viewer.js --format iife --file dist/viewer.js

echo "=== bundling build-report.js (node script) ==="
npx rolldown src/viewer/build-report.mjs --format cjs --file dist/build-report.js --platform node

echo "=== copying assets to skill directory ==="
mkdir -p src/cased/scripts src/cased/templates/fonts

cp dist/build-report.js src/cased/scripts/build-report.js
cp dist/viewer.js       src/cased/templates/viewer.js
cp src/viewer/template.html src/cased/templates/template.html
cp src/viewer/style.css     src/cased/templates/style.css
cp vendor/fonts/*.woff2     src/cased/templates/fonts/

echo "=== done ==="
ls -lh dist/viewer.js dist/build-report.js
```

- [ ] **Step 2: Add dist/ to .gitignore (if not already present)**

Check `.gitignore` for existing `dist/` entry. If absent, append:
```
dist/
```

- [ ] **Step 3: Make executable and test**

Run: `chmod +x scripts/build-viewer.sh && scripts/build-viewer.sh`
Expected: `dist/viewer.js` and `dist/build-report.js` created, assets copied to skill directory.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-viewer.sh .gitignore
git commit -m "feat: dev build script for rolldown bundling"
```

---

### Task 12: Justfile Wiring

Add build targets to the Justfile.

**Files:**
- Modify: `Justfile`

- [ ] **Step 1: Add targets**

```just
# Build viewer JS bundles and copy to skill directory
build-viewer:
    scripts/build-viewer.sh

# Build a report from an audit directory (dev mode, uses source files)
build-report audit_dir:
    node src/viewer/build-report.mjs {{audit_dir}}

# Build everything: bundle JS, then build report from example data
build-example: build-viewer
    node dist/build-report.js example/2026-03-21-current-repo-review

# Run tests
test:
    node --test test/build-report.test.mjs
```

- [ ] **Step 2: Commit**

```bash
git add Justfile
git commit -m "feat: justfile targets for viewer build and testing"
```

---

### Task 13: Integration Test

End-to-end: build from example data, verify the output works.

**Files:**
- Reference: `example/2026-03-21-current-repo-review/`
- Output: `example/2026-03-21-current-repo-review/report.html`

- [ ] **Step 1: Run the dev build**

Run: `just build-viewer`
Expected: `dist/viewer.js` and `dist/build-report.js` produced without errors.

- [ ] **Step 2: Build example report (dev mode)**

Run: `just build-report example/2026-03-21-current-repo-review`
Expected: `report.html` written to the example directory.

- [ ] **Step 3: Build example report (skill mode)**

Run: `just build-example`
Expected: Same report built using the bundled `dist/build-report.js`.

- [ ] **Step 4: Verify in browser**

Open `example/2026-03-21-current-repo-review/report.html` in a browser. Check:
- [ ] Atkinson Hyperlegible fonts render correctly
- [ ] Terrain map canvas draws with rough.js hand-drawn style
- [ ] Scrolling triggers rough-notation annotations on findings
- [ ] Concern badges get appropriate annotation types (box for critical, underline for significant/moderate)
- [ ] Evidence blocks in critical/significant findings get left brackets
- [ ] Mode toggle switches to presentation mode
- [ ] Slides navigate with arrow keys
- [ ] Slide counter shows correct numbers
- [ ] Escape returns to scroll mode at correct position
- [ ] File is self-contained (works from file:// URL, no network requests)

- [ ] **Step 5: Add report.html to .gitignore**

The generated report should not be committed:
```
example/*/report.html
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore generated report.html in examples"
```
