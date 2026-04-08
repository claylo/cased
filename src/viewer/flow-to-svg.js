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
  spineX: 130, stepSpacing: 60, labelX: 120,
  padY: 80, padLeft: 60, viewBoxW: 540,
  // Off-spine branch layout
  offSpineX: 230, offSpineLabelX: 244,
  // Margin findings (Tufte sidenote style)
  marginX: 360, marginTextX: 366,
};

// Horizontal layout
const H = {
  spineY: 50, stepSpacing: 120, labelY: 38,
  connEndY: 72, textYStart: 84, chainRefY: 115,
  padX: 50, viewBoxH: 130,
};

const FONT = 'system-ui, -apple-system, sans-serif';

// --- Helpers ---

// Normalize a findings entry: string → { slug }, object → passthrough
function normalizeFindingEntry(entry) {
  return typeof entry === 'string' ? { slug: entry } : entry;
}

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

  const offSpineSteps = flow.filter(s => s.spine === false);

  return spineSteps.length <= 4
    ? renderHorizontal(spineSteps, findingMap, offSpineSteps)
    : renderVertical(spineSteps, findingMap, offSpineSteps);
}

function renderVertical(steps, findingMap, offSpineSteps = []) {
  const parts = [];

  // Build spine position map (id → y) for branch targeting
  const stepY = {};
  for (let i = 0; i < steps.length; i++) {
    stepY[steps[i].id] = V.padY + i * V.stepSpacing;
  }

  const height = (steps.length - 1) * V.stepSpacing + V.padY * 2;
  const y0 = V.padY;
  const y1 = V.padY + (steps.length - 1) * V.stepSpacing;

  // Branch connectors (rendered first — underneath finding annotations)
  for (const step of steps) {
    if (!step.no) continue;
    const decisionY = stepY[step.id];
    stepY[step.no] = decisionY; // position off-spine target at same y

    parts.push(`<line x1="${V.spineX + 6}" y1="${decisionY}" x2="${V.offSpineX - 6}" y2="${decisionY}" stroke="${C.spine}" stroke-width="1"/>`);
    parts.push(`<text x="${V.offSpineX - 20}" y="${decisionY - 6}" text-anchor="middle" font-size="8" fill="${C.muted}">no</text>`);
    parts.push(`<text x="${V.spineX + 8}" y="${decisionY + 14}" font-size="8" fill="${C.muted}">yes</text>`);
  }

  // Spine
  parts.push(`<line x1="${V.spineX}" y1="${y0}" x2="${V.spineX}" y2="${y1}" stroke="${C.spine}" stroke-width="1"/>`);

  const findingPositions = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const y = V.padY + i * V.stepSpacing;
    const isEnd = step.type === 'end';

    parts.push(renderShape(step.type, V.spineX, y));
    parts.push(`<text x="${V.labelX}" y="${y + 4}" text-anchor="end" font-size="11" fill="${isEnd ? C.muted : C.shape}">${esc(step.label)}</text>`);

    // Finding annotations (margin sidenotes, offset up for diagonal connectors)
    const entries = (step.findings || []).map(normalizeFindingEntry);
    let connectorDrawn = false;
    const findingBaseY = y - 50;
    for (let fi = 0; fi < entries.length; fi++) {
      const { slug, label } = entries[fi];
      const finding = findingMap[slug];
      if (!finding) continue;

      const style = CONCERN_STYLES[finding.concern] || CONCERN_STYLES.note;
      const displayTitle = label || finding.title;
      const titleY = findingBaseY - 2 + fi * 20;
      const badgeY = titleY + 10;

      // Hairline from finding down to step (one per step, first finding's color)
      if (!connectorDrawn) {
        parts.push(`<line x1="${V.marginX}" y1="${findingBaseY}" x2="${V.spineX + 10}" y2="${y}" stroke="${style.stroke}" stroke-width="0.5"/>`);
        parts.push(`<polygon points="${V.spineX + 6},${y} ${V.spineX + 10},${y - 2} ${V.spineX + 10},${y + 2}" fill="${style.stroke}"/>`);
        connectorDrawn = true;
      }
      // Title in margin
      parts.push(`<text x="${V.marginTextX}" y="${titleY}" font-size="9" font-weight="600" fill="${style.fill}">${esc(displayTitle)}</text>`);
      // Badge in margin
      parts.push(`<text x="${V.marginTextX}" y="${badgeY}" font-size="7" fill="${style.badge}" font-weight="500" letter-spacing="0.5">${finding.concern.toUpperCase()}</text>`);
      findingPositions[slug] = { y: titleY };
    }
  }

  // Chain references (margin column)
  for (const step of steps) {
    for (const { slug } of (step.findings || []).map(normalizeFindingEntry)) {
      const finding = findingMap[slug];
      const chainRefs = finding.chains;
      if (!chainRefs) continue;
      for (const targetSlug of (chainRefs.enables || [])) {
        const from = findingPositions[slug];
        const to = findingPositions[targetSlug];
        if (!from || !to) continue;
        const dashX = V.marginTextX + 4;
        const startY = from.y + 18;
        const endY = to.y - 16;
        parts.push(`<line x1="${dashX}" y1="${startY}" x2="${dashX}" y2="${endY}" stroke="${C.muted}" stroke-width="0.5" stroke-dasharray="2,2"/>`);
        const midY = Math.round((startY + endY) / 2);
        parts.push(`<text x="${dashX + 4}" y="${midY + 3}" font-size="6" fill="${C.muted}">enables</text>`);
      }
    }
  }

  // Loop-back arrows (rendered before off-spine shapes so shapes occlude the line)
  for (const offStep of offSpineSteps) {
    if (!offStep.next) continue;
    const fromY = stepY[offStep.id];
    const toY = stepY[offStep.next];
    if (fromY === undefined || toY === undefined) continue;
    // North-exit: up from circle top, then left to target on spine
    parts.push(`<polyline points="${V.offSpineX},${fromY - 5} ${V.offSpineX},${toY} ${V.spineX + 6},${toY}" fill="none" stroke="${C.muted}" stroke-width="1"/>`);
    parts.push(`<polygon points="${V.spineX + 6},${toY} ${V.spineX + 12},${toY - 3} ${V.spineX + 12},${toY + 3}" fill="${C.muted}"/>`);
  }

  // Off-spine shapes and labels (painted on top of loop-back lines)
  for (const offStep of offSpineSteps) {
    const offY = stepY[offStep.id];
    if (offY === undefined) continue;
    const isEnd = offStep.type === 'end';
    parts.push(renderShape(offStep.type, V.offSpineX, offY));
    parts.push(`<text x="${V.offSpineLabelX}" y="${offY + 4}" font-size="11" fill="${isEnd ? C.muted : C.shape}">${esc(offStep.label)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${V.padLeft} 0 ${V.viewBoxW + V.padLeft} ${height}" font-family="${FONT}">\n  ${parts.join('\n  ')}\n</svg>`;
}

function renderHorizontal(steps, findingMap, offSpineSteps = []) {
  const parts = [];
  const width = (steps.length - 1) * H.stepSpacing + H.padX * 2;
  const x0 = H.padX;
  const x1 = H.padX + (steps.length - 1) * H.stepSpacing;

  // Spine
  parts.push(`<line x1="${x0}" y1="${H.spineY}" x2="${x1}" y2="${H.spineY}" stroke="${C.spine}" stroke-width="1"/>`);

  const findingPositions = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const x = H.padX + i * H.stepSpacing;
    const isEnd = step.type === 'end';

    parts.push(renderShape(step.type, x, H.spineY));
    parts.push(`<text x="${x}" y="${H.labelY}" text-anchor="middle" font-size="11" fill="${isEnd ? C.muted : C.shape}">${esc(step.label)}</text>`);

    // Finding annotations
    const entries = (step.findings || []).map(normalizeFindingEntry);
    for (let fi = 0; fi < entries.length; fi++) {
      const { slug, label } = entries[fi];
      const finding = findingMap[slug];
      if (!finding) continue;

      const style = CONCERN_STYLES[finding.concern] || CONCERN_STYLES.note;
      const displayTitle = label || finding.title;
      const titleY = H.textYStart + fi * 24;
      const badgeY = titleY + 12;

      // Vertical connector from shape down
      parts.push(`<line x1="${x}" y1="${H.spineY + 7}" x2="${x}" y2="${H.connEndY}" stroke="${style.stroke}" stroke-width="${style.width}"/>`);
      // Title
      parts.push(`<text x="${x}" y="${titleY}" text-anchor="middle" font-size="10" font-weight="600" fill="${style.fill}">${esc(displayTitle)}</text>`);
      // Badge
      parts.push(`<text x="${x}" y="${badgeY}" text-anchor="middle" font-size="7.5" fill="${style.badge}" font-weight="500" letter-spacing="0.5">${finding.concern.toUpperCase()}</text>`);
      findingPositions[slug] = { x };
    }
  }

  // Chain references
  for (const step of steps) {
    for (const { slug } of (step.findings || []).map(normalizeFindingEntry)) {
      const finding = findingMap[slug];
      const chainRefs = finding.chains;
      if (!chainRefs) continue;
      for (const targetSlug of (chainRefs.enables || [])) {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H.viewBoxH}" font-family="${FONT}">\n  ${parts.join('\n  ')}\n</svg>`;
}
