/* Pure layout math behind the renderers in js/vdsa/views/ (node --test tests/engine/).
   Each view file is UMD: in Node it exports its pure layout helpers only. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const VIEWS = path.join(__dirname, '..', '..', 'js', 'vdsa', 'views');
const vz = require(path.join(VIEWS, 'base.js'));
const A = require(path.join(VIEWS, 'array.js'));

/* ------------------------------------------------------------ base toolkit */
test('vz.fmt renders infinity, negatives and trims floats', () => {
  assert.equal(vz.fmt(Infinity), '∞');
  assert.equal(vz.fmt(-Infinity), '−∞');
  assert.equal(vz.fmt(-3), '−3');
  assert.equal(vz.fmt(2.5), '2.5');
  assert.equal(vz.fmt(1 / 3), '0.33');
  assert.equal(vz.fmt(2.0), '2');
  assert.equal(vz.fmt(null), '');
  assert.equal(vz.fmt('abc'), 'abc');
});

test('vz.local staggers and clamps progress', () => {
  assert.equal(vz.local(0, 0), 0);
  assert.equal(vz.local(1, 0), 1);
  assert.equal(vz.local(0.2, 0.5), 0);
  assert.equal(vz.local(1, 0.5), 1);
  const mid = vz.local(0.75, 0.5);
  assert.ok(mid > 0.4 && mid < 0.6, 'halfway through its own window');
});

test('vz.wrap keeps every line within the width and hard-breaks long words', () => {
  const lines = vz.wrap('Is the key smaller than the current node value?', 90, 12);
  assert.ok(lines.length >= 3);
  lines.forEach(l => assert.ok(vz.approxWidth(l, 12) <= 90 || !l.includes(' ')));
  const hard = vz.wrap('supercalifragilistic', 40, 12);
  assert.ok(hard.length > 1);
  assert.equal(hard.join(''), 'supercalifragilistic');
  assert.deepEqual(vz.wrap('', 50, 12), ['']);
});

test('vz.roundedPath starts and ends at the given points and rounds corners', () => {
  const d = vz.roundedPath([[0, 0], [100, 0], [100, 50]], 10);
  assert.match(d, /^M0 0/);
  assert.match(d, /L100 50$/);
  assert.match(d, /Q100 0 100 10/);
  assert.equal(vz.roundedPath([[0, 0]], 5), '');
});

test('vz.pointOnPolyline walks along segments', () => {
  const pts = [[0, 0], [10, 0], [10, 10]];
  assert.deepEqual(vz.pointOnPolyline(pts, 0), { x: 0, y: 0, angle: 0 });
  const half = vz.pointOnPolyline(pts, 0.5);
  assert.equal(half.x, 10); assert.equal(half.y, 0);
  const end = vz.pointOnPolyline(pts, 1);
  assert.equal(end.x, 10); assert.equal(end.y, 10);
  assert.ok(Math.abs(end.angle - Math.PI / 2) < 1e-9);
});

test('vz.arrowHead tip sits exactly at the given point', () => {
  const d = vz.arrowHead(50, 20, 0, 10);
  assert.match(d, /^M50 20L40 /);
});

/* ------------------------------------------------------------ array */
test('array.normalize: single-row form gets explicit slots, ids and states', () => {
  const n = A.normalize({ items: [{ id: 'a', value: 5 }, 7, null, { id: 'c', value: 1, index: 5 }], pointers: [{ name: 'i', index: 1 }] });
  assert.equal(n.rows.length, 1);
  const r = n.rows[0];
  assert.deepEqual(r.items.map(i => [i.id, i.slot, i.state]), [['a', 0, 'default'], ['main:1', 1, 'default'], ['c', 5, 'default']]);
  assert.equal(r.n, 6, 'explicit index extends the row');
  assert.equal(r.pointers.length, 1);
});

test('array.normalize: rows, row-targeted pointers/regions and held items', () => {
  const n = A.normalize({
    rows: [{ id: 'main', items: [1, 2] }, { id: 'aux', length: 4, items: [] }],
    pointers: [{ name: 'k', row: 'aux', index: 2 }, { name: 'i', index: 0 }],
    regions: [{ from: 0, to: 1, row: 'main', state: 'done' }],
    held: { id: 'x', value: 9, over: 3, row: 'aux' }
  });
  assert.equal(n.rows[1].n, 4, 'length reserves empty slots');
  assert.deepEqual(n.rows[1].pointers.map(p => p.name), ['k']);
  assert.deepEqual(n.rows[0].pointers.map(p => p.name), ['i']);
  assert.equal(n.rows[0].regions.length, 1);
  assert.deepEqual(n.held, [{ id: 'x', value: 9, text: undefined, state: 'key', label: undefined, badge: undefined, badgeState: undefined, over: 3, row: 'aux' }]);
});

test('array.normalize: empty state still yields one row', () => {
  const n = A.normalize({});
  assert.equal(n.rows.length, 1);
  assert.equal(n.rows[0].items.length, 0);
});

test('array.breakShift spreads gaps symmetrically', () => {
  assert.equal(A.breakShift([], 3, 10), 0);
  assert.equal(A.breakShift([4], 0, 10), -5);
  assert.equal(A.breakShift([4], 4, 10), 5);
  // three breaks: slot 0 shifts left by 1.5 gaps, last run right by 1.5 gaps
  assert.equal(A.breakShift([2, 4, 6], 0, 10), -15);
  assert.equal(A.breakShift([2, 4, 6], 7, 10), 15);
});

test('array.slotWidth caps at cellSize and fits narrow containers', () => {
  assert.equal(A.slotWidth(1000, 8, { cellSize: 48 }), 48);
  const narrow = A.slotWidth(350, 32, { cellSize: 26, outer: 1.5, min: 4 });
  assert.ok(narrow * 33.5 <= 350 - 24 + 1e-9);
  assert.equal(A.slotWidth(100, 100, { cellSize: 40, min: 4 }), 4, 'respects the minimum');
});

test('array.assignArcs: swap arcs both ways, shifts slide, lone jumper arcs up', () => {
  const mag = () => 20;
  assert.deepEqual(A.assignArcs([{ id: 'a', dx: 50 }, { id: 'b', dx: -50 }], mag), { a: 20, b: -20 });
  assert.deepEqual(A.assignArcs([{ id: 'a', dx: 50 }, { id: 'b', dx: 50 }], mag), {}, 'pure shift');
  assert.deepEqual(A.assignArcs([{ id: 'k', dx: -150 }, { id: 'a', dx: 50 }, { id: 'b', dx: 50 }, { id: 'c', dx: 50 }], mag), { k: 20 });
  assert.deepEqual(A.assignArcs([], mag), {});
});

test('array.pointerLevels stacks pointers sharing a slot and side', () => {
  const lv = A.pointerLevels([{ name: 'i', index: 2 }, { name: 'j', index: 2 }, { name: 'k', index: 2, side: 'above' }, { name: 'm', index: 3 }]);
  assert.deepEqual(lv.map(e => e.level), [0, 1, 0, 0]);
});

test('array.hex formats addresses', () => {
  assert.equal(A.hex(4096), '0x1000');
  assert.equal(A.hex(10, 4), '0x000A');
});
