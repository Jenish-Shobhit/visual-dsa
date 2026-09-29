/* Pure layout math for js/vdsa/views/list.js and stack.js (node --test 'tests/engine/*.test.js'). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const VIEWS = path.join(__dirname, '..', '..', 'js', 'vdsa', 'views');
const Li = require(path.join(VIEWS, 'list.js'));
const St = require(path.join(VIEWS, 'stack.js'));

const chain = (vals, p = 'n') => vals.map((v, i) => ({ id: p + i, value: v, next: i < vals.length - 1 ? p + (i + 1) : null }));

/* ------------------------------------------------------------ list */
test('list.model: default order is the node array order and stays put when links flip', () => {
  const nodes = chain([1, 2, 3]);
  nodes[1].next = 'n0'; nodes[0].next = null; // partially reversed
  const m = Li.model({ nodes, head: 'n1' });
  assert.deepEqual(m.row, ['n0', 'n1', 'n2']);
  assert.equal(m.doubly, false);
});

test('list.model: order "follow" walks next from head, then appends the rest; cycles stop', () => {
  const nodes = chain([1, 2, 3, 4]);
  nodes[3].next = 'n1'; // cycle
  const m = Li.model({ nodes: [nodes[2], nodes[0], nodes[3], nodes[1]], head: 'n0', order: 'follow' });
  assert.deepEqual(m.row, ['n0', 'n1', 'n2', 'n3']);
  const given = Li.model({ nodes, order: ['n3', 'n0'] });
  assert.deepEqual(given.row, ['n3', 'n0', 'n1', 'n2']);
});

test('list.model: detached nodes leave the row and sit above the gap they will fill', () => {
  const nodes = chain([3, 7, 12]);
  nodes.splice(2, 0, { id: 'x', value: 9, next: 'n2', detached: 'above' });
  const m = Li.model({ nodes, head: 'n0' });
  assert.deepEqual(m.row, ['n0', 'n1', 'n2']);
  assert.deepEqual(m.free, [{ id: 'x', x: 1.5, y: -1 }]);
  // a predecessor pointing at it also places it after that node; explicit x/y win
  const m2 = Li.model({ nodes: [{ id: 'a', value: 1, next: 'z' }, { id: 'b', value: 2 }, { id: 'z', value: 5, detached: 'below' }] });
  assert.deepEqual(m2.free, [{ id: 'z', x: 0.5, y: 1 }]);
  const m3 = Li.model({ nodes: [{ id: 'a', value: 1 }, { id: 'q', value: 2, x: 3, y: -2 }] });
  assert.deepEqual(m3.free, [{ id: 'q', x: 3, y: -2 }]);
});

test('list.model: dangling links become null, head adds a head pointer, doubly is auto-detected', () => {
  const m = Li.model({ nodes: [{ id: 'a', value: 1, next: 'ghost', prev: null }, { id: 'b', value: 2, prev: 'a' }], head: 'a', pointers: [{ name: 'curr', target: 'missing' }] });
  assert.equal(m.byId.a.next, null);
  assert.equal(m.doubly, true);
  assert.deepEqual(m.pointers.map(p => [p.name, p.target]), [['head', 'a'], ['curr', null]]);
  const noHead = Li.model({ nodes: [{ id: 'a', value: 1 }], head: 'a' }, { headPointer: false });
  assert.equal(noHead.pointers.length, 0);
});

test('list.fit shrinks nodes to fit and wraps only when compact nodes still overflow', () => {
  const roomy = Li.fit(1000, 5, false, false, true, true);
  assert.equal(roomy.wrapped, false); assert.equal(roomy.t, 1);
  const phone = Li.fit(330, 6, false, false, true, true);
  assert.equal(phone.wrapped, false);
  assert.ok(phone.t >= 0 && phone.t < 1);
  const many = Li.fit(330, 14, false, false, true, true);
  assert.equal(many.wrapped, true);
  assert.ok(many.perRow >= 1 && many.perRow < 14);
  const d = Li.dims(0, false);
  assert.ok(many.perRow * d.nodeW + (many.perRow - 1) * d.gap <= 330);
});

test('list.route picks straight, skip, backward, loop and self routes', () => {
  const d = Li.dims(1, false);
  const at = (id, slot) => ({ id, slot, rowIdx: 0, cx: slot * d.slotW, cy: 0 });
  assert.equal(Li.route(at('a', 0), at('b', 1), 1, d).kind, 'adjacent');
  const skip = Li.route(at('a', 0), at('c', 3), 1, d);
  assert.equal(skip.kind, 'skip'); assert.equal(skip.anchor.side, 'top'); assert.ok(skip.above > 0);
  const back = Li.route(at('c', 3), at('a', 0), 1, d);
  assert.equal(back.kind, 'back'); assert.equal(back.anchor.side, 'bottom'); assert.ok(back.below > 0);
  assert.ok(back.below > Li.route(at('b', 1), at('a', 0), 1, d).below, 'longer backward links arc deeper');
  const loop = Li.route(at('e', 4), at('a', 0), 1, d, { circular: true, firstSlot: 0, lastSlot: 4 });
  assert.equal(loop.kind, 'loop'); assert.equal(loop.anchor.side, 'left');
  assert.equal(Li.route(at('a', 0), at('a', 0), 1, d).kind, 'self');
  // prev links mirror next links
  assert.equal(Li.route(at('b', 1), at('a', 0), -1, d).anchor.side, 'right');
  assert.equal(Li.route(at('a', 0), at('c', 2), -1, d).anchor.side, 'top');
  // detached target above: enters from below
  const up = Li.route(at('a', 0), { id: 'x', rowIdx: -1, cx: 0.5 * d.slotW, cy: -80 }, 1, d);
  assert.equal(up.kind, 'cross'); assert.equal(up.anchor.side, 'bottom');
});

test('list.cubic: straight params give points on the chord; bend goes left of travel', () => {
  const straight = Li.cubic([0, 0], [90, 0], Li.params({ a1: 1 / 3, a2: 1 / 3 }));
  assert.deepEqual(straight.map(p => p.map(Math.round)), [[0, 0], [30, 0], [60, 0], [90, 0]]);
  const up = Li.cubic([0, 0], [90, 0], Li.params({ h1: 20, h2: 20 }));
  assert.ok(up[1][1] < 0 && up[2][1] < 0, 'rightward chord bends up');
  const down = Li.cubic([90, 0], [0, 0], Li.params({ h1: 20, h2: 20 }));
  assert.ok(down[1][1] > 0, 'leftward chord bends down');
});

test('list.sweep rotates around the pivot, via below for a half turn, and lerps when retracting', () => {
  const D = [0, 0];
  const mid = Li.sweep(D, [50, 0], [-50, 1], 0.5, 1);
  assert.ok(mid[1] > 20, 'swings through below');
  const midUp = Li.sweep(D, [50, 0], [-50, 1], 0.5, -1);
  assert.ok(midUp[1] < -20, 'prefer -1 swings through above');
  assert.deepEqual(Li.sweep(D, [50, 0], [0, 0], 0.5, 1), [25, 0]);
  const end = Li.sweep(D, [50, 0], [0, 40], 1, 1);
  assert.ok(Math.abs(end[0]) < 1e-9 && Math.abs(end[1] - 40) < 1e-9);
});

/* ------------------------------------------------------------ stack / queue / ring */
test('stack.items normalises values, ids and explicit slots', () => {
  const items = St.items({ items: [5, { id: 'b', value: 7, index: 4 }, null] });
  assert.deepEqual(items.map(i => [i.id, i.slot, i.state]), [['i0', 0, 'default'], ['b', 4, 'default']]);
});

test('stack.ends infers which end items entered or left a deque', () => {
  assert.deepEqual(St.ends(['a', 'b'], ['a', 'b', 'c']), { enter: { c: 'rear' }, exit: {} });
  assert.deepEqual(St.ends(['a', 'b'], ['z', 'a', 'b']), { enter: { z: 'front' }, exit: {} });
  assert.deepEqual(St.ends(['a', 'b', 'c'], ['b', 'c']), { enter: {}, exit: { a: 'front' } });
  assert.deepEqual(St.ends(['a', 'b', 'c'], ['a', 'b']), { enter: {}, exit: { c: 'rear' } });
  assert.deepEqual(St.ends(['a', 'b', 'c'], ['a', 'c']), { enter: {}, exit: { b: 'middle' } });
  assert.deepEqual(St.ends([], ['x']), { enter: { x: 'rear' }, exit: {} });
});

test('ring: slot angles start at 12 o\'clock and rotations take the short way round', () => {
  assert.equal(St.slotAngle(0, 8), -Math.PI / 2);
  assert.ok(Math.abs(St.slotAngle(2, 8) - 0) < 1e-12, 'slot 2 of 8 is at 3 o\'clock');
  const from = St.slotAngle(5, 6), to = St.slotAngle(0, 6);
  const near = St.nearestAngle(from, to);
  assert.ok(Math.abs(near - from - Math.PI / 3) < 1e-9, 'wrap 5 -> 0 moves one slot forward');
  assert.ok(Math.abs(St.nearestAngle(0, 0.5) - 0.5) < 1e-12);
});

test('ring: normalise slots or indexed items, wrap head/tail, count size', () => {
  const r = St.ring({ capacity: 4, slots: [null, 3, { id: 'q', value: 9 }], head: 5, tail: -1 });
  assert.equal(r.capacity, 4);
  assert.deepEqual(r.slots.map(s => s && s.value), [null, 3, 9, null]);
  assert.equal(r.head, 1); assert.equal(r.tail, 3); assert.equal(r.size, 2);
  const r2 = St.ring({ capacity: 3, items: [{ id: 'a', value: 1, index: 2 }] });
  assert.deepEqual(r2.slots.map(s => s && s.id), [null, null, 'a']);
  assert.equal(St.ring({}).capacity, 8);
});

test('ring: sector path is a closed annular wedge', () => {
  const d = St.sector(0, 0, 50, 100, 0, Math.PI / 2);
  assert.match(d, /^M100 0A100 100 0 0 1 0 100L0 50A50 50 0 0 0 50 0Z$/);
});
