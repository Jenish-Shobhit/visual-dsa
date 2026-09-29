// Lesson 37 · P, NP & hard problems — generator and reference tests.
// Run: node --test tests/algos/37-p-vs-np.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const A = require(path.join(root, 'js/algos/37-p-vs-np.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ references */
function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => { permutations(arr.slice(0, i).concat(arr.slice(i + 1))).forEach(p => out.push([x].concat(p))); });
  return out;
}
function refOptimum(pts) {
  const n = pts.length;
  if (n <= 1) return 0;
  let best = Infinity;
  permutations(Array.from({ length: n - 1 }, (_, i) => i + 1)).forEach(p => { best = Math.min(best, A.tourLength(pts, [0].concat(p))); });
  return best;
}
function isPermutationOf(tour, n) { return tour.length === n && new Set(tour).size === n && tour.every(c => c >= 0 && c < n); }
function randPts(rng, n) { return A.randomCities(n, rng.int(1, 1e6)); }
function randGraph(rng, n, p) {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i) }));
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng() < p) edges.push([nodes[i].id, nodes[j].id]);
  return { nodes, edges };
}
function subsetsOf(ids) { const out = []; for (let m = 0; m < (1 << ids.length); m++) out.push(ids.filter((_, i) => m & (1 << i))); return out; }
function checkSteps(steps) {
  assert.ok(steps.length > 0);
  for (const st of steps) { assert.equal(typeof st.caption, 'string'); assert.ok(st.caption.length > 0); }
}

/* ------------------------------------------------------------------ growth */
test('factorial and gamma agree; the universe markers are right', () => {
  assert.equal(A.factorial(0), 1);
  assert.equal(A.factorial(5), 120);
  for (let n = 1; n <= 20; n++) assert.ok(Math.abs(A.factorialF(n) / A.factorial(n) - 1) < 1e-9, 'n=' + n);
  assert.equal(A.opsFor('n3', 10), 1000);
  assert.equal(A.opsFor('2n', 10), 1024);
  assert.equal(A.opsFor('n!', 10), 3628800);
  const limit = 1e9 * A.AGE_OF_UNIVERSE_S;      // operations in the age of the universe at a billion per second
  assert.equal(A.firstN('n!', limit), 27);
  assert.equal(A.firstN('2n', limit), 89);
  assert.equal(A.firstN('n3', limit), Infinity);
  assert.throws(() => A.opsFor('nope', 3));
});
test('formatting', () => {
  assert.equal(A.fmtInt(40320), '40,320');
  assert.equal(A.fmtBig(6.0e16), '6.0 × 10¹⁶');
  assert.equal(A.fmtDuration(8e-6), '8.0 µs');
  assert.equal(A.fmtDuration(A.opsFor('n!', 20) / 1e9), '77 years');
  assert.match(A.fmtDuration(A.opsFor('n!', 40) / 1e9), /age of the universe/);
  assert.equal(A.fmtDuration(120), '2.0 minutes');
});

/* ------------------------------------------------------------------ TSP */
test('Held-Karp matches full enumeration on small random maps', () => {
  const rng = VDSA.rng(37);
  for (let t = 0; t < 40; t++) {
    const n = rng.int(1, 8), pts = randPts(rng, n);
    const hk = A.heldKarp(pts);
    assert.ok(Math.abs(hk.length - refOptimum(pts)) < 1e-6);
    assert.ok(isPermutationOf(hk.tour, n));
    assert.ok(Math.abs(A.tourLength(pts, hk.tour) - hk.length) < 1e-6);
  }
});
test('brute-force trace ends at the optimum, counts every tour, and only ever improves', () => {
  const rng = VDSA.rng(5);
  for (let n = 0; n <= 8; n++) {
    const pts = randPts(rng, n), r = A.bruteForce(pts);
    checkSteps(r.steps);
    if (n >= 3) {
      assert.equal(r.total, A.factorial(n - 1));
      assert.ok(Math.abs(r.length - refOptimum(pts)) < 1e-6);
      const last = r.steps[r.steps.length - 1];
      assert.equal(last.kind, 'done');
      assert.equal(last.counters.tours, r.total);
      assert.ok(isPermutationOf(last.path, n));
      let best = Infinity, prevTried = 0;
      r.steps.forEach(s => {
        if (s.kind === 'best') { assert.ok(A.tourLength(pts, s.path) < best); best = A.tourLength(pts, s.path); }
        if (s.kind === 'try' || s.kind === 'best') {
          assert.ok(s.counters.tours > prevTried); prevTried = s.counters.tours;
          assert.ok(A.tourLength(pts, s.path) >= best - 1e-9, 'a drawn "try" tour can be longer than best but best is monotone');
          assert.ok(isPermutationOf(s.path, n));
        }
      });
      assert.ok(r.steps.length <= 160, 'bounded trace: ' + r.steps.length);
    }
  }
});
test('brute force refuses more than 9 cities and the reference agrees with the trace at the cap', () => {
  assert.throws(() => A.bruteForce(A.randomCities(10, 1)), RangeError);
  const pts = A.randomCities(9, 11);
  const r = A.bruteForce(pts);
  assert.equal(r.total, 40320);
  assert.ok(Math.abs(r.length - A.heldKarp(pts).length) < 1e-6);
});
test('brute force finds the perimeter of a convex polygon', () => {
  const pts = A.circleCities(7), r = A.bruteForce(pts);
  const perimeter = A.tourLength(pts, [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(Math.abs(r.length - perimeter) < 1e-6);
});
test('nearest neighbour is a valid greedy tour', () => {
  const rng = VDSA.rng(8);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(0, 12), pts = randPts(rng, n), r = A.nearestNeighbour(pts);
    checkSteps(r.steps);
    assert.ok(isPermutationOf(r.tour, n) || n === 0);
    if (n >= 3) {
      assert.ok(r.length >= A.heldKarp(pts).length - 1e-6);
      // each move goes to the closest unvisited city
      for (let k = 1; k < n; k++) {
        const from = r.tour[k - 1], chosen = r.tour[k], rest = r.tour.slice(k);
        const dmin = Math.min(...rest.map(c => A.dist(pts[from], pts[c])));
        assert.ok(Math.abs(A.dist(pts[from], pts[chosen]) - dmin) < 1e-9);
      }
    }
    r.steps.forEach(s => { if (s.kind === 'scan') { assert.ok(s.scan.to.length >= 1); assert.ok(s.scan.to.some(c => c.id === s.scan.pick)); } });
  }
});
test('nearest neighbour can be beaten: the trace ends with the true tour length', () => {
  const pts = A.clusterCities(10, 5), r = A.nearestNeighbour(pts);
  assert.ok(Math.abs(A.tourLength(pts, r.tour) - r.length) < 1e-6);
  assert.match(r.steps[r.steps.length - 1].caption, /heuristic/);
});
test('2-opt only shortens, ends at a local optimum and never lengthens the start', () => {
  const rng = VDSA.rng(21);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(0, 13), pts = randPts(rng, n);
    const start = n ? A.nearestNeighbour(pts).tour : [];
    const r = A.twoOpt(pts, start);
    checkSteps(r.steps);
    if (n >= 4) {
      assert.ok(isPermutationOf(r.tour, n));
      assert.ok(A.isLocalOptimum(pts, r.tour));
      assert.ok(r.length <= A.tourLength(pts, start) + 1e-6);
      assert.ok(r.length >= A.heldKarp(pts).length - 1e-6);
      let len = A.tourLength(pts, start);
      r.steps.forEach(s => {
        if (s.kind === 'swap') { const L = A.tourLength(pts, s.path); assert.ok(L < len - 1e-9); len = L; assert.ok(isPermutationOf(s.path, n)); }
      });
      assert.ok(Math.abs(len - r.length) < 1e-6);
      assert.ok(r.steps.length <= 170 + 2 * r.swaps + 6, 'bounded: ' + r.steps.length);
    }
  }
});
test('2-opt repairs a crossing', () => {
  // a bow-tie: 0-1-2-3 order crosses; uncrossing must give the perimeter
  const pts = [{ x: 100, y: 100 }, { x: 400, y: 400 }, { x: 400, y: 100 }, { x: 100, y: 400 }];
  const r = A.twoOpt(pts, [0, 1, 2, 3]);
  assert.ok(Math.abs(r.length - 1200) < 1e-6);
  assert.ok(r.swaps >= 1);
});
test('MST 2-approximation obeys tree <= optimum and tour <= 2 x tree', () => {
  const rng = VDSA.rng(99);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(0, 12), pts = randPts(rng, n), r = A.mstApprox(pts);
    checkSteps(r.steps);
    if (n < 3) continue;
    const opt = A.heldKarp(pts).length;
    assert.ok(isPermutationOf(r.tour, n));
    assert.ok(r.mst.edges.length === n - 1);
    assert.ok(r.mst.length <= opt + 1e-6);
    assert.ok(r.length <= 2 * r.mst.length + 1e-6);
    assert.ok(r.length <= 2 * opt + 1e-6);
    assert.ok(r.length >= opt - 1e-6);
    assert.ok(Math.abs(r.mst.length - A.primMST(pts).length) < 1e-6);
  }
});
test('compareTours orders the methods sensibly', () => {
  const pts = A.randomCities(9, 4), c = A.compareTours(pts);
  assert.ok(c.optimal <= c.twoOpt + 1e-6 && c.twoOpt <= c.nearest + 1e-6);
  assert.ok(c.optimal <= c.mst + 1e-6 && c.mst <= 2 * c.optimal + 1e-6);
  assert.equal(A.compareTours(A.randomCities(2, 1)), null);
});
test('city layouts respect the box and count', () => {
  [A.randomCities(14, 2), A.circleCities(14), A.clusterCities(14, 7)].forEach(pts => {
    assert.equal(pts.length, 14);
    pts.forEach(p => { assert.ok(p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 600); });
  });
});

/* ------------------------------------------------------------------ Sudoku */
test('both puzzles are solved by the naive solver, with known node counts', () => {
  const g = A.solveNaive(A.parseGrid(A.PUZZLES.gentle.grid)), n = A.solveNaive(A.parseGrid(A.PUZZLES.nasty.grid));
  assert.ok(g.solved && n.solved);
  assert.equal(g.nodes, 4208);
  assert.equal(n.nodes, 49558);
  assert.equal(A.verifyGrid(g.grid), null);
  assert.equal(A.verifyGrid(n.grid), null);
});
test('a slower puzzle exists: 9,727,396 placements for naive backtracking', () => {
  const mid = A.parseGrid('400000805030000000000700000020000060000080400000010000000603070500200000104000000');
  assert.equal(A.solveNaive(mid, null, 3e7).nodes, 9727396);
});
test('verifyGrid finds duplicates and empties', () => {
  const sol = A.solvedGrid(A.parseGrid(A.PUZZLES.gentle.grid));
  assert.equal(A.verifyGrid(sol), null);
  const bad = sol.slice(); bad[0] = bad[1];
  const v = A.verifyGrid(bad);
  assert.ok(v && v.kind === 'row' && v.index === 0);
  const empty = sol.slice(); empty[80] = 0;
  assert.ok(A.verifyGrid(empty).empty);
  assert.throws(() => A.parseGrid('123'));
});
test('verifySteps: 27 units and 243 reads for a solution, early exit for a mistake, clue check', () => {
  const given = A.parseGrid(A.PUZZLES.gentle.grid), sol = A.solvedGrid(given);
  const ok = A.verifySteps(sol, given);
  checkSteps(ok);
  assert.equal(ok[ok.length - 1].kind, 'accept');
  assert.equal(ok[ok.length - 1].reads, 243);
  assert.equal(ok.filter(s => s.kind === 'unit').length, 27);
  const bad = sol.slice(); bad[40] = (bad[40] % 9) + 1;
  const rej = A.verifySteps(bad, given);
  assert.equal(rej[rej.length - 1].kind, 'reject');
  assert.ok(rej[rej.length - 1].reads < 243);
  const clueChanged = sol.slice(); clueChanged[0] = (clueChanged[0] % 9) + 1;
  assert.equal(A.verifySteps(clueChanged, given).pop().kind, 'reject');
});
test('the race: bounded, monotone clock, ends at the full solve; verify is orders of magnitude cheaper', () => {
  ['gentle', 'nasty'].forEach(key => [false, true].forEach(wrong => {
    const r = A.raceSteps(key, wrong);
    checkSteps(r.steps);
    assert.ok(r.steps.length <= 90, 'steps ' + r.steps.length);
    let prev = -1;
    r.steps.forEach(s => { assert.ok(s.solveNodes >= prev); prev = s.solveNodes; assert.equal(s.solveGrid.length, 81); });
    const last = r.steps[r.steps.length - 1];
    assert.equal(last.solveNodes, r.nodes);
    assert.equal(A.verifyGrid(last.solveGrid), null);
    assert.ok(last.counters.verifyOps <= 243);
    assert.ok(last.counters.solveOps / last.counters.verifyOps > 15);
    // clues never change in the solver grid
    last.given.forEach((d, i) => { if (d) assert.equal(last.solveGrid[i], d); });
  }));
});

/* ------------------------------------------------------------------ reductions */
test('independent set, vertex cover and clique are one question (all subsets of random graphs)', () => {
  const rng = VDSA.rng(3);
  for (let t = 0; t < 40; t++) {
    const g = randGraph(rng, rng.int(1, 8), rng()), ids = g.nodes.map(n => n.id), gc = A.complementGraph(g);
    subsetsOf(ids).forEach(S => {
      const rest = ids.filter(x => !S.includes(x));
      assert.equal(A.isIndependent(g, S), A.isVertexCover(g, rest));
      assert.equal(A.isIndependent(g, S), A.isClique(gc, S));
    });
    assert.equal(A.maxIndependentSet(g).length + A.minVertexCover(g).length, ids.length);
    assert.equal(A.maxIndependentSet(g).length, A.maxClique(gc).length);
    const twice = A.complementGraph(gc);
    assert.deepEqual(twice.edges.map(e => A.edgeKey(e[0], e[1])).sort(), g.edges.map(e => A.edgeKey(e[0], e[1])).sort());
  }
});
test('reductionSteps tells a truthful story', () => {
  const g = A.graphFromEdges([['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'A'], ['B', 'E'], ['C', 'F']]);
  const r = A.reductionSteps(g);
  checkSteps(r.steps);
  assert.equal(r.steps.length, 6);
  const [graph, is, cover, flip, clique] = r.steps;
  assert.equal(graph.sel.length, 0);
  assert.ok(A.isIndependent(g, is.sel));
  assert.ok(A.isVertexCover(g, cover.sel));
  assert.equal(is.sel.length + cover.sel.length, g.nodes.length);
  assert.equal(flip.view, 'Gc');
  assert.ok(A.isClique(r.complement, clique.sel));
  // a graph with no edges: everyone is independent, the cover is empty
  const empty = A.reductionSteps({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [] });
  assert.equal(empty.cover.length, 0);
  // a complete graph: independent sets have one vertex
  const k3 = A.reductionSteps(A.graphFromEdges([['A', 'B'], ['B', 'C'], ['A', 'C']]));
  assert.equal(k3.independent.length, 1);
});
test('missingEdge is a witness that a set is not a clique', () => {
  const g = A.graphFromEdges([['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'C']]);
  assert.equal(A.missingEdge(g, ['A', 'B', 'C']), null);
  const w = A.missingEdge(g, ['A', 'B', 'C', 'D']);
  assert.ok(w && !A.isClique(g, w));
});

/* ------------------------------------------------------------------ 3-SAT */
test('brute-force SAT agrees with counting all assignments', () => {
  const rng = VDSA.rng(17);
  for (let t = 0; t < 120; t++) {
    const n = rng.int(3, 6), m = rng.int(1, 12), f = A.randomFormula(n, m, rng.int(1, 1e6));
    f.forEach(c => { assert.equal(c.length, 3); assert.equal(new Set(c.map(Math.abs)).size, 3); });
    const count = A.countSolutions(f, n), r = A.bruteForceSat(f, n);
    assert.equal(r.sat, count > 0);
    if (r.sat) assert.ok(A.evalFormula(f, r.assign)); else assert.equal(r.tried, 1 << n);
    const steps = A.satSteps(f, n);
    checkSteps(steps);
    const last = steps[steps.length - 1];
    assert.equal(last.kind, r.sat ? 'sat' : 'unsat');
    assert.equal(last.tried, r.tried);
    const all = A.satSteps(f, n, { all: true });
    assert.equal(all.filter(s => s.kind === 'sat').length, count);
    assert.equal(all.filter(s => s.kind === 'sat' || s.kind === 'try').length, 1 << n);
  }
});
test('the presets are what they claim', () => {
  const F = A.FORMULAS;
  assert.ok(A.countSolutions(F.sat.clauses, F.sat.n) > 0);
  assert.equal(A.countSolutions(F.unsat.clauses, F.unsat.n), 0);
  assert.equal(A.countSolutions(F.tight.clauses, F.tight.n), 1);
  assert.equal(A.satSteps(F.unsat.clauses, F.unsat.n).pop().kind, 'unsat');
});
test('clause evaluation: one true literal is enough', () => {
  assert.equal(A.evalClause([1, -2, 3], [false, true, false]), false);
  assert.equal(A.evalClause([1, -2, 3], [true, true, false]), true);
  assert.equal(A.evalClause([1, -2, 3], [false, false, false]), true);
  assert.equal(A.evalFormula([], [true]), true);
});
test('parseFormula validates', () => {
  assert.deepEqual(A.parseFormula('1 -2 3, -1 2 4').formula, [[1, -2, 3], [-1, 2, 4]]);
  assert.equal(A.parseFormula('1 -2 3, -1 2 4').n, 4);
  assert.deepEqual(A.parseFormula('x1 ¬x2').formula, [[1, -2]]);
  ['', '0', '1 2 3 4', '7', 'a b', '1 -2 3, ,'].forEach(t => { if (t === '1 -2 3, ,') return; assert.ok(A.parseFormula(t).error, t); });
  assert.equal(A.parseFormula(Array(13).fill('1 2 3').join(',')).error, 'Use at most 12 clauses.');
});

/* ------------------------------------------------------------------ vertex cover */
test('the matching 2-approximation is a valid cover within 2 x optimum, made of a maximal matching', () => {
  const rng = VDSA.rng(61);
  for (let t = 0; t < 120; t++) {
    const g = randGraph(rng, rng.int(2, 9), rng() * 0.8 + 0.1);
    if (!g.edges.length) continue;
    const r = A.vcApprox(g);
    checkSteps(r.steps);
    assert.ok(A.isVertexCover(g, r.cover));
    const opt = A.minVertexCover(g);
    assert.equal(r.optimalSize, opt.length);
    assert.ok(r.cover.length >= opt.length);
    assert.ok(r.cover.length <= 2 * opt.length);
    assert.equal(r.cover.length, 2 * r.matching.length);
    // matching edges are disjoint
    const used = new Set(); r.matching.forEach(e => { assert.ok(!used.has(e[0]) && !used.has(e[1])); used.add(e[0]); used.add(e[1]); });
    // maximal: every edge touches a matched vertex
    g.edges.forEach(e => assert.ok(used.has(e[0]) || used.has(e[1])));
    assert.ok(r.matching.length <= opt.length);
    const last = r.steps[r.steps.length - 1];
    assert.equal(last.kind, 'compare');
    assert.equal(last.counters.optimal, opt.length);
    // cover only grows
    let prev = 0; r.steps.forEach(s => { assert.ok(s.cover.length >= prev); prev = s.cover.length; });
  }
});
test('the star is the worst case: exactly twice the optimum', () => {
  const g = A.graphFromEdges([['C', 'A'], ['C', 'B'], ['C', 'D'], ['C', 'E']]);
  const r = A.vcApprox(g);
  assert.equal(r.size, 2);
  assert.equal(r.optimalSize, 1);
});
test('an edgeless graph needs an empty cover', () => {
  const r = A.vcApprox({ nodes: [{ id: 'A', x: 1, y: 1 }], edges: [] });
  assert.equal(r.cover.length, 0);
  checkSteps(r.steps);
});
test('parseEdges', () => {
  const p = A.parseEdges('a-b, B-C, c-b');
  assert.equal(p.graph.edges.length, 2);
  assert.equal(p.graph.nodes.length, 3);
  ['', 'A', 'A-A', 'A-B-C', Array.from({ length: 17 }, (_, i) => 'A-' + String.fromCharCode(66 + (i % 8)) + i).join(',')].forEach(t => assert.ok(A.parseEdges(t).error, t));
  assert.ok(A.parseEdges('A-B, C-D, E-F, G-H, I-J').error, 'too many vertices');
});
test('bounded search tree size depends on k, not on n', () => {
  const rng = VDSA.rng(4);
  for (let t = 0; t < 40; t++) {
    const g = randGraph(rng, rng.int(3, 9), 0.5), opt = A.minVertexCover(g).length;
    for (let k = 0; k <= 4; k++) {
      const r = A.vcBranchNodes(g, k);
      assert.equal(r.found, opt <= k);
      assert.ok(r.nodes <= Math.pow(2, k + 1) - 1);
    }
  }
});

/* ------------------------------------------------------------------ web of hardness and Cook-Levin */
test('ancestors follow the reductions', () => {
  assert.deepEqual(A.ancestors('NP'), []);
  assert.deepEqual(A.ancestors('TSP').sort(), ['3SAT', 'HAM', 'IS', 'NP', 'SAT', 'VC'].sort());
  assert.deepEqual(A.ancestors('SUB').sort(), ['3SAT', 'NP', 'SAT']);
  A.WEB.edges.forEach(e => { assert.ok(A.WEB.nodes.some(n => n.id === e[0]) && A.WEB.nodes.some(n => n.id === e[1])); });
});
test('the tableau is a valid computation; corrupting one cell breaks a window', () => {
  const rows = A.tableau();
  assert.equal(rows.length, 5);
  A.tableauWindows(rows).forEach(w => assert.ok(w.legal));
  const s = A.tableauSteps(null);
  checkSteps(s);
  assert.equal(s[s.length - 1].bad, 0);
  const s2 = A.tableauSteps({ r: 2, c: 3, value: '0' });
  assert.ok(s2[s2.length - 1].bad >= 1);
  assert.ok(s2.some(x => x.kind === 'illegal'));
  assert.equal(s.length, 4 * 6 + 2);
});
