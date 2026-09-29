// Lesson 25 · Graphs & representations — step generator tests.
// Run: node --test tests/algos/25-graphs.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const G = require(path.join(root, 'js/algos/25-graphs.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ random graph + references */
function randomGraph(rng, n, m, directed) {
  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const edges = [];
  for (let k = 0; k < m; k++) {
    const a = rng.pick(ids), b = rng.pick(ids);
    edges.push([a, b]);            // may contain self-loops and repeats: build() must drop them
  }
  return { nodes: ids, edges, directed };
}
function refEdgeSet(g) {
  const set = new Set();
  for (const [a, b] of g.edges) {
    if (a === b) continue;
    set.add(a + '>' + b);
    if (!g.directed) set.add(b + '>' + a);
  }
  return set;
}
function refNeighbours(g, u) {
  const set = refEdgeSet(g);
  return g.nodes.filter((v) => set.has(u + '>' + v));
}

/* ------------------------------------------------------------------ parsing */
test('parseEdgeList reads edges, lone vertices and dedupes', () => {
  const r = G.parseEdgeList('A-B, B-A, C, B->C', {});
  assert.equal(r.error, null);
  assert.deepEqual(r.values.nodes, ['A', 'B', 'C']);
  assert.deepEqual(r.values.edges, [['A', 'B'], ['B', 'C']]);
  const d = G.parseEdgeList('A-B, B-A', { directed: true });
  assert.equal(d.values.edges.length, 2);
});
test('parseEdgeList friendly errors', () => {
  assert.match(G.parseEdgeList('', {}).error, /at least one/i);
  assert.match(G.parseEdgeList('A-A', {}).error, /itself/i);
  assert.match(G.parseEdgeList('A-B-C', {}).error, /Could not read/);
  assert.match(G.parseEdgeList('A-B, C-D, E-F, G-H, I-J, K-L, M-N', {}).error, /more than 12 vertices/);
  assert.equal(G.parseEdgeList('A-B;B-C\nD', {}).values.nodes.length, 4);
});

/* ------------------------------------------------------------------ representations */
test('build: empty, single, isolated vertices', () => {
  const e = G.build({ nodes: [], edges: [] });
  assert.equal(e.V, 0); assert.equal(e.E, 0); assert.deepEqual(e.matrix, []);
  const s = G.build({ nodes: ['A'], edges: [] });
  assert.deepEqual(s.matrix, [[0]]); assert.deepEqual(s.adj.A, []);
});
test('build: matrix, list and edge list agree with a reference on random graphs', () => {
  const rng = VDSA.rng(25);
  for (let t = 0; t < 120; t++) {
    const n = rng.int(1, 9), directed = t % 2 === 0;
    const g = randomGraph(rng, n, rng.int(0, 18), directed);
    const rep = G.build(g);
    const ref = refEdgeSet(g);
    assert.equal(rep.V, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const want = ref.has(rep.ids[i] + '>' + rep.ids[j]);
      assert.equal(rep.has[i][j], want, 'has ' + i + ',' + j);
      assert.equal(rep.matrix[i][j] !== 0, want);
    }
    rep.ids.forEach((u) => assert.deepEqual(rep.adj[u].map((e) => e.to), refNeighbours(g, u)));
    // memory identity: list entries = E (directed) or 2E (undirected)
    const entries = rep.ids.reduce((s, id) => s + rep.adj[id].length, 0);
    assert.equal(entries + rep.V, G.memory(rep.V, rep.E, directed).list);
    if (!directed) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) assert.equal(rep.has[i][j], rep.has[j][i]);
  }
});
test('build: weights are kept in matrix and list; edges are not duplicated', () => {
  const rep = G.build({ nodes: ['A', 'B', 'C'], edges: [['A', 'B', 7], ['B', 'A', 9], ['B', 'C']], directed: false });
  assert.equal(rep.E, 2);
  assert.equal(rep.matrix[0][1], 7); assert.equal(rep.matrix[1][0], 7);
  assert.equal(rep.weighted, true);
  assert.deepEqual(rep.adj.B, [{ to: 'A', w: 7 }, { to: 'C', w: 1 }]);
});
test('handshake lemma: degrees sum to 2E (undirected); in and out sums equal E (directed)', () => {
  const rng = VDSA.rng(3);
  for (let t = 0; t < 100; t++) {
    const g = randomGraph(rng, rng.int(1, 10), rng.int(0, 25), false);
    const rep = G.build(g), d = G.degrees(rep);
    assert.equal(d.sum, 2 * rep.E);
    const gd = { ...g, directed: true }, rd = G.build(gd), dd = G.degrees(rd);
    const sumIn = rd.ids.reduce((s, id) => s + dd.inDeg[id], 0), sumOut = rd.ids.reduce((s, id) => s + dd.outDeg[id], 0);
    assert.equal(sumIn, rd.E); assert.equal(sumOut, rd.E);
  }
});
test('memory and density', () => {
  assert.deepEqual(G.memory(10, 12, false), { matrix: 100, list: 34, edgeList: 24 });
  assert.deepEqual(G.memory(10, 12, true), { matrix: 100, list: 22, edgeList: 24 });
  assert.equal(G.density(4, 6, false), 1);
  assert.equal(G.density(4, 12, true), 1);
  assert.equal(G.density(1, 0, false), 0);
});

/* ------------------------------------------------------------------ structure */
const EXPLORE = { nodes: 'ABCDEFGHI'.split(''), edges: [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E'], ['E', 'F'], ['F', 'G'], ['H', 'I']] };
test('components, paths and cycles on the lesson graph', () => {
  const rep = G.build(EXPLORE);
  assert.deepEqual(G.components(rep), [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I']]);
  assert.deepEqual(G.shortestPath(rep, 'A', 'G'), ['A', 'C', 'E', 'F', 'G']);
  assert.equal(G.shortestPath(rep, 'A', 'H'), null);
  assert.deepEqual(G.shortestPath(rep, 'D', 'D'), ['D']);
  const cyc = G.simpleCycles(rep).map((c) => c.length).sort();
  assert.deepEqual(cyc, [3, 4, 5]);
});
test('directed paths respect direction; directed cycles', () => {
  const rep = G.build({ nodes: 'ABCDEFGHI'.split(''), edges: [['A', 'B'], ['A', 'C'], ['C', 'B'], ['B', 'D'], ['D', 'E'], ['E', 'C'], ['E', 'F'], ['F', 'G'], ['H', 'I']], directed: true });
  assert.deepEqual(G.shortestPath(rep, 'A', 'G'), ['A', 'B', 'D', 'E', 'F', 'G']);
  assert.equal(G.shortestPath(rep, 'G', 'A'), null);
  const cyc = G.simpleCycles(rep);
  assert.equal(cyc.length, 1);
  assert.deepEqual(cyc[0].slice().sort(), ['B', 'C', 'D', 'E']);
});
function refCycleCountUndirected(rep) {           // brute force over vertex subsets in every order (tiny graphs)
  const n = rep.V; let count = 0;
  const perm = (arr, used, cur) => {
    if (cur.length >= 3 && rep.has[cur[cur.length - 1]][cur[0]] && cur[0] === Math.min(...cur) && cur[1] < cur[cur.length - 1]) count++;
    for (let i = 0; i < n; i++) if (!used[i] && (cur.length === 0 || rep.has[cur[cur.length - 1]][i])) { used[i] = true; cur.push(i); perm(arr, used, cur); cur.pop(); used[i] = false; }
  };
  perm(null, [], []);
  return count;
}
test('simpleCycles matches brute force; K4 has 7 cycles', () => {
  const k4 = G.build({ nodes: 'ABCD'.split(''), edges: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'C'], ['B', 'D'], ['C', 'D']] });
  assert.equal(G.simpleCycles(k4).length, 7);
  const rng = VDSA.rng(11);
  for (let t = 0; t < 60; t++) {
    const rep = G.build(randomGraph(rng, rng.int(3, 7), rng.int(2, 11), false));
    assert.equal(G.simpleCycles(rep, 10000).length, refCycleCountUndirected(rep));
  }
  const tree = G.build({ nodes: 'ABC'.split(''), edges: [['A', 'B'], ['B', 'C']] });
  assert.equal(G.simpleCycles(tree).length, 0);
});
test('Königsberg: degrees 5,3,3,3 and no Euler walk', () => {
  assert.deepEqual(G.konigsbergDegrees(), { N: 3, I: 5, E: 3, S: 3 });
  // multigraph: the simple graph loses the parallel bridges, so test the rule on degrees directly
  const odd = Object.values(G.konigsbergDegrees()).filter((d) => d % 2).length;
  assert.equal(odd, 4);
  const path3 = G.build({ nodes: 'ABC'.split(''), edges: [['A', 'B'], ['B', 'C']] });
  assert.equal(G.eulerKind(path3), 'trail');
  const tri = G.build({ nodes: 'ABC'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] });
  assert.equal(G.eulerKind(tri), 'circuit');
  const star = G.build({ nodes: 'ABCD'.split(''), edges: [['A', 'B'], ['A', 'C'], ['A', 'D']] });
  assert.equal(G.eulerKind(star), 'none');
});

/* ------------------------------------------------------------------ operation traces */
function checkSteps(steps) {
  assert.ok(steps.length >= 2);
  const keys = JSON.stringify(Object.keys(steps[0].counters));
  let prevM = 0, prevL = 0;
  steps.forEach((s) => {
    assert.equal(JSON.stringify(Object.keys(s.counters)), keys);
    assert.ok(s.counters.matrix >= prevM && s.counters.list >= prevL, 'counters never decrease');
    prevM = s.counters.matrix; prevL = s.counters.list;
    assert.equal(typeof s.caption, 'string'); assert.ok(s.caption.length > 5);
  });
  assert.equal(last(steps).kind, 'done');
}
test('opsSteps edge: answers match the reference and counts are right', () => {
  const rng = VDSA.rng(77);
  for (let t = 0; t < 150; t++) {
    const n = rng.int(2, 8), directed = t % 3 === 0;
    const g = randomGraph(rng, n, rng.int(0, 16), directed);
    const rep = G.build(g);
    const u = rng.pick(rep.ids), v = rng.pick(rep.ids.filter((x) => x !== u));
    const steps = G.opsSteps(rep, 'edge', u, v);
    checkSteps(steps);
    const fin = last(steps);
    const want = refEdgeSet(g).has(u + '>' + v);
    assert.equal(fin.mHit.length === 1, want);
    assert.equal(fin.counters.matrix, 1);                       // matrix: always exactly one read
    const items = rep.adj[u].map((e) => e.to);
    const pos = items.indexOf(v);
    assert.equal(fin.counters.list, want ? pos + 1 : items.length);
    assert.equal(fin.lHit.length, want ? 1 : 0);
  }
});
test('opsSteps neighbours: row scan vs list read', () => {
  const rng = VDSA.rng(78);
  for (let t = 0; t < 100; t++) {
    const g = randomGraph(rng, rng.int(1, 9), rng.int(0, 20), t % 2 === 0);
    const rep = G.build(g);
    const u = rng.pick(rep.ids);
    const steps = G.opsSteps(rep, 'neighbours', u);
    checkSteps(steps);
    const fin = last(steps);
    assert.equal(fin.counters.matrix, rep.V);
    assert.equal(fin.counters.list, rep.adj[u].length);
    assert.deepEqual(fin.mHit.map((c) => rep.ids[c[1]]), refNeighbours(g, u));
    assert.deepEqual(fin.lHit.map((c) => rep.adj[u][c[1]].to), refNeighbours(g, u));
  }
});
test('opsSteps all: V squared vs V-plus-E', () => {
  const rep = G.build({ nodes: 'ABCDE'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'D']] });
  const steps = G.opsSteps(rep, 'all');
  checkSteps(steps);
  const fin = last(steps);
  assert.equal(fin.counters.matrix, 25);
  assert.equal(fin.counters.list, 6);                             // 2E entries
  assert.equal(fin.mHit.length, 6);
  const dir = G.build({ nodes: 'ABC'.split(''), edges: [['A', 'B'], ['B', 'C']], directed: true });
  assert.equal(last(G.opsSteps(dir, 'all')).counters.list, 2);
  const one = G.build({ nodes: ['A'], edges: [] });                // single vertex, no edges
  const f1 = last(G.opsSteps(one, 'all'));
  assert.equal(f1.counters.matrix, 1); assert.equal(f1.counters.list, 0);
});
test('opsSteps edge: empty list, and first-entry hit', () => {
  const rep = G.build({ nodes: ['A', 'B', 'C'], edges: [['B', 'C']] });
  const s = G.opsSteps(rep, 'edge', 'A', 'B');
  assert.equal(last(s).counters.list, 0);
  assert.ok(s.some((x) => /empty/.test(x.caption)));
  const t = G.opsSteps(rep, 'edge', 'B', 'C');
  assert.equal(last(t).counters.list, 1);
});

/* ------------------------------------------------------------------ bipartite */
test('biColorSteps agrees with brute force on random graphs', () => {
  const rng = VDSA.rng(5);
  for (let t = 0; t < 200; t++) {
    const n = rng.int(1, 8);
    const g = randomGraph(rng, n, rng.int(0, 11), false);
    // restrict the check to the component of the first vertex
    const rep = G.build(g);
    const comp = G.components(rep).find((c) => c.includes(rep.ids[0]));
    const sub = { nodes: comp, edges: g.edges.filter(([a, b]) => comp.includes(a) && comp.includes(b)) };
    const steps = G.biColorSteps(sub, rep.ids[0]);
    const fin = last(steps);
    const bip = G.isBipartiteRef(sub);
    assert.equal(fin.kind === 'done', bip, JSON.stringify(sub));
    assert.equal(fin.kind === 'conflict', !bip);
    if (bip) {                                                    // colouring is proper
      const r = G.build(sub);
      r.edgeList.forEach((e) => assert.notEqual(fin.colour[e.from], fin.colour[e.to]));
      assert.equal(fin.columns, true);
    } else {
      assert.equal(fin.colour[fin.conflict[0]], fin.colour[fin.conflict[1]]);
    }
  }
});
test('biColorSteps: even ring is bipartite, ring with a chord is not; single vertex', () => {
  const ring = { nodes: 'ABCDEF'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A']] };
  assert.equal(last(G.biColorSteps(ring, 'A')).kind, 'done');
  const chord = { nodes: ring.nodes, edges: ring.edges.concat([['A', 'C']]) };
  const s = G.biColorSteps(chord, 'A');
  assert.equal(last(s).kind, 'conflict');
  assert.deepEqual(last(s).conflict.slice().sort(), ['B', 'C']);
  const one = G.biColorSteps({ nodes: ['X'], edges: [] }, 'X');
  assert.equal(last(one).kind, 'done');
  assert.equal(G.biColorSteps({ nodes: [], edges: [] }).length, 1);
  const keys = JSON.stringify(Object.keys(s[0].counters));
  s.forEach((x) => assert.equal(JSON.stringify(Object.keys(x.counters)), keys));
});

/* ------------------------------------------------------------------ implicit grid graph */
test('gridNeighbours: corners, walls, diagonals', () => {
  assert.deepEqual(G.gridNeighbours(3, 3, [], 0, 0, false), [[0, 1], [1, 0]]);
  assert.equal(G.gridNeighbours(3, 3, [], 1, 1, false).length, 4);
  assert.equal(G.gridNeighbours(3, 3, [], 1, 1, true).length, 8);
  assert.equal(G.gridNeighbours(3, 3, [], 0, 0, true).length, 3);
  assert.deepEqual(G.gridNeighbours(3, 3, ['0,1'], 0, 0, false), [[1, 0]]);
  assert.deepEqual(G.gridNeighbours(3, 3, { '1,1': true }, 1, 1, false), []);      // a wall has no neighbours
  assert.deepEqual(G.gridNeighbours(1, 1, [], 0, 0, true), []);
  // symmetry: v in N(u) iff u in N(v)
  const walls = ['1,1', '0,2'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) G.gridNeighbours(3, 4, walls, r, c, true).forEach(([a, b]) => {
    assert.ok(G.gridNeighbours(3, 4, walls, a, b, true).some((p) => p[0] === r && p[1] === c));
  });
});
