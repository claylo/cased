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

  // Click left/right edges to navigate slides
  document.addEventListener('click', (e) => {
    if (body.dataset.mode !== 'present') return;
    // Don't intercept clicks on interactive elements
    const tag = e.target.closest('a, button, [role="button"], .summary-count, .expressive-code');
    if (tag) return;
    const x = e.clientX / window.innerWidth;
    if (x < 0.25) prevSlide();
    else if (x > 0.75) nextSlide();
  });

  // Touch/swipe navigation for smartboards and tablets
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (body.dataset.mode !== 'present') return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only count horizontal swipes (not taps or vertical scrolls)
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) nextSlide();
    else prevSlide();
  }, { passive: true });
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
    const titleContent = header.cloneNode(true);
    addSlide(container, titleContent, header);
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

    // Flow diagram slide
    const flowDiagram = narrative.querySelector('.flow-diagram');
    if (flowDiagram) {
      addSlide(container, flowDiagram.cloneNode(true), flowDiagram);
    }

    // Finding slides
    const articles = narrative.querySelectorAll('article.finding');
    const verdict = narrative.querySelector('p.verdict');
    for (let ai = 0; ai < articles.length; ai++) {
      const clone = articles[ai].cloneNode(true);
      // Append verdict to last finding slide
      if (ai === articles.length - 1 && verdict) {
        clone.appendChild(verdict.cloneNode(true));
      }
      addSlide(container, clone, articles[ai]);
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

  // Wire up summary pills on the title slide to jump to first finding of that concern
  const titleSlide = slides[0]?.el;
  if (titleSlide) {
    for (const pill of titleSlide.querySelectorAll('.summary-count')) {
      const concern = pill.dataset.concern;
      if (!concern) continue;
      pill.addEventListener('click', () => {
        const idx = slides.findIndex(s =>
          s.el.querySelector(`article.finding[data-concern="${concern}"]`)
        );
        if (idx >= 0) showSlide(idx);
      });
    }
  }

  // Wire up chain-ref and ledger links to navigate between slides
  container.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const slug = link.getAttribute('href').slice(1);
    if (!slug) return;
    const idx = slides.findIndex(s =>
      s.el.querySelector(`#${CSS.escape(slug)}`) ||
      s.el.querySelector(`article.finding[data-slug="${slug}"]`)
    );
    if (idx >= 0) {
      e.preventDefault();
      showSlide(idx);
    }
  });

  built = true;
}

function addSlide(container, content, sourceEl) {
  // Strip rough-notation SVGs carried over from scroll-mode cloneNode
  for (const svg of content.querySelectorAll('svg.rough-annotation')) {
    svg.remove();
  }
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
