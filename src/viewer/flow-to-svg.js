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
