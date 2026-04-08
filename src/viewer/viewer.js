import { initAnnotations } from './annotations.js';
import { initSlides } from './slides.js';
import { initNavBar } from './nav-bar.js';

document.addEventListener('DOMContentLoaded', () => {
  // Parse embedded data
  const dataEl = document.getElementById('cased-data');
  const data = dataEl ? JSON.parse(dataEl.textContent) : {};

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
