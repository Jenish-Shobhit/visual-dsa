/* Lesson 29 · Bellman-Ford & Floyd-Warshall — pure step generators (no DOM).

   Browser: VDSA.algos.shortestPaths.  Node: module.exports.

     var SP = VDSA.algos.shortestPaths;
     SP.bellmanFord(graph, 's', {order})      one step per edge scan, per relaxation, per round; early exit;
                                              round V check; the negative cycle is reported when round V still relaxes
     SP.bfResult(graph, 's', {order})         the same run without steps: dist, parent, rounds, checks, relaxed, cycle
     SP.layers(graph, 's', {rounds})          "paths with at most k edges": synchronous rounds with the path of each vertex
     SP.floydWarshall(graph, {mode})          matrix passes k = 1..V ('improve': one step per improved cell,
                                              'all': one step per cell); next-hop matrix; negative diagonal
     SP.fwResult(graph)                       final matrix, next-hop matrix, negative-cycle flag, counters
     SP.warshallClosure(graph)                the boolean version (transitive closure), same step shape
     SP.pathFromNext(next, i, j)              vertex indices of a route, or null
     SP.negativeCycle(graph)                  a negative cycle anywhere in the graph (virtual source), or null
     SP.johnson(graph)                        potentials h and the reweighted edges (null with a negative cycle)
     SP.arbitrageGraph / SP.bestCycle         currency rates -> -ln weights; best simple cycle by product
     SP.parseGraph(text, opts)                "S>T:6, T>X:5, Z" -> {values: graph, error}
     SP.randomGraph(n, m, rng, opts)          reproducible; negative edges but no negative cycle unless asked
     SP.opModel(V, density)                   operation counts of the approaches compared in the cost chart

   Graph input: {nodes: ['S', 'T'] | [{id, x, y}], edges: [{from, to, w}], directed: true}. Distances use null for
   infinity in snapshots (so they stay plain data); the variable watch gets Infinity.

   Bellman-Ford step: {algo:'bf', kind: init|round|scan|relax|roundEnd|early|cycle|done, caption, line, flow,
     vars, counters {round, checks, relaxed}, dist, parent, round, rounds (= V - 1), verify (true in round V),
     u, v (ids being examined), pos (position in `order` of the edge being scanned, or -1), edge (its index in
     graph.edges), marks (one entry per position in `order` for the current round: null|'yes'|'no'|'skip'),
     order, updated {id: true} (vertices improved in the current round), cycle [ids] | null, final (distances
     are proved final), early}.

   Floyd-Warshall step: {algo:'fw', kind: init|kstart|check|update|kend|done, caption, line, flow, vars,
     counters {pass, checks, updates}, ids, d (n x n, null = infinity), next (n x n, index | null),
     k (index | -1), i, j, via {a: [i,k], b: [k,j]} | null, cand, path [indices] | null, pathKind 'try' | 'take',
     improved (n x n booleans: differs from the input matrix), passUpdates [[i,j]...], neg [indices with d < 0 on
     the diagonal], negCycle (final step only)}. */
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

  var LIMITS = { maxNodes: 8, maxEdges: 16, maxFwNodes: 6, minW: -99, maxW: 99 };

  /* ================================================================== graph helpers */
  function nodeIds(g) {
    var ids = [], seen = {};
    function add(id) { id = String(id); if (!seen[id]) { seen[id] = true; ids.push(id); } }
    (g.nodes || []).forEach(function (n) { add(typeof n === 'object' ? n.id : n); });
    (g.edges || []).forEach(function (e) { add(e.from); add(e.to); });
    return ids;
  }
  function edgeId(a, b) { return a + '-' + b; }
  function cleanEdges(g) {
    return (g.edges || []).map(function (e) { return { from: String(e.from), to: String(e.to), w: e.w === undefined ? 1 : +e.w }; });
  }
  function copyObj(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }
  function fmtD(x) { return x === null || x === undefined ? '∞' : (x < 0 ? '−' + (-x) : String(x)); }
  function fmtW(w) { return w < 0 ? '−' + (-w) : String(w); }
  function inf(x) { return x === null || x === undefined ? Infinity : x; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* Edge order: 'listed' (default), 'reverse', or an explicit array of edge indices. */
  function edgeOrder(m, order) {
    var idx = [], i;
    if (Array.isArray(order) && order.length === m) {
      var seen = {}, ok = true;
      order.forEach(function (x) { if (x < 0 || x >= m || seen[x]) ok = false; seen[x] = true; });
      if (ok) return order.slice();
    }
    for (i = 0; i < m; i++) idx.push(i);
    if (order === 'reverse') idx.reverse();
    return idx;
  }

  /* ================================================================== negative cycles */
  /* Given a relaxable edge after V - 1 rounds, find a cycle in the parent pointers. Walking back V times from the
     relaxed vertex lands on a cycle whenever the parent graph has one; if it does not yet, keep relaxing silently
     (on copies) until the parent pointers close a loop. Returns ids in edge direction, or null. */
  function cycleFrom(ids, edges, dist, parent, ei) {
    var n = ids.length;
    var d = copyObj(dist), p = copyObj(parent);
    var e = edges[ei];
    function walk(v) {
      var x = v, i;
      for (i = 0; i < n; i++) { x = p[x]; if (x === null || x === undefined) return null; }
      var cyc = [x], y = p[x];
      while (y !== x) { cyc.push(y); y = p[y]; if (cyc.length > n + 1) return null; }
      return cyc.reverse();
    }
    d[e.to] = d[e.from] + e.w; p[e.to] = e.from;
    var c = walk(e.to);
    if (c) return c;
    for (var pass = 0; pass < 3 * n + 3; pass++) {
      for (var k = 0; k < edges.length; k++) {
        var f = edges[k];
        if (d[f.from] !== null && (d[f.to] === null || d[f.from] + f.w < d[f.to])) {
          d[f.to] = d[f.from] + f.w; p[f.to] = f.from;
          c = walk(f.to);
          if (c) return c;
        }
      }
    }
    return null;
  }
  function cycleWeight(edges, cyc) {
    var W = {};
    edges.forEach(function (e) { W[edgeId(e.from, e.to)] = e.w; });
    var sum = 0;
    for (var i = 0; i < cyc.length; i++) sum += W[edgeId(cyc[i], cyc[(i + 1) % cyc.length])];
    return sum;
  }

  /* A negative cycle anywhere in the graph (a virtual source with a 0-edge to every vertex), or null. */
  function negativeCycle(g) {
    var ids = nodeIds(g), edges = cleanEdges(g), n = ids.length;
    var dist = {}, parent = {};
    ids.forEach(function (id) { dist[id] = 0; parent[id] = null; });
    for (var r = 0; r < n; r++) {
      var any = false;
      for (var k = 0; k < edges.length; k++) {
        var e = edges[k];
        if (dist[e.from] + e.w < dist[e.to]) {
          if (r === n - 1) return cycleFrom(ids, edges, dist, parent, k);
          dist[e.to] = dist[e.from] + e.w; parent[e.to] = e.from; any = true;
        }
      }
      if (!any) return null;
    }
    return null;
  }

  /* ================================================================== Bellman-Ford */
  function bellmanFord(g, source, opts) {
    opts = opts || {};
    var ids = nodeIds(g), n = ids.length, edges = cleanEdges(g), m = edges.length;
    if (!n) return [];
    source = String(source);
    if (ids.indexOf(source) < 0) source = ids[0];
    var order = edgeOrder(m, opts.order);
    var dist = {}, parent = {};
    ids.forEach(function (id) { dist[id] = null; parent[id] = null; });
    dist[source] = 0;
    var steps = [], checks = 0, relaxed = 0, round = 0, marks = order.map(function () { return null; }), updated = {};
    var rounds = Math.max(0, n - 1);
    var fin = false;

    function snap(kind, caption, line, flow, o) {
      o = o || {};
      var u = o.u === undefined ? null : o.u, v = o.v === undefined ? null : o.v;
      var pos = o.pos === undefined ? -1 : o.pos;
      var ed = pos >= 0 ? edges[order[pos]] : null;
      var du = u !== null ? dist[u] : null;
      var vars = {
        round: round,
        edge: ed ? { raw: ed.from + ' → ' + ed.to + '  (w = ' + fmtW(ed.w) + ')' } : null,
        'dist[u]': u !== null ? inf(du) : null,
        'dist[u] + w': ed && du !== null ? du + ed.w : (ed ? Infinity : null),
        'dist[v]': v !== null ? inf(dist[v]) : null,
        relaxed: relaxed
      };
      steps.push({
        algo: 'bf', kind: kind, caption: caption, line: line, flow: flow, vars: vars,
        counters: { round: round, checks: checks, relaxed: relaxed },
        dist: copyObj(dist), parent: copyObj(parent), round: round, rounds: rounds, verify: !!o.verify,
        u: u, v: v, pos: pos, edge: ed ? order[pos] : -1, marks: marks.slice(), order: order.slice(),
        updated: copyObj(updated), cycle: o.cycle || null, final: !!o.final, early: !!o.early, result: o.result || null,
        source: source, ids: ids
      });
    }

    snap('init', 'Nothing is known yet, so every distance is <b>∞</b>. Only <b>' + source + '</b> is known: it is 0 edges and 0 cost from itself. Each number is a promise “I know a route this cheap”, and rounds can only make the promises cheaper.', 'init', 'init');

    function scanRound(verifyRound) {
      var changedCount = 0;
      for (var p = 0; p < m; p++) {
        var e = edges[order[p]], du = dist[e.from], dv = dist[e.to];
        checks++;
        var ename = '<b>' + e.from + ' → ' + e.to + '</b> (' + fmtW(e.w) + ')';
        if (du === null) {
          marks[p] = 'skip';
          snap('scan', ename + ': <b>d[' + e.from + '] is still ∞</b>, so there is no known route to ' + e.from + ' to extend. ∞ + ' + fmtW(e.w) + ' is still ∞. Skip it.', verifyRound ? 'verify' : 'check', verifyRound ? 'verify' : 'check', { u: e.from, v: e.to, pos: p, verify: verifyRound, result: 'skip' });
          continue;
        }
        var cand = du + e.w;
        var better = dv === null || cand < dv;
        var sum = 'd[' + e.from + '] + w = ' + fmtD(du) + ' + ' + fmtW(e.w) + ' = <b>' + fmtD(cand) + '</b>';
        if (!better) {
          marks[p] = 'no';
          snap('scan', ename + ': ' + sum + ' is not less than d[' + e.to + '] = ' + fmtD(dv) + '. Going through ' + e.from + ' is no better than what we already have.', verifyRound ? 'verify' : 'check', verifyRound ? 'verify' : 'check', { u: e.from, v: e.to, pos: p, verify: verifyRound, result: 'no' });
          continue;
        }
        marks[p] = 'yes';
        if (verifyRound) {
          // round V still improves something: a negative cycle. Report it and stop.
          var cyc = cycleFrom(ids, edges, dist, parent, order[p]);
          var cw = cyc ? cycleWeight(edges, cyc) : null;
          snap('cycle', ename + ': ' + sum + ' is <b>still less than</b> d[' + e.to + '] = ' + fmtD(dv) + '. After V − 1 = ' + rounds + ' rounds every honest distance is final, so this improvement is impossible unless a path can loop and keep getting cheaper: a <b>negative cycle</b>' + (cyc ? ' (' + cyc.join(' → ') + ' → ' + cyc[0] + ', total ' + fmtW(cw) + ')' : '') + '. Distances are undefined.', 'cycle', 'cycle', { u: e.from, v: e.to, pos: p, verify: true, cycle: cyc, result: 'yes' });
          return { cycle: cyc || [], found: true };
        }
        snap('scan', ename + ': ' + sum + ' is <b>less than</b> d[' + e.to + '] = ' + fmtD(dv) + '. A cheaper route to ' + e.to + ' just appeared.', 'check', 'check', { u: e.from, v: e.to, pos: p, result: 'yes' });
        dist[e.to] = cand; parent[e.to] = e.from; relaxed++; changedCount++; updated[e.to] = true;
        snap('relax', '<b>Relax</b>: d[' + e.to + '] ← ' + fmtD(cand) + ', and remember that ' + e.to + ' is reached from ' + e.from + '. Later edges in this same round can already use the new value.', 'relax', 'relax', { u: e.from, v: e.to, pos: p, result: 'yes' });
      }
      return { changed: changedCount, found: false };
    }

    var early = false, lastChanged = true;
    for (round = 1; round <= rounds; round++) {
      marks = order.map(function () { return null; }); updated = {};
      snap('round', '<b>Round ' + round + ' of ' + rounds + '.</b> Walk through all ' + plural(m, 'edge') + ' once, in the order shown on the edge tape below, and try to relax each one.', 'round', 'round');
      var res = scanRound(false);
      lastChanged = res.changed > 0;
      if (!lastChanged) {
        early = true;
        fin = true;
        snap('early', '<b>Round ' + round + ' relaxed nothing.</b> If a whole round changes no distance, the next round would see exactly the same numbers, so nothing can ever change again: every distance is final. We stop after ' + plural(round, 'round') + ' instead of ' + rounds + '.', 'early', 'done', { final: true, early: true });
        break;
      }
      snap('roundEnd', '<b>End of round ' + round + '.</b> ' + plural(res.changed, 'distance') + ' improved' + (round < rounds ? ', so at least one more round is needed.' : '. That was round V − 1, the most a shortest path could ever need.'), 'early', 'changed');
    }
    if (!early) {
      round = n;   // the check round is round V
      marks = order.map(function () { return null; });
      snap('round', '<b>Round ' + n + ' (the check).</b> Distances should be final now, because a shortest path never repeats a vertex, so it has at most V − 1 = ' + rounds + ' edges. Try every edge once more: if any edge still improves something, there is a negative cycle.', 'verify', 'verify', { verify: true });
      var chk = scanRound(true);
      if (chk.found) return steps;
      fin = true;
      snap('done', '<b>Round ' + n + ' relaxed nothing.</b> No negative cycle is reachable from ' + source + ', so all distances are final.', 'done', 'done', { verify: true, final: true });
    } else {
      // the early-exit step already carries final: true; add the closing step
      snap('done', 'Done after ' + plural(round, 'round') + '. Green vertices are settled; grey ones cannot be reached from ' + source + '.', 'done', 'done', { final: true, early: true });
    }
    return steps;
  }

  function bfResult(g, source, opts) {
    var steps = bellmanFord(g, source, opts), st = steps[steps.length - 1];
    var cyc = null, early = false, roundsRun = 0;
    steps.forEach(function (s) {
      if (s.kind === 'cycle') cyc = s.cycle;
      if (s.kind === 'early') early = true;
      if (s.kind === 'roundEnd' || s.kind === 'early') roundsRun++;
    });
    return { dist: st.dist, parent: st.parent, rounds: roundsRun, checks: st.counters.checks, relaxed: st.counters.relaxed, cycle: cyc, early: early, hasCycle: st.kind === 'cycle', steps: steps.length };
  }

  /* ================================================================== paths with at most k edges */
  /* Synchronous rounds: d_k[v] = the cheapest walk from the source using at most k edges. `paths[v]` is such a walk. */
  function layers(g, source, opts) {
    opts = opts || {};
    var ids = nodeIds(g), n = ids.length, edges = cleanEdges(g);
    if (!n) return [];
    source = String(source);
    if (ids.indexOf(source) < 0) source = ids[0];
    var rounds = opts.rounds === undefined ? Math.max(0, n - 1) : opts.rounds;
    var d = {}, paths = {};
    ids.forEach(function (id) { d[id] = null; paths[id] = null; });
    d[source] = 0; paths[source] = [source];
    var out = [{ k: 0, dist: copyObj(d), paths: copyObj(paths), changed: {}, stable: false }];
    for (var k = 1; k <= rounds; k++) {
      var nd = copyObj(d), np = copyObj(paths), ch = {};
      edges.forEach(function (e) {
        if (d[e.from] === null) return;
        var c = d[e.from] + e.w;
        if (nd[e.to] === null || c < nd[e.to]) { nd[e.to] = c; np[e.to] = paths[e.from].concat(e.to); ch[e.to] = true; }
      });
      d = nd; paths = np;
      out.push({ k: k, dist: copyObj(d), paths: copyObj(paths), changed: ch, stable: Object.keys(ch).length === 0 });
    }
    return out;
  }

  /* ================================================================== Floyd-Warshall */
  function matrix(n, fill) {
    var m = [];
    for (var i = 0; i < n; i++) { m.push([]); for (var j = 0; j < n; j++) m[i].push(fill); }
    return m;
  }
  function copyM(m) { return m.map(function (r) { return r.slice(); }); }

  function pathFromNext(next, i, j) {
    if (i === j) return [i];
    if (next[i][j] === null || next[i][j] === undefined) return null;
    var path = [i], u = i, guard = next.length + 2;
    while (u !== j) {
      u = next[u][j];
      if (u === null || u === undefined || path.length > guard) return null;
      path.push(u);
    }
    return path;
  }

  function fwSetup(g) {
    var ids = nodeIds(g), n = ids.length, edges = cleanEdges(g);
    var idx = {};
    ids.forEach(function (id, i) { idx[id] = i; });
    var d = matrix(n, null), nxt = matrix(n, null);
    for (var i = 0; i < n; i++) d[i][i] = 0;
    edges.forEach(function (e) {
      var a = idx[e.from], b = idx[e.to];
      if (a === b) { if (e.w < d[a][a]) { d[a][a] = e.w; nxt[a][a] = a; } return; }
      if (d[a][b] === null || e.w < d[a][b]) { d[a][b] = e.w; nxt[a][b] = b; }
    });
    return { ids: ids, n: n, edges: edges, idx: idx, d: d, nxt: nxt };
  }

  function floydWarshall(g, opts) {
    opts = opts || {};
    var mode = opts.mode === 'all' ? 'all' : 'improve';
    var S = fwSetup(g), n = S.n, ids = S.ids, d = S.d, nxt = S.nxt;
    if (!n) return [];
    var steps = [], checks = 0, updates = 0;
    var improved = matrix(n, false), passUpdates = [];
    var negSet = {};
    var base = copyM(d);

    function negList() { var r = []; for (var i = 0; i < n; i++) if (d[i][i] < 0) r.push(i); return r; }
    function nm(i) { return ids[i]; }
    function snap(kind, caption, line, flow, o) {
      o = o || {};
      var k = o.k === undefined ? -1 : o.k, i = o.i === undefined ? -1 : o.i, j = o.j === undefined ? -1 : o.j;
      var vars = {
        k: k >= 0 ? { raw: nm(k) } : null,
        i: i >= 0 ? { raw: nm(i) } : null,
        j: j >= 0 ? { raw: nm(j) } : null,
        'd[i][k]': i >= 0 && k >= 0 ? inf(d[i][k]) : null,
        'd[k][j]': k >= 0 && j >= 0 ? inf(d[k][j]) : null,
        'via k': o.cand === undefined || o.cand === null ? (o.cand === null ? Infinity : null) : o.cand,
        'd[i][j]': i >= 0 && j >= 0 ? inf(d[i][j]) : null
      };
      steps.push({
        algo: 'fw', kind: kind, caption: caption, line: line, flow: flow, vars: vars,
        counters: { pass: k >= 0 ? k + 1 : (o.done ? n : 0), checks: checks, updates: updates },
        ids: ids, n: n, d: copyM(d), next: copyM(nxt), k: k, i: i, j: j,
        via: o.via || null, cand: o.cand === undefined ? null : o.cand, path: o.path || null, pathKind: o.pathKind || null,
        improved: copyM(improved), passUpdates: passUpdates.map(function (p) { return p.slice(); }),
        neg: negList(), negCycle: !!o.negCycle, result: o.result || null, cell: o.cell || null
      });
    }

    snap('init', 'The starting matrix: <b>d[i][j]</b> is the cost of the single edge i → j, 0 on the diagonal, and <b>∞</b> when there is no edge. This is the best route that uses <b>no intermediate vertex at all</b>.', 'init', 'init');

    for (var k = 0; k < n; k++) {
      passUpdates = [];
      var kn = nm(k);
      snap('kstart', '<b>Pass ' + (k + 1) + ': allow ' + kn + ' as a stopover.</b> Every cell (i, j) now asks: is going i → <b>' + kn + '</b> → j cheaper than what I have? Only row ' + kn + ' and column ' + kn + ' (highlighted) are ever read.', 'pass', 'pass', { k: k });
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          var a = d[i][k], b = d[k][j];
          checks++;
          var cand = a !== null && b !== null ? a + b : null;
          var better = cand !== null && (d[i][j] === null || cand < d[i][j]);
          var via = { a: [i, k], b: [k, j] };
          var pathTry = null;
          if (cand !== null) {
            var p1 = pathFromNext(nxt, i, k), p2 = pathFromNext(nxt, k, j);
            pathTry = p1 && p2 ? p1.concat(p2.slice(1)) : null;
          }
          var cellName = 'd[' + nm(i) + '][' + nm(j) + ']';
          if (mode === 'all') {
            var why;
            if (a === null) why = 'd[' + nm(i) + '][' + kn + '] is ∞: there is no known way to reach ' + kn + ' from ' + nm(i) + ' yet.';
            else if (b === null) why = 'd[' + kn + '][' + nm(j) + '] is ∞: there is no known way to leave ' + kn + ' towards ' + nm(j) + ' yet.';
            else why = fmtD(a) + ' + ' + fmtD(b) + ' = <b>' + fmtD(cand) + '</b> ' + (better ? 'beats ' + cellName + ' = ' + fmtD(d[i][j]) + '.' : 'does not beat ' + cellName + ' = ' + fmtD(d[i][j]) + '.');
            snap('check', '<b>' + nm(i) + ' → ' + kn + ' → ' + nm(j) + '.</b> ' + why, 'check', 'check', { k: k, i: i, j: j, via: via, cand: cand, path: pathTry, pathKind: 'try', result: better ? 'yes' : (cand === null ? 'skip' : 'no'), cell: [i, j] });
          }
          if (better) {
            var old = d[i][j];
            d[i][j] = cand;
            // the first hop of i -> j is now the first hop of i -> k
            nxt[i][j] = nxt[i][k] !== null ? nxt[i][k] : (i === k ? nxt[k][j] : nxt[i][j]);
            improved[i][j] = true; updates++;
            passUpdates.push([i, j]);
            var selfCyc = i === j && cand < 0;
            var capt = '<b>Update ' + cellName + ' ← ' + fmtD(cand) + '.</b> ' + nm(i) + ' → ' + kn + ' → ' + nm(j) + ' costs ' + fmtD(a) + ' + ' + fmtD(b) + ' = ' + fmtD(cand) + ', ' + (old === null ? 'and there was no route at all before.' : 'cheaper than the ' + fmtD(old) + ' we had.');
            if (selfCyc) capt += ' A route from ' + nm(i) + ' back to itself with negative cost: <b>a negative cycle</b>.';
            snap('update', capt, 'update', 'update', { k: k, i: i, j: j, via: via, cand: cand, path: pathTry, pathKind: 'take', dOld: old, result: 'yes', cell: [i, j] });
          }
        }
      }
      snap('kend', '<b>Pass ' + (k + 1) + ' done.</b> ' + (passUpdates.length ? plural(passUpdates.length, 'cell') + ' improved. From now on every entry is the cheapest route whose stopovers come only from {' + ids.slice(0, k + 1).join(', ') + '}.' : 'No cell improved: allowing ' + kn + ' as a stopover changes nothing here. Every entry is still the cheapest route with stopovers from {' + ids.slice(0, k + 1).join(', ') + '}.'), 'pass', 'pass', { k: k });
    }
    passUpdates = [];
    var neg = negList();
    if (neg.length) {
      snap('done', '<b>Negative cycle.</b> ' + neg.map(nm).join(', ') + (neg.length === 1 ? ' has' : ' have') + ' a <b>negative number on the diagonal</b>: a route from the vertex back to itself that costs less than nothing. Going round it again would make it cheaper forever, so the other entries are not real distances.', 'done', 'done', { negCycle: true, done: true });
    } else {
      snap('done', '<b>All pairs done.</b> Row i is the shortest-path tree of vertex i: d[i][j] is the cost of the cheapest route from i to j, and ∞ means j cannot be reached. The diagonal is all zeros, so there is no negative cycle.', 'done', 'done', { done: true });
    }
    void base;
    return steps;
  }

  function fwResult(g) {
    var steps = floydWarshall(g, { mode: 'improve' });
    if (!steps.length) return { d: [], next: [], ids: [], negCycle: false, checks: 0, updates: 0 };
    var st = steps[steps.length - 1];
    return { d: st.d, next: st.next, ids: st.ids, negCycle: st.negCycle, checks: st.counters.checks, updates: st.counters.updates };
  }

  /* ================================================================== transitive closure (Warshall) */
  function warshallClosure(g) {
    var S = fwSetup(g), n = S.n, ids = S.ids;
    if (!n) return [];
    var r = matrix(n, null);
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) if (S.d[a][b] !== null) r[a][b] = 1;
    var steps = [], updates = 0, checks = 0, improved = matrix(n, false), passUpdates = [];
    function nm(i) { return ids[i]; }
    function snap(kind, caption, line, o) {
      o = o || {};
      steps.push({
        algo: 'closure', kind: kind, caption: caption, line: line, flow: null,
        vars: { k: o.k >= 0 ? { raw: nm(o.k) } : null, i: o.i >= 0 ? { raw: nm(o.i) } : null, j: o.j >= 0 ? { raw: nm(o.j) } : null },
        counters: { checks: checks, newPairs: updates },
        ids: ids, n: n, d: copyM(r), next: matrix(n, null), k: o.k === undefined ? -1 : o.k, i: o.i === undefined ? -1 : o.i, j: o.j === undefined ? -1 : o.j,
        via: o.via || null, cand: null, path: null, pathKind: null, improved: copyM(improved),
        passUpdates: passUpdates.map(function (p) { return p.slice(); }), neg: [], negCycle: false
      });
    }
    snap('init', 'A 1 means “j can be reached from i by following edges”. At the start that is only the direct edges, plus every vertex reaching itself.', 'init');
    for (var k = 0; k < n; k++) {
      passUpdates = [];
      snap('kstart', '<b>Allow ' + nm(k) + ' as a stopover.</b> If i can reach ' + nm(k) + ' <em>and</em> ' + nm(k) + ' can reach j, then i can reach j.', 'pass', { k: k });
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          checks++;
          if (r[i][j] === null && r[i][k] !== null && r[k][j] !== null) {
            r[i][j] = 1; improved[i][j] = true; updates++; passUpdates.push([i, j]);
            snap('update', '<b>' + nm(i) + ' now reaches ' + nm(j) + '</b>: ' + nm(i) + ' reaches ' + nm(k) + ' (1) and ' + nm(k) + ' reaches ' + nm(j) + ' (1), so r[' + nm(i) + '][' + nm(j) + '] ← 1. No number is added: “or” and “and” replace “min” and “+”.', 'update', { k: k, i: i, j: j, via: { a: [i, k], b: [k, j] } });
          }
        }
      }
      snap('kend', '<b>Pass ' + (k + 1) + ' done:</b> ' + (passUpdates.length ? plural(passUpdates.length, 'new pair') + ' found.' : 'no new pair.'), 'pass', { k: k });
    }
    passUpdates = [];
    snap('done', '<b>Transitive closure done.</b> Row i lists everything reachable from i. A 0 means “no route at all”. Same three loops as Floyd-Warshall, so O(V³).', 'done', {});
    return steps;
  }

  /* ================================================================== Johnson's reweighting */
  /* Potentials h[v] = shortest distance from a virtual source with 0-weight edges to every vertex. */
  function johnson(g) {
    var ids = nodeIds(g), edges = cleanEdges(g), n = ids.length;
    var h = {};
    ids.forEach(function (id) { h[id] = 0; });
    for (var r = 0; r < n; r++) {
      var any = false;
      edges.forEach(function (e) { if (h[e.from] + e.w < h[e.to]) { h[e.to] = h[e.from] + e.w; any = true; } });
      if (!any) break;
      if (r === n - 1 && any) return null;
    }
    var re = edges.map(function (e) { return { from: e.from, to: e.to, w: e.w, w2: e.w + h[e.from] - h[e.to] }; });
    return { h: h, edges: re };
  }

  /* ================================================================== currency arbitrage */
  /* rates: {'USD>EUR': 0.92, ...}. Weight of an edge = −ln(rate), so a product of rates > 1 is a negative sum. */
  function arbitrageGraph(currencies, rates) {
    var edges = [];
    currencies.forEach(function (a) {
      currencies.forEach(function (b) {
        var r = rates[a + '>' + b];
        if (a !== b && r > 0) edges.push({ from: a, to: b, w: -Math.log(r) });
      });
    });
    return { nodes: currencies.slice(), edges: edges, directed: true };
  }
  /* Three currencies USD, EUR, GBP. `fwd` holds the quotes of the loop USD>EUR, EUR>GBP, GBP>USD (what the reader
     moves); the return quotes are fixed at the fair value of the loop less a 1 % spread, so a fair market has no
     profit loop and a mis-quoted forward edge creates one. */
  var FAIR = { 'USD>EUR': 0.92, 'EUR>GBP': 0.86, 'GBP>USD': 1 / (0.92 * 0.86) };
  function arbitrageRates(fwd, spread) {
    spread = spread === undefined ? 0.01 : spread;
    var r = {
      'USD>EUR': fwd['USD>EUR'], 'EUR>GBP': fwd['EUR>GBP'], 'GBP>USD': fwd['GBP>USD'],
      'EUR>USD': (1 - spread) / FAIR['USD>EUR'], 'GBP>EUR': (1 - spread) / FAIR['EUR>GBP'], 'USD>GBP': (1 - spread) / FAIR['GBP>USD']
    };
    return r;
  }
  /* The simple cycle with the largest product of rates (brute force; use with <= 6 currencies). */
  function bestCycle(currencies, rates) {
    var best = null, n = currencies.length;
    function dfs(start, path, prod) {
      var last = path[path.length - 1];
      for (var i = 0; i < n; i++) {
        var c = currencies[i], r = rates[last + '>' + c];
        if (!(r > 0) || c === last) continue;
        if (c === start) {
          var total = prod * r;
          if (!best || total > best.product) best = { cycle: path.slice(), product: total };
        } else if (path.indexOf(c) < 0 && currencies.indexOf(c) > currencies.indexOf(start)) {
          path.push(c); dfs(start, path, prod * r); path.pop();
        }
      }
    }
    currencies.forEach(function (s) { dfs(s, [s], 1); });
    return best;
  }

  /* ================================================================== operation model for the cost chart */
  /* Worst-case operation counts for all-pairs shortest paths on V vertices with E edges. */
  function opModel(V, density) {
    var E = density === 'dense' ? V * (V - 1) / 2 : 3 * V;
    var lg = Math.max(1, Math.log2(Math.max(2, V)));
    return {
      V: V, E: E,
      fw: V * V * V,
      dijkstra: V * (E + V) * lg,
      bellman: V * (V - 1) * E,
      johnson: V * E + V * (E + V) * lg
    };
  }

  /* ================================================================== input parsing and random graphs */
  function parseGraph(text, o) {
    o = o || {};
    var maxNodes = o.maxNodes || LIMITS.maxNodes, maxEdges = o.maxEdges || LIMITS.maxEdges;
    var toks = String(text || '').split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    var nodes = [], seenN = {}, edges = [], seenE = {};
    function addNode(id) { if (!seenN[id]) { seenN[id] = true; nodes.push(id); } }
    if (!toks.length) return { values: null, error: 'Type at least one edge such as S>T:6, or a vertex name.' };
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      var m = /^([A-Za-z0-9_]{1,3})\s*(?:->|→|>)\s*([A-Za-z0-9_]{1,3})\s*(?::\s*([+\-−]?\s*\d+))?$/.exec(t);
      if (m) {
        var a = m[1], b = m[2], w = m[3] === undefined ? 1 : parseInt(m[3].replace('−', '-').replace(/\s+/g, ''), 10);
        if (a === b) return { values: null, error: '“' + t + '” is a self-loop. Use two different vertices.' };
        if (w < LIMITS.minW || w > LIMITS.maxW) return { values: null, error: 'The weight in “' + t + '” must be between ' + LIMITS.minW + ' and ' + LIMITS.maxW + '.' };
        if (seenE[a + '>' + b]) return { values: null, error: 'The edge ' + a + '>' + b + ' appears twice. Keep one of them.' };
        seenE[a + '>' + b] = true;
        addNode(a); addNode(b);
        edges.push({ from: a, to: b, w: w });
      } else if (/^[A-Za-z0-9_]{1,3}$/.test(t)) {
        addNode(t);
      } else {
        return { values: null, error: 'I could not read “' + t + '”. Write edges as S>T:6 (from, to, weight), and separate them with commas.' };
      }
    }
    if (nodes.length > maxNodes) return { values: null, error: 'That is ' + nodes.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges, directed: true }, error: null };
  }

  /* n vertices named A, B, ...; m edges; every vertex reachable from A. Weights: base + h[u] - h[v] with base >= 1
     (so any cycle sums to a positive number even though single edges can be negative). */
  function randomGraph(n, m, rng, o) {
    o = o || {};
    var ids = [], i;
    for (i = 0; i < n; i++) ids.push(String.fromCharCode(65 + i));
    var h = ids.map(function () { return o.negative === false ? 0 : rng.int(0, 7); });
    var edges = [], seen = {};
    function add(a, b, w) {
      if (a === b || seen[a + '>' + b]) return false;
      seen[a + '>' + b] = true; edges.push({ from: ids[a], to: ids[b], w: w === undefined ? rng.int(1, 5) + h[a] - h[b] : w });
      return true;
    }
    for (i = 1; i < n; i++) add(rng.int(0, i - 1), i);
    var tries = 0;
    while (edges.length < m && tries++ < 400) add(rng.int(0, n - 1), rng.int(0, n - 1));
    if (o.negativeCycle && n >= 3) {
      var a0 = rng.int(0, n - 3), b0 = a0 + 1, c0 = a0 + 2;
      [[a0, b0, 2], [b0, c0, 1], [c0, a0, -5]].forEach(function (t) {
        var key = ids[t[0]] + '>' + ids[t[1]];
        if (seen[key]) edges.forEach(function (e) { if (e.from === ids[t[0]] && e.to === ids[t[1]]) e.w = t[2]; });
        else { seen[key] = true; edges.push({ from: ids[t[0]], to: ids[t[1]], w: t[2] }); }
      });
    }
    return { nodes: ids, edges: edges, directed: true };
  }

  return {
    LIMITS: LIMITS,
    nodeIds: nodeIds, edgeId: edgeId, cleanEdges: cleanEdges, edgeOrder: edgeOrder,
    bellmanFord: bellmanFord, bfResult: bfResult, layers: layers,
    negativeCycle: negativeCycle, cycleWeight: cycleWeight,
    floydWarshall: floydWarshall, fwResult: fwResult, warshallClosure: warshallClosure, pathFromNext: pathFromNext,
    johnson: johnson, arbitrageGraph: arbitrageGraph, arbitrageRates: arbitrageRates, ARBITRAGE_FAIR: FAIR, bestCycle: bestCycle, opModel: opModel,
    parseGraph: parseGraph, randomGraph: randomGraph, fmtD: fmtD, fmtW: fmtW
  };
}));
