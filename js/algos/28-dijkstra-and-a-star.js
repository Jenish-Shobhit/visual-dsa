/* Lesson 28 · Dijkstra & A* — pure step generators (no DOM).

   Browser: VDSA.algos.shortestPaths.  Node: module.exports.
   Reused by later labs (pathfinder, graph studio), so the names are generic:

     var SP = VDSA.algos.shortestPaths;
     SP.dijkstra(graph, 'S', {target})        lazy-deletion Dijkstra on a weighted graph, with a priority-queue snapshot
     SP.dijkstra(graph, 'S', {allowNegative}) the same loop on graphs with negative edges (it gives wrong answers)
     SP.negativeDemo(graph, 'S')              dijkstra(allowNegative) + a reveal of the true distances
     SP.dijkstraResult(graph, 'S')            plain result {dist, parent, order, pops, pushes, stale, relaxations}
     SP.bellmanFord(graph, 'S')               reference distances (also detects negative cycles)
     SP.fewestEdges(graph, 'S', 'T')          BFS ignoring weights: the path with the fewest edges (and its cost)
     SP.gridDijkstra(grid, start, goal, o)    grid pathfinding, one step per expanded cell (same grid format as gridBfs)
     SP.gridAStar(grid, start, goal, o)       A*: order by f = g + h   (o.heuristic 'manhattan' | 'euclid' | 'zero', o.hWeight)
     SP.gridGreedy(grid, start, goal, o)      greedy best-first: order by h only
     SP.gridSearchResult(grid, s, g, o)       counts only (no steps): {expanded, pops, pushes, cost, pathLen, found}
     SP.gridCompare(grid, s, g, o)            {dijkstra, astar, greedy, best}: all three, for a comparison table
     SP.parseWeightedEdgeList(text, o)        "A-B:4, B-C:2" -> {values: graph, error}
     SP.randomWeightedGraph(n, m, rng, o)     reproducible random weighted graphs

   Graph input: {nodes: ['A'] | [{id, x, y}], edges: [['A', 'B', 4]] | [{from, to, weight}], directed: false}.
   Neighbours are always relaxed in natural order (A < B < …, 2 < 10), so every trace is deterministic.
   Vertex states follow the shared vocabulary: default (∞, unseen), frontier (has a tentative distance),
   active (just popped), done (settled: provably final), path, found, error.  With negative weights a settled
   vertex is only "visited": nothing proves it is final.

   Grid input: {rows, cols, walls: ['r,c'], mud: ['r,c']}; cells are [row, col]. Entering an open cell costs 1,
   entering a mud cell costs `mudCost` (default 5). Moves are up / right / down / left. Grid steps carry `codes`
   (one char per cell, row-major: '#' wall, '.' unseen, 'f' frontier, 'a' being expanded, 'v' expanded, 'p' path),
   `mud` (one '0'/'1' per cell), `closedG` (cost from the start when a cell was expanded, else -1; never changes
   after that), `maxG`, `current`, `found`, and counters {expanded, frontier, cost}.

   Every step: {algo, kind, caption (why), line (code label), vars, counters (same keys on every step), flow, …}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.shortestPaths = Object.assign(root.VDSA.algos.shortestPaths || {}, api);   // merge: lessons 28 and 29 share this namespace
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 10, maxEdges: 20, maxWeight: 99, maxGridCells: 2400 };

  /* ================================================================== helpers */

  function natCmp(a, b) {
    a = String(a); b = String(b);
    var ra = a.match(/\d+|\D+/g) || [], rb = b.match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ra.length, rb.length); i++) {
      var x = ra[i], y = rb[i];
      var nx = /^\d/.test(x), ny = /^\d/.test(y);
      if (nx && ny) { var d = parseInt(x, 10) - parseInt(y, 10); if (d) return d < 0 ? -1 : 1; }
      if (x !== y) return x < y ? -1 : 1;
    }
    return ra.length - rb.length;
  }
  function edgeKey(a, b, directed) {
    a = String(a); b = String(b);
    if (!directed && b < a) { var t = a; a = b; b = t; }
    return a + '-' + b;
  }
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function fd(d) { return d === Infinity || d === null || d === undefined ? '∞' : String(d).replace('-', '−'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }

  function nodeIds(graph) {
    var out = [], seen = {};
    function add(id) { id = String(id); if (!seen[id]) { seen[id] = true; out.push(id); } }
    ((graph && graph.nodes) || []).forEach(function (n) { if (n !== null && n !== undefined) add(typeof n === 'object' ? n.id : n); });
    rawEdges(graph).forEach(function (e) { add(e.from); add(e.to); });
    return out;
  }
  function rawEdges(graph) {
    var out = [];
    ((graph && graph.edges) || []).forEach(function (e) {
      if (!e) return;
      var from = Array.isArray(e) ? e[0] : e.from, to = Array.isArray(e) ? e[1] : e.to;
      var w = Array.isArray(e) ? e[2] : (e.weight !== undefined ? e.weight : e.w);
      if (from === undefined || from === null || to === undefined || to === null) return;
      out.push({ from: String(from), to: String(to), weight: w === undefined || w === null ? 1 : Number(w) });
    });
    return out;
  }

  /* normalize(graph) -> {ids, out: {id: [{to, w, key}]}, edges: [{from, to, weight, key}], directed, negative}
     Self-loops are dropped; a repeated edge keeps its smaller weight. Undirected edges appear in both lists. */
  function normalize(graph) {
    var directed = !!(graph && graph.directed);
    var ids = nodeIds(graph), out = {}, byKey = {}, edges = [], negative = false;
    ids.forEach(function (id) { out[id] = []; });
    rawEdges(graph).forEach(function (e) {
      if (e.from === e.to || !isFinite(e.weight)) return;
      var k = edgeKey(e.from, e.to, directed);
      if (byKey[k]) { if (e.weight < byKey[k].weight) byKey[k].weight = e.weight; return; }
      var rec = { from: e.from, to: e.to, weight: e.weight, key: k };
      byKey[k] = rec; edges.push(rec);
    });
    edges.forEach(function (e) {
      if (e.weight < 0) negative = true;
      out[e.from].push({ to: e.to, w: e.weight, key: e.key });
      if (!directed) out[e.to].push({ to: e.from, w: e.weight, key: e.key });
    });
    ids.forEach(function (id) { out[id].sort(function (x, y) { return natCmp(x.to, y.to); }); });
    return { ids: ids, out: out, edges: edges, directed: directed, negative: negative };
  }

  function pathTo(parent, to) {
    var out = [], guard = 0, at = to;
    while (at !== null && at !== undefined && guard++ < 10000) { out.unshift(at); at = parent[at]; }
    return out;
  }

  /* ================================================================== reference algorithms */

  /* bellmanFord(graph, s) -> {dist, parent, negativeCycle}. dist uses Infinity for unreachable vertices. */
  function bellmanFord(graph, s) {
    var G = normalize(graph), dist = {}, parent = {};
    G.ids.forEach(function (id) { dist[id] = Infinity; parent[id] = null; });
    if (dist[s] === undefined) return { dist: dist, parent: parent, negativeCycle: false };
    dist[s] = 0;
    var arcs = [];
    G.edges.forEach(function (e) { arcs.push([e.from, e.to, e.weight]); if (!G.directed) arcs.push([e.to, e.from, e.weight]); });
    for (var pass = 0; pass < G.ids.length - 1; pass++) {
      var changed = false;
      arcs.forEach(function (a) { if (dist[a[0]] + a[2] < dist[a[1]]) { dist[a[1]] = dist[a[0]] + a[2]; parent[a[1]] = a[0]; changed = true; } });
      if (!changed) break;
    }
    var neg = arcs.some(function (a) { return dist[a[0]] + a[2] < dist[a[1]]; });
    return { dist: dist, parent: parent, negativeCycle: neg };
  }

  /* fewestEdges(graph, s, t) -> {path, edges, cost} by BFS, ignoring weights (ties: natural neighbour order). */
  function fewestEdges(graph, s, t) {
    var G = normalize(graph), parent = {}, q = [s], head = 0;
    parent[s] = null;
    while (head < q.length) {
      var u = q[head++];
      if (u === t) break;
      G.out[u].forEach(function (a) { if (parent[a.to] === undefined) { parent[a.to] = u; q.push(a.to); } });
    }
    if (parent[t] === undefined) return { path: [], edges: 0, cost: Infinity };
    var path = pathTo(parent, t);
    return { path: path, edges: path.length - 1, cost: pathCost(G, path) };
  }
  function pathCost(G, path) {
    var c = 0;
    for (var i = 0; i + 1 < path.length; i++) {
      var best = Infinity;
      G.out[path[i]].forEach(function (a) { if (a.to === path[i + 1] && a.w < best) best = a.w; });
      c += best;
    }
    return c;
  }

  /* ================================================================== Dijkstra on a weighted graph */

  /* Steps, in order:
       init     dist[s] = 0, the queue holds (0, s)
       settle   the smallest entry leaves the queue and its vertex is settled (u active)
       stale    the smallest entry is out of date (a better distance is known): discard it
       relax    edge u→v gives a shorter route: dist[v] and parent[v] change, a new entry is pushed
       skip     edge u→v gives nothing better (or v is settled): nothing changes
       ignore   (negative-edge mode) the edge WOULD improve a settled vertex, but Dijkstra never looks back
       found    the target was settled: stop early
       path     walk the parents from the target back to the source, one hop per step
       done     the queue is empty
     Extras on every step: dist {id: number | null (∞)}, parent, settled, states, edges (edge id -> state),
     pulse {from, to, result} | null, pq [{id, v, d, stale}], popped {id, v, d, stale} | null, pathIds, order,
     u, v (current vertices or null), counters {settled, relaxations, pushes, stale}. */
  function dijkstra(graph, source, opts) {
    opts = opts || {};
    var G = normalize(graph), neg = !!opts.allowNegative;
    source = String(source);
    var target = opts.target === undefined || opts.target === null || opts.target === '' ? null : String(opts.target);
    var steps = [];
    var dist = {}, parent = {}, settled = {}, pq = [], seq = 0, order = [];
    var counters = { settled: 0, relaxations: 0, pushes: 0, stale: 0 };
    var current = null, cand = null, popped = null, pulse = null, pathIds = null, examining = null;
    G.ids.forEach(function (id) { dist[id] = Infinity; parent[id] = null; });

    function pqSnapshot() {
      return pq.map(function (e) { return { id: e.id, v: e.v, d: e.d, stale: e.d > dist[e.v] }; });
    }
    function pqText() {
      return pq.map(function (e) { return '(' + fd(e.d) + ', ' + e.v + ')'; }).join(' ');
    }
    function snap(kind, o) {
      var states = {}, edges = {}, dd = {}, par = {}, set = {};
      G.ids.forEach(function (id) {
        dd[id] = dist[id] === Infinity ? null : dist[id];
        par[id] = parent[id];
        if (settled[id]) set[id] = true;
        states[id] = settled[id] ? (neg ? 'visited' : 'done') : dist[id] !== Infinity ? 'frontier' : 'default';
        if (parent[id] !== null) edges[edgeKey(parent[id], id, G.directed)] = settled[id] ? (neg ? 'visited' : 'done') : 'frontier';
      });
      if (current !== null) states[current] = 'active';
      if (o.muted) o.muted.forEach(function (id) { states[id] = 'muted'; });
      if (examining !== null && !settled[examining]) states[examining] = 'compare';
      if (pathIds) {
        pathIds.forEach(function (id, i) {
          states[id] = 'path';
          if (i + 1 < pathIds.length) edges[edgeKey(id, pathIds[i + 1], G.directed)] = 'path';
        });
        if (pathIds.length && pathIds[pathIds.length - 1] === target) states[target] = 'found';
      }
      var vars = o.vars || {};
      steps.push({
        algo: 'dijkstra', kind: kind, caption: o.caption, line: o.line || null, flow: o.flow || null, vars: vars,
        dist: dd, parent: par, settled: set, states: states, edges: edges,
        pulse: pulse, pq: pqSnapshot(), popped: popped, pathIds: pathIds ? pathIds.slice() : [],
        order: order.slice(), u: current, v: examining, directed: G.directed, negativeMode: neg,
        counters: copy(counters)
      });
    }
    function baseVars(extra) {
      var v = { u: current, 'dist[u]': current === null ? null : dist[current], v: examining, w: null, 'dist[u] + w': null, 'dist[v]': examining === null ? null : dist[examining], pq: '[' + pqText() + ']' };
      for (var k in extra) v[k] = extra[k];
      return v;
    }
    function push(v, d) {
      var e = { id: 'e' + (++seq), v: v, d: d, n: seq };
      var i = pq.length;
      while (i > 0 && (pq[i - 1].d > d || (pq[i - 1].d === d && natCmp(pq[i - 1].v, v) > 0))) i--;
      pq.splice(i, 0, e);
      counters.pushes++;
      return e;
    }

    if (!G.ids.length) { snap('empty', { caption: 'The graph has no vertices.' }); return steps; }
    if (G.ids.indexOf(source) === -1) { snap('empty', { caption: 'The start vertex ' + b(source) + ' is not in the graph.' }); return steps; }
    if (target !== null && G.ids.indexOf(target) === -1) target = null;
    if (G.negative && !neg) {
      snap('error', { caption: 'Dijkstra needs every weight to be zero or more. This graph has a negative edge, so the answer could be wrong. Use Bellman-Ford instead (next lesson).' });
      return steps;
    }

    dist[source] = 0;
    push(source, 0);
    snap('init', {
      caption: 'Every vertex starts at distance ∞ (not reached yet), except ' + b(source) + ' at 0. The priority queue holds one entry: (0, ' + esc(source) + ').',
      line: 'init', flow: 'init', vars: baseVars({})
    });

    while (pq.length) {
      var e = pq.shift();
      current = null; examining = null; pulse = null;
      var u = e.v, d = e.d;
      if (d > dist[u]) {
        counters.stale++;
        popped = { id: e.id, v: u, d: d, stale: true };
        current = null;
        snap('stale', {
          caption: 'Pop (' + fd(d) + ', ' + esc(u) + '). But ' + b(u) + ' already has distance ' + fd(dist[u]) + ', shorter than ' + fd(d) + '. This entry was left behind when a better route was found, so throw it away.',
          line: ['pop', 'stale'], flow: 'stale', vars: baseVars({ u: u, 'dist[u]': dist[u] })
        });
        popped = null;
        continue;
      }
      if (settled[u]) { // only possible with zero-weight repeats; the entry is a duplicate of a settled vertex
        counters.stale++;
        popped = { id: e.id, v: u, d: d, stale: true };
        snap('stale', { caption: b(u) + ' is already settled, so this duplicate entry is discarded.', line: ['pop', 'stale'], flow: 'stale', vars: baseVars({ u: u, 'dist[u]': dist[u] }) });
        popped = null;
        continue;
      }
      settled[u] = true; counters.settled++; order.push(u);
      current = u;
      popped = { id: e.id, v: u, d: d, stale: false };
      var others = pq.filter(function (x) { return x.d <= dist[x.v]; });
      snap('settle', {
        caption: neg
          ? 'Pop (' + fd(d) + ', ' + esc(u) + ') and settle ' + b(u) + ' at ' + fd(d) + '. Dijkstra assumes no later route can be shorter, so it never revisits ' + b(u) + '.'
          : 'Pop the smallest entry, (' + fd(d) + ', ' + esc(u) + '). Every other vertex is at least ' + fd(others.length ? others[0].d : d) + ' away, and weights never subtract, so no detour can reach ' + b(u) + ' in less than ' + fd(d) + '. Settle it: ' + b(u) + ' = ' + fd(d) + ' is final.',
        line: ['pop', 'settle'], flow: 'settle', vars: baseVars({})
      });
      if (target !== null && u === target) {
        pathIds = null;
        snap('found', {
          caption: 'The target ' + b(u) + ' is settled at ' + fd(d) + '. Its distance is final, so there is no need to explore the rest of the graph. Now read the route backwards through the parents.',
          line: 'found', flow: 'found', vars: baseVars({})
        });
        var path = pathTo(parent, u), cost = dist[u];
        for (var k = path.length - 1; k >= 0; k--) {
          pathIds = path.slice(k);
          current = null; popped = null; pulse = null; examining = null;
          snap('path', {
            caption: k === 0
              ? 'Back at ' + b(path[0]) + '. The shortest route is ' + path.map(esc).join(' → ') + ', total weight ' + cost + '.'
              : 'Each vertex remembers the neighbour that gave it its best distance. ' + b(path[k]) + ' came from ' + b(path[k - 1]) + '.',
            line: 'found', flow: 'found', vars: baseVars({ path: '[' + path.slice(k).join(', ') + ']' })
          });
        }
        return steps;
      }
      var arcs = G.out[u];
      for (var i = 0; i < arcs.length; i++) {
        var a = arcs[i], v = a.to, nd = d + a.w;
        examining = v;
        var ex = { u: u, 'dist[u]': d, v: v, w: a.w, 'dist[u] + w': nd, 'dist[v]': dist[v] };
        if (settled[v]) {
          if (neg && nd < dist[v]) {
            pulse = { from: u, to: v, result: 'ignore' };
            snap('ignore', {
              caption: 'Edge ' + esc(u) + '→' + esc(v) + ' (weight ' + fd(a.w) + ') gives ' + fd(d) + ' + (' + fd(a.w) + ') = ' + fd(nd) + ', better than ' + b(v) + '’s ' + fd(dist[v]) + '. But ' + b(v) + ' is settled and Dijkstra never looks back, so the better route is ignored.',
              line: 'check', flow: 'better', vars: baseVars(ex)
            });
          } else {
            pulse = { from: u, to: v, result: 'skip' };
            snap('skip', {
              caption: 'Edge ' + esc(u) + '→' + esc(v) + ': ' + b(v) + ' is already settled at ' + fd(dist[v]) + '. Going through ' + b(u) + ' costs ' + fd(nd) + ', which cannot be better.',
              line: 'check', flow: 'better', vars: baseVars(ex)
            });
          }
          continue;
        }
        if (nd < dist[v]) {
          var before = dist[v];
          dist[v] = nd; parent[v] = u; counters.relaxations++;
          push(v, nd);
          pulse = { from: u, to: v, result: 'relax' };
          ex['dist[v]'] = nd;
          snap('relax', {
            caption: 'Edge ' + esc(u) + '→' + esc(v) + ' (weight ' + fd(a.w) + '): ' + fd(d) + ' + ' + fd(a.w) + ' = ' + fd(nd) + ' is shorter than ' + fd(before) + '. Relax it: dist[' + esc(v) + '] = ' + fd(nd) + ', parent[' + esc(v) + '] = ' + esc(u) + ', and push (' + fd(nd) + ', ' + esc(v) + ').' + (before !== Infinity ? ' The old entry (' + fd(before) + ', ' + esc(v) + ') stays in the queue, now out of date.' : ''),
            line: 'relax', flow: 'relax', vars: baseVars(ex)
          });
        } else {
          pulse = { from: u, to: v, result: 'skip' };
          snap('skip', {
            caption: 'Edge ' + esc(u) + '→' + esc(v) + ' (weight ' + fd(a.w) + '): ' + fd(d) + ' + ' + fd(a.w) + ' = ' + fd(nd) + ' is not shorter than the ' + fd(dist[v]) + ' ' + b(v) + ' already has. Keep the old route.',
            line: 'check', flow: 'better', vars: baseVars(ex)
          });
        }
      }
      current = u; examining = null; pulse = null;
    }
    current = null; examining = null; pulse = null; popped = null;
    var lost = G.ids.filter(function (id) { return dist[id] === Infinity; });
    snap('done', {
      muted: lost,
      caption: 'The queue is empty, so every reachable vertex is settled.' + (lost.length ? ' ' + lost.map(esc).join(', ') + (lost.length === 1 ? ' is' : ' are') + ' still at ∞: no route reaches ' + (lost.length === 1 ? 'it' : 'them') + '.' : '') +
        (neg ? ' Are these really the shortest distances? Compare them with the truth.' : ' The green edges are the shortest-path tree: one shortest route from ' + b(source) + ' to every vertex it can reach.'),
      line: 'done', flow: 'done', vars: baseVars({})
    });
    return steps;
  }

  /* Plain result with operation counts (charts, tests). No target: runs to the end. */
  function dijkstraResult(graph, source, opts) {
    opts = opts || {};
    var G = normalize(graph), dist = {}, parent = {}, settled = {}, order = [], heap = [], seq = 0;
    var pops = 0, pushes = 0, stale = 0, relaxations = 0, maxHeap = 0, compares = 0;
    G.ids.forEach(function (id) { dist[id] = Infinity; parent[id] = null; });
    function less(x, y) { compares++; return x.d < y.d || (x.d === y.d && (x.n < y.n)); }
    function hpush(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (less(heap[i], heap[p])) { var t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; } else break; } if (heap.length > maxHeap) maxHeap = heap.length; }
    function hpop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; var i = 0;
        for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; var t = heap[i]; heap[i] = heap[m]; heap[m] = t; i = m; }
      }
      return top;
    }
    source = String(source);
    if (dist[source] === undefined) return { dist: dist, parent: parent, order: order, pops: 0, pushes: 0, stale: 0, relaxations: 0, settled: 0, maxHeap: 0, compares: 0 };
    dist[source] = 0; hpush({ v: source, d: 0, n: seq++ }); pushes++;
    var target = opts.target === undefined || opts.target === null ? null : String(opts.target);
    while (heap.length) {
      var e = hpop(); pops++;
      if (e.d > dist[e.v] || settled[e.v]) { stale++; continue; }
      settled[e.v] = true; order.push(e.v);
      if (target !== null && e.v === target) break;
      G.out[e.v].forEach(function (a) {
        if (settled[a.to]) return;
        var nd = e.d + a.w;
        if (nd < dist[a.to]) { dist[a.to] = nd; parent[a.to] = e.v; relaxations++; hpush({ v: a.to, d: nd, n: seq++ }); pushes++; }
      });
    }
    return { dist: dist, parent: parent, order: order, pops: pops, pushes: pushes, stale: stale, relaxations: relaxations, settled: order.length, maxHeap: maxHeap, compares: compares };
  }

  /* negativeDemo(graph, s): Dijkstra with the settled-set rule on a graph with a negative edge, followed by
     one 'truth' step that shows the real distances (from Bellman-Ford) on every vertex that came out wrong. */
  function negativeDemo(graph, source) {
    var steps = dijkstra(graph, source, { allowNegative: true });
    var last = steps[steps.length - 1];
    var truth = bellmanFord(graph, source);
    var wrong = [];
    Object.keys(last.dist).forEach(function (id) {
      var t = truth.dist[id], dv = last.dist[id] === null ? Infinity : last.dist[id];
      if (t !== dv) wrong.push(id);
    });
    var states = copy(last.states), edges = copy(last.edges);
    wrong.forEach(function (id) { states[id] = 'error'; });
    // mark the edge that Dijkstra ignored
    steps.forEach(function (s) { if (s.kind === 'ignore' && s.pulse) edges[edgeKey(s.pulse.from, s.pulse.to, last.directed)] = 'error'; });
    var text = wrong.length
      ? wrong.map(function (id) { return b(id) + ' is really ' + fd(truth.dist[id]) + ', not ' + fd(last.dist[id]); }).join('; ') + '.'
      : 'Here the answers happen to be right, but nothing guaranteed it.';
    steps.push({
      algo: 'dijkstra', kind: 'truth', caption: 'The truth, from checking every route: ' + text + ' A settled vertex was never allowed to improve, so the negative edge arrived too late.',
      line: 'done', flow: 'done', vars: last.vars, dist: last.dist, parent: last.parent, settled: last.settled, states: states, edges: edges,
      pulse: null, pq: [], popped: null, pathIds: [], order: last.order, u: null, v: null, directed: last.directed, negativeMode: true,
      counters: copy(last.counters), truth: (function () { var t = {}; Object.keys(truth.dist).forEach(function (id) { t[id] = truth.dist[id] === Infinity ? null : truth.dist[id]; }); return t; })(), wrong: wrong
    });
    return steps;
  }

  /* ================================================================== grids */

  var DIRS = [[-1, 0, 'up'], [0, 1, 'right'], [1, 0, 'down'], [0, -1, 'left']];

  function gridModel(grid) {
    var R = Math.max(0, grid.rows | 0), C = Math.max(0, grid.cols | 0), wall = new Array(R * C), mud = new Array(R * C);
    for (var i = 0; i < wall.length; i++) { wall[i] = false; mud[i] = false; }
    function each(list, fn) {
      (list || []).forEach(function (w) {
        var rc = typeof w === 'string' ? w.split(',').map(Number) : w;
        if (!rc || rc.length < 2) return;
        var r = rc[0], c = rc[1];
        if (r >= 0 && c >= 0 && r < R && c < C) fn(r * C + c);
      });
    }
    each(grid.mud, function (k) { mud[k] = true; });
    each(grid.walls, function (k) { wall[k] = true; mud[k] = false; });
    return { R: R, C: C, wall: wall, mud: mud };
  }
  function cellName(rc) { return '(' + rc[0] + ', ' + rc[1] + ')'; }

  /* Heuristics. `h(r, c, gr, gc)` is an estimate of the remaining cost. With a minimum step cost of 1,
     Manhattan and Euclidean distance never overestimate, so they are admissible (and consistent). */
  var HEURISTICS = {
    zero: function () { return 0; },
    manhattan: function (r, c, gr, gc) { return Math.abs(r - gr) + Math.abs(c - gc); },
    euclid: function (r, c, gr, gc) { return Math.sqrt((r - gr) * (r - gr) + (c - gc) * (c - gc)); },
    chebyshev: function (r, c, gr, gc) { return Math.max(Math.abs(r - gr), Math.abs(c - gc)); }
  };

  function fmtN(x) { return x === Math.round(x) ? String(x) : x.toFixed(1); }

  /* One engine for the three grid searches.
       algo 'dijkstra' orders the frontier by g (cost so far),
       algo 'astar'    by f = g + w·h (ties: smaller h first),
       algo 'greedy'   by h alone (a cell is queued once and never improved). */
  function gridRun(grid, start, goal, o) {
    o = o || {};
    var algo = o.algo || 'dijkstra', record = o.record !== false;
    var M = gridModel(grid), R = M.R, C = M.C, N = R * C;
    var mudCost = o.mudCost === undefined ? 5 : o.mudCost;
    var hName = algo === 'dijkstra' ? 'zero' : (o.heuristic || 'manhattan');
    var hFn = typeof hName === 'function' ? hName : (HEURISTICS[hName] || HEURISTICS.manhattan);
    var hw = algo === 'dijkstra' ? 0 : (o.hWeight === undefined ? 1 : o.hWeight);
    var steps = [], codes = [], mudStr = '';
    for (var i = 0; i < N; i++) { codes.push(M.wall[i] ? '#' : '.'); mudStr += M.mud[i] ? '1' : '0'; }
    var g = new Array(N), parent = new Array(N), closed = new Array(N), closedG = new Array(N);
    for (i = 0; i < N; i++) { g[i] = Infinity; parent[i] = -1; closed[i] = false; closedG[i] = -1; }
    var heap = [], seq = 0, expanded = 0, pops = 0, pushes = 0, staleCount = 0, frontier = 0, current = null, found = false, cost = null, pathLen = null, maxHeap = 0;
    var s = start ? start[0] * C + start[1] : -1, t = goal ? goal[0] * C + goal[1] : -1;
    function rc(k) { return [Math.floor(k / C), k % C]; }
    function h(k) { return goal ? hFn(Math.floor(k / C), k % C, goal[0], goal[1]) : 0; }
    function keyOf(k, gv) {
      var hv = h(k);
      if (algo === 'greedy') return [hw === 0 ? 0 : hv, gv];
      if (algo === 'astar') return [gv + hw * hv, hv];
      return [gv, 0];
    }
    function less(x, y) { return x.a < y.a || (x.a === y.a && (x.b < y.b || (x.b === y.b && x.n < y.n))); }
    function hpush(e) { heap.push(e); var q = heap.length - 1; while (q > 0) { var p = (q - 1) >> 1; if (less(heap[q], heap[p])) { var tmp = heap[q]; heap[q] = heap[p]; heap[p] = tmp; q = p; } else break; } if (heap.length > maxHeap) maxHeap = heap.length; pushes++; }
    function hpop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; var q = 0;
        for (;;) { var l = 2 * q + 1, r = l + 1, m = q; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === q) break; var tmp = heap[q]; heap[q] = heap[m]; heap[m] = tmp; q = m; }
      }
      return top;
    }
    var nameAlgo = algo === 'dijkstra' ? 'Dijkstra' : algo === 'astar' ? 'A*' : 'Greedy best-first';
    function snap(kind, x) {
      if (!record) return;
      steps.push({
        algo: 'grid' + algo, kind: kind, rows: R, cols: C, start: start, goal: goal || null,
        codes: codes.join(''), mud: mudStr, closedG: closedG, maxG: null, current: current === null ? null : rc(current), found: found,
        caption: x.caption, line: x.line || null, flow: x.flow || null, vars: x.vars || {},
        counters: { expanded: expanded, frontier: frontier, cost: cost === null ? '–' : cost }
      });
    }
    function bad(msg) { snap('empty', { caption: msg }); return { steps: steps, result: { expanded: 0, pops: 0, pushes: 0, stale: 0, cost: null, pathLen: null, found: false, maxHeap: 0, path: [] } }; }
    if (!R || !C) return bad('The grid has no cells.');
    if (s < 0 || start[0] < 0 || start[1] < 0 || start[0] >= R || start[1] >= C || M.wall[s]) return bad('The start cell must be an open cell inside the grid.');
    if (goal && (goal[0] < 0 || goal[1] < 0 || goal[0] >= R || goal[1] >= C || M.wall[t])) return bad('The goal cell must be an open cell inside the grid.');

    g[s] = 0; codes[s] = 'f'; frontier = 1;
    var k0 = keyOf(s, 0);
    hpush({ k: s, g: 0, a: k0[0], b: k0[1], n: seq++ });
    var orderRule = algo === 'dijkstra' ? 'the smallest g (cost so far)' : algo === 'astar' ? 'the smallest f = g + h' : 'the smallest h (estimated distance left)';
    snap('init', {
      caption: nameAlgo + ' starts at S ' + cellName(start) + ' with g = 0. It will always expand the frontier cell with ' + orderRule + '.',
      line: 'init', flow: 'init', vars: { cell: null, g: 0, h: goal ? fmtN(h(s)) : null, f: goal ? fmtN(keyOf(s, 0)[0]) : null, open: 1 }
    });
    var pathCells = [];
    while (heap.length) {
      var e = hpop(); pops++;
      var u = e.k;
      if (closed[u] || (algo !== 'greedy' && e.g > g[u])) { staleCount++; continue; }
      if (current !== null && codes[current] === 'a') codes[current] = 'v';
      closed[u] = true; closedG[u] = g[u]; expanded++; frontier--;
      current = u; codes[u] = 'a';
      if (goal && u === t) {
        found = true;
        var path = [], q = u;
        while (q !== -1) { path.unshift(q); q = parent[q]; }
        cost = g[u]; pathLen = path.length - 1; pathCells = path;
        snap('found', {
          caption: algo === 'greedy'
            ? 'T is next in line, so greedy stops. The route it found costs ' + cost + ', but nothing proves it is the cheapest: greedy only looked at the estimate h and never at the cost g.'
            : algo === 'astar'
              ? 'T leaves the frontier with f = ' + fmtN(e.a) + ' = g. Every other frontier cell has f at least that, and with an optimistic h that means no cheaper route exists. Trace the parents back.'
              : 'T leaves the frontier at cost ' + cost + '. Every cell still waiting has a cost of at least that, so no cheaper route exists. Trace the parents back.',
          line: 'found', flow: 'found', vars: { cell: cellName(rc(u)), g: g[u], h: 0, f: fmtN(g[u]), open: frontier }
        });
        if (record) {
          var chunk = Math.max(1, Math.ceil(path.length / 8));
          for (var p = path.length - 1; p >= 0; p -= chunk) {
            for (var z = p; z > p - chunk && z >= 0; z--) codes[path[z]] = 'p';
            var reached = Math.max(0, p - chunk + 1);
            snap('path', {
              caption: reached === 0
                ? 'Back at S. The route has ' + plural(pathLen, 'step') + ' and costs ' + cost + ' in total (open cells cost 1, mud costs ' + mudCost + ').'
                : 'Each cell remembers which neighbour gave it its cost. Follow those parents from T back to S (' + (path.length - reached) + ' of ' + path.length + ' cells).',
              line: 'found', flow: 'found', vars: { cell: cellName(rc(path[reached])), g: g[path[reached]], h: 0, f: fmtN(g[path[reached]]), open: frontier }
            });
          }
        }
        break;
      }
      var added = 0, improved = 0;
      for (var d = 0; d < 4; d++) {
        var r = Math.floor(u / C) + DIRS[d][0], c = u % C + DIRS[d][1];
        if (r < 0 || c < 0 || r >= R || c >= C) continue;
        var v = r * C + c;
        if (M.wall[v] || closed[v]) continue;
        var ng = g[u] + (M.mud[v] ? mudCost : 1);
        if (algo === 'greedy') {
          if (g[v] !== Infinity) continue;
        } else if (ng >= g[v]) continue;
        if (g[v] === Infinity) { added++; codes[v] = 'f'; frontier++; } else improved++;
        g[v] = ng; parent[v] = u;
        var kv = keyOf(v, ng);
        hpush({ k: v, g: ng, a: kv[0], b: kv[1], n: seq++ });
      }
      var hv = goal ? h(u) : 0;
      var why = algo === 'dijkstra' ? 'g = ' + fmtN(g[u]) + ' is the smallest cost in the frontier'
        : algo === 'astar' ? 'f = g + h = ' + fmtN(g[u]) + ' + ' + fmtN(hv) + ' = ' + fmtN(g[u] + hw * hv) + ' is the smallest in the frontier'
          : 'h = ' + fmtN(hv) + ' is the smallest estimate in the frontier';
      snap('expand', {
        caption: 'Expand ' + cellName(rc(u)) + ': ' + why + '. ' + (added || improved
          ? (added ? plural(added, 'new neighbour') + ' join' + (added === 1 ? 's' : '') + ' the frontier' : '') + (added && improved ? ' and ' : '') + (improved ? plural(improved, 'neighbour') + ' get' + (improved === 1 ? 's' : '') + ' a cheaper route' : '') + '.'
          : 'No neighbour is new or cheaper: walls, edges and cells already done.'),
        line: ['pop', 'relax'], flow: 'expand', vars: { cell: cellName(rc(u)), g: g[u], h: goal ? fmtN(hv) : null, f: goal ? fmtN(g[u] + hw * hv) : null, open: frontier }
      });
    }
    if (!found) {
      if (current !== null && codes[current] === 'a') codes[current] = 'v';
      current = null;
      snap('none', {
        caption: 'The frontier is empty and T was never reached: walls cut it off. ' + nameAlgo + ' proves it after expanding ' + plural(expanded, 'cell') + '.',
        line: 'none', flow: 'none', vars: { cell: null, g: null, h: null, f: null, open: 0 }
      });
    }
    var maxG = 0;
    for (i = 0; i < N; i++) if (closedG[i] > maxG) maxG = closedG[i];
    steps.forEach(function (st) { st.maxG = maxG; });
    return { steps: steps, result: { expanded: expanded, pops: pops, pushes: pushes, stale: staleCount, cost: cost, pathLen: pathLen, found: found, maxHeap: maxHeap, path: pathCells.map(rc), maxG: maxG } };
  }

  function gridDijkstra(grid, start, goal, o) { return gridRun(grid, start, goal, Object.assign({}, o, { algo: 'dijkstra' })).steps; }
  function gridAStar(grid, start, goal, o) { return gridRun(grid, start, goal, Object.assign({}, o, { algo: 'astar' })).steps; }
  function gridGreedy(grid, start, goal, o) { return gridRun(grid, start, goal, Object.assign({}, o, { algo: 'greedy' })).steps; }
  function gridSearchResult(grid, start, goal, o) { return gridRun(grid, start, goal, Object.assign({}, o, { record: false })).result; }
  function gridCompare(grid, start, goal, o) {
    var out = {};
    ['dijkstra', 'astar', 'greedy'].forEach(function (a) { out[a] = gridSearchResult(grid, start, goal, Object.assign({}, o, { algo: a })); });
    out.best = out.dijkstra.cost;
    return out;
  }

  /* ================================================================== input */

  /* parseWeightedEdgeList("A-B:4, B-C:2, D", {maxNodes, maxEdges, allowNegative, directed})
     A token is "A-B:4" (also "A B 4" or "A-B 4"); a lone name is an isolated vertex; a missing weight is 1.
     Names: letters and digits, up to 3 characters. Weights: whole numbers 0..99 (negative only if allowed). */
  function parseWeightedEdgeList(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.maxNodes, maxEdges = opts.maxEdges || LIMITS.maxEdges, maxW = opts.maxWeight || LIMITS.maxWeight;
    var src = String(text === undefined || text === null ? '' : text).trim();
    if (!src) return { values: null, error: 'Type at least one edge with a weight, for example A-B:4, B-C:2.' };
    var tokens = src.split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var nodes = [], seenN = {}, edges = [], seenE = {}, directed = !!opts.directed;
    function addNode(n) { if (!seenN[n]) { seenN[n] = true; nodes.push(n); } }
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      var m = /^([A-Za-z0-9]{1,3})\s*(?:-+>?|–|—|\s)\s*([A-Za-z0-9]{1,3})(?:\s*(?::|=|\s)\s*(−|-)?\s*(\d+(?:\.\d+)?))?$/.exec(tk);
      if (!m) {
        if (/^[A-Za-z0-9]{1,3}$/.test(tk)) { addNode(tk.toUpperCase()); continue; }
        return { values: null, error: '“' + tk + '” is not an edge. Write it like A-B:4 (two vertex names of up to 3 letters or digits, then a weight).' };
      }
      var a = m[1].toUpperCase(), c = m[2].toUpperCase(), w = m[4] === undefined ? 1 : Number(m[4]);
      if (m[3]) w = -w;
      if (a === c) return { values: null, error: '“' + tk + '” joins a vertex to itself. Self-loops are not allowed here.' };
      if (w !== Math.round(w)) return { values: null, error: 'Weights must be whole numbers, but “' + tk + '” has ' + w + '.' };
      if (w < 0 && !opts.allowNegative) return { values: null, error: 'Weight ' + w + ' in “' + tk + '” is negative. Dijkstra needs weights of 0 or more; negative edges are Bellman-Ford’s job.' };
      if (Math.abs(w) > maxW) return { values: null, error: 'Weight ' + w + ' in “' + tk + '” is too large. Keep weights between 0 and ' + maxW + ' so they stay readable.' };
      addNode(a); addNode(c);
      var key = edgeKey(a, c, directed);
      if (seenE[key]) { if (w < seenE[key][2]) seenE[key][2] = w; continue; }
      seenE[key] = [a, c, w];
      edges.push(seenE[key]);
    }
    if (nodes.length > maxNodes) return { values: null, error: 'That is ' + nodes.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges, directed: directed }, error: null };
  }

  /* randomWeightedGraph(n, m, rng, {directed, connected, maxW, minW, letters}) -> {nodes, edges: [[a, b, w]], directed} */
  function randomWeightedGraph(n, m, rng, opts) {
    opts = opts || {};
    var nodes = [];
    for (var i = 0; i < n; i++) nodes.push(opts.letters ? String.fromCharCode(65 + i) : 'V' + i);
    var edges = [], keys = {}, directed = !!opts.directed;
    var minW = opts.minW === undefined ? 1 : opts.minW, maxW = opts.maxW || 9;
    var maxM = directed ? n * (n - 1) : n * (n - 1) / 2;
    m = Math.max(0, Math.min(m, maxM));
    function weight() { return minW + Math.floor(rng() * (maxW - minW + 1)); }
    function add(x, y) {
      if (x === y) return false;
      var k = edgeKey(nodes[x], nodes[y], directed);
      if (keys[k]) return false;
      keys[k] = true; edges.push([nodes[x], nodes[y], weight()]); return true;
    }
    if (opts.connected) for (var j = 1; j < n && edges.length < m; j++) add(Math.floor(rng() * j), j);
    var guard = 0;
    while (edges.length < m && guard++ < m * 50 + 1000) add(Math.floor(rng() * n), Math.floor(rng() * n));
    return { nodes: nodes, edges: edges, directed: directed };
  }

  return {
    LIMITS: LIMITS, HEURISTICS: HEURISTICS,
    natCmp: natCmp, edgeKey: edgeKey, normalize: normalize, pathTo: pathTo, pathCost: pathCost,
    bellmanFord: bellmanFord, fewestEdges: fewestEdges,
    dijkstra: dijkstra, dijkstraResult: dijkstraResult, negativeDemo: negativeDemo,
    gridModel: gridModel, gridDijkstra: gridDijkstra, gridAStar: gridAStar, gridGreedy: gridGreedy,
    gridSearchResult: gridSearchResult, gridCompare: gridCompare,
    parseWeightedEdgeList: parseWeightedEdgeList, randomWeightedGraph: randomWeightedGraph
  };
}));
