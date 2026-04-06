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

  it('renders horizontal SVG for <=4 spine steps', () => {
    const flow = [
      { id: 's1', label: 'Begin', type: 'start' },
      { id: 's2', label: 'Do thing' },
      { id: 's3', label: 'Done', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    // Horizontal layout indicators
    assert.ok(svg.includes('viewBox="0 0'));
    assert.ok(svg.includes('text-anchor="middle"'));
    // Height is fixed at 130
    assert.ok(svg.includes(' 130"'));
    // Labels present
    assert.ok(svg.includes('Begin'));
    assert.ok(svg.includes('Do thing'));
  });

  it('computes viewBox width from step count', () => {
    const flow3 = [
      { id: 'a', label: 'A', type: 'start' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C', type: 'end' },
    ];
    const flow4 = [
      { id: 'a', label: 'A', type: 'start' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D', type: 'end' },
    ];
    const svg3 = flowToSvg(flow3, []);
    const svg4 = flowToSvg(flow4, []);
    // 3 steps: width = 2*120 + 100 = 340
    assert.ok(svg3.includes('viewBox="0 0 340 130"'));
    // 4 steps: width = 3*120 + 100 = 460
    assert.ok(svg4.includes('viewBox="0 0 460 130"'));
  });

  it('uses 4 as the horizontal threshold', () => {
    const flow4 = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, label: `S${i}` }));
    const flow5 = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: `S${i}` }));
    const svg4 = flowToSvg(flow4, []);
    const svg5 = flowToSvg(flow5, []);
    assert.ok(svg4.includes('text-anchor="middle"'), '4 steps should be horizontal');
    assert.ok(svg5.includes('text-anchor="end"'), '5 steps should be vertical');
  });
});

describe('finding annotations', () => {
  const findings = [
    { slug: 'finding-a', title: 'Problem Found', concern: 'significant', chain_references: {} },
    { slug: 'finding-b', title: 'Minor Issue', concern: 'moderate', chain_references: {} },
  ];

  it('renders vertical finding annotation with colored stem', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: ['finding-a'] },
      { id: 's3', label: 'Next' },
      { id: 's4', label: 'More' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    // Finding title present
    assert.ok(svg.includes('Problem Found'));
    // Concern badge
    assert.ok(svg.includes('SIGNIFICANT'));
    // Red connector (significant)
    assert.ok(svg.includes('stroke="#dc2626"'));
    assert.ok(svg.includes('stroke-width="1.5"'));
  });

  it('renders horizontal finding annotation below spine', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: ['finding-b'] },
      { id: 's3', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('Minor Issue'));
    assert.ok(svg.includes('MODERATE'));
    // Moderate uses dark stroke
    assert.ok(svg.includes('stroke="#1a1a1a"'));
  });

  it('renders critical with heavier stroke', () => {
    const critFinding = [{ slug: 'crit', title: 'Critical Bug', concern: 'critical', chain_references: {} }];
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['crit'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, critFinding);
    assert.ok(svg.includes('stroke-width="2.5"'));
  });

  it('skips annotation for unknown finding slug', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['nonexistent'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, []);
    assert.ok(!svg.includes('nonexistent'));
  });
});

describe('chain references', () => {
  const findings = [
    {
      slug: 'first',
      title: 'First Issue',
      concern: 'significant',
      chain_references: { enables: ['second'] },
    },
    {
      slug: 'second',
      title: 'Second Issue',
      concern: 'moderate',
      chain_references: { enabled_by: ['first'] },
    },
  ];

  it('renders vertical chain ref as dashed line between stems', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['first'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D', findings: ['second'] },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('stroke-dasharray="3,2"'));
    assert.ok(svg.includes('enables'));
  });

  it('renders horizontal chain ref as dashed line between columns', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start', findings: ['first'] },
      { id: 's2', label: 'B', findings: ['second'] },
      { id: 's3', label: 'C', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('stroke-dasharray="3,2"'));
    assert.ok(svg.includes('enables'));
  });

  it('skips chain ref when target finding has no flow step', () => {
    const partialFindings = [
      { slug: 'orphan', title: 'Orphan', concern: 'note', chain_references: { enables: ['missing'] } },
    ];
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['orphan'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, partialFindings);
    assert.ok(!svg.includes('stroke-dasharray'));
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
