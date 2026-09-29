/* Pure layout math for js/vdsa/views/tree.js and callstack.js (node --test 'tests/engine/*.test.js'). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const VIEWS = path.join(__dirname, '..', '..', 'js', 'vdsa', 'views');
const T = require(path.join(VIEWS, 'tree.js'));
const C = require(path.join(VIEWS, 'callstack.js'));
const EPS = 1e-9;

/* ------------------------------------------------------------ helpers */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function bst(values) {
  const nodes = {}; let root = null;
  for (const v of values) {
    const id = 'n' + v; nodes[id] = { id, value: v, left: null, right: null };
    if (!root) { root = id; continue; }
    let cur = root;
    for (;;) { const side = v < nodes[cur].value ? 'left' : 'right'; if (!nodes[cur][side]) { nodes[cur][side] = id; break; } cur = nodes[cur][side]; }
  }
  return { nodes: Object.values(nodes), root };
}
function randomBst(n, seed) {
  const r = rng(seed), vals = new Set();
  while (vals.size < n) vals.add(1 + Math.floor(r() * 500));
  return bst([...vals]);
}
/* no two boxes on the same level closer than gap (widths = 1 unless given) */
function assertNoOverlap(lay, gap, widths) {
  const byDepth = {};
  for (const [id, p] of Object.entries(lay.pos)) (byDepth[p.depth] = byDepth[p.depth] || []).push({ id, x: p.x, w: widths ? widths[id] : 1 });
  for (const nl of lay.nulls) (byDepth[nl.depth] = byDepth[nl.depth] || []).push({ id: 'null', x: nl.x, w: nl.w });
  for (const row of Object.values(byDepth)) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const need = (row[i - 1].w + row[i].w) / 2 + gap;
      assert.ok(row[i].x - row[i - 1].x >= need - 1e-6, `overlap between ${row[i - 1].id} and ${row[i].id}: ${row[i].x - row[i - 1].x} < ${need}`);
    }
  }
}

/* ------------------------------------------------------------ tree.tidy */
test('tree.tidy: empty and single-node trees', () => {
  const e = T.tidy([], null);
  assert.deepEqual(e.pos, {});
  assert.equal(e.width, 0);
  const one = T.tidy([{ id: 'a', value: 1 }], 'a');
  assert.deepEqual(one.pos.a, { x: 0.5, y: 0, depth: 0, w: 1 });
  assert.equal(one.width, 1);
  assert.equal(one.depth, 0);
});

test('tree.tidy: a lone child sits on its own side', () => {
  const left = T.tidy([{ id: 'p', left: 'c' }, { id: 'c' }], 'p');
  assert.ok(left.pos.c.x < left.pos.p.x, 'left child is left of parent');
  const right = T.tidy([{ id: 'p', right: 'c' }, { id: 'c' }], 'p');
  assert.ok(right.pos.c.x > right.pos.p.x, 'right child is right of parent');
  assert.ok(Math.abs((right.pos.c.x - right.pos.p.x) - 0.75) < EPS, 'offset (w + gap) / 2');
});

test('tree.tidy: parents are centred over their children (binary and n-ary)', () => {
  const t = randomBst(40, 3);
  const lay = T.tidy(t.nodes, t.root);
  for (const n of t.nodes) {
    if (n.left && n.right) {
      const mid = (lay.pos[n.left].x + lay.pos[n.right].x) / 2;
      assert.ok(Math.abs(mid - lay.pos[n.id].x) < 1e-6, 'centred over two children');
    }
  }
  const nary = [{ id: 'A', children: ['B', 'C', 'D'] }, { id: 'B', children: ['E', 'F'] }, { id: 'C', children: [] }, { id: 'D', children: ['G'] }, { id: 'E' }, { id: 'F' }, { id: 'G' }];
  const L = T.tidy(nary, 'A');
  assert.ok(Math.abs(L.pos.A.x - (L.pos.B.x + L.pos.D.x) / 2) < 1e-6);
  assert.ok(Math.abs(L.pos.B.x - (L.pos.E.x + L.pos.F.x) / 2) < 1e-6);
  assert.ok(Math.abs(L.pos.D.x - L.pos.G.x) < 1e-6, 'single n-ary child sits directly below');
  assert.ok(L.pos.B.x < L.pos.C.x && L.pos.C.x < L.pos.D.x, 'children keep their order');
});

test('tree.tidy: no overlaps for random BSTs of 1..63 nodes, with and without nulls', () => {
  for (let n = 1; n <= 63; n += 3) {
    for (const seed of [1, 7, 42]) {
      const t = randomBst(n, seed * 100 + n);
      const lay = T.tidy(t.nodes, t.root);
      assert.equal(Object.keys(lay.pos).length, n);
      assertNoOverlap(lay, 0.5);
      const withNulls = T.tidy(t.nodes, t.root, { showNulls: true });
      assert.equal(withNulls.nulls.length, n + 1, 'a binary tree with n nodes has n + 1 null links');
      assertNoOverlap(withNulls, 0.5);
      // depth and levels
      for (const nd of t.nodes) {
        if (nd.left) assert.equal(lay.pos[nd.left].depth, lay.pos[nd.id].depth + 1);
        if (nd.right) assert.equal(lay.pos[nd.right].depth, lay.pos[nd.id].depth + 1);
      }
    }
  }
});

test('tree.tidy: edges between children and parents never cross in-order for BSTs (left subtree stays left of right subtree)', () => {
  const t = randomBst(50, 9);
  const lay = T.tidy(t.nodes, t.root);
  const map = Object.fromEntries(t.nodes.map(n => [n.id, n]));
  function ids(id) { if (!id) return []; return [id, ...ids(map[id].left), ...ids(map[id].right)]; }
  for (const n of t.nodes) {
    if (!n.left || !n.right) continue;
    const L = ids(n.left), R = ids(n.right);
    // at each depth, every left-subtree node is left of every right-subtree node
    for (const a of L) for (const b of R) if (lay.pos[a].depth === lay.pos[b].depth) assert.ok(lay.pos[a].x < lay.pos[b].x);
  }
});

test('tree.tidy inorder: x order equals the in-order sequence', () => {
  for (const seed of [2, 5, 8]) {
    const t = randomBst(35, seed);
    const lay = T.tidy(t.nodes, t.root, { order: 'inorder' });
    const seq = T.inorder(t.nodes, t.root);
    for (let i = 1; i < seq.length; i++) assert.ok(lay.pos[seq[i]].x > lay.pos[seq[i - 1]].x, 'strictly increasing x in-order');
    assertNoOverlap(lay, 0.5);
  }
});

test('tree.tidy: variable node widths (pills) do not overlap', () => {
  const nodes = [{ id: 'r', children: ['a', 'b', 'c'] }, { id: 'a', children: ['d', 'e'] }, { id: 'b' }, { id: 'c', children: ['f'] }, { id: 'd' }, { id: 'e' }, { id: 'f' }];
  const widths = { r: 2.2, a: 1.8, b: 3, c: 1, d: 2.5, e: 2.5, f: 1.4 };
  const lay = T.tidy(nodes, 'r', { width: id => widths[id] });
  assertNoOverlap(lay, 0.5, widths);
  assert.ok(Math.abs(lay.width - (lay.maxX - lay.minX)) < EPS);
});

test('tree.tidy: deterministic, cycle-safe, root auto-detected', () => {
  const t = randomBst(20, 4);
  assert.deepEqual(T.tidy(t.nodes, t.root), T.tidy(t.nodes.slice(), t.root));
  const auto = T.tidy(t.nodes);
  assert.equal(auto.root, t.root, 'root = the node nobody points to');
  const cyc = T.tidy([{ id: 'a', left: 'b' }, { id: 'b', left: 'a', right: 'b' }], 'a');
  assert.deepEqual(Object.keys(cyc.pos).sort(), ['a', 'b']);
  const missing = T.tidy([{ id: 'a', left: 'ghost' }], 'a');
  assert.deepEqual(Object.keys(missing.pos), ['a'], 'dangling child ids are ignored');
});

test('tree.tidy: parent map and depth', () => {
  const t = bst([50, 30, 70, 20]);
  const lay = T.tidy(t.nodes, t.root);
  assert.deepEqual(lay.parent, { n30: 'n50', n20: 'n30', n70: 'n50' });
  assert.equal(lay.depth, 2);
  assert.equal(lay.binary, true);
});

test('tree.swingBend bulges away from the centroid and vanishes for tiny moves', () => {
  const b = T.swingBend({ x: 0, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 0 });
  // chord from (0,100) to (100,0); centroid at origin: bulge towards (+,+) i.e. down-right in screen space
  assert.ok(b.arcX > 0, 'x bend away from centroid');
  assert.ok(b.arc < 0, 'y bend away from centroid (arc is subtracted from y)');
  assert.deepEqual(T.swingBend({ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 5, y: 5 }), { arc: 0, arcX: 0 });
});

/* ------------------------------------------------------------ callstack */
test('callstack.normalize: locals as object, pairs or records; args as object', () => {
  const f = C.normalize({ frames: [
    { id: 'a', fn: 'f', args: { n: 3, k: 1 }, locals: { x: 1 } },
    { fn: 'g', locals: [['y', 2]] },
    { id: 'c', fn: 'h', locals: [{ name: 'z', value: 3, state: 'swap' }], returnValue: 0 }
  ] });
  assert.equal(f[0].args, 'n=3, k=1');
  assert.deepEqual(f[0].locals, [{ name: 'x', value: 1 }]);
  assert.equal(f[1].id, 'frame1');
  assert.deepEqual(f[1].locals, [{ name: 'y', value: 2 }]);
  assert.equal(f[2].hasReturn, true, 'returnValue 0 still counts');
  assert.equal(f[2].locals[0].state, 'swap');
  assert.deepEqual(C.normalize([{ id: 'x', fn: 'f' }]).map(x => x.id), ['x'], 'accepts a bare array');
});

test('callstack.stack: grows upward from the bottom, collapses old frames', () => {
  const frames = C.normalize([{ id: 'a', fn: 'f' }, { id: 'b', fn: 'f', locals: { n: 1 } }, { id: 'c', fn: 'f' }]);
  const L = C.stack(frames, { head: 32, row: 20, gap: 6, pad: 8 });
  assert.deepEqual(L.cards.map(c => c.id), ['a', 'b', 'c']);
  assert.ok(L.cards[0].y > L.cards[1].y && L.cards[1].y > L.cards[2].y, 'newest on top');
  assert.equal(L.cards[0].y + L.cards[0].h, L.height - 8, 'bottom frame sits on the floor');
  assert.equal(L.cards[1].h, 32 + 20 + 8);
  const down = C.stack(frames, { direction: 'down', pad: 8 });
  assert.equal(down.cards[0].y, 8);
  assert.ok(down.cards[2].y > down.cards[0].y);
  const deep = C.stack(C.normalize(Array.from({ length: 10 }, (_, i) => ({ id: 'f' + i, fn: 'f' }))), { maxVisible: 4 });
  assert.equal(deep.collapsed, 6);
  assert.deepEqual(deep.cards.map(c => c.id), ['f6', 'f7', 'f8', 'f9']);
  assert.ok(deep.more && deep.more.y > deep.cards[0].y, 'the "more" bar sits below the visible frames');
  const tall = C.stack(frames, { height: 500 });
  assert.equal(tall.height, 500, 'a fixed height is respected');
});
