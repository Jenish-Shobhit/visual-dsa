// Lesson 29 · Bellman-Ford & Floyd-Warshall — step generator tests.
// Run: node --test tests/algos/29-bellman-ford-and-floyd-warshall.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const SP = require(path.join(root, 'js/algos/29-bellman-ford-and-floyd-warshall.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ fixtures */
const E = (list) => list.map(([from, to, w]) => ({ from, to, w }));
const CLRS = {
  nodes: ['S', 'T', 'X', 'Y', 'Z'], directed: true,
  edges: E([['T', 'X', 5], ['T', 'Y', 8], ['T', 'Z', -4], ['X', 'T', -2], ['Y', 'X', -3], ['Y', 'Z', 9], ['Z', 'X', 7], ['Z', 'S', 2], ['S', 'T', 6], ['S', 'Y', 7]])
};
const CYCLE = { nodes: ['S', 'A', 'B', 'C', 'D'], directed: true, edges: E([['S', 'A', 2], ['A', 'B', 3], ['B', 'C', -6], ['C', 'A', 2], ['C', 'D', 4]]) };
const UNREACHABLE_CYCLE = { nodes: ['S', 'A', 'B', 'C'], directed: true, edges: E([['S', 'A', 1], ['B', 'C', -3], ['C', 'B', 1]]) };
const CHAIN = { nodes: ['S', 'A', 'B', 'C', 'D'], directed: true, edges: E([['S', 'A', 4], ['A', 'B', -1], ['B', 'C', 2], ['C', 'D', 1]]) };
const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ straightforward references */
/* Textbook Bellman-Ford on the graph as given: returns dist (Infinity = unreachable) and whether a negative cycle is
   reachable from the source. */
function refBF(g, s) {
  const ids = SP.nodeIds(g), n = ids.length, edges = g.edges;
  const dist = {};
  ids.forEach((id) => { dist[id] = Infinity; });
  dist[s] = 0;
  for (let r = 0; r < n - 1; r++) edges.forEach((e) => { if (dist[e.from] + e.w < dist[e.to]) dist[e.to] = dist[e.from] + e.w; });
  let neg = false;
  edges.forEach((e) => { if (dist[e.from] + e.w < dist[e.to]) neg = true; });
  return { dist, neg };
}
/* Floyd-Warshall with a fresh 3D table D[k][i][j] (no in-place trick), Infinity for no route. */
function refFW(g) {
  const ids = SP.nodeIds(g), n = ids.length;
  const idx = {}; ids.forEach((id, i) => { idx[id] = i; });
  let d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  g.edges.forEach((e) => { d[idx[e.from]][idx[e.to]] = Math.min(d[idx[e.from]][idx[e.to]], e.w); });
  for (let k = 0; k < n; k++) {
    const nd = d.map((r) => r.slice());
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) nd[i][j] = Math.min(d[i][j], d[i][k] + d[k][j]);
    d = nd;
  }
  return d;
}
/* Brute force: the cheapest walk with at most k edges (enumerates walks; use on tiny graphs). */
function bruteWalks(g, s, k) {
  const best = {};
  SP.nodeIds(g).forEach((id) => { best[id] = Infinity; });
  (function go(u, cost, left) {
    if (cost < best[u]) best[u] = cost;
    if (!left) return;
    g.edges.forEach((e) => { if (e.from === u) go(e.to, cost + e.w, left - 1); });
  }(s, 0, k));
  return best;
}
function reach(g) {
  const ids = SP.nodeIds(g), R = {};
  ids.forEach((a) => { R[a] = new Set([a]); const st = [a]; while (st.length) { const u = st.pop(); g.edges.forEach((e) => { if (e.from === u && !R[a].has(e.to)) { R[a].add(e.to); st.push(e.to); } }); } });
  return R;
}
const val = (x) => (x === null ? Infinity : x);

/* ------------------------------------------------------------------ Bellman-Ford */
test('Bellman-Ford: the classic graph gives the textbook distances', () => {
  const r = SP.bfResult(CLRS, 'S');
  assert.deepEqual(r.dist, { S: 0, T: 2, X: 4, Y: 7, Z: -2 });
  assert.equal(r.hasCycle, false);
  assert.equal(r.rounds, 4);
});

test('Bellman-Ford: the trace ends with final distances and the same numbers as the reference', () => {
  const steps = SP.bellmanFord(CLRS, 'S');
  const st = last(steps);
  assert.equal(st.kind, 'done');
  assert.equal(st.final, true);
  const ref = refBF(CLRS, 'S');
  Object.keys(ref.dist).forEach((id) => assert.equal(val(st.dist[id]), ref.dist[id]));
});

test('Bellman-Ford: randomised comparison with the reference (no negative cycle)', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const rng = VDSA.rng(seed);
    const n = rng.int(1, 8), m = rng.int(0, Math.min(16, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const order = ['listed', 'reverse'][seed % 2];
    const r = SP.bfResult(g, 'A', { order });
    const ref = refBF(g, 'A');
    assert.equal(ref.neg, false, 'generator promises no negative cycle');
    assert.equal(r.hasCycle, false, 'seed ' + seed);
    Object.keys(ref.dist).forEach((id) => assert.equal(val(r.dist[id]), ref.dist[id], 'seed ' + seed + ' vertex ' + id));
    assert.ok(r.rounds <= Math.max(0, n - 1), 'never more than V - 1 rounds before the check');
  }
});

test('Bellman-Ford: negative cycles agree with the reference and the cycle is real', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const rng = VDSA.rng(1000 + seed);
    const n = rng.int(3, 8), m = rng.int(n - 1, Math.min(16, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negativeCycle: true });
    const ref = refBF(g, 'A');
    const r = SP.bfResult(g, 'A');
    assert.equal(r.hasCycle, ref.neg, 'seed ' + seed);
    if (r.hasCycle) {
      assert.ok(r.cycle.length >= 2, 'cycle has vertices');
      assert.ok(SP.cycleWeight(g.edges, r.cycle) < 0, 'seed ' + seed + ' cycle weight must be negative');
      const ids = new Set(r.cycle);
      assert.equal(ids.size, r.cycle.length, 'simple cycle');
    }
  }
});

test('Bellman-Ford: the negative-cycle preset lights the cycle in round V', () => {
  const steps = SP.bellmanFord(CYCLE, 'S');
  const st = last(steps);
  assert.equal(st.kind, 'cycle');
  assert.equal(st.verify, true);
  assert.equal(st.round, 5);
  assert.deepEqual(new Set(st.cycle), new Set(['A', 'B', 'C']));
  assert.equal(SP.cycleWeight(CYCLE.edges, st.cycle), -1);
  assert.equal(st.final, false);
  // rounds 1..4 each improved something
  assert.equal(steps.filter((s) => s.kind === 'roundEnd').length, 4);
});

test('Bellman-Ford: a negative cycle that S cannot reach is not reported', () => {
  const r = SP.bfResult(UNREACHABLE_CYCLE, 'S');
  assert.equal(r.hasCycle, false);
  assert.equal(r.dist.B, null);
  assert.equal(r.dist.C, null);
  assert.equal(r.dist.A, 1);
  assert.ok(SP.negativeCycle(UNREACHABLE_CYCLE), 'but the global search finds it');
});

test('Bellman-Ford: early exit when a whole round changes nothing, and edge order matters', () => {
  const lucky = SP.bfResult(CHAIN, 'S');
  assert.equal(lucky.early, true);
  assert.equal(lucky.rounds, 2, 'round 1 does everything, round 2 confirms');
  const unlucky = SP.bfResult({ nodes: CHAIN.nodes, edges: CHAIN.edges.slice().reverse() }, 'S');
  assert.equal(unlucky.rounds, 4, 'reversed order needs V - 1 rounds');
  assert.equal(unlucky.early, false);
  assert.deepEqual(unlucky.dist, lucky.dist);
  const viaOrder = SP.bfResult(CHAIN, 'S', { order: 'reverse' });
  assert.equal(viaOrder.rounds, 4);
});

test('Bellman-Ford: explicit edge order arrays are honoured, bad ones fall back', () => {
  const steps = SP.bellmanFord(CHAIN, 'S', { order: [3, 2, 1, 0] });
  assert.deepEqual(steps[0].order, [3, 2, 1, 0]);
  const bad = SP.bellmanFord(CHAIN, 'S', { order: [0, 0, 1, 2] });
  assert.deepEqual(bad[0].order, [0, 1, 2, 3]);
});

test('Bellman-Ford: the number of rounds and checks matches the counters', () => {
  const steps = SP.bellmanFord(CLRS, 'S');
  const st = last(steps);
  assert.equal(st.counters.checks, steps.filter((s) => s.kind === 'scan').length);
  assert.equal(st.counters.relaxed, steps.filter((s) => s.kind === 'relax').length);
  assert.equal(st.counters.checks, 5 * 10, 'V rounds (4 + the check) times E scans');
  const keys = Object.keys(steps[0].counters).join();
  steps.forEach((s) => assert.equal(Object.keys(s.counters).join(), keys));
});

test('Bellman-Ford: distances never increase and every step is a complete snapshot', () => {
  for (const g of [CLRS, CYCLE, CHAIN, UNREACHABLE_CYCLE]) {
    const steps = SP.bellmanFord(g, 'S');
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      assert.ok(s.caption && s.line && s.flow, 'caption, line and flow at step ' + i);
      assert.equal(Object.keys(s.dist).length, g.nodes.length);
      assert.equal(s.marks.length, g.edges.length);
      if (i) Object.keys(s.dist).forEach((id) => assert.ok(val(s.dist[id]) <= val(steps[i - 1].dist[id]), 'monotone'));
    }
    // a scan's verdict matches the arithmetic
    steps.forEach((s, i) => {
      if (s.kind !== 'scan') return;
      const e = g.edges[s.edge];
      const du = s.dist[e.from], dv = s.dist[e.to];
      const yes = du !== null && (dv === null || du + e.w < dv);
      assert.equal(s.result === 'yes', yes, 'scan verdict at step ' + i);
      assert.equal(s.result === 'skip', du === null);
    });
  }
});

test('Bellman-Ford: distances are only reported final when they are', () => {
  const steps = SP.bellmanFord(CLRS, 'S');
  steps.forEach((s) => { if (s.final) assert.ok(s.kind === 'done' || s.kind === 'early'); });
  const cyc = SP.bellmanFord(CYCLE, 'S');
  cyc.forEach((s) => assert.equal(s.final, false));
});

test('Bellman-Ford: parent pointers give real routes that cost exactly the distance', () => {
  const r = SP.bfResult(CLRS, 'S');
  const W = {};
  CLRS.edges.forEach((e) => { W[e.from + '>' + e.to] = e.w; });
  Object.keys(r.dist).forEach((id) => {
    let v = id, cost = 0, guard = 0;
    while (r.parent[v] !== null) { cost += W[r.parent[v] + '>' + v]; v = r.parent[v]; assert.ok(guard++ < 10); }
    assert.equal(v, 'S');
    assert.equal(cost, r.dist[id]);
  });
});

test('Bellman-Ford: edge cases (single vertex, no edges, unknown source, empty)', () => {
  const one = SP.bellmanFord({ nodes: ['A'], edges: [] }, 'A');
  assert.equal(last(one).kind, 'done');
  assert.deepEqual(last(one).dist, { A: 0 });
  const noEdges = SP.bfResult({ nodes: ['A', 'B', 'C'], edges: [] }, 'A');
  assert.equal(noEdges.early, true);
  assert.equal(noEdges.rounds, 1);
  assert.deepEqual(noEdges.dist, { A: 0, B: null, C: null });
  const unknown = SP.bfResult(CLRS, 'nope');
  assert.equal(unknown.dist.S, 0, 'falls back to the first vertex');
  assert.deepEqual(SP.bellmanFord({ nodes: [], edges: [] }, 'A'), []);
  const two = SP.bfResult({ nodes: ['A', 'B'], edges: E([['A', 'B', -3]]) }, 'B');
  assert.equal(two.dist.A, null, 'edge points away from the source');
});

test('Bellman-Ford: a two-vertex negative loop is a cycle; a zero-weight loop is not', () => {
  const neg = SP.bfResult({ nodes: ['A', 'B'], edges: E([['A', 'B', 1], ['B', 'A', -2]]) }, 'A');
  assert.equal(neg.hasCycle, true);
  assert.deepEqual(new Set(neg.cycle), new Set(['A', 'B']));
  const zero = SP.bfResult({ nodes: ['A', 'B'], edges: E([['A', 'B', 2], ['B', 'A', -2]]) }, 'A');
  assert.equal(zero.hasCycle, false);
  assert.deepEqual(zero.dist, { A: 0, B: 2 });
});

test('Bellman-Ford: an undirected negative edge is a negative cycle', () => {
  const g = { nodes: ['A', 'B'], edges: E([['A', 'B', -1], ['B', 'A', -1]]) };
  assert.equal(SP.bfResult(g, 'A').hasCycle, true);
});

/* ------------------------------------------------------------------ paths with at most k edges */
test('layers: d_k equals the cheapest walk with at most k edges', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = VDSA.rng(50 + seed);
    const n = rng.int(2, 6), m = rng.int(n - 1, Math.min(9, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const L = SP.layers(g, 'A');
    assert.equal(L.length, n);
    L.forEach((layer) => {
      const brute = bruteWalks(g, 'A', layer.k);
      Object.keys(brute).forEach((id) => assert.equal(val(layer.dist[id]), brute[id], 'seed ' + seed + ' k=' + layer.k + ' ' + id));
    });
  }
});

test('layers: the stored path really has at most k edges and costs d_k', () => {
  const W = {};
  CLRS.edges.forEach((e) => { W[e.from + '>' + e.to] = e.w; });
  SP.layers(CLRS, 'S').forEach((layer) => {
    Object.keys(layer.dist).forEach((id) => {
      const p = layer.paths[id];
      if (layer.dist[id] === null) { assert.equal(p, null); return; }
      assert.ok(p.length - 1 <= layer.k);
      let c = 0; for (let i = 0; i + 1 < p.length; i++) c += W[p[i] + '>' + p[i + 1]];
      assert.equal(c, layer.dist[id]);
    });
  });
});

test('layers: the classic graph settles after 4 rounds; a negative cycle keeps falling', () => {
  const L = SP.layers(CLRS, 'S', { rounds: 6 });
  assert.equal(L[4].stable, false);
  assert.equal(L[5].stable, true);
  assert.equal(L[6].stable, true);
  const C = SP.layers(CYCLE, 'S', { rounds: 12 });
  const a = C.map((l) => l.dist.A);
  assert.ok(a[12] < a[9] && a[9] < a[6], 'A keeps dropping by 1 every lap');
});

/* ------------------------------------------------------------------ Floyd-Warshall */
test('Floyd-Warshall: the classic graph gives the textbook matrix', () => {
  const r = SP.fwResult(CLRS);
  assert.deepEqual(r.d, [[0, 2, 4, 7, -2], [-2, 0, 2, 5, -4], [-4, -2, 0, 3, -6], [-7, -5, -3, 0, -9], [2, 4, 6, 9, 0]]);
  assert.equal(r.negCycle, false);
  assert.equal(r.checks, 125);
});

test('Floyd-Warshall: matches a fresh-table reference on random graphs, in both modes', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rng = VDSA.rng(300 + seed);
    const n = rng.int(1, 6), m = rng.int(0, Math.min(14, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const ref = refFW(g);
    ['improve', 'all'].forEach((mode) => {
      const st = last(SP.floydWarshall(g, { mode }));
      assert.equal(st.kind, 'done');
      assert.equal(st.negCycle, false);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) assert.equal(val(st.d[i][j]), ref[i][j], mode + ' seed ' + seed + ' cell ' + i + ',' + j);
    });
  }
});

test('Floyd-Warshall: agrees with Bellman-Ford row by row', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(500 + seed);
    const n = rng.int(2, 6), m = rng.int(n - 1, Math.min(14, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const fw = SP.fwResult(g);
    g.nodes.forEach((s, i) => {
      const bf = refBF(g, s).dist;
      g.nodes.forEach((t, j) => assert.equal(val(fw.d[i][j]), bf[t]));
    });
  }
});

test('Floyd-Warshall: negative cycles show up as a negative diagonal, and only then', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const rng = VDSA.rng(700 + seed);
    const n = rng.int(3, 6), m = rng.int(n - 1, Math.min(12, n * (n - 1)));
    const cyc = seed % 2 === 0;
    const g = SP.randomGraph(n, m, rng, { negativeCycle: cyc });
    const anyNeg = !!SP.negativeCycle(g);
    const st = last(SP.floydWarshall(g));
    assert.equal(st.negCycle, anyNeg, 'seed ' + seed);
    assert.equal(st.neg.length > 0, anyNeg);
    for (let i = 0; i < n; i++) if (!anyNeg) assert.equal(st.d[i][i], 0);
  }
  const st = last(SP.floydWarshall(CYCLE));
  assert.equal(st.negCycle, true);
  ['A', 'B', 'C'].forEach((id) => assert.ok(st.neg.indexOf(CYCLE.nodes.indexOf(id)) >= 0));
  assert.equal(st.neg.indexOf(CYCLE.nodes.indexOf('D')), -1, 'D is downstream of the cycle, not on it');
});

test('Floyd-Warshall: the next-hop matrix rebuilds routes that cost exactly d[i][j]', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(900 + seed);
    const n = rng.int(2, 6), m = rng.int(n - 1, Math.min(14, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const W = {};
    g.edges.forEach((e) => { W[e.from + '>' + e.to] = e.w; });
    const r = SP.fwResult(g);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = SP.pathFromNext(r.next, i, j);
      if (r.d[i][j] === null) { assert.equal(p, null); continue; }
      assert.ok(p, 'route exists ' + i + '->' + j);
      assert.equal(p[0], i); assert.equal(last(p), j);
      let c = 0;
      for (let a = 0; a + 1 < p.length; a++) c += W[g.nodes[p[a]] + '>' + g.nodes[p[a + 1]]];
      assert.equal(c, r.d[i][j]);
      assert.equal(new Set(p).size, p.length, 'a shortest route repeats no vertex');
    }
  }
});

test('Floyd-Warshall: update steps show the two cells that combined and the route through k', () => {
  const steps = SP.floydWarshall(CLRS);
  const ups = steps.filter((s) => s.kind === 'update');
  assert.equal(ups.length, last(steps).counters.updates);
  ups.forEach((s) => {
    const { a, b } = s.via;
    assert.deepEqual(a, [s.i, s.k]);
    assert.deepEqual(b, [s.k, s.j]);
    assert.equal(s.d[s.i][s.j], s.cand);
    assert.equal(s.cand, s.d[a[0]][a[1]] + s.d[b[0]][b[1]]);
    assert.ok(s.path && s.path.indexOf(s.k) >= 0, 'k is on the route');
    assert.equal(s.path[0], s.i);
    assert.equal(last(s.path), s.j);
  });
});

test('Floyd-Warshall: pass k only reads row k and column k (they do not change without a negative cycle)', () => {
  const steps = SP.floydWarshall(CLRS);
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.kind !== 'update') continue;
    assert.notEqual(s.i, s.k);
    assert.notEqual(s.j, s.k);
  }
});

test('Floyd-Warshall: the first pass of the classic graph updates the cells the lesson quotes', () => {
  const steps = SP.floydWarshall(CLRS);
  const first = steps.filter((s) => s.kind === 'update' && s.k === 0).map((s) => CLRS.nodes[s.i] + CLRS.nodes[s.j]);
  assert.deepEqual(first, ['ZT', 'ZY']);
  const second = steps.filter((s) => s.kind === 'update' && s.k === 1).map((s) => CLRS.nodes[s.i] + CLRS.nodes[s.j]);
  assert.deepEqual(second, ['SX', 'SZ', 'XY', 'XZ', 'ZX', 'ZZ'].filter((c) => second.indexOf(c) >= 0));
  assert.ok(second.length >= 4);
});

test('Floyd-Warshall: counters, modes and snapshot shape', () => {
  const imp = SP.floydWarshall(CLRS, { mode: 'improve' });
  const all = SP.floydWarshall(CLRS, { mode: 'all' });
  assert.ok(all.length > imp.length * 3);
  assert.equal(all.filter((s) => s.kind === 'check').length, 125);
  assert.equal(last(imp).counters.checks, last(all).counters.checks);
  assert.equal(last(imp).counters.updates, last(all).counters.updates);
  const n = 5;
  [imp, all].forEach((steps) => {
    const keys = Object.keys(steps[0].counters).join();
    steps.forEach((s, i) => {
      assert.equal(Object.keys(s.counters).join(), keys);
      assert.equal(s.d.length, n); assert.equal(s.d[0].length, n);
      assert.ok(s.caption && s.line && s.flow, 'caption/line/flow at ' + i);
      if (i) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) assert.ok(val(s.d[a][b]) <= val(steps[i - 1].d[a][b]), 'monotone');
    });
    // passes: k goes 0..n-1 in order, every pass ends with kend
    assert.equal(steps.filter((s) => s.kind === 'kstart').length, n);
    assert.equal(steps.filter((s) => s.kind === 'kend').length, n);
  });
  // checks at the end of pass k are exactly (k + 1) * n^2
  imp.filter((s) => s.kind === 'kend').forEach((s) => assert.equal(s.counters.checks, (s.k + 1) * 25));
});

test('Floyd-Warshall: invariant after pass k, the entry is the best route through stopovers {0..k}', () => {
  const ids = CLRS.nodes;
  const steps = SP.floydWarshall(CLRS);
  const idx = {}; ids.forEach((id, i) => { idx[id] = i; });
  steps.filter((s) => s.kind === 'kend').forEach((s) => {
    // brute force: routes whose interior vertices all have index <= s.k
    const n = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let best = i === j ? 0 : Infinity;
      (function go(u, cost, seen) {
        if (u === j && seen.length > 1 && cost < best) best = cost;
        if (seen.length > n + 1) return;
        CLRS.edges.forEach((e) => {
          if (idx[e.from] !== u) return;
          const v = idx[e.to];
          if (v === j) { if (cost + e.w < best) best = cost + e.w; return; }
          if (v <= s.k && seen.indexOf(v) < 0) go(v, cost + e.w, seen.concat(v));
        });
      }(i, 0, [i]));
      assert.equal(val(s.d[i][j]), best, 'pass ' + s.k + ' cell ' + i + ',' + j);
    }
  });
});

test('Floyd-Warshall: edge cases (single vertex, no edges, empty, disconnected)', () => {
  const one = SP.floydWarshall({ nodes: ['A'], edges: [] });
  assert.equal(last(one).kind, 'done');
  assert.deepEqual(last(one).d, [[0]]);
  const none = SP.fwResult({ nodes: ['A', 'B'], edges: [] });
  assert.deepEqual(none.d, [[0, null], [null, 0]]);
  assert.deepEqual(SP.floydWarshall({ nodes: [], edges: [] }), []);
  const dis = SP.fwResult({ nodes: ['A', 'B', 'C', 'D'], edges: E([['A', 'B', 1], ['C', 'D', 2]]) });
  assert.equal(dis.d[0][2], null);
  assert.equal(dis.d[0][1], 1);
  assert.equal(dis.updates, 0, 'nothing to combine');
});

test('Floyd-Warshall: a negative self-loop is a negative diagonal', () => {
  const st = last(SP.floydWarshall({ nodes: ['A', 'B'], edges: E([['A', 'A', -1], ['A', 'B', 2]]) }));
  assert.equal(st.negCycle, true);
  assert.ok(st.d[0][0] < 0);
});

/* ------------------------------------------------------------------ transitive closure */
test('Warshall closure: equals reachability from a search, on random graphs', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const rng = VDSA.rng(1200 + seed);
    const n = rng.int(1, 7), m = rng.int(0, Math.min(14, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: false });
    const st = last(SP.warshallClosure(g));
    const R = reach(g);
    g.nodes.forEach((a, i) => g.nodes.forEach((b, j) => assert.equal(st.d[i][j] === 1, R[a].has(b), 'seed ' + seed + ' ' + a + b)));
  }
});

test('Warshall closure: counters and shape', () => {
  const steps = SP.warshallClosure(CLRS);
  const st = last(steps);
  assert.equal(st.counters.checks, 125);
  assert.equal(steps.filter((s) => s.kind === 'update').length, st.counters.newPairs);
  steps.forEach((s) => { assert.ok(s.caption && s.line); assert.equal(s.d.length, 5); });
});

/* ------------------------------------------------------------------ Johnson, negative cycles, arbitrage */
test('Johnson: reweighted edges are non-negative and shift every path by the same amount', () => {
  const j = SP.johnson(CLRS);
  assert.ok(j);
  j.edges.forEach((e) => assert.ok(e.w2 >= 0, e.from + '>' + e.to));
  // path S -> T -> X : reweighted cost = original + h[S] - h[X]
  const W = {}, W2 = {};
  j.edges.forEach((e) => { W[e.from + '>' + e.to] = e.w; W2[e.from + '>' + e.to] = e.w2; });
  const c = W['S>T'] + W['T>X'], c2 = W2['S>T'] + W2['T>X'];
  assert.equal(c2, c + j.h.S - j.h.X);
  assert.equal(SP.johnson(CYCLE), null, 'a negative cycle has no potentials');
});

test('Johnson: reweighting keeps shortest routes (compare all-pairs distances)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = VDSA.rng(1500 + seed);
    const n = rng.int(2, 6), m = rng.int(n - 1, Math.min(12, n * (n - 1)));
    const g = SP.randomGraph(n, m, rng, { negative: true });
    const j = SP.johnson(g);
    const g2 = { nodes: g.nodes, edges: j.edges.map((e) => ({ from: e.from, to: e.to, w: e.w2 })) };
    const a = SP.fwResult(g), b = SP.fwResult(g2);
    g.nodes.forEach((s, i) => g.nodes.forEach((t, k) => {
      if (a.d[i][k] === null) return assert.equal(b.d[i][k], null);
      assert.equal(b.d[i][k], a.d[i][k] + j.h[s] - j.h[t]);
    }));
  }
});

test('negativeCycle: finds a real negative cycle or nothing, anywhere in the graph', () => {
  assert.equal(SP.negativeCycle(CLRS), null);
  assert.equal(SP.negativeCycle(CHAIN), null);
  const c = SP.negativeCycle(CYCLE);
  assert.ok(SP.cycleWeight(CYCLE.edges, c) < 0);
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(1700 + seed);
    const g = SP.randomGraph(rng.int(3, 8), 12, rng, { negativeCycle: seed % 2 === 0 });
    const cyc = SP.negativeCycle(g);
    if (seed % 2 === 0) { assert.ok(cyc); assert.ok(SP.cycleWeight(g.edges, cyc) < 0); } else assert.equal(cyc, null);
  }
});

test('arbitrage: a product of rates above 1 is exactly a negative cycle of -ln weights', () => {
  const cur = ['USD', 'EUR', 'GBP'];
  const rates = SP.arbitrageRates({ 'USD>EUR': 0.92, 'EUR>GBP': 0.86, 'GBP>USD': 1.28 });
  const g = SP.arbitrageGraph(cur, rates);
  const cyc = SP.negativeCycle(g);
  assert.ok(cyc, 'profit loop found');
  assert.ok(SP.cycleWeight(g.edges, cyc) < 0);
  assert.deepEqual(new Set(cyc), new Set(cur));
  const best = SP.bestCycle(cur, rates);
  assert.ok(best.product > 1);
  assert.ok(Math.abs(best.product - 0.92 * 0.86 * 1.28) < 1e-9);
  // the loop's -ln weights add up to -ln(product)
  assert.ok(Math.abs(SP.cycleWeight(g.edges, cyc) + Math.log(best.product)) < 1e-9);
  const fair = SP.arbitrageRates({ 'USD>EUR': 0.92, 'EUR>GBP': 0.86, 'GBP>USD': 1.25 });
  assert.equal(SP.negativeCycle(SP.arbitrageGraph(cur, fair)), null);
  assert.ok(SP.bestCycle(cur, fair).product < 1);
});

test('arbitrage: the two views agree on random rate tables', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(1900 + seed);
    const cur = ['A', 'B', 'C', 'D'].slice(0, rng.int(3, 4));
    const rates = {};
    cur.forEach((a) => cur.forEach((b) => { if (a !== b) rates[a + '>' + b] = 0.5 + rng() * 1.2; }));
    const has = !!SP.negativeCycle(SP.arbitrageGraph(cur, rates));
    const best = SP.bestCycle(cur, rates);
    assert.equal(has, best.product > 1 + 1e-12, 'seed ' + seed);
  }
});

/* ------------------------------------------------------------------ operation model */
test('opModel: Floyd-Warshall is V^3; Bellman-Ford from every vertex is V * (V-1) * E', () => {
  const s = SP.opModel(100, 'sparse');
  assert.equal(s.E, 300);
  assert.equal(s.fw, 1e6);
  assert.equal(s.bellman, 100 * 99 * 300);
  assert.ok(s.dijkstra < s.fw, 'many Dijkstras beat V^3 on sparse graphs');
  const d = SP.opModel(100, 'dense');
  assert.equal(d.E, 4950);
  assert.ok(d.bellman > d.fw);
  assert.ok(d.fw < d.dijkstra, 'on dense graphs V^3 wins');
});

/* ------------------------------------------------------------------ input parsing */
test('parseGraph: edges, negative weights, lone vertices and friendly errors', () => {
  const ok = SP.parseGraph('S>T:6, T>X:-5, Z; Q->R:2\nA→B:−3');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.values.nodes, ['S', 'T', 'X', 'Z', 'Q', 'R', 'A', 'B']);
  assert.deepEqual(ok.values.edges.map((e) => e.w), [6, -5, 2, -3]);
  assert.equal(SP.parseGraph('A>B').values.edges[0].w, 1, 'weight defaults to 1');
  assert.match(SP.parseGraph('').error, /at least one/i);
  assert.match(SP.parseGraph('A>A:1').error, /self-loop/i);
  assert.match(SP.parseGraph('A>B:2, A>B:3').error, /twice/i);
  assert.match(SP.parseGraph('A>B:500').error, /between/i);
  assert.match(SP.parseGraph('hello world').error, /could not read/i);
  assert.match(SP.parseGraph('A>B:1.5').error, /could not read/i);
  const many = 'A>B:1, B>C:1, C>D:1, D>E:1, E>F:1, F>G:1, G>H:1, H>I:1';
  assert.match(SP.parseGraph(many).error, /9 vertices/);
  assert.equal(SP.parseGraph(many, { maxNodes: 9 }).error, null);
  const edges = Array.from({ length: 17 }, (_, i) => 'A>' + 'BCDEFGHI'[i % 8] + (i >= 8 ? 'X' : '')).join(', ');
  assert.ok(SP.parseGraph(edges).error);
});

test('randomGraph: reproducible, reachable from A, negative edges but no negative cycle', () => {
  const a = SP.randomGraph(6, 10, VDSA.rng(3), {}), b = SP.randomGraph(6, 10, VDSA.rng(3), {});
  assert.deepEqual(a, b);
  let sawNegative = false;
  for (let seed = 1; seed <= 80; seed++) {
    const g = SP.randomGraph(6, 10, VDSA.rng(seed), {});
    assert.equal(SP.negativeCycle(g), null);
    assert.ok(Object.values(SP.bfResult(g, 'A').dist).every((d) => d !== null), 'everything reachable');
    if (g.edges.some((e) => e.w < 0)) sawNegative = true;
  }
  assert.ok(sawNegative, 'some graphs have negative edges');
  const plain = SP.randomGraph(6, 10, VDSA.rng(4), { negative: false });
  assert.ok(plain.edges.every((e) => e.w > 0));
});
