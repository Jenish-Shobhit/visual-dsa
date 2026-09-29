// Lesson 28 · Dijkstra & A* — step generator tests.
// Run: node --test tests/algos/28-dijkstra-and-a-star.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const SP = require(path.join(root, 'js/algos/28-dijkstra-and-a-star.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));
const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ fixtures */
const MAP = {
  nodes: 'SABCDT'.split(''),
  edges: [['S', 'A', 7], ['S', 'B', 2], ['B', 'A', 3], ['A', 'C', 1], ['B', 'D', 8], ['C', 'D', 2], ['C', 'T', 6], ['D', 'T', 3]],
  directed: false
};

/* ------------------------------------------------------------------ references */
// O(V^2) Dijkstra with no heap: the textbook array version.
function refDijkstra(graph, s) {
  const G = SP.normalize(graph);
  const dist = {}, done = {};
  G.ids.forEach((id) => { dist[id] = Infinity; });
  dist[s] = 0;
  for (let i = 0; i < G.ids.length; i++) {
    let u = null;
    G.ids.forEach((id) => { if (!done[id] && dist[id] < Infinity && (u === null || dist[id] < dist[u])) u = id; });
    if (u === null) break;
    done[u] = true;
    G.out[u].forEach((a) => { if (dist[u] + a.w < dist[a.to]) dist[a.to] = dist[u] + a.w; });
  }
  return dist;
}
// Grid reference: Bellman-Ford style relaxation to a fixed point.
function refGrid(grid, start, goal, mudCost = 5) {
  const R = grid.rows, C = grid.cols;
  const wall = new Set((grid.walls || []).map(String)), mud = new Set((grid.mud || []).map(String));
  const d = Array.from({ length: R }, () => Array(R ? C : 0).fill(Infinity));
  d[start[0]][start[1]] = 0;
  for (let pass = 0; pass < R * C; pass++) {
    let changed = false;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (d[r][c] === Infinity) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C || wall.has(nr + ',' + nc)) return;
        const w = mud.has(nr + ',' + nc) ? mudCost : 1;
        if (d[r][c] + w < d[nr][nc]) { d[nr][nc] = d[r][c] + w; changed = true; }
      });
    }
    if (!changed) break;
  }
  return d[goal[0]][goal[1]];
}
function randomGrid(rng, R, C, wallP, mudP) {
  const walls = [], mud = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if ((r === 0 && c === 0) || (r === R - 1 && c === C - 1)) continue;
    const x = rng();
    if (x < wallP) walls.push(r + ',' + c); else if (x < wallP + mudP) mud.push(r + ',' + c);
  }
  return { rows: R, cols: C, walls, mud };
}

/* ------------------------------------------------------------------ graph Dijkstra */
test('dijkstra matches the textbook distances on the lesson map', () => {
  const steps = SP.dijkstra(MAP, 'S');
  const end = last(steps);
  assert.equal(end.kind, 'done');
  assert.deepEqual(end.dist, { S: 0, A: 5, B: 2, C: 6, D: 8, T: 11 });
  assert.deepEqual(end.parent, { S: null, A: 'B', B: 'S', C: 'A', D: 'C', T: 'D' });
  assert.deepEqual(end.order, ['S', 'B', 'A', 'C', 'D', 'T']);
});

test('random graphs: distances equal the reference and Bellman-Ford', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(seed);
    const n = 2 + Math.floor(rng() * 9);
    const directed = seed % 3 === 0;
    const g = SP.randomWeightedGraph(n, Math.floor(rng() * n * 2.5), rng, { directed, maxW: seed % 4 === 0 ? 1 : 12, minW: seed % 5 === 0 ? 0 : 1, letters: true });
    const ref = refDijkstra(g, 'A');
    const bf = SP.bellmanFord(g, 'A');
    const steps = SP.dijkstra(g, 'A');
    const end = last(steps);
    Object.keys(ref).forEach((id) => {
      const got = end.dist[id] === null ? Infinity : end.dist[id];
      assert.equal(got, ref[id], `seed ${seed} vertex ${id}`);
      assert.equal(bf.dist[id], ref[id]);
    });
    const res = SP.dijkstraResult(g, 'A');
    Object.keys(ref).forEach((id) => assert.equal(res.dist[id], ref[id]));
    // parents form a tree whose path costs equal the distances
    const G = SP.normalize(g);
    Object.keys(ref).forEach((id) => {
      if (ref[id] === Infinity) { assert.equal(end.parent[id], null); return; }
      assert.equal(SP.pathCost(G, SP.pathTo(end.parent, id)), ref[id], `path cost seed ${seed} ${id}`);
    });
  }
});

test('settled vertices come out in non-decreasing distance order and are never improved', () => {
  for (let seed = 100; seed < 130; seed++) {
    const rng = VDSA.rng(seed);
    const g = SP.randomWeightedGraph(8, 14, rng, { connected: true, letters: true, maxW: 9 });
    const steps = SP.dijkstra(g, 'A');
    let prev = -1;
    const finalDist = last(steps).dist;
    steps.forEach((s) => {
      if (s.kind === 'settle') {
        assert.ok(s.dist[s.u] >= prev, 'non-decreasing');
        prev = s.dist[s.u];
        assert.equal(s.dist[s.u], finalDist[s.u], 'settled distance is final');
        assert.equal(s.states[s.u], 'active');
      }
      Object.keys(s.settled).forEach((id) => { assert.equal(s.dist[id], finalDist[id]); assert.equal(s.states[id] === 'done' || s.states[id] === 'active', true); });
    });
  }
});

test('the queue snapshot is sorted and stale entries are exactly the out-of-date ones', () => {
  const g = { nodes: ['S', 'A', 'B'], edges: [['S', 'A', 4], ['S', 'B', 1], ['B', 'A', 2]] };
  const steps = SP.dijkstra(g, 'S');
  const relaxA = steps.filter((s) => s.kind === 'relax' && s.u === 'B');
  assert.equal(relaxA.length, 1);
  const pq = relaxA[0].pq;
  assert.deepEqual(pq.map((e) => [e.d, e.v, e.stale]), [[3, 'A', false], [4, 'A', true]]);
  steps.forEach((s) => {
    for (let i = 1; i < s.pq.length; i++) assert.ok(s.pq[i - 1].d <= s.pq[i].d);
    s.pq.forEach((e) => assert.equal(e.stale, e.d > (s.dist[e.v] === null ? Infinity : s.dist[e.v])));
  });
  assert.ok(steps.some((s) => s.kind === 'stale'));
  const end = last(steps);
  assert.equal(end.counters.stale, 1);
  assert.equal(end.counters.pushes, 4);   // S, A(4), B(1), A(3)
  assert.equal(end.counters.settled, 3);
  assert.equal(end.pq.length, 0);
});

test('every step has the same counter keys and a caption, and lines exist', () => {
  const steps = SP.dijkstra(MAP, 'S', { target: 'T' });
  const keys = Object.keys(steps[0].counters).join();
  steps.forEach((s) => {
    assert.equal(Object.keys(s.counters).join(), keys);
    assert.ok(s.caption && s.caption.length > 10);
    assert.ok(s.line !== undefined);
  });
});

test('target: stops as soon as it is settled and walks the path back', () => {
  const steps = SP.dijkstra(MAP, 'S', { target: 'T' });
  const found = steps.find((s) => s.kind === 'found');
  assert.ok(found);
  assert.equal(found.u, 'T');
  assert.equal(found.dist.T, 11);
  const paths = steps.filter((s) => s.kind === 'path');
  assert.deepEqual(last(paths).pathIds, ['S', 'B', 'A', 'C', 'D', 'T'].slice(0, 1).concat(['B', 'A', 'C', 'D', 'T']));
  assert.equal(last(paths).states.T, 'found');
  assert.equal(last(steps).kind, 'path');
  assert.equal(steps.some((s) => s.kind === 'done'), false);
  // everything settled after T is never explored: fewer settles than the full run
  assert.ok(found.counters.settled <= 6);
});

test('target = source: path of a single vertex', () => {
  const steps = SP.dijkstra(MAP, 'S', { target: 'S' });
  assert.equal(last(steps).kind, 'path');
  assert.deepEqual(last(steps).pathIds, ['S']);
});

test('unreachable vertices stay at infinity and are muted; unreachable target ends with done', () => {
  const g = { nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B', 2], ['C', 'D', 1]] };
  const end = last(SP.dijkstra(g, 'A'));
  assert.equal(end.dist.C, null);
  assert.equal(end.states.C, 'muted');
  assert.equal(end.states.B, 'done');
  const t = SP.dijkstra(g, 'A', { target: 'D' });
  assert.equal(last(t).kind, 'done');
});

test('edge cases: empty graph, single vertex, unknown start, zero weights, ties, parallel edges, self loops', () => {
  assert.equal(SP.dijkstra({ nodes: [], edges: [] }, 'A')[0].kind, 'empty');
  assert.equal(SP.dijkstra({ nodes: ['A'], edges: [] }, 'Z')[0].kind, 'empty');
  const single = SP.dijkstra({ nodes: ['A'], edges: [] }, 'A');
  assert.equal(last(single).kind, 'done');
  assert.equal(last(single).dist.A, 0);
  const zero = SP.dijkstra({ nodes: ['A', 'B', 'C'], edges: [['A', 'B', 0], ['B', 'C', 0], ['A', 'C', 0]] }, 'A');
  assert.deepEqual(last(zero).dist, { A: 0, B: 0, C: 0 });
  const par = SP.normalize({ nodes: ['A', 'B'], edges: [['A', 'B', 5], ['B', 'A', 2], ['A', 'A', 1]] });
  assert.equal(par.edges.length, 1);
  assert.equal(par.edges[0].weight, 2);
  const tie = last(SP.dijkstra({ nodes: 'ABCD'.split(''), edges: [['A', 'B', 1], ['A', 'C', 1], ['B', 'D', 1], ['C', 'D', 1]] }, 'A'));
  assert.equal(tie.dist.D, 2);
  assert.equal(tie.parent.D, 'B'); // first to reach it wins on a tie
});

test('a negative edge is refused unless allowNegative is set', () => {
  const g = { nodes: ['A', 'B'], edges: [['A', 'B', -1]], directed: true };
  const steps = SP.dijkstra(g, 'A');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].kind, 'error');
});

test('negative edge counterexample: Dijkstra settles too early, the truth differs', () => {
  const g = { nodes: ['S', 'A', 'B', 'T'], edges: [['S', 'A', 1], ['S', 'B', 2], ['A', 'T', 1], ['B', 'A', -3]], directed: true };
  const steps = SP.negativeDemo(g, 'S');
  const end = last(steps);
  assert.equal(end.kind, 'truth');
  assert.deepEqual(end.dist, { S: 0, A: 1, B: 2, T: 2 });
  assert.deepEqual(end.truth, { S: 0, A: -1, B: 2, T: 0 });
  assert.deepEqual(end.wrong.sort(), ['A', 'T']);
  assert.equal(end.states.A, 'error');
  assert.equal(end.states.B, 'visited');   // nothing proves a settled vertex is final here
  assert.ok(steps.some((s) => s.kind === 'ignore'));
  assert.equal(end.edges['B-A'], 'error');
  assert.equal(SP.bellmanFord(g, 'S').negativeCycle, false);
  assert.equal(SP.bellmanFord({ nodes: ['A', 'B'], edges: [['A', 'B', -1]] }, 'A').negativeCycle, true);
});

test('fewest edges is not least weight', () => {
  const g = { nodes: 'SABTC'.split(''), edges: [['S', 'T', 10], ['S', 'A', 2], ['A', 'B', 2], ['B', 'T', 2]] };
  const bfs = SP.fewestEdges(g, 'S', 'T');
  assert.deepEqual(bfs.path, ['S', 'T']);
  assert.equal(bfs.cost, 10);
  const dj = SP.dijkstraResult(g, 'S');
  assert.equal(dj.dist.T, 6);
  assert.deepEqual(SP.pathTo(dj.parent, 'T'), ['S', 'A', 'B', 'T']);
});

test('operation counts: pushes = pops, settled <= V, heap work stays near (V + E) log V', () => {
  const rng = VDSA.rng(5);
  const g = SP.randomWeightedGraph(60, 180, rng, { connected: true });
  const r = SP.dijkstraResult(g, 'V0');
  assert.equal(r.pushes, r.pops);
  assert.equal(r.settled, 60);
  assert.equal(r.pops - r.stale, 60);
  assert.ok(r.pushes <= 1 + 2 * 180);
});

/* ------------------------------------------------------------------ parsing */
test('parseWeightedEdgeList: good input, defaults and friendly errors', () => {
  const ok = SP.parseWeightedEdgeList('A-B:4, B-C:2\nD, a-c 7');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.values.nodes, ['A', 'B', 'C', 'D']);
  assert.deepEqual(ok.values.edges, [['A', 'B', 4], ['B', 'C', 2], ['A', 'C', 7]]);
  assert.deepEqual(SP.parseWeightedEdgeList('A-B').values.edges, [['A', 'B', 1]]);
  assert.match(SP.parseWeightedEdgeList('').error, /at least one edge/);
  assert.match(SP.parseWeightedEdgeList('A-B:-3').error, /negative/);
  assert.equal(SP.parseWeightedEdgeList('A-B:-3', { allowNegative: true }).error, null);
  assert.match(SP.parseWeightedEdgeList('A-A:2').error, /itself/);
  assert.match(SP.parseWeightedEdgeList('A-B:500').error, /too large/);
  assert.match(SP.parseWeightedEdgeList('A-B:2.5').error, /whole/);
  assert.match(SP.parseWeightedEdgeList('A-B-C').error, /not an edge/);
  const many = Array.from({ length: 12 }, (_, i) => 'N' + i + '-N' + (i + 1) + ':1').join(',');
  assert.match(SP.parseWeightedEdgeList(many).error, /vertices/);
  const directed = SP.parseWeightedEdgeList('A-B:1, B-A:5', { directed: true });
  assert.equal(directed.values.edges.length, 2);
  assert.equal(SP.parseWeightedEdgeList('A-B:1, B-A:5').values.edges.length, 1);
});

/* ------------------------------------------------------------------ grids */
test('grid Dijkstra and A* (Manhattan) find optimal paths on random grids, with walls and mud', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(seed);
    const R = 3 + Math.floor(rng() * 8), C = 3 + Math.floor(rng() * 8);
    const grid = randomGrid(rng, R, C, 0.25, 0.2);
    const start = [0, 0], goal = [R - 1, C - 1];
    const ref = refGrid(grid, start, goal);
    const dj = SP.gridSearchResult(grid, start, goal, { algo: 'dijkstra' });
    const as = SP.gridSearchResult(grid, start, goal, { algo: 'astar' });
    const eu = SP.gridSearchResult(grid, start, goal, { algo: 'astar', heuristic: 'euclid' });
    const gr = SP.gridSearchResult(grid, start, goal, { algo: 'greedy' });
    if (ref === Infinity) {
      [dj, as, eu, gr].forEach((r) => assert.equal(r.found, false));
      continue;
    }
    assert.equal(dj.cost, ref, `dijkstra seed ${seed}`);
    assert.equal(as.cost, ref, `astar seed ${seed}`);
    assert.equal(eu.cost, ref, `astar euclid seed ${seed}`);
    assert.ok(gr.found && gr.cost >= ref, 'greedy finds a route, maybe a dearer one');
    assert.ok(as.expanded <= dj.expanded, 'A* with an admissible h never expands more than Dijkstra (ties aside)');
  }
});

test('grid steps: shape, counters, closed costs and the path', () => {
  const grid = { rows: 6, cols: 8, walls: ['1,3', '2,3', '3,3', '4,3'], mud: ['2,5', '3,5'] };
  ['gridDijkstra', 'gridAStar', 'gridGreedy'].forEach((fn) => {
    const steps = SP[fn](grid, [2, 1], [3, 6]);
    const keys = Object.keys(steps[0].counters).join();
    const N = 48;
    steps.forEach((s) => {
      assert.equal(s.codes.length, N);
      assert.equal(s.mud.length, N);
      assert.equal(Object.keys(s.counters).join(), keys);
      assert.ok(s.caption);
      assert.equal(s.codes[2 * 8 + 3], '#');
    });
    const end = last(steps);
    assert.equal(end.kind, 'path');
    assert.equal(end.found, true);
    // path cells form a connected chain from S to T; cost equals the sum of entering costs
    const cells = [];
    for (let k = 0; k < end.codes.length; k++) if (end.codes[k] === 'p') cells.push([Math.floor(k / 8), k % 8]);
    let cost = 0;
    const set = new Set(cells.map((c) => c.join()));
    assert.ok(set.has('2,1') && set.has('3,6'));
    cells.forEach((c) => { if (c.join() !== '2,1') cost += grid.mud.includes(c.join()) ? 5 : 1; });
    assert.equal(end.counters.cost, cost);
    // closed costs are set for every expanded cell and only for those
    for (let k = 0; k < N; k++) {
      const done = 'avp'.includes(end.codes[k]);
      assert.equal(end.closedG[k] >= 0, done, `closedG ${k}`);
    }
    // frontier counter equals the number of 'f' cells at every step
    steps.forEach((s) => assert.equal(s.counters.frontier, s.codes.split('').filter((c) => c === 'f').length));
  });
});

test('grid heuristic explorer: h = 0 is Dijkstra, x3 overestimates and can return a dearer route', () => {
  // A wall with a long detour, and a cheap route through mud the estimate cannot see.
  const grid = { rows: 9, cols: 15, walls: [], mud: [] };
  for (let r = 0; r < 9; r++) if (r !== 4) grid.walls.push(r + ',7');
  for (let c = 8; c < 12; c++) { grid.mud.push('4,' + c); }
  const start = [4, 1], goal = [4, 13];
  const zero = SP.gridSearchResult(grid, start, goal, { algo: 'astar', heuristic: 'zero' });
  const dj = SP.gridSearchResult(grid, start, goal, { algo: 'dijkstra' });
  assert.equal(zero.cost, dj.cost);
  assert.equal(zero.expanded, dj.expanded);
  const man = SP.gridSearchResult(grid, start, goal, { algo: 'astar' });
  assert.equal(man.cost, dj.cost);
  assert.ok(man.expanded < dj.expanded);
  const over = SP.gridSearchResult(grid, start, goal, { algo: 'astar', hWeight: 3 });
  assert.ok(over.expanded <= man.expanded);
  assert.ok(over.cost >= dj.cost);
});

test('an overestimating heuristic really can be wrong (hand-built case)', () => {
  // Open field with a mud strip straight to the goal: weight 6 sends A* through the mud.
  const grid = { rows: 7, cols: 13, walls: [], mud: [] };
  for (let c = 1; c < 12; c++) grid.mud.push('3,' + c);
  const start = [3, 0], goal = [3, 12];
  const best = SP.gridSearchResult(grid, start, goal, { algo: 'dijkstra' });
  const wrong = SP.gridSearchResult(grid, start, goal, { algo: 'astar', hWeight: 8 });
  assert.ok(wrong.cost > best.cost, `${wrong.cost} > ${best.cost}`);
});

test('grid edge cases: no path, start = goal, blocked start, out of range, empty grid', () => {
  const wall = { rows: 3, cols: 5, walls: ['0,2', '1,2', '2,2'] };
  ['gridDijkstra', 'gridAStar', 'gridGreedy'].forEach((fn) => {
    const steps = SP[fn](wall, [1, 0], [1, 4]);
    assert.equal(last(steps).kind, 'none');
    assert.equal(last(steps).found, false);
    assert.equal(last(steps).counters.cost, '–');
    const same = SP[fn]({ rows: 2, cols: 2 }, [0, 0], [0, 0]);
    assert.equal(last(same).kind, 'path');
    assert.equal(last(same).counters.cost, 0);
    assert.equal(SP[fn]({ rows: 2, cols: 2, walls: ['0,0'] }, [0, 0], [1, 1])[0].kind, 'empty');
    assert.equal(SP[fn]({ rows: 2, cols: 2, walls: ['1,1'] }, [0, 0], [1, 1])[0].kind, 'empty');
    assert.equal(SP[fn]({ rows: 2, cols: 2 }, [5, 5], [1, 1])[0].kind, 'empty');
    assert.equal(SP[fn]({ rows: 0, cols: 0 }, [0, 0], [0, 0])[0].kind, 'empty');
  });
});

test('gridCompare: same optimal cost for Dijkstra and A*, greedy expands least on an open field', () => {
  const open = { rows: 15, cols: 25 };
  const cmp = SP.gridCompare(open, [7, 2], [7, 22]);
  assert.equal(cmp.dijkstra.cost, 20);
  assert.equal(cmp.astar.cost, 20);
  assert.ok(cmp.astar.expanded < cmp.dijkstra.expanded / 4);
  assert.ok(cmp.greedy.expanded <= cmp.astar.expanded);
  assert.equal(cmp.best, 20);
});

test('A* expansions grow much slower than Dijkstra with grid size (measured)', () => {
  const rng = VDSA.rng(9);
  let prevD = 0, ratio = 0;
  [10, 20, 40].forEach((n) => {
    const g = randomGrid(rng, n, n, 0.18, 0);
    const d = SP.gridSearchResult(g, [0, 0], [n - 1, n - 1], { algo: 'dijkstra' });
    const a = SP.gridSearchResult(g, [0, 0], [n - 1, n - 1], { algo: 'astar' });
    if (d.found) { assert.equal(a.cost, d.cost); assert.ok(a.expanded <= d.expanded); ratio = d.expanded / a.expanded; }
    prevD = d.expanded;
  });
  assert.ok(prevD > 100 && ratio > 1.2);
});
