import { initAnnotations } from './annotations.js';
import { initSlides } from './slides.js';
import { initNavBar } from './nav-bar.js';

document.addEventListener('DOMContentLoaded', () => {
  // Parse embedded data
  // A truncated or malformed blob must not kill the rest of the viewer
  // (annotations, slides, nav). The data binding is informational only.
  const dataEl = document.getElementById('cased-data');
  let data = {};
  if (dataEl) {
    try { data = JSON.parse(dataEl.textContent); }
    catch (e) { console.error('cased-data blob is not valid JSON:', e.message); }
  }

  // Initialize scroll-triggered features
  initAnnotations();

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
