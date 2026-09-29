/* Pure layout math for VDSA.views.hashtable (hash.js) and VDSA.views.memory (memory.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const VIEWS = path.join(__dirname, '..', '..', 'js', 'vdsa', 'views');
const H = require(path.join(VIEWS, 'hash.js'));
const M = require(path.join(VIEWS, 'memory.js'));

/* ------------------------------------------------------------ hash */
test('hash.mod never returns a negative bucket', () => {
  assert.equal(H.mod(23, 7), 2);
  assert.equal(H.mod(-3, 7), 4);
  assert.equal(H.mod(0, 5), 0);
});

test('hash.probe and probeSequence: linear, quadratic, double hashing', () => {
  assert.deepEqual(H.probeSequence(5, 7, 'linear'), [5, 6, 0, 1, 2, 3, 4]);
  assert.deepEqual(H.probeSequence(3, 7, 'quadratic', 0, 4), [3, 4, 0, 5]);
  assert.deepEqual(H.probeSequence(1, 7, 'double', 3, 4), [1, 4, 0, 3]);
  // a full linear sequence visits every slot exactly once
  assert.equal(new Set(H.probeSequence(4, 11, 'linear')).size, 11);
});

test('hash.normalize: chains follow pos, then list order; buckets wrap into range', () => {
  const N = H.normalize({
    buckets: 5,
    entries: [{ id: 'a', key: 10, bucket: 0 }, { id: 'b', key: 5, bucket: 0, pos: 0 }, { id: 'c', key: 7, bucket: 7 }]
  }, 'chaining');
  assert.equal(N.m, 5);
  assert.deepEqual(N.chains[0].map(e => e.id), ['b', 'a']);
  assert.deepEqual(N.chains[0].map(e => e.pos), [0, 1]);
  assert.deepEqual(N.chains[2].map(e => e.id), ['c'], 'bucket 7 wraps to 7 mod 5 = 2');
  assert.equal(N.load, 3 / 5);
  assert.equal(N.count, 3);
});

test('hash.normalize: open addressing keeps one entry per slot and tombstones', () => {
  const N = H.normalize({ buckets: 7, entries: [{ id: 'x', key: 10, bucket: 3 }], tombstones: [4, 4, 11] }, 'open');
  assert.equal(N.slots[3].id, 'x');
  assert.equal(N.slots[3].pos, 0);
  assert.deepEqual(N.tombstones, [4], 'deduplicated and wrapped (11 mod 7 = 4)');
});

test('hash.normalize: incoming defaults (stage, state, chain-end position)', () => {
  const base = { buckets: 7, entries: [{ id: 'a', key: 3, bucket: 3 }] };
  const a = H.normalize(Object.assign({ incoming: { id: 'k', key: 10 } }, base), 'chaining');
  assert.equal(a.incoming.stage, 'input');
  assert.equal(a.incoming.state, 'key');
  const b = H.normalize(Object.assign({ incoming: { id: 'k', key: 10, stage: 'bucket', bucket: 3 } }, base), 'chaining');
  assert.equal(b.incoming.pos, 1, 'arrives after the existing entry');
  const c = H.normalize(Object.assign({ incoming: { id: 'k', key: 10, stage: 'bucket' } }, base), 'chaining');
  assert.equal(c.incoming.stage, 'hash', 'no bucket yet: stays in the hash box');
});

test('hash.normalize: probe current defaults to the last probed slot; loadFactor override', () => {
  const N = H.normalize({ buckets: 7, probe: { slots: [3, 4, 5] }, loadFactor: 0.9 }, 'open');
  assert.equal(N.probe.current, 5);
  assert.equal(N.probe.state, 'compare');
  assert.equal(N.load, 0.9);
  assert.equal(H.normalize({ buckets: 3, loadFactor: false }, 'open').showLoad, false);
});

test('hash.rowHeight shrinks with many buckets but stays readable', () => {
  assert.equal(H.rowHeight(5), 38);
  assert.ok(H.rowHeight(11) < 38);
  assert.ok(H.rowHeight(40) >= 20);
  assert.ok(H.rowHeight(16) * 16 <= 450);
});

test('hash.chainFit keeps the ideal width when it fits and shrinks otherwise', () => {
  assert.deepEqual(H.chainFit(500, 4, 48, 22), { w: 48, gap: 22 });
  const f = H.chainFit(300, 6, 48, 22, 28);
  assert.ok(f.w * 6 + f.gap * 6 <= 300 + 1e-9);
  assert.ok(f.w >= 28 && f.gap >= 12);
  // readability floor wins over fitting (the chain may overflow instead of shrinking to nothing)
  const tight = H.chainFit(100, 10, 48, 22, 28);
  assert.equal(tight.w, 28);
  assert.equal(tight.gap, 12);
});

test('hash.meterMax leaves headroom above the load and threshold', () => {
  assert.equal(H.meterMax(0.5, 0.75), 1);
  assert.ok(H.meterMax(1.2, 0.75) > 1.2);
});

/* ------------------------------------------------------------ memory */
test('memory.hex and bits', () => {
  assert.equal(M.hex(0x1004, 4), '0x1004');
  assert.equal(M.hex(10, 4), '0x000A');
  assert.equal(M.bits(44), '00101100');
  assert.equal(M.bits(300), '0000000100101100');
  assert.equal(M.bits(-1, 8), '11111111');
  assert.equal(M.bits('x'), '');
});

test('memory.ramCells resolves addresses from base and word size', () => {
  const cells = M.ramCells({ base: 0x2000, wordSize: 4, values: [1, 2, 3] });
  assert.deepEqual(cells.map(c => c.addr), [0x2000, 0x2004, 0x2008]);
  assert.equal(cells[1].state, 'default');
  const explicit = M.ramCells({ cells: [{ value: 'a', addr: 7, state: 'active' }, 5] });
  assert.equal(explicit[0].addr, 7);
  assert.equal(explicit[1].value, 5);
});

test('memory.segments splits a variable across rows', () => {
  assert.deepEqual(M.segments(2, 9, 4), [{ row: 0, from: 2, to: 3 }, { row: 1, from: 4, to: 7 }, { row: 2, from: 8, to: 9 }]);
  assert.deepEqual(M.segments(5, 4, 4), []);
});

test('memory.route: enters from the left, top, bottom, or loops over the top', () => {
  const right = M.route(0, 50, { x: 100, y: 30, w: 60, h: 40 });
  assert.equal(right.ex, 99); assert.equal(right.ey, 50); assert.equal(right.angle, 0);
  const below = M.route(100, 0, { x: 80, y: 100, w: 60, h: 30 });
  assert.equal(below.ey, 99); assert.equal(below.angle, Math.PI / 2);
  assert.ok(below.ex >= 80 && below.ex <= 140);
  const above = M.route(100, 200, { x: 80, y: 20, w: 60, h: 30 });
  assert.equal(above.ey, 51); assert.equal(above.angle, -Math.PI / 2);
  const behind = M.route(200, 50, { x: 20, y: 30, w: 60, h: 40 });
  assert.ok(behind.c1y < 30 && behind.c2y < 30, 'loops above the box');
  assert.equal(behind.ey, 29);
  // minExit keeps the first leg horizontal for longer
  const long = M.route(0, 50, { x: 200, y: 0, w: 40, h: 40 }, { minExit: 120 });
  assert.equal(long.c1x, 120);
});

test('memory.lerpRoute interpolates points and takes the short way round for angles', () => {
  const a = { sx: 0, sy: 0, c1x: 0, c1y: 0, c2x: 0, c2y: 0, ex: 0, ey: 0, angle: -Math.PI / 2 };
  const b = { sx: 10, sy: 10, c1x: 10, c1y: 10, c2x: 10, c2y: 10, ex: 10, ey: 10, angle: Math.PI / 2 };
  const m = M.lerpRoute(a, b, 0.5);
  assert.equal(m.ex, 5);
  assert.ok(Math.abs(Math.abs(m.angle) - 0) < 1e-9 || Math.abs(Math.abs(m.angle) - Math.PI) < 1e-9);
});

test('memory.frameHeight grows by one row per variable', () => {
  assert.equal(M.frameHeight(2) - M.frameHeight(1), 26);
  assert.ok(M.frameHeight(0) >= 28);
});

test('memory.flow stacks objects, keeps sameRow neighbours together, wraps when full, honours manual x/y', () => {
  const r = M.flow([{ w: 100, h: 40 }, { w: 80, h: 30, sameRow: true }, { w: 90, h: 20, sameRow: true }, { w: 50, h: 50, x: 0.5, y: 300 }], 250);
  assert.deepEqual(r.positions[0], { x: 0, y: 0 });
  assert.deepEqual(r.positions[1], { x: 134, y: 0 });
  assert.deepEqual(r.positions[2], { x: 0, y: 60 }, 'does not fit: wraps to a new row below the tallest');
  assert.deepEqual(r.positions[3], { x: 125, y: 300 });
  assert.equal(r.height, 350);
  assert.deepEqual(M.flow([], 100), { positions: [], height: 0 });
});
