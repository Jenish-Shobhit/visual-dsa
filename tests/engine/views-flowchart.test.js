/* Flowchart layout and orthogonal routing (js/vdsa/views/flowchart.js, pure part). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const F = require(path.join(__dirname, '..', '..', 'js', 'vdsa', 'views', 'flowchart.js'));

const LINEAR = {
  nodes: [
    { id: 'start', type: 'start', text: 'Start', col: 0, row: 0 },
    { id: 'init', type: 'process', text: 'i = 0', col: 0, row: 1 },
    { id: 'cond', type: 'decision', text: 'i < n ?', col: 0, row: 2 },
    { id: 'check', type: 'decision', text: 'a[i] == target ?', col: 0, row: 3 },
    { id: 'inc', type: 'process', text: 'i = i + 1', col: 0, row: 4 },
    { id: 'found', type: 'end', text: 'return i', col: 1, row: 3 },
    { id: 'none', type: 'end', text: 'return −1', col: 1, row: 2 }
  ],
  edges: [
    { from: 'start', to: 'init' }, { from: 'init', to: 'cond' },
    { from: 'cond', to: 'check', label: 'yes' }, { from: 'cond', to: 'none', label: 'no' },
    { from: 'check', to: 'found', label: 'yes' }, { from: 'check', to: 'inc', label: 'no' },
    { from: 'inc', to: 'cond' }
  ]
};
const BINARY = {
  nodes: [
    { id: 'init', type: 'start', text: 'lo = 0, hi = n − 1', col: 1, row: 0 },
    { id: 'cond', type: 'decision', text: 'lo ≤ hi ?', col: 1, row: 1 },
    { id: 'mid', type: 'process', text: 'mid = ⌊(lo + hi) / 2⌋', col: 1, row: 2 },
    { id: 'eq', type: 'decision', text: 'a[mid] = target ?', col: 1, row: 3 },
    { id: 'lt', type: 'decision', text: 'a[mid] < target ?', col: 1, row: 4 },
    { id: 'right', type: 'process', text: 'lo = mid + 1', col: 0, row: 5 },
    { id: 'left', type: 'process', text: 'hi = mid − 1', col: 2, row: 5 },
    { id: 'found', type: 'end', text: 'return mid', col: 2, row: 3 },
    { id: 'none', type: 'end', text: 'return −1', col: 2, row: 1 }
  ],
  edges: [
    { from: 'init', to: 'cond' }, { from: 'cond', to: 'mid', label: 'yes' }, { from: 'cond', to: 'none', label: 'no' },
    { from: 'mid', to: 'eq' }, { from: 'eq', to: 'found', label: 'yes' }, { from: 'eq', to: 'lt', label: 'no' },
    { from: 'lt', to: 'right', label: 'yes' }, { from: 'lt', to: 'left', label: 'no' },
    { from: 'right', to: 'cond' }, { from: 'left', to: 'cond' }
  ]
};
const IOLOOP = {
  nodes: [
    { id: 's', type: 'start', text: 'Start', col: 0, row: 0 },
    { id: 'read', type: 'io', text: 'Read n numbers', col: 0, row: 1 },
    { id: 'more', type: 'decision', text: 'More numbers?', col: 0, row: 2 },
    { id: 'add', type: 'process', text: 'sum = sum + x', col: 0, row: 3 },
    { id: 'print', type: 'io', text: 'Print sum', col: 1, row: 2 },
    { id: 'e', type: 'end', text: 'End', col: 1, row: 3 },
    { id: 'self', type: 'process', text: 'retry', col: 2, row: 0 }
  ],
  edges: [
    { from: 's', to: 'read' }, { from: 'read', to: 'more' }, { from: 'more', to: 'add', label: 'yes' },
    { from: 'add', to: 'more' }, { from: 'more', to: 'print', label: 'no' }, { from: 'print', to: 'e' },
    { from: 'self', to: 'self' }
  ]
};

/* distance from a point to the boundary of a node's outline */
function boundaryDistance(n, p) {
  const x1 = n.x - n.w / 2, x2 = n.x + n.w / 2, y1 = n.y - n.h / 2, y2 = n.y + n.h / 2, k = n.skew;
  let poly;
  if (n.shape === 'diamond') poly = [[n.x, y1], [x2, n.y], [n.x, y2], [x1, n.y]];
  else if (n.shape === 'hexagon') poly = [[x1 + k, y1], [x2 - k, y1], [x2, n.y], [x2 - k, y2], [x1 + k, y2], [x1, n.y]];
  else if (n.shape === 'io') poly = [[x1 + k, y1], [x2, y1], [x2 - k, y2], [x1, y2]];
  else if (n.shape === 'pill') {
    const r = n.h / 2;
    if (p[0] >= x1 + r && p[0] <= x2 - r) return Math.min(Math.abs(p[1] - y1), Math.abs(p[1] - y2));
    const cx = p[0] < n.x ? x1 + r : x2 - r;
    return Math.abs(Math.hypot(p[0] - cx, p[1] - n.y) - r);
  } else poly = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return best;
}
function checkRoutes(spec, width) {
  const geo = F.compute(spec, width, {});
  const routes = F.route(spec, geo);
  assert.equal(routes.length, spec.edges.length);
  routes.forEach((r, i) => {
    assert.ok(r, 'edge ' + i + ' routed');
    const pts = r.points;
    assert.ok(pts.length >= 2);
    for (let k = 1; k < pts.length; k++) {
      const horiz = Math.abs(pts[k][1] - pts[k - 1][1]) < 1e-6, vert = Math.abs(pts[k][0] - pts[k - 1][0]) < 1e-6;
      assert.ok(horiz || vert, `edge ${r.from}->${r.to} segment ${k} is orthogonal`);
    }
    const A = geo.nodes[r.from], B = geo.nodes[r.to];
    assert.ok(boundaryDistance(A, pts[0]) < 0.6, `edge ${r.from}->${r.to} starts on ${r.from}'s outline`);
    assert.ok(boundaryDistance(B, pts[pts.length - 1]) < 0.6, `edge ${r.from}->${r.to} ends on ${r.to}'s outline`);
    assert.equal(r.clear, true, `edge ${r.from}->${r.to} found a clear route`);
    // interior segments avoid every node box; end segments avoid all but their own node
    Object.keys(geo.nodes).forEach(id => {
      const n = geo.nodes[id], box = { x1: n.x - n.w / 2, y1: n.y - n.h / 2, x2: n.x + n.w / 2, y2: n.y + n.h / 2 };
      for (let k = 0; k < pts.length - 1; k++) {
        if ((k === 0 && id === r.from) || (k === pts.length - 2 && id === r.to)) continue;
        assert.ok(!F.segHits(pts[k], pts[k + 1], box, 0), `edge ${r.from}->${r.to} segment ${k} crosses node ${id}`);
      }
    });
    assert.ok(Array.isArray(r.labelAt) && r.labelAt.length === 2);
  });
  return { geo, routes };
}

test('flowchart routes are orthogonal, start/end on outlines and avoid nodes (linear search)', () => {
  const { routes } = checkRoutes(LINEAR, 640);
  const byKey = Object.fromEntries(routes.map(r => [r.from + '->' + r.to, r]));
  assert.deepEqual([byKey['start->init'].fromSide, byKey['start->init'].toSide], ['bottom', 'top']);
  assert.equal(byKey['start->init'].points.length, 2, 'aligned nodes connect with a straight line');
  assert.deepEqual([byKey['cond->none'].fromSide, byKey['cond->none'].toSide], ['right', 'left'], '"no" branch exits sideways');
  const loop = byKey['inc->cond'];
  assert.deepEqual([loop.fromSide, loop.toSide], ['left', 'left'], 'loop back goes around the left side');
  assert.ok(loop.points.length === 4);
});

test('flowchart routes are clean for binary search (two loop-backs, side branches)', () => {
  checkRoutes(BINARY, 900);
  checkRoutes(BINARY, 360);
});

test('flowchart handles io shapes, shared ports and self-loops', () => {
  const { routes } = checkRoutes(IOLOOP, 700);
  const self = routes[6];
  assert.notEqual(self.fromSide, self.toSide, 'self-loop leaves and enters on different sides');
  // start -> read (io) stays straight: io ports are centred
  assert.equal(routes[0].points.length, 2);
});

test('flowchart.compute steps down fit levels on narrow widths and scales only as a last resort', () => {
  const wide = F.compute(BINARY, 1200, {});
  const narrow = F.compute(BINARY, 360, {});
  assert.equal(wide.level, 0);
  assert.equal(wide.scale, 1);
  assert.ok(narrow.level > wide.level, 'narrow container uses a more compact level');
  assert.ok(narrow.width * narrow.scale <= 360 + 1e-6 || narrow.scale === 0.55);
  assert.ok(narrow.offsetX >= 0);
  const compact = F.compute(LINEAR, 1200, { compact: true });
  assert.ok(compact.level >= 3);
  assert.equal(compact.decisionShape, 'hexagon');
  assert.equal(F.compute(LINEAR, 1200, { decisionShape: 'diamond', compact: true }).decisionShape, 'diamond');
});

test('flowchart.sizeNode fits every wrapped line inside a diamond', () => {
  const lv = F.LEVELS[0];
  const n = F.sizeNode({ id: 'd', type: 'decision', text: 'Is the key smaller than the node?' }, lv, 'diamond', (s, px) => s.length * px * 0.55);
  assert.ok(n.lines.length >= 2);
  const a = n.w / 2, b = n.h / 2;
  n.lines.forEach((line, i) => {
    const w = line.length * lv.font * 0.55;
    const y = Math.abs((i - (n.lines.length - 1) / 2) * n.lineH) + n.lineH / 2;
    assert.ok(w / 2 / a + y / b <= 1 + 1e-9, 'line ' + i + ' fits');
  });
  const pill = F.sizeNode({ id: 's', type: 'start', text: 'Start' }, lv, 'diamond', (s, px) => s.length * px * 0.55);
  assert.equal(pill.shape, 'pill');
  const manual = F.sizeNode({ id: 'm', text: 'line one\nline two' }, lv, 'diamond', (s, px) => s.length * px * 0.55);
  assert.deepEqual(manual.lines, ['line one', 'line two']);
});

test('flowchart.portPoint lands on each outline', () => {
  const lv = F.LEVELS[1];
  ['process', 'decision', 'start', 'io', 'note'].forEach(type => {
    const n = Object.assign(F.sizeNode({ id: type, type, text: 'hello world' }, lv, 'diamond', (s, px) => s.length * px * 0.55), { x: 100, y: 80 });
    ['top', 'right', 'bottom', 'left'].forEach(side => [0, 6, -6].forEach(off => {
      const p = F.portPoint(n, side, off);
      assert.ok(boundaryDistance(n, p) < 0.6, `${type} ${side} ${off}`);
    }));
  });
});

test('flowchart.simplify merges collinear points and rejects doubling back', () => {
  assert.deepEqual(F.simplify([[0, 0], [0, 5], [0, 10], [10, 10]]), [[0, 0], [0, 10], [10, 10]]);
  assert.equal(F.simplify([[0, 0], [0, 10], [0, 4]]), null);
  assert.deepEqual(F.simplify([[0, 0], [0, 0], [5, 0]]), [[0, 0], [5, 0]]);
});

test('flowchart.edgeIndex resolves indices, {from,to}, "a->b" and ids', () => {
  const spec = { edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c', id: 'bc', label: 'yes' }, { from: 'b', to: 'c', label: 'no' }] };
  assert.equal(F.edgeIndex(spec, 1), 1);
  assert.equal(F.edgeIndex(spec, 7), -1);
  assert.equal(F.edgeIndex(spec, { from: 'a', to: 'b' }), 0);
  assert.equal(F.edgeIndex(spec, { from: 'b', to: 'c', label: 'no' }), 2);
  assert.equal(F.edgeIndex(spec, 'bc'), 1);
  assert.equal(F.edgeIndex(spec, 'a->b'), 0);
  assert.equal(F.edgeIndex(spec, 'x->y'), -1);
  assert.equal(F.edgeIndex(spec, null), -1);
});

test('flowchart.shapePath draws closed outlines for every shape', () => {
  const lv = F.LEVELS[0];
  ['process', 'decision', 'start', 'io', 'note'].forEach(type => {
    const n = Object.assign(F.sizeNode({ id: type, type, text: 'x' }, lv, 'diamond', (s, px) => s.length * px * 0.55), { x: 50, y: 50 });
    assert.match(F.shapePath(n), /^M.*Z$/);
  });
  const hex = Object.assign(F.sizeNode({ id: 'h', type: 'decision', text: 'x' }, lv, 'hexagon', (s, px) => s.length * px * 0.55), { x: 50, y: 50 });
  assert.equal(hex.shape, 'hexagon');
  assert.match(F.shapePath(hex), /Z$/);
});

test('flowchart waypoints (via.points) are honoured in grid units', () => {
  const spec = {
    nodes: [{ id: 'a', text: 'A', col: 0, row: 0 }, { id: 'b', text: 'B', col: 0, row: 2 }, { id: 'c', text: 'C', col: 0, row: 1 }],
    edges: [{ from: 'a', to: 'b', via: { fromSide: 'right', toSide: 'right', points: [[0.5, 0], [0.5, 2]] } }]
  };
  const geo = F.compute(spec, 600, {});
  const r = F.route(spec, geo)[0];
  const cx = geo.channels.xs[1];
  assert.ok(r.points.some(p => Math.abs(p[0] - cx) < 1e-6), 'passes through the channel right of column 0');
  assert.equal(r.fromSide, 'right');
  assert.equal(r.toSide, 'right');
});

test('flowchart narrow positions take over below narrowWidth', () => {
  const spec = {
    nodes: [{ id: 'a', text: 'A', col: 0, row: 0 }, { id: 'b', text: 'B', col: 2, row: 0, narrow: { col: 0, row: 1 } }],
    edges: [{ from: 'a', to: 'b' }]
  };
  const wide = F.compute(spec, 800, {});
  const small = F.compute(spec, 400, {});
  assert.equal(wide.narrow, false);
  assert.equal(small.narrow, true);
  assert.ok(Math.abs(small.nodes.a.x - small.nodes.b.x) < 1e-6, 'b folds under a');
  assert.ok(small.nodes.b.y > small.nodes.a.y);
  const r = F.route(spec, small)[0];
  assert.deepEqual([r.fromSide, r.toSide], ['bottom', 'top']);
  assert.equal(F.compute(spec, 400, { narrowWidth: 300 }).narrow, false);
});
