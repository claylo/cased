import { drawTerrainMap } from './terrain-map.js';
import { initAnnotations } from './annotations.js';
import { initSparklines } from './sparklines.js';
import { initSlides } from './slides.js';
import { initNavBar } from './nav-bar.js';

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

  // Sticky navigation bar
  initNavBar();

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
});
