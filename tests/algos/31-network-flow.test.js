// Lesson 31 · Max flow & min cut — step generator tests.
// Run: node --test tests/algos/31-network-flow.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const NF = require(path.join(root, 'js/algos/31-network-flow.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ fixtures */
const MAIN = NF.parseNetwork('s-a:7, s-b:7, a-c:7, a-d:1, b-c:3, b-d:3, c-t:8, d-t:7').values;
const DIAMOND = NF.parseNetwork('s-a:3, s-b:2, a-b:5, a-t:2, b-t:3').values;
const last = (a) => a[a.length - 1];

/* ------------------------------------------------------------------ straightforward references */
/* Max flow on a capacity matrix by plain DFS Ford-Fulkerson (a different algorithm and code path). */
function refMaxFlow(net) {
  const ids = [];
  net.nodes.forEach((n) => ids.push(String(typeof n === 'object' ? n.id : n)));
  const idx = {};
  ids.forEach((id, i) => { idx[id] = i; });
  const n = ids.length;
  const cap = Array.from({ length: n }, () => new Array(n).fill(0));
  net.edges.forEach((e) => {
    const [u, v, c] = Array.isArray(e) ? e : [e.from, e.to, e.cap];
    cap[idx[u]][idx[v]] += c;
  });
  const s = idx[net.source], t = idx[net.sink];
  let flow = 0;
  for (;;) {
    const seen = new Array(n).fill(false);
    const dfs = (u, f) => {
      if (u === t) return f;
      seen[u] = true;
      for (let v = 0; v < n; v++) {
        if (!seen[v] && cap[u][v] > 0) {
          const d = dfs(v, Math.min(f, cap[u][v]));
          if (d > 0) { cap[u][v] -= d; cap[v][u] += d; return d; }
        }
      }
      return 0;
    };
    const d = dfs(s, Infinity);
    if (d === 0) return flow;
    flow += d;
  }
}
/* Minimum cut by trying every subset S with s in S and t not in S. */
function refMinCut(net) {
  const ids = net.nodes.map((n) => String(typeof n === 'object' ? n.id : n));
  const others = ids.filter((id) => id !== net.source && id !== net.sink);
  let best = Infinity;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const S = new Set([net.source]);
    others.forEach((id, i) => { if (mask & (1 << i)) S.add(id); });
    let v = 0;
    net.edges.forEach((e) => {
      const [u, w, c] = Array.isArray(e) ? e : [e.from, e.to, e.cap];
      if (S.has(u) && !S.has(w)) v += c;
    });
    best = Math.min(best, v);
  }
  return best;
}
/* Maximum bipartite matching size by trying all assignments (small inputs). */
function refMatching(workers, jobs, pairs) {
  const adj = {};
  workers.forEach((w) => { adj[w] = []; });
  pairs.forEach(([w, j]) => adj[w].push(j));
  let best = 0;
  const go = (i, used, size) => {
    if (i === workers.length) { best = Math.max(best, size); return; }
    go(i + 1, used, size);
    adj[workers[i]].forEach((j) => { if (!used.has(j)) { used.add(j); go(i + 1, used, size + 1); used.delete(j); } });
  };
  go(0, new Set(), 0);
  return best;
}
function randomNet(rng, n, m, maxCap) {
  const ids = ['s', 't'];
  for (let i = 0; i < n - 2; i++) ids.push('v' + i);
  const edges = [];
  const seen = new Set();
  for (let k = 0; k < m; k++) {
    const u = rng.pick(ids), v = rng.pick(ids);
    if (u === v || seen.has(u + '-' + v)) continue;
    seen.add(u + '-' + v);
    edges.push({ from: u, to: v, cap: rng.int(0, maxCap) });
  }
  return { nodes: ids, edges, source: 's', sink: 't' };
}
const FLOW_IDS = new Set(['init', 'bfs', 'found', 'bottleneck', 'augment', 'cut']);
const LINES = new Set(['init', 'loop', 'bfs', 'nopath', 'bottleneck', 'augment', 'value', 'cut']);

/* ------------------------------------------------------------------ the lesson network */
test('lesson network: value 12, four augmentations, the last one uses a reverse arc', () => {
  const st = NF.trace(MAIN);
  const r = st.result;
  assert.equal(r.value, 12);
  assert.equal(r.rounds, 4);
  assert.deepEqual(r.cut.S.slice().sort(), ['a', 'b', 'c', 's']);
  assert.deepEqual(r.cut.edges.slice().sort(), ['a-d', 'b-d', 'c-t']);
  assert.equal(r.cut.value, 12);
  const pathSteps = st.filter((s) => s.kind === 'path');
  assert.deepEqual(pathSteps.map((s) => s.pathNodes.join('')), ['sact', 'sbct', 'sbdt', 'sbcadt']);
  assert.equal(pathSteps[3].path.some((a) => a.dir === 'back'), true);
  assert.equal(pathSteps.slice(0, 3).some((s) => s.path.some((a) => a.dir === 'back')), false);
  assert.deepEqual(st.filter((s) => s.kind === 'bottleneck').map((s) => s.bottleneck), [7, 1, 3, 1]);
});

test('lesson network: the fourth push cancels flow on a→c', () => {
  const st = NF.trace(MAIN);
  const pushes = st.filter((s) => s.kind === 'push');
  assert.equal(pushes[2].fl['a-c'], 7);
  assert.equal(pushes[3].fl['a-c'], 6);
  assert.equal(pushes[3].fl['a-d'], 1);
});

/* ------------------------------------------------------------------ correctness on random networks */
test('random networks: value equals the reference max flow and the brute-force min cut', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const rng = VDSA.rng(seed);
    const net = randomNet(rng, rng.int(2, 8), rng.int(0, 18), 9);
    const want = refMaxFlow(net);
    for (const strategy of ['bfs', 'dfs']) {
      const r = NF.maxFlow(net, { strategy });
      assert.equal(r.value, want, 'seed ' + seed + ' ' + strategy);
      assert.equal(r.cut.value, want, 'cut seed ' + seed);
    }
    assert.equal(refMinCut(net), want, 'duality seed ' + seed);
  }
});

test('every step is a legal flow; value only grows; each push adds the bottleneck', () => {
  for (let seed = 200; seed < 260; seed++) {
    const rng = VDSA.rng(seed);
    const net = randomNet(rng, rng.int(3, 8), rng.int(3, 16), 9);
    const st = NF.trace(net);
    let prev = 0;
    st.forEach((s, i) => {
      assert.equal(NF.checkFlow(net, s.fl), null, 'seed ' + seed + ' step ' + i);
      assert.equal(s.value, NF.flowValue(net, s.fl));
      assert.ok(s.value >= prev);
      if (s.kind === 'push') assert.equal(s.value - prev, s.bottleneck);
      prev = s.value;
    });
    assert.equal(last(st).value, st.result.value);
  }
});

test('Edmonds-Karp: augmenting paths never get shorter, and each is a shortest path in its residual graph', () => {
  for (let seed = 300; seed < 350; seed++) {
    const rng = VDSA.rng(seed);
    const net = randomNet(rng, rng.int(3, 8), rng.int(4, 18), 9);
    const st = NF.trace(net, { detail: 'rounds' });
    let prevLen = 0, fl = null;
    st.forEach((s) => {
      if (s.kind === 'path') {
        const len = s.path.length;
        assert.ok(len >= prevLen, 'seed ' + seed);
        prevLen = len;
        // shortest path length in the residual graph from the flow before this round
        const shortest = residualDistance(net, fl || {}, 's', 't');
        assert.equal(len, shortest, 'seed ' + seed);
      }
      fl = s.fl;
    });
  }
});

function residualDistance(net, fl, s, t) {
  const arcs = NF.residual(net, fl);
  const dist = { [s]: 0 };
  const q = [s];
  while (q.length) {
    const u = q.shift();
    arcs.filter((a) => a.from === u).forEach((a) => { if (dist[a.to] === undefined) { dist[a.to] = dist[u] + 1; q.push(a.to); } });
  }
  return dist[t];
}

test('the minimum cut is saturated, separates s from t and equals the flow', () => {
  for (let seed = 400; seed < 450; seed++) {
    const rng = VDSA.rng(seed);
    const net = randomNet(rng, rng.int(2, 9), rng.int(2, 20), 9);
    const st = NF.trace(net, { detail: 'rounds' });
    const c = last(st).cut;
    assert.ok(c, 'has a cut');
    assert.ok(c.S.includes('s') && !c.S.includes('t'));
    assert.equal(c.S.length + c.T.length, new Set([...c.S, ...c.T]).size);
    assert.equal(NF.cutValue(net, c.S), st.result.value);
    const fl = last(st).fl;
    c.edges.forEach((id) => {
      const e = NF.normalize(net).byId[id];
      assert.equal(fl[id], e.cap, 'cut edge ' + id + ' is full');
    });
    // edges from T to S carry no flow
    NF.normalize(net).edges.forEach((e) => { if (c.T.includes(e.from) && c.S.includes(e.to)) assert.equal(fl[e.id], 0); });
  }
});

test('any cut is at least the maximum flow (weak duality)', () => {
  const N = MAIN;
  const others = ['a', 'b', 'c', 'd'];
  for (let mask = 0; mask < 16; mask++) {
    const S = ['s'].concat(others.filter((_, i) => mask & (1 << i)));
    assert.ok(NF.cutValue(N, S) >= 12);
  }
});

/* ------------------------------------------------------------------ why reverse edges */
test('greedy without reverse arcs gets stuck below the maximum; with reverse arcs it reaches it', () => {
  const greedy = NF.maxFlow(DIAMOND, { reverse: false, forced: [['s', 'a', 'b', 't']] });
  const full = NF.maxFlow(DIAMOND, { forced: [['s', 'a', 'b', 't']] });
  assert.equal(greedy.value, 3);
  assert.equal(full.value, 5);
  assert.equal(refMaxFlow(DIAMOND), 5);
  assert.equal(greedy.rounds, 1);
  assert.equal(full.rounds, 2);
  const st = NF.trace(DIAMOND, { forced: [['s', 'a', 'b', 't']], detail: 'rounds' });
  const second = st.filter((s) => s.kind === 'path')[1];
  assert.deepEqual(second.pathNodes, ['s', 'b', 'a', 't']);
  assert.equal(second.path[1].dir, 'back');
  assert.equal(second.path[1].res, 3);
});

test('forced paths must be valid augmenting paths', () => {
  assert.throws(() => NF.trace(DIAMOND, { forced: [['s', 'a', 't', 'b']] }), /not an augmenting path/);
  assert.throws(() => NF.trace(DIAMOND, { forced: [['s', 'a', 'b', 't'], ['s', 'a', 'b', 't'], ['s', 'a', 'b', 't']] }));
});

test('plain Ford-Fulkerson with unlucky paths needs 2M rounds where Edmonds-Karp needs 2', () => {
  for (const M of [1, 2, 5, 12]) {
    const net = NF.parseNetwork('s-a:' + M + ', s-b:' + M + ', a-b:1, a-t:' + M + ', b-t:' + M).values;
    const bad = NF.maxFlow(net, { forced: (round) => (round % 2 ? ['s', 'a', 'b', 't'] : ['s', 'b', 'a', 't']) });
    const ek = NF.maxFlow(net);
    assert.equal(bad.value, 2 * M);
    assert.equal(ek.value, 2 * M);
    assert.equal(bad.rounds, 2 * M);
    assert.equal(ek.rounds, 2);
  }
});

/* ------------------------------------------------------------------ edge cases */
test('disconnected source: value 0, one nopath step and a cut of just the source side', () => {
  const net = { nodes: ['s', 'a', 't'], edges: [{ from: 'a', to: 't', cap: 4 }], source: 's', sink: 't' };
  const st = NF.trace(net);
  assert.equal(st.result.value, 0);
  assert.equal(st.result.rounds, 0);
  assert.deepEqual(st.map((s) => s.kind), ['init', 'search', 'dequeue', 'nopath', 'cut']);
  assert.deepEqual(last(st).cut.S, ['s']);
  assert.equal(last(st).cut.value, 0);
});

test('single edge, zero capacity, parallel edges and antiparallel edges', () => {
  const one = NF.maxFlow({ nodes: ['s', 't'], edges: [['s', 't', 5]], source: 's', sink: 't' });
  assert.equal(one.value, 5);
  assert.equal(one.rounds, 1);
  const zero = NF.maxFlow({ nodes: ['s', 't'], edges: [['s', 't', 0]], source: 's', sink: 't' });
  assert.equal(zero.value, 0);
  const par = NF.maxFlow({ nodes: ['s', 't'], edges: [['s', 't', 2], ['s', 't', 3]], source: 's', sink: 't' });
  assert.equal(par.value, 5);
  const anti = { nodes: ['s', 'a', 't'], edges: [['s', 'a', 4], ['a', 's', 9], ['a', 't', 3], ['t', 'a', 2]], source: 's', sink: 't' };
  assert.equal(NF.maxFlow(anti).value, 3);
  assert.equal(refMaxFlow(anti), 3);
});

test('edges into the source and out of the sink do not change the value', () => {
  const net = { nodes: ['s', 'a', 't'], edges: [['s', 'a', 5], ['a', 't', 4], ['a', 's', 3], ['t', 'a', 7]], source: 's', sink: 't' };
  const st = NF.trace(net);
  assert.equal(st.result.value, 4);
  st.forEach((s) => assert.equal(NF.checkFlow(net, s.fl), null));
});

test('a directed cycle in the network does not confuse the search', () => {
  const net = { nodes: ['s', 'a', 'b', 'c', 't'], edges: [['s', 'a', 6], ['a', 'b', 5], ['b', 'c', 5], ['c', 'a', 5], ['b', 't', 4], ['c', 't', 3]], source: 's', sink: 't' };
  assert.equal(NF.maxFlow(net).value, refMaxFlow(net));
});

test('bad networks throw friendly errors', () => {
  assert.throws(() => NF.trace({ nodes: ['s'], edges: [], source: 's', sink: 't' }), /sink t is not in the network/);
  assert.throws(() => NF.trace({ nodes: ['s', 't'], edges: [], source: 's', sink: 's' }), /must be different/);
  assert.throws(() => NF.trace({ nodes: ['s', 't'], edges: [['s', 't', -1]], source: 's', sink: 't' }), /whole number/);
  assert.throws(() => NF.trace({ nodes: ['s', 't'], edges: [['s', 's', 1]], source: 's', sink: 't' }), /to itself/);
});

test('a run capped by maxRounds stops without a cut', () => {
  const r = NF.maxFlow(MAIN, { maxRounds: 2 });
  assert.equal(r.rounds, 2);
  assert.equal(r.capped, true);
  assert.equal(r.cut, null);
});

/* ------------------------------------------------------------------ step conventions */
test('steps: stable counter keys, known flowchart ids and code labels, captions everywhere', () => {
  for (const net of [MAIN, DIAMOND]) {
    for (const detail of ['full', 'rounds']) {
      const st = NF.trace(net, { detail });
      const keys = Object.keys(st[0].counters).join();
      st.forEach((s, i) => {
        assert.equal(Object.keys(s.counters).join(), keys);
        assert.ok(typeof s.caption === 'string' && s.caption.length > 10, 'caption ' + i);
        assert.ok(FLOW_IDS.has(s.flow), 'flow id ' + s.flow);
        [].concat(s.line).forEach((l) => assert.ok(LINES.has(l), 'line ' + l));
        assert.ok(s.states && typeof s.states === 'object');
        net.nodes.forEach((n) => assert.ok(s.states[typeof n === 'object' ? n.id : n]));
      });
      assert.equal(st[0].kind, 'init');
      assert.equal(last(st).kind, 'cut');
      assert.equal(st[st.length - 2].kind, 'nopath');
    }
  }
});

test('full detail is a refinement of rounds detail: same paths, same value', () => {
  for (let seed = 500; seed < 530; seed++) {
    const rng = VDSA.rng(seed);
    const net = randomNet(rng, rng.int(3, 8), rng.int(4, 16), 9);
    const a = NF.trace(net, { detail: 'full' }), b = NF.trace(net, { detail: 'rounds' });
    assert.deepEqual(a.result.paths, b.result.paths);
    assert.equal(a.result.value, b.result.value);
    assert.ok(a.length >= b.length);
    assert.deepEqual(a.filter((s) => s.kind === 'push').map((s) => s.value), b.filter((s) => s.kind === 'push').map((s) => s.value));
  }
});

test('BFS steps: queue contents are truthful and states match the queue', () => {
  const st = NF.trace(MAIN);
  st.filter((s) => s.kind === 'dequeue' || s.kind === 'search').forEach((s) => {
    s.queue.forEach((id) => assert.equal(s.states[id] === 'frontier' || s.states[id] === 'active', true));
    if (s.current) assert.equal(s.states[s.current], 'active');
  });
  const first = st.find((s) => s.kind === 'search');
  assert.deepEqual(first.queue, ['s']);
});

test('strategy dfs finds some path, reverse arcs off ignores reverse arcs', () => {
  const dfs = NF.trace(MAIN, { strategy: 'dfs', detail: 'rounds' });
  assert.equal(dfs.result.value, 12);
  assert.equal(dfs.result.algo, 'ford-fulkerson');
  const g = NF.trace(MAIN, { reverse: false, detail: 'rounds' });
  g.filter((s) => s.kind === 'path').forEach((s) => s.path.forEach((a) => assert.equal(a.dir, 'fwd')));
  assert.ok(g.result.value <= 12);
});

test('trace is deterministic', () => {
  assert.deepEqual(NF.trace(MAIN), NF.trace(MAIN));
});

test('residual(): room of the pair (u,v) is c - f plus the flow on the opposite edge', () => {
  const st = NF.trace(MAIN, { detail: 'rounds' });
  const fl = st.filter((s) => s.kind === 'push')[3].fl;
  const res = NF.residual(MAIN, fl);
  const get = (u, v) => (res.find((a) => a.from === u && a.to === v) || { res: 0 }).res;
  assert.equal(get('a', 'c'), 1);   // 7 - 6
  assert.equal(get('c', 'a'), 6);   // reverse of a→c, dashed
  assert.equal(res.find((a) => a.from === 'c' && a.to === 'a').reverseOnly, true);
  assert.equal(get('s', 'a'), 0);   // saturated: no arc drawn
  assert.equal(get('a', 's'), 7);   // reverse of s→a
  // room in both directions of an edge always adds up to its capacity when there is no antiparallel edge
  MAIN.edges.forEach((e) => assert.equal(get(e.from, e.to) + get(e.to, e.from), e.cap));
});

/* ------------------------------------------------------------------ parsing */
test('parseNetwork: formats, merging and limits', () => {
  const ok = NF.parseNetwork('s-a:10, s->b 5; a-t=7\nb→t:8');
  assert.equal(ok.error, null);
  assert.equal(ok.values.edges.length, 4);
  assert.deepEqual(ok.values.nodes, ['s', 'a', 'b', 't']);
  const merged = NF.parseNetwork('s-t:2, s-t:3');
  assert.equal(merged.values.edges[0].cap, 5);
  assert.match(NF.parseNetwork('').error, /Type some pipes/);
  assert.match(NF.parseNetwork('a-b:3').error, /source s/);
  assert.match(NF.parseNetwork('s-a:3').error, /sink t/);
  assert.match(NF.parseNetwork('s-a:x').error, /not a pipe/);
  assert.match(NF.parseNetwork('s-s:3, s-t:1').error, /itself/);
  assert.match(NF.parseNetwork('s-t:0').error, /capacity of 0/);
  assert.match(NF.parseNetwork('s-t:100').error, /too large/);
  const many = Array.from({ length: 25 }, (_, i) => 's-v' + i + ':1').join(',') + ',v0-t:1';
  assert.match(NF.parseNetwork(many).error, /vertices/);
  const edgesMany = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (i !== j) edgesMany.push('v' + i + '-v' + j + ':1');
  assert.match(NF.parseNetwork('s-v0:1, v1-t:1, ' + edgesMany.join(',')).error, /pipes/);
});

test('parsed networks run', () => {
  const p = NF.parseNetwork('s-a:10, s-b:5, a-b:15, a-t:5, b-t:10');
  assert.equal(NF.maxFlow(p.values).value, 15);
});

/* ------------------------------------------------------------------ bipartite matching */
test('matching: value equals the brute-force maximum matching on random instances', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const rng = VDSA.rng(seed);
    const nw = rng.int(1, 5), nj = rng.int(1, 5);
    const workers = Array.from({ length: nw }, (_, i) => 'W' + i), jobs = Array.from({ length: nj }, (_, i) => 'J' + i);
    const pairs = [];
    workers.forEach((w) => jobs.forEach((j) => { if (rng() < 0.4) pairs.push([w, j]); }));
    const m = NF.matchingNetwork(pairs, { workers, jobs });
    const st = NF.trace(m.net, { detail: 'rounds' });
    assert.equal(st.result.value, refMatching(workers, jobs, pairs), 'seed ' + seed);
    const asg = NF.assignments(m.net, last(st).fl);
    assert.equal(asg.length, st.result.value);
    const ws = new Set(asg.map((a) => a[0])), js = new Set(asg.map((a) => a[1]));
    assert.equal(ws.size, asg.length);
    assert.equal(js.size, asg.length);
    asg.forEach(([w, j]) => assert.ok(pairs.some((p) => p[0] === w && p[1] === j)));
    st.forEach((s) => assert.equal(NF.checkFlow(m.net, s.fl), null));
  }
});

test('matching: an augmenting path can re-route a worker (uses a reverse arc)', () => {
  // Ana likes J1 and J2, Ben likes only J1. BFS gives Ana J1 first, then must move her to J2 to seat Ben.
  const m = NF.matchingNetwork([['Ana', 'J1'], ['Ana', 'J2'], ['Ben', 'J1']]);
  const st = NF.trace(m.net, { detail: 'rounds' });
  assert.equal(st.result.value, 2);
  const paths = st.filter((s) => s.kind === 'path');
  assert.equal(paths.length, 2);
  assert.equal(paths[1].path.some((a) => a.dir === 'back'), true);
  assert.deepEqual(NF.assignments(m.net, last(st).fl).sort(), [['Ana', 'J2'], ['Ben', 'J1']]);
});

test('matching: no edges gives an empty matching', () => {
  const m = NF.matchingNetwork([], { workers: ['A'], jobs: ['X'] });
  const st = NF.trace(m.net, { detail: 'rounds' });
  assert.equal(st.result.value, 0);
  assert.deepEqual(NF.assignments(m.net, last(st).fl), []);
});

test('Hall violation: three workers who all want the same two jobs leave one unmatched, and the cut names them', () => {
  const pairs = [['A', 'X'], ['A', 'Y'], ['B', 'X'], ['B', 'Y'], ['C', 'X'], ['C', 'Y']];
  const m = NF.matchingNetwork(pairs);
  const st = NF.trace(m.net, { detail: 'rounds' });
  assert.equal(st.result.value, 2);
  assert.equal(last(st).cut.value, 2);
});
