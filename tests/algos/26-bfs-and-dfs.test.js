// Lesson 26 · BFS & DFS — step generator tests.
// Run: node --test tests/algos/26-bfs-and-dfs.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const GS = require(path.join(root, 'js/algos/26-bfs-and-dfs.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ fixtures */
const MAIN = {
  nodes: 'ABCDEFGHI'.split(''),
  edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'], ['D', 'G'], ['E', 'G'], ['E', 'H'], ['F', 'H'], ['G', 'I'], ['H', 'I']]
};
const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ straightforward references */
function refAdj(graph) {
  const adj = {};
  const ids = [];
  const add = (id) => { id = String(id); if (!(id in adj)) { adj[id] = new Set(); ids.push(id); } };
  (graph.nodes || []).forEach((n) => add(typeof n === 'object' ? n.id : n));
  (graph.edges || []).forEach((e) => {
    const [a, b] = Array.isArray(e) ? e : [e.from, e.to];
    add(a); add(b);
    if (String(a) === String(b)) return;
    adj[a].add(String(b));
    if (!graph.directed) adj[b].add(String(a));
  });
  const out = {};
  ids.forEach((id) => { out[id] = [...adj[id]].sort(GS.natCmp); });
  return { ids, adj: out };
}
function refBfs(graph, s) {
  const { adj } = refAdj(graph);
  const dist = { [s]: 0 }, parent = { [s]: null }, order = [];
  const q = [s];
  while (q.length) {
    const u = q.shift();
    order.push(u);
    for (const v of adj[u]) if (!(v in dist)) { dist[v] = dist[u] + 1; parent[v] = u; q.push(v); }
  }
  return { dist, parent, order };
}
function refDfs(graph, s) {
  const { adj } = refAdj(graph);
  const disc = {}, fin = {}, parent = {}, order = [];
  let time = 0;
  (function visit(u, p) {
    disc[u] = ++time; parent[u] = p; order.push(u);
    for (const v of adj[u]) if (!(v in disc)) visit(v, u);
    fin[u] = ++time;
  })(s, null);
  return { disc, fin, parent, order };
}
function refHasCycleDirected(graph) {         // Kahn: leftovers mean a cycle
  const { ids, adj } = refAdj(graph);
  const indeg = {}; ids.forEach((id) => { indeg[id] = 0; });
  ids.forEach((u) => adj[u].forEach((v) => { indeg[v]++; }));
  const q = ids.filter((id) => !indeg[id]);
  let seen = 0;
  while (q.length) { const u = q.shift(); seen++; adj[u].forEach((v) => { if (!--indeg[v]) q.push(v); }); }
  return seen < ids.length;
}
function refHasCycleUndirected(graph) {       // union-find: an edge inside one set closes a cycle
  const { ids } = refAdj(graph);
  const p = {}; ids.forEach((id) => { p[id] = id; });
  const find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
  const seen = new Set();
  for (const e of graph.edges) {
    const [a, b] = e.map(String);
    if (a === b) continue;
    const k = a < b ? a + '-' + b : b + '-' + a;
    if (seen.has(k)) continue;
    seen.add(k);
    const ra = find(a), rb = find(b);
    if (ra === rb) return true;
    p[ra] = rb;
  }
  return false;
}
function refComponents(graph) {
  const { ids, adj } = refAdj(Object.assign({}, graph, { directed: false }));
  const comp = {}; let count = 0;
  for (const s of ids.slice().sort(GS.natCmp)) {
    if (s in comp) continue;
    count++;
    const st = [s]; comp[s] = count;
    while (st.length) { const u = st.pop(); adj[u].forEach((v) => { if (!(v in comp)) { comp[v] = count; st.push(v); } }); }
  }
  return { comp, count };
}
function refBipartite(graph) {
  const { ids, adj } = refAdj(Object.assign({}, graph, { directed: false }));
  const side = {};
  for (const s of ids) {
    if (s in side) continue;
    side[s] = 0;
    const q = [s];
    while (q.length) {
      const u = q.shift();
      for (const v of adj[u]) {
        if (!(v in side)) { side[v] = 1 - side[u]; q.push(v); } else if (side[v] === side[u]) return false;
      }
    }
  }
  return true;
}
function refGridBfs(grid, start) {
  const M = GS.gridModel(grid), R = M.R, C = M.C;
  const dist = new Array(R * C).fill(-1);
  const s = start[0] * C + start[1];
  if (M.wall[s]) return dist;
  dist[s] = 0;
  const q = [s];
  while (q.length) {
    const u = q.shift(), r = Math.floor(u / C), c = u % C;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
      const v = nr * C + nc;
      if (M.wall[v] || dist[v] !== -1) continue;
      dist[v] = dist[u] + 1; q.push(v);
    }
  }
  return dist;
}
function randomGrid(rng, R, C, density) {
  const walls = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (rng() < density) walls.push(r + ',' + c);
  return { rows: R, cols: C, walls };
}
function checkStepShape(steps, keys) {
  assert.ok(steps.length >= 1);
  const ck = Object.keys(steps[0].counters).join(',');
  steps.forEach((s, i) => {
    assert.equal(typeof s.caption, 'string', 'step ' + i + ' has a caption');
    assert.ok(s.caption.length > 0, 'step ' + i + ' caption is not empty');
    assert.equal(Object.keys(s.counters).join(','), ck, 'counter keys are identical on every step');
    (keys || []).forEach((k) => assert.ok(k in s, 'step ' + i + ' has ' + k));
  });
}
const graphsFor = (seed, count, opts) => {
  const rng = VDSA.rng(seed), out = [];
  for (let i = 0; i < count; i++) {
    const n = rng.int(1, 12), maxM = opts && opts.directed ? n * (n - 1) : n * (n - 1) / 2;
    const m = rng.int(0, Math.min(maxM, 22));
    out.push(GS.randomGraph(n, m, rng, Object.assign({ letters: true }, opts)));
  }
  return out;
};

/* ------------------------------------------------------------------ helpers */
test('natCmp orders names naturally', () => {
  assert.deepEqual(['B', 'A10', 'A2', 'C', '10', '9'].sort(GS.natCmp), ['9', '10', 'A2', 'A10', 'B', 'C']);
});

test('adjacency sorts neighbours, drops self-loops and repeated edges', () => {
  const G = GS.adjacency({ nodes: ['C', 'A', 'B'], edges: [['A', 'C'], ['A', 'B'], ['B', 'A'], ['C', 'C']] });
  assert.deepEqual(G.ids, ['C', 'A', 'B']);
  assert.deepEqual(G.adj, { C: ['A'], A: ['B', 'C'], B: ['A'] });
  assert.equal(G.edges.length, 2);
  const D = GS.adjacency({ edges: [['A', 'B'], ['B', 'A']], directed: true });
  assert.deepEqual(D.adj, { A: ['B'], B: ['A'] });
  assert.equal(D.edges.length, 2, 'directed edges in both directions are different edges');
});

/* ------------------------------------------------------------------ BFS */
test('BFS on the lesson graph: layers, parents and the shortest path to I', () => {
  const steps = GS.bfs(MAIN, 'A', { target: 'I' });
  checkStepShape(steps, ['states', 'dist', 'parent', 'queue', 'edges']);
  const end = last(steps);
  assert.deepEqual(end.path, ['A', 'B', 'D', 'G', 'I']);
  assert.equal(end.dist.I, 4);
  assert.equal(end.states.I, 'found');
  const full = last(GS.bfs(MAIN, 'A'));
  assert.deepEqual(full.order, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  assert.deepEqual(full.dist, { A: 0, B: 1, C: 1, D: 2, E: 2, F: 2, G: 3, H: 3, I: 4 });
});

test('BFS matches the reference on random graphs, and its queue stays in distance order', () => {
  for (const g of graphsFor(26, 250)) {
    const start = g.nodes[0];
    const steps = GS.bfs(g, start);
    checkStepShape(steps, ['states', 'dist', 'parent', 'queue']);
    const ref = refBfs(g, start);
    const end = last(steps);
    assert.deepEqual(end.order, ref.order);
    g.nodes.forEach((id) => {
      assert.equal(end.dist[id], id in ref.dist ? ref.dist[id] : null, 'dist of ' + id);
      assert.equal(end.parent[id], id in ref.parent ? ref.parent[id] : null, 'parent of ' + id);
    });
    const seenInQueue = {};
    steps.forEach((s) => {
      const ds = s.queue.map((q) => s.dist[q.v]);
      for (let i = 1; i < ds.length; i++) assert.ok(ds[i] >= ds[i - 1], 'queue sorted by distance');
      if (ds.length) assert.ok(ds[ds.length - 1] - ds[0] <= 1, 'at most two adjacent layers in the queue');
      s.queue.forEach((q) => { seenInQueue[q.t] = q.v; });
      // truthful colours: frontier = in the queue, visited/active = dequeued, default = never discovered
      g.nodes.forEach((id) => {
        const inQ = s.queue.some((q) => q.v === id);
        if (s.states[id] === 'frontier') assert.ok(inQ, id + ' shown as frontier must be queued');
        if (s.states[id] === 'default') assert.equal(s.dist[id], null, id + ' shown untouched must be undiscovered');
        if (inQ) assert.equal(s.states[id], 'frontier');
      });
    });
    // mark on discovery: every vertex is enqueued at most once
    const vs = Object.values(seenInQueue);
    assert.equal(new Set(vs).size, vs.length, 'no vertex is enqueued twice');
    assert.equal(end.counters.visited, ref.order.length);
    assert.equal(end.counters.checks, ref.order.reduce((t, u) => t + refAdj(g).adj[u].length, 0), 'each adjacency list is scanned once');
  }
});

test('BFS with a target stops when the target is dequeued and returns a shortest path', () => {
  for (const g of graphsFor(7, 200)) {
    const start = g.nodes[0], target = last(g.nodes);
    const steps = GS.bfs(g, start, { target });
    const ref = refBfs(g, start);
    const end = last(steps);
    if (target in ref.dist) {
      assert.equal(end.path.length - 1, ref.dist[target]);
      assert.equal(end.path[0], start);
      assert.equal(last(end.path), target);
      const adj = refAdj(g).adj;
      for (let i = 1; i < end.path.length; i++) assert.ok(adj[end.path[i - 1]].includes(end.path[i]), 'path uses real edges');
      assert.ok(steps.some((s) => s.kind === 'found'));
    } else {
      assert.equal(end.kind, 'done');
      assert.equal(end.path, null);
    }
  }
});

test('BFS that marks on dequeue (the bug) visits the same order but queues copies', () => {
  const K5 = { nodes: 'ABCDE'.split(''), edges: [] };
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) K5.edges.push([K5.nodes[i], K5.nodes[j]]);
  const good = last(GS.bfs(K5, 'A')), bad = last(GS.bfs(K5, 'A', { mark: 'dequeue' }));
  assert.deepEqual(bad.order, good.order);
  assert.deepEqual(bad.dist, good.dist);
  assert.equal(good.counters.entries, 5);
  assert.ok(bad.counters.entries > 5, 'copies pile up: ' + bad.counters.entries);
  for (const g of graphsFor(99, 120)) {
    const a = last(GS.bfs(g, g.nodes[0])), b = last(GS.bfs(g, g.nodes[0], { mark: 'dequeue' }));
    assert.deepEqual(b.order, a.order);
    assert.deepEqual(b.dist, a.dist);
    assert.ok(b.counters.entries >= a.counters.entries);
  }
});

test('BFS edge cases: empty graph, absent start, single vertex, isolated vertices, directed', () => {
  const e = GS.bfs({ nodes: [], edges: [] }, 'A');
  assert.equal(e.length, 1); assert.equal(e[0].kind, 'empty');
  const absent = GS.bfs(MAIN, 'Z');
  assert.equal(absent.length, 1); assert.match(absent[0].caption, /not in the graph/);
  const one = GS.bfs({ nodes: ['A'], edges: [] }, 'A');
  assert.deepEqual(last(one).order, ['A']);
  assert.equal(last(one).kind, 'done');
  const iso = last(GS.bfs({ nodes: ['A', 'B', 'C'], edges: [['A', 'B']] }, 'A'));
  assert.equal(iso.dist.C, null);
  assert.match(iso.caption, /C was never reached/);
  const dir = last(GS.bfs({ nodes: ['A', 'B', 'C'], edges: [['B', 'A'], ['B', 'C']], directed: true }, 'A'));
  assert.deepEqual(dir.order, ['A'], 'edges only point away from B');
  const selfT = GS.bfs(MAIN, 'A', { target: 'A' });
  assert.deepEqual(last(selfT).path, ['A']);
});

/* ------------------------------------------------------------------ DFS */
test('DFS on the lesson graph dives A B D G E C F H I', () => {
  const steps = GS.dfs(MAIN, 'A');
  checkStepShape(steps, ['states', 'disc', 'fin', 'stack', 'order']);
  const end = last(steps);
  assert.deepEqual(end.order, 'ABDGECFHI'.split(''));
  assert.equal(end.disc.A, 1);
  assert.equal(end.fin.A, 18);
  const found = last(GS.dfs(MAIN, 'A', { target: 'I' }));
  assert.deepEqual(found.path, 'ABDGECFHI'.split(''));
});

test('DFS matches the recursive reference; times nest; the stack is always a tree path', () => {
  for (const g of graphsFor(11, 250)) {
    const start = g.nodes[0];
    const steps = GS.dfs(g, start);
    checkStepShape(steps, ['states', 'disc', 'fin', 'stack']);
    const ref = refDfs(g, start), end = last(steps);
    assert.deepEqual(end.order, ref.order);
    g.nodes.forEach((id) => {
      assert.equal(end.disc[id], id in ref.disc ? ref.disc[id] : null);
      assert.equal(end.fin[id], id in ref.fin ? ref.fin[id] : null);
    });
    // parenthesis theorem: intervals are nested or disjoint
    const vs = Object.keys(ref.disc);
    for (const a of vs) for (const b of vs) {
      if (a === b) continue;
      const [da, fa, db, fb] = [ref.disc[a], ref.fin[a], ref.disc[b], ref.fin[b]];
      const disjoint = fa < db || fb < da, nested = (da < db && fb < fa) || (db < da && fa < fb);
      assert.ok(disjoint || nested, 'intervals of ' + a + ' and ' + b);
    }
    steps.forEach((s) => {
      for (let i = 1; i < s.stack.length; i++) assert.equal(s.parent[s.stack[i]], s.stack[i - 1], 'stack is a root-to-top tree path');
      g.nodes.forEach((id) => {
        const on = s.stack.includes(id);
        if (on) assert.ok(s.states[id] === 'frontier' || s.states[id] === 'active');
        if (s.states[id] === 'visited') assert.ok(s.fin[id] !== null, id + ' shown finished must have a finish time');
        if (s.states[id] === 'default') assert.equal(s.disc[id], null);
      });
      if (s.stack.length) assert.equal(s.states[last(s.stack)], 'active');
    });
  }
});

test('DFS back edges appear exactly when the graph has a cycle (directed and undirected)', () => {
  for (const g of graphsFor(5, 200, { directed: true })) {
    const steps = GS.dfs(g, g.nodes[0], { all: true });
    const end = last(steps);
    assert.equal(end.order.length, g.nodes.length, 'the forest reaches every vertex');
    assert.equal(end.hasCycle, refHasCycleDirected(g), 'directed cycle detection');
    const classes = Object.values(end.edgeClass);
    assert.equal(classes.length, GS.adjacency(g).edges.length, 'every edge is classified once');
    assert.equal(classes.filter((c) => c === 'tree').length, g.nodes.length - end.roots.length, 'tree edges = V − trees');
    steps.filter((s) => s.kind === 'back').forEach((s) => {
      assert.ok(s.cycle.length >= 2);
      const adj = refAdj(g).adj;
      for (let i = 1; i < s.cycle.length; i++) assert.ok(adj[s.cycle[i - 1]].includes(s.cycle[i]), 'cycle follows edges');
      assert.ok(adj[last(s.cycle)].includes(s.cycle[0]), 'the back edge closes the cycle');
    });
  }
  for (const g of graphsFor(6, 200)) {
    const end = last(GS.dfs(g, g.nodes[0], { all: true }));
    assert.equal(end.hasCycle, refHasCycleUndirected(g), 'undirected cycle detection');
  }
});

test('DFS classification on the lesson cycle graph: one back, one cross, one forward edge', () => {
  const g = { nodes: 'ABCDE'.split(''), directed: true, edges: [['A', 'B'], ['A', 'C'], ['A', 'E'], ['B', 'D'], ['D', 'E'], ['E', 'B'], ['C', 'D']] };
  const end = last(GS.dfs(g, 'A', { all: true }));
  assert.deepEqual(end.edgeClass, { 'A-B': 'tree', 'B-D': 'tree', 'D-E': 'tree', 'E-B': 'back', 'A-C': 'tree', 'C-D': 'cross', 'A-E': 'forward' });
  assert.equal(end.hasCycle, true);
  const dag = last(GS.dfs(Object.assign({}, g, { edges: g.edges.filter((e) => e.join('') !== 'EB') }), 'A', { all: true }));
  assert.equal(dag.hasCycle, false);
});

test('DFS edge cases: empty, absent start, single vertex, disconnected without and with the forest', () => {
  assert.equal(GS.dfs({ nodes: [], edges: [] }, 'A')[0].kind, 'empty');
  assert.match(GS.dfs(MAIN, 'Q')[0].caption, /not in the graph/);
  const one = last(GS.dfs({ nodes: ['A'], edges: [] }, 'A'));
  assert.deepEqual([one.disc.A, one.fin.A], [1, 2]);
  const g = { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['C', 'D']] };
  assert.deepEqual(last(GS.dfs(g, 'A')).order, ['A', 'B']);
  const forest = last(GS.dfs(g, 'A', { all: true }));
  assert.deepEqual(forest.order, ['A', 'B', 'C', 'D']);
  assert.deepEqual(forest.roots, ['A', 'C']);
});

test('dfsResult and bfsResult agree with the step generators', () => {
  for (const g of graphsFor(3, 150)) {
    const s = g.nodes[0];
    const br = GS.bfsResult(g, s), bs = last(GS.bfs(g, s));
    assert.deepEqual(br.order, bs.order);
    assert.equal(br.checks, bs.counters.checks);
    const dr = GS.dfsResult(g, s), ds = last(GS.dfs(g, s));
    assert.deepEqual(dr.order, ds.order);
    Object.keys(dr.fin).forEach((id) => assert.equal(dr.fin[id], ds.fin[id]));
    assert.equal(dr.maxDepth, Math.max(...GS.dfs(g, s).map((x) => x.stack.length)));
    assert.equal(br.peak, Math.max(...GS.bfs(g, s).filter((x) => x.kind === 'dequeue' || x.kind === 'init').map((x) => x.kind === 'init' ? x.queue.length : x.queue.length + 1)));
  }
});

test('visitFrames: one frame per visit plus the first and last step', () => {
  const b = GS.visitFrames(GS.bfs(MAIN, 'A'));
  assert.equal(b.length, 1 + 9 + 1 - 1, 'init doubles as the frame before the first dequeue');
  assert.deepEqual(b.map((f) => f.counters.visited), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const d = GS.visitFrames(GS.dfs(MAIN, 'A'));
  assert.deepEqual(d.slice(0, -1).map((f) => f.counters.visited), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(last(d).kind, 'done');
  assert.deepEqual(GS.visitFrames([]), []);
});

/* ------------------------------------------------------------------ components & bipartite */
test('components match a reference labelling on random graphs', () => {
  for (const g of graphsFor(12, 200)) {
    const steps = GS.components(g);
    checkStepShape(steps, ['comp', 'states']);
    const end = last(steps), ref = refComponents(g);
    assert.equal(end.count, ref.count);
    g.nodes.forEach((id) => assert.equal(end.comp[id], ref.comp[id]));
    assert.equal(end.sizes.reduce((a, b) => a + b, 0), g.nodes.length);
  }
  assert.equal(last(GS.components({ nodes: [], edges: [] })).kind, 'empty');
  assert.equal(last(GS.components({ nodes: ['A', 'B', 'C'], edges: [] })).count, 3);
});

test('bipartite agrees with a reference; a conflict is a real odd cycle', () => {
  for (const g of graphsFor(21, 300)) {
    const steps = GS.bipartite(g);
    checkStepShape(steps, ['side', 'states']);
    const end = last(steps);
    assert.equal(end.bipartite, refBipartite(g));
    if (end.bipartite === false) {
      const cyc = end.cycle, adj = refAdj(g).adj;
      assert.equal(cyc.length % 2, 1, 'odd cycle');
      assert.equal(new Set(cyc).size, cyc.length, 'simple cycle');
      for (let i = 0; i < cyc.length; i++) assert.ok(adj[cyc[i]].includes(cyc[(i + 1) % cyc.length]), 'cycle follows edges');
    } else {
      g.edges.forEach(([a, b]) => { if (a !== b) assert.notEqual(end.side[a], end.side[b]); });
    }
  }
  const tri = last(GS.bipartite({ nodes: ['A', 'B', 'C'], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] }));
  assert.equal(tri.bipartite, false);
  assert.equal(tri.cycle.length, 3);
  const sq = last(GS.bipartite({ nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']] }));
  assert.equal(sq.bipartite, true);
});

/* ------------------------------------------------------------------ grids */
test('gridBfs distances and path match a reference BFS on random grids', () => {
  const rng = VDSA.rng(2026);
  for (let t = 0; t < 150; t++) {
    const R = rng.int(1, 9), C = rng.int(1, 12);
    const grid = randomGrid(rng, R, C, rng() * 0.45);
    const start = [rng.int(0, R - 1), rng.int(0, C - 1)], goal = [rng.int(0, R - 1), rng.int(0, C - 1)];
    const walls = new Set(grid.walls);
    walls.delete(start.join(',')); walls.delete(goal.join(','));
    grid.walls = [...walls];
    const ref = refGridBfs(grid, start);
    const steps = GS.gridBfs(grid, start, goal);
    checkStepShape(steps, ['codes', 'rows', 'cols']);
    const end = last(steps), g = goal[0] * C + goal[1];
    steps.forEach((s) => assert.equal(s.codes.length, R * C));
    if (ref[g] === -1) {
      assert.equal(end.kind, 'none');
      assert.equal(end.found, false);
    } else {
      assert.equal(end.found, true);
      assert.equal(end.counters.path, ref[g]);
      const cells = [];
      for (let k = 0; k < end.codes.length; k++) if (end.codes[k] === 'p') cells.push(k);
      assert.equal(cells.length, ref[g] + 1, 'path cells');
      cells.forEach((k) => assert.ok(!walls.has(Math.floor(k / C) + ',' + (k % C)), 'path avoids walls'));
      // discovered distances equal the reference
      for (let k = 0; k < R * C; k++) if (end.codes[k] !== '.' && end.codes[k] !== '#') assert.equal(end.dist[k], ref[k]);
    }
    // flood fill reaches exactly the reference component
    const fill = last(GS.gridBfs(grid, start, null));
    const reach = ref.filter((d) => d >= 0).length;
    assert.equal(fill.counters.visited, reach);
    assert.equal([...fill.codes].filter((ch) => ch === 'v').length, reach);
  }
});

test('gridDfs finds a valid route exactly when one exists; the stack is contiguous', () => {
  const rng = VDSA.rng(77);
  for (let t = 0; t < 150; t++) {
    const R = rng.int(1, 8), C = rng.int(1, 10);
    const grid = randomGrid(rng, R, C, rng() * 0.4);
    const start = [rng.int(0, R - 1), rng.int(0, C - 1)], goal = [rng.int(0, R - 1), rng.int(0, C - 1)];
    grid.walls = grid.walls.filter((w) => w !== start.join(',') && w !== goal.join(','));
    const ref = refGridBfs(grid, start);
    const steps = GS.gridDfs(grid, start, goal);
    checkStepShape(steps, ['codes']);
    const end = last(steps);
    assert.equal(end.found, ref[goal[0] * C + goal[1]] !== -1);
    if (end.found) assert.ok(end.counters.path >= ref[goal[0] * C + goal[1]], 'DFS route is never shorter than BFS');
    steps.forEach((s) => {
      const top = [...s.codes].filter((ch) => ch === 'a').length;
      assert.ok(top <= 1, 'one active cell at most');
    });
  }
});

test('grid edge cases: 1×1, walled start, unreachable goal, start = goal, layers', () => {
  const one = GS.gridBfs({ rows: 1, cols: 1, walls: [] }, [0, 0], [0, 0]);
  assert.equal(last(one).counters.path, 0);
  assert.match(GS.gridBfs({ rows: 2, cols: 2, walls: ['0,0'] }, [0, 0], [1, 1])[0].caption, /start cell/);
  const cut = GS.gridBfs({ rows: 3, cols: 3, walls: ['0,1', '1,1', '2,1'] }, [0, 0], [0, 2]);
  assert.equal(last(cut).kind, 'none');
  assert.equal(last(cut).counters.visited, 3);
  const dfsCut = GS.gridDfs({ rows: 3, cols: 3, walls: ['0,1', '1,1', '2,1'] }, [0, 0], [0, 2]);
  assert.equal(last(dfsCut).kind, 'none');
  const layers = GS.gridLayers({ rows: 3, cols: 3, walls: [] }, [1, 1]);
  assert.equal(layers.length, 4, 'distances 0, 1, 2 then done');
  assert.equal([...layers[1].codes].filter((c) => c === 'f').length, 4);
});

/* ------------------------------------------------------------------ input */
test('parseEdgeList accepts friendly input and explains mistakes', () => {
  const ok = GS.parseEdgeList('a-b, B - C; c d\nE');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.values.nodes, ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(ok.values.edges, [['A', 'B'], ['B', 'C'], ['C', 'D']]);
  assert.deepEqual(GS.parseEdgeList('A-B, B-A').values.edges, [['A', 'B']], 'duplicates collapse');
  assert.match(GS.parseEdgeList('').error, /at least one/);
  assert.match(GS.parseEdgeList('A-A').error, /itself/);
  assert.match(GS.parseEdgeList('A-B-C').error, /exactly two/);
  assert.match(GS.parseEdgeList('A-$').error, /not an edge/);
  const many = [];
  for (let i = 0; i < 14; i++) many.push('N' + i);
  assert.match(GS.parseEdgeList(many.join(',')).error, /12 or fewer/);
});

test('randomGraph is reproducible and respects the edge count', () => {
  const a = GS.randomGraph(10, 15, VDSA.rng(1), { connected: true }), b = GS.randomGraph(10, 15, VDSA.rng(1), { connected: true });
  assert.deepEqual(a, b);
  assert.equal(a.edges.length, 15);
  assert.equal(last(GS.bfs(a, 'V0')).order.length, 10, 'connected option gives a connected graph');
});

test('DFS captions never claim a route is shortest unless it is', () => {
  const far = last(GS.dfs(MAIN, 'A', { target: 'I' }));
  assert.match(far.caption, /shortest route has only 4 edges/);
  const near = last(GS.dfs(MAIN, 'A', { target: 'B' }));
  assert.match(near.caption, /happens to be a shortest route/);
  const open = last(GS.gridDfs({ rows: 5, cols: 7, walls: [] }, [2, 0], [2, 6]));
  assert.match(open.caption, new RegExp('shortest route has only ' + 6 + ' steps'));
});
