import { annotate } from 'rough-notation';

export function initAnnotations() {
  const rules = [
    { sel: '.concern-badge[data-concern="critical"]', type: 'box', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="significant"]', type: 'underline', color: '#dc2626' },
    { sel: '.concern-badge[data-concern="moderate"]', type: 'underline', color: '#1a1a1a' },
    { sel: '.concern-badge[data-concern="advisory"]', type: 'underline', color: '#6b7280' },
    { sel: '.concern-badge[data-concern="note"]', type: 'underline', color: '#d1d5db' },
    { sel: 'p.thesis', type: 'highlight', color: '#f3f4f6' },
  ];

  const annotations = [];

  // Concern badges and theses
  for (const rule of rules) {
    for (const el of document.querySelectorAll(rule.sel)) {
      annotations.push({
        el,
        annotation: annotate(el, { type: rule.type, color: rule.color, animate: true, animationDuration: 600 })
      });
    }
  }

  // Evidence brackets for critical/significant findings
  for (const article of document.querySelectorAll('article.finding[data-concern="critical"], article.finding[data-concern="significant"]')) {
    const pre = article.querySelector('pre.evidence');
    if (pre) {
      annotations.push({
        el: pre,
        annotation: annotate(pre, { type: 'bracket', color: '#dc2626', brackets: ['left'], animate: true, animationDuration: 800 })
      });
    }
  }

  // Chain reference circles
  for (const a of document.querySelectorAll('a.chain-ref')) {
    annotations.push({
      el: a,
      annotation: annotate(a, { type: 'circle', color: '#d1d5db', animate: true, animationDuration: 400, padding: 3 })
    });
  }

  // Single IntersectionObserver for all
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

  return annotations; // useful for presentation mode to replay
}
