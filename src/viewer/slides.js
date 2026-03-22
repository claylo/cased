import { annotate } from 'rough-notation';

let slides = [];
let currentSlide = 0;
let built = false;

export function initSlides() {
  const toggleBtn = document.getElementById('toggle-btn');
  const body = document.body;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => toggleMode(body));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
      toggleMode(body);
    } else if (e.key === 'Escape') {
      if (body.dataset.mode === 'present') exitPresent(body);
    } else if (body.dataset.mode === 'present') {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
    }
  });
}

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function toggleMode(body) {
  if (body.dataset.mode === 'present') exitPresent(body);
  else enterPresent(body);
}

function enterPresent(body) {
  if (!built) buildSlides();
  document.getElementById('slides').hidden = false;
  body.dataset.mode = 'present';
  showSlide(0);
}

function exitPresent(body) {
  body.dataset.mode = 'scroll';
  // Scroll to source element of current slide
  const slide = slides[currentSlide];
  if (slide?.sourceEl) {
    slide.sourceEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Hide slides container
  document.getElementById('slides').hidden = true;
}

function buildSlides() {
  const container = document.getElementById('slides');
  container.hidden = false;
  container.innerHTML = '';
  slides = [];

  // Title slide
  const header = document.querySelector('main#report header');
  if (header) {
    addSlide(container, header.cloneNode(true), header);
  }

  // Terrain map slide
  const terrainSection = document.getElementById('terrain-map');
  if (terrainSection) {
    addSlide(container, terrainSection.cloneNode(true), terrainSection);
  }

  // Narrative slides
  for (const narrative of document.querySelectorAll('section.narrative')) {
    // Intro slide: title + thesis
    const introDiv = document.createElement('div');
    const h2 = narrative.querySelector('h2');
    const thesis = narrative.querySelector('p.thesis');
    if (h2) introDiv.appendChild(h2.cloneNode(true));
    if (thesis) introDiv.appendChild(thesis.cloneNode(true));
    addSlide(container, introDiv, narrative);

    // Finding slides
    for (const article of narrative.querySelectorAll('article.finding')) {
      addSlide(container, article.cloneNode(true), article);
    }

    // Verdict slide
    const verdict = narrative.querySelector('p.verdict');
    if (verdict) {
      const verdictDiv = document.createElement('div');
      if (h2) {
        const h2Clone = h2.cloneNode(true);
        h2Clone.style.fontSize = '1.2rem';
        h2Clone.style.color = '#6b7280';
        verdictDiv.appendChild(h2Clone);
      }
      verdictDiv.appendChild(verdict.cloneNode(true));
      addSlide(container, verdictDiv, verdict);
    }
  }

  // Ledger slide
  const ledger = document.getElementById('remediation-ledger');
  if (ledger) {
    addSlide(container, ledger.cloneNode(true), ledger);
  }

  // Add counter
  const counter = document.createElement('div');
  counter.className = 'slide-counter';
  container.appendChild(counter);

  built = true;
}

function addSlide(container, content, sourceEl) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  slide.style.display = 'none';
  slide.appendChild(content);
  container.appendChild(slide);
  slides.push({ el: slide, sourceEl });
}

function showSlide(index) {
  if (index < 0 || index >= slides.length) return;

  // Hide all, show target
  for (const s of slides) s.el.style.display = 'none';
  slides[index].el.style.display = '';
  currentSlide = index;

  // Update counter
  const counter = document.querySelector('.slide-counter');
  if (counter) counter.textContent = `${index + 1} / ${slides.length}`;

  // Animate annotations on this slide
  animateSlideAnnotations(slides[index].el);
}

function animateSlideAnnotations(slideEl) {
  const rules = [
    { sel: '.concern-badge[data-concern="critical"]', type: 'box', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="significant"]', type: 'underline', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="moderate"]', type: 'underline', color: '#1a1a1a' },
  ];

  for (const rule of rules) {
    for (const el of slideEl.querySelectorAll(rule.sel)) {
      const a = annotate(el, { type: rule.type, color: rule.color, animate: true, animationDuration: 400 });
      a.show();
    }
  }

  // Brackets on evidence in critical/significant
  for (const article of slideEl.querySelectorAll('article.finding[data-concern="critical"], article.finding[data-concern="significant"]')) {
    const pre = article.querySelector('pre.evidence');
    if (pre) {
      const a = annotate(pre, { type: 'bracket', color: '#dc2626', brackets: ['left'], animate: true, animationDuration: 600 });
      a.show();
    }
  }
}

function nextSlide() { showSlide(currentSlide + 1); }
function prevSlide() { showSlide(currentSlide - 1); }
