import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { flowToSvg, renderShape } from '../src/viewer/flow-to-svg.js';

describe('flowToSvg', () => {
  it('returns empty string for missing flow', () => {
    assert.equal(flowToSvg(undefined), '');
    assert.equal(flowToSvg(null), '');
    assert.equal(flowToSvg([]), '');
  });

  it('returns empty string when all steps are off-spine', () => {
    const flow = [{ id: 'a', label: 'A', spine: false }];
    assert.equal(flowToSvg(flow), '');
  });

  it('renders vertical SVG for >4 spine steps', () => {
    const flow = [
      { id: 's1', label: 'Start here', type: 'start' },
      { id: 's2', label: 'Process A' },
      { id: 's3', label: 'Check something?', type: 'decision' },
      { id: 's4', label: 'Process B' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    // Vertical layout indicators
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('viewBox="0 0 440'));
    assert.ok(svg.includes('text-anchor="end"'));
    // Spine line
    assert.ok(svg.includes(`stroke="${'#d1d5db'}"`));
    // Start shape (solid circle)
    assert.ok(svg.includes('fill="#1a1a1a"'));
    // Labels present
    assert.ok(svg.includes('Start here'));
    assert.ok(svg.includes('Check something?'));
    // End label is muted
    assert.ok(svg.includes('fill="#6b7280"'));
  });

  it('computes viewBox height from step count', () => {
    const flow5 = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: `Step ${i}` }));
    const flow8 = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `Step ${i}` }));
    const svg5 = flowToSvg(flow5, []);
    const svg8 = flowToSvg(flow8, []);
    // 5 steps: height = 4*60 + 48 = 288
    assert.ok(svg5.includes('viewBox="0 0 440 288"'));
    // 8 steps: height = 7*60 + 48 = 468
    assert.ok(svg8.includes('viewBox="0 0 440 468"'));
  });
});

describe('renderShape', () => {
  it('renders start as solid circle', () => {
    const svg = renderShape('start', 100, 50);
    assert.ok(svg.includes('circle'));
    assert.ok(svg.includes('fill="#1a1a1a"'));
    assert.ok(!svg.includes('stroke='));
  });

  it('renders end as bull\'s-eye', () => {
    const svg = renderShape('end', 100, 50);
    assert.ok(svg.includes('fill="#1a1a1a"'));
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.split('circle').length - 1 >= 2);
  });

  it('renders process as hollow circle', () => {
    const svg = renderShape('process', 100, 50);
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('defaults to process when type is omitted', () => {
    const svg = renderShape(undefined, 100, 50);
    assert.ok(svg.includes('fill="#fffff8"'));
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('renders decision as rotated rect', () => {
    const svg = renderShape('decision', 100, 50);
    assert.ok(svg.includes('rect'));
    assert.ok(svg.includes('rotate(45'));
  });

  it('renders input as polygon', () => {
    const svg = renderShape('input', 100, 50);
    assert.ok(svg.includes('polygon'));
  });

  it('renders store as cylinder', () => {
    const svg = renderShape('store', 100, 50);
    assert.ok(svg.includes('ellipse'));
    assert.ok(svg.split('ellipse').length - 1 >= 2);
  });

  it('renders ref as small gray circle', () => {
    const svg = renderShape('ref', 100, 50);
    assert.ok(svg.includes('fill="#6b7280"'));
    assert.ok(svg.includes('r="3"'));
  });
});
