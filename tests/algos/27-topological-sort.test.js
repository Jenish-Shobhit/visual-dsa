// Lesson 27 · Topological sort & cycles — step generator tests.
// Run: node --test tests/algos/27-topological-sort.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const T = require(path.join(root, 'js/algos/27-topological-sort.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ fixtures */
const COURSES = {
  nodes: ['CS1', 'MATH', 'DISC', 'DS', 'ALG', 'OS', 'DB', 'NET', 'ML'],
  edges: [['CS1', 'DS'], ['MATH', 'DISC'], ['DISC', 'ALG'], ['DS', 'ALG'], ['DS', 'OS'], ['DS', 'DB'], ['OS', 'NET'], ['ALG', 'ML'], ['MATH', 'ML']]
};
const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ straightforward references */
function refEdges(g) {
  const seen = new Set(), out = [];
  (g.edges || []).forEach(([a, b]) => { const k = a + '\u0000' + b; if (!seen.has(k)) { seen.add(k); out.push([String(a), String(b)]); } });
  return out;
}
function refIds(g) {
  const ids = new Set((g.nodes || []).map(String));
  refEdges(g).forEach(([a, b]) => { ids.add(a); ids.add(b); });
  return [...ids];
}
/* brute-force reachability closure (Warshall) */
function refReach(g) {
  const ids = refIds(g), R = {};
  ids.forEach((a) => { R[a] = {}; ids.forEach((b) => { R[a][b] = a === b; }); });
  refEdges(g).forEach(([a, b]) => { R[a][b] = true; });
  ids.forEach((k) => ids.forEach((i) => ids.forEach((j) => { if (R[i][k] && R[k][j]) R[i][j] = true; })));
  return { ids, R };
}
function refCyclic(g) {
  const { ids, R } = refReach(g);
  // a cycle exists iff some vertex reaches itself through at least one edge
  return refEdges(g).some(([a, b]) => R[b][a]) || ids.some((a) => refEdges(g).some(([x, y]) => x === a && y === a));
}
function refSccGroups(g) {
  const { ids, R } = refReach(g);
  const groups = [], done = {};
  ids.slice().sort(T.natCmp).forEach((a) => {
    if (done[a]) return;
    const grp = ids.filter((b) => R[a][b] && R[b][a]);
    grp.forEach((x) => { done[x] = true; });
    groups.push(grp.sort(T.natCmp));
  });
  return groups.sort((x, y) => T.natCmp(x[0], y[0]));
}
function refOrderCount(g) {
  // enumerate every permutation for tiny graphs
  const ids = refIds(g);
  let count = 0;
  (function rec(prefix, rest) {
    if (!rest.length) { if (T.isTopoOrder(g, prefix).valid) count++; return; }
    rest.forEach((x, i) => rec(prefix.concat(x), rest.slice(0, i).concat(rest.slice(i + 1))));
  }([], ids));
  return count;
}
function randomDigraph(n, m, rng, loops) {
  const nodes = [], edges = [];
  for (let i = 0; i < n; i++) nodes.push('N' + i);
  for (let k = 0; k < m; k++) {
    const a = rng.int(0, n - 1), b = rng.int(0, n - 1);
    if (a === b && !loops) continue;
    edges.push(['N' + a, 'N' + b]);
  }
  return { nodes, edges };
}
function assertSnapshotContract(steps) {
  assert.ok(steps.length > 0);
  const keys = Object.keys(steps[0].counters).join();
  steps.forEach((st) => {
    assert.equal(typeof st.caption, 'string');
    assert.equal(Object.keys(st.counters).join(), keys, 'counters keys are stable');
  });
}

/* ------------------------------------------------------------------ parsing */
test('parseEdgeList: arrows, chains, lone names, separators', () => {
  const r = T.parseEdgeList('A>B, B->C>D; E\nF → A');
  assert.equal(r.error, null);
  assert.deepEqual(r.values.nodes, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(r.values.edges, [['A', 'B'], ['B', 'C'], ['C', 'D'], ['F', 'A']]);
});
test('parseEdgeList: duplicates merged, self-loop kept', () => {
  const r = T.parseEdgeList('A>B, A>B, C>C');
  assert.deepEqual(r.values.edges, [['A', 'B'], ['C', 'C']]);
});
test('parseEdgeList: friendly errors', () => {
  assert.match(T.parseEdgeList('').error, /at least one/i);
  assert.match(T.parseEdgeList('   ').error, /at least one/i);
  assert.match(T.parseEdgeList('A>').error, /missing/i);
  assert.match(T.parseEdgeList('A>>B').error, /missing/i);
  assert.match(T.parseEdgeList('A>b!').error, /character/i);
  assert.match(T.parseEdgeList('A<B').error, /other|comes before/i);
  assert.match(T.parseEdgeList('averyveryverylongname>B').error, /8 characters/);
  const many = Array.from({ length: 13 }, (_, i) => 'N' + i).join(',');
  assert.match(T.parseEdgeList(many).error, /13 vertices/);
  const edges = Array.from({ length: 25 }, (_, i) => 'A' + i + '>B' + i).join(',');
  assert.match(T.parseEdgeList(edges, { maxNodes: 60 }).error, /25 dependencies/);
});

/* ------------------------------------------------------------------ isTopoOrder / countOrders */
test('isTopoOrder: valid, violations, incomplete, extra, duplicates', () => {
  const ok = T.isTopoOrder(COURSES, ['CS1', 'MATH', 'DS', 'DISC', 'ALG', 'OS', 'DB', 'NET', 'ML']);
  assert.equal(ok.valid, true);
  const bad = T.isTopoOrder(COURSES, ['DS', 'CS1', 'MATH', 'DISC', 'ALG', 'OS', 'DB', 'NET', 'ML']);
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.violations.map((v) => v.key), ['CS1-DS']);
  assert.equal(T.isTopoOrder(COURSES, ['CS1']).complete, false);
  assert.deepEqual(T.isTopoOrder(COURSES, ['CS1', 'ZZZ']).extra, ['ZZZ']);
  assert.deepEqual(T.isTopoOrder(COURSES, ['CS1', 'CS1']).duplicates, ['CS1']);
  assert.equal(T.isTopoOrder({ nodes: [], edges: [] }, []).valid, true);
  assert.equal(T.isTopoOrder({ nodes: ['A'], edges: [['A', 'A']] }, ['A']).valid, false, 'self loop always violates');
});
test('countOrders matches brute force on tiny graphs and known values', () => {
  assert.equal(T.countOrders({ nodes: [], edges: [] }), 1);
  assert.equal(T.countOrders({ nodes: ['A'], edges: [] }), 1);
  assert.equal(T.countOrders({ nodes: ['A', 'B', 'C', 'D'], edges: [] }), 24);
  assert.equal(T.countOrders({ nodes: 'ABCD'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'D']] }), 1);
  assert.equal(T.countOrders({ nodes: 'ABC'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] }), 0);
  assert.equal(T.countOrders({ nodes: ['A'], edges: [['A', 'A']] }), 0);
  const rng = VDSA.rng(2701);
  for (let t = 0; t < 30; t++) {
    const n = rng.int(1, 6);
    const g = T.randomDag(n, rng.int(0, n * (n - 1) / 2), rng);
    assert.equal(T.countOrders(g), refOrderCount(g));
  }
  assert.equal(T.countOrders({ nodes: Array.from({ length: 21 }, (_, i) => 'N' + i), edges: [] }), null);
});
test('countOrders on the course graph is stable', () => {
  const c = T.countOrders(COURSES);
  assert.ok(c > 1 && c < 362880);
  assert.equal(c, refOrderCount(COURSES));
});
test('ordersAsEdgesGrow starts at n! and ends at 1 for a full DAG', () => {
  const r = T.ordersAsEdgesGrow(6, VDSA.rng(5));
  assert.equal(r[0], 720);
  assert.equal(last(r), 1);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] <= r[i - 1], 'never grows');
});

/* ------------------------------------------------------------------ Kahn */
function checkKahn(g, pick) {
  const steps = T.kahn(g, { pick });
  assertSnapshotContract(steps);
  const end = last(steps);
  const cyclic = refCyclic(g);
  if (!cyclic) {
    assert.equal(end.kind, 'layered');
    assert.equal(end.acyclic, true);
    assert.equal(end.layered, true);
    assert.equal(T.isTopoOrder(g, end.order).valid, true, 'order is a valid topological order');
    assert.equal(end.order.length, refIds(g).length);
  } else {
    assert.equal(end.kind, 'cycle');
    assert.equal(end.acyclic, false);
    assert.ok(end.order.length < refIds(g).length);
    // the reported cycle is a real cycle
    const es = new Set(refEdges(g).map(([a, b]) => a + '-' + b));
    end.cycle.edges.forEach((k) => assert.ok(es.has(k), 'cycle edge exists: ' + k));
    end.cycle.nodes.forEach((id, i) => assert.ok(es.has(id + '-' + end.cycle.nodes[(i + 1) % end.cycle.nodes.length])));
    // stuck vertices are exactly the vertices not emitted
    assert.deepEqual(end.stuck.slice().sort(T.natCmp), refIds(g).filter((id) => !end.order.includes(id)).sort(T.natCmp));
  }
  // in-degree badges are truthful at every step
  steps.forEach((st) => {
    const emitted = new Set(st.order);
    const removed = new Set(Object.keys(st.edges).filter((k) => st.edges[k] === 'muted'));
    refIds(g).forEach((id) => {
      // the badge is the number of incoming arrows that have not been removed yet
      const expect = refEdges(g).filter(([a, b]) => b === id && st.edges[a + '-' + b] !== 'muted').length;
      assert.equal(st.indeg[id], expect, 'indeg of ' + id + ' at step ' + st.kind);
    });
    removed.forEach((k) => assert.ok(emitted.has(k.split('-')[0]), 'an arrow is removed only after its tail is placed: ' + k));
    assert.equal(st.counters.removed, removed.size);
    assert.equal(st.counters.emitted, st.order.length);
  });
  return steps;
}
test('Kahn: course graph, each ready-set policy', () => {
  ['fifo', 'lifo', 'alpha'].forEach((p) => checkKahn(COURSES, p));
  const s = T.kahn(COURSES);
  assert.equal(s[0].kind, 'init');
  assert.equal(s[1].kind, 'sources');
  assert.deepEqual(s[1].ready, ['CS1', 'MATH']);
});
test('Kahn: policies really differ, alpha gives the smallest names first', () => {
  const g = { nodes: 'ABCD'.split(''), edges: [['A', 'C'], ['B', 'D']] };
  const f = last(T.kahn(g, { pick: 'fifo' })).order.join('');
  const l = last(T.kahn(g, { pick: 'lifo' })).order.join('');
  assert.equal(f, 'ABCD');
  assert.equal(l, 'BDAC');
  const a = last(T.kahn({ nodes: ['B', 'A', 'C'], edges: [['C', 'A']] }, { pick: 'alpha' })).order.join('');
  assert.equal(a, 'BCA');
});
test('Kahn: empty, single, isolated, chain, self-loop, two-cycle', () => {
  const e = T.kahn({ nodes: [], edges: [] });
  assert.equal(e.length, 1); assert.equal(e[0].kind, 'empty');
  assert.deepEqual(last(T.kahn({ nodes: ['A'], edges: [] })).order, ['A']);
  assert.deepEqual(last(T.kahn({ nodes: ['C', 'B', 'A'], edges: [] })).order, ['A', 'B', 'C']);
  assert.deepEqual(last(T.kahn({ nodes: [], edges: [['A', 'B'], ['B', 'C']] })).order, ['A', 'B', 'C']);
  const sl = T.kahn({ nodes: ['A'], edges: [['A', 'A']] });
  assert.equal(last(sl).kind, 'cycle');
  assert.deepEqual(last(sl).cycle.nodes, ['A']);
  const tc = T.kahn({ nodes: [], edges: [['A', 'B'], ['B', 'A']] });
  assert.equal(last(tc).cycle.nodes.length, 2);
  assert.equal(tc[1].kind, 'sources');
  assert.deepEqual(tc[1].ready, []);
});
test('Kahn: a cycle hanging off a DAG leaves downstream vertices stuck but reports the loop', () => {
  const g = { nodes: [], edges: [['S', 'A'], ['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'T']] };
  const steps = checkKahn(g);
  const end = last(steps);
  assert.deepEqual(end.order, ['S']);
  assert.deepEqual(end.stuck.sort(), ['A', 'B', 'C', 'T']);
  assert.deepEqual(end.cycle.nodes.slice().sort(), ['A', 'B', 'C']);
  assert.equal(end.states.T, 'compare');
  assert.equal(end.states.A, 'error');
});
test('Kahn: random DAGs and random digraphs against references', () => {
  const rng = VDSA.rng(2702);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(1, 10);
    const dag = T.randomDag(n, rng.int(0, Math.min(24, n * (n - 1) / 2)), rng);
    ['fifo', 'lifo', 'alpha'].forEach((p) => checkKahn(dag, p));
    const dg = randomDigraph(n, rng.int(0, 16), rng, t % 3 === 0);
    ['fifo', 'alpha'].forEach((p) => checkKahn(dg, p));
  }
});
test('Kahn: the "layered" morph step only appears for acyclic graphs and the order length matches', () => {
  const dag = T.kahn(COURSES);
  assert.equal(dag.filter((s) => s.layered).length, 1);
  const cyc = T.kahn({ nodes: [], edges: [['A', 'B'], ['B', 'A']] });
  assert.equal(cyc.filter((s) => s.layered).length, 0);
});
test('Kahn steps are immutable snapshots', () => {
  const steps = T.kahn(COURSES);
  const frozen = JSON.stringify(steps[2]);
  T.kahn(COURSES);
  assert.equal(JSON.stringify(steps[2]), frozen);
  assert.notEqual(steps[2].indeg, steps[3].indeg);
});
test('Kahn: every line label exists in the lab code (labels used by the generator)', () => {
  const labels = new Set();
  [COURSES, { nodes: [], edges: [['A', 'B'], ['B', 'A']] }].forEach((g) => T.kahn(g).forEach((s) => { if (s.line) labels.add(s.line); }));
  assert.deepEqual([...labels].sort(), ['dec', 'done', 'init', 'ready', 'sources', 'stuck', 'take']);
});

/* ------------------------------------------------------------------ DFS topological order */
function checkDfs(g) {
  const steps = T.dfsTopo(g);
  assertSnapshotContract(steps);
  const end = last(steps);
  const cyclic = refCyclic(g);
  if (!cyclic) {
    assert.equal(end.kind, 'done');
    assert.equal(end.acyclic, true);
    assert.equal(T.isTopoOrder(g, end.order).valid, true);
    assert.equal(end.order.length, refIds(g).length);
    // finish times: f[u] > f[v] for every edge u -> v
    refEdges(g).forEach(([u, v]) => assert.ok(end.fin[u] > end.fin[v], u + '->' + v));
    assert.ok(!steps.some((s) => s.kind === 'back'));
  } else {
    assert.equal(end.kind, 'cycle');
    assert.equal(end.acyclic, false);
    const back = steps.filter((s) => s.kind === 'back');
    assert.equal(back.length, 1, 'stops at the first back edge');
    const es = new Set(refEdges(g).map(([a, b]) => a + '-' + b));
    back[0].cycle.nodes.forEach((id, i) => assert.ok(es.has(id + '-' + back[0].cycle.nodes[(i + 1) % back[0].cycle.nodes.length])));
    // the back edge points at a grey vertex
    assert.equal(back[0].color[back[0].pulse.to], 'grey');
  }
  // colour and stack invariants
  steps.forEach((st) => {
    st.stack.forEach((id) => assert.equal(st.color[id], 'grey'));
    Object.keys(st.color).forEach((id) => { if (st.color[id] === 'grey') assert.ok(st.stack.includes(id)); });
    st.finished.forEach((id) => assert.equal(st.color[id], 'black'));
  });
  return steps;
}
test('DFS topo: course graph', () => {
  const steps = checkDfs(COURSES);
  assert.equal(steps[0].kind, 'init');
  assert.ok(steps.some((s) => s.kind === 'skip'), 'has an edge to a finished vertex');
});
test('DFS topo: edge classes are truthful', () => {
  const g = { nodes: [], edges: [['A', 'B'], ['A', 'C'], ['B', 'C']] };
  const steps = checkDfs(g);
  const looks = steps.filter((s) => s.pulse).map((s) => s.pulse.from + s.pulse.to + ':' + s.edgeClass);
  assert.deepEqual(looks, ['AB:tree', 'BC:tree', 'AC:forward']);
  const g2 = { nodes: [], edges: [['A', 'C'], ['B', 'C']] };
  const looks2 = T.dfsTopo(g2).filter((s) => s.pulse).map((s) => s.pulse.from + s.pulse.to + ':' + s.edgeClass);
  assert.deepEqual(looks2, ['AC:tree', 'BC:cross']);
});
test('DFS topo: cycles, self-loops, empty, single, disconnected', () => {
  const c = checkDfs({ nodes: [], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] });
  assert.deepEqual(last(c.filter((s) => s.kind === 'back')).cycle.nodes, ['A', 'B', 'C']);
  const sl = checkDfs({ nodes: ['A'], edges: [['A', 'A']] });
  assert.deepEqual(sl.find((s) => s.kind === 'back').cycle.nodes, ['A']);
  const e = T.dfsTopo({ nodes: [], edges: [] });
  assert.equal(e[0].kind, 'empty');
  assert.deepEqual(last(T.dfsTopo({ nodes: ['A'], edges: [] })).order, ['A']);
  const dis = checkDfs({ nodes: ['A', 'B', 'C', 'D'], edges: [['A', 'B'], ['C', 'D']] });
  assert.ok(dis.some((s) => s.kind === 'scan'));
});
test('DFS topo: random DAGs and digraphs against references', () => {
  const rng = VDSA.rng(2703);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(1, 10);
    checkDfs(T.randomDag(n, rng.int(0, Math.min(24, n * (n - 1) / 2)), rng));
    checkDfs(randomDigraph(n, rng.int(0, 16), rng, t % 4 === 0));
  }
});
test('DFS topo: the cycle it reports matches Kahn getting stuck (both agree on acyclicity)', () => {
  const rng = VDSA.rng(2704);
  for (let t = 0; t < 80; t++) {
    const g = randomDigraph(rng.int(1, 9), rng.int(0, 14), rng, true);
    const k = last(T.kahn(g)), d = last(T.dfsTopo(g));
    assert.equal(k.acyclic, d.acyclic);
    assert.equal(T.findCycle(g) === null, k.acyclic);
  }
});
test('findCycle returns a genuine cycle', () => {
  const g = { nodes: [], edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'B'], ['A', 'E']] };
  const c = T.findCycle(g);
  assert.deepEqual(c.slice().sort(), ['B', 'C', 'D']);
  assert.equal(T.findCycle(COURSES), null);
  assert.deepEqual(T.findCycle({ nodes: [], edges: [['X', 'X']] }), ['X']);
});
test('DFS: every line label used by the generator', () => {
  const labels = new Set();
  [COURSES, { nodes: [], edges: [['A', 'B'], ['B', 'A']] }, { nodes: ['A', 'B'], edges: [] }].forEach((g) => T.dfsTopo(g).forEach((s) => { if (s.line) labels.add(s.line); }));
  assert.deepEqual([...labels].sort(), ['back', 'done', 'edge', 'enter', 'finish', 'init', 'scan']);
});

/* ------------------------------------------------------------------ Kosaraju */
function checkScc(g) {
  const steps = T.kosaraju(g);
  assertSnapshotContract(steps);
  const end = last(steps);
  const want = refSccGroups(g);
  const got = end.comps.map((c) => c.slice().sort(T.natCmp)).sort((a, b) => T.natCmp(a[0], b[0]));
  assert.deepEqual(got, want, 'components match brute-force mutual reachability');
  assert.deepEqual(got, T.tarjanScc(g).comps, 'and Tarjan');
  const c = end.condensation;
  assert.equal(c.nodes.length, want.length);
  // each vertex in exactly one component
  const all = c.nodes.reduce((a, x) => a.concat(x.members), []).sort(T.natCmp);
  assert.deepEqual(all, refIds(g).sort(T.natCmp));
  // condensation is a DAG and edges go from lower to higher component number (Kosaraju finds them source first)
  const cg = { nodes: c.nodes.map((x) => x.id), edges: c.edges };
  assert.equal(refCyclic(cg), false);
  c.edges.forEach(([a, b]) => assert.ok(Number(a.slice(1)) < Number(b.slice(1)), a + ' before ' + b));
  assert.equal(T.isTopoOrder(cg, c.order).valid, true);
  // every original cross-component edge is represented
  const compOf = {};
  c.nodes.forEach((x) => x.members.forEach((m) => { compOf[m] = x.id; }));
  const ce = new Set(c.edges.map(([a, b]) => a + '-' + b));
  refEdges(g).forEach(([a, b]) => { if (compOf[a] !== compOf[b]) assert.ok(ce.has(compOf[a] + '-' + compOf[b])); });
  assert.equal(c.edges.length, ce.size, 'no duplicate condensation edges');
  return steps;
}
test('Kosaraju: a classic three-component graph', () => {
  const g = { nodes: [], edges: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['B', 'D'], ['D', 'E'], ['E', 'D'], ['E', 'F'], ['F', 'G'], ['G', 'F']] };
  const steps = checkScc(g);
  assert.equal(last(steps).condensation.nodes.length, 3);
  assert.deepEqual(last(steps).comps[0].slice().sort(), ['A', 'B', 'C']);
});
test('Kosaraju: DAG gives singleton components, cycle gives one', () => {
  assert.equal(last(checkScc(COURSES)).condensation.nodes.length, 9);
  assert.equal(last(checkScc({ nodes: [], edges: [['A', 'B'], ['B', 'C'], ['C', 'A']] })).condensation.nodes.length, 1);
});
test('Kosaraju: empty, single, self-loop, isolated', () => {
  assert.equal(T.kosaraju({ nodes: [], edges: [] })[0].kind, 'empty');
  checkScc({ nodes: ['A'], edges: [] });
  checkScc({ nodes: ['A'], edges: [['A', 'A']] });
  checkScc({ nodes: ['A', 'B', 'C'], edges: [] });
});
test('Kosaraju: random digraphs (including self-loops) against brute force', () => {
  const rng = VDSA.rng(2705);
  for (let t = 0; t < 120; t++) {
    const n = rng.int(1, 10);
    checkScc(randomDigraph(n, rng.int(0, 22), rng, t % 3 === 0));
  }
});
test('Kosaraju: phases advance 1, 2, 3 and pass 2 pops the finish stack from the top', () => {
  const g = { nodes: [], edges: [['A', 'B'], ['B', 'A'], ['B', 'C']] };
  const steps = T.kosaraju(g);
  const phases = steps.map((s) => s.phase);
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i] >= phases[i - 1]);
  const flip = steps.find((s) => s.kind === 'flip');
  assert.equal(flip.transposed, true);
  assert.deepEqual(flip.remaining, flip.finished);
  assert.equal(steps.find((s) => s.kind === 'take').current, last(flip.finished));
});
test('Kosaraju: line labels used', () => {
  const labels = new Set();
  T.kosaraju({ nodes: [], edges: [['A', 'B'], ['B', 'A'], ['B', 'C'], ['D', 'C']] }).forEach((s) => { if (s.line) labels.add(s.line); });
  assert.deepEqual([...labels].sort(), ['comp', 'condense', 'enter1', 'finish1', 'flip', 'init', 'pop', 'visit']);
});

/* ------------------------------------------------------------------ order generators */
test('randomValidOrder: valid for DAGs, null with a cycle, reproducible', () => {
  const a = T.randomValidOrder(COURSES, VDSA.rng(9)), b = T.randomValidOrder(COURSES, VDSA.rng(9));
  assert.deepEqual(a, b);
  assert.equal(T.isTopoOrder(COURSES, a).valid, true);
  const rng = VDSA.rng(2706);
  for (let t = 0; t < 40; t++) {
    const g = T.randomDag(rng.int(1, 10), rng.int(0, 20), rng);
    assert.equal(T.isTopoOrder(g, T.randomValidOrder(g, rng)).valid, true);
  }
  assert.equal(T.randomValidOrder({ nodes: [], edges: [['A', 'B'], ['B', 'A']] }, VDSA.rng(1)), null);
});
test('randomDag: acyclic, sizes respected, deterministic', () => {
  const g = T.randomDag(8, 12, VDSA.rng(3));
  assert.equal(g.nodes.length, 8);
  assert.equal(g.edges.length, 12);
  assert.equal(refCyclic(g), false);
  assert.deepEqual(g, T.randomDag(8, 12, VDSA.rng(3)));
  assert.equal(T.randomDag(4, 100, VDSA.rng(3)).edges.length, 6);
  assert.equal(T.isTopoOrder(g, g.hidden).valid, true);
});

/* ------------------------------------------------------------------ levels, critical path, counts */
test('kahnLevels: rounds equal the longest chain, in any input order', () => {
  const r = T.kahnLevels(COURSES);
  assert.deepEqual(r.levels[0], ['CS1', 'MATH']);
  assert.equal(r.cyclic, false);
  // reference longest path in vertices
  const ids = refIds(COURSES), memo = {};
  const len = (v) => memo[v] || (memo[v] = 1 + Math.max(0, ...refEdges(COURSES).filter(([, b]) => b === v).map(([a]) => len(a))));
  assert.equal(r.rounds, Math.max(...ids.map(len)));
  assert.equal(T.kahnLevels({ nodes: [], edges: [['A', 'B'], ['B', 'A']] }).cyclic, true);
  assert.deepEqual(T.kahnLevels({ nodes: [], edges: [] }).levels, []);
});
test('longestPath: earliest finish times match a memoised reference and the path is critical', () => {
  const w = { CS1: 3, MATH: 4, DISC: 3, DS: 4, ALG: 5, OS: 4, DB: 2, NET: 3, ML: 6 };
  const steps = T.longestPath(COURSES, w);
  const end = last(steps);
  const memo = {};
  const ef = (v) => memo[v] !== undefined ? memo[v] : (memo[v] = w[v] + Math.max(0, ...refEdges(COURSES).filter(([, b]) => b === v).map(([a]) => ef(a))));
  refIds(COURSES).forEach((id) => assert.equal(end.ef[id], ef(id), id));
  const total = Math.max(...refIds(COURSES).map(ef));
  assert.equal(end.path.reduce((s, id) => s + w[id], 0), total, 'the critical path length is the project length');
  // the path is a real chain of edges
  const es = new Set(refEdges(COURSES).map(([a, b]) => a + '-' + b));
  end.path.slice(1).forEach((id, i) => assert.ok(es.has(end.path[i] + '-' + id)));
  assert.equal(end.kind, 'path');
});
test('longestPath: cycles, empty, single, default weights', () => {
  assert.equal(last(T.longestPath({ nodes: [], edges: [['A', 'B'], ['B', 'A']] })).kind, 'cyclic');
  assert.equal(T.longestPath({ nodes: [], edges: [] })[0].kind, 'empty');
  const one = last(T.longestPath({ nodes: ['A'], edges: [] }, { A: 7 }));
  assert.deepEqual(one.path, ['A']);
  assert.equal(one.ef.A, 7);
  assert.equal(last(T.longestPath({ nodes: [], edges: [['A', 'B']] })).ef.B, 2);
});
test('operation counts: Kahn and DFS are linear in V + E', () => {
  const rng = VDSA.rng(2707);
  for (let t = 0; t < 30; t++) {
    const n = rng.int(2, 40);
    const g = T.randomDag(n, rng.int(0, Math.min(60, n * (n - 1) / 2)), rng);
    const k = T.kahnResult(g), d = T.dfsResult(g);
    assert.equal(k.steps, 2 * g.edges.length + n);
    assert.equal(d.steps, g.edges.length + n);
    assert.equal(k.cyclic, false); assert.equal(d.cyclic, false);
    assert.deepEqual(k.order.length, n);
    assert.equal(T.isTopoOrder(g, d.order).valid, true);
  }
  const cyc = { nodes: [], edges: [['A', 'B'], ['B', 'A']] };
  assert.equal(T.kahnResult(cyc).cyclic, true);
  assert.equal(T.dfsResult(cyc).cyclic, true);
});
