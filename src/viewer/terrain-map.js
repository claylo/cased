import rough from 'roughjs';

/**
 * Draw a rough.js terrain map of the codebase onto a canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} reconData   — parsed recon.yaml: { files: [{path, lines}], dependency_graph: [{from, to[]}] }
 * @param {object} findingsData — parsed findings.yaml: { narratives: [{findings: [{concern, locations: [{path}]}]}] }
 */
export function drawTerrainMap(canvas, reconData, findingsData) {
  const files = Array.isArray(reconData.files) ? reconData.files : [];
  if (files.length === 0) return;

  // --- Layout constants ---
  const CELL_W = 120;
  const CELL_H = 80;
  const PAD_X = 24;
  const PAD_Y = 32;
  const LABEL_H = 16;

  // --- Sort by lines descending ---
  const sorted = [...files].sort((a, b) => (b.lines || 0) - (a.lines || 0));
  const maxLines = sorted[0].lines || 1;

  // --- Grid dimensions ---
  const cols = Math.ceil(Math.sqrt(sorted.length));
  const rows = Math.ceil(sorted.length / cols);

  // --- Canvas size ---
  canvas.width = cols * CELL_W + (cols + 1) * PAD_X;
  canvas.height = rows * (CELL_H + LABEL_H) + (rows + 1) * PAD_Y;

  const rc = rough.canvas(canvas);
  const ctx = canvas.getContext('2d');

  // --- Build finding density + severity map keyed by file path ---
  const densityMap = new Map();   // path -> count
  const severeSet = new Set();    // paths with critical or significant findings

  for (const narrative of (findingsData.narratives || [])) {
    for (const finding of (narrative.findings || [])) {
      const isSevere = finding.concern === 'critical' || finding.concern === 'significant';
      for (const loc of (finding.locations || [])) {
        if (!loc.path) continue;
        densityMap.set(loc.path, (densityMap.get(loc.path) || 0) + 1);
        if (isSevere) severeSet.add(loc.path);
      }
    }
  }

  // --- Build rect index (path -> {x, y, w, h, cx, cy}) ---
  const rectIndex = new Map();

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Scale size proportional to sqrt(lines), with a floor
    const scale = Math.max(0.35, Math.sqrt((file.lines || 1) / maxLines));
    const w = Math.round(CELL_W * 0.85 * scale);
    const h = Math.round(CELL_H * 0.85 * scale);

    // Center each rect within its cell
    const cellX = PAD_X + col * (CELL_W + PAD_X);
    const cellY = PAD_Y + row * (CELL_H + LABEL_H + PAD_Y);
    const x = cellX + Math.round((CELL_W - w) / 2);
    const y = cellY + Math.round((CELL_H - h) / 2);
    const cx = x + Math.round(w / 2);
    const cy = y + Math.round(h / 2);

    rectIndex.set(file.path, { x, y, w, h, cx, cy, cellX, cellY });
  }

  // --- Draw edges first (so rectangles appear on top) ---
  const depGraph = Array.isArray(reconData.dependency_graph) ? reconData.dependency_graph : [];

  for (const edge of depGraph) {
    const fromRect = rectIndex.get(edge.from);
    if (!fromRect) continue;
    for (const toPath of (edge.to || [])) {
      const toRect = rectIndex.get(toPath);
      if (!toRect) continue;
      rc.line(fromRect.cx, fromRect.cy, toRect.cx, toRect.cy, {
        stroke: '#d1d5db',
        strokeWidth: 0.8,
        roughness: 0.8,
      });
    }
  }

  // --- Draw rectangles and labels ---
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const rect = rectIndex.get(file.path);
    if (!rect) continue;

    const density = densityMap.get(file.path) || 0;
    const severe = severeSet.has(file.path);

    const stroke = severe ? '#dc2626' : '#1a1a1a';
    const strokeWidth = 1.5 + density * 1.5;

    rc.rectangle(rect.x, rect.y, rect.w, rect.h, {
      stroke,
      strokeWidth,
      roughness: 1,
    });

    // Short label: last path segment
    const label = file.path.split('/').pop() || file.path;
    const labelX = rect.cellX + Math.round(CELL_W / 2);
    const labelY = rect.y + rect.h + 4;

    ctx.fillStyle = '#6b7280';
    ctx.fillText(label, labelX, labelY, CELL_W - 4);
  }
}
