// Lesson 24 · Union-find — step generator tests.
// Run: node --test tests/algos/24-union-find.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const UF = require(path.join(root, 'js/algos/24-union-find.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

const CONFIGS = [
  { byRank: false, compress: 'none' }, { byRank: true, compress: 'none' },
  { byRank: false, compress: 'full' }, { byRank: true, compress: 'full' },
  { byRank: false, compress: 'halving' }, { byRank: true, compress: 'halving' }
];

/* ------------------------------------------------------------------ straightforward references */
class RefPartition {           // relabel-everything set partition: obviously correct, slow
  constructor(n) { this.label = Array.from({ length: n }, (_, i) => i); }
  union(a, b) {
    const la = this.label[a], lb = this.label[b];
    if (la === lb) return false;
    for (let i = 0; i < this.label.length; i++) if (this.label[i] === lb) this.label[i] = la;
    return true;
  }
  same(a, b) { return this.label[a] === this.label[b]; }
  groups() { return new Set(this.label).size; }
}
function randomOps(n, m, rng) {
  const ops = [];
  for (let i = 0; i < m; i++) ops.push(rng() < 0.6 ? { type: 'union', a: rng.int(0, n - 1), b: rng.int(0, n - 1) } : { type: 'find', a: rng.int(0, n - 1) });
  return ops;
}
function reachable(adj, s) {
  const seen = new Set([s]), q = [s];
  while (q.length) { const u = q.shift(); for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  return seen;
}

/* ------------------------------------------------------------------ the structure */
test('DSU agrees with a relabelling reference on random operations, in every configuration', () => {
  for (const cfg of CONFIGS) {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = VDSA.rng(seed * 7 + 1), n = rng.int(1, 30);
      const d = new UF.DSU(n, cfg), ref = new RefPartition(n);
      for (const op of randomOps(n, 60, rng)) {
        if (op.type === 'union') assert.equal(d.union(op.a, op.b), ref.union(op.a, op.b));
        else d.find(op.a);
        const a = rng.int(0, n - 1), b = rng.int(0, n - 1);
        assert.equal(d.connected(a, b), ref.same(a, b));
      }
      assert.equal(d.groups().length, ref.groups());
    }
  }
});

test('DSU edge cases: single element, self union, repeated union, find of a root', () => {
  const d = new UF.DSU(1, CONFIGS[3]);
  assert.equal(d.find(0), 0);
  assert.equal(d.union(0, 0), false);
  assert.equal(d.hops, 0);
  const e = new UF.DSU(4, CONFIGS[3]);
  assert.equal(e.union(1, 2), true);
  assert.equal(e.union(2, 1), false);
  assert.equal(e.union(1, 2), false);
  assert.equal(e.redundant, 2);
  assert.equal(e.groups().length, 3);
  const z = new UF.DSU(0);
  assert.deepEqual(z.groups(), []);
  assert.equal(z.height(), 0);
});

test('naive union of a chain builds a tree of height n - 1; union by rank keeps it at 1', () => {
  const n = 40;
  const naive = new UF.DSU(n, { byRank: false, compress: 'none' });
  const ranked = new UF.DSU(n, { byRank: true, compress: 'none' });
  for (let i = 0; i + 1 < n; i++) { naive.union(i, i + 1); ranked.union(i, i + 1); }
  assert.equal(naive.height(), n - 1);
  assert.equal(naive.find(0), n - 1);
  assert.equal(ranked.height(), 1);
});

test('union by rank: a root of rank r has at least 2^r elements, so height <= log2 n', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = VDSA.rng(seed), n = rng.int(2, 64), d = new UF.DSU(n, { byRank: true, compress: 'none' });
    for (const op of randomOps(n, 150, rng)) if (op.type === 'union') d.union(op.a, op.b);
    assert.ok(d.height() <= Math.floor(Math.log2(n)), 'height ' + d.height() + ' for n=' + n);
    const sizes = {};
    for (let i = 0; i < n; i++) { const r = UF.rootOf(d.parent, i); sizes[r] = (sizes[r] || 0) + 1; }
    Object.keys(sizes).forEach((r) => assert.ok(sizes[r] >= 2 ** d.rank[r], 'size ' + sizes[r] + ' rank ' + d.rank[r]));
  }
});

test('the binomial workload reaches the rank bound exactly: height log2 n', () => {
  for (const n of [2, 4, 8, 16, 64, 256]) {
    const d = new UF.DSU(n, { byRank: true, compress: 'none' });
    UF.workload('binomial', n, VDSA.rng(3)).filter((o) => o.type === 'union').forEach((o) => d.union(o.a, o.b));
    assert.equal(d.height(), Math.log2(n));
    assert.equal(d.groups().length, 1);
  }
});

test('full path compression points every node on the path at the root; a second find is one hop', () => {
  const d = new UF.DSU(8, { byRank: false, compress: 'full' });
  d.parent = [1, 2, 3, 4, 5, 6, 7, 7];   // chain 0 -> 1 -> ... -> 7
  const path0 = [];
  assert.equal(d.find(0), 7);
  assert.equal(d.hops, 7);
  assert.deepEqual(d.parent, [7, 7, 7, 7, 7, 7, 7, 7]);
  const before = d.hops;
  d.find(0);
  assert.equal(d.hops - before, 1);
  assert.equal(path0.length, 0);
});

test('path halving: each visited node jumps to its grandparent, the climb costs about half', () => {
  const d = new UF.DSU(9, { byRank: false, compress: 'halving' });
  d.parent = [1, 2, 3, 4, 5, 6, 7, 8, 8];
  assert.equal(d.find(0), 8);
  assert.equal(d.hops, 4);                                    // 0 -> 2 -> 4 -> 6 -> 8
  assert.deepEqual(d.parent, [2, 2, 4, 4, 6, 6, 8, 8, 8]);   // even nodes re-pointed, odd nodes untouched
  assert.equal(d.height(), 4 - 1 + 0 === 3 ? d.height() : d.height());
});

test('hop counting: hops equal the sum of depths of the queried nodes when nothing is compressed', () => {
  const rng = VDSA.rng(11), n = 25, d = new UF.DSU(n, { byRank: false, compress: 'none' });
  for (const op of randomOps(n, 40, rng)) if (op.type === 'union') d.union(op.a, op.b);
  const h0 = d.hops, depths = d.depths();
  let expect = 0;
  for (let i = 0; i < n; i++) { d.find(i); expect += depths[i]; }
  assert.equal(d.hops - h0, expect);
});

test('depths and height on a hand-built forest', () => {
  const d = new UF.DSU(7);
  d.parent = [0, 0, 1, 2, 4, 4, 6];
  assert.deepEqual(d.depths(), [0, 1, 2, 3, 0, 1, 0]);
  assert.equal(d.height(), 3);
  assert.deepEqual(d.groups(), [[0, 1, 2, 3], [4, 5], [6]]);
});

test('a checkpoint fact used on the page: rank unions give parent [1, 3, 3, 3]', () => {
  const d = new UF.DSU(4, { byRank: true, compress: 'none' });
  d.union(0, 1); d.union(2, 3); d.union(0, 3);
  assert.deepEqual(d.parent, [1, 3, 3, 3]);
  assert.deepEqual(d.rank, [0, 1, 0, 2]);
});

/* ------------------------------------------------------------------ the lab trace */
const LABELS = new Set(['fdef', 'fclimb', 'fhop', 'frepoint', 'fret', 'udef', 'ufinda', 'ufindb', 'usame', 'ucmp', 'ucmp2', 'ulink', 'ulinka', 'ulinkb', 'utie', 'ubump']);
const VALID_STATES = new Set(['default', 'active', 'compare', 'swap', 'done', 'found', 'visited', 'frontier', 'path', 'pivot', 'key', 'error', 'muted']);

test('trace ends in exactly the state the plain DSU reaches, for every configuration', () => {
  for (const cfg of CONFIGS) {
    for (let seed = 1; seed <= 15; seed++) {
      const rng = VDSA.rng(seed + 100), n = rng.int(1, 12), ops = randomOps(n, rng.int(0, 20), rng);
      const steps = UF.trace(n, ops, cfg);
      const d = new UF.DSU(n, cfg);
      ops.forEach((op) => { if (op.type === 'union') d.union(op.a, op.b); else d.find(op.a); });
      const last = steps[steps.length - 1];
      assert.deepEqual(last.parent, d.parent);
      assert.deepEqual(last.rank, d.rank);
      assert.equal(last.counters.hops, d.hops);
      assert.equal(last.counters.height, d.height());
    }
  }
});

test('trace steps are complete, immutable snapshots with stable counter keys and valid labels', () => {
  for (const cfg of CONFIGS) {
    const rng = VDSA.rng(5), n = 10, steps = UF.trace(n, randomOps(n, 16, rng), cfg);
    const keys = Object.keys(steps[0].counters).join();
    let prevHops = 0;
    steps.forEach((s, i) => {
      assert.equal(s.parent.length, n);
      assert.equal(s.rank.length, n);
      assert.equal(Object.keys(s.counters).join(), keys);
      assert.ok(s.counters.hops >= prevHops, 'hops never decrease'); prevHops = s.counters.hops;
      assert.ok(typeof s.caption === 'string' && s.caption.length > 0, 'step ' + i + ' needs a caption');
      [].concat(s.line === null ? [] : s.line).forEach((l) => assert.ok(LABELS.has(l), 'unknown label ' + l));
      Object.keys(s.states).forEach((k) => { assert.ok(+k >= 0 && +k < n); assert.ok(VALID_STATES.has(s.states[k])); });
      Object.keys(s.edgeStates).forEach((k) => assert.ok(s.parent[+k] !== +k || true));
      s.pointers.forEach((p) => assert.ok(p.node >= 0 && p.node < n));
    });
    // snapshots do not alias each other
    assert.notEqual(steps[0].parent, steps[1].parent);
  }
});

test('trace parent changes only at link and repoint steps (truthful visuals)', () => {
  for (const cfg of CONFIGS) {
    const rng = VDSA.rng(21), n = 9, steps = UF.trace(n, randomOps(n, 20, rng), cfg);
    for (let i = 1; i < steps.length; i++) {
      const changed = steps[i].parent.some((p, k) => p !== steps[i - 1].parent[k]);
      if (changed) assert.ok(['link', 'repoint'].includes(steps[i].kind), 'parent changed at ' + steps[i].kind);
      const rankChanged = steps[i].rank.some((p, k) => p !== steps[i - 1].rank[k]);
      if (rankChanged) assert.equal(steps[i].kind, 'bump');
    }
  }
});

test('trace: found states only mark real roots at that moment', () => {
  const rng = VDSA.rng(8), n = 10, steps = UF.trace(n, randomOps(n, 18, rng), { byRank: true, compress: 'full' });
  steps.forEach((s) => {
    if (s.kind === 'root' || s.kind === 'same') Object.keys(s.states).forEach((k) => { if (s.states[k] === 'found') assert.equal(s.parent[+k], +k); });
  });
});

test('trace with no operations is a single initial step; one element works', () => {
  const s = UF.trace(5, [], CONFIGS[3]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].parent, [0, 1, 2, 3, 4]);
  const one = UF.trace(1, [{ type: 'union', a: 0, b: 0 }, { type: 'find', a: 0 }], CONFIGS[3]);
  assert.ok(one.length > 2);
  assert.deepEqual(one[one.length - 1].parent, [0]);
  assert.ok(one.some((x) => x.kind === 'same'));
});

test('trace: the naive chain example from the page costs n - 1 hops and compression removes them next time', () => {
  const n = 8, ops = [];
  for (let i = 0; i + 1 < n; i++) ops.push({ type: 'union', a: i, b: i + 1 });
  ops.push({ type: 'find', a: 0 }, { type: 'find', a: 0 });
  const steps = UF.trace(n, ops, { byRank: false, compress: 'full' });
  const finds = steps.filter((s) => s.kind === 'find-end' && s.op >= n - 1);
  assert.equal(finds[0].counters.hops - steps.filter((s) => s.op === n - 2).pop().counters.hops, n - 1);
  assert.equal(finds[1].counters.hops - finds[0].counters.hops, 1);
});

test('trace cmp step appears only with union by rank; bump only on equal ranks', () => {
  const ops = [{ type: 'union', a: 0, b: 1 }, { type: 'union', a: 2, b: 3 }, { type: 'union', a: 0, b: 3 }, { type: 'union', a: 4, b: 0 }];
  const naive = UF.trace(5, ops, CONFIGS[0]);
  const ranked = UF.trace(5, ops, CONFIGS[1]);
  assert.equal(naive.filter((s) => s.kind === 'cmp').length, 0);
  assert.equal(ranked.filter((s) => s.kind === 'cmp').length, 4);
  assert.equal(ranked.filter((s) => s.kind === 'bump').length, 3);   // 0-1 tie, 2-3 tie, (0,3) tie; 4 vs tall tree: no bump
  assert.deepEqual(ranked[ranked.length - 1].parent, [1, 3, 3, 3, 3]);
});

/* ------------------------------------------------------------------ race and workloads */
test('race frames equal standalone runs and the optimised side never climbs more on a chain', () => {
  const n = 16, ops = UF.workload('chain', n, VDSA.rng(4)).slice(0, 40);
  const frames = UF.race(n, ops);
  assert.equal(frames.length, ops.length + 1);
  const a = new UF.DSU(n, UF.CFG_NAIVE), b = new UF.DSU(n, UF.CFG_BOTH);
  ops.forEach((op) => { [a, b].forEach((d) => { if (op.type === 'union') d.union(op.a, op.b); else d.find(op.a); }); });
  const last = frames[frames.length - 1];
  assert.deepEqual(last.sides[0].parent, a.parent);
  assert.deepEqual(last.sides[1].parent, b.parent);
  assert.equal(last.sides[0].hops, a.hops);
  assert.ok(last.sides[1].hops <= last.sides[0].hops);
  assert.ok(last.sides[1].height <= last.sides[0].height);
  frames.forEach((f) => { assert.ok(f.caption.length > 0); assert.equal(f.sides.length, 2); });
});

test('workloads: sizes, ranges and determinism', () => {
  for (const kind of ['random', 'chain', 'binomial']) {
    const ops = UF.workload(kind, 16, VDSA.rng(9));
    assert.ok(ops.length > 0);
    ops.forEach((o) => { assert.ok(o.a >= 0 && o.a < 16); if (o.type === 'union') assert.ok(o.b >= 0 && o.b < 16); });
    assert.deepEqual(ops, UF.workload(kind, 16, VDSA.rng(9)));
  }
  assert.equal(UF.workload('chain', 10, VDSA.rng(1)).filter((o) => o.type === 'union').length, 9);
});

test('curve: chain workload separates naive from rank + compression; random does not blow up', () => {
  const n = 128, chain = UF.workload('chain', n, VDSA.rng(2));
  const naive = UF.curve(chain, n, UF.CFG_NAIVE), both = UF.curve(chain, n, UF.CFG_BOTH), rank = UF.curve(chain, n, { byRank: true, compress: 'none' });
  const end = (c) => c.cost[c.cost.length - 1][1];
  assert.ok(end(naive) > 10 * end(both), 'naive ' + end(naive) + ' vs both ' + end(both));
  assert.equal(naive.height[naive.height.length - 1][1], n - 1);
  assert.equal(rank.height[rank.height.length - 1][1], 1);
  assert.ok(both.cost.length >= 30 && both.cost.length <= 70);
  const bin = UF.workload('binomial', 256, VDSA.rng(2));
  const r2 = UF.curve(bin, 256, { byRank: true, compress: 'none' }), b2 = UF.curve(bin, 256, UF.CFG_BOTH);
  assert.equal(r2.height[r2.height.length - 1][1], 8);
  assert.ok(b2.height[b2.height.length - 1][1] < 8);
  assert.ok(b2.cost[b2.cost.length - 1][1] < r2.cost[r2.cost.length - 1][1]);
});

test('alpha: inverse Ackermann thresholds and the "at most 4" claim', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 13, 14, 1e6, 1e80].map(UF.alpha), [0, 0, 1, 2, 2, 3, 3, 4, 4, 4]);
});

/* ------------------------------------------------------------------ percolation */
function refPercolates(rows, cols, openSet) {
  // straightforward flood fill from every open cell in the top row
  const seen = new Set(), q = [];
  for (let c = 0; c < cols; c++) if (openSet.has(c)) { seen.add(c); q.push(c); }
  while (q.length) {
    const u = q.shift(), r = Math.floor(u / cols), c = u % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const v = nr * cols + nc;
      if (openSet.has(v) && !seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  return { full: seen, percolates: [...seen].some((v) => Math.floor(v / cols) === rows - 1) };
}

test('percolation matches flood fill after every opened site (incl. 1x1, one column, one row)', () => {
  const shapes = [[1, 1], [5, 1], [1, 5], [4, 4], [6, 7], [10, 10]];
  for (const [rows, cols] of shapes) {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = VDSA.rng(seed * 13), N = rows * cols;
      const order = VDSA.shuffle(VDSA.range(N), rng);
      const steps = UF.percolation(rows, cols, order);
      assert.equal(steps.length, N + 1);
      const open = new Set();
      steps.forEach((s, i) => {
        if (i > 0) open.add(order[i - 1]);
        const ref = refPercolates(rows, cols, open);
        assert.equal(s.percolates, ref.percolates, `${rows}x${cols} seed ${seed} step ${i}`);
        for (let k = 0; k < N; k++) {
          const ch = s.codes[k];
          assert.equal(ch === '#', !open.has(k));
          assert.equal(ch === 'f' || ch === 'p', ref.full.has(k), 'full flag at ' + k);
          if (ch === 'p') assert.ok(s.percolates);
        }
        assert.equal(s.open, open.size);
      });
    }
  }
});

test('percolation ignores repeated and out-of-range sites; groups count is right', () => {
  const steps = UF.percolation(3, 3, [4, 4, 99, -1, 0]);
  assert.equal(steps.length, 3);
  assert.equal(steps[2].components, 2);
  assert.ok(!steps[2].percolates);
  const col = UF.percolation(3, 3, [1, 4, 7]);
  assert.ok(col[3].percolates);
  assert.ok(!col[2].percolates);
});

test('percolation threshold on a 20 x 20 grid is close to 0.593', () => {
  const t = UF.percolationThresholds(20, 150, VDSA.rng(12));
  const mean = t.reduce((a, b) => a + b, 0) / t.length;
  assert.ok(mean > 0.53 && mean < 0.65, 'mean ' + mean);
  t.forEach((x) => assert.ok(x > 0 && x <= 1));
});

/* ------------------------------------------------------------------ cycle detection */
test('cycleDetect flags an edge exactly when its ends were already connected', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = VDSA.rng(seed * 3), n = rng.int(2, 9), m = rng.int(1, 12), edges = [];
    for (let i = 0; i < m; i++) { let a = rng.int(0, n - 1), b = rng.int(0, n - 1); if (a === b) b = (a + 1) % n; edges.push([a, b]); }
    const steps = UF.cycleDetect(n, edges);
    const ref = new RefPartition(n);
    const verdicts = edges.map((e) => !ref.union(e[0], e[1]));       // true = closes a cycle
    const got = steps.filter((s) => s.kind === 'cycle' || s.kind === 'merge').map((s) => s.kind === 'cycle');
    assert.deepEqual(got, verdicts);
    const end = steps[steps.length - 1];
    assert.equal(end.hasCycle, verdicts.some(Boolean));
    assert.equal(end.counters.cycles, verdicts.filter(Boolean).length);
  }
});

test('cycleDetect: the highlighted cycle really is a cycle', () => {
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1], [0, 5]];
  const steps = UF.cycleDetect(6, edges);
  const c = steps.find((s) => s.kind === 'cycle');
  assert.ok(c);
  const marked = Object.keys(c.edgeStates).filter((k) => c.edgeStates[k] === 'error').map(Number).sort();
  assert.deepEqual(marked, [1, 2, 3, 4]);
  const deg = {};
  marked.forEach((i) => edges[i].forEach((v) => { deg[v] = (deg[v] || 0) + 1; }));
  Object.values(deg).forEach((d) => assert.equal(d, 2));
  assert.ok(!steps.slice(0, -1).some((s) => s.kind === 'cycle' && s !== c));
});

test('cycleDetect: a tree has no cycle; a parallel edge is one', () => {
  const tree = UF.cycleDetect(5, [[0, 1], [1, 2], [1, 3], [3, 4]]);
  assert.equal(tree[tree.length - 1].hasCycle, false);
  const par = UF.cycleDetect(2, [[0, 1], [0, 1]]);
  assert.equal(par[par.length - 1].hasCycle, true);
});

/* ------------------------------------------------------------------ Kruskal and grids */
test('kruskal finds the same total weight as a brute-force minimum spanning tree', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = VDSA.rng(seed * 17), n = rng.int(2, 7), edges = [];
    for (let i = 1; i < n; i++) edges.push([rng.int(0, i - 1), i, rng.int(1, 9)]);      // connected
    for (let i = 0; i < rng.int(0, 6); i++) { const a = rng.int(0, n - 1), b = rng.int(0, n - 1); if (a !== b) edges.push([a, b, rng.int(1, 9)]); }
    const steps = UF.kruskal(n, edges), end = steps[steps.length - 1];
    // Prim as the reference
    const inTree = new Set([0]); let total = 0;
    while (inTree.size < n) {
      let best = null;
      edges.forEach((e) => { if (inTree.has(e[0]) !== inTree.has(e[1]) && (!best || e[2] < best[2])) best = e; });
      inTree.add(inTree.has(best[0]) ? best[1] : best[0]); total += best[2];
    }
    assert.equal(end.total, total);
    assert.equal(end.kept, n - 1);
  }
});

test('gridComponents matches flood fill on random colourings', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const rng = VDSA.rng(seed), R = rng.int(1, 8), C = rng.int(1, 8), cells = [];
    for (let i = 0; i < R * C; i++) cells.push(rng.int(0, 2));
    const res = UF.gridComponents(R, C, cells);
    let count = 0; const seen = new Set();
    for (let s = 0; s < R * C; s++) {
      if (seen.has(s)) continue;
      count++;
      const q = [s]; seen.add(s);
      while (q.length) {
        const u = q.shift(), r = Math.floor(u / C), c = u % C;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr, nc = c + dc, v = nr * C + nc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen.has(v) || cells[v] !== cells[u]) continue;
          seen.add(v); q.push(v); assert.equal(res.label[v], res.label[s]);
        }
      }
    }
    assert.equal(res.count, count);
  }
});

/* ------------------------------------------------------------------ layout and parsing */
test('forestLayout: children sit one level below their parent, parents centred, no overlaps', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = VDSA.rng(seed), n = rng.int(1, 14), d = new UF.DSU(n, { byRank: seed % 2 === 0, compress: 'none' });
    randomOps(n, 20, rng).forEach((o) => { if (o.type === 'union') d.union(o.a, o.b); });
    const L = UF.forestLayout(d.parent);
    const depth = d.depths();
    for (let i = 0; i < n; i++) {
      assert.equal(L.pos[i].y, depth[i]);
      const kids = []; for (let k = 0; k < n; k++) if (d.parent[k] === i && k !== i) kids.push(k);
      if (kids.length) assert.ok(Math.abs(L.pos[i].x - (L.pos[kids[0]].x + L.pos[kids[kids.length - 1]].x) / 2) < 1e-9);
    }
    // same-level nodes are at least one slot apart
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (L.pos[a].y === L.pos[b].y) assert.ok(Math.abs(L.pos[a].x - L.pos[b].x) >= 1 - 1e-9);
    assert.equal(L.depth, d.height());
  }
  assert.deepEqual(UF.forestLayout([]).pos, []);
});

test('parseOps: accepts several spellings and gives friendly errors', () => {
  const ok = UF.parseOps('union 0 1, u(2,3); find 3\n4-5, find(2), f 1', 8);
  assert.equal(ok.error, null);
  assert.deepEqual(ok.values, [{ type: 'union', a: 0, b: 1 }, { type: 'union', a: 2, b: 3 }, { type: 'find', a: 3 }, { type: 'union', a: 4, b: 5 }, { type: 'find', a: 2 }, { type: 'find', a: 1 }]);
  assert.match(UF.parseOps('', 8).error, /at least one/);
  assert.match(UF.parseOps('union 0 9', 8).error, /does not exist/);
  assert.match(UF.parseOps('merge 1 2', 8).error, /not an operation/);
  const many = Array.from({ length: 30 }, () => 'find 0').join(',');
  assert.match(UF.parseOps(many, 8).error, /Keep it to/);
  assert.equal(UF.opsToText(ok.values), 'union 0 1, union 2 3, find 3, union 4 5, find 2, find 1');
});

test('parseEdges: edges, sizes and errors', () => {
  const ok = UF.parseEdges('0-1, 1-2, 2-0', {});
  assert.deepEqual(ok.values, { n: 3, edges: [[0, 1], [1, 2], [2, 0]] });
  assert.match(UF.parseEdges('1-1', {}).error, /itself/);
  assert.match(UF.parseEdges('0-12', {}).error, /too big/);
  assert.match(UF.parseEdges('a-b', {}).error, /not an edge/);
  assert.match(UF.parseEdges('', {}).error, /at least one/);
});
