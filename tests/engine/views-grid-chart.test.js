/* Pure layout math for js/vdsa/views/grid.js and chart.js (node --test 'tests/engine/*.test.js'). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const VIEWS = path.join(__dirname, '..', '..', 'js', 'vdsa', 'views');
const G = require(path.join(VIEWS, 'grid.js'));
const C = require(path.join(VIEWS, 'chart.js'));

/* ------------------------------------------------------------ grid */
test('grid.normalize: dense cells, numbers, nulls and inferred size', () => {
  const n = G.normalize({ cells: [[1, null, { value: 3, state: 'active' }], [4]] });
  assert.equal(n.rows, 2);
  assert.equal(n.cols, 3);
  assert.deepEqual(Object.keys(n.cells).sort(), ['0,0', '0,2', '1,0']);
  assert.equal(n.cells['0,2'].state, 'active');
  assert.equal(n.cells['0,0'].state, 'default');
  assert.equal(n.cells['0,0'].value, 1);
});

test('grid.normalize: sparse cells, walls and explicit rows/cols', () => {
  const n = G.normalize({ rows: 5, cols: 6, cells: { '1,2': { state: 'visited' }, 'bad key': 1 }, walls: [[3, 4], [1, 2]] });
  assert.equal(n.rows, 5);
  assert.equal(n.cols, 6);
  assert.equal(n.cells['1,2'].state, 'visited');
  assert.equal(n.cells['1,2'].wall, true, 'walls merge into existing cells');
  assert.equal(n.cells['3,4'].wall, true, 'walls create cells');
  assert.equal(Object.keys(n.cells).length, 2);
});

test('grid.normalize: markers in object and array form', () => {
  const a = G.normalize({ rows: 3, cols: 3, markers: { start: [0, 0], end: { cell: [2, 2], label: 'T' } } });
  assert.deepEqual(a.markers.map(m => [m.id, m.kind, m.cell.join(',')]), [['start', 'start', '0,0'], ['end', 'end', '2,2']]);
  assert.equal(a.markers[1].label, 'T');
  const b = G.normalize({ markers: [{ cell: [4, 1], kind: 'dot', state: 'pivot' }] });
  assert.equal(b.rows, 5, 'markers extend the inferred size');
  assert.equal(b.markers[0].id, 'dot0');
});

test('grid.cellText formats values, prefers text', () => {
  assert.equal(G.cellText({ value: Infinity }), '∞');
  assert.equal(G.cellText({ value: 3, text: 'x' }), 'x');
  assert.equal(G.cellText({ value: null }), '');
  assert.equal(G.cellText(null), '');
});

test('grid.headers: arrays, true -> indices, otherwise null', () => {
  assert.deepEqual(G.headers(true, 3), ['0', '1', '2']);
  assert.deepEqual(G.headers(['a', null, 2], 3), ['a', '', '2']);
  assert.equal(G.headers(undefined, 3), null);
});

test('grid.geometry fits square cells, centres the block and hit-tests', () => {
  const g = G.geometry({ width: 400, rows: 4, cols: 5, cellSize: 40, rowHeaderW: 20, colHeaderH: 20, pad: 6 });
  assert.equal(g.cs, 40);
  assert.equal(g.gridW, 200);
  assert.equal(g.x0, (400 - 20 - 200) / 2 + 20, 'block of headers + cells is centred');
  assert.equal(g.y0, 26);
  assert.equal(g.height, 26 + 160 + 6);
  assert.deepEqual(G.cellAt(g, g.x0 + 1, g.y0 + 1), [0, 0]);
  assert.deepEqual(G.cellAt(g, g.x0 + 4.5 * 40, g.y0 + 3.5 * 40), [3, 4]);
  assert.equal(G.cellAt(g, g.x0 - 1, g.y0 + 1), null);
  assert.equal(G.cellAt(g, g.x0 + 1, g.y0 + 160.5), null);
  const narrow = G.geometry({ width: 390, rows: 40, cols: 60, cellSize: 14, pad: 6 });
  assert.ok(narrow.gridW <= 390 - 12 + 1e-9, 'shrinks to fit a phone');
  const r = G.cellRect(g, 1, 2, 2);
  assert.deepEqual(r, { x: g.x0 + 80 + 1, y: g.y0 + 40 + 1, w: 38, h: 38 });
});

test('grid.line connects cells without gaps (Bresenham)', () => {
  assert.deepEqual(G.line(0, 0, 0, 3), [[0, 0], [0, 1], [0, 2], [0, 3]]);
  const diag = G.line(0, 0, 3, 5);
  assert.deepEqual(diag[0], [0, 0]);
  assert.deepEqual(diag[diag.length - 1], [3, 5]);
  for (let i = 1; i < diag.length; i++) {
    assert.ok(Math.abs(diag[i][0] - diag[i - 1][0]) <= 1 && Math.abs(diag[i][1] - diag[i - 1][1]) <= 1, 'neighbouring steps');
  }
  assert.deepEqual(G.line(2, 2, 2, 2), [[2, 2]]);
});

test('grid.arrowGeom keeps axis arrows beside the value and diagonals through the corner', () => {
  const g = G.geometry({ width: 500, rows: 3, cols: 3, cellSize: 40, pad: 0 });
  const right = G.arrowGeom(g, [1, 0], [1, 1]);
  const c0 = G.center(g, 1, 0);
  assert.ok(right.y1 > c0.y + 10 && right.y2 > c0.y + 10, 'rightward arrow runs below the text line');
  assert.ok(right.x2 > right.x1);
  assert.ok(Math.abs(right.angle) < 1e-9);
  const down = G.arrowGeom(g, [0, 1], [1, 1]);
  assert.ok(down.x1 > G.center(g, 0, 1).x + 10, 'downward arrow runs right of the text');
  const diag = G.arrowGeom(g, [0, 0], [1, 1]);
  const corner = { x: g.x0 + 40, y: g.y0 + 40 };
  // the corner lies on the (straight) segment, strictly between its ends
  const cross = (diag.x2 - diag.x1) * (corner.y - diag.y1) - (diag.y2 - diag.y1) * (corner.x - diag.x1);
  assert.ok(Math.abs(cross) < 1e-6, 'diagonal passes through the shared corner');
  assert.ok(diag.x1 < corner.x && corner.x < diag.x2);
  const far = G.arrowGeom(g, [0, 0], [2, 2]);
  assert.ok(far.cx !== (far.x1 + far.x2) / 2 || far.cy !== (far.y1 + far.y2) / 2, 'long arrows bend');
  assert.match(right.d, /^M[\d.]+ [\d.]+Q/);
  assert.ok(right.length > 0);
});

test('grid.parseColor reads computed colour syntaxes', () => {
  assert.deepEqual(G.parseColor('rgb(10, 20, 30)'), [10, 20, 30, 1]);
  assert.deepEqual(G.parseColor('rgba(10, 20, 30, 0.5)'), [10, 20, 30, 0.5]);
  assert.deepEqual(G.parseColor('rgb(10 20 30 / 25%)'), [10, 20, 30, 0.25]);
  assert.deepEqual(G.parseColor('color(srgb 1 0.5 0)'), [255, 128, 0, 1]);
  assert.deepEqual(G.parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(G.parseColor('#12345680'), [0x12, 0x34, 0x56, 128 / 255]);
  assert.deepEqual(G.parseColor('transparent'), [0, 0, 0, 0]);
  assert.equal(G.parseColor('oklab(0.5 0.1 0.1)'), null, 'unknown syntaxes fall back to the browser');
});

/* ------------------------------------------------------------ chart */
test('chart.niceTicks: 1-2-5 steps that cover the data', () => {
  const t = C.niceTicks(0, 2100, 5);
  assert.equal(t.step, 500);
  assert.equal(t.min, 0);
  assert.equal(t.max, 2500);
  assert.deepEqual(t.ticks, [0, 500, 1000, 1500, 2000, 2500]);
  assert.deepEqual(C.niceTicks(0, 400, 5).ticks, [0, 100, 200, 300, 400]);
});

test('chart.niceTicks: negatives, zero span, tiny ranges, reversed input', () => {
  const neg = C.niceTicks(-37, 12, 5);
  assert.ok(neg.min <= -37 && neg.max >= 12);
  assert.ok(neg.ticks.includes(0));
  const flat = C.niceTicks(5, 5, 5);
  assert.ok(flat.min < 5 && flat.max > 5, 'zero-width range is widened');
  const tiny = C.niceTicks(0.1, 0.3, 5);
  assert.deepEqual(tiny.ticks, [0.1, 0.15, 0.2, 0.25, 0.3], 'no float noise like 0.30000000000000004');
  const rev = C.niceTicks(10, 0, 3);
  assert.equal(rev.min, 0);
  assert.equal(rev.max, 10);
  const inf = C.niceTicks(NaN, Infinity);
  assert.deepEqual([inf.min, inf.max], [0, 1]);
});

test('chart.logTicks: decades with minor ticks, sparser labels for wide ranges', () => {
  const t = C.logTicks(3, 4500);
  assert.equal(t.min, 1);
  assert.equal(t.max, 10000);
  assert.deepEqual(t.major, [1, 10, 100, 1000, 10000]);
  assert.equal(t.minor.length, 4 * 8);
  assert.ok(t.minor.includes(200) && t.minor.includes(9000));
  const wide = C.logTicks(1, 1e12);
  assert.equal(wide.major.length, 13);
  assert.equal(wide.minor.length, 0, 'minor ticks dropped for many decades');
  assert.ok(wide.labelEvery >= 2);
  const exact = C.logTicks(10, 100);
  assert.deepEqual(exact.major, [10, 100]);
  assert.deepEqual(C.logTicks(0, 0).major, [1, 10], 'non-positive input falls back safely');
});

test('chart scales map and invert', () => {
  const x = C.scaleLinear(0, 10, 100, 200);
  assert.equal(x(5), 150);
  assert.equal(x.invert(175), 7.5);
  const y = C.scaleLinear(0, 100, 300, 0);
  assert.equal(y(25), 225);
  const lg = C.scaleLog(1, 1000, 0, 300);
  assert.ok(Math.abs(lg(10) - 100) < 1e-9);
  assert.ok(Math.abs(lg.invert(200) - 100) < 1e-6);
  assert.ok(Number.isNaN(lg(0)), 'log of non-positive values is NaN (drawn as a break)');
  assert.equal(C.scaleLinear(5, 5, 0, 10)(5), 0, 'degenerate domain does not divide by zero');
});

test('chart.formatTick and formatValue are compact and readable', () => {
  assert.equal(C.formatTick(0), '0');
  assert.equal(C.formatTick(250), '250');
  assert.equal(C.formatTick(1000), '1k');
  assert.equal(C.formatTick(1500), '1.5k');
  assert.equal(C.formatTick(2e7), '20M');
  assert.equal(C.formatTick(3e9), '3B');
  assert.equal(C.formatTick(1e12), '10¹²');
  assert.equal(C.formatTick(2e15), '2×10¹⁵');
  assert.equal(C.formatTick(0.25), '0.25');
  assert.equal(C.formatTick(0.0001), '10⁻⁴');
  assert.equal(C.formatTick(-500), '−500');
  assert.equal(C.formatValue(12345), '12,345');
  assert.equal(C.formatValue(67108864), '67.11M');
  assert.equal(C.formatValue(122.2), '122.2');
  assert.equal(C.formatValue(4.7004), '4.7');
  assert.equal(C.formatValue(Infinity), '∞');
  assert.equal(C.formatValue(NaN), '—');
});

test('chart.sampleFn samples linearly or logarithmically and breaks on non-finite values', () => {
  const lin = C.sampleFn(x => x * 2, 0, 10, 6);
  assert.deepEqual(lin.map(p => p[0]), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(lin.map(p => p[1]), [0, 4, 8, 12, 16, 20]);
  const lg = C.sampleFn(x => x, 1, 1000, 4, true);
  lg.forEach((p, i) => assert.ok(Math.abs(p[0] - Math.pow(10, i)) < 1e-9));
  const bad = C.sampleFn(x => 1 / (x - 5), 0, 10, 3);
  assert.ok(Number.isNaN(bad[1][1]));
  const thrower = C.sampleFn(() => { throw new Error('x'); }, 0, 1, 2);
  assert.ok(Number.isNaN(thrower[0][1]));
});

test('chart.resample keeps endpoints and target count', () => {
  const pts = [[0, 0], [10, 10], [20, 0]];
  const r = C.resample(pts, 5);
  assert.equal(r.length, 5);
  assert.deepEqual(r[0], [0, 0]);
  assert.deepEqual(r[2], [10, 10]);
  assert.deepEqual(r[4], [20, 0]);
  assert.equal(C.resample([], 3).length, 3);
  assert.deepEqual(C.resample([[1, 2]], 2), [[1, 2], [1, 2]]);
});

test('chart.linePath breaks the line at NaN points', () => {
  assert.equal(C.linePath([[0, 0], [1, 1], [NaN, NaN], [2, 2], [3, 3]]), 'M0 0L1 1M2 2L3 3');
  assert.equal(C.linePath([]), '');
});

test('chart.labelLayout separates overlapping labels within bounds', () => {
  const out = C.labelLayout([{ id: 'a', y: 100, h: 14 }, { id: 'b', y: 102, h: 14 }, { id: 'c', y: 104, h: 14 }], 0, 300, 2);
  const ys = ['a', 'b', 'c'].map(k => out[k]).sort((p, q) => p - q);
  assert.ok(ys[1] - ys[0] >= 16 - 1e-9 && ys[2] - ys[1] >= 16 - 1e-9);
  const clamped = C.labelLayout([{ id: 'a', y: 295, h: 14 }, { id: 'b', y: 299, h: 14 }], 0, 300, 2);
  assert.ok(clamped.b <= 293 + 1e-9, 'pushed back inside the bottom bound');
  assert.ok(clamped.a <= clamped.b - 16 + 1e-9);
  assert.deepEqual(C.labelLayout([{ id: 'x', y: NaN }], 0, 10), {});
});

test('chart.valueAt interpolates inside the range only', () => {
  const pts = [[0, 0], [10, 100], [20, 50]];
  assert.equal(C.valueAt(pts, 5), 50);
  assert.equal(C.valueAt(pts, 20), 50);
  assert.equal(C.valueAt(pts, 15), 75);
  assert.equal(C.valueAt(pts, -1), null);
  assert.equal(C.valueAt(pts, 21), null);
  assert.equal(C.valueAt([], 1), null);
});
