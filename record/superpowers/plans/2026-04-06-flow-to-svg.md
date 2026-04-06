# Flow-to-SVG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-function SVG generator that converts narrative flow YAML into inline SVG diagrams at report build time, replacing the terrain map canvas.

**Architecture:** `flow-to-svg.js` exports `flowToSvg(flow, findings)` which returns an SVG string. Imported by `build-report.mjs` and called inside `renderNarrative()` when a narrative has a `flow` array. Orientation (vertical vs horizontal) auto-selects based on spine step count.

**Tech Stack:** Plain JS, no dependencies. String concatenation for SVG generation. Node test runner for tests.

**Spec:** `record/superpowers/specs/2026-04-06-flow-to-svg-design.md`

---

### Task 1: Module scaffold + shape helpers

**Files:**
- Create: `src/viewer/flow-to-svg.js`
- Create: `test/flow-to-svg.test.mjs`

- [ ] **Step 1: Write tests for edge cases and shape rendering**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { flowToSvg, renderShape } from '../src/viewer/flow-to-svg.js';

describe('flowToSvg', () => {
  it('returns empty string for missing flow', () => {
    assert.equal(flowToSvg(undefined), '');
    assert.equal(flowToSvg(null), '');
    assert.equal(flowToSvg([]), '');
  });

  it('returns empty string when all steps are off-spine', () => {
    const flow = [{ id: 'a', label: 'A', spine: false }];
    assert.equal(flowToSvg(flow), '');
  });
});

describe('renderShape', () => {
  it('renders start as solid circle', () => {
    const svg = renderShape('start', 100, 50);
    assert.ok(svg.includes('circle'));
    assert.ok(svg.includes('fill="#1a1a1a"'));
    assert.ok(!svg.includes('stroke='));
  });

  it('renders end as bull\'s-eye', () => {
    const svg = renderShape('end', 100, 50);
    assert.ok(svg.includes('fill="#1a1a1a"'));
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.split('circle').length - 1 >= 2);
  });

  it('renders process as hollow circle', () => {
    const svg = renderShape('process', 100, 50);
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('defaults to process when type is omitted', () => {
    const svg = renderShape(undefined, 100, 50);
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('renders decision as rotated rect', () => {
    const svg = renderShape('decision', 100, 50);
    assert.ok(svg.includes('rect'));
    assert.ok(svg.includes('rotate(45'));
  });

  it('renders input as polygon', () => {
    const svg = renderShape('input', 100, 50);
    assert.ok(svg.includes('polygon'));
  });

  it('renders store as cylinder', () => {
    const svg = renderShape('store', 100, 50);
    assert.ok(svg.includes('ellipse'));
    assert.ok(svg.split('ellipse').length - 1 >= 2);
  });

  it('renders ref as small gray circle', () => {
    const svg = renderShape('ref', 100, 50);
    assert.ok(svg.includes('fill="#6b7280"'));
    assert.ok(svg.includes('r="3"'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: FAIL with "Cannot find module" or similar

- [ ] **Step 3: Write module with constants, shape helpers, and flowToSvg scaffold**

```js
// src/viewer/flow-to-svg.js

// --- Color/style constants ---
const CONCERN_STYLES = {
  critical:    { stroke: '#dc2626', width: 2.5, fill: '#dc2626', badge: '#dc2626' },
  significant: { stroke: '#dc2626', width: 1.5, fill: '#dc2626', badge: 'rgba(220,38,38,0.7)' },
  moderate:    { stroke: '#1a1a1a', width: 1.5, fill: '#1a1a1a', badge: '#6b7280' },
  advisory:    { stroke: '#6b7280', width: 1,   fill: '#6b7280', badge: '#6b7280' },
  note:        { stroke: '#6b7280', width: 1,   fill: '#6b7280', badge: '#6b7280' },
};

const C = {
  shape: '#1a1a1a',
  shapeFill: '#fffff8',
  spine: '#d1d5db',
  muted: '#6b7280',
};

// Vertical layout
const V = {
  spineX: 150, stepSpacing: 60, labelX: 140,
  connStartX: 157, stemX: 195, textX: 205,
  padY: 24, viewBoxW: 440,
};

// Horizontal layout
const H = {
  spineY: 50, stepSpacing: 120, labelY: 38,
  connEndY: 72, textYStart: 84, chainRefY: 115,
  padX: 50, viewBoxH: 130,
};

const FONT = 'system-ui, -apple-system, sans-serif';

// --- Helpers ---

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Shape renderers ---

export function renderShape(type, x, y) {
  switch (type || 'process') {
    case 'start':
      return `<circle cx="${x}" cy="${y}" r="4" fill="${C.shape}"/>`;
    case 'end':
      return [
        `<circle cx="${x}" cy="${y}" r="4" fill="${C.shape}"/>`,
        `<circle cx="${x}" cy="${y}" r="2" fill="${C.shapeFill}"/>`,
      ].join('\n  ');
    case 'decision':
      return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${C.shapeFill}" stroke="${C.shape}" stroke-width="1.5" transform="rotate(45 ${x} ${y})"/>`;
    case 'input': {
      const w = 5, h = 4, skew = 2;
      return `<polygon points="${x-w+skew},${y-h} ${x+w+skew},${y-h} ${x+w-skew},${y+h} ${x-w-skew},${y+h}" fill="${C.shapeFill}" stroke="${C.shape}" stroke-width="1.5"/>`;
    }
    case 'store': {
      const rx = 6, ry = 3, half = 5;
      return [
        `<ellipse cx="${x}" cy="${y - half}" rx="${rx}" ry="${ry}" fill="${C.shapeFill}" stroke="${C.shape}" stroke-width="1.5"/>`,
        `<line x1="${x - rx}" y1="${y - half}" x2="${x - rx}" y2="${y + half}" stroke="${C.shape}" stroke-width="1.5"/>`,
        `<line x1="${x + rx}" y1="${y - half}" x2="${x + rx}" y2="${y + half}" stroke="${C.shape}" stroke-width="1.5"/>`,
        `<ellipse cx="${x}" cy="${y + half}" rx="${rx}" ry="${ry}" fill="${C.shapeFill}" stroke="${C.shape}" stroke-width="1.5"/>`,
      ].join('\n  ');
    }
    case 'ref':
      return `<circle cx="${x}" cy="${y}" r="3" fill="${C.muted}"/>`;
    case 'process':
    default:
      return `<circle cx="${x}" cy="${y}" r="4" fill="${C.shapeFill}" stroke="${C.shape}" stroke-width="1.5"/>`;
  }
}

// --- Main export ---

export function flowToSvg(flow, findings = []) {
  if (!Array.isArray(flow) || flow.length === 0) return '';

  const spineSteps = flow.filter(s => s.spine !== false);
  if (spineSteps.length === 0) return '';

  const findingMap = {};
  for (const f of findings) {
    findingMap[f.slug] = f;
  }

  return spineSteps.length <= 4
    ? renderHorizontal(spineSteps, findingMap)
    : renderVertical(spineSteps, findingMap);
}

// Stubs — implemented in Tasks 2-5
function renderVertical(steps, findingMap) { return ''; }
function renderHorizontal(steps, findingMap) { return ''; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```
feat: scaffold flow-to-svg module with shape helpers
```

---

### Task 2: Vertical layout (spine, shapes, labels)

**Files:**
- Modify: `test/flow-to-svg.test.mjs`
- Modify: `src/viewer/flow-to-svg.js`

- [ ] **Step 1: Write test for vertical layout**

Add to `test/flow-to-svg.test.mjs` inside the `flowToSvg` describe block:

```js
  it('renders vertical SVG for >4 spine steps', () => {
    const flow = [
      { id: 's1', label: 'Start here', type: 'start' },
      { id: 's2', label: 'Process A' },
      { id: 's3', label: 'Check something?', type: 'decision' },
      { id: 's4', label: 'Process B' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    // Vertical layout indicators
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('viewBox="0 0 440'));
    assert.ok(svg.includes('text-anchor="end"'));
    // Spine line
    assert.ok(svg.includes(`stroke="${'#d1d5db'}"`));
    // Start shape (solid circle)
    assert.ok(svg.includes('fill="#1a1a1a"'));
    // Labels present
    assert.ok(svg.includes('Start here'));
    assert.ok(svg.includes('Check something?'));
    // End label is muted
    assert.ok(svg.includes('fill="#6b7280"'));
  });

  it('computes viewBox height from step count', () => {
    const flow5 = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: `Step ${i}` }));
    const flow8 = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `Step ${i}` }));
    const svg5 = flowToSvg(flow5, []);
    const svg8 = flowToSvg(flow8, []);
    // 5 steps: height = 4*60 + 48 = 288
    assert.ok(svg5.includes('viewBox="0 0 440 288"'));
    // 8 steps: height = 7*60 + 48 = 468
    assert.ok(svg8.includes('viewBox="0 0 440 468"'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: FAIL — `renderVertical` returns empty string

- [ ] **Step 3: Implement renderVertical**

Replace the `renderVertical` stub in `src/viewer/flow-to-svg.js`:

```js
function renderVertical(steps, findingMap) {
  const parts = [];
  const height = (steps.length - 1) * V.stepSpacing + V.padY * 2;
  const y0 = V.padY;
  const y1 = V.padY + (steps.length - 1) * V.stepSpacing;

  // Spine
  parts.push(`<line x1="${V.spineX}" y1="${y0}" x2="${V.spineX}" y2="${y1}" stroke="${C.spine}" stroke-width="1"/>`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const y = V.padY + i * V.stepSpacing;
    const isEnd = step.type === 'end';

    parts.push(renderShape(step.type, V.spineX, y));
    parts.push(`<text x="${V.labelX}" y="${y + 4}" text-anchor="end" font-size="11" fill="${isEnd ? C.muted : C.shape}">${esc(step.label)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V.viewBoxW} ${height}" font-family="${FONT}">\n  ${parts.join('\n  ')}\n</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
feat: vertical layout with spine, shapes, and labels
```

---

### Task 3: Horizontal layout (spine, shapes, labels)

**Files:**
- Modify: `test/flow-to-svg.test.mjs`
- Modify: `src/viewer/flow-to-svg.js`

- [ ] **Step 1: Write test for horizontal layout**

Add to `test/flow-to-svg.test.mjs`:

```js
  it('renders horizontal SVG for <=4 spine steps', () => {
    const flow = [
      { id: 's1', label: 'Begin', type: 'start' },
      { id: 's2', label: 'Do thing' },
      { id: 's3', label: 'Done', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    // Horizontal layout indicators
    assert.ok(svg.includes('viewBox="0 0'));
    assert.ok(svg.includes('text-anchor="middle"'));
    // Height is fixed at 130
    assert.ok(svg.includes(' 130"'));
    // Labels present
    assert.ok(svg.includes('Begin'));
    assert.ok(svg.includes('Do thing'));
  });

  it('computes viewBox width from step count', () => {
    const flow3 = [
      { id: 'a', label: 'A', type: 'start' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C', type: 'end' },
    ];
    const flow4 = [
      { id: 'a', label: 'A', type: 'start' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D', type: 'end' },
    ];
    const svg3 = flowToSvg(flow3, []);
    const svg4 = flowToSvg(flow4, []);
    // 3 steps: width = 2*120 + 100 = 340
    assert.ok(svg3.includes('viewBox="0 0 340 130"'));
    // 4 steps: width = 3*120 + 100 = 460
    assert.ok(svg4.includes('viewBox="0 0 460 130"'));
  });

  it('uses 4 as the horizontal threshold', () => {
    const flow4 = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, label: `S${i}` }));
    const flow5 = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: `S${i}` }));
    const svg4 = flowToSvg(flow4, []);
    const svg5 = flowToSvg(flow5, []);
    assert.ok(svg4.includes('text-anchor="middle"'), '4 steps should be horizontal');
    assert.ok(svg5.includes('text-anchor="end"'), '5 steps should be vertical');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: FAIL — `renderHorizontal` returns empty string

- [ ] **Step 3: Implement renderHorizontal**

Replace the `renderHorizontal` stub in `src/viewer/flow-to-svg.js`:

```js
function renderHorizontal(steps, findingMap) {
  const parts = [];
  const width = (steps.length - 1) * H.stepSpacing + H.padX * 2;
  const x0 = H.padX;
  const x1 = H.padX + (steps.length - 1) * H.stepSpacing;

  // Spine
  parts.push(`<line x1="${x0}" y1="${H.spineY}" x2="${x1}" y2="${H.spineY}" stroke="${C.spine}" stroke-width="1"/>`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const x = H.padX + i * H.stepSpacing;
    const isEnd = step.type === 'end';

    parts.push(renderShape(step.type, x, H.spineY));
    parts.push(`<text x="${x}" y="${H.labelY}" text-anchor="middle" font-size="11" fill="${isEnd ? C.muted : C.shape}">${esc(step.label)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H.viewBoxH}" font-family="${FONT}">\n  ${parts.join('\n  ')}\n</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
feat: horizontal layout with spine, shapes, and labels
```

---

### Task 4: Finding annotations

**Files:**
- Modify: `test/flow-to-svg.test.mjs`
- Modify: `src/viewer/flow-to-svg.js`

- [ ] **Step 1: Write tests for finding annotations**

Add to `test/flow-to-svg.test.mjs`:

```js
describe('finding annotations', () => {
  const findings = [
    { slug: 'finding-a', title: 'Problem Found', concern: 'significant', chain_references: {} },
    { slug: 'finding-b', title: 'Minor Issue', concern: 'moderate', chain_references: {} },
  ];

  it('renders vertical finding annotation with colored stem', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: ['finding-a'] },
      { id: 's3', label: 'Next' },
      { id: 's4', label: 'More' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    // Finding title present
    assert.ok(svg.includes('Problem Found'));
    // Concern badge
    assert.ok(svg.includes('SIGNIFICANT'));
    // Red connector (significant)
    assert.ok(svg.includes('stroke="#dc2626"'));
    assert.ok(svg.includes('stroke-width="1.5"'));
  });

  it('renders horizontal finding annotation below spine', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: ['finding-b'] },
      { id: 's3', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('Minor Issue'));
    assert.ok(svg.includes('MODERATE'));
    // Moderate uses dark stroke
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('renders critical with heavier stroke', () => {
    const critFinding = [{ slug: 'crit', title: 'Critical Bug', concern: 'critical', chain_references: {} }];
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['crit'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, critFinding);
    assert.ok(svg.includes('stroke-width="2.5"'));
  });

  it('skips annotation for unknown finding slug', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['nonexistent'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    assert.ok(!svg.includes('nonexistent'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: FAIL — no finding annotations in output

- [ ] **Step 3: Add finding annotation rendering to renderVertical**

Add after the label rendering inside the step loop in `renderVertical`:

```js
    // Finding annotations
    const slugs = step.findings || [];
    for (let fi = 0; fi < slugs.length; fi++) {
      const slug = slugs[fi];
      const finding = findingMap[slug];
      if (!finding) continue;

      const style = CONCERN_STYLES[finding.concern] || CONCERN_STYLES.note;
      const titleY = y - 2 + fi * 24;
      const badgeY = titleY + 12;
      const stemTop = titleY - 5;
      const stemBottom = badgeY + 2;

      // Horizontal connector from shape to stem
      parts.push(`<line x1="${V.connStartX}" y1="${y}" x2="${V.stemX}" y2="${y}" stroke="${style.stroke}" stroke-width="${style.width}"/>`);
      // Vertical stem
      parts.push(`<line x1="${V.stemX}" y1="${stemTop}" x2="${V.stemX}" y2="${stemBottom}" stroke="${style.stroke}" stroke-width="${style.width}"/>`);
      // Title
      parts.push(`<text x="${V.textX}" y="${titleY}" font-size="10" font-weight="600" fill="${style.fill}">${esc(finding.title)}</text>`);
      // Badge
      parts.push(`<text x="${V.textX}" y="${badgeY}" font-size="7.5" fill="${style.badge}" font-weight="500" letter-spacing="0.5">${finding.concern.toUpperCase()}</text>`);
    }
```

- [ ] **Step 4: Add finding annotation rendering to renderHorizontal**

Add after the label rendering inside the step loop in `renderHorizontal`:

```js
    // Finding annotations
    const slugs = step.findings || [];
    for (let fi = 0; fi < slugs.length; fi++) {
      const slug = slugs[fi];
      const finding = findingMap[slug];
      if (!finding) continue;

      const style = CONCERN_STYLES[finding.concern] || CONCERN_STYLES.note;
      const titleY = H.textYStart + fi * 24;
      const badgeY = titleY + 12;

      // Vertical connector from shape down
      parts.push(`<line x1="${x}" y1="${H.spineY + 7}" x2="${x}" y2="${H.connEndY}" stroke="${style.stroke}" stroke-width="${style.width}"/>`);
      // Title
      parts.push(`<text x="${x}" y="${titleY}" text-anchor="middle" font-size="10" font-weight="600" fill="${style.fill}">${esc(finding.title)}</text>`);
      // Badge
      parts.push(`<text x="${x}" y="${badgeY}" text-anchor="middle" font-size="7.5" fill="${style.badge}" font-weight="500" letter-spacing="0.5">${finding.concern.toUpperCase()}</text>`);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
feat: finding annotations with colored connectors and concern badges
```

---

### Task 5: Chain references

**Files:**
- Modify: `test/flow-to-svg.test.mjs`
- Modify: `src/viewer/flow-to-svg.js`

- [ ] **Step 1: Write tests for chain references**

Add to `test/flow-to-svg.test.mjs`:

```js
describe('chain references', () => {
  const findings = [
    {
      slug: 'first',
      title: 'First Issue',
      concern: 'significant',
      chain_references: { enables: ['second'] },
    },
    {
      slug: 'second',
      title: 'Second Issue',
      concern: 'moderate',
      chain_references: { enabled_by: ['first'] },
    },
  ];

  it('renders vertical chain ref as dashed line between stems', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['first'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D', findings: ['second'] },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('stroke-dasharray="3,2"'));
    assert.ok(svg.includes('enables'));
  });

  it('renders horizontal chain ref as dashed line between columns', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start', findings: ['first'] },
      { id: 's2', label: 'B', findings: ['second'] },
      { id: 's3', label: 'C', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('stroke-dasharray="3,2"'));
    assert.ok(svg.includes('enables'));
  });

  it('skips chain ref when target finding has no flow step', () => {
    const partialFindings = [
      { slug: 'orphan', title: 'Orphan', concern: 'note', chain_references: { enables: ['missing'] } },
    ];
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['orphan'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, partialFindings);
    assert.ok(!svg.includes('stroke-dasharray'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: FAIL — no dashed lines in output

- [ ] **Step 3: Add chain reference tracking to renderVertical**

The finding annotation code needs to record positions. Add a `findingPositions` object before the step loop, populate it inside the finding annotation block, then render chain refs after the loop.

Add before the step loop:

```js
  const findingPositions = {};
```

Inside the finding annotation block (after the badge text push), add:

```js
      findingPositions[slug] = { stemTop, stemBottom };
```

After the step loop, add:

```js
  // Chain references
  for (const step of steps) {
    for (const slug of (step.findings || [])) {
      const finding = findingMap[slug];
      if (!finding?.chain_references) continue;
      for (const targetSlug of (finding.chain_references.enables || [])) {
        const from = findingPositions[slug];
        const to = findingPositions[targetSlug];
        if (!from || !to) continue;
        parts.push(`<line x1="${V.stemX}" y1="${from.stemBottom}" x2="${V.stemX}" y2="${to.stemTop}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3,2"/>`);
        const midY = Math.round((from.stemBottom + to.stemTop) / 2);
        parts.push(`<text x="${V.stemX + 5}" y="${midY + 3}" font-size="7" fill="${C.muted}">enables</text>`);
      }
    }
  }
```

- [ ] **Step 4: Add chain reference tracking to renderHorizontal**

Same pattern. Add `findingPositions` object, record `{ x }` for each finding, render after loop:

```js
  const findingPositions = {};
```

Inside finding annotation block:

```js
      findingPositions[slug] = { x };
```

After the step loop:

```js
  // Chain references
  for (const step of steps) {
    for (const slug of (step.findings || [])) {
      const finding = findingMap[slug];
      if (!finding?.chain_references) continue;
      for (const targetSlug of (finding.chain_references.enables || [])) {
        const from = findingPositions[slug];
        const to = findingPositions[targetSlug];
        if (!from || !to) continue;
        const [left, right] = from.x < to.x ? [from.x, to.x] : [to.x, from.x];
        parts.push(`<line x1="${left}" y1="${H.chainRefY}" x2="${right}" y2="${H.chainRefY}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3,2"/>`);
        const midX = Math.round((left + right) / 2);
        parts.push(`<text x="${midX}" y="${H.chainRefY + 10}" text-anchor="middle" font-size="7" fill="${C.muted}">enables</text>`);
      }
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/flow-to-svg.test.mjs`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
feat: chain reference rendering as dashed connector lines
```

---

### Task 6: Example data + build integration

**Files:**
- Modify: `example/2026-03-21-current-repo-review/findings.yaml`
- Modify: `src/viewer/build-report.mjs`
- Modify: `test/build-report.test.mjs`

- [ ] **Step 1: Add flow data to example findings.yaml**

Add `flow` array to the `location-truthfulness` narrative (after `thesis`, before `verdict`). Insert after `thesis:` line (line 18):

```yaml
    flow:
      - id: index
        label: Index locations
        type: start
      - id: validate
        label: validate_locations()
      - id: alias
        label: Alias available?
        type: decision
        findings:
          - curate-validation-suppresses-unresolved-without-suggestion
      - id: detect
        label: Detect main files
      - id: identity
        label: Path identity?
        type: decision
        findings:
          - main-file-detection-uses-substring-match
      - id: build
        label: Build index
        type: end
```

Note: the second narrative (`text-boundary-accounting`) gets no flow array — it renders without a diagram.

- [ ] **Step 2: Add integration test**

Add to `test/build-report.test.mjs` in the `renderNarrative` describe block:

```js
  it('includes flow diagram SVG when narrative has flow data', async () => {
    const html = await assembleReport('example/2026-03-21-current-repo-review', {
      viewerDir: 'src/viewer',
      fontsDir: 'vendor/fonts',
      viewerJs: null,
    });
    // Flow diagram present for location-truthfulness
    assert.ok(html.includes('class="flow-diagram"'));
    assert.ok(html.includes('Index locations'));
    assert.ok(html.includes('Alias available?'));
    // Second narrative has no flow, so only one flow-diagram div
    const flowDiagramCount = html.split('class="flow-diagram"').length - 1;
    assert.equal(flowDiagramCount, 1);
  });
```

- [ ] **Step 3: Run integration test to verify it fails**

Run: `node --test test/build-report.test.mjs`
Expected: FAIL — no `class="flow-diagram"` in output

- [ ] **Step 4: Wire flowToSvg into build-report.mjs**

Add import at top of `src/viewer/build-report.mjs` (after line 11):

```js
import { flowToSvg } from './flow-to-svg.js'
```

Modify `renderNarrative` (around line 238-243) to insert the flow diagram after the thesis:

```js
  // Flow diagram (if narrative has flow data)
  const flowSvg = narrative.flow ? flowToSvg(narrative.flow, narrative.findings || []) : '';
  const flowHtml = flowSvg ? `\n      <div class="flow-diagram">${flowSvg}</div>` : '';

  const html = `    <section class="narrative" data-slug="${escHtml(narrative.slug)}">
      <h2>${escHtml(narrative.title)}</h2>
      <p class="thesis"><em>${escHtml(narrative.thesis)}</em></p>${flowHtml}
${findingHtmls.join('\n')}
      <p class="verdict"><em>${escHtml(narrative.verdict)}</em></p>
    </section>`;
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `node --test test/build-report.test.mjs && node --test test/flow-to-svg.test.mjs`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
feat: integrate flow diagrams into report build pipeline
```
