/**
 * Sticky navigation bar — appears on scroll, links to report sections.
 * Hidden in presentation mode.
 */

let navEl = null;
let links = [];
let sections = [];

export function initNavBar() {
  const report = document.getElementById('report');
  if (!report) return;

  // Collect navigable sections
  sections = [];
  for (const narrative of report.querySelectorAll('section.narrative')) {
    const h2 = narrative.querySelector('h2');
    if (!h2) continue;
    const slug = narrative.dataset.slug || '';
    sections.push({ el: narrative, label: h2.textContent, slug });
  }
  const ledger = document.getElementById('remediation-ledger');
  if (ledger) {
    sections.push({ el: ledger, label: 'Ledger', slug: 'remediation-ledger' });
  }
  if (sections.length === 0) return;

  // Build the bar
  navEl = document.createElement('nav');
  navEl.id = 'sticky-nav';
  navEl.setAttribute('aria-label', 'Report sections');

  // Report title — click to scroll to top
  const h1 = report.querySelector('h1');
  if (h1) {
    const title = document.createElement('a');
    title.className = 'nav-title';
    title.href = '#';
    title.textContent = h1.textContent;
    title.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    navEl.appendChild(title);
  }

  // Section links
  const linkList = document.createElement('div');
  linkList.className = 'nav-links';
  links = [];
  for (const section of sections) {
    const a = document.createElement('a');
    a.href = `#${section.slug}`;
    a.textContent = section.label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      section.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    linkList.appendChild(a);
    links.push({ a, el: section.el });
  }
  navEl.appendChild(linkList);

  document.body.appendChild(navEl);

  // Show/hide on scroll
  const header = report.querySelector('header');
  if (header) {
    const observer = new IntersectionObserver(([entry]) => {
      navEl.classList.toggle('visible', !entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(header);
  }

  // Track active section
  const sectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = links.find(l => l.el === entry.target);
      if (link) link.a.classList.toggle('active', entry.isIntersecting);
    }
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

  for (const { el } of links) {
    sectionObserver.observe(el);
  }
}
