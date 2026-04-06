import { annotate } from 'rough-notation';

export function initAnnotations() {
  const rules = [
    { sel: '.concern-badge[data-concern="critical"]', type: 'box', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="significant"]', type: 'underline', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="moderate"]', type: 'underline', color: '#111' },
    { sel: 'p.thesis', type: 'highlight', color: '#f3f4f6' },
  ];

  const annotations = [];

  for (const rule of rules) {
    for (const el of document.querySelectorAll(rule.sel)) {
      annotations.push({
        el,
        annotation: annotate(el, { type: rule.type, color: rule.color, animate: true, animationDuration: 600 })
      });
    }
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const match = annotations.find(a => a.el === entry.target);
        if (match) {
          match.annotation.show();
          observer.unobserve(entry.target);
        }
      }
    }
  }, { threshold: 0.3 });

  for (const { el } of annotations) {
    observer.observe(el);
  }

  return annotations;
}
