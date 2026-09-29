/* Pure layout math behind VDSA.views.graph (js/vdsa/views/graph.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const G = require(path.join(__dirname, '..', '..', 'js', 'vdsa', 'views', 'graph.js'));

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
function allFinite(pos) { return Object.values(pos).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)); }
function inBox(pos, w, h) { return Object.values(pos).every(p => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h); }
function minDist(pos) {
  const ids = Object.keys(pos);
  let m = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) m = Math.min(m, Math.hypot(pos[ids[i]].x - pos[ids[j]].x, pos[ids[i]].y - pos[ids[j]].y));
  return m;
}

test('graph.edgeKey: explicit id, directed from-to, undirected sorted pair', () => {
  assert.equal(G.edgeKey({ id: 7, from: 'a', to: 'b' }), '7');
  assert.equal(G.edgeKey({ from: 'B', to: 'A' }, true), 'B-A');
  assert.equal(G.edgeKey({ from: 'B', to: 'A' }, false), 'A-B');
  assert.equal(G.edgeKey({ from: 'B', to: 'A', directed: true }, false), 'B-A');
  assert.equal(G.edgeKey({ from: 2, to: 1 }), '1-2');
});

test('graph.fit keeps aspect, caps height and centres the box', () => {
  const f = G.fit({ w: 1000, h: 600 }, 580, { pad: 40 });
  assert.ok(near(f.k, 0.5));
  assert.equal(f.height, 380);
  assert.ok(near(f.ox, 40) && near(f.oy, 40));
  const wide = G.fit({ w: 1000, h: 600 }, 1400, { pad: 40, maxHeight: 440 });
  assert.ok(wide.height <= 440);
  assert.ok(near(wide.ox, (1400 - 1000 * wide.k) / 2), 'centred horizontally');
  const fixed = G.fit({ w: 1000, h: 600 }, 900, { pad: 20, height: 300 });
  assert.equal(fixed.height, 300);
  const off = G.fit({ x: 100, y: 50, w: 200, h: 100 }, 440, { pad: 20 });
  assert.ok(near(off.ox + 100 * off.k, 20), 'bounds origin maps to the padding');
});

test('graph.assignBends: reverse pairs bow apart, singles stay straight, loops ignored', () => {
  const edges = G.assignBends([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }, { from: 'B', to: 'C' }, { from: 'C', to: 'C' }]);
  assert.equal(edges[2].bend, 0);
  assert.equal(edges[3].bend, 0);
  assert.equal(edges[0].bend, edges[1].bend, 'same sign in each edge\'s own frame = opposite sides');
  assert.notEqual(edges[0].bend, 0);
  const three = G.assignBends([{ id: 1, from: 'x', to: 'y' }, { id: 2, from: 'x', to: 'y' }, { id: 3, from: 'x', to: 'y' }]);
  assert.deepEqual(three.map(e => e.bend), [-1, 0, 1]);
});

test('graph.edgeGeometry: straight edge starts/ends on the circles, arrow tip on the target boundary', () => {
  const g = G.edgeGeometry(0, 0, 10, 100, 0, 10, 0, 8);
  assert.equal(g.degenerate, false);
  assert.ok(g.straight);
  assert.ok(near(g.sx, 10) && near(g.sy, 0));
  assert.ok(near(g.tx, 90) && near(g.ty, 0), 'tip on target circle');
  assert.ok(near(g.ex, 90 - 8 * 0.7), 'line stops short of the tip');
  assert.ok(near(g.mx, 50) && near(g.my, 0));
  assert.ok(near(g.angle, 0));
});

test('graph.edgeGeometry: bend moves the midpoint to the left of the direction', () => {
  const g = G.edgeGeometry(0, 0, 10, 100, 0, 10, 20, 0);
  assert.equal(g.straight, false);
  assert.ok(g.my < -15 && g.my > -25, 'midpoint about 20px above (left of eastward travel)');
  const tipDist = Math.hypot(g.tx - 100, g.ty - 0);
  assert.ok(near(tipDist, 10, 1e-9), 'tip still on the target circle');
  const back = G.edgeGeometry(100, 0, 10, 0, 0, 10, 20, 0);
  assert.ok(back.my > 15, 'reverse edge with the same bend bows the other way');
});

test('graph.edgeGeometry: overlapping circles are degenerate', () => {
  assert.equal(G.edgeGeometry(0, 0, 10, 15, 0, 10, 0, 0).degenerate, true);
  assert.equal(G.edgeGeometry(5, 5, 10, 5, 5, 10, 0, 0).degenerate, true);
});

test('graph.quadAt interpolates the curve ends', () => {
  const g = G.edgeGeometry(0, 0, 0, 100, 0, 0, 25, 0);
  const a = G.quadAt(g, 0), b = G.quadAt(g, 1), m = G.quadAt(g, 0.5);
  assert.ok(near(a.x, g.sx) && near(a.y, g.sy));
  assert.ok(near(b.x, g.ex) && near(b.y, g.ey));
  assert.ok(near(m.x, g.mx) && near(m.y, g.my));
});

test('graph.selfLoop sits above the node and ends on its circle', () => {
  const l = G.selfLoop(100, 100, 20, 8);
  assert.ok(l.sy < 100 && l.ty < 100);
  assert.ok(near(Math.hypot(l.tx - 100, l.ty - 100), 20, 1e-9));
  assert.ok(l.my < 100 - 20, 'label above the node');
});

test('layouts.circle: count gives an array, ids give a map; first node at 12 o\'clock', () => {
  const pts = G.circle(4, { w: 1000, h: 600, pad: 100 });
  assert.equal(pts.length, 4);
  assert.ok(near(pts[0].x, 500) && near(pts[0].y, 100));
  assert.ok(near(pts[1].x, 700), 'clockwise');
  const map = G.circle(['a', 'b'], { w: 1000, h: 600 });
  assert.deepEqual(Object.keys(map), ['a', 'b']);
  assert.deepEqual(G.circle(1, {}), [{ x: 500, y: 300 }]);
  assert.deepEqual(G.circle(0, {}), []);
});

test('layouts.grid: square spacing, centred, row-major', () => {
  const pts = G.grid(2, 3, { w: 1000, h: 600, pad: 100 });
  assert.equal(pts.length, 6);
  assert.equal(pts[1].x - pts[0].x, pts[3].y - pts[0].y, 'square cells');
  assert.ok(near((pts[0].x + pts[2].x) / 2, 500) && near((pts[0].y + pts[3].y) / 2, 300));
  assert.deepEqual([pts[4].row, pts[4].col], [1, 1]);
  const m = G.grid(1, 2, { ids: ['p', 'q'] });
  assert.ok(m.p.x < m.q.x);
});

test('layouts.force: deterministic, in bounds, spread out, no NaN', () => {
  const nodes = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const edges = [['1', '2'], ['1', '3'], ['2', '4'], ['2', '5'], ['3', '6'], ['3', '7'], ['5', '8'], ['7', '8']].map(([from, to]) => ({ from, to }));
  const a = G.force(nodes, edges, { w: 1000, h: 600 });
  const b = G.force(nodes, edges, { w: 1000, h: 600 });
  assert.deepEqual(a, b, 'same input, same output');
  assert.ok(allFinite(a));
  assert.ok(inBox(a, 1000, 600));
  assert.ok(minDist(a) > 60, 'nodes do not overlap (min distance ' + minDist(a).toFixed(1) + ')');
  const xs = Object.values(a).map(p => p.x), ys = Object.values(a).map(p => p.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys), 'long axis horizontal in a wide box');
});

test('layouts.force: edge cases (empty, single, disconnected, duplicates, fixed)', () => {
  assert.deepEqual(G.force([], []), {});
  const one = G.force(['x'], []);
  assert.ok(allFinite(one));
  const dis = G.force(['a', 'b', 'c', 'd'], [{ from: 'a', to: 'b' }]);
  assert.ok(allFinite(dis) && inBox(dis, 1000, 600));
  const same = G.force([{ id: 'p', x: 10, y: 10 }, { id: 'q', x: 10, y: 10 }], [{ from: 'p', to: 'q' }]);
  assert.ok(allFinite(same), 'coincident starts are separated without NaN');
  const fixed = G.force([{ id: 'f', x: 100, y: 100, fixed: true }, { id: 'g' }], [{ from: 'f', to: 'g' }]);
  assert.deepEqual(fixed.f, { x: 100, y: 100 }, 'fixed nodes stay put');
});

test('layouts.layered: longest-path layers, left-to-right, crossing-free chain', () => {
  const nodes = ['a', 'b', 'c', 'd', 'e'];
  const edges = [['a', 'b'], ['b', 'c'], ['a', 'c'], ['d', 'e']].map(([from, to]) => ({ from, to }));
  const pos = G.layered(nodes, edges, { w: 1000, h: 600, direction: 'LR' });
  assert.deepEqual(pos.layers, [['a', 'd'], ['b', 'e'], ['c']]);
  assert.equal(pos.cyclic, false);
  assert.ok(pos.a.x < pos.b.x && pos.b.x < pos.c.x, 'layers advance left to right');
  assert.ok(near(pos.a.x, pos.d.x), 'sources share the first layer');
  assert.ok(allFinite(pos) && inBox(pos, 1000, 600));
  const tb = G.layered({ nodes, edges }, { direction: 'TB' });
  assert.ok(tb.a.y < tb.b.y && tb.b.y < tb.c.y, 'top to bottom by default');
});

test('layouts.layered: barycenter sweeps untangle a crossed pair', () => {
  // x1->y2 and x2->y1 would cross if layer order were kept as given
  const pos = G.layered(['x1', 'x2', 'y1', 'y2'], [{ from: 'x1', to: 'y2' }, { from: 'x2', to: 'y1' }]);
  const cross = (pos.x1.x - pos.x2.x) * (pos.y2.x - pos.y1.x) < 0;
  assert.equal(cross, false);
});

test('layouts.layered: cycles degrade gracefully, strict mode throws', () => {
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }];
  const pos = G.layered(['a', 'b', 'c'], edges);
  assert.equal(pos.cyclic, true);
  assert.ok(allFinite(pos));
  assert.equal(Object.keys(pos).length, 3);
  assert.throws(() => G.layered(['a', 'b', 'c'], edges, { strict: true }), /cycle/);
  const single = G.layered(['solo'], []);
  assert.deepEqual(single.solo, { x: 500, y: 300 });
});

test('graph.contentBounds pads the node bounding box', () => {
  const b = G.contentBounds([{ x: 100, y: 100 }, { x: 500, y: 300 }]);
  assert.ok(b.x < 100 && b.y < 100 && b.x + b.w > 500 && b.y + b.h > 300);
  assert.deepEqual(G.contentBounds([]), { x: 0, y: 0, w: 1000, h: 600 });
  assert.deepEqual(G.contentBounds([{ x: 0, y: 0 }], 10), { x: -10, y: -10, w: 20, h: 20 });
});

test('graph.nextId walks A..Z then N27...', () => {
  assert.equal(G.nextId([]), 'A');
  assert.equal(G.nextId(['A', 'B', 'D']), 'C');
  const all = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  assert.equal(G.nextId(all), 'N27');
});
