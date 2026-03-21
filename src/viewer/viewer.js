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
