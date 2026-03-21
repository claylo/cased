import rough from 'roughjs';

export function initSparklines() {
  const canvases = document.querySelectorAll('canvas.sparkline');
  if (canvases.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        drawSparkline(entry.target);
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.3 });

  for (const canvas of canvases) {
    observer.observe(canvas);
  }
}

function drawSparkline(canvas) {
  const dataAttr = canvas.getAttribute('data-commits');
  if (!dataAttr) return;

  let commits;
  try {
    commits = JSON.parse(dataAttr);
  } catch { return; }

  if (!Array.isArray(commits) || commits.length === 0) return;

  // Canvas sizing (80x16 from CSS, but set pixel dimensions for crisp rendering)
  const w = 80;
  const h = 16;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const rc = rough.canvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const max = Math.max(...commits, 1); // avoid division by zero
  const padding = 2;
  const stepX = (w - padding * 2) / (commits.length - 1);

  const points = commits.map((v, i) => [
    padding + i * stepX,
    h - padding - ((v / max) * (h - padding * 2))
  ]);

  rc.linearPath(points, {
    stroke: '#6b7280',
    strokeWidth: 1.5,
    roughness: 0.8
  });
}
