// Lesson 30 · Minimum spanning trees — step generator tests.
// Run: node --test tests/algos/30-minimum-spanning-trees.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const MST = require(path.join(root, 'js/algos/30-minimum-spanning-trees.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* the lesson graph (study figure 1): unique MST of weight 15 */
const LESSON = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edges: [['A', 'C', 1], ['D', 'F', 2], ['E', 'F', 3], ['C', 'D', 4], ['B', 'D', 5], ['A', 'B', 6], ['A', 'D', 7], ['B', 'F', 8], ['C', 'E', 9]]
    .map(([u, v, w]) => ({ u, v, w }))
};

/* ------------------------------------------------------------------ straightforward references */
function components(ids, edges) {         // label propagation: obviously correct, slow
  const label = {};
  ids.forEach((id) => { label[id] = id; });
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach((e) => {
      const a = label[e.u], b = label[e.v];
      if (a !== b) { const m = a < b ? a : b; label[e.u] = label[e.v] = m; changed = true; }
    });
  }
  return new Set(Object.values(label)).size;
}
/* brute force: the cheapest edge subset with the same number of components and no cycle (n - c edges) */
function bruteMstWeight(G) {
  const ids = G.nodes.map((n) => (typeof n === 'object' ? n.id : n));
  const E = G.edges, m = E.length;
  const c = components(ids, E);
  const need = ids.length - c;
  let best = Infinity;
  for (let mask = 0; mask < (1 << m); mask++) {
    let bits = 0, w = 0;
    for (let i = 0; i < m; i++) if (mask & (1 << i)) { bits++; w += E[i].w; }
    if (bits !== need || w >= best) continue;
    const sub = E.filter((_, i) => mask & (1 << i));
    if (components(ids, sub) === c) best = w;      // need edges + same components as the whole graph = spanning forest
  }
  return best === Infinity ? 0 : best;
}
function randomWeighted(n, m, rng, wmax) {
  const nodes = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const seen = new Set(), edges = [];
  let guard = 0;
  while (edges.length < m && guard++ < 500) {
    const a = rng.int(0, n - 1), b = rng.int(0, n - 1);
    if (a === b) continue;
    const k = Math.min(a, b) + '-' + Math.max(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({ u: nodes[a], v: nodes[b], w: rng.int(-3, wmax) });
  }
  return { nodes, edges };
}
function isForestOf(G, ids) {
  const ed = G.edges.filter((e) => ids.includes(MST.edgeKey(e.u, e.v)));
  const names = G.nodes.map((n) => (typeof n === 'object' ? n.id : n));
  return components(names, ed) === names.length - ed.length;   // no cycle: every edge merged two components
}

/* ------------------------------------------------------------------ plain algorithms */
test('lesson graph: Kruskal and Prim both find weight 15 with the same five edges', () => {
  const k = MST.kruskal(LESSON), p = MST.prim(LESSON, 'A');
  assert.equal(k.total, 15);
  assert.equal(p.total, 15);
  assert.deepEqual(k.tree.map((e) => e.id), ['A-C', 'D-F', 'E-F', 'C-D', 'B-D']);
  assert.deepEqual(p.tree.map((e) => e.id), ['A-C', 'C-D', 'D-F', 'E-F', 'B-D']);
});

test('random graphs (with ties, negative weights, disconnected parts): both algorithms match brute force', () => {
  const rng = VDSA.rng(30);
  for (let t = 0; t < 120; t++) {
    const n = rng.int(1, 6), m = rng.int(0, Math.min(9, n * (n - 1) / 2));
    const G = randomWeighted(n, m, rng, rng.pick([2, 5, 20]));
    const want = bruteMstWeight(G);
    const k = MST.kruskal(G);
    assert.equal(k.total, want, 'kruskal ' + JSON.stringify(G));
    assert.ok(isForestOf(G, k.tree.map((e) => e.id)));
    const ids = G.nodes;
    assert.equal(k.tree.length, n - components(ids, G.edges));
    // Prim spans the start vertex's component only: compare with Kruskal restricted to that component
    const p = MST.prim(G, 'A');
    const inComp = new Set(['A']);
    for (let pass = 0; pass < n; pass++) G.edges.forEach((e) => { if (inComp.has(e.u) || inComp.has(e.v)) { inComp.add(e.u); inComp.add(e.v); } });
    const sub = { nodes: [...inComp], edges: G.edges.filter((e) => inComp.has(e.u)) };
    assert.equal(p.total, bruteMstWeight(sub), 'prim ' + JSON.stringify(G));
    assert.equal(p.reached, inComp.size);
  }
});

test('edge cases: empty, single vertex, single edge, all-equal weights', () => {
  assert.deepEqual(MST.kruskal({ nodes: [], edges: [] }).tree, []);
  assert.equal(MST.kruskal({ nodes: ['A'], edges: [] }).components, 1);
  assert.equal(MST.prim({ nodes: ['A'], edges: [] }, 'A').total, 0);
  const one = { nodes: ['A', 'B'], edges: [{ u: 'A', v: 'B', w: 7 }] };
  assert.equal(MST.kruskal(one).total, 7);
  const tri = { nodes: ['A', 'B', 'C'], edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'B', v: 'C', w: 1 }, { u: 'A', v: 'C', w: 1 }] };
  assert.equal(MST.kruskal(tri).total, 2);
  assert.equal(MST.kruskal(tri).tree.length, 2);
  const split = { nodes: ['A', 'B', 'C', 'D'], edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'C', v: 'D', w: 2 }] };
  assert.equal(MST.kruskal(split).components, 2);
  assert.equal(MST.prim(split, 'A').reached, 2);
});

/* ------------------------------------------------------------------ Kruskal trace */
test('kruskalTrace: last step totals match the plain algorithm; decisions are truthful', () => {
  const rng = VDSA.rng(7);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(1, 8), m = rng.int(0, Math.min(14, n * (n - 1) / 2));
    const G = randomWeighted(n, m, rng, 9);
    const steps = MST.kruskalTrace(G);
    const ref = MST.kruskal(G);
    const last = steps[steps.length - 1];
    assert.equal(last.kind === 'done' || n === 0, true);
    assert.equal(last.total, ref.total);
    assert.deepEqual(new Set(last.accepted), new Set(ref.tree.map((e) => e.id)));
    // every accept joins two different groups, every reject stays inside one
    steps.forEach((s, i) => {
      assert.equal(typeof s.caption, 'string');
      assert.ok(s.line);
      assert.deepEqual(Object.keys(s.counters), ['examined', 'accepted', 'rejected', 'weight']);
      if (s.kind === 'check') assert.equal(s.same, s.comp[s.sorted[s.cursor].u] === s.comp[s.sorted[s.cursor].v]);
      if (s.kind === 'accept') {
        const e = s.sorted[s.cursor], before = steps[i - 1];
        assert.notEqual(before.comp[e.u], before.comp[e.v]);
        assert.equal(s.comp[e.u], s.comp[e.v]);
        assert.equal(s.groups.length, before.groups.length - 1);
      }
      if (s.kind === 'reject') { const e = s.sorted[s.cursor]; assert.equal(s.comp[e.u], s.comp[e.v]); assert.equal(s.groups.length, steps[i - 1].groups.length); }
    });
    // the cursor never moves backwards; sorted list is nondecreasing
    let prev = -1;
    steps.forEach((s) => { assert.ok(s.cursor >= prev); prev = s.cursor; });
    const ws = steps[0].sorted.map((e) => e.w);
    assert.deepEqual(ws, ws.slice().sort((a, b) => a - b));
    // groups always partition the vertices
    steps.forEach((s) => assert.equal(s.groups.reduce((a, g) => a + g.length, 0), n));
  }
});

test('kruskalTrace on the lesson graph stops after the fifth accepted edge', () => {
  const steps = MST.kruskalTrace(LESSON);
  const kinds = steps.map((s) => s.kind);
  assert.equal(kinds.filter((k) => k === 'accept').length, 5);
  assert.equal(kinds.filter((k) => k === 'reject').length, 0);   // the five lightest edges form the tree
  assert.match(steps[steps.length - 1].caption, /never reads them/);
  assert.equal(steps[steps.length - 1].total, 15);
});

test('kruskalTrace rejects the cycle-closing edge and names the path', () => {
  const G = { nodes: ['A', 'B', 'C'], edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'B', v: 'C', w: 2 }, { u: 'A', v: 'C', w: 3 }] };
  const steps = MST.kruskalTrace(G);
  const rej = steps.filter((s) => s.kind === 'reject');
  assert.equal(rej.length, 0, 'stops after V-1 edges, never reads A-C');
  const G2 = { nodes: ['A', 'B', 'C', 'D'], edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'B', v: 'C', w: 2 }, { u: 'A', v: 'C', w: 3 }, { u: 'C', v: 'D', w: 4 }] };
  const s2 = MST.kruskalTrace(G2);
  const r = s2.filter((s) => s.kind === 'reject');
  assert.equal(r.length, 1);
  assert.match(r[0].caption, /A–B–C|C–B–A/);
});

test('kruskalTrace on a disconnected graph ends as a forest', () => {
  const G = { nodes: ['A', 'B', 'C', 'D', 'E'], edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'C', v: 'D', w: 2 }] };
  const steps = MST.kruskalTrace(G);
  const last = steps[steps.length - 1];
  assert.equal(last.groups.length, 3);
  assert.match(last.caption, /forest/);
});

test('kruskalTrace ties go in input order', () => {
  const G = { nodes: ['A', 'B', 'C'], edges: [{ u: 'B', v: 'C', w: 1 }, { u: 'A', v: 'B', w: 1 }, { u: 'A', v: 'C', w: 1 }] };
  const steps = MST.kruskalTrace(G);
  assert.deepEqual(steps[steps.length - 1].accepted, ['B-C', 'A-B']);
});

/* ------------------------------------------------------------------ Prim trace */
test('primTrace: total, tree edges and queue bookkeeping match plain Prim', () => {
  const rng = VDSA.rng(11);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(1, 8), m = rng.int(0, Math.min(14, n * (n - 1) / 2));
    const G = randomWeighted(n, m, rng, 9);
    const steps = MST.primTrace(G, 'A');
    const ref = MST.prim(G, 'A');
    const last = steps[steps.length - 1];
    assert.equal(last.kind, 'done');
    assert.equal(last.total, ref.total);
    assert.deepEqual(last.treeEdges, ref.tree.map((e) => e.id));
    assert.equal(last.tree.length, ref.reached);
    steps.forEach((s, i) => {
      assert.deepEqual(Object.keys(s.counters), ['intree', 'pushes', 'pops', 'weight']);
      // queue is sorted by weight, lightest first
      for (let j = 1; j < s.pq.length; j++) assert.ok(s.pq[j - 1].w <= s.pq[j].w);
      // every queue entry starts inside the tree
      s.pq.forEach((q) => assert.ok(s.tree.includes(q.u)));
      if (s.kind === 'pop') {
        // the popped edge is no heavier than anything left in the queue
        s.pq.forEach((q) => assert.ok(s.popped.w <= q.w));
        assert.ok(s.tree.includes(s.popped.u));
      }
      if (s.kind === 'add') {
        assert.ok(!steps[i - 1].tree.includes(s.newNode));
        assert.equal(s.tree.length, steps[i - 1].tree.length + 1);
      }
      if (s.kind === 'skip') { assert.ok(s.tree.includes(steps[i - 1].popped.v)); assert.equal(s.tree.length, steps[i - 1].tree.length); }
    });
    // pushes - pops = queue length at the end
    assert.equal(last.counters.pushes - last.counters.pops, last.pq.length);
  }
});

test('primTrace on the lesson graph from A: vertices join C, D, F, E, B with total 15', () => {
  const steps = MST.primTrace(LESSON, 'A');
  const adds = steps.filter((s) => s.kind === 'add');
  assert.deepEqual(adds.map((s) => s.newNode), ['C', 'D', 'F', 'E', 'B']);
  assert.equal(steps[steps.length - 1].total, 15);
  // Prim stops when the tree is full: dead entries (A-B, A-D, ...) are left in the queue unpopped
  const last = steps[steps.length - 1];
  assert.ok(last.pq.length > 0 && last.pq.every((q) => q.dead));
});

test('primTrace: disconnected graph explains itself; start defaults to the first vertex', () => {
  const G = { nodes: ['A', 'B', 'C'], edges: [{ u: 'A', v: 'B', w: 4 }] };
  const last = MST.primTrace(G).pop();
  assert.match(last.caption, /not connected/);
  assert.equal(last.tree.length, 2);
  assert.equal(MST.primTrace({ nodes: ['X'], edges: [] }, 'nope')[0].tree[0], 'X');
  assert.deepEqual(MST.primTrace({ nodes: [], edges: [] }), []);
});

test('Kruskal and Prim agree on total weight even with ties, and on edges when weights are distinct', () => {
  const rng = VDSA.rng(99);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(2, 9);
    const G = MST.randomGraph(n, rng.int(n - 1, n * (n - 1) / 2), rng);
    const f = MST.orderFrames(G, 'V0');
    assert.equal(f.total, f.primTotal);
    const ws = G.edges.map((e) => e.w);
    if (new Set(ws).size === ws.length) assert.ok(f.sameEdges, 'unique MST');
    assert.equal(f.frames.length, n);
    assert.equal(f.frames[n - 1].kTotal, f.frames[n - 1].pTotal);
  }
});

/* ------------------------------------------------------------------ cut property */
test('cutInfo: the lightest crossing edge of every cut belongs to some MST (brute force, distinct weights)', () => {
  const rng = VDSA.rng(5);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(3, 6);
    const G = MST.randomGraph(n, rng.int(n - 1, n * (n - 1) / 2), rng);
    // make weights distinct
    G.edges.forEach((e, i) => { e.w = e.w * 100 + i; });
    const mst = new Set(MST.kruskal(G).tree.map((e) => e.id));
    const ids = G.nodes.map((x) => x.id);
    for (let mask = 1; mask < (1 << n) - 1; mask++) {
      const side = ids.filter((_, i) => mask & (1 << i));
      const c = MST.cutInfo(G, side);
      assert.ok(c.valid);
      if (c.crossing.length) {
        assert.ok(mst.has(c.lightest.id), 'safe edge ' + c.lightest.id);
        assert.equal(c.ties, 1);
        c.crossing.forEach((e) => assert.ok(e.w >= c.lightest.w));
        assert.equal(c.crossing.length, G.edges.filter((e) => side.includes(e.u) !== side.includes(e.v)).length);
      }
    }
  }
  assert.equal(MST.cutInfo(LESSON, []).valid, false);
  assert.equal(MST.cutInfo(LESSON, LESSON.nodes).valid, false);
});

test('cutInfo on the lesson graph: {A, C} vs the rest -> lightest crossing edge C-D (4)', () => {
  const c = MST.cutInfo(LESSON, ['A', 'C']);
  assert.equal(c.lightest.id, 'C-D');
  assert.deepEqual(c.crossing.map((e) => e.id).sort(), ['A-B', 'A-D', 'C-D', 'C-E']);
});

/* ------------------------------------------------------------------ cycle property */
test('cycleCut ends with exactly the MST weight and never disconnects anything', () => {
  const rng = VDSA.rng(21);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(2, 8);
    const G = MST.randomGraph(n, rng.int(n - 1, Math.min(14, n * (n - 1) / 2)), rng);
    const r = MST.cycleCut(G);
    assert.equal(r.total, MST.kruskal(G).total);
    assert.equal(r.kept.length, n - 1);
    r.steps.forEach((s) => {
      if (s.kind === 'cycle') {
        // the heaviest edge is the maximum of the cycle
        const ws = s.cycle.map((id) => G.edges.find((e) => MST.edgeKey(e.u, e.v) === id).w);
        const hw = G.edges.find((e) => MST.edgeKey(e.u, e.v) === s.heaviest).w;
        assert.equal(hw, Math.max(...ws));
      }
    });
    // connectivity is preserved after every drop
    r.steps.forEach((s) => {
      const alive = G.edges.filter((e) => s.alive.includes(MST.edgeKey(e.u, e.v)));
      assert.equal(components(G.nodes.map((x) => x.id), alive), 1);
    });
  }
  const tree = MST.cycleCut({ nodes: ['A', 'B'], edges: [{ u: 'A', v: 'B', w: 3 }] });
  assert.equal(tree.steps.length, 2);
});

/* ------------------------------------------------------------------ clustering */
test('clusterSplit: k clusters, and removing the k-1 heaviest MST edges equals stopping Kruskal early', () => {
  const rng = VDSA.rng(3);
  for (let t = 0; t < 40; t++) {
    const pts = Array.from({ length: rng.int(2, 10) }, (_, i) => ({ id: 'P' + i, x: rng.int(0, 900) + rng() * 0.37, y: rng.int(0, 500) + rng() * 0.91 }));
    const G = MST.pointsGraph(pts);
    for (let k = 1; k <= pts.length; k++) {
      const r = MST.clusterSplit(G, k);
      assert.equal(r.k, k);
      assert.equal(r.cut.length, k - 1);
      assert.equal(r.sizes.reduce((a, b) => a + b, 0), pts.length);
      // early-stopped Kruskal partition
      const uf = new MST.UF(pts.length);
      MST.kruskal(G).tree.slice(0, pts.length - k).forEach((e) => uf.union(+e.u.slice(1), +e.v.slice(1)));
      for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
        assert.equal(r.assign['P' + i] === r.assign['P' + j], uf.find(i) === uf.find(j));
      }
      // every cut edge is at least as heavy as every kept edge
      r.cut.forEach((c) => r.keep.forEach((e) => assert.ok(c.w >= e.w)));
    }
  }
});

/* ------------------------------------------------------------------ measure, parse, misc */
test('measure: counts are consistent and Prim-array is quadratic', () => {
  const a = MST.measure(20, 60, VDSA.rng(1)), b = MST.measure(40, 120, VDSA.rng(1));
  assert.equal(a.kept, 19);
  assert.equal(a.reached, 20);
  assert.ok(b.kruskal > a.kruskal);
  assert.ok(b.primArray > 3 * a.primArray);
  const dense = MST.measure(30, 30 * 29 / 2, VDSA.rng(2));
  assert.ok(dense.primArray < dense.primHeap, 'array Prim beats heap Prim on a complete graph');
  const sparse = MST.measure(60, 120, VDSA.rng(2));
  assert.ok(sparse.primHeap < sparse.primArray, 'heap Prim beats array Prim on a sparse graph');
});

test('randomGraph is connected, simple and within the requested size', () => {
  const rng = VDSA.rng(8);
  for (let t = 0; t < 30; t++) {
    const V = rng.int(1, 12), G = MST.randomGraph(V, rng.int(0, 70), rng);
    assert.equal(G.nodes.length, V);
    assert.equal(components(G.nodes.map((n) => n.id), G.edges), 1);
    const keys = G.edges.map((e) => MST.edgeKey(e.u, e.v));
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(G.edges.length <= V * (V - 1) / 2);
  }
});

test('parseEdges: good input, lone vertices, and friendly errors', () => {
  const ok = MST.parseEdges('a-b:4, B-C : 2; d\nA-C=7 ');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.values.nodes, ['A', 'B', 'C', 'D']);
  assert.deepEqual(ok.values.edges.map((e) => e.u + e.v + e.w), ['AB4', 'BC2', 'AC7']);
  assert.match(MST.parseEdges('').error, /at least one edge/i);
  assert.match(MST.parseEdges('A-B').error, /no weight/);
  assert.match(MST.parseEdges('A-A:3').error, /itself/);
  assert.match(MST.parseEdges('A-B:3, B-A:5').error, /twice/);
  assert.match(MST.parseEdges('A-B:2.5').error, /whole numbers/);
  assert.match(MST.parseEdges('A-B:500').error, /out of range/);
  assert.match(MST.parseEdges('hello world').error, /not an edge/);
  assert.match(MST.parseEdges('A').error, /at least one edge/);
  const many = Array.from({ length: 12 }, (_, i) => 'N' + i + '-N' + (i + 1) + ':1').join(',');
  assert.match(MST.parseEdges(many).error, /vertices/);
  assert.equal(MST.parseEdges('A-B:-4').values.edges[0].w, -4);
  assert.equal(MST.toText(ok.values), 'A-B:4, B-C:2, A-C:7, D');
});

test('pathInTree finds the unique tree path', () => {
  const t = MST.kruskal(LESSON).tree;
  assert.deepEqual(MST.pathInTree(t, 'A', 'B'), ['A-C', 'C-D', 'B-D']);
  assert.equal(MST.pathInTree(t, 'A', 'A').length, 0);
  assert.equal(MST.pathInTree([{ u: 'A', v: 'B' }], 'A', 'Z'), null);
});

/* ------------------------------------------------------------------ Borůvka and spanning-tree enumeration */
test('boruvka finds the MST weight (ties broken by edge order) in at most log2(n) rounds', () => {
  const rng = VDSA.rng(14);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(1, 9), m = rng.int(0, Math.min(14, n * (n - 1) / 2));
    const G = randomWeighted(n, m, rng, 6);
    const b = MST.boruvka(G), k = MST.kruskal(G);
    assert.equal(b.total, k.total);
    assert.equal(b.tree.length, k.tree.length);
    assert.ok(b.rounds.length <= Math.ceil(Math.log2(Math.max(2, n))));
    assert.ok(isForestOf(G, b.tree.map((e) => e.id)));
    b.rounds.forEach((r, i) => { if (i) assert.ok(r.groups.length < b.rounds[i - 1].groups.length); });
  }
});

test('spanningTrees: counts match Cayley (K4 = 16, K5 = 125), a cycle has n trees, and the cheapest weighs the MST', () => {
  const K = (n) => { const nodes = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)), edges = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ u: nodes[i], v: nodes[j], w: i + j + 1 }); return { nodes, edges }; };
  assert.equal(MST.spanningTrees(K(4)).count, 16);
  assert.equal(MST.spanningTrees(K(5)).count, 125);
  const C5 = { nodes: 'ABCDE'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'A']].map(([u, v], i) => ({ u, v, w: i + 1 })) };
  assert.equal(MST.spanningTrees(C5).count, 5);
  const r = MST.spanningTrees(LESSON);
  assert.equal(Math.min(...r.trees.map((x) => x.weight)), 15);
  assert.equal(r.trees.filter((x) => x.weight === 15).length, 1);
  assert.equal(MST.spanningTrees({ nodes: ['A', 'B', 'C'], edges: [{ u: 'A', v: 'B', w: 1 }] }).count, 0);
  assert.equal(MST.spanningTrees(K(6), 50).truncated, true);
});
