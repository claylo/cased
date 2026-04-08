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
    assert.ok(svg.includes('viewBox="-60 0 600'));
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
    // 5 steps: height = 4*60 + 160 = 400
    assert.ok(svg5.includes('viewBox="-60 0 600 400"'));
    // 8 steps: height = 7*60 + 160 = 580
    assert.ok(svg8.includes('viewBox="-60 0 600 580"'));
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
    { slug: 'finding-a', title: 'Problem Found', concern: 'significant', chains: {} },
    { slug: 'finding-b', title: 'Minor Issue', concern: 'moderate', chains: {} },
  ];

  it('renders vertical finding as margin sidenote with hairline connector', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: ['finding-a'] },
      { id: 's3', label: 'Next' },
      { id: 's4', label: 'More' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    // Finding title in margin
    assert.ok(svg.includes('Problem Found'));
    // Concern badge
    assert.ok(svg.includes('SIGNIFICANT'));
    // Hairline connector with concern color
    assert.ok(svg.includes('stroke="#dc2626"'));
    assert.ok(svg.includes('stroke-width="0.5"'));
    // Arrowhead at step (reversed — finding points to step)
    assert.ok(svg.includes('<polygon points="136,'));
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

  it('renders critical finding with hairline connector and arrowhead', () => {
    const critFinding = [{ slug: 'crit', title: 'Critical Bug', concern: 'critical', chains: {} }];
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['crit'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, critFinding);
    // All connectors are hairline regardless of concern level
    assert.ok(svg.includes('stroke-width="0.5"'));
    assert.ok(svg.includes('CRITICAL'));
    // Arrowhead filled with concern color
    assert.ok(svg.includes('fill="#dc2626"'));
  });

  it('uses label override when finding entry is an object', () => {
    const flow = [
      { id: 's1', label: 'Start', type: 'start' },
      { id: 's2', label: 'Step', findings: [{ slug: 'finding-a', label: 'Short name' }] },
      { id: 's3', label: 'Next' },
      { id: 's4', label: 'More' },
      { id: 's5', label: 'End', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('Short name'));
    assert.ok(!svg.includes('Problem Found'));
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
      chains: { enables: ['second'] },
    },
    {
      slug: 'second',
      title: 'Second Issue',
      concern: 'moderate',
      chains: { enabled_by: ['first'] },
    },
  ];

  it('renders vertical chain ref as subtle dashed line in margin', () => {
    const flow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', findings: ['first'] },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D', findings: ['second'] },
      { id: 's5', label: 'E', type: 'end' },
    ];
    const svg = flowToSvg(flow, findings);
    assert.ok(svg.includes('stroke-dasharray="2,2"'));
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
      { slug: 'orphan', title: 'Orphan', concern: 'note', chains: { enables: ['missing'] } },
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

describe('off-spine branches', () => {
  // Auth-flow-style test data: 5 spine steps, 2 off-spine branches
  const authFlow = [
    { id: 'connect', label: 'WS connect', type: 'start' },
    { id: 'token', label: 'Token presented', type: 'input' },
    { id: 'verify', label: 'Verify signature?', type: 'decision', no: 'reject', findings: ['jwt-no-sig'] },
    { id: 'extract', label: 'Extract claims' },
    { id: 'done', label: 'Done', type: 'end' },
    // off-spine
    { id: 'reject', label: 'Close connection', type: 'end', spine: false },
  ];
  const findings = [
    { slug: 'jwt-no-sig', title: 'JWT Not Verified', concern: 'significant', chains: {} },
  ];

  it('renders off-spine step shape at decision y', () => {
    const svg = flowToSvg(authFlow, findings);
    // Off-spine shape should be present (at offSpineX=230)
    assert.ok(svg.includes('cx="230"'), 'off-spine shape at x=230');
    // Off-spine label
    assert.ok(svg.includes('Close connection'));
  });

  it('renders branch connector with no label', () => {
    const svg = flowToSvg(authFlow, findings);
    assert.ok(svg.includes('>no</text>'), 'no label on branch');
  });

  it('renders yes label on spine continuation', () => {
    const svg = flowToSvg(authFlow, findings);
    assert.ok(svg.includes('>yes</text>'), 'yes label on spine');
  });

  it('uses fixed viewBox width for vertical layout', () => {
    const svg = flowToSvg(authFlow, findings);
    assert.ok(svg.includes('viewBox="-60 0 600'), 'fixed 600 viewBox for vertical (incl. padLeft)');
    // Same width without off-spine steps
    const spineOnly = authFlow.filter(s => s.spine !== false);
    const svgSpine = flowToSvg(spineOnly, findings);
    assert.ok(svgSpine.includes('viewBox="-60 0 600'), 'same width without branches');
  });

  it('skips off-spine step with no parent decision', () => {
    const orphanFlow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B' },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
      { id: 'orphan', label: 'Orphan', spine: false },
    ];
    const svg = flowToSvg(orphanFlow, []);
    assert.ok(!svg.includes('Orphan'), 'orphan off-spine not rendered');
  });
});

describe('loop-back arrows', () => {
  const loopFlow = [
    { id: 'start', label: 'Start', type: 'start' },
    { id: 'token', label: 'Token presented', type: 'input' },
    { id: 'valid', label: 'Valid JSON?', type: 'decision', no: 'retry' },
    { id: 'deliver', label: 'Deliver message' },
    { id: 'done', label: 'Done', type: 'end' },
    { id: 'retry', label: 'Log & wait', next: 'token', spine: false },
  ];

  it('renders loop-back polyline', () => {
    const svg = flowToSvg(loopFlow, []);
    assert.ok(svg.includes('<polyline'), 'polyline for loop-back');
  });

  it('renders loop-back arrowhead', () => {
    const svg = flowToSvg(loopFlow, []);
    // Arrowhead polygon pointing left at spine (spineX + 6 = 136)
    assert.ok(svg.includes('<polygon points="136,'), 'arrowhead at spine');
  });

  it('skips loop-back when next target not in flow', () => {
    const badNextFlow = [
      { id: 's1', label: 'A', type: 'start' },
      { id: 's2', label: 'B', type: 'decision', no: 'branch' },
      { id: 's3', label: 'C' },
      { id: 's4', label: 'D' },
      { id: 's5', label: 'E', type: 'end' },
      { id: 'branch', label: 'Branch', next: 'nonexistent', spine: false },
    ];
    const svg = flowToSvg(badNextFlow, []);
    assert.ok(!svg.includes('<polyline'), 'no polyline for missing target');
  });

  it('renders off-spine step label for non-end type', () => {
    const svg = flowToSvg(loopFlow, []);
    assert.ok(svg.includes('Log &amp; wait'));
    // Non-end off-spine uses dark fill, not muted
    assert.ok(svg.includes('>Log &amp; wait</text>'));
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
